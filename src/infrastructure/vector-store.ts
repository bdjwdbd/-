/**
 * 向量存储模块
 * 
 * 基于内存的向量搜索（简化版）
 * 融合自 yaoyao-memory-v2
 * 
 * 注：生产环境可替换为 FAISS/Annoy 版本
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export interface Vector {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface VectorStoreConfig {
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dot';
  maxVectors: number;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: VectorStoreConfig = {
  dimension: 128,
  metric: 'cosine',
  maxVectors: 10000
};

// ============ 向量存储类 ============

export class VectorStore {
  private logger: StructuredLogger;
  private config: VectorStoreConfig;
  private vectors: Map<string, Vector> = new Map();

  constructor(logger: StructuredLogger, config?: Partial<VectorStoreConfig>) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============ 向量操作 ============

  add(id: string, values: number[], metadata: Record<string, unknown> = {}): boolean {
    if (values.length !== this.config.dimension) {
      this.logger.warn('VectorStore', `向量维度不匹配: ${values.length} != ${this.config.dimension}`);
      return false;
    }

    if (this.vectors.size >= this.config.maxVectors) {
      this.logger.warn('VectorStore', '向量存储已满');
      return false;
    }

    this.vectors.set(id, {
      id,
      values,
      metadata,
      createdAt: Date.now()
    });

    return true;
  }

  get(id: string): Vector | undefined {
    return this.vectors.get(id);
  }

  delete(id: string): boolean {
    return this.vectors.delete(id);
  }

  // ============ 搜索操作 ============

  search(query: number[], options?: {
    topK?: number;
    filter?: (metadata: Record<string, unknown>) => boolean;
  }): VectorSearchResult[] {
    const topK = options?.topK || 10;
    const results: VectorSearchResult[] = [];

    for (const vector of this.vectors.values()) {
      // 应用过滤器
      if (options?.filter && !options.filter(vector.metadata)) {
        continue;
      }

      const score = this.calculateSimilarity(query, vector.values);
      results.push({
        id: vector.id,
        score,
        metadata: vector.metadata
      });
    }

    // 按相似度排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  // ============ 相似度计算 ============

  private calculateSimilarity(a: number[], b: number[]): number {
    switch (this.config.metric) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'euclidean':
        return this.euclideanSimilarity(a, b);
      case 'dot':
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private euclideanSimilarity(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return 1 / (1 + Math.sqrt(sum));
  }

  private dotProduct(a: number[], b: number[]): number {
    let product = 0;
    for (let i = 0; i < a.length; i++) {
      product += a[i] * b[i];
    }
    return product;
  }

  // ============ 批量操作 ============

  addBatch(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>): number {
    let count = 0;
    for (const v of vectors) {
      if (this.add(v.id, v.values, v.metadata || {})) {
        count++;
      }
    }
    return count;
  }

  deleteBatch(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.delete(id)) {
        count++;
      }
    }
    return count;
  }

  // ============ 统计 ============

  getStats(): {
    total: number;
    dimension: number;
    metric: string;
    maxVectors: number;
  } {
    return {
      total: this.vectors.size,
      dimension: this.config.dimension,
      metric: this.config.metric,
      maxVectors: this.config.maxVectors
    };
  }

  // ============ 导入导出 ============

  exportAll(): Vector[] {
    return Array.from(this.vectors.values());
  }

  importBatch(vectors: Vector[]): number {
    let count = 0;
    for (const v of vectors) {
      this.vectors.set(v.id, v);
      count++;
    }
    return count;
  }

  // ============ 清理 ============

  clear(): void {
    this.vectors.clear();
    this.logger.info('VectorStore', '已清空');
  }
}

// ============ 简单文本向量化器 ============

export class SimpleTextVectorizer {
  private dimension: number;
  private vocabulary: Map<string, number> = new Map();

  constructor(dimension: number = 128) {
    this.dimension = dimension;
  }

  // 简单的词袋向量化
  vectorize(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(this.dimension).fill(0);

    for (const word of words) {
      // 使用简单的哈希函数
      const hash = this.hashWord(word);
      const index = Math.abs(hash) % this.dimension;
      vector[index] += 1;
    }

    // 归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  private hashWord(word: string): number {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}
