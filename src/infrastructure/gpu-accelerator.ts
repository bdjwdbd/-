/**
 * GPU 加速模块
 * 
 * 使用 gpu.js 实现 WebGL 加速的向量计算
 * 无需 CUDA，在浏览器和 Node.js 中均可使用
 * 
 * 注意：在无 WebGL 环境时自动降级到 CPU 实现
 */

import type { GPU as GPUType } from 'gpu.js';

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
// GPU 可用性检测
// ============================================================

let GPU: typeof GPUType | null = null;
let gpuAvailable = false;

try {
  GPU = require('gpu.js').GPU;
  gpuAvailable = true;
} catch (e) {
  // WebGL 不可用，将使用 CPU 降级模式
  gpuAvailable = false;
}

// ============================================================
// GPU 加速器
// ============================================================

export class GPUAccelerator {
  private gpu: GPUType | null = null;
  private config: GPUConfig;
  private kernels: Map<string, Function> = new Map();
  private useCPU: boolean = false;

  constructor(config: GPUConfig = {}) {
    this.config = { mode: 'gpu', precision: 'single', ...config };
    
    if (gpuAvailable && GPU && this.config.mode === 'gpu') {
      try {
        this.gpu = new GPU({ mode: 'gpu' });
      } catch (e) {
        // GPU 初始化失败，降级到 CPU
        this.useCPU = true;
        this.gpu = null;
      }
    } else {
      this.useCPU = true;
    }
  }

  /**
   * 初始化内核
   */
  initialize(): void {
    if (this.useCPU || !this.gpu) {
      // CPU 降级模式：使用纯 JS 实现
      this.initializeCPUKernels();
      return;
    }

    try {
      // GPU 模式：使用 gpu.js 内核
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
    } catch (e) {
      // GPU 内核创建失败，降级到 CPU
      this.useCPU = true;
      this.gpu = null;
      this.initializeCPUKernels();
    }
  }

  /**
   * 初始化 CPU 内核（降级模式）
   */
  private initializeCPUKernels(): void {
    // CPU 实现的余弦相似度
    this.kernels.set('cosineSimilarity', (query: number[], vectors: number[][], dim: number) => {
      return vectors.map((vec) => {
        let dot = 0;
        let normQ = 0;
        let normV = 0;
        for (let i = 0; i < dim; i++) {
          dot += query[i] * vec[i];
          normQ += query[i] * query[i];
          normV += vec[i] * vec[i];
        }
        return dot / (Math.sqrt(normQ) * Math.sqrt(normV));
      });
    });

    // CPU 实现的欧氏距离
    this.kernels.set('euclideanDistance', (query: number[], vectors: number[][], dim: number) => {
      return vectors.map((vec) => {
        let sum = 0;
        for (let i = 0; i < dim; i++) {
          const diff = query[i] - vec[i];
          sum += diff * diff;
        }
        return Math.sqrt(sum);
      });
    });

    // CPU 实现的点积
    this.kernels.set('dotProduct', (query: number[], vectors: number[][], dim: number) => {
      return vectors.map((vec) => {
        let dot = 0;
        for (let i = 0; i < dim; i++) {
          dot += query[i] * vec[i];
        }
        return dot;
      });
    });
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
    
    if (this.useCPU) {
      // CPU 模式：直接调用
      return (kernel as any)(query, vectors, query.length);
    }
    
    // GPU 模式：调整输出大小
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
    
    if (this.useCPU) {
      return (kernel as any)(query, vectors, query.length);
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
    
    if (this.useCPU) {
      return (kernel as any)(query, vectors, query.length);
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
    if (this.gpu) {
      this.gpu.destroy();
    }
    this.kernels.clear();
  }

  /**
   * 获取 GPU 信息
   */
  getInfo(): { mode: string; available: boolean } {
    return {
      mode: this.useCPU ? 'cpu' : 'gpu',
      available: gpuAvailable && !this.useCPU,
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
