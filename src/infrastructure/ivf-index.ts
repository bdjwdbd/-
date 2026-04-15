/**
 * @file ivf-index.ts
 * @brief IVF (Inverted File Index) 聚类索引
 * 
 * 功能：
 * 1. K-means 聚类
 * 2. 倒排索引
 * 3. 快速近似搜索
 * 
 * 性能：
 * - 搜索复杂度: O(N/nprobe)
 * - 内存占用: O(N + K * D)
 */

// ============================================================
// 类型定义
// ============================================================

export interface IVFConfig {
    dimensions: number;
    nClusters: number;           // 聚类数量
    nProbe?: number;             // 搜索时探测的聚类数
    distanceFunction?: 'cosine' | 'euclidean' | 'dot';
}

export interface Cluster {
    id: number;
    centroid: Float32Array;
    vectors: Array<{ id: string; vector: Float32Array }>;
}

export interface SearchResult {
    id: string;
    score: number;
}

// ============================================================
// IVF 索引
// ============================================================

export class IVFIndex {
    private config: Required<IVFConfig>;
    private clusters: Cluster[] = [];
    private trained = false;

    constructor(config: IVFConfig) {
        this.config = {
            dimensions: config.dimensions,
            nClusters: config.nClusters,
            nProbe: config.nProbe || 8,
            distanceFunction: config.distanceFunction || 'cosine',
        };
    }

    /**
     * 训练（K-means 聚类）
     */
    train(vectors: Float32Array[], nIterations: number = 20): void {
        const numVectors = vectors.length;
        const dim = this.config.dimensions;

        // 初始化质心（随机选择）
        const indices = new Set<number>();
        while (indices.size < this.config.nClusters) {
            indices.add(Math.floor(Math.random() * numVectors));
        }

        this.clusters = Array.from(indices).map((idx, i) => ({
            id: i,
            centroid: new Float32Array(vectors[idx]),
            vectors: [],
        }));

        // K-means 迭代
        for (let iter = 0; iter < nIterations; iter++) {
            // 清空聚类
            for (const cluster of this.clusters) {
                cluster.vectors = [];
            }

            // 分配向量到最近的聚类
            for (const vec of vectors) {
                const nearest = this.findNearestCluster(vec);
                this.clusters[nearest].vectors.push({
                    id: '',  // 稍后填充
                    vector: vec,
                });
            }

            // 更新质心
            for (const cluster of this.clusters) {
                if (cluster.vectors.length > 0) {
                    const newCentroid = new Float32Array(dim);
                    for (const item of cluster.vectors) {
                        for (let i = 0; i < dim; i++) {
                            newCentroid[i] += item.vector[i];
                        }
                    }
                    for (let i = 0; i < dim; i++) {
                        cluster.centroid[i] = newCentroid[i] / cluster.vectors.length;
                    }
                }
            }
        }

        this.trained = true;
    }

    /**
     * 找最近的聚类
     */
    private findNearestCluster(vector: Float32Array): number {
        let minDist = Infinity;
        let nearest = 0;

        for (let i = 0; i < this.clusters.length; i++) {
            const dist = this.distance(vector, this.clusters[i].centroid);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        }

        return nearest;
    }

    /**
     * 添加向量
     */
    add(id: string, vector: Float32Array): void {
        if (!this.trained) {
            throw new Error('Index not trained. Call train() first.');
        }

        const nearest = this.findNearestCluster(vector);
        this.clusters[nearest].vectors.push({ id, vector });
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
        if (!this.trained) {
            throw new Error('Index not trained.');
        }

        // 找最近的 nProbe 个聚类
        const clusterDistances = this.clusters.map((cluster, i) => ({
            id: i,
            dist: this.distance(query, cluster.centroid),
        }));

        clusterDistances.sort((a, b) => a.dist - b.dist);
        const probeClusters = clusterDistances.slice(0, this.config.nProbe);

        // 在这些聚类中搜索
        const candidates: SearchResult[] = [];

        for (const { id: clusterId } of probeClusters) {
            const cluster = this.clusters[clusterId];
            for (const item of cluster.vectors) {
                const score = 1 - this.distance(query, item.vector);
                candidates.push({ id: item.id, score });
            }
        }

        // 排序取 Top-K
        candidates.sort((a, b) => b.score - a.score);
        return candidates.slice(0, k);
    }

    /**
     * 距离计算
     */
    private distance(a: Float32Array, b: Float32Array): number {
        switch (this.config.distanceFunction) {
            case 'cosine':
                return this.cosineDistance(a, b);
            case 'euclidean':
                return this.euclideanDistance(a, b);
            case 'dot':
                return 1 - this.dotProduct(a, b);
            default:
                return this.cosineDistance(a, b);
        }
    }

    private cosineDistance(a: Float32Array, b: Float32Array): number {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    }

    private euclideanDistance(a: Float32Array, b: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += (a[i] - b[i]) ** 2;
        }
        return Math.sqrt(sum);
    }

    private dotProduct(a: Float32Array, b: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += a[i] * b[i];
        }
        return sum;
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        nClusters: number;
        totalVectors: number;
        avgClusterSize: number;
        nProbe: number;
    } {
        const totalVectors = this.clusters.reduce((sum, c) => sum + c.vectors.length, 0);
        return {
            nClusters: this.config.nClusters,
            totalVectors,
            avgClusterSize: totalVectors / this.config.nClusters,
            nProbe: this.config.nProbe,
        };
    }

    /**
     * 设置 nProbe
     */
    setNProbe(nProbe: number): void {
        this.config.nProbe = nProbe;
    }
}

// ============================================================
// 工厂函数
// ============================================================

export function createIVFIndex(config: IVFConfig): IVFIndex {
    return new IVFIndex(config);
}

// ============================================================
// 导出
// ============================================================

export default IVFIndex;
