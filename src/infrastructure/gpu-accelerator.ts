/**
 * GPU 加速模块
 * 
 * 使用 gpu.js 实现 WebGL 加速的向量计算
 * 无需 CUDA，在浏览器和 Node.js 中均可使用
 * 
 * 注意：在无 WebGL 环境时自动降级到 CPU 实现
 */

// gpu.js 是 optional dependency，可能未安装
// 使用动态导入和类型声明

interface GPUKernel {
  setOutput: (output: number[]) => GPUKernel;
  setPrecision: (precision: 'single' | 'unsigned') => GPUKernel;
  setGraphical: (graphical: boolean) => GPUKernel;
}

interface GPUConstructor {
  new (options?: { mode?: 'gpu' | 'cpu' }): GPUInstance;
}

interface GPUInstance {
  createKernel: (kernel: Function) => GPUKernel;
  destroy: () => void;
}

type GPUType = GPUInstance;

// ============================================================
// 类型定义
// ============================================================

export interface GPUConfig {
  mode?: 'gpu' | 'cpu';
  precision?: 'single' | 'unsigned';
  /** 分块大小，默认 1024 */
  chunkSize?: number;
  /** 是否启用分块计算，默认 true */
  enableChunking?: boolean;
}

export interface GPUSearchResult {
  index: number;
  score: number;
}

// ============================================================
// 分块计算配置
// ============================================================

const DEFAULT_CHUNK_SIZE = 1024;
const MIN_CHUNK_SIZE = 64;
const MAX_CHUNK_SIZE = 4096;

// ============================================================
// GPU 可用性检测
// ============================================================

let GPU: GPUConstructor | null = null;
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
  private gpu: GPUInstance | null = null;
  private config: GPUConfig;
  private kernels: Map<string, unknown> = new Map();
  private useCPU: boolean = false;
  private chunkSize: number;
  private enableChunking: boolean;

  constructor(config: GPUConfig = {}) {
    this.config = { mode: 'gpu', precision: 'single', ...config };
    this.chunkSize = Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, config.chunkSize || DEFAULT_CHUNK_SIZE));
    this.enableChunking = config.enableChunking !== false;
    
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
      // 定义 kernel 上下文类型
      interface KernelContext {
        thread: { x: number; y: number; z: number };
      }

      // 余弦相似度内核
      this.kernels.set('cosineSimilarity', this.gpu!.createKernel(function(
        this: KernelContext,
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
      this.kernels.set('euclideanDistance', this.gpu!.createKernel(function(
        this: KernelContext,
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
      this.kernels.set('dotProduct', this.gpu!.createKernel(function(
        this: KernelContext,
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
    // CPU 实现的余弦相似度（分块优化）
    this.kernels.set('cosineSimilarity', (query: number[], vectors: number[][], dim: number) => {
      const results: number[] = new Array(vectors.length);
      const normQ = Math.sqrt(query.reduce((sum, v) => sum + v * v, 0));
      
      // 分块处理
      if (this.enableChunking && vectors.length > this.chunkSize) {
        for (let start = 0; start < vectors.length; start += this.chunkSize) {
          const end = Math.min(start + this.chunkSize, vectors.length);
          for (let i = start; i < end; i++) {
            const vec = vectors[i];
            let dot = 0;
            let normV = 0;
            for (let j = 0; j < dim; j++) {
              dot += query[j] * vec[j];
              normV += vec[j] * vec[j];
            }
            results[i] = dot / (normQ * Math.sqrt(normV));
          }
        }
      } else {
        // 小批量直接处理
        for (let i = 0; i < vectors.length; i++) {
          const vec = vectors[i];
          let dot = 0;
          let normV = 0;
          for (let j = 0; j < dim; j++) {
            dot += query[j] * vec[j];
            normV += vec[j] * vec[j];
          }
          results[i] = dot / (normQ * Math.sqrt(normV));
        }
      }
      
      return results;
    });

    // CPU 实现的欧氏距离（分块优化）
    this.kernels.set('euclideanDistance', (query: number[], vectors: number[][], dim: number) => {
      const results: number[] = new Array(vectors.length);
      
      if (this.enableChunking && vectors.length > this.chunkSize) {
        for (let start = 0; start < vectors.length; start += this.chunkSize) {
          const end = Math.min(start + this.chunkSize, vectors.length);
          for (let i = start; i < end; i++) {
            const vec = vectors[i];
            let sum = 0;
            for (let j = 0; j < dim; j++) {
              const diff = query[j] - vec[j];
              sum += diff * diff;
            }
            results[i] = Math.sqrt(sum);
          }
        }
      } else {
        for (let i = 0; i < vectors.length; i++) {
          const vec = vectors[i];
          let sum = 0;
          for (let j = 0; j < dim; j++) {
            const diff = query[j] - vec[j];
            sum += diff * diff;
          }
          results[i] = Math.sqrt(sum);
        }
      }
      
      return results;
    });

    // CPU 实现的点积（分块优化）
    this.kernels.set('dotProduct', (query: number[], vectors: number[][], dim: number) => {
      const results: number[] = new Array(vectors.length);
      
      if (this.enableChunking && vectors.length > this.chunkSize) {
        for (let start = 0; start < vectors.length; start += this.chunkSize) {
          const end = Math.min(start + this.chunkSize, vectors.length);
          for (let i = start; i < end; i++) {
            const vec = vectors[i];
            let dot = 0;
            for (let j = 0; j < dim; j++) {
              dot += query[j] * vec[j];
            }
            results[i] = dot;
          }
        }
      } else {
        for (let i = 0; i < vectors.length; i++) {
          const vec = vectors[i];
          let dot = 0;
          for (let j = 0; j < dim; j++) {
            dot += query[j] * vec[j];
          }
          results[i] = dot;
        }
      }
      
      return results;
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
      return (kernel as (q: number[], v: number[][], d: number) => number[])(query, vectors, query.length);
    }
    
    // GPU 模式：调整输出大小
    const gpuKernel = kernel as GPUKernel & { (q: number[], v: number[][], d: number): number[] };
    gpuKernel.setOutput([vectors.length]);
    return gpuKernel(query, vectors, query.length);
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
      return (kernel as (q: number[], v: number[][], d: number) => number[])(query, vectors, query.length);
    }
    
    const gpuKernel = kernel as GPUKernel & { (q: number[], v: number[][], d: number): number[] };
    gpuKernel.setOutput([vectors.length]);
    return gpuKernel(query, vectors, query.length);
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
      return (kernel as (q: number[], v: number[][], d: number) => number[])(query, vectors, query.length);
    }
    
    const gpuKernel = kernel as GPUKernel & { (q: number[], v: number[][], d: number): number[] };
    gpuKernel.setOutput([vectors.length]);
    return gpuKernel(query, vectors, query.length);
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
  getInfo(): { mode: string; available: boolean; chunkSize: number; chunking: boolean } {
    return {
      mode: this.useCPU ? 'cpu' : 'gpu',
      available: gpuAvailable && !this.useCPU,
      chunkSize: this.chunkSize,
      chunking: this.enableChunking,
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
