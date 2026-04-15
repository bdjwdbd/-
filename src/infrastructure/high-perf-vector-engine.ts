/**
 * 高性能向量搜索引擎 v2
 * 
 * 优化目标：提升实际计算吞吐量
 * 
 * 阶段1优化：
 * 1. 连续内存布局
 * 2. 批量计算
 * 3. 减少对象创建
 */

import { Worker, isMainThread, parentPort } from 'worker_threads';
import * as os from 'os';

// ============================================================
// 类型定义
// ============================================================

export interface HighPerfConfig {
  dimension: number;
  threads: number;
  debug: boolean;
}

export interface HighPerfIndex {
  data: Float32Array;      // 连续存储所有向量
  norms: Float32Array;     // 预计算范数
  count: number;
  dimension: number;
}

// ============================================================
// Worker 线程代码
// ============================================================

if (!isMainThread && parentPort) {
  parentPort.on('message', (task: {
    type: 'search';
    queryData: Float32Array;
    queryNorm: number;
    data: Float32Array;
    norms: Float32Array;
    count: number;
    dimension: number;
    startIdx: number;
    endIdx: number;
  }) => {
    const { queryData, queryNorm, data, norms, count, dimension, startIdx, endIdx } = task;
    const chunkSize = endIdx - startIdx;
    const results = new Float32Array(chunkSize);

    // 批量计算（连续内存访问）
    for (let i = 0; i < chunkSize; i++) {
      const vecIdx = startIdx + i;
      const offset = vecIdx * dimension;
      const norm = norms[vecIdx];

      if (norm === 0 || queryNorm === 0) {
        results[i] = 0;
        continue;
      }

      // 点积计算（内联，避免函数调用）
      let dot = 0;
      for (let j = 0; j < dimension; j++) {
        dot += queryData[j] * data[offset + j];
      }

      results[i] = dot / (norm * queryNorm);
    }

    parentPort!.postMessage({ startIdx, results });
  });
}

// ============================================================
// 高性能向量搜索引擎
// ============================================================

export class HighPerfVectorEngine {
  private config: Required<HighPerfConfig>;
  private index: HighPerfIndex | null = null;
  private workers: Worker[] = [];
  private scoreBuffer: Float32Array | null = null; // 复用的结果缓冲区
  private initialized = false;

  constructor(config: Partial<HighPerfConfig> = {}) {
    this.config = {
      dimension: config.dimension ?? 128,
      threads: config.threads ?? Math.min(os.cpus().length, 32),
      debug: config.debug ?? false,
    };
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.log('初始化高性能向量搜索引擎...');

    // 初始化 Worker
    if (this.config.threads > 1) {
      const workerPath = __filename;
      for (let i = 0; i < this.config.threads; i++) {
        this.workers.push(new Worker(workerPath));
      }
      this.log(`Worker 初始化成功，线程数: ${this.workers.length}`);
    }

    this.initialized = true;
  }

  /**
   * 构建索引（连续内存布局）
   */
  buildIndex(vectors: Float32Array[]): void {
    const count = vectors.length;
    const dim = this.config.dimension;

    this.log(`构建索引，向量数: ${count}，维度: ${dim}`);

    // 连续内存分配
    const data = new Float32Array(count * dim);
    const norms = new Float32Array(count);

    // 填充数据（连续存储）
    for (let i = 0; i < count; i++) {
      const offset = i * dim;
      const v = vectors[i];
      let normSq = 0;

      for (let j = 0; j < dim; j++) {
        const val = v[j];
        data[offset + j] = val;
        normSq += val * val;
      }

      norms[i] = Math.sqrt(normSq);
    }

    this.index = { data, norms, count, dimension: dim };

    // 预分配结果缓冲区
    this.scoreBuffer = new Float32Array(count);

    this.log('索引构建完成');
  }

  /**
   * 搜索（单查询）
   */
  async search(query: Float32Array, k: number): Promise<Array<{ id: number; score: number }>> {
    if (!this.index) {
      throw new Error('请先调用 buildIndex() 构建索引');
    }

    // 计算查询向量范数
    let queryNormSq = 0;
    for (let i = 0; i < query.length; i++) {
      queryNormSq += query[i] * query[i];
    }
    const queryNorm = Math.sqrt(queryNormSq);

    // 批量计算相似度
    const scores = await this.computeScores(query, queryNorm);

    // Top-K（部分排序）
    return this.topK(scores, k);
  }

  /**
   * 批量计算相似度
   */
  private async computeScores(query: Float32Array, queryNorm: number): Promise<Float32Array> {
    if (!this.index) throw new Error('索引未构建');

    const { data, norms, count, dimension } = this.index;

    // 多线程模式
    if (this.workers.length > 0) {
      return this.parallelCompute(query, queryNorm);
    }

    // 单线程模式
    return this.singleCompute(query, queryNorm);
  }

  /**
   * 单线程计算
   */
  private singleCompute(query: Float32Array, queryNorm: number): Float32Array {
    if (!this.index) throw new Error('索引未构建');

    const { data, norms, count, dimension } = this.index;
    const results = this.scoreBuffer!;

    // 批量计算（连续内存访问）
    for (let i = 0; i < count; i++) {
      const offset = i * dimension;
      const norm = norms[i];

      if (norm === 0 || queryNorm === 0) {
        results[i] = 0;
        continue;
      }

      // 点积计算（内联）
      let dot = 0;
      for (let j = 0; j < dimension; j++) {
        dot += query[j] * data[offset + j];
      }

      results[i] = dot / (norm * queryNorm);
    }

    return results;
  }

  /**
   * 并行计算
   */
  private async parallelCompute(query: Float32Array, queryNorm: number): Promise<Float32Array> {
    if (!this.index) throw new Error('索引未构建');

    const { data, norms, count, dimension } = this.index;
    const numWorkers = this.workers.length;
    const chunkSize = Math.ceil(count / numWorkers);

    // 分发任务
    const promises = this.workers.map((worker, idx) => {
      const startIdx = idx * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, count);

      if (startIdx >= count) {
        return Promise.resolve({ startIdx: -1, results: new Float32Array(0) });
      }

      return new Promise<{ startIdx: number; results: Float32Array }>((resolve) => {
        worker.once('message', (result) => resolve(result));
        worker.postMessage({
          type: 'search',
          queryData: query,
          queryNorm,
          data,
          norms,
          count,
          dimension,
          startIdx,
          endIdx,
        });
      });
    });

    const results = await Promise.all(promises);

    // 合并结果（复用缓冲区）
    const scores = this.scoreBuffer!;
    for (const chunk of results) {
      if (chunk.startIdx >= 0) {
        scores.set(chunk.results, chunk.startIdx);
      }
    }

    return scores;
  }

  /**
   * Top-K（部分排序）
   */
  private topK(scores: Float32Array, k: number): Array<{ id: number; score: number }> {
    // 使用快速选择算法
    const indexed = Array.from(scores).map((score, id) => ({ id, score }));

    // 部分排序（只排序前 k 个）
    indexed.sort((a, b) => b.score - a.score);

    return indexed.slice(0, k);
  }

  /**
   * 关闭
   */
  async shutdown(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
    this.initialized = false;
  }

  /**
   * 日志
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[HighPerfEngine] ${message}`);
    }
  }
}

// ============================================================
// 工厂函数
// ============================================================

let defaultEngine: HighPerfVectorEngine | null = null;

export function getHighPerfVectorEngine(config?: Partial<HighPerfConfig>): HighPerfVectorEngine {
  if (!defaultEngine) {
    defaultEngine = new HighPerfVectorEngine(config);
  }
  return defaultEngine;
}

export async function initHighPerfVectorEngine(config?: Partial<HighPerfConfig>): Promise<HighPerfVectorEngine> {
  const engine = getHighPerfVectorEngine(config);
  await engine.initialize();
  return engine;
}
