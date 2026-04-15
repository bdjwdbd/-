/**
 * 内存优化索引
 * 
 * 优化目标：
 * 1. 连续内存布局 - 减少缓存缺失
 * 2. 64 字节对齐 - 减少缓存行冲突
 * 3. 预取优化 - 提前加载下一批数据
 * 
 * 预期效果：10x 性能提升
 */

// ============================================================
// 类型定义
// ============================================================

export interface MemoryOptimizedConfig {
  dimension: number;
  alignment: number; // 默认 64 字节
  prefetchSize: number; // 预取批次大小
}

export interface MemoryOptimizedIndex {
  data: Float32Array;      // 连续存储所有向量
  norms: Float32Array;     // 预计算范数
  offsets: Uint32Array;    // 每个向量的偏移量（字节）
  count: number;           // 向量数量
  dimension: number;       // 向量维度
}

// ============================================================
// 内存优化索引构建器
// ============================================================

export class MemoryOptimizedIndexBuilder {
  private config: Required<MemoryOptimizedConfig>;

  constructor(config: Partial<MemoryOptimizedConfig> = {}) {
    this.config = {
      dimension: config.dimension ?? 128,
      alignment: config.alignment ?? 64, // 缓存行大小
      prefetchSize: config.prefetchSize ?? 8, // 预取 8 个向量
    };
  }

  /**
   * 构建内存优化索引
   */
  build(vectors: Float32Array[]): MemoryOptimizedIndex {
    const count = vectors.length;
    const dim = this.config.dimension;
    const alignment = this.config.alignment;

    // 计算对齐后的向量大小（字节）
    const vectorBytes = dim * 4; // Float32 = 4 bytes
    const alignedBytes = Math.ceil(vectorBytes / alignment) * alignment;

    // 分配连续内存
    const totalBytes = count * alignedBytes;
    const data = new Float32Array(totalBytes / 4);
    const norms = new Float32Array(count);
    const offsets = new Uint32Array(count);

    // 填充数据
    for (let i = 0; i < count; i++) {
      const offset = i * (alignedBytes / 4);
      offsets[i] = offset * 4; // 字节偏移

      // 复制向量数据
      const v = vectors[i];
      let normSq = 0;
      for (let j = 0; j < dim; j++) {
        const val = v[j];
        data[offset + j] = val;
        normSq += val * val;
      }
      norms[i] = Math.sqrt(normSq);
    }

    return {
      data,
      norms,
      offsets,
      count,
      dimension: dim,
    };
  }

  /**
   * 批量计算相似度（内存优化版）
   */
  batchCosineSimilarity(
    index: MemoryOptimizedIndex,
    query: Float32Array
  ): Float32Array {
    const { data, norms, count, dimension } = index;
    const results = new Float32Array(count);

    // 预计算查询向量范数
    let queryNormSq = 0;
    for (let i = 0; i < dimension; i++) {
      queryNormSq += query[i] * query[i];
    }
    const queryNorm = Math.sqrt(queryNormSq);

    // 批量计算（利用连续内存）
    const prefetchSize = this.config.prefetchSize;
    const alignedSize = Math.ceil(dimension * 4 / this.config.alignment) * this.config.alignment / 4;

    for (let i = 0; i < count; i++) {
      // 预取提示（JS 引擎可能优化）
      if (i + prefetchSize < count) {
        // 预取下一批数据
        const prefetchOffset = (i + prefetchSize) * alignedSize;
        void data[prefetchOffset]; // 触发加载
      }

      // 计算点积
      const offset = i * alignedSize;
      let dot = 0;
      for (let j = 0; j < dimension; j++) {
        dot += query[j] * data[offset + j];
      }

      // 计算余弦相似度
      const norm = norms[i];
      results[i] = norm > 0 && queryNorm > 0 ? dot / (norm * queryNorm) : 0;
    }

    return results;
  }

  /**
   * 批量计算相似度（多查询优化版）
   */
  batchMultiQuerySimilarity(
    index: MemoryOptimizedIndex,
    queries: Float32Array[]
  ): Float32Array[] {
    const { data, norms, count, dimension } = index;
    const numQueries = queries.length;

    // 预计算所有查询向量的范数
    const queryNorms = new Float32Array(numQueries);
    for (let q = 0; q < numQueries; q++) {
      let normSq = 0;
      for (let i = 0; i < dimension; i++) {
        normSq += queries[q][i] * queries[q][i];
      }
      queryNorms[q] = Math.sqrt(normSq);
    }

    // 批量计算所有结果
    const results: Float32Array[] = [];
    for (let q = 0; q < numQueries; q++) {
      results.push(new Float32Array(count));
    }

    const alignedSize = Math.ceil(dimension * 4 / this.config.alignment) * this.config.alignment / 4;

    // 按向量遍历（缓存友好）
    for (let i = 0; i < count; i++) {
      const offset = i * alignedSize;
      const norm = norms[i];

      // 对所有查询计算与当前向量的相似度
      for (let q = 0; q < numQueries; q++) {
        let dot = 0;
        for (let j = 0; j < dimension; j++) {
          dot += queries[q][j] * data[offset + j];
        }

        const queryNorm = queryNorms[q];
        results[q][i] = norm > 0 && queryNorm > 0 ? dot / (norm * queryNorm) : 0;
      }
    }

    return results;
  }

  /**
   * 获取向量
   */
  getVector(index: MemoryOptimizedIndex, id: number): Float32Array {
    const { data, dimension } = index;
    const alignedSize = Math.ceil(dimension * 4 / this.config.alignment) * this.config.alignment / 4;
    const offset = id * alignedSize;

    return data.slice(offset, offset + dimension);
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createMemoryOptimizedIndex(
  vectors: Float32Array[],
  config?: Partial<MemoryOptimizedConfig>
): MemoryOptimizedIndex {
  const builder = new MemoryOptimizedIndexBuilder(config);
  return builder.build(vectors);
}

export function batchCosineSimilarity(
  index: MemoryOptimizedIndex,
  query: Float32Array
): Float32Array {
  const builder = new MemoryOptimizedIndexBuilder({ dimension: index.dimension });
  return builder.batchCosineSimilarity(index, query);
}
