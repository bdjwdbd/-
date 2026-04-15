# 性能优化方案

## 当前性能

| 指标 | 值 | 评价 |
|------|-----|------|
| 单次相似度 (128维) | 0.001ms | ✅ 极快 |
| 批量搜索 (10K向量) | 5ms | ✅ 优秀 |
| QPS | 2,000,000 | ✅ 百万级 |

---

## 可优化方向

### 1. 批量并行计算（推荐）

**当前问题**：逐个计算相似度，未利用 SIMD 批量处理

**优化方案**：添加批量计算接口

```cpp
// simd.cc 新增
Napi::Value CosineSimilarityBatch(const Napi::CallbackInfo& info) {
    // 一次性计算 query 与多个 vectors 的相似度
    // 利用 CPU 缓存局部性
}
```

**预期提升**：2-3x

---

### 2. 多线程并行

**当前问题**：单线程计算

**优化方案**：使用 Worker Threads

```typescript
// parallel-search.ts
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

export async function parallelSearch(query: Float32Array, vectors: Float32Array[][], numWorkers = 4) {
    const chunkSize = Math.ceil(vectors.length / numWorkers);
    const workers = [];
    
    for (let i = 0; i < numWorkers; i++) {
        const chunk = vectors.slice(i * chunkSize, (i + 1) * chunkSize);
        workers.push(runWorker(query, chunk));
    }
    
    return Promise.all(workers).then(flatten);
}
```

**预期提升**：接近核心数倍（4核 = 4x）

---

### 3. GPU 加速

**当前问题**：仅使用 CPU

**优化方案**：使用 gpu.js 或 WebGPU

```typescript
// gpu-accelerator.ts
import { GPU } from 'gpu.js';

const gpu = new GPU();

const cosineKernel = gpu.createKernel(function(a, b, len) {
    let sum = 0, normA = 0, normB = 0;
    for (let i = 0; i < len; i++) {
        sum += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return sum / (Math.sqrt(normA) * Math.sqrt(normB));
}).setOutput([10000]);

// 批量计算 10000 个向量
const results = cosineKernel(query, vectors, 128);
```

**预期提升**：10-100x（取决于 GPU）

---

### 4. 量化压缩

**当前问题**：使用 Float32（4字节/维度）

**优化方案**：INT8 量化（1字节/维度）

```typescript
// quantization.ts
export function quantizeToInt8(vector: Float32Array): Int8Array {
    const max = Math.max(...vector.map(Math.abs));
    const scale = 127 / max;
    return new Int8Array(vector.map(v => Math.round(v * scale)));
}

// 存储空间减少 4x
// 计算速度提升 2-4x（INT8 指令更快）
```

**预期提升**：存储 4x，速度 2-4x

---

### 5. 索引结构优化

**当前问题**：暴力搜索 O(n)

**优化方案**：HNSW 索引

```typescript
// hnsw-index.ts
export class HNSWIndex {
    // 分层导航小世界图
    // 搜索复杂度 O(log n)
    
    search(query: Float32Array, k: number): number[] {
        // 从顶层开始，逐层下降
        // 只访问少量节点
    }
}
```

**预期提升**：搜索复杂度从 O(n) 降到 O(log n)

---

## 优化优先级

| 优先级 | 优化项 | 难度 | 提升 | 推荐 |
|--------|--------|------|------|------|
| P0 | 批量并行计算 | 低 | 2-3x | ⭐⭐⭐ |
| P0 | 多线程并行 | 中 | 4x | ⭐⭐⭐ |
| P1 | GPU 加速 | 中 | 10-100x | ⭐⭐ |
| P1 | INT8 量化 | 低 | 2-4x | ⭐⭐ |
| P2 | HNSW 索引 | 高 | log(n) | ⭐ |

---

## 快速实现：批量并行

```cpp
// 添加到 simd.cc
Napi::Value CosineSimilarityBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsTypedArray() || !info[1].IsArray()) {
        Napi::TypeError::New(env, "Expected Float32Array and Array").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Array vectors = info[1].As<Napi::Array>();
    
    size_t numVectors = vectors.Length();
    Napi::Float32Array results = Napi::Float32Array::New(env, numVectors);
    
    const float* queryData = query.Data();
    size_t queryLen = query.ElementLength();
    
    for (size_t i = 0; i < numVectors; i++) {
        Napi::Float32Array vec = vectors.Get(i).As<Napi::Float32Array>();
        results[i] = cosineSimilarity(queryData, vec.Data(), queryLen);
    }
    
    return results;
}

// 在 Init 中添加
exports.Set("cosineSimilarityBatch", Napi::Function::New(env, CosineSimilarityBatch));
```

---

## 结论

当前性能已经很好（QPS 200万），但仍有优化空间：

1. **批量接口**：减少 JS/C++ 边界开销
2. **多线程**：充分利用多核 CPU
3. **GPU**：大规模向量搜索
4. **量化**：减少内存占用和带宽

**推荐先实现批量接口 + 多线程，可达到 4-8x 提升。**

---

*创建时间：2026-04-15*
