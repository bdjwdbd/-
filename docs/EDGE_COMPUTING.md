# 边缘计算支持

## 📊 概述

边缘计算支持模块提供轻量级运行时，支持离线模式和资源受限环境。

---

## 🚀 快速开始

```typescript
import { createEdgeRuntime, EdgeNodeType } from '@yuanling/edge';

const runtime = createEdgeRuntime({
  nodeId: 'edge_001',
  name: 'My Edge Node',
  type: EdgeNodeType.EDGE_SERVER,
  capabilities: {
    cpuCores: 4,
    memoryMB: 2048,
    storageMB: 10240,
    persistentStorage: true,
    networkBandwidth: 100,
    offlineSupport: true,
    batteryPowered: false,
  },
  limits: {
    maxMemoryMB: 1536,
    maxCpuPercent: 80,
    maxStorageMB: 8192,
    maxTasks: 100,
  },
});

await runtime.start();

// 提交任务
const task = await runtime.submitTask('数据处理', 'compute', { data: 'test' });

// 执行任务
const result = await runtime.executeTask(task.taskId);

// 查看状态
const status = runtime.getStatus();

await runtime.stop();
```

---

## 🎯 节点类型

| 类型 | 说明 | 典型配置 |
|------|------|---------|
| EMBEDDED | 嵌入式设备 | 1核/256MB/512MB |
| IOT_GATEWAY | IoT 网关 | 2核/1GB/4GB |
| EDGE_SERVER | 边缘服务器 | 4核/2GB/10GB |
| MOBILE | 移动设备 | 4核/2GB/8GB |

---

## 📝 功能特性

### 1. 资源限制

- 内存限制
- CPU 使用限制
- 存储空间限制
- 任务数量限制

### 2. 离线模式

- 离线任务队列
- 数据缓存
- 自动同步

### 3. 同步机制

- 定时同步
- 重试机制
- 冲突解决

### 4. 任务管理

- 任务提交
- 任务执行
- 状态追踪

---

## 🔧 配置选项

```typescript
interface EdgeNodeConfig {
  nodeId: string;
  name: string;
  type: EdgeNodeType;
  capabilities: EdgeNodeCapabilities;
  limits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
    maxStorageMB: number;
    maxTasks: number;
  };
  sync: {
    enabled: boolean;
    endpoint?: string;
    intervalMs: number;
    retryCount: number;
  };
  offline: {
    enabled: boolean;
    maxQueueSize: number;
    ttlMs: number;
  };
}
```

---

## 📊 运行时状态

```typescript
interface EdgeRuntimeStatus {
  node: {
    id: string;
    name: string;
    type: EdgeNodeType;
  };
  sync: {
    status: SyncStatus;
    lastSyncAt?: number;
    pendingRecords: number;
  };
  resources: {
    memoryUsedMB: number;
    memoryTotalMB: number;
    cpuPercent: number;
    storageUsedMB: number;
    storageTotalMB: number;
  };
  tasks: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    queuedOffline: number;
  };
  uptime: number;
}
```

---

## 🎨 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    边缘运行时 (EdgeRuntime)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   任务管理    │  │   状态管理    │  │   同步管理    │       │
│  │ TaskManager  │  │ StateManager │  │ SyncManager  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    资源监控                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
  │  云端同步    │      │  本地存储    │      │  传感器/设备 │
  └─────────────┘      └─────────────┘      └─────────────┘
```

---

## 📁 文件结构

```
src/edge/
├── types.ts    # 类型定义
├── runtime.ts  # 运行时
├── index.ts    # 模块入口
└── test.ts     # 测试脚本
```

---

## 📚 更多资源

- [API 文档](./API.md)
- [使用指南](./GUIDE.md)

---

*版本：v1.0.0 | 更新时间：2026-04-16*
