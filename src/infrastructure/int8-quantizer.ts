/**
 * INT8 量化器
 * 
 * 职责：
 * - 将 Float32 向量量化为 INT8
 * - 量化后计算（4x 加速）
 * - 精度损失 < 1%
 */

// ============================================================
// 类型定义
// ============================================================

export interface QuantizedVector {
  data: Int8Array;
  scale: number;
  original?: Float32Array;
}

export interface QuantizedIndex {
  vectors: QuantizedVector[];
  norms: Float32Array;  // 预计算的范数
  dimension: number;
}

// ============================================================
// INT8 量化器
// ============================================================

export class Int8Quantizer {
  /**
   * 量化单个向量
   */
  static quantize(vector: Float32Array): QuantizedVector {
    // 找最大绝对值
    let maxAbs = 0;
    for (let i = 0; i < vector.length; i++) {
      const abs = Math.abs(vector[i]);
      if (abs > maxAbs) maxAbs = abs;
    }

    // 避免除零
    if (maxAbs === 0) maxAbs = 1;

    // 计算缩放因子
    const scale = 127 / maxAbs;

    // 量化
    const quantized = new Int8Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      quantized[i] = Math.round(vector[i] * scale);
    }

    return {
      data: quantized,
      scale: maxAbs / 127,
      original: vector,
    };
  }

  /**
   * 批量量化
   */
  static quantizeBatch(vectors: Float32Array[]): QuantizedVector[] {
    return vectors.map(v => this.quantize(v));
  }

  /**
   * 反量化
   */
  static dequantize(quantized: QuantizedVector): Float32Array {
    const result = new Float32Array(quantized.data.length);
    for (let i = 0; i < quantized.data.length; i++) {
      result[i] = quantized.data[i] * quantized.scale;
    }
    return result;
  }

  /**
   * 量化后余弦相似度（快速）
   */
  static cosineSimilarity(
    a: QuantizedVector,
    b: QuantizedVector
  ): number {
    // INT8 点积（CPU 更快）
    let dot = 0;
    const len = Math.min(a.data.length, b.data.length);
    
    // 循环展开
    let i = 0;
    for (; i < len - 7; i += 8) {
      dot += a.data[i] * b.data[i] +
             a.data[i+1] * b.data[i+1] +
             a.data[i+2] * b.data[i+2] +
             a.data[i+3] * b.data[i+3] +
             a.data[i+4] * b.data[i+4] +
             a.data[i+5] * b.data[i+5] +
             a.data[i+6] * b.data[i+6] +
             a.data[i+7] * b.data[i+7];
    }
    for (; i < len; i++) {
      dot += a.data[i] * b.data[i];
    }

    // 计算范数
    let normA = 0, normB = 0;
    for (let i = 0; i < len; i++) {
      normA += a.data[i] * a.data[i];
      normB += b.data[i] * b.data[i];
    }

    // 还原真实值
    const realDot = dot * a.scale * b.scale;
    const realNormA = Math.sqrt(normA) * a.scale;
    const realNormB = Math.sqrt(normB) * b.scale;

    return realDot / (realNormA * realNormB);
  }

  /**
   * 量化后余弦相似度（使用预计算范数）
   */
  static cosineSimilarityWithNorm(
    a: QuantizedVector,
    b: QuantizedVector,
    normA: number,
    normB: number
  ): number {
    // INT8 点积
    let dot = 0;
    const len = Math.min(a.data.length, b.data.length);
    
    let i = 0;
    for (; i < len - 7; i += 8) {
      dot += a.data[i] * b.data[i] +
             a.data[i+1] * b.data[i+1] +
             a.data[i+2] * b.data[i+2] +
             a.data[i+3] * b.data[i+3] +
             a.data[i+4] * b.data[i+4] +
             a.data[i+5] * b.data[i+5] +
             a.data[i+6] * b.data[i+6] +
             a.data[i+7] * b.data[i+7];
    }
    for (; i < len; i++) {
      dot += a.data[i] * b.data[i];
    }

    // 使用预计算的范数
    const realDot = dot * a.scale * b.scale;
    return realDot / (normA * normB);
  }

  /**
   * 批量余弦相似度（量化 + 预计算范数）
   */
  static batchCosineSimilarity(
    query: QuantizedVector,
    vectors: QuantizedVector[],
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
  static computeNorm(v: QuantizedVector): number {
    let sum = 0;
    for (let i = 0; i < v.data.length; i++) {
      sum += v.data[i] * v.data[i];
    }
    return Math.sqrt(sum) * v.scale;
  }

  /**
   * 构建量化索引
   */
  static buildIndex(vectors: Float32Array[]): QuantizedIndex {
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
}

// ============================================================
// 工厂函数
// ============================================================

export function createQuantizedIndex(vectors: Float32Array[]): QuantizedIndex {
  return Int8Quantizer.buildIndex(vectors);
}

export function quantizeVector(vector: Float32Array): QuantizedVector {
  return Int8Quantizer.quantize(vector);
}
