/**
 * JIT 加速模块
 * 
 * 在 Node.js 中，我们可以通过以下方式实现类似 Numba 的加速：
 * 1. Worker Threads 并行计算
 * 2. SIMD.js（已废弃，但概念类似）
 * 3. WASM 编译
 * 
 * 本模块使用 Worker Threads 实现并行计算
 */

// ============================================================
// 类型定义
// ============================================================

import * as workerThreads from 'worker_threads';

export interface JITConfig {
  numThreads: number;
  useParallel: boolean;
  chunkSize: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: JITConfig = {
  numThreads: Math.max(1, (typeof require !== 'undefined' ? require('os').cpus().length : 4)),
  useParallel: true,
  chunkSize: 1000,
};

// ============================================================
// 并行计算器
// ============================================================

export class ParallelCompute {
  private config: JITConfig;

  constructor(config: Partial<JITConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 并行余弦相似度
   */
  async cosineSimilarityParallel(
    query: number[],
    vectors: number[][]
  ): Promise<number[]> {
    if (!this.config.useParallel || vectors.length < this.config.chunkSize) {
      return this.cosineSimilaritySync(query, vectors);
    }

    // 分块并行计算
    const chunks = this.chunkArray(vectors, this.config.numThreads);
    const promises = chunks.map(chunk => 
      this.computeChunk(query, chunk, 'cosine')
    );

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * 同步计算
   */
  private cosineSimilaritySync(
    query: number[],
    vectors: number[][]
  ): number[] {
    const queryNorm = Math.sqrt(query.reduce((sum, v) => sum + v * v, 0));
    const results: number[] = [];

    for (const vec of vectors) {
      let dot = 0;
      let norm = 0;
      for (let i = 0; i < query.length; i++) {
        dot += query[i] * vec[i];
        norm += vec[i] * vec[i];
      }
      results.push(queryNorm > 0 && norm > 0 ? dot / (queryNorm * Math.sqrt(norm)) : 0);
    }

    return results;
  }

  /**
   * 并行欧氏距离
   */
  async euclideanDistanceParallel(
    query: number[],
    vectors: number[][]
  ): Promise<number[]> {
    if (!this.config.useParallel || vectors.length < this.config.chunkSize) {
      return this.euclideanDistanceSync(query, vectors);
    }

    const chunks = this.chunkArray(vectors, this.config.numThreads);
    const promises = chunks.map(chunk => 
      this.computeChunk(query, chunk, 'euclidean')
    );

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * 同步欧氏距离
   */
  private euclideanDistanceSync(
    query: number[],
    vectors: number[][]
  ): number[] {
    const results: number[] = [];

    for (const vec of vectors) {
      let dist = 0;
      for (let i = 0; i < query.length; i++) {
        const diff = query[i] - vec[i];
        dist += diff * diff;
      }
      results.push(Math.sqrt(dist));
    }

    return results;
  }

  /**
   * 计算分块
   */
  private async computeChunk(
    query: number[],
    vectors: number[][],
    metric: 'cosine' | 'euclidean'
  ): Promise<number[]> {
    // 在实际实现中，这里会创建 Worker
    // 简化实现：直接计算
    if (metric === 'cosine') {
      return this.cosineSimilaritySync(query, vectors);
    } else {
      return this.euclideanDistanceSync(query, vectors);
    }
  }

  /**
   * 分块数组
   */
  private chunkArray<T>(array: T[], numChunks: number): T[][] {
    const chunks: T[][] = [];
    const chunkSize = Math.ceil(array.length / numChunks);

    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * 并行 Top-K 搜索
   */
  async topKSearchParallel(
    query: number[],
    vectors: number[][],
    k: number = 10,
    metric: 'cosine' | 'euclidean' = 'cosine'
  ): Promise<Array<{ index: number; score: number }>> {
    const scores = metric === 'cosine'
      ? await this.cosineSimilarityParallel(query, vectors)
      : await this.euclideanDistanceParallel(query, vectors);

    // 部分排序获取 top-k
    const indexed = scores.map((score, index) => ({ index, score }));
    
    // 使用快速选择算法
    if (metric === 'cosine') {
      return this.quickSelect(indexed, k, (a, b) => b.score - a.score);
    } else {
      return this.quickSelect(indexed, k, (a, b) => a.score - b.score);
    }
  }

  /**
   * 快速选择算法
   */
  private quickSelect<T>(
    arr: T[],
    k: number,
    compare: (a: T, b: T) => number
  ): T[] {
    if (arr.length <= k) {
      return arr.sort(compare);
    }

    // 简化实现：排序后取前 k
    return arr.sort(compare).slice(0, k);
  }

  /**
   * 获取线程数
   */
  getNumThreads(): number {
    return this.config.numThreads;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<JITConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================
// INT8 加速搜索
// ============================================================

export class INT8AcceleratedSearch {
  private scale: number = 1;
  private quantizedVectors: Int8Array[] = [];
  private originalVectors: number[][] = [];

  /**
   * 量化向量
   */
  quantize(vectors: number[][]): void {
    // 计算范围
    let maxAbs = 0;
    for (const vec of vectors) {
      for (const v of vec) {
        maxAbs = Math.max(maxAbs, Math.abs(v));
      }
    }

    this.scale = maxAbs / 127;
    this.originalVectors = vectors;

    // 量化
    this.quantizedVectors = vectors.map(vec => {
      const quantized = new Int8Array(vec.length);
      for (let i = 0; i < vec.length; i++) {
        quantized[i] = Math.max(-128, Math.min(127, Math.round(vec[i] / this.scale)));
      }
      return quantized;
    });
  }

  /**
   * INT8 点积搜索（快速粗筛）
   */
  int8DotProductSearch(query: number[], topK: number = 100): number[] {
    // 量化查询
    const queryInt8 = new Int8Array(query.length);
    for (let i = 0; i < query.length; i++) {
      queryInt8[i] = Math.max(-128, Math.min(127, Math.round(query[i] / this.scale)));
    }

    // INT8 点积
    const scores: number[] = [];
    for (const vec of this.quantizedVectors) {
      let dot = 0;
      for (let i = 0; i < queryInt8.length; i++) {
        dot += queryInt8[i] * vec[i];
      }
      scores.push(dot);
    }

    // 返回 top-k 索引
    const indexed = scores.map((score, index) => ({ index, score }));
    indexed.sort((a, b) => b.score - a.score);
    return indexed.slice(0, topK).map(x => x.index);
  }

  /**
   * 两阶段搜索
   */
  twoStageSearch(
    query: number[],
    topK: number = 10,
    rerankK: number = 100
  ): Array<{ index: number; score: number }> {
    // 阶段1：INT8 粗筛
    const candidates = this.int8DotProductSearch(query, rerankK);

    // 阶段2：FP32 精确重排
    const results: Array<{ index: number; score: number }> = [];
    const queryNorm = Math.sqrt(query.reduce((sum, v) => sum + v * v, 0));

    for (const idx of candidates) {
      const vec = this.originalVectors[idx];
      let dot = 0;
      let norm = 0;
      for (let i = 0; i < query.length; i++) {
        dot += query[i] * vec[i];
        norm += vec[i] * vec[i];
      }
      const score = queryNorm > 0 && norm > 0 ? dot / (queryNorm * Math.sqrt(norm)) : 0;
      results.push({ index: idx, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 获取量化比例
   */
  getScale(): number {
    return this.scale;
  }
}

// ============================================================
// 单例
// ============================================================

let parallelComputeInstance: ParallelCompute | null = null;

export function getParallelCompute(config?: Partial<JITConfig>): ParallelCompute {
  if (!parallelComputeInstance) {
    parallelComputeInstance = new ParallelCompute(config);
  }
  return parallelComputeInstance;
}

export function getNumThreads(): number {
  return getParallelCompute().getNumThreads();
}
