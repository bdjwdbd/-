# 元灵系统 v4.0 使用指南

## 快速开始

### 安装

```bash
cd humanoid-agent
npm install
```

### 基本使用

```typescript
import {
  HybridSearchEngine,
  HNSWIndex,
  HealthMonitor,
} from './src/index';

// 1. 混合搜索
const searchEngine = new HybridSearchEngine({
  embedding: {
    apiKey: process.env.EMBEDDING_API_KEY!,
    baseUrl: 'https://ai.gitee.com/v1',
    model: 'Qwen3-Embedding-8B',
    dimensions: 4096,
  },
});

await searchEngine.initialize();
const results = await searchEngine.search({
  query: '搜索内容',
  limit: 10,
});

// 2. HNSW 索引
const index = new HNSWIndex({
  dimensions: 4096,
  maxConnections: 16,
});

index.add('id-1', vector);
const searchResults = index.search(queryVector, 10);

// 3. 健康监控
const monitor = new HealthMonitor();
const health = await monitor.checkHealth();
console.log(health.status);
```

---

## 核心功能

### 1. 混合搜索

支持三种搜索模式：
- **向量搜索**：语义相似度
- **FTS 搜索**：关键词匹配
- **RRF 融合**：结果融合

```typescript
const results = await searchEngine.search({
  query: '查询内容',
  limit: 10,
  useVector: true,
  useFTS: true,
  mode: 'balanced',  // 'fast' | 'balanced' | 'full'
});
```

### 2. HNSW 索引

高效的近似最近邻搜索：

```typescript
const index = new HNSWIndex({
  dimensions: 4096,
  maxConnections: 16,      // M: 每层最大连接数
  efConstruction: 200,     // 构建时搜索宽度
  efSearch: 50,            // 搜索时搜索宽度
});

// 批量添加
index.addBatch(vectors);

// 搜索
const results = index.search(queryVector, 10);

// 持久化
const json = index.toJSON();
// 恢复
const restored = HNSWIndex.fromJSON(json);
```

### 3. 向量量化

减少内存占用：

```typescript
import { VectorQuantizer } from './src/index';

// INT8 量化（4x 压缩）
const quantizer = new VectorQuantizer({
  type: 'int8',
  dimensions: 4096,
});

quantizer.fit(vectors);
const encoded = quantizer.encode(vectors);
const decoded = quantizer.decode(encoded);
```

支持的量化类型：
- `fp16`: 2x 压缩
- `int8`: 4x 压缩
- `pq`: 8-32x 压缩
- `sq`: 4x 压缩

### 4. 健康监控

```typescript
const monitor = new HealthMonitor();

// 健康检查
const health = await monitor.checkHealth();

// 向量覆盖率
const coverage = await monitor.getCoverageStats();

// 性能指标
monitor.recordSearchTime(100);  // 记录搜索时间
monitor.recordError();          // 记录错误
```

---

## 性能优化

### HNSW 性能

| 操作 | 时间 |
|------|------|
| 构建（1000 向量） | ~1.2s |
| 搜索 | ~0.25ms |
| 内存（1000 向量） | ~1.4MB |

### 量化效果

| 类型 | 压缩比 | 精度损失 |
|------|--------|---------|
| FP16 | 2x | 极小 |
| INT8 | 4x | 小 |
| PQ | 8-32x | 中等 |

---

## 配置

### 环境变量

```bash
# Embedding API
EMBEDDING_API_KEY=your-api-key
EMBEDDING_BASE_URL=https://ai.gitee.com/v1
EMBEDDING_MODEL=Qwen3-Embedding-8B

# LLM API
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://ai.gitee.com/v1
LLM_MODEL=Qwen3-235B-A22B
```

### 代码配置

```typescript
import { ConfigManager } from './src/index';

const configManager = new ConfigManager();
const config = configManager.getConfig();

// 更新配置
configManager.updateConfig({
  vectorSearch: {
    topK: 20,
    useHNSW: true,
  },
});
```

---

## 常见问题

### Q: 向量搜索不工作？

检查：
1. 数据库文件是否存在
2. sqlite-vec 扩展是否加载
3. Embedding API 是否配置

### Q: 性能不够快？

优化建议：
1. 使用 HNSW 索引
2. 启用向量量化
3. 增加缓存大小

### Q: 内存占用过高？

解决方案：
1. 使用向量量化
2. 减少缓存大小
3. 定期清理旧数据

---

## 版本信息

- **版本**: v4.0.0
- **更新日期**: 2026-04-13
- **技术栈**: TypeScript + Node.js 22+
