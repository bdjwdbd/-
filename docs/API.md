# 元灵系统 v4.3.0 API 文档

## 概述

元灵系统是一个高性能向量搜索引擎，提供统一的 API 接口。

## 安装

```bash
npm install
npx tsc --skipLibCheck
```

## 快速开始

```typescript
import { createYuanLing } from './infrastructure/api';

const api = createYuanLing({ dimensions: 1024 });

// 生成向量嵌入
const { vector } = await api.embed('你的文本');

// 添加向量
api.add('id1', vector);

// 搜索
const results = api.search(query, 10);

// 通过文本搜索
const results = await api.searchText('搜索文本', 10);
```

---

## 核心 API

### YuanLingAPI

#### 构造函数

```typescript
const api = createYuanLing(config?: YuanLingConfig);
```

**配置选项：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| dimensions | number | 1024 | 向量维度 |
| useParallel | boolean | true | 启用并行搜索 |
| threadCount | number | 4 | 线程数 |
| useQuantization | boolean | false | 启用量化 |
| indexType | string | 'ivf' | 索引类型 |

---

### 向量嵌入

#### embed()

生成文本的向量嵌入。

```typescript
const result = await api.embed(text: string, dimensions?: number): Promise<EmbeddingResult>
```

**参数：**
- `text` - 要嵌入的文本
- `dimensions` - 目标维度（可选，默认使用配置值）

**返回：**
```typescript
interface EmbeddingResult {
    vector: Float32Array;    // 向量数据
    dimensions: number;      // 实际维度
    truncated?: boolean;     // 是否被降维
}
```

**示例：**
```typescript
// 生成 4096 维向量
const result = await api.embed('你好世界', 4096);

// 降维到 1024
const result = await api.embed('你好世界', 1024);
console.log(result.truncated); // true
```

---

#### embedBatch()

批量生成向量嵌入。

```typescript
const results = await api.embedBatch(texts: string[], dimensions?: number): Promise<EmbeddingResult[]>
```

---

### 向量存储

#### add()

添加单个向量。

```typescript
api.add(id: string, vector: Float32Array): void
```

**示例：**
```typescript
const vector = new Float32Array(1024).fill(0.5);
api.add('doc1', vector);
```

---

#### addBatch()

批量添加向量。

```typescript
api.addBatch(items: Array<{ id: string; vector: Float32Array }>): void
```

---

#### buildIndex()

构建索引（用于大规模数据）。

```typescript
await api.buildIndex(): void
```

---

### 向量搜索

#### search()

搜索相似向量。

```typescript
const results = api.search(query: Float32Array, k: number): SearchResult[]
```

**参数：**
- `query` - 查询向量
- `k` - 返回结果数量

**返回：**
```typescript
interface SearchResult {
    id: string;      // 向量 ID
    score: number;   // 相似度分数
}
```

**示例：**
```typescript
const query = new Float32Array(1024).fill(0.5);
const results = api.search(query, 10);

results.forEach(r => {
    console.log(`${r.id}: ${r.score}`);
});
```

---

#### searchText()

通过文本搜索。

```typescript
const results = await api.searchText(text: string, k: number): Promise<SearchResult[]>
```

**示例：**
```typescript
const results = await api.searchText('机器学习', 5);
```

---

### 相似度计算

#### cosineSimilarity()

计算两个向量的余弦相似度。

```typescript
const score = api.cosineSimilarity(a: Float32Array, b: Float32Array): number
```

**返回：** -1 到 1 之间的相似度分数

---

#### cosineSimilarityBatch()

批量计算相似度。

```typescript
const scores = api.cosineSimilarityBatch(
    query: Float32Array, 
    vectors: Float32Array[], 
    dim?: number
): Float32Array
```

---

### Top-K 搜索

#### topK()

使用原生 SIMD 加速的 Top-K 搜索。

```typescript
const results = api.topK(
    query: Float32Array, 
    vectors: Float32Array[], 
    k: number
): SearchResult[]
```

---

### 量化

#### quantize()

将向量量化为 INT8。

```typescript
const { data, scale } = api.quantize(vector: Float32Array): { data: Int8Array; scale: number }
```

**示例：**
```typescript
const vector = new Float32Array(1024).fill(0.5);
const { data, scale } = api.quantize(vector);

console.log('原始大小:', vector.byteLength, 'bytes');
console.log('量化大小:', data.byteLength, 'bytes');
console.log('压缩比:', vector.byteLength / data.byteLength);
```

---

### 系统信息

#### getInfo()

获取系统信息。

```typescript
const info = api.getInfo(): {
    simdCapabilities: { avx2: boolean; avx512f: boolean; fma: boolean };
    threadCount: number;
    vectorCount: number;
    indexType: string;
    dimensions: number;
}
```

---

#### getStats()

获取统计信息。

```typescript
const stats = api.getStats(): {
    totalVectors: number;
    memoryUsage: number;
}
```

---

## 索引系统

### IVFIndex

倒排文件索引，适合大规模数据。

```typescript
import { IVFIndex } from './infrastructure/ivf-index';

const ivf = new IVFIndex({
    dimensions: 128,
    nClusters: 100,
    nProbe: 10
});

// 训练
ivf.train(vectors, iterations);

// 添加
ivf.add('id', vector);

// 搜索
const results = ivf.search(query, k);
```

---

### HybridIndexOptimized

混合索引（IVF + 精排）。

```typescript
import { HybridIndexOptimized } from './infrastructure/tier3-optimizer';

const index = new HybridIndexOptimized({
    dimensions: 128,
    ivfClusters: 100
});

await index.train(vectors);
index.add('id', vector);
const results = index.search(query, k);
```

---

## 分布式搜索

### DistributedSearchEngine

```typescript
import { DistributedSearchEngine } from './infrastructure/distributed-search';

const engine = new DistributedSearchEngine(128);

// 添加分片
engine.addShard('shard1');
engine.addShard('shard2');
engine.addShard('shard3');

// 添加向量
engine.addVector('id', vector);

// 并行搜索
const results = await engine.search(query, 10);
```

---

## 监控系统

### Monitor

```typescript
import { getMonitor } from './infrastructure/monitor';

const monitor = getMonitor();

// 记录指标
monitor.recordMetric('requests', 1);
monitor.recordLatency('search', 50);

// 查询统计
const p99 = monitor.getPercentile('latency_search', 99);
const avg = monitor.getAverage('latency_search');

// 健康检查
const health = await monitor.healthCheck({
    memory: async () => { /* ... */ },
    cpu: async () => { /* ... */
});
```

---

## 反馈学习

### FeedbackLearningSystem

```typescript
import { getFeedbackSystem } from './infrastructure/feedback-learning';

const feedback = getFeedbackSystem();

// 记录展示
feedback.recordImpression(queryId, query, results);

// 记录点击
feedback.recordClick(queryId, resultId);

// 获取权重
const weights = feedback.getWeights();

// 获取报告
feedback.printReport();
```

---

## 系统优化

### SystemOptimizer

```typescript
import { getSystemOptimizer } from './infrastructure/system-optimizer';

const optimizer = getSystemOptimizer();

// 获取报告
optimizer.printReport();

// 获取优化启动命令
const cmd = optimizer.getOptimizedCommand('node app.js');
```

---

## 性能指标

| 指标 | 值 |
|------|-----|
| Top-K QPS | 17,000,000 |
| 搜索延迟 | 1-6 ms |
| INT8 压缩 | 4x |
| 内存占用 | 4 MB |

---

*文档版本: v4.3.0*
*最后更新: 2026-04-15*
