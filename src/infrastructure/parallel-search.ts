/**
 * 并行向量搜索模块
 * 
 * 使用 Worker Threads 实现多核并行计算
 * 无需原生模块，纯 TypeScript 实现
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';

// ============================================================
// 类型定义
// ============================================================

export interface ParallelSearchConfig {
  numWorkers: number;
  batchSize: number;
}

export interface SearchResult {
  index: number;
  score: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: ParallelSearchConfig = {
  numWorkers: 4,
  batchSize: 1000,
};

// ============================================================
// Worker 代码
// ============================================================

const workerCode = `
const { parentPort, workerData } = require('worker_threads');

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

const { query, vectors, startIdx } = workerData;

const results = [];
for (let i = 0; i < vectors.length; i++) {
  const score = cosineSimilarity(query, vectors[i]);
  results.push({ index: startIdx + i, score });
}

results.sort((a, b) => b.score - a.score);
parentPort.postMessage(results);
`;

// ============================================================
// 并行搜索器
// ============================================================

export class ParallelVectorSearch {
  private config: ParallelSearchConfig;
  private vectors: Float32Array[] = [];

  constructor(config: Partial<ParallelSearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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
   * 并行搜索
   */
  async search(query: Float32Array, k: number): Promise<SearchResult[]> {
    const numWorkers = Math.min(this.config.numWorkers, this.vectors.length);
    const chunkSize = Math.ceil(this.vectors.length / numWorkers);
    
    // 创建 Worker
    const workers: Promise<SearchResult[]>[] = [];
    
    for (let i = 0; i < numWorkers; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, this.vectors.length);
      const chunk = this.vectors.slice(start, end);
      
      workers.push(this.runWorker(query, chunk, start));
    }
    
    // 等待所有 Worker 完成
    const results = await Promise.all(workers);
    
    // 合并结果
    return this.mergeResults(results, k);
  }

  /**
   * 运行 Worker
   */
  private runWorker(
    query: Float32Array,
    vectors: Float32Array[],
    startIdx: number
  ): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { query, vectors, startIdx },
        eval: true,
      });
      
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  /**
   * 合并结果
   */
  private mergeResults(results: SearchResult[][], k: number): SearchResult[] {
    // 合并所有结果
    const all = results.flat();
    
    // 排序并取 top-k
    all.sort((a, b) => b.score - a.score);
    return all.slice(0, k);
  }

  /**
   * 获取向量数量
   */
  size(): number {
    return this.vectors.length;
  }
}

// ============================================================
// 简化版（不使用 Worker，用于测试）
// ============================================================

export class SimpleVectorSearch {
  private vectors: Float32Array[] = [];

  addVectors(vectors: Float32Array[]): void {
    this.vectors.push(...vectors);
  }

  clear(): void {
    this.vectors = [];
  }

  search(query: Float32Array, k: number): SearchResult[] {
    const results: SearchResult[] = [];
    
    for (let i = 0; i < this.vectors.length; i++) {
      const score = this.cosineSimilarity(query, this.vectors[i]);
      results.push({ index: i, score });
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  }

  size(): number {
    return this.vectors.length;
  }
}

// ============================================================
// 导出
// ============================================================

export function createParallelSearch(config?: Partial<ParallelSearchConfig>): ParallelVectorSearch {
  return new ParallelVectorSearch(config);
}

export function createSimpleSearch(): SimpleVectorSearch {
  return new SimpleVectorSearch();
}
