/**
 * @file parallel-search.ts
 * @brief 多线程并行搜索
 * 
 * 使用 Worker Threads 实现多核并行计算
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';

export interface ParallelSearchOptions {
    numWorkers?: number;
    batchSize?: number;
}

export interface SearchResult {
    index: number;
    score: number;
}

/**
 * Worker 线程代码
 */
if (!isMainThread && parentPort) {
    const { query, vectors, startIdx } = workerData as {
        query: Float32Array;
        vectors: Float32Array[];
        startIdx: number;
    };
    
    // 动态加载原生模块
    const native = require(path.join(__dirname, '../../native/build/Release/yuanling_native.node'));
    
    const results: SearchResult[] = [];
    for (let i = 0; i < vectors.length; i++) {
        const score = native.cosineSimilarity(query, vectors[i]);
        results.push({ index: startIdx + i, score });
    }
    
    parentPort.postMessage(results);
}

/**
 * 并行搜索类
 */
export class ParallelSearch {
    private numWorkers: number;
    private native: any;
    
    constructor(options: ParallelSearchOptions = {}) {
        this.numWorkers = options.numWorkers || 4;
        
        try {
            this.native = require(path.join(__dirname, '../../native/build/Release/yuanling_native.node'));
        } catch (e) {
            console.warn('Native module not available, using TypeScript fallback');
            this.native = null;
        }
    }
    
    /**
     * 并行搜索
     */
    async search(
        query: Float32Array,
        vectors: Float32Array[],
        topK: number = 10
    ): Promise<SearchResult[]> {
        // 小批量直接计算
        if (vectors.length < 1000 || this.numWorkers === 1) {
            return this.sequentialSearch(query, vectors, topK);
        }
        
        // 分块
        const chunkSize = Math.ceil(vectors.length / this.numWorkers);
        const chunks: { vectors: Float32Array[]; startIdx: number }[] = [];
        
        for (let i = 0; i < this.numWorkers; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, vectors.length);
            if (start < vectors.length) {
                chunks.push({
                    vectors: vectors.slice(start, end),
                    startIdx: start
                });
            }
        }
        
        // 并行计算
        const workerPath = __filename;
        const promises = chunks.map(chunk => 
            this.runWorker(workerPath, { query, vectors: chunk.vectors, startIdx: chunk.startIdx })
        );
        
        const results = await Promise.all(promises);
        const allResults = results.flat();
        
        // 排序取 TopK
        allResults.sort((a, b) => b.score - a.score);
        return allResults.slice(0, topK);
    }
    
    /**
     * 顺序搜索（单线程）
     */
    private sequentialSearch(
        query: Float32Array,
        vectors: Float32Array[],
        topK: number
    ): SearchResult[] {
        const results: SearchResult[] = [];
        
        if (this.native) {
            for (let i = 0; i < vectors.length; i++) {
                const score = this.native.cosineSimilarity(query, vectors[i]);
                results.push({ index: i, score });
            }
        } else {
            // TypeScript 回退
            for (let i = 0; i < vectors.length; i++) {
                const score = this.cosineSimilarityTS(query, vectors[i]);
                results.push({ index: i, score });
            }
        }
        
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }
    
    /**
     * 运行 Worker
     */
    private runWorker(workerPath: string, data: any): Promise<SearchResult[]> {
        return new Promise((resolve, reject) => {
            const worker = new Worker(workerPath, { workerData: data });
            
            worker.on('message', (results: SearchResult[]) => {
                resolve(results);
                worker.terminate();
            });
            
            worker.on('error', (err) => {
                reject(err);
                worker.terminate();
            });
            
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
            });
        });
    }
    
    /**
     * TypeScript 余弦相似度（回退）
     */
    private cosineSimilarityTS(a: Float32Array, b: Float32Array): float {
        let sum = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            sum += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return sum / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    }
}

/**
 * 批量并行搜索（连续内存版本）
 */
export async function parallelSearchContiguous(
    query: Float32Array,
    allVectors: Float32Array,
    dim: number,
    topK: number = 10,
    numWorkers: number = 4
): Promise<SearchResult[]> {
    const numVectors = allVectors.length / dim;
    
    // 小批量直接计算
    if (numVectors < 1000) {
        const native = require(path.join(__dirname, '../../native/build/Release/yuanling_native.node'));
        const scores = native.cosineSimilarityBatchContiguous(query, allVectors, dim);
        
        const results: SearchResult[] = [];
        for (let i = 0; i < numVectors; i++) {
            results.push({ index: i, score: scores[i] });
        }
        
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }
    
    // 分块并行
    const chunkSize = Math.ceil(numVectors / numWorkers);
    const promises: Promise<SearchResult[]>[] = [];
    
    for (let i = 0; i < numWorkers; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, numVectors);
        
        if (start < numVectors) {
            const chunkVectors = allVectors.slice(start * dim, end * dim);
            promises.push(
                computeChunk(query, chunkVectors, dim, start)
            );
        }
    }
    
    const results = await Promise.all(promises);
    const allResults = results.flat();
    
    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, topK);
}

/**
 * 计算一个块
 */
async function computeChunk(
    query: Float32Array,
    chunkVectors: Float32Array,
    dim: number,
    startIdx: number
): Promise<SearchResult[]> {
    const native = require(path.join(__dirname, '../../native/build/Release/yuanling_native.node'));
    const scores = native.cosineSimilarityBatchContiguous(query, chunkVectors, dim);
    
    const results: SearchResult[] = [];
    for (let i = 0; i < scores.length; i++) {
        results.push({ index: startIdx + i, score: scores[i] });
    }
    
    return results;
}

// 导出
export default ParallelSearch;
