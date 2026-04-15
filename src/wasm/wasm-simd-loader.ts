/**
 * WASM SIMD 加载器
 * 
 * 职责：
 * - 加载 WASM 模块
 * - 管理 WASM 内存
 * - 提供向量运算接口
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 类型定义
// ============================================================

export interface WasmExports {
  cosineSimilarity: (a: number, b: number, len: number) => number;
  euclideanDistance: (a: number, b: number, len: number) => number;
  dotProduct: (a: number, b: number, len: number) => number;
  batchCosineSimilarity: (query: number, vectors: number, results: number, numVectors: number, dim: number) => void;
  batchEuclideanDistance: (query: number, vectors: number, results: number, numVectors: number, dim: number) => void;
  vectorAdd: (a: number, b: number, result: number, len: number) => void;
  vectorScale: (a: number, scale: number, result: number, len: number) => void;
  vectorNormalize: (a: number, result: number, len: number) => void;
  getModuleInfo: () => number;
  memory: WebAssembly.Memory;
}

export interface WasmInfo {
  loaded: boolean;
  simd: boolean;
  version: number;
}

export interface WasmLoadResult {
  success: boolean;
  exports?: WasmExports;
  info?: WasmInfo;
  error?: string;
}

// ============================================================
// WASM 加载器
// ============================================================

export class WasmSimdLoader {
  private exports: WasmExports | null = null;
  private memory: WebAssembly.Memory | null = null;
  private loaded: boolean = false;
  private loadAttempted: boolean = false;

  /**
   * 加载 WASM 模块
   */
  async load(): Promise<WasmLoadResult> {
    if (this.loaded && this.exports) {
      return {
        success: true,
        exports: this.exports,
        info: this.getInfo(),
      };
    }

    if (this.loadAttempted) {
      return {
        success: false,
        error: 'Previous load attempt failed',
      };
    }

    this.loadAttempted = true;

    // 尝试加载编译好的 WASM
    const wasmPaths = [
      path.join(__dirname, '../../build/release.wasm'),
      path.join(__dirname, '../../build/debug.wasm'),
    ];

    for (const wasmPath of wasmPaths) {
      if (fs.existsSync(wasmPath)) {
        const result = await this.loadWasmFile(wasmPath);
        if (result.success) {
          return result;
        }
      }
    }

    // WASM 文件不存在，使用纯 JS 实现
    console.log('[WASM] 编译的模块不存在，使用纯 JS 实现');
    return this.createJsFallback();
  }

  /**
   * 加载 WASM 文件
   */
  private async loadWasmFile(wasmPath: string): Promise<WasmLoadResult> {
    try {
      console.log(`[WASM] 加载: ${wasmPath}`);

      const wasmBuffer = fs.readFileSync(wasmPath);
      const wasmModule = await WebAssembly.compile(wasmBuffer);

      // 创建内存
      this.memory = new WebAssembly.Memory({
        initial: 256,
        maximum: 4096,
      });

      // 实例化
      const instance = await WebAssembly.instantiate(wasmModule, {
        env: {
          memory: this.memory,
          abort: (msg: number, file: number, line: number, column: number) => {
            console.error(`[WASM] Abort at ${file}:${line}:${column}: ${msg}`);
          },
        },
        Math: {
          sqrt: Math.sqrt,
        },
      });

      this.exports = instance.exports as unknown as WasmExports;
      this.loaded = true;

      console.log('[WASM] ✅ 加载成功');

      return {
        success: true,
        exports: this.exports,
        info: this.getInfo(),
      };
    } catch (error) {
      console.error(`[WASM] 加载失败: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 创建纯 JS 降级实现
   */
  private createJsFallback(): WasmLoadResult {
    console.log('[WASM] 使用纯 JS 实现');

    // 创建虚拟内存（用于 API 兼容）
    this.memory = new WebAssembly.Memory({
      initial: 256,
      maximum: 4096,
    });

    // 纯 JS 实现
    this.exports = {
      cosineSimilarity: (a, b, len) => this.jsCosineSimilarity(a, b, len),
      euclideanDistance: (a, b, len) => this.jsEuclideanDistance(a, b, len),
      dotProduct: (a, b, len) => this.jsDotProduct(a, b, len),
      batchCosineSimilarity: (query, vectors, results, numVectors, dim) => {
        this.jsBatchCosineSimilarity(query, vectors, results, numVectors, dim);
      },
      batchEuclideanDistance: (query, vectors, results, numVectors, dim) => {
        this.jsBatchEuclideanDistance(query, vectors, results, numVectors, dim);
      },
      vectorAdd: (a, b, result, len) => {
        this.jsVectorAdd(a, b, result, len);
      },
      vectorScale: (a, scale, result, len) => {
        this.jsVectorScale(a, scale, result, len);
      },
      vectorNormalize: (a, result, len) => {
        this.jsVectorNormalize(a, result, len);
      },
      getModuleInfo: () => 0x00010000, // version 1, no SIMD
      memory: this.memory,
    };

    this.loaded = true;

    return {
      success: true,
      exports: this.exports,
      info: this.getInfo(),
    };
  }

  /**
   * 获取模块信息
   */
  getInfo(): WasmInfo {
    if (!this.exports) {
      return { loaded: false, simd: false, version: 0 };
    }

    const info = this.exports.getModuleInfo();
    const version = (info >> 16) & 0xFFFF;
    const simd = ((info >> 15) & 1) === 1;

    return { loaded: true, simd, version };
  }

  /**
   * 获取导出对象
   */
  getExports(): WasmExports | null {
    return this.exports;
  }

  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * 获取内存缓冲区
   */
  getMemoryBuffer(): Float32Array | null {
    if (!this.memory) return null;
    return new Float32Array(this.memory.buffer);
  }

  /**
   * 分配内存
   */
  alloc(size: number): number {
    if (!this.exports?.memory) return 0;

    const memory = this.exports.memory;
    const buffer = new Uint8Array(memory.buffer);
    const offset = buffer.length;

    // 简单的线性分配（实际应使用更复杂的分配器）
    // 这里只是演示，实际使用需要更完善的内存管理

    return offset;
  }

  /**
   * 将向量写入内存
   */
  writeVector(vector: Float32Array): number {
    if (!this.memory) return 0;

    const buffer = new Float32Array(this.memory.buffer);
    const offset = buffer.length;

    // 扩展内存（如果需要）
    // 实际实现需要更复杂的内存管理

    return offset * 4; // 返回字节偏移
  }

  /**
   * 从内存读取向量
   */
  readVector(offset: number, len: number): Float32Array {
    if (!this.memory) return new Float32Array(0);

    const buffer = new Float32Array(this.memory.buffer);
    return buffer.slice(offset / 4, offset / 4 + len);
  }

  // ============================================================
  // 纯 JS 实现
  // ============================================================

  private jsCosineSimilarity(a: number, b: number, len: number): number {
    if (!this.memory) return 0;

    const buffer = new Float32Array(this.memory.buffer);
    const offsetA = a / 4;
    const offsetB = b / 4;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      const va = buffer[offsetA + i];
      const vb = buffer[offsetB + i];
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private jsEuclideanDistance(a: number, b: number, len: number): number {
    if (!this.memory) return 0;

    const buffer = new Float32Array(this.memory.buffer);
    const offsetA = a / 4;
    const offsetB = b / 4;

    let sum = 0;

    for (let i = 0; i < len; i++) {
      const diff = buffer[offsetA + i] - buffer[offsetB + i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  private jsDotProduct(a: number, b: number, len: number): number {
    if (!this.memory) return 0;

    const buffer = new Float32Array(this.memory.buffer);
    const offsetA = a / 4;
    const offsetB = b / 4;

    let sum = 0;

    for (let i = 0; i < len; i++) {
      sum += buffer[offsetA + i] * buffer[offsetB + i];
    }

    return sum;
  }

  private jsBatchCosineSimilarity(
    query: number,
    vectors: number,
    results: number,
    numVectors: number,
    dim: number
  ): void {
    if (!this.memory) return;

    const buffer = new Float32Array(this.memory.buffer);
    const queryOffset = query / 4;
    const vectorsOffset = vectors / 4;
    const resultsOffset = results / 4;

    for (let i = 0; i < numVectors; i++) {
      const vectorOffset = vectorsOffset + i * dim;
      buffer[resultsOffset + i] = this.jsCosineSimilarity(
        query,
        vectorOffset * 4,
        dim
      );
    }
  }

  private jsBatchEuclideanDistance(
    query: number,
    vectors: number,
    results: number,
    numVectors: number,
    dim: number
  ): void {
    if (!this.memory) return;

    const buffer = new Float32Array(this.memory.buffer);
    const queryOffset = query / 4;
    const vectorsOffset = vectors / 4;
    const resultsOffset = results / 4;

    for (let i = 0; i < numVectors; i++) {
      const vectorOffset = vectorsOffset + i * dim;
      buffer[resultsOffset + i] = this.jsEuclideanDistance(
        query,
        vectorOffset * 4,
        dim
      );
    }
  }

  private jsVectorAdd(a: number, b: number, result: number, len: number): void {
    if (!this.memory) return;

    const buffer = new Float32Array(this.memory.buffer);
    const offsetA = a / 4;
    const offsetB = b / 4;
    const offsetR = result / 4;

    for (let i = 0; i < len; i++) {
      buffer[offsetR + i] = buffer[offsetA + i] + buffer[offsetB + i];
    }
  }

  private jsVectorScale(a: number, scale: number, result: number, len: number): void {
    if (!this.memory) return;

    const buffer = new Float32Array(this.memory.buffer);
    const offsetA = a / 4;
    const offsetR = result / 4;

    for (let i = 0; i < len; i++) {
      buffer[offsetR + i] = buffer[offsetA + i] * scale;
    }
  }

  private jsVectorNormalize(a: number, result: number, len: number): void {
    if (!this.memory) return;

    const buffer = new Float32Array(this.memory.buffer);
    const offsetA = a / 4;
    const offsetR = result / 4;

    let norm = 0;
    for (let i = 0; i < len; i++) {
      const v = buffer[offsetA + i];
      norm += v * v;
    }

    norm = Math.sqrt(norm);

    if (norm === 0) {
      for (let i = 0; i < len; i++) {
        buffer[offsetR + i] = 0;
      }
      return;
    }

    for (let i = 0; i < len; i++) {
      buffer[offsetR + i] = buffer[offsetA + i] / norm;
    }
  }

  /**
   * 重置加载状态
   */
  reset(): void {
    this.exports = null;
    this.memory = null;
    this.loaded = false;
    this.loadAttempted = false;
  }
}

// ============================================================
// 单例实例
// ============================================================

let defaultLoader: WasmSimdLoader | null = null;

export function getWasmSimdLoader(): WasmSimdLoader {
  if (!defaultLoader) {
    defaultLoader = new WasmSimdLoader();
  }
  return defaultLoader;
}

/**
 * 快速加载 WASM 模块
 */
export async function loadWasmSimd(): Promise<WasmLoadResult> {
  const loader = getWasmSimdLoader();
  return loader.load();
}

/**
 * 获取 WASM 导出
 */
export function getWasmExports(): WasmExports | null {
  return defaultLoader?.getExports() || null;
}

/**
 * 检查 WASM 是否可用
 */
export function isWasmAvailable(): boolean {
  return defaultLoader?.isLoaded() || false;
}
