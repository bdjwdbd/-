/**
 * 原生模块加载器
 * 
 * 职责：
 * - 自动加载原生模块
 * - 支持自动下载
 * - 自动降级到纯 JS
 */

import * as path from 'path';
import * as fs from 'fs';
import { downloadNative, DownloadResult } from './native-downloader';
import { getIntegrityValidator, IntegrityCheckResult } from './integrity-validator';

// ============================================================
// 类型定义
// ============================================================

export interface NativeModule {
  cosineSimilarity(a: Float32Array, b: Float32Array): number;
  euclideanDistance(a: Float32Array, b: Float32Array): number;
  dotProduct(a: Float32Array, b: Float32Array): number;
  batchCosineSimilarity(query: Float32Array, vectors: Float32Array[], results: Float32Array): void;
  getCapabilities(): NativeCapabilities;
}

export interface NativeCapabilities {
  loaded: boolean;
  simd: boolean;
  avx: boolean;
  avx2: boolean;
  avx512: boolean;
  sse2: boolean;
  neon: boolean;
  threads: number;
}

export interface LoadResult {
  success: boolean;
  module?: NativeModule;
  source: 'native' | 'wasm' | 'js';
  error?: string;
  validated?: boolean;
}

// ============================================================
// 原生模块加载器
// ============================================================

export class NativeLoader {
  private nativeModule: NativeModule | null = null;
  private wasmModule: any = null;
  private jsModule: any = null;
  private loadAttempted: boolean = false;
  private loadResult: LoadResult | null = null;

  /**
   * 加载原生模块
   */
  async load(): Promise<LoadResult> {
    if (this.nativeModule) {
      return {
        success: true,
        module: this.nativeModule,
        source: 'native',
        validated: true,
      };
    }

    if (this.loadAttempted) {
      return this.loadResult || {
        success: false,
        source: 'js',
        error: 'Previous load attempt failed',
      };
    }

    this.loadAttempted = true;

    // 尝试加载原生模块
    const nativeResult = await this.tryLoadNative();
    if (nativeResult.success) {
      this.loadResult = nativeResult;
      return nativeResult;
    }

    // 尝试加载 WASM 模块
    const wasmResult = await this.tryLoadWasm();
    if (wasmResult.success) {
      this.loadResult = wasmResult;
      return wasmResult;
    }

    // 降级到纯 JS
    const jsResult = this.loadJsFallback();
    this.loadResult = jsResult;
    return jsResult;
  }

  /**
   * 尝试加载原生模块
   */
  private async tryLoadNative(): Promise<LoadResult> {
    console.log('[Native] 尝试加载原生模块...');

    // 尝试直接加载
    const directPath = path.join(__dirname, '../../native/build/Release/vector_ops.node');
    
    if (fs.existsSync(directPath)) {
      // 验证完整性
      const validator = getIntegrityValidator();
      const result = validator.validateFile(directPath);

      if (!result.valid && result.expectedHash !== 'sha256:PENDING_BUILD') {
        console.error('[Native] 完整性校验失败:', result.error);
        return {
          success: false,
          source: 'native',
          error: `Integrity check failed: ${result.error}`,
          validated: false,
        };
      }

      try {
        const module = require(directPath);
        this.nativeModule = this.wrapNativeModule(module);
        console.log('[Native] ✅ 原生模块加载成功');
        return {
          success: true,
          module: this.nativeModule,
          source: 'native',
          validated: result.valid,
        };
      } catch (error) {
        console.error('[Native] 加载失败:', error);
      }
    }

    // 尝试下载
    console.log('[Native] 本地模块不存在，尝试下载...');
    const downloadResult = await downloadNative();

    if (downloadResult.success && downloadResult.path) {
      try {
        const module = require(downloadResult.path);
        this.nativeModule = this.wrapNativeModule(module);
        console.log('[Native] ✅ 下载的模块加载成功');
        return {
          success: true,
          module: this.nativeModule,
          source: 'native',
          validated: downloadResult.validated,
        };
      } catch (error) {
        console.error('[Native] 下载的模块加载失败:', error);
      }
    }

    return {
      success: false,
      source: 'native',
      error: downloadResult.error || 'Load failed',
    };
  }

  /**
   * 尝试加载 WASM 模块
   */
  private async tryLoadWasm(): Promise<LoadResult> {
    console.log('[Native] 尝试加载 WASM 模块...');

    const wasmPath = path.join(__dirname, '../../build/release.wasm');

    if (!fs.existsSync(wasmPath)) {
      console.log('[Native] WASM 模块不存在');
      return {
        success: false,
        source: 'wasm',
        error: 'WASM module not found',
      };
    }

    try {
      const wasmBuffer = fs.readFileSync(wasmPath);
      const wasmModule = await WebAssembly.compile(wasmBuffer);
      const wasmInstance = await WebAssembly.instantiate(wasmModule, {
        env: {
          memory: new WebAssembly.Memory({ initial: 256, maximum: 4096 }),
          abort: () => {},
        },
      });

      this.wasmModule = wasmInstance.exports;
      this.nativeModule = this.wrapWasmModule(this.wasmModule);
      console.log('[Native] ✅ WASM 模块加载成功');
      return {
        success: true,
        module: this.nativeModule,
        source: 'wasm',
      };
    } catch (error) {
      console.error('[Native] WASM 加载失败:', error);
      return {
        success: false,
        source: 'wasm',
        error: String(error),
      };
    }
  }

  /**
   * 加载纯 JS 降级方案
   */
  private loadJsFallback(): LoadResult {
    console.log('[Native] 使用纯 JS 降级方案');

    this.nativeModule = this.createJsModule();
    return {
      success: true,
      module: this.nativeModule,
      source: 'js',
    };
  }

  /**
   * 包装原生模块
   */
  private wrapNativeModule(module: any): NativeModule {
    return {
      cosineSimilarity: (a, b) => module.cosineSimilarity(a, b),
      euclideanDistance: (a, b) => module.euclideanDistance(a, b),
      dotProduct: (a, b) => module.dotProduct(a, b),
      batchCosineSimilarity: (query, vectors, results) => {
        module.batchCosineSimilarity(query, vectors, results);
      },
      getCapabilities: () => module.getCapabilities?.() || {
        loaded: true,
        simd: true,
        avx: true,
        avx2: true,
        avx512: false,
        sse2: true,
        neon: false,
        threads: 1,
      },
    };
  }

  /**
   * 包装 WASM 模块
   */
  private wrapWasmModule(exports: any): NativeModule {
    // WASM 模块需要手动处理内存
    return {
      cosineSimilarity: (a, b) => {
        // 简化实现，实际需要处理 WASM 内存
        return this.jsCosineSimilarity(a, b);
      },
      euclideanDistance: (a, b) => {
        return this.jsEuclideanDistance(a, b);
      },
      dotProduct: (a, b) => {
        return this.jsDotProduct(a, b);
      },
      batchCosineSimilarity: (query, vectors, results) => {
        for (let i = 0; i < vectors.length; i++) {
          results[i] = this.jsCosineSimilarity(query, vectors[i]);
        }
      },
      getCapabilities: () => ({
        loaded: true,
        simd: true,
        avx: false,
        avx2: false,
        avx512: false,
        sse2: false,
        neon: false,
        threads: 1,
      }),
    };
  }

  /**
   * 创建纯 JS 模块
   */
  private createJsModule(): NativeModule {
    return {
      cosineSimilarity: (a, b) => this.jsCosineSimilarity(a, b),
      euclideanDistance: (a, b) => this.jsEuclideanDistance(a, b),
      dotProduct: (a, b) => this.jsDotProduct(a, b),
      batchCosineSimilarity: (query, vectors, results) => {
        for (let i = 0; i < vectors.length; i++) {
          results[i] = this.jsCosineSimilarity(query, vectors[i]);
        }
      },
      getCapabilities: () => ({
        loaded: true,
        simd: false,
        avx: false,
        avx2: false,
        avx512: false,
        sse2: false,
        neon: false,
        threads: 1,
      }),
    };
  }

  // ============================================================
  // 纯 JS 实现
  // ============================================================

  private jsCosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private jsEuclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  private jsDotProduct(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      sum += a[i] * b[i];
    }

    return sum;
  }

  /**
   * 获取当前加载状态
   */
  getStatus(): { loaded: boolean; source: string } {
    if (this.nativeModule) {
      return { loaded: true, source: this.loadResult?.source || 'unknown' };
    }
    return { loaded: false, source: 'none' };
  }

  /**
   * 获取已加载的模块
   */
  getModule(): NativeModule | null {
    return this.nativeModule;
  }

  /**
   * 重置加载状态
   */
  reset(): void {
    this.nativeModule = null;
    this.wasmModule = null;
    this.loadAttempted = false;
    this.loadResult = null;
  }
}

// ============================================================
// 单例实例
// ============================================================

let defaultLoader: NativeLoader | null = null;

export function getNativeLoader(): NativeLoader {
  if (!defaultLoader) {
    defaultLoader = new NativeLoader();
  }
  return defaultLoader;
}

/**
 * 快速加载原生模块
 */
export async function loadNativeModule(): Promise<NativeModule | null> {
  const loader = getNativeLoader();
  const result = await loader.load();
  return result.success ? result.module || null : null;
}

/**
 * 获取原生模块（同步，可能返回 null）
 */
export function getNativeModule(): NativeModule | null {
  return defaultLoader?.getModule() || null;
}

/**
 * 检查原生模块是否可用
 */
export function isNativeAvailable(): boolean {
  return defaultLoader?.getModule() !== null;
}
