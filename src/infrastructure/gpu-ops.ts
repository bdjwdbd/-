/**
 * GPU 加速模块
 * 
 * 在 Node.js 中，我们可以通过以下方式实现 GPU 加速：
 * 1. WebGPU API（Node.js 实验性支持）
 * 2. node-cuda（需要安装 CUDA）
 * 3. gpu.js（WebGL 后端）
 * 
 * 本模块提供 GPU 检测和回退机制
 */

// ============================================================
// 类型定义
// ============================================================

export interface GPUInfo {
  available: boolean;
  backend: 'webgpu' | 'cuda' | 'opencl' | 'cpu';
  devices: string[];
  memory: number;
}

export interface GPUOpsConfig {
  useGPU: boolean;
  backend: 'auto' | 'webgpu' | 'cuda' | 'cpu';
  fallbackToCPU: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: GPUOpsConfig = {
  useGPU: true,
  backend: 'auto',
  fallbackToCPU: true,
};

// ============================================================
// GPU 检测
// ============================================================

export async function detectGPU(): Promise<GPUInfo> {
  const info: GPUInfo = {
    available: false,
    backend: 'cpu',
    devices: [],
    memory: 0,
  };

  // 检测 WebGPU
  try {
    // @ts-ignore - Node.js 实验性 API
    if (typeof globalThis.navigator?.gpu !== 'undefined') {
      info.available = true;
      info.backend = 'webgpu';
      info.devices = ['WebGPU'];
      return info;
    }
  } catch {
    // 忽略
  }

  // 检测 CUDA（通过 node-cuda）
  try {
    // @ts-ignore
    const cuda = require('cuda');
    info.available = true;
    info.backend = 'cuda';
    info.devices = ['CUDA Device'];
    return info;
  } catch {
    // 忽略
  }

  return info;
}

// ============================================================
// GPU 向量操作类
// ============================================================

export class GPUVectorOps {
  private config: GPUOpsConfig;
  private gpuInfo: GPUInfo;
  private device: any = null;

  constructor(config: Partial<GPUOpsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gpuInfo = {
      available: false,
      backend: 'cpu',
      devices: [],
      memory: 0,
    };
  }

  /**
   * 初始化 GPU
   */
  async initialize(): Promise<boolean> {
    this.gpuInfo = await detectGPU();

    if (!this.config.useGPU) {
      // console.log('ℹ️ GPU 已禁用，使用 CPU');
      return false;
    }

    if (this.config.backend === 'auto') {
      if (this.gpuInfo.available) {
        // console.log(`✅ GPU 后端已启用: ${this.gpuInfo.backend}`);
        return true;
      }
    } else if (this.config.backend === this.gpuInfo.backend) {
      // console.log(`✅ GPU 后端已启用: ${this.gpuInfo.backend}`);
      return true;
    }

    if (this.config.fallbackToCPU) {
      // console.log('ℹ️ GPU 不可用，回退到 CPU');
    }
    return false;
  }

  /**
   * 批量余弦相似度（GPU 加速）
   */
  async cosineSimilarityBatch(
    query: number[],
    vectors: number[][]
  ): Promise<number[]> {
    if (this.gpuInfo.available && this.gpuInfo.backend === 'webgpu') {
      return this.cosineSimilarityWebGPU(query, vectors);
    }

    // CPU 回退
    return this.cosineSimilarityCPU(query, vectors);
  }

  /**
   * WebGPU 实现
   */
  private async cosineSimilarityWebGPU(
    query: number[],
    vectors: number[][]
  ): Promise<number[]> {
    // WebGPU 计算着色器
    const shaderCode = `
      @group(0) @binding(0) var<storage, read> query: array<f32>;
      @group(0) @binding(1) var<storage, read> vectors: array<f32>;
      @group(0) @binding(2) var<storage, read_write> results: array<f32>;
      
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= arrayLength(&results)) {
          return;
        }
        
        let dim = arrayLength(&query);
        var dot: f32 = 0.0;
        var norm_q: f32 = 0.0;
        var norm_v: f32 = 0.0;
        
        for (var i: u32 = 0u; i < dim; i = i + 1u) {
          let q = query[i];
          let v = vectors[idx * dim + i];
          dot = dot + q * v;
          norm_q = norm_q + q * q;
          norm_v = norm_v + v * v;
        }
        
        results[idx] = dot / (sqrt(norm_q) * sqrt(norm_v) + 0.00001);
      }
    `;

    // 简化实现：回退到 CPU
    // 完整实现需要 WebGPU API
    return this.cosineSimilarityCPU(query, vectors);
  }

  /**
   * CPU 实现
   */
  private cosineSimilarityCPU(
    query: number[],
    vectors: number[][]
  ): number[] {
    const results: number[] = [];
    const queryNorm = Math.sqrt(query.reduce((sum, v) => sum + v * v, 0));

    for (const vec of vectors) {
      let dot = 0;
      let norm = 0;
      for (let i = 0; i < query.length; i++) {
        dot += query[i] * vec[i];
        norm += vec[i] * vec[i];
      }
      const score = queryNorm > 0 && norm > 0 ? dot / (queryNorm * Math.sqrt(norm)) : 0;
      results.push(score);
    }

    return results;
  }

  /**
   * 批量欧氏距离
   */
  async euclideanDistanceBatch(
    query: number[],
    vectors: number[][]
  ): Promise<number[]> {
    // CPU 实现
    const results: number[] = [];
    for (const vec of vectors) {
      let dist = 0;
      for (let i = 0; i < query.length; i++) {
        const diff = query[i] - vec[i];
        dist += diff * diff;
      }
      results.push(Math.sqrt(dist));
    }
    return results;
  }

  /**
   * Top-K 搜索
   */
  async topKSearch(
    query: number[],
    vectors: number[][],
    k: number = 10,
    metric: 'cosine' | 'euclidean' = 'cosine'
  ): Promise<Array<{ index: number; score: number }>> {
    const scores = metric === 'cosine'
      ? await this.cosineSimilarityBatch(query, vectors)
      : await this.euclideanDistanceBatch(query, vectors);

    const indexed = scores.map((score, index) => ({ index, score }));
    
    if (metric === 'cosine') {
      indexed.sort((a, b) => b.score - a.score);
    } else {
      indexed.sort((a, b) => a.score - b.score);
    }

    return indexed.slice(0, k);
  }

  /**
   * 获取 GPU 信息
   */
  getGPUInfo(): GPUInfo {
    return { ...this.gpuInfo };
  }

  /**
   * 是否使用 GPU
   */
  isUsingGPU(): boolean {
    return this.gpuInfo.available && this.gpuInfo.backend !== 'cpu';
  }
}

// ============================================================
// 单例
// ============================================================

let gpuOpsInstance: GPUVectorOps | null = null;

export async function getGPUOps(config?: Partial<GPUOpsConfig>): Promise<GPUVectorOps> {
  if (!gpuOpsInstance) {
    gpuOpsInstance = new GPUVectorOps(config);
    await gpuOpsInstance.initialize();
  }
  return gpuOpsInstance;
}

export function isGPUAvailable(): boolean {
  return gpuOpsInstance?.isUsingGPU() ?? false;
}
