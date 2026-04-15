/**
 * 高性能向量搜索引擎 v4
 * 
 * 优化目标：减少 Worker 数据传输
 * 
 * 阶段3优化：
 * 1. Worker 预加载索引（避免每次传输）
 * 2. 更大批量（500-1000）
 * 3. 内存池复用
 */

import { Worker, isMainThread, parentPort } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================
// 类型定义
// ============================================================

export interface HighPerfV4Config {
  dimension: number;
  threads: number;
  useInt8: boolean;
  debug: boolean;
}

// ============================================================
// Worker 线程代码
// ============================================================

if (!isMainThread && parentPort) {
  // Worker 本地存储索引
  let localIndex: {
    data: Int8Array;
    scales: Float32Array;
    norms: Float32Array;
    count: number;
    dimension: number;
  } | null = null;

  parentPort.on('message', (task: {
    type: 'load_index' | 'batch_search';
    data?: Int8Array;
    scales?: Float32Array;
    norms?: Float32Array;
    count?: number;
    dimension?: number;
    queries?: Int8Array[];
    queryScales?: Float32Array;
    queryNorms?: Float32Array;
    topK?: number;
  }) => {
    if (task.type === 'load_index') {
      // 加载索引到本地
      localIndex = {
        data: task.data!,
        scales: task.scales!,
        norms: task.norms!,
        count: task.count!,
        dimension: task.dimension!,
      };
      parentPort!.postMessage({ type: 'loaded' });
      return;
    }

    if (task.type === 'batch_search' && localIndex) {
      const { queries, queryScales, queryNorms, topK, startIdx, endIdx } = task as any;
      const { data, scales, norms, dimension } = localIndex;
      const numQueries = queries!.length;
      const chunkSize = (endIdx as number) - (startIdx as number);
      const results: Array<Array<{ id: number; score: number }>> = [];

      // 批量处理所有查询
      for (let q = 0; q < numQueries; q++) {
        const queryData = queries![q];
        const queryScale = queryScales![q];
        const queryNorm = queryNorms![q];

        const scores: Array<{ id: number; score: number }> = [];

        for (let i = 0; i < chunkSize; i++) {
          const vecIdx = (startIdx as number) + i;
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

      parentPort!.postMessage({ type: 'results', results });
    }
  });
}

// ============================================================
// 高性能向量搜索引擎 v4
// ============================================================

export class HighPerfVectorEngineV4 {
  private config: Required<HighPerfV4Config>;
  private int8Index: {
    data: Int8Array;
    scales: Float32Array;
    norms: Float32Array;
    count: number;
    dimension: number;
  } | null = null;
  private workers: Worker[] = [];
  private workerReady: boolean[] = [];
  private initialized = false;

  constructor(config: Partial<HighPerfV4Config> = {}) {
    this.config = {
      dimension: config.dimension ?? 128,
      threads: config.threads ?? Math.min(os.cpus().length, 32),
      useInt8: config.useInt8 ?? true,
      debug: config.debug ?? false,
    };
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.log('初始化高性能向量搜索引擎 v4...');

    if (this.config.threads > 1) {
      // 创建 Worker
      const workerPath = __filename;
      for (let i = 0; i < this.config.threads; i++) {
        const worker = new Worker(workerPath);
        this.workers.push(worker);
        this.workerReady.push(false);
      }
      this.log(`Worker 初始化成功，线程数: ${this.workers.length}`);
    } else {
      this.log('使用单线程模式');
    }

    this.initialized = true;
  }

  /**
   * 构建索引
   */
  buildIndex(vectors: Float32Array[]): void {
    const count = vectors.length;
    const dim = this.config.dimension;

    this.log(`构建 INT8 索引，向量数: ${count}，维度: ${dim}`);

    const data = new Int8Array(count * dim);
    const scales = new Float32Array(count);
    const norms = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * dim;
      const v = vectors[i];

      let maxAbs = 0;
      for (let j = 0; j < dim; j++) {
        const abs = Math.abs(v[j]);
        if (abs > maxAbs) maxAbs = abs;
      }

      if (maxAbs === 0) maxAbs = 1;

      const scale = maxAbs / 127;
      scales[i] = scale;

      let normSq = 0;
      for (let j = 0; j < dim; j++) {
        const quantized = Math.round(v[j] / scale);
        const clamped = Math.max(-128, Math.min(127, quantized));
        data[offset + j] = clamped;
        normSq += clamped * clamped;
      }

      norms[i] = Math.sqrt(normSq) * scale;
    }

    this.int8Index = { data, scales, norms, count, dimension: dim };

    this.log('INT8 索引构建完成');
  }

  /**
   * 加载索引到 Worker
   */
  async loadIndexToWorkers(): Promise<void> {
    if (!this.int8Index || this.workers.length === 0) return;

    this.log('加载索引到 Worker...');

    const { data, scales, norms, count, dimension } = this.int8Index;

    const promises = this.workers.map((worker, idx) => {
      return new Promise<void>((resolve) => {
        worker.once('message', (msg) => {
          if (msg.type === 'loaded') {
            this.workerReady[idx] = true;
            resolve();
          }
        });

        worker.postMessage({
          type: 'load_index',
          data,
          scales,
          norms,
          count,
          dimension,
        });
      });
    });

    await Promise.all(promises);
    this.log('索引加载完成');
  }

  /**
   * 单查询搜索
   */
  async search(query: Float32Array, k: number): Promise<Array<{ id: number; score: number }>> {
    const results = await this.batchSearch([query], k);
    return results[0];
  }

  /**
   * 批量搜索
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
      const { data, scale, norm } = this.quantizeQuery(queries[q]);
      quantizedQueries.push(data);
      queryScales[q] = scale;
      queryNorms[q] = norm;
    }

    // 单线程模式
    if (this.workers.length === 0) {
      return this.singleBatchSearch(quantizedQueries, queryScales, queryNorms, k);
    }

    // 多线程模式（索引已预加载）
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

        let dot = 0;
        for (let j = 0; j < dimension; j++) {
          dot += queryData[j] * data[offset + j];
        }

        const realDot = dot * queryScale * scale;
        const score = realDot / (norm * queryNorm);

        scores.push({ id: i, score });
      }

      scores.sort((a, b) => b.score - a.score);
      results.push(scores.slice(0, k));
    }

    return results;
  }

  /**
   * 并行批量搜索（索引已预加载，向量分片）
   */
  private async parallelBatchSearch(
    queries: Int8Array[],
    queryScales: Float32Array,
    queryNorms: Float32Array,
    k: number
  ): Promise<Array<Array<{ id: number; score: number }>>> {
    if (!this.int8Index) throw new Error('索引未构建');

    const { count } = this.int8Index;
    const numWorkers = this.workers.length;
    const chunkSize = Math.ceil(count / numWorkers);

    // 将向量分片给不同 Worker
    const promises = this.workers.map((worker, idx) => {
      const startIdx = idx * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, count);

      if (startIdx >= count) {
        return Promise.resolve({ startIdx: -1, results: [] });
      }

      return new Promise<{ startIdx: number; results: Array<Array<{ id: number; score: number }>> }>(
        (resolve) => {
          worker.once('message', (msg) => {
            if (msg.type === 'results') {
              resolve({ startIdx, results: msg.results });
            }
          });

          worker.postMessage({
            type: 'batch_search',
            queries,
            queryScales,
            queryNorms,
            topK: k,
            startIdx,
            endIdx,
          });
        }
      );
    });

    const allResults = await Promise.all(promises);

    // 合并结果
    const numQueries = queries.length;
    const merged: Array<Array<{ id: number; score: number }>> = [];

    for (let q = 0; q < numQueries; q++) {
      const allScores: Array<{ id: number; score: number }> = [];
      for (const chunk of allResults) {
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
    this.workerReady = [];
    this.initialized = false;
  }

  /**
   * 日志
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[HighPerfV4] ${message}`);
    }
  }
}

// ============================================================
// 工厂函数
// ============================================================

let defaultEngine: HighPerfVectorEngineV4 | null = null;

export function getHighPerfVectorEngineV4(config?: Partial<HighPerfV4Config>): HighPerfVectorEngineV4 {
  if (!defaultEngine) {
    defaultEngine = new HighPerfVectorEngineV4(config);
  }
  return defaultEngine;
}

export async function initHighPerfVectorEngineV4(config?: Partial<HighPerfV4Config>): Promise<HighPerfVectorEngineV4> {
  const engine = getHighPerfVectorEngineV4(config);
  await engine.initialize();
  return engine;
}
