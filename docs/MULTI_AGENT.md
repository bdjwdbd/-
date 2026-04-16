# 多 Agent 协作系统

## 📊 概述

多 Agent 协作系统让多个 Agent 协同工作，分工合作完成复杂任务。

---

## 🚀 快速开始

```typescript
import { createCoordinator, TaskPriority } from '@yuanling/multi-agent';

// 创建协调器
const coordinator = createCoordinator();

// 注册 Agent
coordinator.registerAgent({
  agentId: 'agent_001',
  name: '搜索专家',
  capabilities: [{ id: 'search', name: '搜索', ... }],
  resourceLimits: { maxConcurrentTasks: 3, ... },
  priority: 1,
  tags: ['search'],
});

// 提交任务
coordinator.submitTask({
  taskId: 'task_001',
  name: '搜索天气',
  input: { query: '北京天气' },
  priority: TaskPriority.HIGH,
  constraints: {
    requiredCapabilities: ['search'],
    timeoutMs: 10000,
    maxRetries: 2,
  },
});
```

---

## 🎯 核心概念

### Agent

Agent 是执行任务的实体，具有：
- **能力**：能执行的任务类型
- **资源限制**：并发数、内存、超时
- **优先级**：调度优先级
- **标签**：分类标识

### 任务

任务是需要完成的工作单元：
- **输入**：任务输入数据
- **优先级**：执行优先级
- **依赖**：前置任务
- **约束**：能力要求、超时、重试次数

### 协调器

协调器负责：
- Agent 注册与管理
- 任务分配与调度
- 消息路由
- 故障检测与恢复

---

## 📡 通信协议

### 消息类型

| 类型 | 说明 |
|------|------|
| TASK_ASSIGN | 分配任务 |
| TASK_ACCEPT | 接受任务 |
| TASK_REJECT | 拒绝任务 |
| TASK_PROGRESS | 任务进度 |
| TASK_COMPLETE | 任务完成 |
| TASK_FAIL | 任务失败 |
| HEARTBEAT | 心跳 |

### 消息格式

```typescript
interface Message {
  messageId: string;
  type: MessageType;
  from: string;
  to?: string;
  timestamp: number;
  payload: any;
  taskId?: string;
  traceId?: string;
}
```

---

## 🔄 调度策略

| 策略 | 说明 |
|------|------|
| ROUND_ROBIN | 轮询分配 |
| LEAST_TASKS | 分配给任务最少的 Agent |
| BEST_PERFORMANCE | 分配给性能最好的 Agent |
| LOWEST_COST | 分配给成本最低的 Agent |
| RANDOM | 随机分配 |

---

## 📊 状态流转

```
任务状态：
PENDING → ASSIGNED → RUNNING → COMPLETED
                   ↘ FAILED → PENDING (重试)
```

```
Agent 状态：
IDLE ↔ BUSY
  ↘ OFFLINE (超时)
  ↘ ERROR
```

---

## 🎨 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      协调器 (Coordinator)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Agent 注册表  │  │   任务队列    │  │    调度器     │       │
│  │  (Registry)  │  │   (Queue)    │  │  (Scheduler) │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    消息路由器                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
  │  Agent 1    │      │  Agent 2    │      │  Agent 3    │
  │  搜索专家    │      │  分析专家    │      │  写作专家    │
  └─────────────┘      └─────────────┘      └─────────────┘
```

---

## 📁 文件结构

```
src/multi-agent/
├── types.ts        # 类型定义
├── coordinator.ts  # 协调器实现
├── index.ts        # 模块入口
└── test.ts         # 测试脚本
```

---

## 🔧 API 参考

### Coordinator

#### registerAgent(definition)

注册 Agent。

```typescript
coordinator.registerAgent({
  agentId: 'agent_001',
  name: '搜索专家',
  capabilities: [...],
  resourceLimits: {...},
  priority: 1,
  tags: ['search'],
});
```

#### submitTask(definition)

提交任务。

```typescript
coordinator.submitTask({
  taskId: 'task_001',
  name: '搜索',
  input: { query: 'test' },
  priority: TaskPriority.HIGH,
  constraints: {...},
});
```

#### getStatus()

获取系统状态。

```typescript
const status = coordinator.getStatus();
// { agents: {...}, tasks: {...} }
```

---

## 📚 更多资源

- [API 文档](./API.md)
- [架构图](./ARCHITECTURE.md)

---

*版本：v1.0.0 | 更新时间：2026-04-16*
