/**
 * GPU 加速模块
 * 
 * 使用 gpu.js 实现 WebGL 加速的向量计算
 * 无需 CUDA，在浏览器和 Node.js 中均可使用
 */

import { GPU } from 'gpu.js';

// ============================================================
// 类型定义
// ============================================================

export interface GPUConfig {
  mode?: 'gpu' | 'cpu';
  precision?: 'single' | 'unsigned';
}

export interface GPUSearchResult {
  index: number;
  score: number;
}

// ============================================================
// GPU 加速器
// ============================================================

export class GPUAccelerator {
  private gpu: GPU;
  private config: GPUConfig;
  private kernels: Map<string, Function> = new Map();

  constructor(config: GPUConfig = {}) {
    this.config = { mode: 'gpu', precision: 'single', ...config };
    this.gpu = new GPU({ mode: this.config.mode });
  }

  /**
   * 初始化内核
   */
  initialize(): void {
    // 余弦相似度内核
    this.kernels.set('cosineSimilarity', this.gpu.createKernel(function(
      query: number[],
      vectors: number[][],
      dim: number
    ): number {
      let dot = 0;
      let normQ = 0;
      let normV = 0;
      
      for (let i = 0; i < dim; i++) {
        dot += query[i] * vectors[this.thread.x][i];
        normQ += query[i] * query[i];
        normV += vectors[this.thread.x][i] * vectors[this.thread.x][i];
      }
      
      return dot / (Math.sqrt(normQ) * Math.sqrt(normV));
    }).setOutput([1000]));

    // 欧氏距离内核
    this.kernels.set('euclideanDistance', this.gpu.createKernel(function(
      query: number[],
      vectors: number[][],
      dim: number
    ): number {
      let sum = 0;
      for (let i = 0; i < dim; i++) {
        const diff = query[i] - vectors[this.thread.x][i];
        sum += diff * diff;
      }
      return Math.sqrt(sum);
    }).setOutput([1000]));

    // 点积内核
    this.kernels.set('dotProduct', this.gpu.createKernel(function(
      query: number[],
      vectors: number[][],
      dim: number
    ): number {
      let dot = 0;
      for (let i = 0; i < dim; i++) {
        dot += query[i] * vectors[this.thread.x][i];
      }
      return dot;
    }).setOutput([1000]));
  }

  /**
   * 批量余弦相似度
   */
  cosineSimilarityBatch(
    query: number[],
    vectors: number[][]
  ): number[] {
    const kernel = this.kernels.get('cosineSimilarity');
    if (!kernel) {
      throw new Error('Kernel not initialized');
    }
    
    // 调整输出大小
    (kernel as any).setOutput([vectors.length]);
    
    return kernel(query, vectors, query.length) as number[];
  }

  /**
   * 批量欧氏距离
   */
  euclideanDistanceBatch(
    query: number[],
    vectors: number[][]
  ): number[] {
    const kernel = this.kernels.get('euclideanDistance');
    if (!kernel) {
      throw new Error('Kernel not initialized');
    }
    
    (kernel as any).setOutput([vectors.length]);
    
    return kernel(query, vectors, query.length) as number[];
  }

  /**
   * 批量点积
   */
  dotProductBatch(
    query: number[],
    vectors: number[][]
  ): number[] {
    const kernel = this.kernels.get('dotProduct');
    if (!kernel) {
      throw new Error('Kernel not initialized');
    }
    
    (kernel as any).setOutput([vectors.length]);
    
    return kernel(query, vectors, query.length) as number[];
  }

  /**
   * GPU 搜索
   */
  search(
    query: number[],
    vectors: number[][],
    k: number
  ): GPUSearchResult[] {
    const scores = this.cosineSimilarityBatch(query, vectors);
    
    const results: GPUSearchResult[] = scores.map((score, index) => ({
      index,
      score,
    }));
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * 释放资源
   */
  destroy(): void {
    this.gpu.destroy();
  }

  /**
   * 获取 GPU 信息
   */
  getInfo(): { mode: string; available: boolean } {
    return {
      mode: this.config.mode || 'gpu',
      available: true,
    };
  }
}

// ============================================================
// 导出
// ============================================================

export function createGPUAccelerator(config?: GPUConfig): GPUAccelerator {
  const accelerator = new GPUAccelerator(config);
  accelerator.initialize();
  return accelerator;
}
