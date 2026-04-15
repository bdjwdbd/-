/**
 * 向量与嵌入组件
 * 
 * 包含：
 * - EmbeddingService: 嵌入服务
 * - VectorStore: 向量存储
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface EmbeddingConfig {
  provider: string;
  model: string;
  dimensions: number;
  baseUrl?: string;
  apiKey?: string;
}

interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  tokens: number;
}

interface VectorEntry {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface VectorStoreConfig {
  persistPath?: string;
  maxEntries?: number;
}

// ============================================================
// EmbeddingService - 嵌入服务
// ============================================================

export class EmbeddingService {
  private config: EmbeddingConfig;
  private cache: Map<string, number[]> = new Map();
  
  constructor(config: EmbeddingConfig) {
    this.config = config;
  }
  
  async embed(text: string): Promise<EmbeddingResult> {
    // 检查缓存
    const cacheKey = this.hashText(text);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return {
        vector: cached,
        model: this.config.model,
        dimensions: this.config.dimensions,
        tokens: Math.ceil(text.length / 4),
      };
    }
    
    // 模拟嵌入（实际应调用 API）
    const vector = await this.generateEmbedding(text);
    
    // 缓存
    this.cache.set(cacheKey, vector);
    
    return {
      vector,
      model: this.config.model,
      dimensions: this.config.dimensions,
      tokens: Math.ceil(text.length / 4),
    };
  }
  
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    
    return results;
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    // 模拟 API 调用延迟
    await new Promise(r => setTimeout(r, 10));
    
    // 生成模拟向量
    const vector: number[] = [];
    const hash = crypto.createHash("sha256").update(text).digest();
    
    for (let i = 0; i < this.config.dimensions; i++) {
      const value = (hash[i % hash.length] / 128 - 1) * 0.5;
      vector.push(value + (Math.random() - 0.5) * 0.1);
    }
    
    // 归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => v / norm);
  }
  
  private hashText(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex");
  }
  
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================
// VectorStore - 向量存储
// ============================================================

export class VectorStore {
  private entries: Map<string, VectorEntry> = new Map();
  private config: VectorStoreConfig;
  private dimensions: number;
  
  constructor(dimensions: number, config?: VectorStoreConfig) {
    this.dimensions = dimensions;
    this.config = {
      persistPath: "./vectors",
      maxEntries: 10000,
      ...config,
    };
    
    if (this.config.persistPath) {
      this.ensureDir(this.config.persistPath);
      this.load();
    }
  }
  
  add(id: string, vector: number[], metadata?: Record<string, unknown>): void {
    if (vector.length !== this.dimensions) {
      throw new Error(`向量维度不匹配: 期望 ${this.dimensions}, 实际 ${vector.length}`);
    }
    
    this.entries.set(id, {
      id,
      vector,
      metadata,
      createdAt: new Date(),
    });
    
    // 限制条目数
    if (this.entries.size > (this.config.maxEntries || 10000)) {
      const oldest = Array.from(this.entries.entries())
        .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime())[0];
      if (oldest) {
        this.entries.delete(oldest[0]);
      }
    }
  }
  
  search(query: number[], topK: number = 10): VectorSearchResult[] {
    if (query.length !== this.dimensions) {
      throw new Error(`查询向量维度不匹配`);
    }
    
    const results: Array<{ id: string; score: number; metadata?: any }> = [];
    
    for (const [id, entry] of this.entries) {
      const score = this.cosineSimilarity(query, entry.vector);
      results.push({ id, score, metadata: entry.metadata });
    }
    
    // 排序并返回 topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
  
  get(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }
  
  delete(id: string): boolean {
    return this.entries.delete(id);
  }
  
  clear(): void {
    this.entries.clear();
  }
  
  size(): number {
    return this.entries.size;
  }
  
  save(): void {
    if (!this.config.persistPath) return;
    
    const data = {
      dimensions: this.dimensions,
      entries: Array.from(this.entries.entries()),
      savedAt: new Date().toISOString(),
    };
    
    const filePath = path.join(this.config.persistPath, "vectors.json");
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
  
  private load(): void {
    if (!this.config.persistPath) return;
    
    const filePath = path.join(this.config.persistPath, "vectors.json");
    if (!fs.existsSync(filePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      
      this.entries.clear();
      
      for (const [id, entry] of data.entries) {
        entry.createdAt = new Date(entry.createdAt);
        this.entries.set(id, entry);
      }
    } catch (e) {
      // 忽略加载错误
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
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export type {
  EmbeddingConfig,
  EmbeddingResult,
  VectorEntry,
  VectorSearchResult,
  VectorStoreConfig,
};
