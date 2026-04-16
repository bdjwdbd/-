# Harness Engineering 使用指南

## 🎯 目标读者

本文档面向希望使用 Harness Engineering 的开发者，帮助你快速上手并正确使用各项功能。

---

## 📋 目录

1. [核心概念](#核心概念)
2. [快速开始](#快速开始)
3. [最佳实践](#最佳实践)
4. [常见问题](#常见问题)
5. [故障排查](#故障排查)

---

## 核心概念

### 什么是 Harness Engineering？

Harness Engineering 是围绕 AI Agent 构建的约束、反馈与控制系统，让 Agent 在人类设定的边界内自主、可靠、可持续地工作。

**核心隐喻**：
- 🐴 **马** = AI/Agent（能力强但不可控）
- 🎇 **缰绳** = Harness（约束、引导、纠偏系统）
- 🤠 **骑手** = 工程师（设计系统、设定边界）

### 五大核心能力

| 能力 | 说明 | 使用场景 |
|------|------|---------|
| **状态管理** | 外部托管所有状态 | 会话持久化、检查点恢复 |
| **追踪** | 全链路追踪 L0-L6 | 调试、审计、性能分析 |
| **PPAF 闭环** | 感知→规划→执行→反馈 | 复杂任务处理 |
| **沙盒隔离** | 四级安全隔离 | 危险操作保护 |
| **度量演进** | 持续优化 | 性能监控、A/B 测试 |

### R.E.S.T 模型

| 维度 | 说明 | Harness 支持 |
|------|------|-------------|
| **Reliability** | 可靠性 | 检查点恢复、重试降级、灰度回滚 |
| **Efficiency** | 效率 | 分层存储、并行规划、效能指标 |
| **Security** | 安全 | 加密审计、四级沙盒、风险评估 |
| **Traceability** | 可追溯性 | 全链路追踪、决策审计、度量分析 |

---

## 快速开始

### 1. 安装

```bash
npm install @yuanling/harness
```

### 2. 基础使用

```typescript
import { HarnessSystem, StateCategory, SpanStatus } from '@yuanling/harness';

// 创建系统
const harness = new HarnessSystem({
  workspaceRoot: './workspace',
  enableStateManager: true,
  enableTracing: true,
});

await harness.initialize();

// 状态管理
await harness.setState('session:123', { messages: [] }, StateCategory.SESSION);
const session = await harness.getState('session:123');

// 追踪
const trace = harness.startTrace('my_operation');
// ... 执行操作
harness.endTrace(trace.traceId, SpanStatus.COMPLETED);

await harness.close();
```

### 3. 深度集成

```typescript
import { createDeepIntegratedSystem } from '@yuanling/harness/integration';

const integrated = await createDeepIntegratedSystem(yuanling, {
  workspaceRoot: './workspace',
  enableStateManager: true,
  enableTracing: true,
  enablePPAF: true,
  enableSandbox: true,
  enableMetrics: true,
});

// 一行代码获得完整 Harness 能力
const result = await integrated.process('用户消息', [], executor);
```

---

## 最佳实践

### 状态管理

#### ✅ 推荐做法

```typescript
// 1. 使用有意义的键名
await harness.setState('session:user123', data, StateCategory.SESSION);
await harness.setState('task:search_456', taskData, StateCategory.TASK);

// 2. 定期创建检查点
const checkpoint = await harness.createCheckpoint(
  ['session:user123'],
  '处理前检查点'
);

// 3. 关键操作前后都创建检查点
await harness.createCheckpoint(keys, '操作前');
await riskyOperation();
await harness.createCheckpoint(keys, '操作后');
```

#### ❌ 避免做法

```typescript
// 1. 不要存储过大的数据
await harness.setState('huge_data', massiveObject); // ❌

// 2. 不要忘记清理过期状态
// 应该定期清理
await harness.deleteState('old_session');
```

---

### 追踪

#### ✅ 推荐做法

```typescript
// 1. 使用有意义的追踪名称
const trace = harness.startTrace('process_user_message', {
  userId: '123',
  messageLength: 100,
});

// 2. 记录关键决策
harness.recordDecision({
  spanId: 'decision_1',
  input: userInput,
  reasoning: '基于用户意图选择工具',
  output: 'selected_tool: search',
  confidence: 0.85,
  alternatives: [
    { description: 'direct_reply', probability: 0.15, reason: '简单问题' },
  ],
});

// 3. 正确处理异常
try {
  await operation();
  harness.endTrace(trace.traceId, SpanStatus.COMPLETED);
} catch (error) {
  harness.endTrace(trace.traceId, SpanStatus.FAILED);
  throw error;
}
```

---

### 沙盒隔离

#### ✅ 推荐做法

```typescript
// 1. 先评估风险
const assessment = sandboxManager.assessRisk({
  type: 'exec',
  input: userInput,
  tools: inferredTools,
});

// 2. 使用推荐的沙盒级别
const sandbox = await sandboxManager.create({
  name: 'operation_sandbox',
  level: assessment.recommendedLevel,
});

// 3. 在沙盒中执行
const result = await sandboxManager.execute(sandbox.sandboxId, async () => {
  return await riskyOperation();
});

// 4. 及时销毁沙盒
await sandboxManager.destroy(sandbox.sandboxId);
```

#### ❌ 避免做法

```typescript
// 1. 不要忽略风险评估
const sandbox = await sandboxManager.create({
  name: 'sandbox',
  level: SandboxLevel.PROCESS, // ❌ 应该先评估
});

// 2. 不要忘记销毁沙盒
const sandbox = await sandboxManager.create({ name: 'temp' });
// ... 使用后忘记销毁 ❌
```

---

### 度量演进

#### ✅ 推荐做法

```typescript
// 1. 记录关键指标
evolutionEngine.recordMetric('response_time', duration, { operation: 'search' });
evolutionEngine.recordMetric('accuracy', accuracy);
evolutionEngine.recordTaskCompletion(success, 'search');

// 2. 定期检查评分
const score = evolutionEngine.getScore();
if (score.total < 70) {
  console.warn('系统评分偏低，需要优化');
}

// 3. 关注优化建议
const suggestions = evolutionEngine.getSuggestions();
for (const s of suggestions) {
  if (s.priority === 'critical') {
    console.error(`需要立即处理: ${s.targetMetric}`);
  }
}
```

---

## 常见问题

### Q1: 状态存储在哪里？

**A**: 默认使用分层存储：
- **L1 内存**：热数据，快速访问
- **L2 文件**：持久化存储，支持加密

可以自定义存储后端：

```typescript
const harness = new HarnessSystem({
  workspaceRoot: './workspace',
  stateStore: new CustomStateStore(), // 自定义存储
});
```

---

### Q2: 追踪数据会占用多少空间？

**A**: 每个追踪约 1-5KB，默认保留 7 天。可以通过配置调整：

```typescript
const harness = new HarnessSystem({
  traceRetentionDays: 3, // 保留 3 天
  traceSampleRate: 0.1,  // 10% 采样率
});
```

---

### Q3: 如何选择沙盒级别？

**A**: 系统会自动评估风险并推荐级别：

| 操作类型 | 推荐级别 | 说明 |
|---------|---------|------|
| 简单问答 | L1 进程级 | 低风险 |
| 文件读取 | L2 容器级 | 中等风险 |
| 命令执行 | L3 虚拟机级 | 高风险 |
| 危险操作 | L4 物理级 | 极高风险 |

---

### Q4: 度量数据如何使用？

**A**: 度量数据用于：
1. **实时监控**：查看系统健康状态
2. **优化建议**：自动生成优化建议
3. **A/B 测试**：验证优化效果
4. **灰度发布**：安全上线新功能

---

### Q5: 如何处理性能问题？

**A**: 如果遇到性能问题：

1. **检查追踪采样率**
```typescript
traceSampleRate: 0.1, // 降低采样率
```

2. **减少状态存储**
```typescript
// 只存储必要数据
await harness.setState('key', { essential: 'data' });
```

3. **使用缓存**
```typescript
const cached = await harness.getState('cached_result');
if (cached) return cached;
```

---

## 故障排查

### 问题 1: 初始化失败

**症状**：`initialize()` 抛出错误

**排查步骤**：
1. 检查工作目录权限
2. 检查磁盘空间
3. 查看错误日志

```typescript
try {
  await harness.initialize();
} catch (error) {
  console.error('初始化失败:', error);
  // 检查权限
  await fs.promises.access(workspaceRoot, fs.constants.R_OK | fs.constants.W_OK);
}
```

---

### 问题 2: 沙盒创建失败

**症状**：`create()` 返回错误

**排查步骤**：
1. 检查沙盒数量限制
2. 检查资源配额
3. 检查系统支持

```typescript
const status = sandboxManager.getStatus();
if (status.activeSandboxes >= status.maxSandboxes) {
  console.error('已达到最大沙盒数量');
}
```

---

### 问题 3: 追踪数据丢失

**症状**：追踪 ID 无效或数据不完整

**排查步骤**：
1. 检查是否正确调用 `endTrace()`
2. 检查追踪保留时间
3. 检查采样率

```typescript
// 确保正确结束追踪
try {
  await operation();
} finally {
  harness.endTrace(trace.traceId, SpanStatus.COMPLETED);
}
```

---

## 📚 更多资源

- [API 文档](./API.md)
- [示例代码](./EXAMPLES.md)
- [性能报告](./PERFORMANCE.md)

---

*文档版本：v1.3.1 | 更新时间：2026-04-16*
