# 元灵系统作为主系统 - 使用指南

## 架构概述

```
用户消息 → 元灵系统（L0思考 + L1决策）→ OpenClaw（执行）→ 元灵系统（L4验证 + L5反馈）→ 返回结果
```

**核心理念**：元灵系统负责"思考"，OpenClaw 负责"执行"。

## 快速开始

### 1. 基本使用

```typescript
import { processWithYuanLing, YuanLingContext } from 'yuanling';

// 定义执行器（调用 OpenClaw）
async function openclawExecutor(
  prompt: string, 
  context: YuanLingContext
): Promise<OpenClawResult> {
  // 这里调用 OpenClaw 的 Agent Loop
  // 可以通过 WebSocket 或 RPC 调用
  const response = await fetch('http://127.0.0.1:18789/api/agent', {
    method: 'POST',
    body: JSON.stringify({ 
      message: prompt,
      context: context 
    }),
  });
  return response.json();
}

// 处理消息
const { result, context } = await processWithYuanLing(
  '帮我读取 package.json 文件',
  [], // 会话历史
  openclawExecutor
);

console.log('结果:', result.content);
console.log('验证分数:', context.validation?.score);
```

### 2. 使用桥接类

```typescript
import { getOpenClawBridge } from 'yuanling';

const bridge = getOpenClawBridge();

// 仅思考（不执行）
const thinking = await bridge.thinkOnly('这是一个复杂的问题吗？');
console.log('思考深度:', thinking?.depth);

// 完整处理
const { result, context } = await bridge.processMessage(
  '用户消息',
  sessionHistory,
  openclawExecutor
);

// 查看上下文
console.log('L0 思考:', context.thinking);
console.log('L1 决策:', context.decision);
console.log('L4 验证:', context.validation);
console.log('L5 反馈:', context.feedback);
```

## 处理流程详解

### L0 灵思层 - 思考

每次对话前自动运行：

1. **分析复杂度**：根据消息长度、关键词、问题数量
2. **选择深度**：minimal / standard / extensive / deep
3. **生成假设**：多个可能的解释或方案
4. **输出思考过程**：注入到提示中

### L1 灵枢层 - 决策

基于思考结果做决策：

| 决策类型 | 触发条件 | 行为 |
|---------|---------|------|
| `direct_reply` | 简单问题 | 直接回复 |
| `tool_call` | 包含工具关键词 | 调用工具 |
| `search` | 疑问句 + 查询词 | 搜索信息 |
| `clarify` | 需要确认 | 请求澄清 |

### OpenClaw 执行层

元灵系统将增强后的提示发送给 OpenClaw：

```
[元灵思考] 思考深度: extensive, 置信度: 0.85
活跃假设: 用户需要读取文件, 用户可能想了解项目结构

[决策] 基于 extensive 思考，建议 tool_call
建议工具: file, read

[用户消息]
帮我读取 package.json 文件
```

### L4 灵盾层 - 验证

检查输出质量：

- 回复长度
- 错误标记
- 问题完整性
- 静默标记

评分 0-100，低于 60 分为不通过。

### L5 灵韵层 - 反馈

生成改进建议：

- 如果分数低于 80，标记为需要学习
- 根据问题生成具体建议

## 与 OpenClaw 集成

### 方式 1：WebSocket 客户端

```typescript
import WebSocket from 'ws';

async function createOpenClawExecutor(ws: WebSocket) {
  return async (prompt: string, context: YuanLingContext) => {
    return new Promise((resolve) => {
      ws.send(JSON.stringify({
        type: 'req',
        id: Date.now().toString(),
        method: 'agent',
        params: { message: prompt }
      }));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.type === 'res') {
          resolve({
            content: response.payload?.content || '',
            usage: response.payload?.usage,
          });
        }
      });
    });
  };
}
```

### 方式 2：HTTP API

```typescript
async function httpExecutor(prompt: string, context: YuanLingContext) {
  const response = await fetch('http://127.0.0.1:18789/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt }),
  });
  
  const data = await response.json();
  return {
    content: data.content,
    usage: data.usage,
  };
}
```

### 方式 3：直接调用（同进程）

```typescript
import { runEmbeddedPiAgent } from 'openclaw';

async function embeddedExecutor(prompt: string, context: YuanLingContext) {
  const result = await runEmbeddedPiAgent({
    message: prompt,
    // 其他参数...
  });
  
  return {
    content: result.content,
    toolCalls: result.toolCalls,
    usage: result.usage,
  };
}
```

## 配置选项

```typescript
import { getYuanLingCore, YuanLingConfig } from 'yuanling';

const config: Partial<YuanLingConfig> = {
  workspaceRoot: '/path/to/workspace',
  enableL0: true,           // 启用 L0 思考
  enableIntrospection: true, // 启用自省
};

const core = getYuanLingCore(config);
```

## 自省系统

当系统有变动时，自动生成报告：

```typescript
const bridge = getOpenClawBridge();

// 检查是否有变动
if (bridge.yuanling.hasSystemChanges()) {
  const report = await bridge.introspect();
  console.log(report);
}
```

输出示例：

```
┌──────────────────────────────────────────────────┐
│        元灵自省报告 - 2026/4/14        │
├──────────────────────────────────────────────────┤
│ 变更内容:
│   • 代码变更: 新增 OpenClaw 桥接层
├──────────────────────────────────────────────────┤
│ 能力提升:
│   ✅ 理解准确率: 75% → 85% (+10%)
│   ✅ 任务完成率: 70% → 82% (+12%)
├──────────────────────────────────────────────────┤
│ 待优化项:
│   🔴 代码质量: 50% (目标: 85%)
│   🟠 资源效率: 51% (目标: 80%)
├──────────────────────────────────────────────────┤
│ 综合评分: 78.5 (+1.6)
└──────────────────────────────────────────────────┘
```

## 版本历史

- **v4.1.0** (2026-04-14) - 新增 OpenClaw 桥接层，元灵作为主系统
- **v4.0.0** (2026-04-13) - 完整七层架构
- **v3.0.0** (2026-04-13) - L0 灵思层实现
