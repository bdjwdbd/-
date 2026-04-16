# 联邦学习集成

## 📊 概述

联邦学习集成模块在保护隐私的前提下，让多个节点协同学习。

---

## 🚀 快速开始

```typescript
import { createFederatedEngine, FederatedRole, AggregationStrategy, PrivacyStrategy } from '@yuanling/federated';

const engine = createFederatedEngine({
  nodeId: 'server_001',
  role: FederatedRole.SERVER,
  aggregationStrategy: AggregationStrategy.FEDERATED_AVERAGING,
  privacyStrategy: PrivacyStrategy.DIFFERENTIAL_PRIVACY,
  training: {
    localEpochs: 5,
    batchSize: 32,
    learningRate: 0.01,
    optimizer: 'adam',
  },
  communication: {
    minClients: 3,
    maxClients: 100,
    clientFraction: 0.1,
    timeoutMs: 60000,
    maxRetries: 3,
  },
  privacy: {
    epsilon: 1.0,
    delta: 1e-5,
    clipNorm: 1.0,
    noiseScale: 0.1,
  },
});

await engine.initialize();

// 注册客户端
engine.registerClient('client_001');
engine.registerClient('client_002');

// 运行训练轮次
await engine.startRound();
await engine.aggregate();

// 获取状态
const status = engine.getStatus();
```

---

## 🎯 核心概念

### 聚合策略

| 策略 | 说明 |
|------|------|
| FEDERATED_AVERAGING | 联邦平均（默认） |
| WEIGHTED_AVERAGE | 加权平均 |
| MEDIAN | 中位数 |
| TRIMMED_MEAN | 裁剪平均 |
| ROBUST | 鲁棒聚合 |

### 隐私策略

| 策略 | 说明 |
|------|------|
| NONE | 无隐私保护 |
| DIFFERENTIAL_PRIVACY | 差分隐私 |
| SECURE_AGGREGATION | 安全聚合 |
| HOMOMORPHIC_ENCRYPTION | 同态加密 |
| HYBRID | 混合策略 |

### 节点角色

| 角色 | 说明 |
|------|------|
| SERVER | 服务器（聚合器） |
| CLIENT | 客户端（参与者） |
| HYBRID | 两者兼具 |

---

## 📝 训练流程

```
1. 初始化全局模型
       │
       ▼
2. 选择客户端
       │
       ▼
3. 分发全局模型
       │
       ▼
4. 客户端本地训练
       │
       ▼
5. 提交梯度更新
       │
       ▼
6. 应用隐私保护
       │
       ▼
7. 聚合更新
       │
       ▼
8. 更新全局模型
       │
       └──→ 重复 2-8
```

---

## 🔧 配置选项

```typescript
interface FederatedConfig {
  nodeId: string;
  role: FederatedRole;
  aggregationStrategy: AggregationStrategy;
  privacyStrategy: PrivacyStrategy;
  training: {
    localEpochs: number;
    batchSize: number;
    learningRate: number;
    optimizer: 'sgd' | 'adam' | 'rmsprop';
  };
  communication: {
    minClients: number;
    maxClients: number;
    clientFraction: number;
    timeoutMs: number;
    maxRetries: number;
  };
  privacy: {
    epsilon?: number;
    delta?: number;
    clipNorm?: number;
    noiseScale?: number;
  };
}
```

---

## 🎨 架构

```
┌─────────────────────────────────────────────────────────────┐
│                联邦学习引擎 (FederatedEngine)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  客户端管理   │  │  训练流程     │  │  模型管理     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  聚合策略     │  │  隐私保护     │  │  通信管理     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
  │  Client 1   │      │  Client 2   │      │  Client N   │
  │  本地数据    │      │  本地数据    │      │  本地数据    │
  └─────────────┘      └─────────────┘      └─────────────┘
```

---

## 📁 文件结构

```
src/federated/
├── types.ts    # 类型定义
├── engine.ts   # 联邦学习引擎
├── index.ts    # 模块入口
└── test.ts     # 测试脚本
```

---

## 📚 更多资源

- [API 文档](./API.md)
- [使用指南](./GUIDE.md)

---

*版本：v1.0.0 | 更新时间：2026-04-16*
