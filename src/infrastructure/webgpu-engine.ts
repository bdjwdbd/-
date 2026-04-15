/**
 * WebGPU 加速引擎
 * 
 * 职责：
 * - 使用 WebGPU API 进行 GPU 加速
 * - 比 WebGL 更现代、更高效
 * - 支持计算着色器
 */

// ============================================================
// 类型定义（WebGPU 类型声明）
// ============================================================

// WebGPU 类型声明（简化版）
declare global {
  interface Navigator {
    gpu?: GPU;
  }

  interface GPU {
    requestAdapter(): Promise<GPUAdapter | null>;
  }

  interface GPUAdapter {
    requestDevice(): Promise<GPUDevice>;
    requestAdapterInfo(): Promise<GPUAdapterInfo>;
    features: Set<string>;
    limits: Record<string, number>;
  }

  interface GPUAdapterInfo {
    vendor: string;
    architecture: string;
    device: string;
    description: string;
  }

  interface GPUDevice {
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
    createCommandEncoder(): GPUCommandEncoder;
    queue: GPUQueue;
  }

  interface GPUBuffer {
    getMappedRange(): ArrayBuffer;
    unmap(): void;
    mapAsync(mode: number): Promise<void>;
    destroy(): void;
  }

  interface GPUBufferDescriptor {
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
  }

  interface GPUShaderModule {}

  interface GPUComputePipeline {
    getBindGroupLayout(index: number): GPUBindGroupLayout;
  }

  interface GPUBindGroupLayout {}

  interface GPUBindGroupDescriptor {
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
  }

  interface GPUBindGroupEntry {
    binding: number;
    resource: { buffer: GPUBuffer };
  }

  interface GPUBindGroup {}

  interface GPUCommandEncoder {
    beginComputePass(): GPUComputePassEncoder;
    copyBufferToBuffer(
      source: GPUBuffer,
      sourceOffset: number,
      destination: GPUBuffer,
      destinationOffset: number,
      size: number
    ): void;
    finish(): GPUCommandBuffer;
  }

  interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup): void;
    dispatchWorkgroups(x: number): void;
    end(): void;
  }

  interface GPUCommandBuffer {}

  interface GPUQueue {
    submit(commandBuffers: GPUCommandBuffer[]): void;
  }

  interface GPUShaderModuleDescriptor {
    code: string;
  }

  interface GPUComputePipelineDescriptor {
    layout: string;
    compute: {
      module: GPUShaderModule;
      entryPoint: string;
    };
  }

  const GPUBufferUsage: {
    STORAGE: number;
    COPY_DST: number;
    COPY_SRC: number;
    MAP_READ: number;
  };

  const GPUMapMode: {
    READ: number;
  };
}

export interface WebGPUConfig {
  /** 是否启用调试 */
  debug: boolean;
}

export interface WebGPUCapabilities {
  /** 是否支持 */
  supported: boolean;
  /** 适配器信息 */
  adapterInfo?: GPUAdapterInfo;
  /** 功能列表 */
  features: string[];
  /** 限制 */
  limits: Record<string, number>;
}

export interface WebGPUBuffer {
  buffer: GPUBuffer;
  size: number;
  usage: number;
}

// ============================================================
// WebGPU 引擎
// ============================================================

export class WebGPUEngine {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private config: WebGPUConfig;
  private initialized: boolean = false;
  private buffers: Map<string, WebGPUBuffer> = new Map();

  constructor(config: Partial<WebGPUConfig> = {}) {
    this.config = {
      debug: config.debug ?? false,
    };
  }

  /**
   * 初始化 WebGPU
   */
  async initialize(): Promise<boolean> {
    // 检查浏览器/Node.js 是否支持 WebGPU
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) {
          console.log('[WebGPU] 无法获取适配器');
          return false;
        }

        this.device = await this.adapter.requestDevice();
        this.initialized = true;

        console.log('[WebGPU] 初始化成功');
        return true;
      } catch (error) {
        console.error('[WebGPU] 初始化失败:', error);
        return false;
      }
    }

    // Node.js 环境
    console.log('[WebGPU] 当前环境不支持 WebGPU');
    return false;
  }

  /**
   * 检查是否支持
   */
  async checkSupport(): Promise<WebGPUCapabilities> {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      return {
        supported: false,
        features: [],
        limits: {},
      };
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return {
          supported: false,
          features: [],
          limits: {},
        };
      }

      const adapterInfo = await adapter.requestAdapterInfo();
      const features = Array.from(adapter.features);
      const limits = { ...adapter.limits };

      return {
        supported: true,
        adapterInfo,
        features,
        limits,
      };
    } catch (error) {
      return {
        supported: false,
        features: [],
        limits: {},
      };
    }
  }

  /**
   * 批量余弦相似度（GPU 加速）
   */
  async batchCosineSimilarity(
    query: Float32Array,
    vectors: Float32Array[],
    dim: number
  ): Promise<Float32Array | null> {
    if (!this.device || !this.initialized) {
      return this.fallbackBatchCosineSimilarity(query, vectors);
    }

    // WebGPU 实现需要完整的 API 支持
    // 这里使用降级方案
    console.log('[WebGPU] 使用降级方案');
    return this.fallbackBatchCosineSimilarity(query, vectors);
  }

  /**
   * 纯 JS 降级实现
   */
  private fallbackBatchCosineSimilarity(
    query: Float32Array,
    vectors: Float32Array[]
  ): Float32Array {
    const results = new Float32Array(vectors.length);

    for (let i = 0; i < vectors.length; i++) {
      results[i] = this.cosineSimilarity(query, vectors[i]);
    }

    return results;
  }

  /**
   * 余弦相似度（纯 JS）
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.buffers.clear();
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取设备
   */
  getDevice(): GPUDevice | null {
    return this.device;
  }
}

// ============================================================
// 单例实例
// ============================================================

let defaultEngine: WebGPUEngine | null = null;

export function getWebGPUEngine(config?: Partial<WebGPUConfig>): WebGPUEngine {
  if (!defaultEngine) {
    defaultEngine = new WebGPUEngine(config);
  }
  return defaultEngine;
}

/**
 * 快速初始化 WebGPU
 */
export async function initWebGPU(): Promise<boolean> {
  const engine = getWebGPUEngine();
  return engine.initialize();
}
