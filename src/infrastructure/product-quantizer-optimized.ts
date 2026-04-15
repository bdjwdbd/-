/**
 * @file product-quantizer-optimized.ts
 * @brief 优化的产品量化实现
 * 
 * 功能：
 * 1. 高效的子向量分割
 * 2. 快速质心查找（使用查找表）
 * 3. 非对称距离计算（ADC）
 */

// ============================================================
// 类型定义
// ============================================================

export interface PQConfig {
    dim: number;              // 原始向量维度
    nSubvectors: number;      // 子向量数量 (M)
    nCentroids: number;       // 每个子空间的质心数 (通常为 256)
    nIterations?: number;     // K-means 迭代次数
}

export interface PQCode {
    codes: Uint8Array;        // 量化编码
    id: string;
}

// ============================================================
// 产品量化器（优化版）
// ============================================================

export class ProductQuantizerOptimized {
    private dim: number;
    private nSubvectors: number;
    private nCentroids: number;
    private subvectorDim: number;
    private codebooks: Float32Array[] = [];  // 每个子空间的码本
    private trained = false;

    constructor(config: PQConfig) {
        this.dim = config.dim;
        this.nSubvectors = config.nSubvectors;
        this.nCentroids = config.nCentroids;
        this.subvectorDim = Math.floor(config.dim / config.nSubvectors);

        if (this.subvectorDim * this.nSubvectors !== this.dim) {
            throw new Error(`Dimension ${config.dim} must be divisible by nSubvectors ${config.nSubvectors}`);
        }
    }

    /**
     * 训练码本
     */
    train(vectors: Float32Array[], nIterations: number = 20): void {
        const numVectors = vectors.length;

        // 为每个子空间训练码本
        for (let s = 0; s < this.nSubvectors; s++) {
            const start = s * this.subvectorDim;
            const end = start + this.subvectorDim;

            // 提取子向量
            const subvectors: Float32Array[] = [];
            for (let i = 0; i < numVectors; i++) {
                const subvec = new Float32Array(this.subvectorDim);
                for (let j = 0; j < this.subvectorDim; j++) {
                    subvec[j] = vectors[i][start + j];
                }
                subvectors.push(subvec);
            }

            // K-means 聚类
            const codebook = this.kmeans(subvectors, nIterations);
            this.codebooks.push(codebook);
        }

        this.trained = true;
    }

    /**
     * K-means 聚类
     */
    private kmeans(vectors: Float32Array[], nIterations: number): Float32Array {
        const numVectors = vectors.length;
        const dim = vectors[0].length;

        // 初始化质心（随机选择）
        const centroids: Float32Array[] = [];
        const usedIndices = new Set<number>();
        for (let i = 0; i < this.nCentroids; i++) {
            let idx: number;
            do {
                idx = Math.floor(Math.random() * numVectors);
            } while (usedIndices.has(idx));
            usedIndices.add(idx);
            centroids.push(new Float32Array(vectors[idx]));
        }

        // 迭代优化
        for (let iter = 0; iter < nIterations; iter++) {
            // 分配到最近的质心
            const clusters: Float32Array[][] = Array.from({ length: this.nCentroids }, () => []);

            for (const vec of vectors) {
                let minDist = Infinity;
                let nearest = 0;

                for (let i = 0; i < this.nCentroids; i++) {
                    let dist = 0;
                    for (let j = 0; j < dim; j++) {
                        const diff = vec[j] - centroids[i][j];
                        dist += diff * diff;
                    }
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = i;
                    }
                }

                clusters[nearest].push(vec);
            }

            // 更新质心
            for (let i = 0; i < this.nCentroids; i++) {
                if (clusters[i].length > 0) {
                    for (let j = 0; j < dim; j++) {
                        let sum = 0;
                        for (const vec of clusters[i]) {
                            sum += vec[j];
                        }
                        centroids[i][j] = sum / clusters[i].length;
                    }
                }
            }
        }

        // 合并为单个 Float32Array
        const result = new Float32Array(this.nCentroids * dim);
        for (let i = 0; i < this.nCentroids; i++) {
            result.set(centroids[i], i * dim);
        }
        return result;
    }

    /**
     * 量化单个向量
     */
    quantize(vector: Float32Array): Uint8Array {
        if (!this.trained) {
            throw new Error('Quantizer not trained');
        }

        const codes = new Uint8Array(this.nSubvectors);

        for (let s = 0; s < this.nSubvectors; s++) {
            const start = s * this.subvectorDim;
            const codebook = this.codebooks[s];

            // 找最近的质心
            let minDist = Infinity;
            let code = 0;

            for (let c = 0; c < this.nCentroids; c++) {
                let dist = 0;
                const centroidOffset = c * this.subvectorDim;

                for (let j = 0; j < this.subvectorDim; j++) {
                    const diff = vector[start + j] - codebook[centroidOffset + j];
                    dist += diff * diff;
                }

                if (dist < minDist) {
                    minDist = dist;
                    code = c;
                }
            }

            codes[s] = code;
        }

        return codes;
    }

    /**
     * 批量量化
     */
    quantizeBatch(vectors: Float32Array[]): Uint8Array[] {
        return vectors.map(v => this.quantize(v));
    }

    /**
     * 解量化（近似重建）
     */
    dequantize(codes: Uint8Array): Float32Array {
        if (!this.trained) {
            throw new Error('Quantizer not trained');
        }

        const vector = new Float32Array(this.dim);

        for (let s = 0; s < this.nSubvectors; s++) {
            const start = s * this.subvectorDim;
            const code = codes[s];
            const codebook = this.codebooks[s];
            const centroidOffset = code * this.subvectorDim;

            for (let j = 0; j < this.subvectorDim; j++) {
                vector[start + j] = codebook[centroidOffset + j];
            }
        }

        return vector;
    }

    /**
     * 非对称距离计算（ADC）
     * 计算查询向量与量化向量的距离
     */
    computeDistanceTable(query: Float32Array): Float32Array[] {
        if (!this.trained) {
            throw new Error('Quantizer not trained');
        }

        // 距离表：每个子空间 × 每个质心
        const distanceTables: Float32Array[] = [];

        for (let s = 0; s < this.nSubvectors; s++) {
            const start = s * this.subvectorDim;
            const codebook = this.codebooks[s];
            const distances = new Float32Array(this.nCentroids);

            for (let c = 0; c < this.nCentroids; c++) {
                let dist = 0;
                const centroidOffset = c * this.subvectorDim;

                for (let j = 0; j < this.subvectorDim; j++) {
                    const diff = query[start + j] - codebook[centroidOffset + j];
                    dist += diff * diff;
                }

                distances[c] = dist;
            }

            distanceTables.push(distances);
        }

        return distanceTables;
    }

    /**
     * 使用距离表快速计算距离
     */
    computeDistanceFromTable(
        codes: Uint8Array,
        distanceTables: Float32Array[]
    ): number {
        let distance = 0;

        for (let s = 0; s < this.nSubvectors; s++) {
            distance += distanceTables[s][codes[s]];
        }

        return Math.sqrt(distance);
    }

    /**
     * 批量搜索（使用 ADC）
     */
    search(
        query: Float32Array,
        codeDatabase: PQCode[],
        k: number
    ): Array<{ id: string; distance: number }> {
        // 预计算距离表
        const distanceTables = this.computeDistanceTable(query);

        // 计算所有距离
        const results: Array<{ id: string; distance: number }> = [];

        for (const code of codeDatabase) {
            const distance = this.computeDistanceFromTable(code.codes, distanceTables);
            results.push({ id: code.id, distance });
        }

        // 排序取 Top-K
        results.sort((a, b) => a.distance - b.distance);
        return results.slice(0, k);
    }

    /**
     * 获取压缩比
     */
    getCompressionRatio(): number {
        // 原始：dim * 4 字节 (Float32)
        // 量化：nSubvectors 字节 (Uint8)
        return (this.dim * 4) / this.nSubvectors;
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        dim: number;
        nSubvectors: number;
        nCentroids: number;
        subvectorDim: number;
        compressionRatio: number;
        trained: boolean;
    } {
        return {
            dim: this.dim,
            nSubvectors: this.nSubvectors,
            nCentroids: this.nCentroids,
            subvectorDim: this.subvectorDim,
            compressionRatio: this.getCompressionRatio(),
            trained: this.trained
        };
    }
}

// ============================================================
// 导出
// ============================================================

export default ProductQuantizerOptimized;
