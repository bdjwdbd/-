/**
 * @file residual-quantizer.ts
 * @brief 残差量化实现
 * 
 * 功能：
 * 1. 多级量化
 * 2. 残差编码
 * 3. 更高精度的近似
 */

import ProductQuantizerOptimized from './product-quantizer-optimized';

// ============================================================
// 类型定义
// ============================================================

export interface RQConfig {
    dim: number;
    nLevels: number;          // 量化级数
    nSubvectors: number;
    nCentroids: number;
}

export interface RQCode {
    codes: Uint8Array[];      // 每级一个编码
    id: string;
}

// ============================================================
// 残差量化器
// ============================================================

export class ResidualQuantizer {
    private dim: number;
    private nLevels: number;
    private quantizers: ProductQuantizerOptimized[] = [];
    private trained = false;

    constructor(config: RQConfig) {
        this.dim = config.dim;
        this.nLevels = config.nLevels;

        // 每级一个量化器
        for (let l = 0; l < config.nLevels; l++) {
            this.quantizers.push(new ProductQuantizerOptimized({
                dim: config.dim,
                nSubvectors: config.nSubvectors,
                nCentroids: config.nCentroids
            }));
        }
    }

    /**
     * 训练
     */
    train(vectors: Float32Array[], nIterations: number = 20): void {
        let residuals = vectors;

        // 逐级训练
        for (let l = 0; l < this.nLevels; l++) {
            // console.log(`Training level ${l + 1}/${this.nLevels}...`);

            // 训练当前级
            this.quantizers[l].train(residuals, nIterations);

            // 计算残差
            if (l < this.nLevels - 1) {
                const newResiduals: Float32Array[] = [];

                for (const vec of residuals) {
                    const codes = this.quantizers[l].quantize(vec);
                    const reconstruction = this.quantizers[l].dequantize(codes);

                    // 残差 = 原始 - 重建
                    const residual = new Float32Array(this.dim);
                    for (let i = 0; i < this.dim; i++) {
                        residual[i] = vec[i] - reconstruction[i];
                    }
                    newResiduals.push(residual);
                }

                residuals = newResiduals;
            }
        }

        this.trained = true;
    }

    /**
     * 量化
     */
    quantize(vector: Float32Array): Uint8Array[] {
        if (!this.trained) {
            throw new Error('Quantizer not trained');
        }

        const codes: Uint8Array[] = [];
        let residual = new Float32Array(vector);

        for (let l = 0; l < this.nLevels; l++) {
            // 量化当前残差
            const code = this.quantizers[l].quantize(residual);
            codes.push(code);

            // 计算新残差
            if (l < this.nLevels - 1) {
                const reconstruction = this.quantizers[l].dequantize(code);
                const newResidual = new Float32Array(this.dim);
                for (let i = 0; i < this.dim; i++) {
                    newResidual[i] = residual[i] - reconstruction[i];
                }
                residual = newResidual;
            }
        }

        return codes;
    }

    /**
     * 解量化
     */
    dequantize(codes: Uint8Array[]): Float32Array {
        if (!this.trained) {
            throw new Error('Quantizer not trained');
        }

        const vector = new Float32Array(this.dim);

        for (let l = 0; l < this.nLevels; l++) {
            const reconstruction = this.quantizers[l].dequantize(codes[l]);
            for (let i = 0; i < this.dim; i++) {
                vector[i] += reconstruction[i];
            }
        }

        return vector;
    }

    /**
     * 搜索
     */
    search(
        query: Float32Array,
        codeDatabase: RQCode[],
        k: number
    ): Array<{ id: string; distance: number }> {
        const results: Array<{ id: string; distance: number }> = [];

        for (const code of codeDatabase) {
            const reconstruction = this.dequantize(code.codes);

            // 计算欧氏距离
            let dist = 0;
            for (let i = 0; i < this.dim; i++) {
                const diff = query[i] - reconstruction[i];
                dist += diff * diff;
            }

            results.push({ id: code.id, distance: Math.sqrt(dist) });
        }

        results.sort((a, b) => a.distance - b.distance);
        return results.slice(0, k);
    }

    /**
     * 获取压缩比
     */
    getCompressionRatio(): number {
        // 每级：nSubvectors 字节
        const totalBytes = this.quantizers.reduce(
            (sum, q) => sum + q.getStats().nSubvectors,
            0
        );
        return (this.dim * 4) / totalBytes;
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        dim: number;
        nLevels: number;
        compressionRatio: number;
        trained: boolean;
    } {
        return {
            dim: this.dim,
            nLevels: this.nLevels,
            compressionRatio: this.getCompressionRatio(),
            trained: this.trained
        };
    }
}

// ============================================================
// 导出
// ============================================================

export default ResidualQuantizer;
