# 元灵系统 API 参考

---

## 核心模块

### processWithYuanLing

处理用户消息的快捷函数。

```typescript
function processWithYuanLing(
  message: string,
  sessionHistory: OpenClawMessage[],
  executor: (prompt: string, context: YuanLingContext) => Promise<OpenClawResult>
): Promise<{
  result: OpenClawResult;
  context: YuanLingContext;
}>
```

**参数**：
- `message`: 用户消息
- `sessionHistory`: 会话历史
- `executor`: 执行器函数

**返回**：
- `result.content`: 回复内容
- `result.toolCalls`: 工具调用列表
- `result.usage`: Token 使用情况
- `context.thinking`: L0 思考结果
- `context.decision`: L1 决策结果
- `context.validation`: L4 验证结果
- `context.feedback`: L5 反馈结果

---

### getOpenClawBridge

获取桥接层实例。

```typescript
function getOpenClawBridge(): OpenClawBridge
```

**OpenClawBridge 方法**：

| 方法 | 说明 |
|------|------|
| `processMessage()` | 完整处理流程 |
| `thinkOnly()` | 仅思考 |
| `introspect()` | 自省检查 |
| `getLastContext()` | 获取上次上下文 |

---

## 监控模块

### getMetricsCollector

获取指标采集器。

```typescript
function getMetricsCollector(): MetricsCollector
```

**MetricsCollector 方法**：

| 方法 | 说明 |
|------|------|
| `recordRequest(latency, success)` | 记录请求 |
| `collectSystemMetrics(components)` | 采集系统指标 |
| `collectComponentMetrics(id, metrics)` | 采集组件指标 |
| `getLatestSystemMetrics()` | 获取最新指标 |
| `getSystemMetricsHistory(hours)` | 获取历史指标 |
| `getActiveAlerts(hours)` | 获取活跃告警 |
| `generateReport()` | 生成报告 |

---

### getEnhancedCache

获取增强型缓存。

```typescript
function getEnhancedCache(): EnhancedCacheSystem
```

**EnhancedCacheSystem 方法**：

| 方法 | 说明 |
|------|------|
| `generateKey(input, context?)` | 生成缓存键 |
| `get(key, originalInput?)` | 获取缓存 |
| `set(key, value, ttl?, tags?)` | 设置缓存 |
| `getStats()` | 获取统计 |
| `getHotKeys(limit)` | 获取热点数据 |
| `warmup(entries)` | 预热缓存 |
| `clear()` | 清空缓存 |

---

### getLatencyOptimizer

获取延迟优化器。

```typescript
function getLatencyOptimizer(): LatencyOptimizer
```

**LatencyOptimizer 方法**：

| 方法 | 说明 |
|------|------|
| `canUseFastPath(message)` | 检查快速路径 |
| `fastPathProcess(message)` | 快速路径处理 |
| `parallelPreprocess(tasks)` | 并行预处理 |
| `warmup()` | 预热 |
| `streamResponse(content, chunkSize)` | 流式响应 |
| `getLatencyStats()` | 获取延迟统计 |

---

### getTokenCalibrator

获取 Token 校准器。

```typescript
function getTokenCalibrator(): TokenCalibrator
```

**TokenCalibrator 方法**：

| 方法 | 说明 |
|------|------|
| `recordCalibration(model, estimated, actual, type)` | 记录校准数据 |
| `calibrate(model, estimated, type)` | 校准估算 |
| `getModelCalibration(model)` | 获取模型校准 |
| `getStats()` | 获取统计 |
| `reset()` | 重置 |

---

## 类型定义

### OpenClawMessage

```typescript
interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

### OpenClawResult

```typescript
interface OpenClawResult {
  content: string;
  toolCalls?: OpenClawToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

### YuanLingContext

```typescript
interface YuanLingContext {
  thinking?: {
    depth: string;
    hypotheses: Array<{
      id: string;
      content: string;
      confidence: number;
    }>;
    process: string;
  };
  
  decision?: {
    type: 'direct_reply' | 'tool_call' | 'search' | 'clarify';
    reasoning: string;
    suggestedTools?: string[];
  };
  
  validation?: {
    score: number;
    issues: string[];
    passed: boolean;
  };
  
  feedback?: {
    suggestions: string[];
    shouldLearn: boolean;
  };
}
```

### SystemMetrics

```typescript
interface SystemMetrics {
  timestamp: number;
  health: number;           // 0-100
  avgLatency: number;       // ms
  cacheHitRate: number;     // 0-1
  tokenEfficiency: number;  // 0-1
  taskCompletionRate: number; // 0-1
  uptime: number;           // seconds
  requestCount: number;
  errorCount: number;
}
```

---

## 版本信息

```typescript
import { VERSION, BUILD_DATE } from 'yuanling';

console.log(VERSION);     // '4.1.0'
console.log(BUILD_DATE);  // '2026-04-14'
```

---

*最后更新：2026-04-14*
