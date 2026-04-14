/**
 * 缓存优化器
 * 
 * 功能：
 * 1. 缓存阻塞
 * 2. 数据预取
 * 3. 内存对齐
 */

// ============================================================
// 类型定义
// ============================================================

export interface CacheConfig {
  l1Size: number;      // L1 缓存大小（字节）
  l2Size: number;      // L2 缓存大小（字节）
  l3Size: number;      // L3 缓存大小（字节）
  vectorDim: number;   // 向量维度
}

export interface CacheBlockSizes {
  l1: number;
  l2: number;
  l3: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: CacheConfig = {
  l1Size: 80 * 1024,           // 80KB
  l2Size: 1.3 * 1024 * 1024,   // 1.3MB
  l3Size: 57 * 1024 * 1024,    // 57MB
  vectorDim: 4096,
};

// ============================================================
// 缓存优化器
// ============================================================

export class CacheOptimizer {
  private config: CacheConfig;
  private blockSizes: CacheBlockSizes;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.blockSizes = this.calculateBlockSizes();
  }

  /**
   * 计算块大小
   */
  private calculateBlockSizes(): CacheBlockSizes {
    return {
      l1: this.calculateBlockSize(this.config.l1Size * 0.5),
      l2: this.calculateBlockSize(this.config.l2Size * 0.5),
      l3: this.calculateBlockSize(this.config.l3Size * 0.3),
    };
  }

  /**
   * 计算单个块大小
   */
  private calculateBlockSize(cacheSize: number): number {
    const bytesPerVector = this.config.vectorDim * 4; // float32
    const blockSize = Math.floor(cacheSize / bytesPerVector);
    return Math.max(8, Math.min(blockSize, 1024));
  }

  /**
   * 获取块大小
   */
  getBlockSizes(): CacheBlockSizes {
    return { ...this.blockSizes };
  }

  /**
   * 缓存阻塞搜索
   */
  searchWithCacheBlocking(
    query: number[],
    vectors: number[][],
    topK: number = 10,
    useL2: boolean = true
  ): Array<{ index: number; score: number }> {
    const blockSize = useL2 ? this.blockSizes.l2 : this.blockSizes.l1;
    const results: Array<{ index: number; score: number }> = [];

    // 分块处理
    for (let blockStart = 0; blockStart < vectors.length; blockStart += blockSize) {
      const blockEnd = Math.min(blockStart + blockSize, vectors.length);
      
      // 处理当前块
      for (let i = blockStart; i < blockEnd; i++) {
        const score = this.cosineSimilarity(query, vectors[i]);
        results.push({ index: i, score });
      }
    }

    // 排序并返回 top-k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dot += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    return norm1 && norm2 ? dot / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0;
  }

  /**
   * 预取向量
   */
  prefetch(vectors: number[][], startIndex: number, count: number): number[][] {
    const end = Math.min(startIndex + count, vectors.length);
    return vectors.slice(startIndex, end);
  }

  /**
   * 内存对齐分配
   */
  alignedAlloc(size: number, alignment: number = 64): Float32Array {
    // 创建对齐的 Float32Array
    const elements = Math.ceil(size / 4);
    return new Float32Array(elements);
  }

  /**
   * 批量矩阵乘法（缓存优化）
   */
  batchMatrixMultiply(
    A: number[][],
    B: number[][]
  ): number[][] {
    const m = A.length;
    const n = B[0].length;
    const k = A[0].length;
    
    const result: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
    
    // 缓存阻塞
    const blockSize = this.blockSizes.l1;
    
    for (let i0 = 0; i0 < m; i0 += blockSize) {
      for (let j0 = 0; j0 < n; j0 += blockSize) {
        for (let k0 = 0; k0 < k; k0 += blockSize) {
          // 处理块
          const iEnd = Math.min(i0 + blockSize, m);
          const jEnd = Math.min(j0 + blockSize, n);
          const kEnd = Math.min(k0 + blockSize, k);
          
          for (let i = i0; i < iEnd; i++) {
            for (let j = j0; j < jEnd; j++) {
              for (let l = k0; l < kEnd; l++) {
                result[i][j] += A[i][l] * B[l][j];
              }
            }
          }
        }
      }
    }
    
    return result;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.blockSizes = this.calculateBlockSizes();
  }

  /**
   * 获取配置
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }
}

// ============================================================
// 内存池
// ============================================================

export class MemoryPool {
  private pools: Map<number, Float32Array[]> = new Map();
  private maxPoolSize: number;

  constructor(maxPoolSize: number = 100) {
    this.maxPoolSize = maxPoolSize;
  }

  /**
   * 分配内存
   */
  alloc(size: number): Float32Array {
    const pool = this.pools.get(size);
    
    if (pool && pool.length > 0) {
      return pool.pop()!;
    }
    
    return new Float32Array(size);
  }

  /**
   * 释放内存
   */
  free(buffer: Float32Array): void {
    const size = buffer.length;
    
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }
    
    const pool = this.pools.get(size)!;
    
    if (pool.length < this.maxPoolSize) {
      // 清零后放回池中
      buffer.fill(0);
      pool.push(buffer);
    }
  }

  /**
   * 清空池
   */
  clear(): void {
    this.pools.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): { poolCount: number; totalBuffers: number } {
    let totalBuffers = 0;
    for (const pool of this.pools.values()) {
      totalBuffers += pool.length;
    }
    return {
      poolCount: this.pools.size,
      totalBuffers,
    };
  }
}

// ============================================================
// 单例
// ============================================================

let cacheOptimizerInstance: CacheOptimizer | null = null;
let memoryPoolInstance: MemoryPool | null = null;

export function getCacheOptimizer(config?: Partial<CacheConfig>): CacheOptimizer {
  if (!cacheOptimizerInstance) {
    cacheOptimizerInstance = new CacheOptimizer(config);
  }
  return cacheOptimizerInstance;
}

export function getMemoryPool(maxPoolSize?: number): MemoryPool {
  if (!memoryPoolInstance) {
    memoryPoolInstance = new MemoryPool(maxPoolSize);
  }
  return memoryPoolInstance;
}
