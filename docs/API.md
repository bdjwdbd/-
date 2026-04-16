# Harness Engineering API 文档

## 📚 概述

Harness Engineering 是元灵系统的"缰绳系统"，提供状态管理、追踪、PPAF 闭环、沙盒隔离、度量演进五大核心能力。

**版本**：v1.3.1  
**作者**：元灵系统团队  
**许可证**：MIT

---

## 🚀 快速开始

### 安装

```bash
npm install @yuanling/harness
# 或
pnpm add @yuanling/harness
```

### 基本使用

```typescript
import { HarnessSystem } from '@yuanling/harness';

// 创建 Harness 系统
const harness = new HarnessSystem({
  workspaceRoot: '/path/to/workspace',
  enableStateManager: true,
  enableTracing: true,
});

// 初始化
await harness.initialize();

// 使用状态管理
await harness.setState('user:123', { name: 'Alice' }, StateCategory.USER);

// 使用追踪
const trace = harness.startTrace('my_operation', { userId: '123' });
// ... 执行操作
harness.endTrace(trace.traceId, SpanStatus.COMPLETED);

// 关闭
await harness.close();
```

---

## 📦 模块列表

| 模块 | 说明 | 文档 |
|------|------|------|
| StateManager | 状态管理器 | [详细文档](#statemanager) |
| TraceCollector | 追踪收集器 | [详细文档](#tracecollector) |
| PPAFEngine | PPAF 闭环引擎 | [详细文档](#ppafengine) |
| SandboxManager | 沙盒管理器 | [详细文档](#sandboxmanager) |
| EvolutionEngine | 演进引擎 | [详细文档](#evolutionengine) |

---

## 🗄️ StateManager

### 概述

统一状态管理器，支持 6 种状态类别、检查点恢复、审计日志。

### API

#### `setState(key: string, value: any, category?: StateCategory): Promise<void>`

设置状态。

```typescript
await harness.setState('session:abc', { messages: [] }, StateCategory.SESSION);
```

**参数**：
- `key`: 状态键
- `value`: 状态值
- `category`: 状态类别（可选）

**状态类别**：
- `SESSION` - 会话状态
- `TASK` - 任务状态
- `USER` - 用户状态
- `MEMORY` - 记忆状态
- `TOOL` - 工具状态
- `SYSTEM` - 系统状态

---

#### `getState<T>(key: string): Promise<T | null>`

获取状态。

```typescript
const session = await harness.getState('session:abc');
```

---

#### `createCheckpoint(keys: string[], description?: string): Promise<string>`

创建检查点。

```typescript
const checkpointId = await harness.createCheckpoint(
  ['session:abc', 'user:123'],
  '处理前检查点'
);
```

---

#### `restoreCheckpoint(checkpointId: string): Promise<number>`

从检查点恢复。

```typescript
const restored = await harness.restoreCheckpoint(checkpointId);
console.log(`恢复了 ${restored} 个状态`);
```

---

## 🔍 TraceCollector

### 概述

全链路追踪收集器，支持 L0-L6 七层追踪、决策审计、异常检测。

### API

#### `startTrace(name: string, attributes?: Record<string, any>): TraceContext`

开始追踪。

```typescript
const trace = harness.startTrace('process_message', {
  userId: '123',
  messageLength: 100,
});
```

---

#### `endTrace(traceId: string, status: SpanStatus): void`

结束追踪。

```typescript
harness.endTrace(trace.traceId, SpanStatus.COMPLETED);
// 或
harness.endTrace(trace.traceId, SpanStatus.FAILED);
```

---

#### `recordDecision(decision: DecisionRecord): void`

记录决策。

```typescript
harness.recordDecision({
  spanId: 'decision_1',
  input: '用户输入',
  reasoning: '思考过程',
  output: '决策结果',
  confidence: 0.85,
  alternatives: [
    { description: '方案A', probability: 0.3, reason: '原因' },
  ],
});
```

---

## 🔄 PPAFEngine

### 概述

PPAF 闭环引擎，实现 Perception → Planning → Action → Feedback 循环。

### API

#### `getPerceptor(): Perceptor`

获取感知器。

```typescript
const perceptor = ppafEngine.getPerceptor();
const result = await perceptor.perceive([
  { type: PerceptionType.TEXT, data: '用户消息', timestamp: Date.now() },
]);
```

---

#### `getPlanner(): Planner`

获取规划器。

```typescript
const planner = ppafEngine.getPlanner();
const plan = await planner.plan(perceptionResult, PlanningLevel.OPERATIONAL);
```

---

#### `getExecutor(): Executor`

获取执行器。

```typescript
const executor = ppafEngine.getExecutor();
const result = await executor.execute(action);
```

---

#### `getFeedbackProcessor(): FeedbackProcessor`

获取反馈处理器。

```typescript
const feedbackProcessor = ppafEngine.getFeedbackProcessor();
const feedback = await feedbackProcessor.process(executionResult);
```

---

## 🛡️ SandboxManager

### 概述

四级沙盒管理器，支持风险评估、资源限制、权限控制。

### API

#### `assessRisk(operation: Operation): RiskAssessment`

评估风险。

```typescript
const assessment = sandboxManager.assessRisk({
  type: 'exec',
  input: 'rm -rf /',
  tools: ['exec', 'shell'],
});

console.log(assessment.level);        // 'critical'
console.log(assessment.recommendedLevel); // 4 (L4 物理级)
```

**风险级别**：
- `LOW` - 低风险
- `MEDIUM` - 中等风险
- `HIGH` - 高风险
- `CRITICAL` - 极高风险

**沙盒级别**：
- `L1` - 进程级隔离
- `L2` - 容器级隔离
- `L3` - 虚拟机级隔离
- `L4` - 物理级隔离

---

#### `create(options: SandboxOptions): Promise<Sandbox>`

创建沙盒。

```typescript
const sandbox = await sandboxManager.create({
  name: 'my_sandbox',
  level: SandboxLevel.VM,
  resourceLimits: {
    cpu: 50,      // 50%
    memory: 512,  // 512MB
    disk: 1024,   // 1GB
    network: 100, // 100KB/s
  },
});
```

---

#### `execute<T>(sandboxId: string, fn: () => Promise<T>): Promise<SandboxExecutionResult<T>>`

在沙盒中执行。

```typescript
const result = await sandboxManager.execute(sandbox.sandboxId, async () => {
  // 危险操作
  return await dangerousOperation();
});

if (result.success) {
  console.log(result.output);
} else {
  console.error(result.error);
}
```

---

#### `destroy(sandboxId: string): Promise<void>`

销毁沙盒。

```typescript
await sandboxManager.destroy(sandbox.sandboxId);
```

---

## 📊 EvolutionEngine

### 概述

演进引擎，支持度量收集、分析诊断、A/B 测试、灰度发布。

### API

#### `recordMetric(name: string, value: number, labels?: Record<string, string>): void`

记录指标。

```typescript
evolutionEngine.recordMetric('response_time', 1500, { operation: 'search' });
evolutionEngine.recordMetric('accuracy', 0.85);
```

---

#### `getScore(): OverallScore`

获取综合评分。

```typescript
const score = evolutionEngine.getScore();
console.log(`总分: ${score.total}`);
console.log(`效能: ${score.byCategory[MetricCategory.EFFICIENCY]}`);
console.log(`质量: ${score.byCategory[MetricCategory.QUALITY]}`);
```

---

#### `getSuggestions(): OptimizationSuggestion[]`

获取优化建议。

```typescript
const suggestions = evolutionEngine.getSuggestions();
for (const s of suggestions) {
  console.log(`[${s.priority}] ${s.targetMetric}: ${s.description}`);
}
```

---

#### `createABTest(config: ABTestConfig): ABTestConfig`

创建 A/B 测试。

```typescript
const abTest = evolutionEngine.createABTest({
  name: 'test_optimization',
  controlConfig: { cache_enabled: false },
  experimentConfig: { cache_enabled: true },
  trafficSplit: 0.5,
  targetMetrics: ['accuracy', 'response_time'],
  minSampleSize: 1000,
  significanceLevel: 0.95,
});
```

---

#### `createCanaryRelease(config: CanaryReleaseConfig): CanaryReleaseConfig`

创建灰度发布。

```typescript
const canary = evolutionEngine.createCanaryRelease({
  name: 'new_algorithm',
  newConfig: { algorithm: 'v2' },
  currentRatio: 0,
  targetRatio: 1.0,
  incrementStep: 0.1,
  rollbackThreshold: 0.8,
  monitorMetrics: ['accuracy', 'error_rate'],
});
```

---

## 🔗 深度集成

### YuanLingHarnessDeepIntegration

将 Harness 深度集成到元灵系统 L0-L6 各层。

```typescript
import { createDeepIntegratedSystem } from '@yuanling/harness/integration';

const integrated = await createDeepIntegratedSystem(yuanling, {
  workspaceRoot: '/path/to/workspace',
  enableStateManager: true,
  enableTracing: true,
  enablePPAF: true,
  enableSandbox: true,
  enableMetrics: true,
  enableAutoRiskAssessment: true,
});

// 处理消息（自动包含风险评估、沙盒隔离、追踪、度量）
const result = await integrated.process(
  '用户消息',
  sessionHistory,
  executor
);

console.log(result.harness.traceId);           // 追踪 ID
console.log(result.harness.sandboxId);         // 沙盒 ID
console.log(result.harness.riskAssessment);    // 风险评估
console.log(result.harness.metrics);           // 性能指标
console.log(result.harness.score);             // 综合评分
```

---

## 📝 类型定义

### StateCategory

```typescript
enum StateCategory {
  SESSION = 'session',
  TASK = 'task',
  USER = 'user',
  MEMORY = 'memory',
  TOOL = 'tool',
  SYSTEM = 'system',
}
```

### RiskLevel

```typescript
enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

### SandboxLevel

```typescript
enum SandboxLevel {
  PROCESS = 1,    // L1 进程级
  CONTAINER = 2,  // L2 容器级
  VM = 3,         // L3 虚拟机级
  PHYSICAL = 4,   // L4 物理级
}
```

### MetricCategory

```typescript
enum MetricCategory {
  EFFICIENCY = 'efficiency',
  QUALITY = 'quality',
  RESOURCE = 'resource',
  SECURITY = 'security',
}
```

---

## ⚙️ 配置选项

### HarnessSystemConfig

```typescript
interface HarnessSystemConfig {
  workspaceRoot: string;        // 工作目录
  enableStateManager: boolean;  // 启用状态管理
  enableTracing: boolean;       // 启用追踪
  traceSampleRate: number;      // 追踪采样率 (0-1)
  enableAudit: boolean;         // 启用审计
}
```

### SandboxManagerConfig

```typescript
interface SandboxManagerConfig {
  workspaceRoot: string;
  defaultLevel: SandboxLevel;
  maxSandboxes: number;
  enableMonitoring: boolean;
  enableAudit: boolean;
}
```

### EvolutionConfig

```typescript
interface EvolutionConfig {
  workspaceRoot: string;
  collectionInterval: number;   // 收集间隔 (ms)
  analysisInterval: number;     // 分析间隔 (ms)
  enableAutoOptimization: boolean;
  enableABTesting: boolean;
  enableCanaryRelease: boolean;
}
```

---

## 🐛 错误处理

所有 API 都可能抛出以下错误：

```typescript
try {
  await harness.setState('key', 'value');
} catch (error) {
  if (error instanceof StateError) {
    console.error('状态错误:', error.message);
  } else if (error instanceof SandboxError) {
    console.error('沙盒错误:', error.message);
  } else {
    throw error;
  }
}
```

---

## 📚 更多资源

- [使用指南](./GUIDE.md)
- [示例代码](./EXAMPLES.md)
- [性能报告](./PERFORMANCE.md)
- [变更日志](./CHANGELOG.md)

---

*文档版本：v1.3.1 | 更新时间：2026-04-16*
