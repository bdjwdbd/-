# 元灵系统架构 v4.0

## 概述

元灵系统是一个六层架构的 AI Agent 系统，融合了 llm-memory-integration 的所有核心功能。

---

## 六层架构

| 层级 | 名称 | 核心组件 | 职责 |
|------|------|---------|------|
| L1 | 灵枢核心层 | DecisionCenter, MemoryCenter | 决策、协调、身份、规则 |
| L2 | 灵脉记忆层 | MemoryCenterV2, HybridSearchEngine | 记忆存储、混合搜索 |
| L3 | 灵躯编排层 | ExecutionEngine, ToolExecutor | 任务编排、工具执行 |
| L4 | 灵盾执行层 | SecurityGuard, CodeValidatorV2 | 安全防护、代码验证 |
| L5 | 灵韵治理层 | FeedbackCenter, HealthMonitor | 反馈调节、健康监控 |
| L6 | 灵识基建层 | TokenEstimator, CacheSystem | 基础设施、性能优化 |

---

## 核心组件

### 搜索引擎

| 组件 | 文件 | 功能 |
|------|------|------|
| HybridSearchEngine | core/hybrid-search-engine.ts | 混合搜索（向量+FTS+RRF） |
| HNSWIndex | core/hnsw-index.ts | 高效近似最近邻搜索 |
| VectorQuantizer | core/vector-quantizer.ts | 向量量化（FP16/INT8/PQ/SQ） |
| ParallelSearchEngine | core/parallel-search.ts | 并行搜索 |

### 记忆管理

| 组件 | 文件 | 功能 |
|------|------|------|
| MemoryCenterV2 | core/memory-center-v2.ts | 记忆中心 v2 |
| SmartMemoryUpgrader | core/smart-memory-upgrader.ts | 智能记忆升级 |
| PersonaManager | core/persona-manager.ts | 用户画像管理 |

### 监控与安全

| 组件 | 文件 | 功能 |
|------|------|------|
| HealthMonitor | core/health-monitor.ts | 健康监控 |
| CodeValidatorV2 | code-validator-v2.ts | 代码验证 |
| SecurityGuard | security-guard.ts | 安全防护 |

### 基础设施

| 组件 | 文件 | 功能 |
|------|------|------|
| TokenEstimator | core/infrastructure.ts | Token 估算 |
| CacheSystem | core/infrastructure.ts | 缓存系统 |
| PerformanceMonitor | core/infrastructure.ts | 性能监控 |
| StructuredLogger | core/infrastructure.ts | 结构化日志 |

---

## 性能优化

### HNSW 索引

- **搜索复杂度**: O(log N)
- **构建时间**: ~1.2s (1000 向量)
- **搜索时间**: ~1ms

### 向量量化

| 类型 | 压缩比 | 精度损失 |
|------|--------|---------|
| FP16 | 2x | 极小 |
| INT8 | 4x | 小 |
| PQ | 8-32x | 中等 |
| SQ | 4x | 小 |

### 并行处理

- **Worker 线程**: 支持
- **批量查询**: 并行处理
- **CPU 利用**: N 倍加速（N = CPU 核心数）

---

## 配置

### 统一配置文件

位置：`config/yuanling-unified-config.ts`

```typescript
{
  embedding: {
    provider: "openai-compatible",
    baseUrl: "https://ai.gitee.com/v1",
    model: "Qwen3-Embedding-8B",
    dimensions: 4096,
  },
  llm: {
    provider: "openai-compatible",
    baseUrl: "https://ai.gitee.com/v1",
    model: "Qwen3-235B-A22B",
  },
  vectorSearch: {
    topK: 20,
    useHNSW: true,
    useQuantization: false,
  },
}
```

### 环境变量

```bash
EMBEDDING_API_KEY=your-api-key
LLM_API_KEY=your-api-key
```

---

## 使用方式

### 基本使用

```typescript
import { HybridSearchEngine, HealthMonitor } from './src/yuanling-v4';

// 混合搜索
const searchEngine = new HybridSearchEngine({
  embedding: {
    apiKey: process.env.EMBEDDING_API_KEY,
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

// 健康监控
const monitor = new HealthMonitor();
const health = await monitor.checkHealth();
console.log(health.status);
```

### HNSW 索引

```typescript
import { HNSWIndex } from './src/yuanling-v4';

const index = new HNSWIndex({
  dimensions: 4096,
  maxConnections: 16,
  efConstruction: 200,
  efSearch: 50,
});

// 添加向量
index.add('id-1', vector1);
index.addBatch([{ id: 'id-2', vector: vector2 }]);

// 搜索
const results = index.search(queryVector, 10);
```

### 向量量化

```typescript
import { VectorQuantizer } from './src/yuanling-v4';

const quantizer = new VectorQuantizer({
  type: 'int8',
  dimensions: 4096,
});

quantizer.fit(vectors);
const encoded = quantizer.encode(vectors);
const decoded = quantizer.decode(encoded);
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v4.0.0 | 2026-04-13 | TypeScript 原生实现，融合 llm-memory-integration |
| v3.0.0 | 2026-04-13 | Python 桥接层实现 |
| v2.1.0 | 2026-04-13 | memory-tencentdb 融合 |
| v2.0.0 | 2026-04-13 | 六层架构优化 |
| v1.0.0 | 2026-04-12 | 初始版本 |

---

## 文件结构

```
humanoid-agent/
├── src/
│   ├── yuanling-v4.ts          # 统一入口
│   ├── core/
│   │   ├── hybrid-search-engine.ts
│   │   ├── hnsw-index.ts
│   │   ├── vector-quantizer.ts
│   │   ├── smart-memory-upgrader.ts
│   │   ├── persona-manager.ts
│   │   ├── health-monitor.ts
│   │   └── ...
│   ├── layers/
│   │   ├── ling-shu/           # L1 灵枢层
│   │   ├── ling-mai/           # L2 灵脉层
│   │   ├── ling-qu/            # L3 灵躯层
│   │   ├── ling-dun/           # L4 灵盾层
│   │   ├── ling-yun/           # L5 灵韵层
│   │   └── ling-shi/           # L6 灵识层
│   └── llm-memory/             # Python 模块（保留）
├── config/
│   └── yuanling-unified-config.ts
└── docs/
    ├── ARCHITECTURE.md
    └── LLM_MEMORY_FUSION.md
```

---

*最后更新：2026-04-13 13:50*
