/**
 * 批量搜索引擎
 * 
 * 优化目标：
 * 1. 批量查询接口 - 减少单次搜索开销
 * 2. 矩阵乘法优化 - 利用 JS 引擎 SIMD
 * 3. 批量 Top-K - 减少排序开销
 * 
 * 预期效果：10x 性能提升
 */

import { Worker, isMainThread, parentPort } from 'worker_threads';
import * as os from 'os';
import {
  MemoryOptimizedIndexBuilder,
  type MemoryOptimizedIndex,
} from './memory-optimized-index';

// ============================================================
// 类型定义
// ============================================================

export interface BatchSearchResult {
  id: number;
  score: number;
}

export interface BatchSearchConfig {
  threads: number;
  batchSize: number;
  topK: number;
}

// ============================================================
// Worker 线程代码
// ============================================================

if (!isMainThread && parentPort) {
  parentPort.on('message', (task: {
    type: 'batch_search';
    queries: Float32Array[];
    data: Float32Array;
    norms: Float32Array;
    offsets: Uint32Array;
    count: number;
    dimension: number;
    startIdx: number;
    endIdx: number;
    topK: number;
  }) => {
    const { queries, data, norms, count, dimension, startIdx, endIdx, topK } = task;
    const numQueries = queries.length;
    const chunkSize = endIdx - startIdx;

    // 预计算查询范数
    const queryNorms = new Float32Array(numQueries);
    for (let q = 0; q < numQueries; q++) {
      let normSq = 0;
      for (let i = 0; i < dimension; i++) {
        normSq += queries[q][i] * queries[q][i];
      }
      queryNorms[q] = Math.sqrt(normSq);
    }

    // 计算对齐大小
    const alignment = 64;
    const alignedSize = Math.ceil(dimension * 4 / alignment) * alignment / 4;

    // 批量计算相似度
    const allScores: Float32Array[] = [];
    for (let q = 0; q < numQueries; q++) {
      allScores.push(new Float32Array(chunkSize));
    }

    for (let i = 0; i < chunkSize; i++) {
      const vecIdx = startIdx + i;
      const offset = vecIdx * alignedSize;
      const norm = norms[vecIdx];

      for (let q = 0; q < numQueries; q++) {
        let dot = 0;
        for (let j = 0; j < dimension; j++) {
          dot += queries[q][j] * data[offset + j];
        }

        const queryNorm = queryNorms[q];
        allScores[q][i] = norm > 0 && queryNorm > 0 ? dot / (norm * queryNorm) : 0;
      }
    }

    // 批量 Top-K
    const results: BatchSearchResult[][] = [];
    for (let q = 0; q < numQueries; q++) {
      const scores = allScores[q];
      const indexed = Array.from(scores).map((score, i) => ({
        id: startIdx + i,
        score,
      }));

      // 部分排序（只取 Top-K）
      indexed.sort((a, b) => b.score - a.score);
      results.push(indexed.slice(0, topK));
    }

    parentPort!.postMessage({ startIdx, results });
  });
}

// ============================================================
// 批量搜索引擎
// ============================================================

export class BatchSearchEngine {
  private config: Required<BatchSearchConfig>;
  private workers: Worker[] = [];
  private index: MemoryOptimizedIndex | null = null;
  private indexBuilder: MemoryOptimizedIndexBuilder;

  constructor(config: Partial<BatchSearchConfig> = {}) {
    this.config = {
      threads: config.threads ?? Math.min(os.cpus().length, 32),
      batchSize: config.batchSize ?? 100,
      topK: config.topK ?? 10,
    };
    this.indexBuilder = new MemoryOptimizedIndexBuilder();
  }

  /**
   * 构建索引
   */
  buildIndex(vectors: Float32Array[]): void {
    this.index = this.indexBuilder.build(vectors);
  }

  /**
   * 初始化多线程
   */
  async initialize(): Promise<void> {
    if (this.workers.length > 0) return;

    const workerPath = __filename;
    for (let i = 0; i < this.config.threads; i++) {
      this.workers.push(new Worker(workerPath));
    }
  }

  /**
   * 单查询搜索
   */
  async search(query: Float32Array, k?: number): Promise<BatchSearchResult[]> {
    const results = await this.batchSearch([query], k);
    return results[0];
  }

  /**
   * 批量搜索
   */
  async batchSearch(
    queries: Float32Array[],
    k?: number
  ): Promise<BatchSearchResult[][]> {
    if (!this.index) {
      throw new Error('请先调用 buildIndex() 构建索引');
    }

    const topK = k ?? this.config.topK;
    const { data, norms, offsets, count, dimension } = this.index;

    // 单线程模式
    if (this.workers.length === 0) {
      return this.singleThreadBatchSearch(queries, topK);
    }

    // 多线程模式
    return this.parallelBatchSearch(queries, topK);
  }

  /**
   * 单线程批量搜索
   */
  private singleThreadBatchSearch(
    queries: Float32Array[],
    topK: number
  ): BatchSearchResult[][] {
    if (!this.index) throw new Error('索引未构建');

    const scores = this.indexBuilder.batchMultiQuerySimilarity(this.index, queries);

    return scores.map(s => {
      const indexed = Array.from(s).map((score, id) => ({ id, score }));
      indexed.sort((a, b) => b.score - a.score);
      return indexed.slice(0, topK);
    });
  }

  /**
   * 并行批量搜索
   */
  private async parallelBatchSearch(
    queries: Float32Array[],
    topK: number
  ): Promise<BatchSearchResult[][]> {
    if (!this.index) throw new Error('索引未构建');

    const { data, norms, offsets, count, dimension } = this.index;
    const numWorkers = this.workers.length;
    const chunkSize = Math.ceil(count / numWorkers);

    // 分发任务
    const promises = this.workers.map((worker, idx) => {
      const startIdx = idx * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, count);

      if (startIdx >= count) {
        return Promise.resolve({ startIdx: -1, results: [] });
      }

      return new Promise<{ startIdx: number; results: BatchSearchResult[][] }>(
        (resolve) => {
          worker.once('message', (result) => resolve(result));
          worker.postMessage({
            type: 'batch_search',
            queries,
            data,
            norms,
            offsets,
            count,
            dimension,
            startIdx,
            endIdx,
            topK,
          });
        }
      );
    });

    const results = await Promise.all(promises);

    // 合并结果
    const merged: BatchSearchResult[][] = [];
    for (let q = 0; q < queries.length; q++) {
      const allResults: BatchSearchResult[] = [];
      for (const chunk of results) {
        if (chunk.startIdx >= 0 && chunk.results[q]) {
          allResults.push(...chunk.results[q]);
        }
      }
      allResults.sort((a, b) => b.score - a.score);
      merged.push(allResults.slice(0, topK));
    }

    return merged;
  }

  /**
   * 关闭
   */
  async shutdown(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
  }
}

// ============================================================
// 工厂函数
// ============================================================

let defaultEngine: BatchSearchEngine | null = null;

export function getBatchSearchEngine(
  config?: Partial<BatchSearchConfig>
): BatchSearchEngine {
  if (!defaultEngine) {
    defaultEngine = new BatchSearchEngine(config);
  }
  return defaultEngine;
}

export async function initBatchSearchEngine(
  config?: Partial<BatchSearchConfig>
): Promise<BatchSearchEngine> {
  const engine = getBatchSearchEngine(config);
  await engine.initialize();
  return engine;
}
