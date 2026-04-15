# 原生向量运算模块

## 编译说明

### 前置要求

- Node.js >= 14
- C++ 编译器（GCC / Clang / MSVC）
- Python 2.7 或 3.x（node-gyp 需要）

### 编译步骤

```bash
# 安装编译依赖
npm install --save-dev node-addon-api node-gyp

# 编译原生模块
cd native
npx node-gyp configure
npx node-gyp build
```

### 编译选项

在 `binding.gyp` 中可以调整编译选项：

- `-O3`: 最高优化级别
- `-march=native`: 针对当前 CPU 优化
- `-ffast-math`: 快速数学运算（可能牺牲精度）

### SIMD 支持

模块会自动检测并使用可用的 SIMD 指令：

| 指令集 | 寄存器宽度 | double 并行数 |
|--------|-----------|--------------|
| SSE2 | 128-bit | 2 |
| AVX | 256-bit | 4 |
| AVX-512 | 512-bit | 8 |

### 降级机制

如果原生模块编译失败或加载失败，系统会自动降级到纯 JS 实现，无需额外配置。

## 性能对比

| 实现 | 相对性能 |
|------|---------|
| 纯 JS | 1x |
| JS + Float32Array | 1.5x |
| SSE2 | 3-4x |
| AVX | 5-8x |
| AVX-512 | 10-15x |

## 使用示例

```typescript
import { getNativeVectorOps } from './infrastructure';

const ops = getNativeVectorOps();

// 检查是否使用原生模块
const info = ops.getInfo();
console.log(`Native: ${info.loaded}, AVX: ${info.hasAVX}, SSE2: ${info.hasSSE2}`);

// 计算余弦相似度
const a = [1.0, 2.0, 3.0, 4.0];
const b = [0.5, 1.0, 1.5, 2.0];
const similarity = ops.cosineSimilarity(a, b);
```
