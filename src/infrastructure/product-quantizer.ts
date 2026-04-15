/**
 * 产品量化器 (Product Quantizer)
 * 
 * 职责：
 * - 高效向量压缩：将向量分成多个子向量独立量化
 * - 存储优化：压缩比 8-16x
 * - 快速搜索：使用非对称距离计算
 */

import * as crypto from 'crypto';

// ============================================================
// 类型定义
// ============================================================

export interface PQConfig {
  /** 子向量数量 (M) */
  M: number;
  /** 每个子向量的聚类数 (K)，通常为 256 */
  K: number;
  /** 向量维度 */
  dim: number;
  /** 迭代次数 */
  iterations: number;
  /** 采样率（用于训练） */
  sampleRate: number;
}

export interface PQCode {
  /** 向量 ID */
  id: string;
  /** 量化编码（每个子向量一个字节） */
  codes: Uint8Array;
}

export interface PQIndex {
  /** 配置 */
  config: PQConfig;
  /** 码本 */
  codebooks: Float32Array[][];
  /** 编码后的向量 */
  codes: Map<string, Uint8Array>;
  /** 原始向量（可选，用于重训练） */
  vectors?: Map<string, Float32Array>;
}

export interface PQSearchResult {
  id: string;
  distance: number;
}

export interface PQStats {
  numVectors: number;
  memoryUsage: number;
  compressionRatio: number;
  avgDistanceError: number;
}

// ============================================================
// 产品量化器
// ============================================================

export class ProductQuantizer {
  private config: PQConfig;
  private codebooks: Float32Array[][] = [];
  private codes: Map<string, Uint8Array> = new Map();
  private vectors: Map<string, Float32Array> = new Map();
  private subDim: number = 0;
  private trained: boolean = false;

  constructor(config: Partial<PQConfig> = {}) {
    this.config = {
      M: config.M ?? 8,
      K: config.K ?? 256,
      dim: config.dim ?? 128,
      iterations: config.iterations ?? 10,
      sampleRate: config.sampleRate ?? 0.1,
    };

    // 验证配置
    if (this.config.dim % this.config.M !== 0) {
      throw new Error(`维度 ${this.config.dim} 必须能被子向量数 ${this.config.M} 整除`);
    }

    this.subDim = this.config.dim / this.config.M;
  }

  /**
   * 训练码本
   */
  train(vectors: Float32Array[]): void {
    console.log(`[PQ] 开始训练，向量数: ${vectors.length}`);

    // 采样
    const sampleSize = Math.min(
      vectors.length,
      Math.max(1000, Math.floor(vectors.length * this.config.sampleRate))
    );
    const sampled = this.sample(vectors, sampleSize);

    // 初始化码本
    this.codebooks = [];

    // 对每个子向量训练 K-means
    for (let m = 0; m < this.config.M; m++) {
      console.log(`[PQ] 训练子空间 ${m + 1}/${this.config.M}`);

      // 提取子向量
      const subvectors = sampled.map(v => 
        this.extractSubvector(v, m)
      );

      // K-means 聚类
      const centroids = this.kmeans(subvectors, this.config.K, this.config.iterations);
      this.codebooks.push(centroids);
    }

    this.trained = true;
    console.log(`[PQ] 训练完成，码本大小: ${this.codebooks.length}`);
  }

  /**
   * 量化单个向量
   */
  quantize(vector: Float32Array): Uint8Array {
    if (!this.trained) {
      throw new Error('量化器未训练，请先调用 train()');
    }

    const codes = new Uint8Array(this.config.M);

    for (let m = 0; m < this.config.M; m++) {
      const subvector = this.extractSubvector(vector, m);
      codes[m] = this.findNearestCentroid(m, subvector);
    }

    return codes;
  }

  /**
   * 添加向量
   */
  add(id: string, vector: Float32Array): void {
    if (vector.length !== this.config.dim) {
      throw new Error(`向量维度不匹配: ${vector.length} vs ${this.config.dim}`);
    }

    const codes = this.quantize(vector);
    this.codes.set(id, codes);
    this.vectors.set(id, vector);
  }

  /**
   * 批量添加向量
   */
  addBatch(vectors: Array<{ id: string; vector: Float32Array }>): void {
    for (const { id, vector } of vectors) {
      this.add(id, vector);
    }
  }

  /**
   * 非对称距离计算 (ADC)
   * 
   * 查询向量不量化，只量化数据库向量
   * 这样可以获得更高的精度
   */
  asymmetricDistance(query: Float32Array, codes: Uint8Array): number {
    let distance = 0;

    for (let m = 0; m < this.config.M; m++) {
      const subvector = this.extractSubvector(query, m);
      const centroid = this.codebooks[m][codes[m]];
      distance += this.euclideanDistanceSquared(subvector, centroid);
    }

    return Math.sqrt(distance);
  }

  /**
   * 搜索最近邻
   */
  search(query: Float32Array, k: number): PQSearchResult[] {
    if (!this.trained) {
      throw new Error('量化器未训练');
    }

    // 预计算查询向量的距离表
    const distanceTable = this.computeDistanceTable(query);

    // 计算所有向量的距离
    const results: PQSearchResult[] = [];

    for (const [id, codes] of this.codes) {
      const distance = this.lookupDistance(codes, distanceTable);
      results.push({ id, distance });
    }

    // 排序并返回 Top-K
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, k);
  }

  /**
   * 预计算距离表
   * 
   * 对于每个子空间和每个质心，预计算查询子向量到质心的距离
   * 这样可以加速后续的距离计算
   */
  private computeDistanceTable(query: Float32Array): Float32Array[] {
    const table: Float32Array[] = [];

    for (let m = 0; m < this.config.M; m++) {
      const subvector = this.extractSubvector(query, m);
      const distances = new Float32Array(this.config.K);

      for (let c = 0; c < this.config.K; c++) {
        distances[c] = this.euclideanDistanceSquared(subvector, this.codebooks[m][c]);
      }

      table.push(distances);
    }

    return table;
  }

  /**
   * 查表计算距离
   */
  private lookupDistance(codes: Uint8Array, table: Float32Array[]): number {
    let distance = 0;

    for (let m = 0; m < this.config.M; m++) {
      distance += table[m][codes[m]];
    }

    return Math.sqrt(distance);
  }

  /**
   * 获取统计信息
   */
  getStats(): PQStats {
    const numVectors = this.codes.size;
    
    // 原始存储: dim * 4 bytes
    // 量化存储: M * 1 byte
    const originalSize = numVectors * this.config.dim * 4;
    const quantizedSize = numVectors * this.config.M;
    const compressionRatio = originalSize / quantizedSize;

    // 计算平均距离误差
    let totalError = 0;
    let count = 0;

    for (const [id, codes] of this.codes) {
      const original = this.vectors.get(id);
      if (original) {
        const reconstructed = this.reconstruct(codes);
        totalError += this.euclideanDistance(original, reconstructed);
        count++;
      }
    }

    return {
      numVectors,
      memoryUsage: quantizedSize + this.codebooks.length * this.config.K * this.subDim * 4,
      compressionRatio,
      avgDistanceError: count > 0 ? totalError / count : 0,
    };
  }

  /**
   * 重构向量（近似）
   */
  reconstruct(codes: Uint8Array): Float32Array {
    const vector = new Float32Array(this.config.dim);

    for (let m = 0; m < this.config.M; m++) {
      const centroid = this.codebooks[m][codes[m]];
      for (let i = 0; i < this.subDim; i++) {
        vector[m * this.subDim + i] = centroid[i];
      }
    }

    return vector;
  }

  /**
   * 导出索引
   */
  exportIndex(): PQIndex {
    return {
      config: this.config,
      codebooks: this.codebooks,
      codes: new Map(this.codes),
    };
  }

  /**
   * 导入索引
   */
  importIndex(index: PQIndex): void {
    this.config = index.config;
    this.codebooks = index.codebooks;
    this.codes = index.codes;
    this.subDim = this.config.dim / this.config.M;
    this.trained = true;
  }

  /**
   * 序列化
   */
  serialize(): Buffer {
    // 简化实现，实际需要更完善的序列化
    const json = JSON.stringify({
      config: this.config,
      codebooks: this.codebooks.map(cb => cb.map(c => Array.from(c))),
      codes: Array.from(this.codes.entries()),
    });
    return Buffer.from(json);
  }

  /**
   * 反序列化
   */
  deserialize(buffer: Buffer): void {
    const json = JSON.parse(buffer.toString());
    
    this.config = json.config;
    this.codebooks = json.codebooks.map((cb: number[][]) => 
      cb.map(c => new Float32Array(c))
    );
    this.codes = new Map(json.codes);
    this.subDim = this.config.dim / this.config.M;
    this.trained = true;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private extractSubvector(vector: Float32Array, m: number): Float32Array {
    const start = m * this.subDim;
    return vector.slice(start, start + this.subDim);
  }

  private findNearestCentroid(m: number, subvector: Float32Array): number {
    let minDist = Infinity;
    let minIdx = 0;

    for (let c = 0; c < this.config.K; c++) {
      const dist = this.euclideanDistanceSquared(subvector, this.codebooks[m][c]);
      if (dist < minDist) {
        minDist = dist;
        minIdx = c;
      }
    }

    return minIdx;
  }

  private kmeans(vectors: Float32Array[], k: number, iterations: number): Float32Array[] {
    const dim = vectors[0].length;
    
    // 初始化质心（随机选择）
    const centroids: Float32Array[] = [];
    const used = new Set<number>();

    while (centroids.length < k) {
      const idx = Math.floor(Math.random() * vectors.length);
      if (!used.has(idx)) {
        used.add(idx);
        centroids.push(new Float32Array(vectors[idx]));
      }
    }

    // K-means 迭代
    for (let iter = 0; iter < iterations; iter++) {
      // 分配
      const clusters: Float32Array[][] = Array.from({ length: k }, () => []);

      for (const v of vectors) {
        let minDist = Infinity;
        let minIdx = 0;

        for (let c = 0; c < k; c++) {
          const dist = this.euclideanDistanceSquared(v, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            minIdx = c;
          }
        }

        clusters[minIdx].push(v);
      }

      // 更新质心
      for (let c = 0; c < k; c++) {
        if (clusters[c].length > 0) {
          centroids[c] = this.average(clusters[c]);
        }
      }
    }

    return centroids;
  }

  private average(vectors: Float32Array[]): Float32Array {
    const dim = vectors[0].length;
    const result = new Float32Array(dim);

    for (const v of vectors) {
      for (let i = 0; i < dim; i++) {
        result[i] += v[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      result[i] /= vectors.length;
    }

    return result;
  }

  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    return Math.sqrt(this.euclideanDistanceSquared(a, b));
  }

  private euclideanDistanceSquared(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return sum;
  }

  private sample(vectors: Float32Array[], size: number): Float32Array[] {
    if (size >= vectors.length) {
      return vectors;
    }

    const sampled: Float32Array[] = [];
    const indices = new Set<number>();

    while (sampled.length < size) {
      const idx = Math.floor(Math.random() * vectors.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        sampled.push(vectors[idx]);
      }
    }

    return sampled;
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createProductQuantizer(config?: Partial<PQConfig>): ProductQuantizer {
  return new ProductQuantizer(config);
}

/**
 * 快速量化
 */
export function quickQuantize(
  vectors: Float32Array[],
  config?: Partial<PQConfig>
): { quantizer: ProductQuantizer; codes: Uint8Array[] } {
  const pq = new ProductQuantizer(config);
  pq.train(vectors);

  const codes = vectors.map(v => pq.quantize(v));

  return { quantizer: pq, codes };
}
