# 性能优化 - 进一步改进空间

## 当前实现分析

### 已完成

| 模块 | 代码量 | 状态 |
|------|--------|------|
| 原生 SIMD | 266 行 | ✅ 基础完成 |
| 原生 Memory | 321 行 | ✅ 基础完成 |
| 多线程并行 | 239 行 | ✅ 基础完成 |
| GPU 加速 | 186 行 | ✅ 基础完成 |
| 量化压缩 | 328 行 | ✅ 基础完成 |
| HNSW 索引 | 445 行 | ✅ 基础完成 |

---

## 可优化方向

### 1. 原生模块增强

#### 1.1 添加更多 SIMD 指令

**当前**：仅使用 AVX2

**可优化**：
- AVX-512 支持（需要运行时检测）
- NEON 支持（ARM 平台）
- WASM SIMD（跨平台）

```cpp
// 运行时检测 AVX-512
bool hasAVX512() {
    unsigned int eax, ebx, ecx, edx;
    __cpuid_count(7, 0, eax, ebx, ecx, edx);
    return (ebx >> 16) & 1;  // AVX512F
}

// 条件编译
#ifdef __AVX512F__
    if (hasAVX512()) {
        return cosineSimilarityAVX512(a, b, len);
    }
#endif
```

**预期提升**：AVX-512 比 AVX2 快 2x

---

#### 1.2 添加 Top-K 选择算法

**当前**：计算所有相似度后排序

**可优化**：使用堆选择或快速选择

```cpp
// 使用堆选择，避免全排序
std::partial_sort(results.begin(), results.begin() + k, results.end(),
    [](const auto& a, const auto& b) { return a.score > b.score; });

// 或使用 nth_element + 堆
std::nth_element(results.begin(), results.begin() + k, results.end(),
    [](const auto& a, const auto& b) { return a.score > b.score; });
```

**预期提升**：O(N log K) vs O(N log N)

---

#### 1.3 添加矩阵乘法优化

**当前**：逐个向量计算

**可优化**：批量矩阵乘法

```cpp
// 使用 BLAS 或手动优化
void batchMatrixMultiply(const float* A, const float* B, float* C,
                         size_t M, size_t N, size_t K) {
    // 分块矩阵乘法，利用缓存
    for (size_t i = 0; i < M; i += BLOCK_SIZE) {
        for (size_t j = 0; j < N; j += BLOCK_SIZE) {
            for (size_t k = 0; k < K; k += BLOCK_SIZE) {
                // 块内计算
            }
        }
    }
}
```

**预期提升**：2-4x

---

### 2. 多线程优化

#### 2.1 使用线程池

**当前**：每次搜索创建新 Worker

**可优化**：复用线程池

```typescript
import { ThreadPool } from 'workerpool';

const pool = new ThreadPool({
    minWorkers: 4,
    maxWorkers: 8,
    workerType: 'thread'
});

// 复用线程，避免创建开销
const results = await pool.exec('search', [query, vectors]);
```

**预期提升**：减少线程创建开销 50%

---

#### 2.2 工作窃取调度

**当前**：静态分块

**可优化**：动态负载均衡

```typescript
class WorkStealingScheduler {
    private queues: Queue<Task>[][];
    
    steal(): Task | null {
        // 从其他线程队列窃取任务
        for (const queue of this.queues) {
            if (!queue.isEmpty()) {
                return queue.dequeue();
            }
        }
        return null;
    }
}
```

**预期提升**：负载不均时提升 20-30%

---

### 3. GPU 优化

#### 3.1 使用 WebGPU

**当前**：gpu.js (WebGL)

**可优化**：WebGPU（更现代）

```typescript
// WebGPU 计算
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const shader = device.createShaderModule({
    code: `
        @compute @workgroup_size(64)
        fn cosineSimilarity(@builtin(global_invocation_id) id: vec3<u32>) {
            // GPU 并行计算
        }
    `
});
```

**预期提升**：比 WebGL 快 2-5x

---

#### 3.2 批量内核优化

**当前**：单次计算一个向量

**可优化**：批量计算多个向量

```typescript
// 批量内核
const batchKernel = gpu.createKernel(function(
    queries: number[][],
    vectors: number[][],
    dim: number
): number[][] {
    // 一次计算多个查询
    return [[0]]; // 简化
}).setOutput([numQueries, numVectors]);
```

**预期提升**：减少内核调用开销 3-5x

---

### 4. 量化优化

#### 4.1 产品量化 (PQ)

**当前**：INT8 标量量化

**可优化**：产品量化

```typescript
class ProductQuantizer {
    private codebooks: Float32Array[][];  // 子空间码本
    
    // 将向量分成 M 个子向量
    // 每个子向量独立量化
    quantize(vector: Float32Array): Uint8Array {
        const codes = new Uint8Array(this.M);
        for (let m = 0; m < this.M; m++) {
            const subvector = vector.slice(m * this.subDim, (m + 1) * this.subDim);
            codes[m] = this.findNearestCentroid(m, subvector);
        }
        return codes;
    }
}
```

**预期提升**：存储压缩 8-16x，速度提升 2-3x

---

#### 4.2 残差量化

**当前**：直接量化

**可优化**：残差量化

```typescript
// 先粗量化，再量化残差
const coarse = coarseQuantizer.quantize(vector);
const residual = vector.map((v, i) => v - coarse[i]);
const fine = fineQuantizer.quantize(residual);
```

**预期提升**：精度提升 10-20%

---

### 5. HNSW 优化

#### 5.1 动态调整 ef 参数

**当前**：固定 ef 参数

**可优化**：根据查询自适应

```typescript
class AdaptiveHNSW extends HNSWIndex {
    search(query: number[], k: number): SearchResult[] {
        // 根据查询难度动态调整 ef
        const estimatedDifficulty = this.estimateDifficulty(query);
        const ef = Math.max(k, Math.floor(this.config.efSearch * estimatedDifficulty));
        
        return this.searchWithEf(query, k, ef);
    }
}
```

**预期提升**：召回率提升 5-10%

---

#### 5.2 磁盘持久化

**当前**：内存存储

**可优化**：磁盘 + 内存混合

```typescript
class DiskHNSW extends HNSWIndex {
    private mmap: MMapFile;
    
    // 使用内存映射文件
    // 只加载热点节点到内存
    async loadNode(id: string): Promise<HNSWNode> {
        if (this.cache.has(id)) {
            return this.cache.get(id);
        }
        return this.mmap.readNode(id);
    }
}
```

**预期提升**：支持 10x 更大规模数据

---

### 6. 缓存优化

#### 6.1 查询结果缓存

**当前**：无缓存

**可优化**：LRU 缓存热门查询

```typescript
class CachedSearch {
    private cache = new LRUCache<string, SearchResult[]>({ max: 10000 });
    
    search(query: Float32Array, k: number): SearchResult[] {
        const key = this.hashQuery(query);
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        const results = this.doSearch(query, k);
        this.cache.set(key, results);
        return results;
    }
}
```

**预期提升**：重复查询 100x 提升

---

#### 6.2 向量预取

**当前**：按需加载

**可优化**：预取相邻向量

```typescript
class PrefetchVectorStore {
    async prefetch(indices: number[]): Promise<void> {
        // 异步预取向量到缓存
        const promises = indices.map(i => this.loadVector(i));
        await Promise.all(promises);
    }
}
```

**预期提升**：减少 IO 等待 30-50%

---

## 优化优先级

| 优先级 | 优化项 | 难度 | 提升 | 推荐 |
|--------|--------|------|------|------|
| **P0** | Top-K 堆选择 | 低 | 2x | ⭐⭐⭐ |
| **P0** | 线程池复用 | 低 | 1.5x | ⭐⭐⭐ |
| **P1** | 产品量化 (PQ) | 中 | 8-16x 存储 | ⭐⭐ |
| **P1** | 查询缓存 | 低 | 100x | ⭐⭐ |
| **P2** | WebGPU | 高 | 2-5x | ⭐ |
| **P2** | 磁盘持久化 | 高 | 10x 规模 | ⭐ |

---

## 快速实现：Top-K 堆选择

```cpp
// 添加到 simd.cc
#include <queue>
#include <functional>

Napi::Value TopKSearch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // 参数: query, vectors, k
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Array vectors = info[1].As<Napi::Array>();
    size_t k = info[2].As<Napi::Number>().Uint32Value();
    
    size_t numVectors = vectors.Length();
    
    // 使用最小堆，保持 Top-K
    using Result = std::pair<float, size_t>;
    std::priority_queue<Result, std::vector<Result>, std::greater<>> heap;
    
    for (size_t i = 0; i < numVectors; i++) {
        Napi::Float32Array vec = vectors.Get(i).As<Napi::Float32Array>();
        float score = cosineSimilarity(query.Data(), vec.Data(), query.ElementLength());
        
        if (heap.size() < k) {
            heap.push({score, i});
        } else if (score > heap.top().first) {
            heap.pop();
            heap.push({score, i});
        }
    }
    
    // 转换结果
    Napi::Array results = Napi::Array::New(env, k);
    std::vector<Result> sorted;
    while (!heap.empty()) {
        sorted.push_back(heap.top());
        heap.pop();
    }
    std::reverse(sorted.begin(), sorted.end());
    
    for (size_t i = 0; i < sorted.size(); i++) {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("index", sorted[i].second);
        obj.Set("score", sorted[i].first);
        results.Set(i, obj);
    }
    
    return results;
}
```

---

## 总结

当前实现已经覆盖了主要优化方向，但仍有提升空间：

1. **算法层面**：Top-K 选择、产品量化
2. **架构层面**：线程池、缓存、持久化
3. **硬件层面**：AVX-512、WebGPU

**推荐下一步**：实现 Top-K 堆选择 + 查询缓存，改动小、效果明显。

---

*创建时间：2026-04-15*
