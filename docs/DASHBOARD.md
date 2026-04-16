# Harness Dashboard 可视化监控面板

## 📊 概述

Harness Dashboard 是一个实时可视化监控面板，用于展示 Harness 系统的运行状态。

---

## 🚀 快速开始

### 启动 Dashboard

```typescript
import { HarnessSystem } from '@yuanling/harness';
import { createDashboard } from '@yuanling/harness/dashboard';

const harness = new HarnessSystem({ workspaceRoot: './workspace' });
await harness.initialize();

const dashboard = await createDashboard(harness, { port: 3000 });
// 访问 http://localhost:3000
```

### 命令行启动

```bash
npx ts-node src/dashboard/test.ts
```

---

## 🎯 功能特性

### 1. 实时追踪可视化

- 追踪列表展示
- 追踪详情查看
- 跨度层级展示
- 状态实时更新

### 2. 性能指标仪表盘

- 综合评分展示
- 四类指标（效能/质量/资源/安全）
- 趋势图表
- 历史对比

### 3. 沙盒状态监控

- 沙盒列表
- 级别分布
- 执行统计
- 资源使用

### 4. 状态管理监控

- 状态总数
- 分类统计
- 检查点数量
- 命中率

### 5. 优化建议

- 自动生成建议
- 优先级排序
- 详细描述
- 一键应用

---

## 📡 API 接口

### GET /api/stats

获取统计数据。

**响应**：
```json
{
  "traces": {
    "total": 100,
    "active": 5,
    "completed": 90,
    "failed": 5,
    "avgDuration": 120
  },
  "states": {
    "total": 50,
    "byCategory": {
      "session": 20,
      "task": 15
    },
    "checkpoints": 3
  },
  "sandboxes": {
    "total": 10,
    "active": 2,
    "byLevel": {
      "L1": 5,
      "L2": 3
    }
  },
  "metrics": {
    "score": 75.5,
    "byCategory": {
      "efficiency": 80,
      "quality": 72
    }
  }
}
```

### GET /api/traces

获取追踪列表。

### GET /api/trace/:id

获取追踪详情。

### GET /api/sandboxes

获取沙盒列表。

### GET /api/metrics

获取度量数据。

---

## 🎨 界面预览

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Harness Dashboard                          ● 运行中     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 追踪统计      │  │ 状态管理      │  │ 沙盒隔离      │      │
│  │ 总计: 100    │  │ 总计: 50     │  │ 总计: 10     │      │
│  │ 活跃: 5      │  │ 会话: 20     │  │ L1: 5        │      │
│  │ 完成: 90     │  │ 任务: 15     │  │ L2: 3        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              综合评分: 75.5                          │   │
│  │     ⬤ 效能: 80  ⬤ 质量: 72                         │   │
│  │     ⬤ 资源: 85  ⬤ 安全: 65                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 最近追踪                                             │   │
│  │ ├─ process_message          ✅ completed             │   │
│  │ ├─ execute_command          ✅ completed             │   │
│  │ └─ read_file                🔄 running               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ 配置选项

```typescript
interface DashboardConfig {
  /** 端口（默认: 3000） */
  port: number;
  
  /** 工作目录 */
  workspaceRoot: string;
  
  /** 刷新间隔（毫秒，默认: 1000） */
  refreshInterval: number;
}
```

---

## 🔧 自定义

### 自定义主题

修改 `server.ts` 中的 CSS 样式：

```css
:root {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent: #3b82f6;
}
```

### 添加自定义指标

```typescript
// 在 collectStats() 中添加
customMetrics: {
  myMetric: await calculateMyMetric(),
}
```

---

## 📊 性能影响

| 指标 | 值 |
|------|-----|
| 内存占用 | ~20MB |
| CPU 使用 | <1% |
| 刷新延迟 | <10ms |
| 页面加载 | <100ms |

---

## 🐛 故障排查

### 端口被占用

```bash
# 查看端口占用
lsof -i :3000

# 使用其他端口
const dashboard = await createDashboard(harness, { port: 3001 });
```

### 数据不更新

检查 Harness 系统是否正常运行：

```typescript
const status = harness.getStatus();
console.log(status);
```

---

## 📚 更多资源

- [API 文档](./API.md)
- [使用指南](./GUIDE.md)
- [架构图](./ARCHITECTURE.md)

---

*版本：v1.0.0 | 更新时间：2026-04-16*
