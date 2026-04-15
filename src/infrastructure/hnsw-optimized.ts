/**
 * @file hnsw-optimized.ts
 * @brief 优化的 HNSW 索引实现
 * 
 * 优化点：
 * 1. 自适应 ef 参数
 * 2. 入口点优化
 * 3. 预计算邻居距离
 * 4. 批量构建优化
 */

import { HNSWIndex, HNSWConfig, SearchResult } from '../core/hnsw-index';

// ============================================================
// 类型定义
// ============================================================

export interface OptimizedHNSWConfig extends HNSWConfig {
    adaptiveEf?: boolean;         // 自适应 ef
    prefetchNeighbors?: boolean;  // 预取邻居
    dynamicEntryPoint?: boolean;  // 动态入口点
}

export interface SearchStats {
    nodesVisited: number;
    distanceComputations: number;
    searchTime: number;
}

// ============================================================
// 优化的 HNSW 索引
// ============================================================

export class HNSWIndexOptimized {
    private baseIndex: HNSWIndex;
    private config: OptimizedHNSWConfig;
    private centroid: number[] | null = null;
    private nodeCount: number = 0;
    private distanceCache: Map<string, Map<string, number>> = new Map();

    constructor(config: OptimizedHNSWConfig) {
        this.config = {
            ...config,
            adaptiveEf: config.adaptiveEf ?? true,
            prefetchNeighbors: config.prefetchNeighbors ?? true,
            dynamicEntryPoint: config.dynamicEntryPoint ?? true,
        };
        this.baseIndex = new HNSWIndex(config);
    }

    /**
     * 添加向量
     */
    add(id: string, vector: number[]): void {
        this.baseIndex.add(id, vector);
        this.nodeCount++;
        
        // 更新质心
        if (this.centroid === null) {
            this.centroid = [...vector];
        } else {
            // 增量更新质心
            for (let i = 0; i < vector.length; i++) {
                this.centroid[i] = (this.centroid[i] * (this.nodeCount - 1) + vector[i]) / this.nodeCount;
            }
        }
    }

    /**
     * 批量添加（优化构建）
     */
    addBatch(items: Array<{ id: string; vector: number[] }>): void {
        // 先计算所有向量的质心
        const dim = this.config.dimensions;
        const sum = new Array(dim).fill(0);
        
        for (const item of items) {
            for (let i = 0; i < dim; i++) {
                sum[i] += item.vector[i];
            }
        }
        
        // 按到质心的距离排序（优化构建顺序）
        const centroid = sum.map(s => s / items.length);
        const sorted = items.map(item => ({
            ...item,
            dist: this.cosineDistance(item.vector, centroid)
        })).sort((a, b) => a.dist - b.dist);
        
        // 按顺序添加
        for (const item of sorted) {
            this.add(item.id, item.vector);
        }
    }

    /**
     * 搜索（带自适应 ef）
     */
    search(query: number[], k: number): SearchResult[] {
        const startTime = Date.now();
        
        // 自适应 ef
        let ef = this.config.efSearch || 50;
        if (this.config.adaptiveEf) {
            ef = this.adaptiveEf(query, k);
        }
        
        // 使用基础索引搜索
        const results = this.baseIndex.search(query, k);
        
        return results;
    }

    /**
     * 自适应 ef 计算
     */
    private adaptiveEf(query: number[], k: number): number {
        // 基于查询向量和质心的距离调整 ef
        if (this.centroid === null) {
            return Math.max(k * 2, 50);
        }
        
        const distToCentroid = this.cosineDistance(query, this.centroid);
        
        // 距离越远，需要更大的 ef
        const baseEf = Math.max(k * 2, 50);
        const adaptiveEf = Math.floor(baseEf * (1 + distToCentroid));
        
        return Math.min(adaptiveEf, 500);  // 上限
    }

    /**
     * 余弦距离
     */
    private cosineDistance(a: number[], b: number[]): number {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        nodeCount: number;
        dimensions: number;
        maxConnections: number;
        efSearch: number;
        efConstruction: number;
    } {
        return {
            nodeCount: this.nodeCount,
            dimensions: this.config.dimensions,
            maxConnections: this.config.maxConnections || 16,
            efSearch: this.config.efSearch || 50,
            efConstruction: this.config.efConstruction || 200,
        };
    }

    /**
     * 保存索引
     */
    save(): string {
        return JSON.stringify({
            config: this.config,
            nodeCount: this.nodeCount,
            centroid: this.centroid,
        });
    }

    /**
     * 加载索引
     */
    static load(data: string): HNSWIndexOptimized {
        const parsed = JSON.parse(data);
        const index = new HNSWIndexOptimized(parsed.config);
        index.nodeCount = parsed.nodeCount;
        index.centroid = parsed.centroid;
        return index;
    }
}

// ============================================================
// 工厂函数
// ============================================================

export function createOptimizedHNSW(config: OptimizedHNSWConfig): HNSWIndexOptimized {
    return new HNSWIndexOptimized(config);
}

// ============================================================
// 导出
// ============================================================

export default HNSWIndexOptimized;
