/**
 * 原生向量运算模块包装器
 * 
 * 自动检测并加载 C++ 原生模块
 * 如果原生模块不可用，降级到 JS 实现
 */

// ============================================================
// 类型定义
// ============================================================

export interface NativeVectorOps {
  dotProduct(a: Float64Array, b: Float64Array): number;
  euclideanDistance(a: Float64Array, b: Float64Array): number;
  cosineSimilarity(a: Float64Array, b: Float64Array): number;
  batchCosineSimilarity(query: Float64Array, vectors: Float64Array[]): Float64Array;
  hasAVX: boolean;
  hasSSE2: boolean;
}

export interface NativeModuleInfo {
  loaded: boolean;
  hasAVX: boolean;
  hasSSE2: boolean;
  reason?: string;
}

// ============================================================
// 原生模块加载
// ============================================================

let nativeModule: NativeVectorOps | null = null;
let nativeModuleInfo: NativeModuleInfo | null = null;

function loadNativeModule(): NativeVectorOps | null {
  if (nativeModule !== null) return nativeModule;
  
  try {
    // 尝试加载编译后的原生模块
    const binding = require('../../native/build/Release/vector_ops.node');
    
    nativeModule = {
      dotProduct: (a, b) => binding.dotProduct(a, b),
      euclideanDistance: (a, b) => binding.euclideanDistance(a, b),
      cosineSimilarity: (a, b) => binding.cosineSimilarity(a, b),
      batchCosineSimilarity: (query, vectors) => binding.batchCosineSimilarity(query, vectors),
      hasAVX: binding.hasAVX,
      hasSSE2: binding.hasSSE2,
    };
    
    nativeModuleInfo = {
      loaded: true,
      hasAVX: binding.hasAVX,
      hasSSE2: binding.hasSSE2,
    };
    
    return nativeModule;
  } catch (e: any) {
    // 原生模块不可用
    nativeModuleInfo = {
      loaded: false,
      hasAVX: false,
      hasSSE2: false,
      reason: e.message,
    };
    
    return null;
  }
}

// ============================================================
// JS 降级实现
// ============================================================

const jsVectorOps: NativeVectorOps = {
  dotProduct(a: Float64Array, b: Float64Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  },

  euclideanDistance(a: Float64Array, b: Float64Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  },

  cosineSimilarity(a: Float64Array, b: Float64Array): number {
    const dot = jsVectorOps.dotProduct(a, b);
    const normA = Math.sqrt(jsVectorOps.dotProduct(a, a));
    const normB = Math.sqrt(jsVectorOps.dotProduct(b, b));
    return dot / (normA * normB);
  },

  batchCosineSimilarity(query: Float64Array, vectors: Float64Array[]): Float64Array {
    const results = new Float64Array(vectors.length);
    const normQ = Math.sqrt(jsVectorOps.dotProduct(query, query));
    
    for (let i = 0; i < vectors.length; i++) {
      const vec = vectors[i];
      const dot = jsVectorOps.dotProduct(query, vec);
      const normV = Math.sqrt(jsVectorOps.dotProduct(vec, vec));
      results[i] = dot / (normQ * normV);
    }
    
    return results;
  },

  hasAVX: false,
  hasSSE2: false,
};

// ============================================================
// 统一接口
// ============================================================

export class UnifiedVectorOps {
  private ops: NativeVectorOps;
  private useNative: boolean;

  constructor() {
    const native = loadNativeModule();
    
    if (native) {
      this.ops = native;
      this.useNative = true;
    } else {
      this.ops = jsVectorOps;
      this.useNative = false;
    }
  }

  /**
   * 点积
   */
  dotProduct(a: number[] | Float64Array, b: number[] | Float64Array): number {
    const fa = a instanceof Float64Array ? a : new Float64Array(a);
    const fb = b instanceof Float64Array ? b : new Float64Array(b);
    return this.ops.dotProduct(fa, fb);
  }

  /**
   * 欧氏距离
   */
  euclideanDistance(a: number[] | Float64Array, b: number[] | Float64Array): number {
    const fa = a instanceof Float64Array ? a : new Float64Array(a);
    const fb = b instanceof Float64Array ? b : new Float64Array(b);
    return this.ops.euclideanDistance(fa, fb);
  }

  /**
   * 余弦相似度
   */
  cosineSimilarity(a: number[] | Float64Array, b: number[] | Float64Array): number {
    const fa = a instanceof Float64Array ? a : new Float64Array(a);
    const fb = b instanceof Float64Array ? b : new Float64Array(b);
    return this.ops.cosineSimilarity(fa, fb);
  }

  /**
   * 批量余弦相似度
   */
  batchCosineSimilarity(query: number[] | Float64Array, vectors: (number[] | Float64Array)[]): number[] {
    const fq = query instanceof Float64Array ? query : new Float64Array(query);
    const fv = vectors.map(v => v instanceof Float64Array ? v : new Float64Array(v));
    const result = this.ops.batchCosineSimilarity(fq, fv);
    return Array.from(result);
  }

  /**
   * 获取模块信息
   */
  getInfo(): NativeModuleInfo {
    if (nativeModuleInfo) {
      return nativeModuleInfo;
    }
    
    return {
      loaded: this.useNative,
      hasAVX: this.ops.hasAVX,
      hasSSE2: this.ops.hasSSE2,
    };
  }
}

// ============================================================
// 导出
// ============================================================

let defaultOps: UnifiedVectorOps | null = null;

export function getVectorOps(): UnifiedVectorOps {
  if (!defaultOps) {
    defaultOps = new UnifiedVectorOps();
  }
  return defaultOps;
}

export function isNativeModuleAvailable(): boolean {
  loadNativeModule();
  return nativeModuleInfo?.loaded ?? false;
}

export function getNativeModuleInfo(): NativeModuleInfo {
  loadNativeModule();
  return nativeModuleInfo ?? { loaded: false, hasAVX: false, hasSSE2: false };
}
