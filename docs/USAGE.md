# 元灵系统 v4.3.0 使用指南

## 快速开始

### 1. 安装依赖

```bash
cd humanoid-agent
npm install
```

### 2. 编译 TypeScript

```bash
npx tsc --skipLibCheck
```

### 3. 运行测试

```bash
node -e "const simd = require('./native/build/Release/yuanling_native.node'); console.log(simd.getCapabilities());"
```

---

## 核心功能

### 1. 向量搜索 (SIMD 加速)

```typescript
const simd = require('./native/build/Release/yuanling_native.node');

// 单次相似度
const score = simd.cosineSimilarity(query, vector);

// 批量相似度
const scores = simd.cosineSimilarityBatch(query, vectors, dim);

// Top-K 搜索
const results = simd.topKSearchWithDim(query, vectors, dim, k);
```

### 2. 并行搜索 (OpenMP)

```typescript
const parallel = require('./native/build/Release/parallel.node');

// 获取/设置线程数
console.log(parallel.getThreadCount());
parallel.setThreadCount(4);

// 并行 Top-K
const results = parallel.topKSearchParallel(query, vectors, dim, k);
```

### 3. INT8 量化

```typescript
const int8 = require('./native/build/Release/int8.node');

// 量化向量
const { data, scale } = int8.quantizeFloat32ToInt8(vector);

// INT8 相似度
const score = int8.cosineSimilarityINT8(a, b, scaleA, scaleB);

// INT8 Top-K
const results = int8.topKSearchINT8(query, vectors, dim, k, scaleQuery, scales);
```

### 4. IVF 索引

```typescript
import { IVFIndex } from './infrastructure/ivf-index';

const ivf = new IVFIndex({
    dimensions: 128,
    nClusters: 100,
    nProbe: 10
});

// 训练
ivf.train(vectors, 20);

// 添加向量
ivf.add('id1', vector);

// 搜索
const results = ivf.search(query, 10);
```

### 5. Matryoshka 降维

```typescript
import { MatryoshkaEmbedding, PRESETS } from './infrastructure/matryoshka';

// 使用预设
const matryoshka = new MatryoshkaEmbedding(PRESETS.qwen3);

// 降维
const { vector: truncated, dim } = matryoshka.truncate(vector4096, 1024);

// 估算精度损失
const loss = matryoshka.estimateAccuracyLoss(1024); // ~3.75%
```

### 6. 向量嵌入 (Qwen3-Embedding-8B)

```typescript
import { EmbeddingClient, QWEN3_EMBEDDING_CONFIG } from './infrastructure/embedding-config';

const client = new EmbeddingClient(QWEN3_EMBEDDING_CONFIG);

// 生成嵌入
const embedding = await client.embed('你的文本', 4096);

// 批量生成
const embeddings = await client.embedBatch(['文本1', '文本2'], 1024);
```

---

## 性能数据

### SIMD Top-K 性能

| 向量数 | 维度 | 耗时 | QPS |
|--------|------|------|-----|
| 10K | 128 | 1ms | 10M |
| 100K | 128 | 6ms | 17M |
| 1M | 128 | 56ms | 18M |

### 不同维度吞吐量

| 维度 | 吞吐量 |
|------|--------|
| 128 | 9,766 MB/s |
| 1024 | 10,557 MB/s |
| 4096 | 9,645 MB/s |

### INT8 量化

| 指标 | 值 |
|------|-----|
| 单次量化 | 0.018ms |
| 压缩比 | 4x |
| 吞吐量 | 55K vectors/s |

---

## 配置选项

### 向量模型配置

```typescript
// 当前配置: Qwen3-Embedding-8B
{
    provider: 'Gitee AI',
    model: 'Qwen3-Embedding-8B',
    baseUrl: 'https://ai.gitee.com/v1',
    dimensions: 4096,
    maxTokens: 32768,
    supportedDimensions: [768, 1024, 2048, 3072, 4096]
}
```

### IVF 索引配置

```typescript
{
    dimensions: 128,      // 向量维度
    nClusters: 100,       // 聚类数量
    nProbe: 10,           // 搜索探测聚类数
    distanceFunction: 'cosine'  // 距离函数
}
```

---

## 最佳实践

### 1. 选择合适的维度

| 场景 | 推荐维度 | 说明 |
|------|---------|------|
| 高精度 | 4096 | 完整语义 |
| 平衡 | 1024 | 精度损失 <4% |
| 高速 | 768 | 精度损失 ~5% |

### 2. 选择合适的索引

| 数据规模 | 推荐索引 |
|---------|---------|
| <10K | 暴力搜索 |
| 10K-1M | IVF |
| >1M | HNSW / 混合索引 |

### 3. 量化选择

| 量化类型 | 压缩比 | 精度损失 |
|---------|--------|---------|
| INT8 | 4x | <2% |
| PQ | 16x | 5-10% |
| 残差量化 | 8x | <5% |

---

## 故障排除

### 原生模块加载失败

```bash
# 检查文件是否存在
ls native/build/Release/*.node

# 重新下载
curl -L -o native.zip <artifact_url>
unzip native.zip -d native/build/Release/
```

### TypeScript 编译错误

```bash
# 跳过类型检查编译
npx tsc --skipLibCheck
```

### 性能不如预期

1. 检查 SIMD 支持: `simd.getCapabilities()`
2. 增加线程数: `parallel.setThreadCount(4)`
3. 使用 INT8 量化减少内存带宽

---

*文档版本: v4.3.0*
*最后更新: 2026-04-15*
