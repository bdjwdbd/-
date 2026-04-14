/**
 * OPQ 量化模块
 * 
 * 功能：
 * 1. OPQ (Optimized Product Quantization) 量化
 * 2. 旋转优化
 * 3. 子空间量化
 */

// ============================================================
// 类型定义
// ============================================================

export interface OPQConfig {
  numSubspaces: number;      // 子空间数量
  numCentroids: number;      // 每个子空间的质心数量
  numIterations: number;     // 迭代次数
  numRecall: number;         // 重排数量
}

export interface OPQIndex {
  rotation: number[][];      // 旋转矩阵
  codebooks: number[][][];   // 码本
  codes: Uint8Array[];       // 编码后的向量
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: OPQConfig = {
  numSubspaces: 8,
  numCentroids: 256,
  numIterations: 20,
  numRecall: 100,
};

// ============================================================
// OPQ 量化器
// ============================================================

export class OPQQuantizer {
  private config: OPQConfig;
  private index: OPQIndex | null = null;
  private dim: number = 0;
  private subDim: number = 0;

  constructor(config: Partial<OPQConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 训练 OPQ 索引
   */
  train(vectors: number[][]): void {
    this.dim = vectors[0].length;
    this.subDim = Math.floor(this.dim / this.config.numSubspaces);
    
    // 1. 初始化旋转矩阵（单位矩阵）
    const rotation = this.initRotation();
    
    // 2. 迭代优化
    for (let iter = 0; iter < this.config.numIterations; iter++) {
      // 旋转向量
      const rotated = vectors.map(v => this.applyRotation(v, rotation));
      
      // 训练子空间码本
      const codebooks = this.trainCodebooks(rotated);
      
      // 编码向量
      const codes = rotated.map(v => this.encode(v, codebooks));
      
      // 更新旋转矩阵
      this.updateRotation(rotation, vectors, codes, codebooks);
    }
    
    // 3. 最终训练码本
    const rotated = vectors.map(v => this.applyRotation(v, rotation));
    const codebooks = this.trainCodebooks(rotated);
    const codes = rotated.map(v => this.encode(v, codebooks));
    
    this.index = { rotation, codebooks, codes };
  }

  /**
   * 初始化旋转矩阵
   */
  private initRotation(): number[][] {
    const n = this.dim;
    const rotation: number[][] = [];
    
    for (let i = 0; i < n; i++) {
      rotation[i] = [];
      for (let j = 0; j < n; j++) {
        rotation[i][j] = i === j ? 1 : 0;
      }
    }
    
    return rotation;
  }

  /**
   * 应用旋转
   */
  private applyRotation(vector: number[], rotation: number[][]): number[] {
    const n = this.dim;
    const result: number[] = new Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[i] += rotation[i][j] * vector[j];
      }
    }
    
    return result;
  }

  /**
   * 训练子空间码本
   */
  private trainCodebooks(vectors: number[][]): number[][][] {
    const codebooks: number[][][] = [];
    const numSubspaces = this.config.numSubspaces;
    const numCentroids = this.config.numCentroids;
    
    for (let s = 0; s < numSubspaces; s++) {
      const start = s * this.subDim;
      const end = start + this.subDim;
      
      // 提取子空间向量
      const subVectors = vectors.map(v => v.slice(start, end));
      
      // K-means 聚类
      const centroids = this.kmeans(subVectors, numCentroids);
      codebooks.push(centroids);
    }
    
    return codebooks;
  }

  /**
   * K-means 聚类
   */
  private kmeans(vectors: number[][], k: number): number[][] {
    const n = vectors.length;
    const dim = vectors[0].length;
    
    // 随机初始化质心
    const centroids: number[][] = [];
    for (let i = 0; i < k; i++) {
      centroids.push([...vectors[Math.floor(Math.random() * n)]]);
    }
    
    // 迭代
    for (let iter = 0; iter < 10; iter++) {
      // 分配
      const assignments: number[] = vectors.map(v => {
        let minDist = Infinity;
        let minIdx = 0;
        for (let i = 0; i < k; i++) {
          const dist = this.squaredDistance(v, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            minIdx = i;
          }
        }
        return minIdx;
      });
      
      // 更新质心
      const counts: number[] = new Array(k).fill(0);
      const sums: number[][] = Array.from({ length: k }, () => new Array(dim).fill(0));
      
      for (let i = 0; i < n; i++) {
        const idx = assignments[i];
        counts[idx]++;
        for (let j = 0; j < dim; j++) {
          sums[idx][j] += vectors[i][j];
        }
      }
      
      for (let i = 0; i < k; i++) {
        if (counts[i] > 0) {
          for (let j = 0; j < dim; j++) {
            centroids[i][j] = sums[i][j] / counts[i];
          }
        }
      }
    }
    
    return centroids;
  }

  /**
   * 编码向量
   */
  private encode(vector: number[], codebooks: number[][][]): Uint8Array {
    const numSubspaces = this.config.numSubspaces;
    const codes = new Uint8Array(numSubspaces);
    
    for (let s = 0; s < numSubspaces; s++) {
      const start = s * this.subDim;
      const end = start + this.subDim;
      const subVector = vector.slice(start, end);
      
      // 找最近的质心
      let minDist = Infinity;
      let minIdx = 0;
      for (let i = 0; i < codebooks[s].length; i++) {
        const dist = this.squaredDistance(subVector, codebooks[s][i]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      codes[s] = minIdx;
    }
    
    return codes;
  }

  /**
   * 更新旋转矩阵
   */
  private updateRotation(
    rotation: number[][],
    vectors: number[][],
    codes: Uint8Array[],
    codebooks: number[][][]
  ): void {
    // 简化实现：使用 SVD 更新
    // 实际实现需要更复杂的优化
    // 这里使用随机扰动作为占位
    const n = this.dim;
    const epsilon = 0.01;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        rotation[i][j] += (Math.random() - 0.5) * epsilon;
      }
    }
    
    // 正交化（Gram-Schmidt）
    this.orthogonalize(rotation);
  }

  /**
   * 正交化矩阵
   */
  private orthogonalize(matrix: number[][]): void {
    const n = this.dim;
    
    for (let i = 0; i < n; i++) {
      // 减去之前所有列的投影
      for (let j = 0; j < i; j++) {
        const dot = this.dotProduct(matrix[i], matrix[j]);
        for (let k = 0; k < n; k++) {
          matrix[i][k] -= dot * matrix[j][k];
        }
      }
      
      // 归一化
      const norm = Math.sqrt(this.dotProduct(matrix[i], matrix[i]));
      if (norm > 0) {
        for (let k = 0; k < n; k++) {
          matrix[i][k] /= norm;
        }
      }
    }
  }

  /**
   * 搜索
   */
  search(query: number[], topK: number): Array<{ index: number; distance: number }> {
    if (!this.index) {
      throw new Error('Index not trained');
    }
    
    // 旋转查询向量
    const rotatedQuery = this.applyRotation(query, this.index.rotation);
    
    // 计算查询到所有码本的距离表
    const distanceTables = this.computeDistanceTables(rotatedQuery, this.index.codebooks);
    
    // 非对称距离计算
    const distances: Array<{ index: number; distance: number }> = [];
    for (let i = 0; i < this.index.codes.length; i++) {
      const code = this.index.codes[i];
      let dist = 0;
      for (let s = 0; s < this.config.numSubspaces; s++) {
        dist += distanceTables[s][code[s]];
      }
      distances.push({ index: i, distance: dist });
    }
    
    // 排序
    distances.sort((a, b) => a.distance - b.distance);
    
    return distances.slice(0, topK);
  }

  /**
   * 计算距离表
   */
  private computeDistanceTables(query: number[], codebooks: number[][][]): number[][] {
    const numSubspaces = this.config.numSubspaces;
    const tables: number[][] = [];
    
    for (let s = 0; s < numSubspaces; s++) {
      const start = s * this.subDim;
      const end = start + this.subDim;
      const subQuery = query.slice(start, end);
      
      tables[s] = [];
      for (let i = 0; i < codebooks[s].length; i++) {
        tables[s][i] = this.squaredDistance(subQuery, codebooks[s][i]);
      }
    }
    
    return tables;
  }

  /**
   * 辅助函数
   */
  private squaredDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum;
  }

  private dotProduct(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * 获取索引
   */
  getIndex(): OPQIndex | null {
    return this.index;
  }

  /**
   * 获取配置
   */
  getConfig(): OPQConfig {
    return this.config;
  }
}

// ============================================================
// 导出
// ============================================================

export function createOPQQuantizer(config?: Partial<OPQConfig>): OPQQuantizer {
  return new OPQQuantizer(config);
}
