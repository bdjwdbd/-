/**
 * 原生模块 TypeScript 包装层
 * 
 * 提供自动降级机制：
 * Native (C++) → WASM → TypeScript
 */

import type { CPUInfo } from './cpu-optimizer';

// ============================================================
// 类型定义
// ============================================================

export interface SIMDCapabilities {
  avx512f: boolean;
  avx512vl: boolean;
  avx512bw: boolean;
  avx512dq: boolean;
  avx512vnni: boolean;
  avx2: boolean;
  sse42: boolean;
}

export interface MemoryInfo {
  pageSize: number;
  hugePageSize: number;
  hugePagesAvailable: boolean;
  totalMemory: number;
  freeMemory: number;
}

export interface SearchResult {
  index: number;
  score: number;
}

export interface NativeModules {
  simd: {
    cosineSimilarity(a: Float32Array, b: Float32Array): number;
    cosineSimilarityBatch(query: Float32Array, vectors: Float32Array[]): Float32Array;
    getCapabilities(): SIMDCapabilities;
  };
  vnni: {
    dotProductInt8(a: Int8Array, b: Int8Array): number;
    twoStageSearch(
      query: Float32Array,
      vectors: Float32Array[],
      topK: number,
      rerankK?: number
    ): SearchResult[];
  };
  vectorOps: {
    topKSearch(
      query: Float32Array,
      vectors: Float32Array[],
      k: number
    ): SearchResult[];
    normalize(vec: Float32Array): Float32Array;
  };
  memory: {
    getMemoryInfo(): MemoryInfo;
    alignedAlloc(size: number, alignment?: number): Buffer;
    hugePageAlloc(size: number): Buffer;
    poolAlloc(size: number): Buffer;
    getPoolStats(): { totalAllocated: number; maxPoolSize: number };
  };
}

// ============================================================
// 原生模块加载器
// ============================================================

export class NativeLoader {
  private modules: NativeModules | null = null;
  private backend: 'native' | 'wasm' | 'js' = 'js';
  private simdCaps: SIMDCapabilities | null = null;

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    // 1. 尝试加载原生模块
    try {
      this.modules = await this.loadNativeModules();
      this.backend = 'native';
      console.log('✅ 原生模块加载成功');
      return;
    } catch (error) {
      console.log('ℹ️ 原生模块不可用，尝试 WASM');
    }

    // 2. 尝试加载 WASM 模块
    try {
      await this.loadWasmModules();
      this.backend = 'wasm';
      console.log('✅ WASM 模块加载成功');
      return;
    } catch (error) {
      console.log('ℹ️ WASM 模块不可用，使用 TypeScript 实现');
    }

    // 3. 使用 TypeScript 实现
    this.backend = 'js';
    console.log('ℹ️ 使用 TypeScript 实现');
  }

  /**
   * 加载原生模块
   */
  private async loadNativeModules(): Promise<NativeModules> {
    const simd = require('../build/Release/simd.node');
    const vnni = require('../build/Release/vnni.node');
    const vectorOps = require('../build/Release/vector_ops.node');
    const memory = require('../build/Release/memory.node');

    return { simd, vnni, vectorOps, memory };
  }

  /**
   * 加载 WASM 模块
   */
  private async loadWasmModules(): Promise<void> {
    // 尝试加载 WASM 模块
    try {
      // 动态导入 WASM 模块
      const wasmPath = require('path').join(__dirname, '../../native/build/wasm/simd.js');
      const createModule = require(wasmPath);
      
      const wasmModule = await createModule();
      
      // 包装 WASM 函数
      const cwrap = wasmModule.cwrap;
      
      const cosineSimilarityWasm = cwrap('cosine_similarity_wasm', 'number', ['number', 'number', 'number']);
      const normalizeWasm = cwrap('normalize_wasm', null, ['number', 'number']);
      const dotProductWasm = cwrap('dot_product_wasm', 'number', ['number', 'number', 'number']);
      
      // 创建模拟原生模块接口
      this.modules = {
        simd: {
          cosineSimilarity: (a: Float32Array, b: Float32Array): number => {
            const ptrA = wasmModule._malloc(a.byteLength);
            const ptrB = wasmModule._malloc(b.byteLength);
            wasmModule.HEAPF32.set(a, ptrA / 4);
            wasmModule.HEAPF32.set(b, ptrB / 4);
            const result = cosineSimilarityWasm(ptrA, ptrB, a.length);
            wasmModule._free(ptrA);
            wasmModule._free(ptrB);
            return result;
          },
          cosineSimilarityBatch: (): Float32Array => {
            throw new Error('WASM batch not implemented');
          },
          getCapabilities: (): SIMDCapabilities => ({
            avx512f: false,
            avx512vl: false,
            avx512bw: false,
            avx512dq: false,
            avx512vnni: false,
            avx2: false,
            sse42: false,
          }),
        },
        vnni: {
          dotProductInt8: (): number => {
            throw new Error('WASM VNNI not implemented');
          },
          twoStageSearch: (): never[] => [],
        },
        vectorOps: {
          topKSearch: (): never[] => [],
          normalize: (vec: Float32Array): Float32Array => {
            const ptr = wasmModule._malloc(vec.byteLength);
            wasmModule.HEAPF32.set(vec, ptr / 4);
            normalizeWasm(ptr, vec.length);
            const result = new Float32Array(wasmModule.HEAPF32.buffer, ptr, vec.length).slice();
            wasmModule._free(ptr);
            return result;
          },
        },
        memory: {
          getMemoryInfo: (): MemoryInfo => ({
            pageSize: 4096,
            hugePageSize: 2 * 1024 * 1024,
            hugePagesAvailable: false,
            totalMemory: 0,
            freeMemory: 0,
          }),
          alignedAlloc: (): Buffer => Buffer.alloc(0),
          hugePageAlloc: (): Buffer => Buffer.alloc(0),
          poolAlloc: (): Buffer => Buffer.alloc(0),
          getPoolStats: () => ({ totalAllocated: 0, maxPoolSize: 0 }),
        },
      };
    } catch (error) {
      throw new Error(`WASM loading failed: ${error}`);
    }
  }

  /**
   * 获取当前后端
   */
  getBackend(): 'native' | 'wasm' | 'js' {
    return this.backend;
  }

  /**
   * 获取原生模块
   */
  getModules(): NativeModules | null {
    return this.modules;
  }

  /**
   * 是否使用原生加速
   */
  isNative(): boolean {
    return this.backend === 'native';
  }

  /**
   * 获取 SIMD 能力
   */
  getSIMDCapabilities(): SIMDCapabilities | null {
    if (this.modules?.simd) {
      return this.modules.simd.getCapabilities();
    }
    return null;
  }
}

// ============================================================
// 自动降级加速器
// ============================================================

export class Accelerator {
  private loader: NativeLoader;
  private initialized: boolean = false;

  constructor() {
    this.loader = new NativeLoader();
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loader.initialize();
    this.initialized = true;
  }

  /**
   * 余弦相似度
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const modules = this.loader.getModules();
    
    if (modules?.simd) {
      return modules.simd.cosineSimilarity(a, b);
    }
    
    // TypeScript 回退
    return this.jsCosineSimilarity(a, b);
  }

  /**
   * 批量余弦相似度
   */
  cosineSimilarityBatch(query: Float32Array, vectors: Float32Array[]): Float32Array {
    const modules = this.loader.getModules();
    
    if (modules?.simd) {
      return modules.simd.cosineSimilarityBatch(query, vectors);
    }
    
    // TypeScript 回退
    const results = new Float32Array(vectors.length);
    for (let i = 0; i < vectors.length; i++) {
      results[i] = this.jsCosineSimilarity(query, vectors[i]);
    }
    return results;
  }

  /**
   * Top-K 搜索
   */
  topKSearch(query: Float32Array, vectors: Float32Array[], k: number): SearchResult[] {
    const modules = this.loader.getModules();
    
    if (modules?.vectorOps) {
      return modules.vectorOps.topKSearch(query, vectors, k);
    }
    
    if (modules?.vnni) {
      return modules.vnni.twoStageSearch(query, vectors, k, Math.min(k * 10, vectors.length));
    }
    
    // TypeScript 回退
    return this.jsTopKSearch(query, vectors, k);
  }

  /**
   * 两阶段搜索
   */
  twoStageSearch(
    query: Float32Array,
    vectors: Float32Array[],
    topK: number,
    rerankK: number = 100
  ): SearchResult[] {
    const modules = this.loader.getModules();
    
    if (modules?.vnni) {
      return modules.vnni.twoStageSearch(query, vectors, topK, rerankK);
    }
    
    // TypeScript 回退
    return this.jsTopKSearch(query, vectors, topK);
  }

  /**
   * 向量归一化
   */
  normalize(vec: Float32Array): Float32Array {
    const modules = this.loader.getModules();
    
    if (modules?.vectorOps) {
      return modules.vectorOps.normalize(vec);
    }
    
    // TypeScript 回退
    const result = new Float32Array(vec.length);
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        result[i] = vec[i] / norm;
      }
    }
    return result;
  }

  /**
   * 获取内存信息
   */
  getMemoryInfo(): MemoryInfo {
    const modules = this.loader.getModules();
    
    if (modules?.memory) {
      return modules.memory.getMemoryInfo();
    }
    
    // TypeScript 回退
    return {
      pageSize: 4096,
      hugePageSize: 2 * 1024 * 1024,
      hugePagesAvailable: false,
      totalMemory: 0,
      freeMemory: 0,
    };
  }

  // ============================================================
  // TypeScript 回退实现
  // ============================================================

  private jsCosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  }

  private jsTopKSearch(query: Float32Array, vectors: Float32Array[], k: number): SearchResult[] {
    const scores: SearchResult[] = [];
    for (let i = 0; i < vectors.length; i++) {
      scores.push({ index: i, score: this.jsCosineSimilarity(query, vectors[i]) });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, k);
  }
}

// ============================================================
// 单例
// ============================================================

let acceleratorInstance: Accelerator | null = null;

export async function getAccelerator(): Promise<Accelerator> {
  if (!acceleratorInstance) {
    acceleratorInstance = new Accelerator();
    await acceleratorInstance.initialize();
  }
  return acceleratorInstance;
}
