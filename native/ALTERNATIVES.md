# 原生模块替代方案

## 方案一：使用 npx 直接编译（推荐）

npx 可以直接运行 node-gyp，无需全局安装：

```bash
cd /home/sandbox/.openclaw/workspace/humanoid-agent/native

# 安装依赖
npm install

# 使用 npx 编译
npx node-gyp configure
npx node-gyp build
```

## 方案二：使用预编译的 node-gyp

```bash
# 下载预编译的 node-gyp
curl -L https://registry.npmjs.org/node-gyp/-/node-gyp-10.0.0.tgz -o node-gyp.tgz
tar xzf node-gyp.tgz

# 使用本地 node-gyp
node package/bin/node-gyp.js rebuild
```

## 方案三：使用 cmake-js 替代 node-gyp

cmake-js 是 node-gyp 的替代品，有时更容易编译：

```bash
# 安装 cmake-js
npm install cmake-js

# 创建 CMakeLists.txt
cat > CMakeLists.txt << 'EOF'
cmake_minimum_required(VERSION 3.15)
project(simd)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -mavx512f -mavx512vnni")

add_library(simd SHARED src/simd.cc)
target_include_directories(simd PRIVATE ${CMAKE_JS_INC})
set_target_properties(simd PROPERTIES PREFIX "" SUFFIX ".node")
EOF

# 编译
npx cmake-js compile
```

## 方案四：使用纯 JavaScript 加速库

使用现有的 npm 包替代原生模块：

```bash
# 安装高性能向量库
npm install vectorious
npm install ml-matrix
npm install compute-cosine-similarity
```

然后在代码中使用：

```typescript
import { Vector } from 'vectorious';

// 使用 vectorious 进行向量操作
const a = new Vector([1, 2, 3, 4]);
const b = new Vector([1, 2, 3, 4]);
const similarity = a.dot(b) / (a.magnitude() * b.magnitude());
```

## 方案五：使用 WebAssembly (WASM)

编译 WASM 模块，不需要系统编译器：

```bash
# 安装 wasm-pack（如果可用）
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# 或使用 AssemblyScript（TypeScript 到 WASM）
npm install assemblyscript

# 创建 AS 模块
cat > assembly/index.ts << 'EOF'
export function cosineSimilarity(a: Float32Array, b: Float32Array): f32 {
  let dot: f32 = 0;
  let normA: f32 = 0;
  let normB: f32 = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
EOF

# 编译
npx asc assembly/index.ts -o build/release.wasm
```

## 方案六：使用 Worker Threads 并行

使用 Node.js 内置的 Worker Threads 实现并行计算：

```typescript
// parallel-search.ts
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

export async function parallelSearch(
  query: Float32Array,
  vectors: Float32Array[],
  k: number
): Promise<SearchResult[]> {
  const numWorkers = 4;
  const chunkSize = Math.ceil(vectors.length / numWorkers);
  
  const workers = [];
  for (let i = 0; i < numWorkers; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, vectors.length);
    
    workers.push(new Promise((resolve) => {
      const worker = new Worker(__filename, {
        workerData: { query, vectors: vectors.slice(start, end), k }
      });
      worker.on('message', resolve);
    }));
  }
  
  const results = await Promise.all(workers);
  return mergeResults(results, k);
}
```

## 方案七：使用 GPU.js（WebGL 加速）

使用 GPU.js 进行 GPU 加速，无需 CUDA：

```bash
npm install gpu.js
```

```typescript
import { GPU } from 'gpu.js';

const gpu = new GPU();

const cosineSimilarityKernel = gpu.createKernel(function(a: number[], b: number[][]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < this.constants.dim; i++) {
    dot += a[i] * b[this.thread.x][i];
    normA += a[i] * a[i];
    normB += b[this.thread.x][i] * b[this.thread.x][i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}).setOutput([1000]);

// 使用
const similarities = cosineSimilarityKernel(query, vectors);
```

## 推荐方案

根据当前环境（无 Docker、无 sudo、有 npx）：

| 方案 | 可行性 | 性能提升 | 推荐度 |
|------|--------|---------|--------|
| npx node-gyp | ⚠️ 需要 make | 最高 | ⭐⭐⭐ |
| cmake-js | ⚠️ 需要 cmake | 最高 | ⭐⭐⭐ |
| vectorious | ✅ 立即可用 | 2-3x | ⭐⭐⭐⭐ |
| Worker Threads | ✅ 立即可用 | 2-4x | ⭐⭐⭐⭐⭐ |
| GPU.js | ✅ 立即可用 | 5-10x | ⭐⭐⭐⭐ |
| AssemblyScript | ⚠️ 需要安装 | 3-5x | ⭐⭐⭐ |

**最推荐：Worker Threads + GPU.js 组合**

---

*创建时间：2026-04-15*
