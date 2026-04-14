/**
 * 向量量化
 * 
 * 功能：
 * 1. FP16 量化
 * 2. INT8 量化
 * 3. 标量量化
 * 4. 产品量化
 */

// ============================================================
// 类型定义
// ============================================================

export type QuantizationType = 'fp16' | 'int8' | 'scalar' | 'product' | 'binary';

export interface QuantizerConfig {
  type: QuantizationType;
  dim: number;
  // 产品量化参数
  nSubvectors?: number;
  nCentroids?: number;
}

// ============================================================
// 基类
// ============================================================

export abstract class Quantizer {
  protected dim: number;

  constructor(dim: number) {
    this.dim = dim;
  }

  abstract quantize(vector: number[]): number[];
  abstract dequantize(quantized: number[]): number[];
  abstract compress(vector: number[]): Uint8Array | Float32Array | Int8Array;
}

// ============================================================
// FP16 量化器
// ============================================================

export class FP16Quantizer extends Quantizer {
  quantize(vector: number[]): number[] {
    return vector.map(v => {
      // 简化实现：截断到 FP16 范围
      const fp16Max = 65504;
      const fp16Min = -65504;
      return Math.max(fp16Min, Math.min(fp16Max, v));
    });
  }

  dequantize(quantized: number[]): number[] {
    return quantized;
  }

  compress(vector: number[]): Float32Array {
    const quantized = this.quantize(vector);
    return new Float32Array(quantized);
  }
}

// ============================================================
// INT8 量化器
// ============================================================

export class INT8Quantizer extends Quantizer {
  private min: number = 0;
  private max: number = 0;
  private scale: number = 1;

  constructor(dim: number) {
    super(dim);
  }

  train(vectors: number[][]): void {
    // 计算全局最小最大值
    let globalMin = Infinity;
    let globalMax = -Infinity;

    for (const vec of vectors) {
      for (const v of vec) {
        globalMin = Math.min(globalMin, v);
        globalMax = Math.max(globalMax, v);
      }
    }

    this.min = globalMin;
    this.max = globalMax;
    this.scale = 127 / Math.max(Math.abs(globalMin), Math.abs(globalMax));
  }

  quantize(vector: number[]): number[] {
    return vector.map(v => Math.round(v * this.scale));
  }

  dequantize(quantized: number[]): number[] {
    return quantized.map(v => v / this.scale);
  }

  compress(vector: number[]): Int8Array {
    const quantized = this.quantize(vector);
    return new Int8Array(quantized);
  }
}

// ============================================================
// 标量量化器
// ============================================================

export class ScalarQuantizer extends Quantizer {
  private mins: number[] = [];
  private maxs: number[] = [];
  private scales: number[] = [];

  constructor(dim: number) {
    super(dim);
  }

  train(vectors: number[][]): void {
    this.mins = new Array(this.dim).fill(Infinity);
    this.maxs = new Array(this.dim).fill(-Infinity);

    for (const vec of vectors) {
      for (let i = 0; i < this.dim; i++) {
        this.mins[i] = Math.min(this.mins[i], vec[i]);
        this.maxs[i] = Math.max(this.maxs[i], vec[i]);
      }
    }

    this.scales = this.maxs.map((max, i) => {
      const range = max - this.mins[i];
      return range > 0 ? 255 / range : 1;
    });
  }

  quantize(vector: number[]): number[] {
    return vector.map((v, i) => {
      const normalized = (v - this.mins[i]) * this.scales[i];
      return Math.max(0, Math.min(255, Math.round(normalized)));
    });
  }

  dequantize(quantized: number[]): number[] {
    return quantized.map((v, i) => v / this.scales[i] + this.mins[i]);
  }

  compress(vector: number[]): Uint8Array {
    const quantized = this.quantize(vector);
    return new Uint8Array(quantized);
  }
}

// ============================================================
// 产品量化器
// ============================================================

export class ProductQuantizer extends Quantizer {
  private nSubvectors: number;
  private nCentroids: number;
  private subvectorDim: number;
  private codebooks: number[][][] = [];

  constructor(dim: number, nSubvectors: number = 8, nCentroids: number = 256) {
    super(dim);
    this.nSubvectors = nSubvectors;
    this.nCentroids = nCentroids;
    this.subvectorDim = Math.floor(dim / nSubvectors);
  }

  train(vectors: number[][]): void {
    this.codebooks = [];

    for (let s = 0; s < this.nSubvectors; s++) {
      const start = s * this.subvectorDim;
      const end = start + this.subvectorDim;
      const subvectors = vectors.map(v => v.slice(start, end));

      // K-means 聚类
      const centroids = this.kmeans(subvectors, this.nCentroids);
      this.codebooks.push(centroids);
    }
  }

  private kmeans(vectors: number[][], k: number, iterations: number = 20): number[][] {
    const n = vectors.length;
    const dim = vectors[0].length;

    // 随机初始化
    const indices = new Set<number>();
    while (indices.size < Math.min(k, n)) {
      indices.add(Math.floor(Math.random() * n));
    }
    let centroids = Array.from(indices).map(i => [...vectors[i]]);

    for (let iter = 0; iter < iterations; iter++) {
      const clusters: number[][][] = Array.from({ length: k }, () => []);
      
      for (const vec of vectors) {
        let minDist = Infinity;
        let nearest = 0;
        for (let i = 0; i < centroids.length; i++) {
          let dist = 0;
          for (let j = 0; j < dim; j++) {
            dist += (vec[j] - centroids[i][j]) ** 2;
          }
          if (dist < minDist) {
            minDist = dist;
            nearest = i;
          }
        }
        clusters[nearest].push(vec);
      }

      centroids = clusters.map((cluster, i) => {
        if (cluster.length === 0) return centroids[i];
        const sum = cluster.reduce((acc, vec) => {
          for (let j = 0; j < dim; j++) {
            acc[j] += vec[j];
          }
          return acc;
        }, new Array(dim).fill(0));
        return sum.map(v => v / cluster.length);
      });
    }

    return centroids;
  }

  quantize(vector: number[]): number[] {
    const codes: number[] = [];

    for (let s = 0; s < this.nSubvectors; s++) {
      const start = s * this.subvectorDim;
      const end = start + this.subvectorDim;
      const subvector = vector.slice(start, end);
      const codebook = this.codebooks[s];

      // 找最近的质心
      let minDist = Infinity;
      let code = 0;
      for (let i = 0; i < codebook.length; i++) {
        let dist = 0;
        for (let j = 0; j < this.subvectorDim; j++) {
          dist += (subvector[j] - codebook[i][j]) ** 2;
        }
        if (dist < minDist) {
          minDist = dist;
          code = i;
        }
      }
      codes.push(code);
    }

    return codes;
  }

  dequantize(codes: number[]): number[] {
    const vector: number[] = [];

    for (let s = 0; s < this.nSubvectors; s++) {
      const codebook = this.codebooks[s];
      const centroid = codebook[codes[s]] || new Array(this.subvectorDim).fill(0);
      vector.push(...centroid);
    }

    return vector;
  }

  compress(vector: number[]): Uint8Array {
    const codes = this.quantize(vector);
    return new Uint8Array(codes);
  }
}

// ============================================================
// 二值量化器
// ============================================================

export class BinaryQuantizer extends Quantizer {
  quantize(vector: number[]): number[] {
    return vector.map(v => v >= 0 ? 1 : 0);
  }

  dequantize(quantized: number[]): number[] {
    return quantized.map(v => v * 2 - 1);
  }

  compress(vector: number[]): Uint8Array {
    const binary = this.quantize(vector);
    const bytes: number[] = [];
    for (let i = 0; i < binary.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && i + j < binary.length; j++) {
        byte |= binary[i + j] << j;
      }
      bytes.push(byte);
    }
    return new Uint8Array(bytes);
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createQuantizer(config: QuantizerConfig): Quantizer {
  switch (config.type) {
    case 'fp16':
      return new FP16Quantizer(config.dim);
    case 'int8':
      return new INT8Quantizer(config.dim);
    case 'scalar':
      return new ScalarQuantizer(config.dim);
    case 'product':
      return new ProductQuantizer(
        config.dim,
        config.nSubvectors ?? 8,
        config.nCentroids ?? 256
      );
    case 'binary':
      return new BinaryQuantizer(config.dim);
    default:
      return new FP16Quantizer(config.dim);
  }
}
