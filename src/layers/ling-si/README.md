# 灵思层（L0）- 思考协议实现

> 基于 Thinking Claude v5.1-extensive 协议设计的深度思考系统

## 简介

灵思层是元灵系统的新增层级，在所有交互前执行深度思考过程，显著提升 AI 的推理质量和回答可靠性。

## 特性

- 🧠 **强制思考协议** - 每次交互前必须思考
- 📊 **自适应深度控制** - 根据问题复杂度动态调整
- 💭 **多假设管理** - 保持多个工作假设，避免过早收敛
- 🎯 **Token 感知** - 智能预算分配和压缩
- 📚 **领域模板** - 5 个预置模板，支持自定义
- 📈 **可视化** - 4 种格式输出思考过程
- ⚙️ **配置系统** - 4 个预设，灵活定制

## 快速开始

### 安装

```bash
npm install @yuanling/ling-si
```

### 基础使用

```typescript
import { TokenAwareThinkingEngine } from "@yuanling/ling-si";

const engine = new TokenAwareThinkingEngine();

const { result } = await engine.executeWithTokenAwareness({
  id: "msg-1",
  content: "如何优化数据库查询性能？",
  type: "text",
  timestamp: Date.now(),
  sessionId: "session-1",
});

console.log(result.insights);
```

### 使用配置预设

```typescript
import { configManager } from "@yuanling/ling-si";

// 切换预设
configManager.usePreset("quality");  // 高质量模式
configManager.usePreset("fast");     // 快速响应模式
configManager.usePreset("production"); // 生产环境模式
```

### 可视化

```typescript
import { thinkingVisualizer } from "@yuanling/ling-si";

// ASCII 格式
const ascii = thinkingVisualizer.toASCII(result);

// Markdown 格式
const markdown = thinkingVisualizer.toMarkdown(result);

// JSON 格式
const json = thinkingVisualizer.toJSON(result);

// Mermaid 流程图
const mermaid = thinkingVisualizer.toMermaid(result);
```

## 配置预设

| 预设 | 用途 | 特点 |
|------|------|------|
| `default` | 默认配置 | 平衡性能与质量 |
| `production` | 生产环境 | 高性能、低延迟 |
| `quality` | 复杂任务 | 高质量、深度思考 |
| `fast` | 简单任务 | 快速响应、最小思考 |

## 思考深度

| 深度 | Token 范围 | 适用场景 |
|------|-----------|----------|
| `MINIMAL` | 50-150 | 简单问候、确认 |
| `STANDARD` | 150-400 | 常规问题、信息查询 |
| `EXTENSIVE` | 400-1000 | 复杂分析、代码审查 |
| `DEEP` | 1000-2000 | 深度推理、架构设计 |

## 领域模板

| 模板 | 领域 | 触发关键词 |
|------|------|-----------|
| `codeReview` | 编程 | 代码、审查、检查 |
| `architectureDesign` | 架构 | 架构、设计、系统 |
| `problemDiagnosis` | 故障诊断 | 问题、错误、失败 |
| `dataAnalysis` | 数据分析 | 数据、分析、统计 |
| `learningTeaching` | 教育学习 | 学习、教程、入门 |

## API 文档

### 核心引擎

#### `ThinkingProtocolEngine`

基础思考协议引擎。

```typescript
const engine = new ThinkingProtocolEngine({
  maxThinkingTokens: 1500,
  enableMultiHypothesis: true,
});

const result = await engine.execute(message);
```

#### `TokenAwareThinkingEngine`

Token 感知思考引擎（推荐）。

```typescript
const engine = new TokenAwareThinkingEngine({
  maxTokens: 4096,
  enableCache: true,
  enableCompression: true,
});

const { result, allocation, wasCompressed } = 
  await engine.executeWithTokenAwareness(message, contextTokens);
```

### 控制器

#### `AdaptiveDepthController`

自适应深度控制器。

```typescript
const controller = new AdaptiveDepthController();
const assessment = controller.assessDepth(message);
// assessment.depth: 思考深度
// assessment.score: 评估分数
// assessment.tokenBudget: 推荐预算
```

#### `MultiHypothesisManager`

多假设管理器。

```typescript
const manager = new MultiHypothesisManager();

// 添加假设
const h1 = manager.addHypothesis("假设内容", ThinkingStepName.MULTIPLE_HYPOTHESES, 0.6);

// 添加证据
manager.addEvidence(h1.id, "支持证据", true);

// 确认假设
manager.confirmHypothesis(h1.id, "确认原因");
```

### 上下文管理

#### `ContextManager`

上下文管理器。

```typescript
const manager = new ContextManager({
  maxTokens: 4096,
  resetThreshold: 0.8,
});

// 添加消息
manager.addMessage(message);

// 获取状态
const state = manager.getState();

// 生成交接文档
const handover = manager.generateHandover();
```

## 命令行工具

```bash
# 运行演示
npm run demo

# 运行测试
npm run test

# 验证集成
npm run verify

# 交互式 CLI
npm run cli
```

## 预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 复杂问题解决率 | 70% | 85% | +15% |
| 首次回答准确率 | 75% | 88% | +13% |
| 错误自发现率 | 20% | 60% | +40% |
| 多方案考虑率 | 30% | 80% | +50% |

## 文件结构

```
src/layers/ling-si/
├── index.ts                      # 入口文件
├── types.ts                      # 类型定义
├── ThinkingProtocolEngine.ts     # 思考协议引擎
├── AdaptiveDepthController.ts    # 深度控制器
├── MultiHypothesisManager.ts     # 假设管理器
├── ThoughtFlowSynthesizer.ts     # 思维流合成器
├── ThinkingSteps.ts              # 基础思考步骤
├── EnhancedThinkingSteps.ts      # 增强思考步骤
├── ThinkingOptimization.ts       # 优化组件
├── OptimizedThinkingEngine.ts    # 优化引擎
├── TokenAwareThinking.ts         # Token 感知
├── ContextManager.ts             # 上下文管理
├── ThinkingTemplates.ts          # 领域模板
├── ThinkingVisualization.ts      # 可视化
├── ConfigManager.ts              # 配置管理
└── cli.ts                        # 命令行工具
```

## 参考资料

- [Thinking Claude](https://github.com/richards199999/Thinking-Claude)
- [元灵系统架构](../../docs/ARCHITECTURE_FUSION.md)
- [使用指南](../../docs/LING-SI-USAGE.md)

## 许可证

MIT

---

*基于 Thinking Claude v5.1-extensive 设计 | 元灵系统 v2.3.0*
