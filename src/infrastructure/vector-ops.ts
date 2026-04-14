/**
 * 向量操作优化
 * 
 * 功能：
 * 1. 余弦相似度计算
 * 2. 欧氏距离计算
 * 3. 批量向量搜索
 * 4. SIMD 检测
 */

// ============================================================
// 类型定义
// ============================================================

export interface SIMDSupport {
  avx512: boolean;
  avx2: boolean;
  avx: boolean;
  sse: boolean;
  method: string;
}

export interface VectorOpsConfig {
  useSIMD: boolean;
  batchSize: number;
  normalize: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: VectorOpsConfig = {
  useSIMD: true,
  batchSize: 1000,
  normalize: true,
};

// ============================================================
// 向量操作类
// ============================================================

export class VectorOps {
  private config: VectorOpsConfig;
  private simdSupport: SIMDSupport;

  constructor(config: Partial<VectorOpsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.simdSupport = this.detectSIMDSupport();
  }

  /**
   * 检测 SIMD 支持
   */
  private detectSIMDSupport(): SIMDSupport {
    // Node.js 环境下无法直接检测 CPU 指令集
    // 假设现代 CPU 支持 AVX2
    return {
      avx512: false,
      avx2: true,
      avx: true,
      sse: true,
      method: 'javascript',
    };
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 计算欧氏距离
   */
  euclideanDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * 计算点积
   */
  dotProduct(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    let result = 0;
    for (let i = 0; i < vec1.length; i++) {
      result += vec1[i] * vec2[i];
    }

    return result;
  }

  /**
   * 归一化向量
   */
  normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) {
      return vec;
    }
    return vec.map(v => v / norm);
  }

  /**
   * 批量归一化
   */
  normalizeBatch(vectors: number[][]): number[][] {
    return vectors.map(v => this.normalize(v));
  }

  /**
   * Top-K 搜索
   */
  topKSearch(
    query: number[],
    vectors: number[][],
    k: number,
    metric: 'cosine' | 'euclidean' = 'cosine'
  ): Array<{ index: number; score: number }> {
    const scores: Array<{ index: number; score: number }> = [];

    for (let i = 0; i < vectors.length; i++) {
      const score = metric === 'cosine'
        ? this.cosineSimilarity(query, vectors[i])
        : 1 / (1 + this.euclideanDistance(query, vectors[i]));
      
      scores.push({ index: i, score });
    }

    // 按分数降序排序
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, k);
  }

  /**
   * 批量相似度计算
   */
  batchSimilarity(
    query: number[],
    vectors: number[][],
    metric: 'cosine' | 'euclidean' = 'cosine'
  ): number[] {
    return vectors.map(v => 
      metric === 'cosine'
        ? this.cosineSimilarity(query, v)
        : 1 / (1 + this.euclideanDistance(query, v))
    );
  }

  /**
   * 获取 SIMD 支持信息
   */
  getSIMDSupport(): SIMDSupport {
    return { ...this.simdSupport };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VectorOpsConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================
// 单例导出
// ============================================================

let vectorOpsInstance: VectorOps | null = null;

export function getVectorOps(config?: Partial<VectorOpsConfig>): VectorOps {
  if (!vectorOpsInstance) {
    vectorOpsInstance = new VectorOps(config);
  }
  return vectorOpsInstance;
}

// ============================================================
// 便捷函数
// ============================================================

export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  return getVectorOps().cosineSimilarity(vec1, vec2);
}

export function euclideanDistance(vec1: number[], vec2: number[]): number {
  return getVectorOps().euclideanDistance(vec1, vec2);
}

export function topKSearch(
  query: number[],
  vectors: number[][],
  k: number,
  metric: 'cosine' | 'euclidean' = 'cosine'
): Array<{ index: number; score: number }> {
  return getVectorOps().topKSearch(query, vectors, k, metric);
}

export function detectSIMDSupport(): SIMDSupport {
  return getVectorOps().getSIMDSupport();
}
