# 六层架构详细文档

## 📊 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     元灵系统六层架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  L6 灵识层 → 感知与唤醒                                          │
│      │                                                           │
│      ▼                                                           │
│  L0 灵思层 → 思考协议                                            │
│      │                                                           │
│      ▼                                                           │
│  L1 灵枢层 → 决策与协调                                          │
│      │                                                           │
│      ▼                                                           │
│  L2 灵脉层 → 执行与流转                                          │
│      │                                                           │
│      ▼                                                           │
│  L3 灵躯层 → 行动与工具                                          │
│      │                                                           │
│      ▼                                                           │
│  L4 灵盾层 → 防护与验证                                          │
│      │                                                           │
│      ▼                                                           │
│  L5 灵韵层 → 反馈与调节                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## L0 灵思层 - 思考协议

### 功能

在所有交互前执行深度思考，基于 Thinking Claude 协议设计。

### 核心组件

| 组件 | 功能 |
|------|------|
| EnhancedThinkingEngine | 增强思考引擎 |
| MultiHypothesisManager | 多假设管理器 |
| DomainIntegrator | 领域集成器 |
| NaturalLanguageInjector | 自然语言注入器 |

### 使用方式

```typescript
import { EnhancedThinkingEngine } from './layers/ling-si';

const engine = new EnhancedThinkingEngine({
  defaultDepth: 'extensive',
  maxTokens: 4000,
});

const result = await engine.think({
  role: 'user',
  content: '用户消息',
});

console.log('思考深度:', result.depth);
console.log('置信度:', result.confidence);
```

### 思考深度

| 深度 | 说明 | 使用场景 |
|------|------|---------|
| MINIMAL | 最小思考 | 简单查询 |
| STANDARD | 标准思考 | 常规交互 |
| EXTENSIVE | 广泛思考 | 复杂问题 |
| DEEP | 深度思考 | 关键决策 |

---

## L1 灵枢层 - 决策与协调

### 功能

分析用户意图，做出执行决策。

### 核心组件

| 组件 | 功能 |
|------|------|
| DecisionCenter | 决策中心 |
| IntentAnalyzer | 意图分析器 |
| ToolRecommender | 工具推荐器 |

### 决策类型

| 类型 | 说明 |
|------|------|
| tool_call | 需要工具调用 |
| search | 需要搜索 |
| clarify | 需要澄清 |
| direct_reply | 直接回复 |

### 使用方式

```typescript
import { DecisionCenter } from './layers/ling-shu';

const center = new DecisionCenter();
const decision = center.analyze('用户消息');

console.log('决策类型:', decision.type);
console.log('推荐工具:', decision.suggestedTools);
```

---

## L2 灵脉层 - 执行与流转

### 功能

管理执行流程，协调任务流转。

### 核心组件

| 组件 | 功能 |
|------|------|
| FlowEngine | 流程引擎 |
| WorkflowOrchestrator | 工作流编排器 |

### 使用方式

```typescript
import { FlowEngine } from './layers/ling-mai';

const engine = new FlowEngine();
const flow = engine.createFlow('my-flow', [
  { id: 'step1', action: 'analyze', params: {} },
  { id: 'step2', action: 'execute', params: {} },
]);

await engine.execute(flow, context);
```

---

## L3 灵躯层 - 行动与工具

### 功能

执行具体工具调用，管理工具生命周期。

### 核心组件

| 组件 | 功能 |
|------|------|
| ToolOrchestrator | 工具编排器 |
| ToolRegistry | 工具注册表 |

### 使用方式

```typescript
import { ToolOrchestrator } from './layers/ling-qu';

const orchestrator = new ToolOrchestrator();

// 注册工具
orchestrator.registerTool({
  name: 'my_tool',
  description: '我的工具',
  parameters: { type: 'object', properties: {} },
  execute: async (args) => 'result',
});

// 执行工具
const result = await orchestrator.execute('my_tool', { param: 'value' });
```

---

## L4 灵盾层 - 防护与验证

### 功能

安全验证，防止无限循环和上下文爆炸。

### 核心组件

| 组件 | 功能 |
|------|------|
| ToolExecutionGuard | 工具执行守卫 |
| LoopDetector | 循环检测器 |
| OutputTruncator | 输出截断器 |

### 使用方式

```typescript
import { ToolExecutionGuard, LoopDetector, OutputTruncator } from './layers/ling-dun';

// 循环检测
const detector = new LoopDetector();
const result = detector.recordCall('tool_name', { args }, 'msg_id');
if (result.shouldInterrupt) {
  throw new Error('检测到循环');
}

// 输出截断
const truncator = new OutputTruncator({ maxOutputChars: 50000 });
const truncated = truncator.process(longOutput);

// 执行守卫
const guard = new ToolExecutionGuard();
const preCheck = guard.preCheck({ toolName: 'tool', args: {}, messageId: '1', sessionId: 's1' });
if (!preCheck.allowed) {
  throw new Error(preCheck.reason);
}
```

---

## L5 灵韵层 - 反馈与调节

### 功能

收集反馈，持续学习和优化。

### 核心组件

| 组件 | 功能 |
|------|------|
| FeedbackRegulator | 反馈调节器 |
| RatchetManager | 棘轮管理器 |
| IndependentEvaluator | 独立评估器 |

### 使用方式

```typescript
import { FeedbackRegulator, RatchetManager } from './layers/ling-yun';

// 反馈调节
const regulator = new FeedbackRegulator();
const feedback = regulator.generateFeedback({
  score: 80,
  issues: ['回复过短'],
});
console.log('建议:', feedback.suggestions);

// 棘轮管理
const ratchet = new RatchetManager({ enabled: true });
await ratchet.recordResult('module', 85);
const best = ratchet.getBestState();
console.log('最佳分数:', best.score);
```

---

## L6 灵识层 - 感知与唤醒

### 功能

环境感知，三步唤醒。

### 核心组件

| 组件 | 功能 |
|------|------|
| EnvironmentAwareness | 环境感知 |
| ThreeStepWakeup | 三步唤醒 |

### 使用方式

```typescript
import { EnvironmentAwareness, ThreeStepWakeup } from './layers/ling-shi';

// 环境感知
const awareness = new EnvironmentAwareness();
const env = awareness.getEnvironment();
console.log('操作系统:', env.os);
console.log('Node 版本:', env.nodeVersion);

// 三步唤醒
const wakeup = new ThreeStepWakeup();
await wakeup.execute();
```

---

## 统一接口

### ILayer 接口

所有层级必须实现此接口：

```typescript
interface ILayer<TConfig, TResult> {
  readonly layerId: LayerId;
  readonly layerName: LayerName;
  readonly description: string;
  readonly config: TConfig;
  
  initialize(): Promise<void>;
  execute(context: LayerContext): Promise<LayerResult<TResult>>;
  getState(): LayerState;
  reset(): void;
  shutdown(): Promise<void>;
}
```

### BaseLayer 基类

提供通用实现：

```typescript
class MyLayer extends BaseLayer<MyConfig, MyResult> {
  readonly layerId = 'L0';
  readonly layerName = 'ling-si';
  readonly description = '我的层级';
  
  protected async onExecute(context: LayerContext): Promise<LayerResult<MyResult>> {
    // 实现具体逻辑
    return {
      success: true,
      layerId: this.layerId,
      data: { /* 结果数据 */ },
      executionTimeMs: 0,
    };
  }
}
```

### LayerManager 管理器

管理所有层级：

```typescript
const manager = new LayerManager();
manager.registerLayer(new MyLayer());

// 初始化
await manager.initializeAll();

// 顺序执行
const results = await manager.executeSequential(context);

// 并行执行
const results = await manager.executeParallel(context);

// 关闭
await manager.shutdownAll();
```

---

*文档版本：v1.0*
*最后更新：2026-04-16*
