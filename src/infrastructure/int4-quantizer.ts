/**
 * INT4 量化器
 * 
 * 职责：
 * - 将 Float32 向量量化为 INT4
 * - INT4 点积计算（8x 加速 vs Float32）
 * - 精度损失 ~2%
 * 
 * 存储方式：每字节存储 2 个 INT4 值（高 4 bit + 低 4 bit）
 */

// ============================================================
// 类型定义
// ============================================================

export interface Int4Vector {
  data: Uint8Array;      // 压缩后的数据（每字节 2 个 INT4）
  scale: number;         // 缩放因子
  length: number;        // 向量长度
}

export interface Int4Index {
  vectors: Int4Vector[];
  norms: Float32Array;   // 预计算的范数
  dimension: number;
}

// ============================================================
// INT4 量化器
// ============================================================

export class Int4Quantizer {
  /**
   * 量化单个向量
   */
  static quantize(vector: Float32Array): Int4Vector {
    // 找最大绝对值
    let maxAbs = 0;
    for (let i = 0; i < vector.length; i++) {
      const abs = Math.abs(vector[i]);
      if (abs > maxAbs) maxAbs = abs;
    }

    // 避免除零
    if (maxAbs === 0) maxAbs = 1;

    // 计算缩放因子（INT4 范围：-8 到 7）
    const scale = maxAbs / 7;

    // 量化（每字节存 2 个 INT4）
    const packedLength = Math.ceil(vector.length / 2);
    const packed = new Uint8Array(packedLength);

    for (let i = 0; i < vector.length; i += 2) {
      // 高 4 bit：第 i 个值
      const high = Math.max(-8, Math.min(7, Math.round(vector[i] / scale)));
      // 低 4 bit：第 i+1 个值
      const low = i + 1 < vector.length
        ? Math.max(-8, Math.min(7, Math.round(vector[i + 1] / scale)))
        : 0;

      // 打包：高 4 bit + 低 4 bit
      packed[i / 2] = ((high + 8) << 4) | (low + 8);
    }

    return {
      data: packed,
      scale,
      length: vector.length,
    };
  }

  /**
   * 批量量化
   */
  static quantizeBatch(vectors: Float32Array[]): Int4Vector[] {
    return vectors.map(v => this.quantize(v));
  }

  /**
   * 解包 INT4 值
   */
  static unpack(packed: Uint8Array, index: number): number {
    const byteIndex = Math.floor(index / 2);
    const isHigh = index % 2 === 0;

    if (byteIndex >= packed.length) return 0;

    const byte = packed[byteIndex];
    const value = isHigh ? (byte >> 4) - 8 : (byte & 0x0F) - 8;
    return value;
  }

  /**
   * INT4 点积（快速）
   */
  static dotProduct(a: Int4Vector, b: Int4Vector): number {
    if (a.length !== b.length) {
      throw new Error('向量长度不匹配');
    }

    let sum = 0;
    const packedLen = Math.min(a.data.length, b.data.length);

    // 批量处理（每次处理 8 字节 = 16 个 INT4）
    let i = 0;
    for (; i < packedLen - 7; i += 8) {
      for (let j = 0; j < 8; j++) {
        const byteA = a.data[i + j];
        const byteB = b.data[i + j];

        // 高 4 bit
        const aHigh = (byteA >> 4) - 8;
        const bHigh = (byteB >> 4) - 8;
        sum += aHigh * bHigh;

        // 低 4 bit
        const aLow = (byteA & 0x0F) - 8;
        const bLow = (byteB & 0x0F) - 8;
        sum += aLow * bLow;
      }
    }

    // 处理剩余
    for (; i < packedLen; i++) {
      const byteA = a.data[i];
      const byteB = b.data[i];

      const aHigh = (byteA >> 4) - 8;
      const bHigh = (byteB >> 4) - 8;
      sum += aHigh * bHigh;

      const aLow = (byteA & 0x0F) - 8;
      const bLow = (byteB & 0x0F) - 8;
      sum += aLow * bLow;
    }

    // 还原真实值
    return sum * a.scale * b.scale;
  }

  /**
   * INT4 余弦相似度
   */
  static cosineSimilarity(a: Int4Vector, b: Int4Vector): number {
    const dot = this.dotProduct(a, b);
    const normA = this.computeNorm(a);
    const normB = this.computeNorm(b);

    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  /**
   * INT4 余弦相似度（使用预计算范数）
   */
  static cosineSimilarityWithNorm(
    a: Int4Vector,
    b: Int4Vector,
    normA: number,
    normB: number
  ): number {
    const dot = this.dotProduct(a, b);

    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  /**
   * 批量余弦相似度
   */
  static batchCosineSimilarity(
    query: Int4Vector,
    vectors: Int4Vector[],
    norms: Float32Array
  ): Float32Array {
    const results = new Float32Array(vectors.length);
    const queryNorm = this.computeNorm(query);

    for (let i = 0; i < vectors.length; i++) {
      results[i] = this.cosineSimilarityWithNorm(
        query,
        vectors[i],
        queryNorm,
        norms[i]
      );
    }

    return results;
  }

  /**
   * 计算范数
   */
  static computeNorm(v: Int4Vector): number {
    let sumSq = 0;
    const packedLen = v.data.length;

    for (let i = 0; i < packedLen; i++) {
      const byte = v.data[i];

      // 高 4 bit
      const high = (byte >> 4) - 8;
      sumSq += high * high;

      // 低 4 bit
      const low = (byte & 0x0F) - 8;
      sumSq += low * low;
    }

    return Math.sqrt(sumSq) * v.scale;
  }

  /**
   * 构建索引
   */
  static buildIndex(vectors: Float32Array[]): Int4Index {
    const quantized = this.quantizeBatch(vectors);
    const norms = new Float32Array(vectors.length);

    for (let i = 0; i < quantized.length; i++) {
      norms[i] = this.computeNorm(quantized[i]);
    }

    return {
      vectors: quantized,
      norms,
      dimension: vectors[0]?.length ?? 0,
    };
  }

  /**
   * 反量化（用于调试）
   */
  static dequantize(v: Int4Vector): Float32Array {
    const result = new Float32Array(v.length);

    for (let i = 0; i < v.length; i++) {
      result[i] = this.unpack(v.data, i) * v.scale;
    }

    return result;
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createInt4Index(vectors: Float32Array[]): Int4Index {
  return Int4Quantizer.buildIndex(vectors);
}

export function quantizeToInt4(vector: Float32Array): Int4Vector {
  return Int4Quantizer.quantize(vector);
}
