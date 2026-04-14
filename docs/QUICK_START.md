# 元灵系统快速入门指南

> 5 分钟上手元灵系统

---

## 一、什么是元灵系统？

元灵系统是一个具备"思考能力"的 AI Agent 框架，采用六层架构：

```
L0 灵思层 - 思考（Thinking）
L1 灵枢层 - 决策（Decision）
L2 灵脉层 - 执行（Execution）
L3 灵躯层 - 行动（Action）
L4 灵盾层 - 验证（Validation）
L5 灵韵层 - 反馈（Feedback）
L6 灵识层 - 感知（Awareness）
```

---

## 二、快速开始

### 1. 基本使用

```typescript
import { processWithYuanLing } from 'yuanling';

// 处理用户消息
const { result, context } = await processWithYuanLing(
  '请帮我搜索天气',
  [], // 会话历史
  async (prompt, context) => {
    // 你的执行器
    return { content: '处理结果' };
  }
);

console.log(result.content);
console.log(context.thinking);  // L0 思考结果
console.log(context.decision);  // L1 决策结果
console.log(context.validation); // L4 验证结果
```

### 2. 仅思考（不执行）

```typescript
import { getOpenClawBridge } from 'yuanling';

const bridge = getOpenClawBridge();
const thinking = await bridge.thinkOnly('这是一个复杂的问题');

console.log(thinking.depth);    // 思考深度
console.log(thinking.process);  // 思考过程
```

### 3. 自省检查

```typescript
const introspection = await bridge.introspect();
console.log(introspection); // 系统自省报告
```

---

## 三、核心概念

### L0 灵思层（思考）

根据问题复杂度自动调整思考深度：

| 深度 | 适用场景 | Token 预算 |
|------|---------|-----------|
| MINIMAL | 简单问候 | 200 |
| STANDARD | 常规问题 | 400 |
| EXTENSIVE | 复杂分析 | 800 |
| DEEP | 深度推理 | 1500 |

### L1 灵枢层（决策）

决策类型：

| 类型 | 说明 |
|------|------|
| direct_reply | 直接回复 |
| tool_call | 调用工具 |
| search | 搜索信息 |
| clarify | 澄清问题 |

### L4 灵盾层（验证）

验证输出质量：

- 回复长度检查
- 错误标记检测
- 问题回答完整性

---

## 四、监控与优化

### 1. 指标采集

```typescript
import { getMetricsCollector } from 'yuanling';

const metrics = getMetricsCollector();

// 记录请求
metrics.recordRequest(150, true); // 延迟、成功

// 采集系统指标
const sysMetrics = metrics.collectSystemMetrics({
  cacheHitRate: 0.35,
  tokenEfficiency: 0.85,
  taskCompletionRate: 0.95,
});

// 生成报告
console.log(metrics.generateReport());
```

### 2. 缓存优化

```typescript
import { getEnhancedCache } from 'yuanling';

const cache = getEnhancedCache();

// 设置缓存（带标签）
cache.set('key', 'value', undefined, ['天气', '搜索']);

// 语义匹配
const result = cache.get('key', '今天天气如何');

// 查看热点数据
console.log(cache.getHotKeys(5));
```

### 3. 延迟优化

```typescript
import { getLatencyOptimizer } from 'yuanling';

const optimizer = getLatencyOptimizer();

// 检查快速路径
if (optimizer.canUseFastPath('你好')) {
  const fast = optimizer.fastPathProcess('你好');
  console.log(fast.response); // 立即返回
}

// 并行预处理
const results = await optimizer.parallelPreprocess([
  { name: 'task1', fn: async () => 'result1' },
  { name: 'task2', fn: async () => 'result2' },
]);
```

---

## 五、配置选项

### 桥接层配置

```typescript
const bridge = getOpenClawBridge();

// 完整处理流程
const result = await bridge.processMessage(
  message,           // 用户消息
  sessionHistory,    // 会话历史
  executor,          // 执行器函数
);
```

### 缓存配置

```typescript
const cache = new EnhancedCacheSystem({
  maxSize: 1000,           // 最大缓存数
  defaultTTL: 3600000,     // 默认 TTL（1小时）
  semanticThreshold: 0.85, // 语义相似度阈值
  enableSemanticCache: true,
  enableAdaptiveTTL: true,
});
```

---

## 六、常见问题

### Q: 如何自定义决策逻辑？

A: 继承 `OpenClawBridge` 并重写 `makeDecision` 方法。

### Q: 如何添加新的工具？

A: 在执行器中处理 `context.decision.suggestedTools`。

### Q: 如何监控性能？

A: 使用 `getMetricsCollector()` 采集指标，定期生成报告。

---

## 七、下一步

- 阅读 [架构文档](./ARCHITECTURE_FUSION.md)
- 了解 [L0 灵思层](./LING-SI-USAGE.md)
- 查看 [自省系统](./INTROSPECTION_USAGE.md)

---

*最后更新：2026-04-14*
