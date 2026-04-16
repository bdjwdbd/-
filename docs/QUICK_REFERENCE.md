# Harness Engineering 快速参考

## 🚀 一分钟上手

```typescript
import { HarnessSystem } from '@yuanling/harness';

const harness = new HarnessSystem({ workspaceRoot: './workspace' });
await harness.initialize();

// 状态管理
await harness.setState('key', { data: 'value' });
const state = await harness.getState('key');

// 追踪
const trace = harness.startTrace('operation');
// ... 执行操作
harness.endTrace(trace.traceId, 'completed');

await harness.close();
```

---

## 📦 模块速查

| 模块 | 用途 | 核心类 |
|------|------|--------|
| 状态管理 | 持久化存储 | `StateManager` |
| 追踪 | 全链路追踪 | `TraceCollector` |
| PPAF | 闭环控制 | `PPAFEngine` |
| 沙盒 | 安全隔离 | `SandboxManager` |
| 度量 | 性能监控 | `EvolutionEngine` |

---

## 🎯 常用 API

### 状态管理

```typescript
// 设置状态
await harness.setState('key', value, StateCategory.SESSION);

// 获取状态
const state = await harness.getState('key');

// 创建检查点
const checkpoint = await harness.createCheckpoint(['key1', 'key2']);

// 恢复检查点
await harness.restoreCheckpoint(checkpoint);
```

### 追踪

```typescript
// 开始追踪
const trace = harness.startTrace('name', { attr: 'value' });

// 创建子跨度
const span = harness.startSpan(trace.traceId, 'child', Layer.L0);

// 结束追踪
harness.endSpan(span.spanId, SpanStatus.COMPLETED);
harness.endTrace(trace.traceId, SpanStatus.COMPLETED);
```

### 沙盒

```typescript
// 风险评估
const assessment = sandboxManager.assessRisk({
  type: 'exec',
  input: 'command',
  tools: ['exec'],
});

// 创建沙盒
const sandbox = await sandboxManager.create({
  name: 'sandbox',
  level: assessment.recommendedLevel,
});

// 执行
const result = await sandboxManager.execute(sandbox.sandboxId, async () => {
  return await dangerousOperation();
});

// 销毁
await sandboxManager.destroy(sandbox.sandboxId);
```

### 度量

```typescript
// 记录指标
engine.recordMetric('response_time', 1500);
engine.recordTaskCompletion(true, 'search');

// 获取评分
const score = engine.getScore();

// 获取建议
const suggestions = engine.getSuggestions();
```

---

## 🛡️ 风险级别

| 级别 | 沙盒 | 示例 |
|------|------|------|
| LOW | L1 进程级 | 简单问答 |
| MEDIUM | L2 容器级 | 文件读取 |
| HIGH | L3 虚拟机级 | 命令执行 |
| CRITICAL | L4 物理级 | rm -rf / |

---

## 📊 状态类别

| 类别 | TTL | 持久化 | 用途 |
|------|-----|--------|------|
| SESSION | 1小时 | ❌ | 会话数据 |
| TASK | 24小时 | ✅ | 任务数据 |
| USER | 永久 | ✅ | 用户数据 |
| MEMORY | 永久 | ✅ | 记忆数据 |
| TOOL | 1小时 | ❌ | 工具状态 |
| SYSTEM | 永久 | ✅ | 系统配置 |

---

## 🔄 PPAF 流程

```
Perception → Planning → Action → Feedback
    感知        规划       行动       反馈
```

---

## 📈 度量类别

| 类别 | 指标 |
|------|------|
| 效能 | 任务完成率、响应时间、吞吐量 |
| 质量 | 准确率、一致性、用户满意度 |
| 资源 | CPU、内存、磁盘、网络 |
| 安全 | 权限违规、数据泄露、攻击尝试 |

---

## 🔗 深度集成

```typescript
import { createDeepIntegratedSystem } from '@yuanling/harness/integration';

const integrated = await createDeepIntegratedSystem(yuanling, {
  enableStateManager: true,
  enableTracing: true,
  enablePPAF: true,
  enableSandbox: true,
  enableMetrics: true,
});

const result = await integrated.process('用户消息', [], executor);
// result.harness.traceId
// result.harness.sandboxId
// result.harness.riskAssessment
// result.harness.metrics
// result.harness.score
```

---

## ⚡ 性能基准

| 操作 | 耗时 |
|------|------|
| 状态管理 | 0.01 ms |
| 追踪 | 0.02 ms |
| 完整流程 | 1.10 ms |

---

## 🐛 故障排查

| 问题 | 解决方案 |
|------|---------|
| 初始化失败 | 检查工作目录权限 |
| 沙盒创建失败 | 检查沙盒数量限制 |
| 追踪数据丢失 | 确保调用 endTrace |
| 状态未找到 | 检查 key 和 category |

---

## 📚 更多文档

- [API 文档](./API.md)
- [使用指南](./GUIDE.md)
- [示例代码](./EXAMPLES.md)
- [架构图](./ARCHITECTURE.md)

---

*版本：v1.3.1 | 更新：2026-04-16*
