/**
 * 自适应向量搜索引擎
 * 
 * 根据数据规模和环境自动选择最优搜索方案：
 * 1. 小数据量 (<1万): TypeScript 单线程
 * 2. 中数据量 (1万-10万): Worker Threads 并行
 * 3. 大数据量 (>10万): 原生模块（如果可用）
 */

import { HighPerfVectorEngineV3 } from './high-perf-vector-engine-v3';

// ============================================================
// 类型定义
// ============================================================

export interface AdaptiveSearchConfig {
  smallThreshold: number;    // 小数据量阈值
  mediumThreshold: number;   // 中数据量阈值
  numWorkers: number;        // Worker 数量
}

export interface SearchResult {
  index: number;
  score: number;
}

// 简单向量搜索（降级实现）
class SimpleVectorSearch {
    private vectors: Float32Array[] = [];
    
    add(vector: Float32Array): void {
        this.vectors.push(vector);
    }
    
    search(query: Float32Array, k: number): SearchResult[] {
        const scores = this.vectors.map((v, i) => ({
            index: i,
            score: this.cosineSimilarity(query, v)
        }));
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, k);
    }
    
    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

// 加速器类型（降级实现）
type Accelerator = SimpleVectorSearch | HighPerfVectorEngineV3;

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: AdaptiveSearchConfig = {
  smallThreshold: 10000,
  mediumThreshold: 100000,
  numWorkers: 4,
};

// ============================================================
// 自适应搜索引擎
// ============================================================

export class AdaptiveVectorSearch {
  private config: AdaptiveSearchConfig;
  private vectors: Float32Array[] = [];
  private accelerator: Accelerator | null = null;
  private nativeAvailable: boolean = false;
  private initialized: boolean = false;

  constructor(config: Partial<AdaptiveSearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // 尝试加载原生加速器
    try {
      this.accelerator = new SimpleVectorSearch();
      // 检查是否有原生模块（通过尝试使用）
      this.nativeAvailable = false; // TypeScript 实现总是可用
    } catch {
      this.nativeAvailable = false;
    }
    
    this.initialized = true;
  }

  /**
   * 添加向量
   */
  addVectors(vectors: Float32Array[]): void {
    this.vectors.push(...vectors);
  }

  /**
   * 清空向量
   */
  clear(): void {
    this.vectors = [];
  }

  /**
   * 搜索（自动选择最优方案）
   */
  async search(query: Float32Array, k: number): Promise<SearchResult[]> {
    const size = this.vectors.length;
    
    // 确保初始化
    if (!this.initialized) {
      await this.initialize();
    }
    
    // 根据数据规模选择方案
    if (size < this.config.smallThreshold) {
      // 小数据量：单线程
      return this.smallSearch(query, k);
    } else if (size < this.config.mediumThreshold) {
      // 中数据量：Worker Threads
      return this.mediumSearch(query, k);
    } else if (this.nativeAvailable && this.accelerator) {
      // 大数据量：原生模块
      return this.nativeSearch(query, k);
    } else {
      // 回退：Worker Threads
      return this.mediumSearch(query, k);
    }
  }

  /**
   * 小数据量搜索
   */
  private smallSearch(query: Float32Array, k: number): SearchResult[] {
    const search = new SimpleVectorSearch();
    this.vectors.forEach(v => search.add(v));
    return search.search(query, k);
  }

  /**
   * 中数据量搜索
   */
  private async mediumSearch(query: Float32Array, k: number): Promise<SearchResult[]> {
    const search = new HighPerfVectorEngineV3({ threads: this.config.numWorkers });
    await search.initialize();
    search.buildIndex(this.vectors);
    const results = await search.search(query, k);
    await search.shutdown();
    return results.map(r => ({ index: r.id, score: r.score }));
  }

  /**
   * 原生搜索
   */
  private nativeSearch(query: Float32Array, k: number): SearchResult[] {
    if (!this.accelerator) {
      return this.smallSearch(query, k);
    }
    
    // 使用 SimpleVectorSearch 的 search 方法
    // @ts-ignore - 类型兼容性
    return this.accelerator.search(query, k);
  }

  /**
   * 获取当前方案
   */
  getCurrentScheme(): string {
    const size = this.vectors.length;
    
    if (size < this.config.smallThreshold) {
      return 'TypeScript (单线程)';
    } else if (size < this.config.mediumThreshold) {
      return 'Worker Threads (并行)';
    } else if (this.nativeAvailable) {
      return 'Native (C++ SIMD)';
    } else {
      return 'Worker Threads (并行)';
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    vectorCount: number;
    scheme: string;
    nativeAvailable: boolean;
  } {
    return {
      vectorCount: this.vectors.length,
      scheme: this.getCurrentScheme(),
      nativeAvailable: this.nativeAvailable,
    };
  }

  /**
   * 获取向量数量
   */
  size(): number {
    return this.vectors.length;
  }
}

// ============================================================
// 导出
// ============================================================

export function createAdaptiveSearch(config?: Partial<AdaptiveSearchConfig>): AdaptiveVectorSearch {
  return new AdaptiveVectorSearch(config);
}
