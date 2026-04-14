# 灵思层（L0）使用指南

## 概述

灵思层是元灵系统的新增层级，基于 Thinking Claude v5.1-extensive 协议设计。它在所有交互前执行深度思考过程，提升 AI 的推理质量和回答可靠性。

## 核心组件

### 1. ThinkingProtocolEngine（思考协议引擎）

主引擎，负责协调整个思考流程。

```typescript
import { ThinkingProtocolEngine, HumanMessage } from "./layers/ling-si";

const engine = new ThinkingProtocolEngine({
  visible: false,           // 思考过程是否对用户可见
  maxThinkingTokens: 1500,  // 最大思考 token
  enableMultiHypothesis: true,
  enableRecursiveThinking: true,
});

const message: HumanMessage = {
  id: "msg-1",
  content: "如何优化数据库查询性能？",
  type: "text",
  timestamp: Date.now(),
  sessionId: "session-1",
};

const result = await engine.execute(message);

console.log(result.depth);        // 思考深度
console.log(result.confidence);   // 置信度
console.log(result.insights);     // 关键洞察
console.log(result.content);      // 完整思考内容
```

### 2. AdaptiveDepthController（自适应深度控制器）

根据问题特征动态调整思考深度。

```typescript
import { AdaptiveDepthController } from "./layers/ling-si";

const controller = new AdaptiveDepthController();

const assessment = controller.assessDepth(message);

console.log(assessment.depth);      // minimal | standard | extensive | deep
console.log(assessment.score);      // 0-1 分数
console.log(assessment.tokenBudget); // 推荐的 token 预算
```

**深度级别**：

| 级别 | Token 预算 | 适用场景 |
|------|-----------|----------|
| MINIMAL | 100 | 简单问候、确认 |
| STANDARD | 300 | 常规问题、信息查询 |
| EXTENSIVE | 800 | 复杂分析、代码审查 |
| DEEP | 1500 | 深度推理、架构设计 |

### 3. MultiHypothesisManager（多假设管理器）

在思考过程中保持多个工作假设。

```typescript
import { MultiHypothesisManager, ThinkingStepName } from "./layers/ling-si";

const manager = new MultiHypothesisManager();

// 添加假设
const h1 = manager.addHypothesis(
  "用户想要代码示例",
  ThinkingStepName.MULTIPLE_HYPOTHESES,
  0.6
);

// 添加证据
manager.addEvidence(h1.id, "用户使用了'示例'这个词", true);

// 获取活跃假设
const active = manager.getActiveHypotheses();

// 确认假设
manager.confirmHypothesis(h1.id, "用户明确要求代码");

// 生成摘要
console.log(manager.generateSummary());
```

### 4. ThoughtFlowSynthesizer（思维流合成器）

将思考过程合成为自然的意识流文本。

```typescript
import { ThoughtFlowSynthesizer } from "./layers/ling-si";

const synthesizer = new ThoughtFlowSynthesizer();

// 完整思维流
const fullFlow = synthesizer.synthesize(result);

// 简洁版本
const briefFlow = synthesizer.synthesizeBrief(result);

// Markdown 格式
const markdownFlow = synthesizer.synthesizeMarkdown(result);
```

## 快速使用

### 快速思考

```typescript
import { quickThink } from "./layers/ling-si";

const result = await quickThink("什么是机器学习？");
```

### 深度思考

```typescript
import { deepThink } from "./layers/ling-si";

const result = await deepThink(
  "请分析微服务架构的优缺点"
);
```

### 简单思考

```typescript
import { minimalThink } from "./layers/ling-si";

const result = await minimalThink("你好");
```

## 思考步骤

灵思层包含 10 个思考步骤，根据深度级别选择性执行：

| 步骤 | 名称 | 描述 |
|------|------|------|
| 1 | Initial Engagement | 理解问题、形成印象、识别歧义 |
| 2 | Problem Analysis | 分解问题、识别需求、考虑约束 |
| 3 | Multiple Hypotheses | 生成多种解释和方案 |
| 4 | Natural Discovery | 像侦探一样探索问题 |
| 5 | Testing Verification | 质疑假设、验证结论 |
| 6 | Error Correction | 发现错误、修正理解 |
| 7 | Knowledge Synthesis | 连接信息、构建图景 |
| 8 | Pattern Recognition | 发现模式、应用模式 |
| 9 | Progress Tracking | 追踪进展、评估置信度 |
| 10 | Recursive Thinking | 宏观与微观的递归分析 |

**执行顺序**：

- MINIMAL: 步骤 1-2
- STANDARD: 步骤 1-4
- EXTENSIVE: 步骤 1-8
- DEEP: 步骤 1-10

## 与其他层级集成

### 与 DecisionCenter 集成

```typescript
import { DecisionCenter } from "./layers/ling-shu";
import { thinkingProtocolEngine } from "./layers/ling-si";

class DecisionCenterV3 extends DecisionCenter {
  async makeDecision(context) {
    // 1. 执行思考协议
    const thinking = await thinkingProtocolEngine.execute(context.message);
    
    // 2. 将思考结果注入决策上下文
    const enrichedContext = {
      ...context,
      thinking,
    };
    
    // 3. 继续原有决策流程
    return super.makeDecision(enrichedContext);
  }
}
```

### 与 LearningValidator 集成

```typescript
import { LearningValidator } from "./layers/ling-dun";
import { multiHypothesisManager } from "./layers/ling-si";

class LearningValidatorV3 extends LearningValidator {
  async validate(result) {
    // 1. 获取活跃假设
    const hypotheses = multiHypothesisManager.getActiveHypotheses();
    
    // 2. 对每个假设进行验证
    for (const hypothesis of hypotheses) {
      const validation = await this.validateHypothesis(hypothesis, result);
      if (validation.confirmed) {
        multiHypothesisManager.confirmHypothesis(
          hypothesis.id, 
          validation.evidence
        );
      }
    }
    
    // 3. 继续原有验证流程
    return super.validate(result);
  }
}
```

## 配置选项

```typescript
interface ThinkingConfig {
  // 是否对用户可见
  visible: boolean;
  
  // 显示格式: hidden | collapsed | visible
  format: "hidden" | "collapsed" | "visible";
  
  // 最大思考 token
  maxThinkingTokens: number;
  
  // 是否启用多假设
  enableMultiHypothesis: boolean;
  
  // 最大假设数量
  maxHypotheses: number;
  
  // 是否启用递归思考
  enableRecursiveThinking: boolean;
  
  // 最大递归深度
  maxRecursionDepth: number;
  
  // 是否启用自我验证
  enableSelfVerification: boolean;
  
  // 思考超时 (ms)
  timeout: number;
}
```

## 自然语言过渡

灵思层使用自然语言过渡来增强思考的真实感：

```typescript
import { getRandomTransition, NATURAL_TRANSITIONS } from "./layers/ling-si";

// 获取随机过渡语
const transition = getRandomTransition("discovery");
// 输出: "Actually, this reminds me of..." 或类似

// 可用类别
NATURAL_TRANSITIONS.start      // 思考开始
NATURAL_TRANSITIONS.discovery  // 发现模式
NATURAL_TRANSITIONS.deeper     // 深入分析
NATURAL_TRANSITIONS.questioning // 质疑假设
NATURAL_TRANSITIONS.correction  // 错误修正
NATURAL_TRANSITIONS.connection  // 连接想法
NATURAL_TRANSITIONS.synthesis   // 总结
NATURAL_TRANSITIONS.uncertainty // 不确定性
```

## 示例输出

### 输入

```
如何优化数据库查询性能？
```

### 思考过程（内部）

```
Hmm, let me think about this...

Let me understand what's being asked here. The user is asking about database query optimization.

My first impression is... This is a technical question about database performance.

Looking at the broader context... This appears to be a standalone request without specific context.

What I know: the user's message. What I need to find out: the exact scope of the request.

Now, let me break this down...
Core components: database, query, performance, optimization

Explicit requirements:
  - Action: optimize
  - Provide detailed information

Implicit requirements:
  - Provide practical solutions
  - Consider different database types

Let me consider different ways to interpret this...
Interpretation 1: The user wants general optimization techniques.
Interpretation 2: The user has a specific performance problem.
Interpretation 3: The user wants to learn about query optimization.

Putting this all together...
The key insight here is: The user needs practical, actionable optimization techniques.

I'm about 75% confident in this analysis.
```

### 最终回复

```
数据库查询性能优化可以从以下几个方面入手：

1. **索引优化**
   - 为常用查询字段创建索引
   - 避免过度索引
   - 使用复合索引优化多条件查询

2. **查询优化**
   - 避免 SELECT *
   - 使用 EXPLAIN 分析查询计划
   - 优化 JOIN 操作

3. **数据库设计**
   - 合理的表结构设计
   - 适当的范式化/反范式化
   - 分区表设计

4. **缓存策略**
   - 使用查询缓存
   - 应用层缓存
   - Redis 等外部缓存

需要我针对某个具体方面详细说明吗？
```

## 最佳实践

1. **让系统自动选择深度**：不要手动指定深度，让 AdaptiveDepthController 根据问题特征自动选择。

2. **信任思考结果**：思考过程会识别歧义和不确定性，在回复前检查 `needsClarification`。

3. **利用假设管理**：对于复杂问题，检查 `hypotheses` 了解系统考虑了哪些可能性。

4. **监控 token 使用**：对于 token 敏感场景，检查 `tokensUsed` 并调整 `maxThinkingTokens`。

5. **渐进式思考**：对于需要多轮对话的场景，保持 `ThinkingProtocolEngine` 实例以复用假设状态。

---

*最后更新：2026-04-13*
