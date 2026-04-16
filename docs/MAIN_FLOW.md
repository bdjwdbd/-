# 元灵系统主流程

## 📊 完整架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     YuanLingSystem 主流程                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  用户消息                                                        │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ L6 灵识层 - 环境感知（startup 时完成）                     │   │
│  │   • 操作系统检测                                          │   │
│  │   • Node 版本检测                                         │   │
│  │   • 工作目录初始化                                        │   │
│  │   • 集成系统初始化                                        │   │
│  │   • 自省评估                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ L0 灵思层 - 思考协议（并行）                               │   │
│  │   • 深度分析（MINIMAL/STANDARD/EXTENSIVE/DEEP）           │   │
│  │   • 假设生成                                              │   │
│  │   • 置信度评估                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ L1 灵枢层 - 决策中心（并行）                               │   │
│  │   • 元认知检查                                            │   │
│  │   • 工具推荐                                              │   │
│  │   • 决策类型判断                                          │   │
│  │     - tool_call: 需要工具调用                             │   │
│  │     - search: 需要搜索                                    │   │
│  │     - clarify: 需要澄清                                   │   │
│  │     - direct_reply: 直接回复                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ L2/L3 灵脉层/灵躯层 - 执行引擎/工具执行                    │   │
│  │   • 构建增强提示词                                        │   │
│  │   • 调用外部执行器                                        │   │
│  │   • 执行工具调用                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ L4 灵盾层 - 安全验证                                      │   │
│  │   • 回复长度检查                                          │   │
│  │   • 错误标记检测                                          │   │
│  │   • 完整性验证                                            │   │
│  │   • 评分（0-100）                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ L5 灵韵层 - 反馈调节                                      │   │
│  │   • 生成优化建议                                          │   │
│  │   • 学习反馈                                              │   │
│  │   • 记录成功/失败案例                                     │   │
│  │   • Darwin Skill 机制                                     │   │
│  │     - 棘轮管理                                            │   │
│  │     - 独立评估                                            │   │
│  │     - 成果卡片                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                           │
│      ▼                                                           │
│  返回结果                                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 核心方法

### 1. startup() - 系统启动

```typescript
async startup(): Promise<{
  introspectionReport?: any;
  environment: { os, nodeVersion, cwd, workspaceRoot };
  integratedSystem?: SystemHealth;
}>
```

**流程**：
1. 环境感知（OS、Node 版本、工作目录）
2. 初始化集成系统
3. 运行自省评估（可选）

### 2. processWithExternalExecutor() - 主处理流程

```typescript
async processWithExternalExecutor(
  userMessage: string,
  sessionHistory: Message[],
  executor: ExternalExecutor
): Promise<{
  result: { content: string; toolCalls?: ToolCall[] };
  context: ProcessingContext;
}>
```

**流程**：
1. **L0/L1 并行执行**（优化点）
   - L0 思考：深度分析、假设生成
   - L1 决策：元认知检查、工具推荐

2. **L2/L3 执行**
   - 构建增强提示词
   - 调用外部执行器

3. **L4 验证**
   - 输出质量评分
   - 问题检测

4. **L5 反馈**
   - 生成优化建议
   - 学习反馈

---

## 📦 已集成的模块

### 自动初始化（构造函数）

| 模块 | 访问器 | 说明 |
|------|--------|------|
| L0Manager | `system.l0Manager` | 思考协议 |
| HNSWIndex | `system.hnswIndex` | 向量索引 |
| VectorQuantizer | `system.vectorQuantizer` | 向量量化 |
| HealthMonitor | `system.healthMonitor` | 健康监控 |
| HybridSearchEngine | `system.hybridSearchEngine` | 混合搜索 |
| SmartMemoryUpgrader | `system.smartMemoryUpgrader` | 智能记忆升级 |
| PersonaManager | `system.personaManager` | 用户画像 |
| NaturalLanguageParser | `system.parser` | 自然语言解析 |

### 按需初始化

| 模块 | 初始化方法 | 访问器 |
|------|-----------|--------|
| HarnessSystem | `initializeHarness()` | `system.harness` |
| DashboardServer | `initializeDashboard(port)` | `system.dashboard` |
| Coordinator | `initializeCoordinator()` | `system.coordinator` |
| EdgeRuntime | `initializeEdgeRuntime(type)` | `system.edgeRuntime` |
| FederatedEngine | `initializeFederatedEngine(role)` | `system.federatedEngine` |

---

## 🎯 使用示例

### 基础使用

```typescript
import { YuanLingSystem } from '@yuanling/core';

// 创建系统实例
const system = new YuanLingSystem({
  workspaceRoot: '/path/to/workspace',
  enableIntrospection: true,
  enableL0: true,
});

// 启动系统
await system.startup();

// 处理消息
const { result, context } = await system.processWithExternalExecutor(
  '用户消息',
  [],
  async (prompt, ctx) => {
    // 调用 LLM
    return { content: '回复内容' };
  }
);

console.log(result.content);
console.log('验证分数:', context.validation?.score);
```

### 完整使用

```typescript
const system = new YuanLingSystem();
await system.startup();

// 初始化所有模块
await system.initializeHarness();
await system.initializeDashboard(3000);
system.initializeCoordinator();
await system.initializeEdgeRuntime();
await system.initializeFederatedEngine();

// 使用自然语言编程
const rule = system.parser?.parseRule('当任务失败时发送通知');

// 使用 Multi-Agent
const coordinator = system.coordinator;
coordinator.registerAgent({
  agentId: 'agent_001',
  name: '搜索专家',
  // ...
});

// 使用边缘计算
const edge = system.edgeRuntime;
await edge.submitTask({ type: 'data_processing', payload: {} });

// 使用联邦学习
const federated = system.federatedEngine;
await federated.startRound();

// 关闭系统
await system.harness?.close();
await system.edgeRuntime?.stop();
await system.federatedEngine?.shutdown();
```

---

## 📈 性能优化

### 已实现的优化

| 优化点 | 说明 |
|--------|------|
| L0/L1 并行 | 思考与决策独立执行 |
| 记忆搜索缓存 | 减少重复搜索 |
| 提示词模板缓存 | 减少字符串操作 |
| 性能监控 | 每层延迟记录 |

### 性能指标

| 层级 | 平均延迟 |
|------|---------|
| L0-L1 并行 | ~10ms |
| L2-L3 执行 | ~100ms（取决于 LLM）|
| L4 验证 | ~1ms |
| L5 反馈 | ~5ms |

---

## 🔧 扩展点

### 1. 自定义工具

```typescript
system.registerTool({
  name: 'custom_tool',
  description: '自定义工具',
  parameters: { type: 'object', properties: {} },
  execute: async (args) => {
    return { result: 'success' };
  },
});
```

### 2. 自定义执行器

```typescript
const customExecutor = async (prompt, context) => {
  // 自定义处理逻辑
  return { content: '自定义回复' };
};

const { result } = await system.processWithExternalExecutor(
  '消息',
  [],
  customExecutor
);
```

### 3. Darwin Skill 机制

```typescript
// 独立评估
const evalResult = await system.evaluateOutput(
  '模块名',
  '输出内容'
);

// 棘轮状态
const ratchetState = system.getRatchetState();

// 运行测试套件
const testResult = await system.runTestSuite(
  '模块名',
  async (prompt) => '执行结果'
);
```

---

*文档版本：v4.7.8*
*最后更新：2026-04-16*
