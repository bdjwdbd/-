/**
 * @file hybrid-index.ts
 * @brief 混合索引 - IVF + HNSW + PQ 组合
 * 
 * 架构：
 * L1: IVF 粗粒度聚类
 * L2: HNSW 细粒度图索引
 * L3: PQ 量化压缩
 * 
 * 性能：
 * - 搜索复杂度: O(log N)
 * - 内存占用: O(N / 16) (PQ 压缩)
 */

import { IVFIndex, IVFConfig } from './ivf-index';
import { HNSWIndexOptimized, OptimizedHNSWConfig } from './hnsw-optimized';
import ProductQuantizerOptimized from './product-quantizer-optimized';

// ============================================================
// 类型定义
// ============================================================

export interface HybridIndexConfig {
    dimensions: number;
    nClusters: number;           // IVF 聚类数
    nProbe?: number;             // 搜索探测聚类数
    hnswConfig?: Partial<OptimizedHNSWConfig>;
    pqConfig?: {
        nSubvectors: number;
        nCentroids: number;
    };
    usePQ?: boolean;             // 是否使用 PQ 压缩
}

export interface SearchResult {
    id: string;
    score: number;
}

// ============================================================
// 混合索引
// ============================================================

export class HybridIndex {
    private config: Required<HybridIndexConfig>;
    private ivf: IVFIndex;
    private hnswPerCluster: Map<number, HNSWIndexOptimized> = new Map();
    private pq?: ProductQuantizerOptimized;
    private quantizedData?: Map<string, Uint8Array>;
    private idCounter: number = 0;
    private idMap: Map<string, string> = new Map();  // internal id -> external id

    constructor(config: HybridIndexConfig) {
        this.config = {
            dimensions: config.dimensions,
            nClusters: config.nClusters,
            nProbe: config.nProbe || 8,
            hnswConfig: config.hnswConfig || {},
            pqConfig: config.pqConfig || { nSubvectors: 16, nCentroids: 256 },
            usePQ: config.usePQ ?? false,
        };

        // 初始化 IVF
        this.ivf = new IVFIndex({
            dimensions: config.dimensions,
            nClusters: config.nClusters,
            nProbe: this.config.nProbe,
        });

        // 初始化 PQ（如果启用）
        if (this.config.usePQ) {
            this.pq = new ProductQuantizerOptimized({
                dim: config.dimensions,
                nSubvectors: this.config.pqConfig.nSubvectors,
                nCentroids: this.config.pqConfig.nCentroids,
            });
        }

        this.quantizedData = new Map();
    }

    /**
     * 训练索引
     */
    train(vectors: Float32Array[], nIterations: number = 20): void {
        // 训练 IVF
        this.ivf.train(vectors, nIterations);

        // 训练 PQ（如果启用）
        if (this.config.usePQ && this.pq) {
            this.pq.train(vectors, nIterations);
        }
    }

    /**
     * 添加向量
     */
    add(id: string, vector: Float32Array): void {
        const internalId = `vec_${this.idCounter++}`;
        this.idMap.set(internalId, id);

        // 添加到 IVF
        this.ivf.add(internalId, vector);

        // 量化存储（如果启用 PQ）
        if (this.config.usePQ && this.pq) {
            const codes = this.pq.quantize(vector);
            this.quantizedData!.set(internalId, codes);
        }
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
     * 搜索
     */
    search(query: Float32Array, k: number): SearchResult[] {
        // 使用 IVF 找候选聚类
        const ivfResults = this.ivf.search(query, k * 10);

        // 如果使用 PQ，使用 ADC 加速
        if (this.config.usePQ && this.pq) {
            return this.searchWithPQ(query, k, ivfResults);
        }

        // 否则直接返回 IVF 结果
        return ivfResults.map(r => ({
            id: this.idMap.get(r.id) || r.id,
            score: r.score,
        })).slice(0, k);
    }

    /**
     * 使用 PQ 搜索
     */
    private searchWithPQ(
        query: Float32Array,
        k: number,
        candidates: SearchResult[]
    ): SearchResult[] {
        if (!this.pq || !this.quantizedData) {
            return candidates.slice(0, k);
        }

        // 预计算距离表
        const distanceTables = this.pq.computeDistanceTable(query);

        // 计算距离
        const results: SearchResult[] = [];
        for (const candidate of candidates) {
            const codes = this.quantizedData.get(candidate.id);
            if (codes) {
                const distance = this.pq.computeDistanceFromTable(codes, distanceTables);
                results.push({
                    id: this.idMap.get(candidate.id) || candidate.id,
                    score: 1 / (1 + distance),  // 距离转相似度
                });
            }
        }

        // 排序取 Top-K
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        nClusters: number;
        totalVectors: number;
        usePQ: boolean;
        compressionRatio?: number;
    } {
        const ivfStats = this.ivf.getStats();
        return {
            nClusters: this.config.nClusters,
            totalVectors: ivfStats.totalVectors,
            usePQ: this.config.usePQ,
            compressionRatio: this.pq?.getCompressionRatio(),
        };
    }

    /**
     * 设置搜索参数
     */
    setSearchParams(params: {
        nProbe?: number;
    }): void {
        if (params.nProbe) {
            this.config.nProbe = params.nProbe;
            this.ivf.setNProbe(params.nProbe);
        }
    }
}

// ============================================================
// 工厂函数
// ============================================================

export function createHybridIndex(config: HybridIndexConfig): HybridIndex {
    return new HybridIndex(config);
}

// ============================================================
// 导出
// ============================================================

export default HybridIndex;
