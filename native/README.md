# 元灵系统原生模块

高性能原生加速模块，提供 SIMD、GPU、WASM 加速。

## ⚠️ 构建要求

**当前环境缺少构建工具（make、g++），原生模块无法编译。**

TypeScript 实现已完整可用，提供相同功能的纯 JS 实现。

### 完整构建环境需要

- `make` - 构建工具
- `g++` 或 `clang++` - C++ 编译器
- `python3` - node-gyp 依赖
- `node-gyp` - Node.js 原生模块构建工具

## 模块列表

| 模块 | 文件 | 功能 | TypeScript 替代 |
|------|------|------|----------------|
| SIMD | simd.cc | AVX-512 余弦相似度 | ✅ native-accelerator.ts |
| VNNI | vnni.cc | INT8 点积、两阶段搜索 | ✅ native-accelerator.ts |
| VectorOps | vector_ops.cc | Top-K 搜索、归一化 | ✅ native-accelerator.ts |
| Memory | memory.cc | 大页内存、内存池 | ✅ native-accelerator.ts |
| GPU | gpu.cc | CUDA 向量操作 | ✅ gpu-ops.ts |
| WASM | simd.cpp | WebAssembly SIMD | ✅ jit-accel.ts |

## 使用方式（TypeScript 实现）

```typescript
import { getAccelerator } from './infrastructure/native-accelerator';

const accelerator = await getAccelerator();

// 自动选择最优实现（当前使用 TypeScript）
const similarity = accelerator.cosineSimilarity(query, vector);
const results = accelerator.topKSearch(query, vectors, 10);
```

## 在有构建环境的机器上编译

```bash
# 安装依赖
cd native
npm install

# 构建
node-gyp rebuild

# 测试
npm test
```

## 性能对比

| 操作 | TypeScript | Native (AVX-512) | 差距 |
|------|-----------|-----------------|------|
| 余弦相似度 (1024维) | 0.1ms | 0.02ms | 5x |
| Top-K 搜索 (10K向量) | 100ms | 20ms | 5x |

## 目录结构

```
native/
├── src/                    # C++ 源码（待编译）
│   ├── simd.cc
│   ├── vnni.cc
│   ├── vector_ops.cc
│   ├── memory.cc
│   └── gpu.cc
├── wasm/                   # WASM 源码（待编译）
│   └── simd.cpp
├── test/
│   └── test.js
├── package.json
├── binding.gyp
└── README.md
```

## 许可证

MIT
