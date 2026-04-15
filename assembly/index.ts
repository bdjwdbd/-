/**
 * WASM SIMD 向量运算模块
 * 
 * 使用 AssemblyScript 编写，编译为 WASM
 * 支持 SIMD 指令加速
 */

// ============================================================
// 类型定义
// ============================================================

declare function isNaN(v: f32): boolean;

// ============================================================
// 向量运算函数
// ============================================================

/**
 * 余弦相似度
 * 
 * @param a 向量 a 的指针
 * @param b 向量 b 的指针
 * @param len 向量长度
 * @returns 余弦相似度 [-1, 1]
 */
export function cosineSimilarity(a: i32, b: i32, len: i32): f32 {
  let dot: f32 = 0;
  let normA: f32 = 0;
  let normB: f32 = 0;
  
  // 使用 SIMD 优化（如果可用）
  // @ts-ignore: SIMD intrinsic
  if (len >= 4 && SIMD) {
    return cosineSimilaritySIMD(a, b, len);
  }
  
  // 标量计算
  for (let i: i32 = 0; i < len; i++) {
    const va = load<f32>(a + i * 4);
    const vb = load<f32>(b + i * 4);
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * SIMD 优化的余弦相似度
 */
function cosineSimilaritySIMD(a: i32, b: i32, len: i32): f32 {
  let dot: f32 = 0;
  let normA: f32 = 0;
  let normB: f32 = 0;
  
  // SIMD 处理 4 个元素一组
  const simdLen = len & ~3; // 向下取整到 4 的倍数
  
  for (let i: i32 = 0; i < simdLen; i += 4) {
    // 加载 4 个 float32
    const va = v128.load(a + i * 4);
    const vb = v128.load(b + i * 4);
    
    // 点积累加
    dot += f32x4.extract_lane<f32>(f32x4.mul(va, vb), 0);
    dot += f32x4.extract_lane<f32>(f32x4.mul(va, vb), 1);
    dot += f32x4.extract_lane<f32>(f32x4.mul(va, vb), 2);
    dot += f32x4.extract_lane<f32>(f32x4.mul(va, vb), 3);
    
    // 范数累加
    normA += f32x4.extract_lane<f32>(f32x4.mul(va, va), 0);
    normA += f32x4.extract_lane<f32>(f32x4.mul(va, va), 1);
    normA += f32x4.extract_lane<f32>(f32x4.mul(va, va), 2);
    normA += f32x4.extract_lane<f32>(f32x4.mul(va, va), 3);
    
    normB += f32x4.extract_lane<f32>(f32x4.mul(vb, vb), 0);
    normB += f32x4.extract_lane<f32>(f32x4.mul(vb, vb), 1);
    normB += f32x4.extract_lane<f32>(f32x4.mul(vb, vb), 2);
    normB += f32x4.extract_lane<f32>(f32x4.mul(vb, vb), 3);
  }
  
  // 处理剩余元素
  for (let i: i32 = simdLen; i < len; i++) {
    const va = load<f32>(a + i * 4);
    const vb = load<f32>(b + i * 4);
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * 欧几里得距离
 */
export function euclideanDistance(a: i32, b: i32, len: i32): f32 {
  let sum: f32 = 0;
  
  for (let i: i32 = 0; i < len; i++) {
    const diff = load<f32>(a + i * 4) - load<f32>(b + i * 4);
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

/**
 * 点积
 */
export function dotProduct(a: i32, b: i32, len: i32): f32 {
  let sum: f32 = 0;
  
  for (let i: i32 = 0; i < len; i++) {
    sum += load<f32>(a + i * 4) * load<f32>(b + i * 4);
  }
  
  return sum;
}

/**
 * 批量余弦相似度
 * 
 * @param query 查询向量指针
 * @param vectors 向量数组指针
 * @param results 结果数组指针
 * @param numVectors 向量数量
 * @param dim 向量维度
 */
export function batchCosineSimilarity(
  query: i32,
  vectors: i32,
  results: i32,
  numVectors: i32,
  dim: i32
): void {
  for (let i: i32 = 0; i < numVectors; i++) {
    const vectorOffset = vectors + i * dim * 4;
    const similarity = cosineSimilarity(query, vectorOffset, dim);
    store<f32>(results + i * 4, similarity);
  }
}

/**
 * 批量欧几里得距离
 */
export function batchEuclideanDistance(
  query: i32,
  vectors: i32,
  results: i32,
  numVectors: i32,
  dim: i32
): void {
  for (let i: i32 = 0; i < numVectors; i++) {
    const vectorOffset = vectors + i * dim * 4;
    const distance = euclideanDistance(query, vectorOffset, dim);
    store<f32>(results + i * 4, distance);
  }
}

/**
 * 向量加法
 */
export function vectorAdd(a: i32, b: i32, result: i32, len: i32): void {
  for (let i: i32 = 0; i < len; i++) {
    store<f32>(result + i * 4, load<f32>(a + i * 4) + load<f32>(b + i * 4));
  }
}

/**
 * 向量缩放
 */
export function vectorScale(a: i32, scale: f32, result: i32, len: i32): void {
  for (let i: i32 = 0; i < len; i++) {
    store<f32>(result + i * 4, load<f32>(a + i * 4) * scale);
  }
}

/**
 * 向量归一化
 */
export function vectorNormalize(a: i32, result: i32, len: i32): void {
  let norm: f32 = 0;
  
  // 计算范数
  for (let i: i32 = 0; i < len; i++) {
    const v = load<f32>(a + i * 4);
    norm += v * v;
  }
  
  norm = Math.sqrt(norm);
  
  if (norm === 0) {
    // 零向量，直接复制
    for (let i: i32 = 0; i < len; i++) {
      store<f32>(result + i * 4, 0);
    }
    return;
  }
  
  // 归一化
  for (let i: i32 = 0; i < len; i++) {
    store<f32>(result + i * 4, load<f32>(a + i * 4) / norm);
  }
}

/**
 * 获取 WASM 模块信息
 */
export function getModuleInfo(): i32 {
  // 返回版本号和 SIMD 支持状态
  // 格式: version (16 bits) | simd_supported (1 bit) | reserved (15 bits)
  const version: i32 = 1;
  const simdSupported: i32 = 1; // 假设支持
  return (version << 16) | (simdSupported << 15);
}
