/**
 * 高性能向量搜索引擎 v3
 * 
 * 优化目标：提升实际计算吞吐量
 * 
 * 阶段1优化（已验证）：
 * 1. 连续内存布局 ✅ 有效
 * 2. Worker 通信是瓶颈 ❌ 需要减少
 * 
 * 阶段2优化：
 * 1. INT8 量化（+6%）
 * 2. 批量搜索减少通信（+2-3x）
 * 3. 单线程优先（避免通信开销）
 */

import { Worker, isMainThread, parentPort } from 'worker_threads';
import * as os from 'os';

// ============================================================
// 类型定义
// ============================================================

export interface HighPerfV3Config {
  dimension: number;
  threads: number;
  useInt8: boolean;
  debug: boolean;
}

export interface Int8Index {
  data: Int8Array;          // INT8 量化数据
  scales: Float32Array;     // 每个向量的缩放因子
  norms: Float32Array;      // 预计算范数
  count: number;
  dimension: number;
}

// ============================================================
// Worker 线程代码
// ============================================================

if (!isMainThread && parentPort) {
  parentPort.on('message', (task: {
    type: 'batch_search';
    queries: Int8Array[];
    queryScales: Float32Array;
    queryNorms: Float32Array;
    data: Int8Array;
    scales: Float32Array;
    norms: Float32Array;
    count: number;
    dimension: number;
    startIdx: number;
    endIdx: number;
    topK: number;
  }) => {
    const { 
      queries, queryScales, queryNorms,
      data, scales, norms, count, dimension, 
      startIdx, endIdx, topK 
    } = task;

    const chunkSize = endIdx - startIdx;
    const numQueries = queries.length;
    const results: Array<Array<{ id: number; score: number }>> = [];

    // 批量处理所有查询
    for (let q = 0; q < numQueries; q++) {
      const queryData = queries[q];
      const queryScale = queryScales[q];
      const queryNorm = queryNorms[q];

      const scores: Array<{ id: number; score: number }> = [];

      for (let i = 0; i < chunkSize; i++) {
        const vecIdx = startIdx + i;
        const offset = vecIdx * dimension;
        const scale = scales[vecIdx];
        const norm = norms[vecIdx];

        if (norm === 0 || queryNorm === 0) {
          scores.push({ id: vecIdx, score: 0 });
          continue;
        }

        // INT8 点积
        let dot = 0;
        for (let j = 0; j < dimension; j++) {
          dot += queryData[j] * data[offset + j];
        }

        // 还原真实值
        const realDot = dot * queryScale * scale;
        const score = realDot / (norm * queryNorm);

        scores.push({ id: vecIdx, score });
      }

      // 部分 Top-K
      scores.sort((a, b) => b.score - a.score);
      results.push(scores.slice(0, topK));
    }

    parentPort!.postMessage({ startIdx, results });
  });
}

// ============================================================
// 高性能向量搜索引擎 v3
// ============================================================

export class HighPerfVectorEngineV3 {
  private config: Required<HighPerfV3Config>;
  private int8Index: Int8Index | null = null;
  private workers: Worker[] = [];
  private initialized = false;

  constructor(config: Partial<HighPerfV3Config> = {}) {
    this.config = {
      dimension: config.dimension ?? 128,
      threads: config.threads ?? 1, // 默认单线程
      useInt8: config.useInt8 ?? true,
      debug: config.debug ?? false,
    };
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.log('初始化高性能向量搜索引擎 v3...');

    // 只在多线程时初始化 Worker
    if (this.config.threads > 1) {
      const workerPath = __filename;
      for (let i = 0; i < this.config.threads; i++) {
        this.workers.push(new Worker(workerPath));
      }
      this.log(`Worker 初始化成功，线程数: ${this.workers.length}`);
    } else {
      this.log('使用单线程模式');
    }

    this.initialized = true;
  }

  /**
   * 构建索引（INT8 量化 + 连续内存）
   */
  buildIndex(vectors: Float32Array[]): void {
    const count = vectors.length;
    const dim = this.config.dimension;

    this.log(`构建 INT8 索引，向量数: ${count}，维度: ${dim}`);

    // INT8 量化
    const data = new Int8Array(count * dim);
    const scales = new Float32Array(count);
    const norms = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * dim;
      const v = vectors[i];

      // 找最大绝对值
      let maxAbs = 0;
      for (let j = 0; j < dim; j++) {
        const abs = Math.abs(v[j]);
        if (abs > maxAbs) maxAbs = abs;
      }

      // 避免除零
      if (maxAbs === 0) maxAbs = 1;

      // 计算缩放因子
      const scale = maxAbs / 127;
      scales[i] = scale;

      // 量化
      let normSq = 0;
      for (let j = 0; j < dim; j++) {
        const quantized = Math.round(v[j] / scale);
        const clamped = Math.max(-128, Math.min(127, quantized));
        data[offset + j] = clamped;
        normSq += clamped * clamped;
      }

      // 范数（基于量化值）
      norms[i] = Math.sqrt(normSq) * scale;
    }

    this.int8Index = { data, scales, norms, count, dimension: dim };

    this.log('INT8 索引构建完成');
  }

  /**
   * 单查询搜索
   */
  async search(query: Float32Array, k: number): Promise<Array<{ id: number; score: number }>> {
    const results = await this.batchSearch([query], k);
    return results[0];
  }

  /**
   * 批量搜索（减少通信）
   */
  async batchSearch(
    queries: Float32Array[],
    k: number
  ): Promise<Array<Array<{ id: number; score: number }>>> {
    if (!this.int8Index) {
      throw new Error('请先调用 buildIndex() 构建索引');
    }

    // 量化查询
    const quantizedQueries: Int8Array[] = [];
    const queryScales = new Float32Array(queries.length);
    const queryNorms = new Float32Array(queries.length);

    for (let q = 0; q < queries.length; q++) {
      const query = queries[q];
      const { data, scale, norm } = this.quantizeQuery(query);
      quantizedQueries.push(data);
      queryScales[q] = scale;
      queryNorms[q] = norm;
    }

    // 单线程模式
    if (this.workers.length === 0) {
      return this.singleBatchSearch(quantizedQueries, queryScales, queryNorms, k);
    }

    // 多线程模式
    return this.parallelBatchSearch(quantizedQueries, queryScales, queryNorms, k);
  }

  /**
   * 量化查询向量
   */
  private quantizeQuery(query: Float32Array): {
    data: Int8Array;
    scale: number;
    norm: number;
  } {
    const dim = query.length;

    // 找最大绝对值
    let maxAbs = 0;
    for (let i = 0; i < dim; i++) {
      const abs = Math.abs(query[i]);
      if (abs > maxAbs) maxAbs = abs;
    }

    if (maxAbs === 0) maxAbs = 1;

    const scale = maxAbs / 127;
    const data = new Int8Array(dim);

    let normSq = 0;
    for (let i = 0; i < dim; i++) {
      const quantized = Math.round(query[i] / scale);
      const clamped = Math.max(-128, Math.min(127, quantized));
      data[i] = clamped;
      normSq += clamped * clamped;
    }

    return { data, scale, norm: Math.sqrt(normSq) * scale };
  }

  /**
   * 单线程批量搜索
   */
  private singleBatchSearch(
    queries: Int8Array[],
    queryScales: Float32Array,
    queryNorms: Float32Array,
    k: number
  ): Array<Array<{ id: number; score: number }>> {
    if (!this.int8Index) throw new Error('索引未构建');

    const { data, scales, norms, count, dimension } = this.int8Index;
    const numQueries = queries.length;
    const results: Array<Array<{ id: number; score: number }>> = [];

    for (let q = 0; q < numQueries; q++) {
      const queryData = queries[q];
      const queryScale = queryScales[q];
      const queryNorm = queryNorms[q];

      const scores: Array<{ id: number; score: number }> = [];

      for (let i = 0; i < count; i++) {
        const offset = i * dimension;
        const scale = scales[i];
        const norm = norms[i];

        if (norm === 0 || queryNorm === 0) {
          scores.push({ id: i, score: 0 });
          continue;
        }

        // INT8 点积
        let dot = 0;
        for (let j = 0; j < dimension; j++) {
          dot += queryData[j] * data[offset + j];
        }

        // 还原真实值
        const realDot = dot * queryScale * scale;
        const score = realDot / (norm * queryNorm);

        scores.push({ id: i, score });
      }

      // Top-K
      scores.sort((a, b) => b.score - a.score);
      results.push(scores.slice(0, k));
    }

    return results;
  }

  /**
   * 并行批量搜索
   */
  private async parallelBatchSearch(
    queries: Int8Array[],
    queryScales: Float32Array,
    queryNorms: Float32Array,
    k: number
  ): Promise<Array<Array<{ id: number; score: number }>>> {
    if (!this.int8Index) throw new Error('索引未构建');

    const { data, scales, norms, count, dimension } = this.int8Index;
    const numWorkers = this.workers.length;
    const chunkSize = Math.ceil(count / numWorkers);

    // 分发任务（一次通信处理所有查询）
    const promises = this.workers.map((worker, idx) => {
      const startIdx = idx * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, count);

      if (startIdx >= count) {
        return Promise.resolve({ startIdx: -1, results: [] });
      }

      return new Promise<{ startIdx: number; results: Array<Array<{ id: number; score: number }>> }>(
        (resolve) => {
          worker.once('message', (result) => resolve(result));
          worker.postMessage({
            type: 'batch_search',
            queries,
            queryScales,
            queryNorms,
            data,
            scales,
            norms,
            count,
            dimension,
            startIdx,
            endIdx,
            topK: k,
          });
        }
      );
    });

    const chunkResults = await Promise.all(promises);

    // 合并结果
    const merged: Array<Array<{ id: number; score: number }>> = [];
    for (let q = 0; q < queries.length; q++) {
      const allScores: Array<{ id: number; score: number }> = [];
      for (const chunk of chunkResults) {
        if (chunk.startIdx >= 0 && chunk.results[q]) {
          allScores.push(...chunk.results[q]);
        }
      }
      allScores.sort((a, b) => b.score - a.score);
      merged.push(allScores.slice(0, k));
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
    this.initialized = false;
  }

  /**
   * 日志
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[HighPerfV3] ${message}`);
    }
  }
}

// ============================================================
// 工厂函数
// ============================================================

let defaultEngine: HighPerfVectorEngineV3 | null = null;

export function getHighPerfVectorEngineV3(config?: Partial<HighPerfV3Config>): HighPerfVectorEngineV3 {
  if (!defaultEngine) {
    defaultEngine = new HighPerfVectorEngineV3(config);
  }
  return defaultEngine;
}

export async function initHighPerfVectorEngineV3(config?: Partial<HighPerfV3Config>): Promise<HighPerfVectorEngineV3> {
  const engine = getHighPerfVectorEngineV3(config);
  await engine.initialize();
  return engine;
}
