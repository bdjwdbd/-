/**
 * 高性能向量搜索引擎 v5 - INT4 量化
 */

import { Worker, isMainThread, parentPort } from 'worker_threads';
import * as os from 'os';

export interface HighPerfV5Config {
  dimension: number;
  threads: number;
  debug: boolean;
}

export interface Int4PackedIndex {
  data: Uint8Array;
  scales: Float32Array;
  norms: Float32Array;
  count: number;
  dimension: number;
}

class Int4Packer {
  static pack(vectors: Float32Array[]): Int4PackedIndex {
    const count = vectors.length;
    const dim = vectors[0].length;
    const packedDim = Math.ceil(dim / 2);

    const data = new Uint8Array(count * packedDim);
    const scales = new Float32Array(count);
    const norms = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const v = vectors[i];
      const offset = i * packedDim;

      let maxAbs = 0;
      for (let j = 0; j < dim; j++) {
        const abs = Math.abs(v[j]);
        if (abs > maxAbs) maxAbs = abs;
      }

      if (maxAbs === 0) maxAbs = 1;
      const scale = maxAbs / 7;
      scales[i] = scale;

      let normSq = 0;
      for (let j = 0; j < dim; j += 2) {
        const high = Math.max(-8, Math.min(7, Math.round(v[j] / scale)));
        const low = j + 1 < dim
          ? Math.max(-8, Math.min(7, Math.round(v[j + 1] / scale)))
          : 0;

        data[offset + Math.floor(j / 2)] = ((high + 8) << 4) | (low + 8);
        normSq += high * high + low * low;
      }

      norms[i] = Math.sqrt(normSq) * scale;
    }

    return { data, scales, norms, count, dimension: dim };
  }

  static packQuery(query: Float32Array): { data: Uint8Array; scale: number; norm: number } {
    const dim = query.length;
    const packedDim = Math.ceil(dim / 2);

    let maxAbs = 0;
    for (let i = 0; i < dim; i++) {
      const abs = Math.abs(query[i]);
      if (abs > maxAbs) maxAbs = abs;
    }

    if (maxAbs === 0) maxAbs = 1;
    const scale = maxAbs / 7;

    const data = new Uint8Array(packedDim);
    let normSq = 0;

    for (let i = 0; i < dim; i += 2) {
      const high = Math.max(-8, Math.min(7, Math.round(query[i] / scale)));
      const low = i + 1 < dim
        ? Math.max(-8, Math.min(7, Math.round(query[i + 1] / scale)))
        : 0;

      data[Math.floor(i / 2)] = ((high + 8) << 4) | (low + 8);
      normSq += high * high + low * low;
    }

    return { data, scale, norm: Math.sqrt(normSq) * scale };
  }

  static dotProduct(
    a: Uint8Array,
    b: Uint8Array,
    aScale: number,
    bScale: number,
    length: number
  ): number {
    let sum = 0;
    const packedLen = Math.ceil(length / 2);

    for (let i = 0; i < packedLen; i++) {
      const byteA = a[i];
      const byteB = b[i];

      const aHigh = (byteA >> 4) - 8;
      const bHigh = (byteB >> 4) - 8;
      sum += aHigh * bHigh;

      const aLow = (byteA & 0x0F) - 8;
      const bLow = (byteB & 0x0F) - 8;
      sum += aLow * bLow;
    }

    return sum * aScale * bScale;
  }
}

if (!isMainThread && parentPort) {
  let localIndex: Int4PackedIndex | null = null;

  parentPort.on('message', (task: any) => {
    if (task.type === 'load_index') {
      localIndex = {
        data: task.data,
        scales: task.scales,
        norms: task.norms,
        count: task.count,
        dimension: task.dimension,
      };
      parentPort!.postMessage({ type: 'loaded' });
      return;
    }

    if (task.type === 'batch_search' && localIndex) {
      const { queries, queryScales, queryNorms, topK, startIdx, endIdx } = task;
      const { data, scales, norms, dimension } = localIndex;
      const packedDim = Math.ceil(dimension / 2);
      const chunkSize = endIdx - startIdx;
      const numQueries = queries.length;
      const results: Array<Array<{ id: number; score: number }>> = [];

      for (let q = 0; q < numQueries; q++) {
        const queryData = queries[q];
        const queryScale = queryScales[q];
        const queryNorm = queryNorms[q];

        const scores: Array<{ id: number; score: number }> = [];

        for (let i = 0; i < chunkSize; i++) {
          const vecIdx = startIdx + i;
          const offset = vecIdx * packedDim;
          const scale = scales[vecIdx];
          const norm = norms[vecIdx];

          if (norm === 0 || queryNorm === 0) {
            scores.push({ id: vecIdx, score: 0 });
            continue;
          }

          const dot = Int4Packer.dotProduct(
            queryData,
            data.slice(offset, offset + packedDim),
            queryScale,
            scale,
            dimension
          );

          const score = dot / (norm * queryNorm);
          scores.push({ id: vecIdx, score });
        }

        scores.sort((a, b) => b.score - a.score);
        results.push(scores.slice(0, topK));
      }

      parentPort!.postMessage({ type: 'results', results });
    }
  });
}

export class HighPerfVectorEngineV5 {
  private config: Required<HighPerfV5Config>;
  private int4Index: Int4PackedIndex | null = null;
  private workers: Worker[] = [];
  private initialized = false;

  constructor(config: Partial<HighPerfV5Config> = {}) {
    this.config = {
      dimension: config.dimension ?? 128,
      threads: config.threads ?? Math.min(os.cpus().length, 32),
      debug: config.debug ?? false,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.threads > 1) {
      const workerPath = __filename;
      for (let i = 0; i < this.config.threads; i++) {
        this.workers.push(new Worker(workerPath));
      }
    }

    this.initialized = true;
  }

  buildIndex(vectors: Float32Array[]): void {
    this.int4Index = Int4Packer.pack(vectors);
  }

  async loadIndexToWorkers(): Promise<void> {
    if (!this.int4Index || this.workers.length === 0) return;

    const { data, scales, norms, count, dimension } = this.int4Index;

    const promises = this.workers.map((worker) => {
      return new Promise<void>((resolve) => {
        worker.once('message', () => resolve());
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
  }

  async search(query: Float32Array, k: number): Promise<Array<{ id: number; score: number }>> {
    const results = await this.batchSearch([query], k);
    return results[0];
  }

  async batchSearch(
    queries: Float32Array[],
    k: number
  ): Promise<Array<Array<{ id: number; score: number }>>> {
    if (!this.int4Index) {
      throw new Error('Please build index first');
    }

    const quantizedQueries: Uint8Array[] = [];
    const queryScales = new Float32Array(queries.length);
    const queryNorms = new Float32Array(queries.length);

    for (let q = 0; q < queries.length; q++) {
      const { data, scale, norm } = Int4Packer.packQuery(queries[q]);
      quantizedQueries.push(data);
      queryScales[q] = scale;
      queryNorms[q] = norm;
    }

    if (this.workers.length === 0) {
      return this.singleBatchSearch(quantizedQueries, queryScales, queryNorms, k);
    }

    return this.parallelBatchSearch(quantizedQueries, queryScales, queryNorms, k);
  }

  private singleBatchSearch(
    queries: Uint8Array[],
    queryScales: Float32Array,
    queryNorms: Float32Array,
    k: number
  ): Array<Array<{ id: number; score: number }>> {
    if (!this.int4Index) throw new Error('Index not built');

    const { data, scales, norms, count, dimension } = this.int4Index;
    const packedDim = Math.ceil(dimension / 2);
    const numQueries = queries.length;
    const results: Array<Array<{ id: number; score: number }>> = [];

    for (let q = 0; q < numQueries; q++) {
      const queryData = queries[q];
      const queryScale = queryScales[q];
      const queryNorm = queryNorms[q];

      const scores: Array<{ id: number; score: number }> = [];

      for (let i = 0; i < count; i++) {
        const offset = i * packedDim;
        const scale = scales[i];
        const norm = norms[i];

        if (norm === 0 || queryNorm === 0) {
          scores.push({ id: i, score: 0 });
          continue;
        }

        const dot = Int4Packer.dotProduct(
          queryData,
          data.slice(offset, offset + packedDim),
          queryScale,
          scale,
          dimension
        );

        const score = dot / (norm * queryNorm);
        scores.push({ id: i, score });
      }

      scores.sort((a, b) => b.score - a.score);
      results.push(scores.slice(0, k));
    }

    return results;
  }

  private async parallelBatchSearch(
    queries: Uint8Array[],
    queryScales: Float32Array,
    queryNorms: Float32Array,
    k: number
  ): Promise<Array<Array<{ id: number; score: number }>>> {
    if (!this.int4Index) throw new Error('Index not built');

    const { count } = this.int4Index;
    const numWorkers = this.workers.length;
    const chunkSize = Math.ceil(count / numWorkers);

    const promises = this.workers.map((worker, idx) => {
      const startIdx = idx * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, count);

      if (startIdx >= count) {
        return Promise.resolve({ startIdx: -1, results: [] });
      }

      return new Promise<{ startIdx: number; results: any }>((resolve) => {
        worker.once('message', (msg) => {
          resolve({ startIdx, results: msg.results });
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
      });
    });

    const allResults = await Promise.all(promises);

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

  async shutdown(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
    this.initialized = false;
  }
}

export function getHighPerfVectorEngineV5(config?: Partial<HighPerfV5Config>): HighPerfVectorEngineV5 {
  return new HighPerfVectorEngineV5(config);
}

export async function initHighPerfVectorEngineV5(config?: Partial<HighPerfV5Config>): Promise<HighPerfVectorEngineV5> {
  const engine = getHighPerfVectorEngineV5(config);
  await engine.initialize();
  return engine;
}
