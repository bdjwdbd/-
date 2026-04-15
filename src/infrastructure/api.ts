/**
 * @file api.ts
 * @brief 元灵系统统一 API 接口
 * 
 * 提供简洁的 API 封装，隐藏底层复杂性
 */

import { IVFIndex } from './ivf-index';
import { HybridIndex } from './hybrid-index';
import { MatryoshkaEmbedding, PRESETS } from './matryoshka';
import { EmbeddingClient, QWEN3_EMBEDDING_CONFIG } from './embedding-config';

// ============================================================
// 原生模块条件导入
// ============================================================

let simd: unknown = null;
let parallel: unknown = null;
let int8: unknown = null;

try {
    simd = require('../../native/build/Release/yuanling_native.node');
} catch (e) {
    // 原生模块不可用
}

try {
    parallel = require('../../native/build/Release/parallel.node');
} catch (e) {
    // 原生模块不可用
}

try {
    int8 = require('../../native/build/Release/int8.node');
} catch (e) {
    // 原生模块不可用
}

// ============================================================
// 类型定义
// ============================================================

export interface YuanLingConfig {
    dimensions?: number;
    useParallel?: boolean;
    threadCount?: number;
    useQuantization?: boolean;
    indexType?: 'brute' | 'ivf' | 'hybrid';
}

export interface SearchResult {
    id: string;
    score: number;
}

export interface EmbeddingResult {
    vector: Float32Array;
    dimensions: number;
    truncated?: boolean;
}

// ============================================================
// 元灵系统 API
// ============================================================

export class YuanLingAPI {
    private config: Required<YuanLingConfig>;
    private embeddingClient: EmbeddingClient;
    private matryoshka: MatryoshkaEmbedding;
    private index: IVFIndex | HybridIndex | null = null;
    private vectors: Map<string, Float32Array> = new Map();

    constructor(config: YuanLingConfig = {}) {
        this.config = {
            dimensions: config.dimensions || 1024,
            useParallel: config.useParallel ?? true,
            threadCount: config.threadCount || 4,
            useQuantization: config.useQuantization ?? false,
            indexType: config.indexType || 'ivf',
        };

        // 初始化组件
        this.embeddingClient = new EmbeddingClient(QWEN3_EMBEDDING_CONFIG);
        this.matryoshka = new MatryoshkaEmbedding(PRESETS.qwen3);

        // 设置线程数
        if (this.config.useParallel) {
            parallel.setThreadCount(this.config.threadCount);
        }
    }

    // ============================================================
    // 向量嵌入
    // ============================================================

    /**
     * 将文本转换为向量
     */
    async embed(text: string, dimensions?: number): Promise<EmbeddingResult> {
        const dim = dimensions || this.config.dimensions;
        const fullEmbedding = await this.embeddingClient.embed(text, 4096);
        
        if (dim < 4096) {
            const truncated = this.matryoshka.truncate(fullEmbedding, dim);
            return {
                vector: truncated.vector,
                dimensions: dim,
                truncated: true,
            };
        }

        return {
            vector: fullEmbedding,
            dimensions: 4096,
            truncated: false,
        };
    }

    /**
     * 批量嵌入
     */
    async embedBatch(texts: string[], dimensions?: number): Promise<EmbeddingResult[]> {
        const results: EmbeddingResult[] = [];
        for (const text of texts) {
            const result = await this.embed(text, dimensions);
            results.push(result);
        }
        return results;
    }

    // ============================================================
    // 向量存储
    // ============================================================

    /**
     * 添加向量到索引
     */
    add(id: string, vector: Float32Array): void {
        this.vectors.set(id, vector);
    }

    /**
     * 批量添加
     */
    addBatch(items: Array<{ id: string; vector: Float32Array }>): void {
        for (const item of items) {
            this.add(item.id, item.vector);
        }
    }

    /**
     * 构建索引
     */
    buildIndex(): void {
        const vectors = Array.from(this.vectors.values());
        
        if (this.config.indexType === 'ivf') {
            this.index = new IVFIndex({
                dimensions: this.config.dimensions,
                nClusters: Math.min(100, Math.floor(Math.sqrt(vectors.length))),
            });
            this.index.train(vectors, 10);
            
            for (const [id, vector] of this.vectors) {
                this.index.add(id, vector);
            }
        }
    }

    // ============================================================
    // 向量搜索
    // ============================================================

    /**
     * 搜索相似向量
     */
    search(query: Float32Array, k: number): SearchResult[] {
        // 如果有索引，使用索引搜索
        if (this.index) {
            return this.index.search(query, k);
        }

        // 否则使用暴力搜索
        return this.bruteForceSearch(query, k);
    }

    /**
     * 通过文本搜索
     */
    async searchText(text: string, k: number): Promise<SearchResult[]> {
        const { vector } = await this.embed(text);
        return this.search(vector, k);
    }

    /**
     * 暴力搜索
     */
    private bruteForceSearch(query: Float32Array, k: number): SearchResult[] {
        const results: SearchResult[] = [];
        
        for (const [id, vector] of this.vectors) {
            const score = this.cosineSimilarity(query, vector);
            results.push({ id, score });
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }

    // ============================================================
    // 相似度计算
    // ============================================================

    /**
     * 计算余弦相似度
     */
    cosineSimilarity(a: Float32Array, b: Float32Array): number {
        // TypeScript 实现
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    }

    /**
     * 批量相似度计算
     */
    cosineSimilarityBatch(query: Float32Array, vectors: Float32Array[], dim?: number): Float32Array {
        const d = dim || query.length;
        const allVectors = new Float32Array(vectors.length * d);
        
        for (let i = 0; i < vectors.length; i++) {
            allVectors.set(vectors[i], i * d);
        }

        return simd.cosineSimilarityBatch(query, allVectors, d);
    }

    // ============================================================
    // Top-K 搜索
    // ============================================================

    /**
     * Top-K 搜索（原生加速）
     */
    topK(query: Float32Array, vectors: Float32Array[], k: number): SearchResult[] {
        const dim = query.length;
        const allVectors = new Float32Array(vectors.length * dim);
        
        for (let i = 0; i < vectors.length; i++) {
            allVectors.set(vectors[i], i * dim);
        }

        const results = this.config.useParallel
            ? parallel.topKSearchParallel(query, allVectors, dim, k)
            : simd.topKSearchWithDim(query, allVectors, dim, k);

        return results.indices.map((idx: number, i: number) => ({
            id: String(idx),
            score: results.scores[i],
        }));
    }

    // ============================================================
    // 量化
    // ============================================================

    /**
     * 量化向量
     */
    quantize(vector: Float32Array): { data: Int8Array; scale: number } {
        const result = int8.quantizeFloat32ToInt8(vector);
        return {
            data: result.data,
            scale: result.scale,
        };
    }

    // ============================================================
    // 统计信息
    // ============================================================

    /**
     * 获取系统信息
     */
    getInfo(): {
        simdCapabilities: any;
        threadCount: number;
        vectorCount: number;
        indexType: string;
        dimensions: number;
    } {
        return {
            simdCapabilities: simd.getCapabilities(),
            threadCount: parallel.getThreadCount(),
            vectorCount: this.vectors.size,
            indexType: this.config.indexType,
            dimensions: this.config.dimensions,
        };
    }

    /**
     * 获取性能统计
     */
    getStats(): {
        totalVectors: number;
        memoryUsage: number;
    } {
        let memoryUsage = 0;
        for (const vector of this.vectors.values()) {
            memoryUsage += vector.byteLength;
        }

        return {
            totalVectors: this.vectors.size,
            memoryUsage,
        };
    }
}

// ============================================================
// 工厂函数
// ============================================================

export function createYuanLing(config?: YuanLingConfig): YuanLingAPI {
    return new YuanLingAPI(config);
}

// ============================================================
// 默认实例
// ============================================================

let defaultInstance: YuanLingAPI | null = null;

export function getYuanLing(): YuanLingAPI {
    if (!defaultInstance) {
        defaultInstance = new YuanLingAPI();
    }
    return defaultInstance;
}

// ============================================================
// 导出
// ============================================================

export default YuanLingAPI;
