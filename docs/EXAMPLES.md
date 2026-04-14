# 元灵系统示例代码

---

## 示例 1：基本消息处理

```typescript
import { processWithYuanLing } from 'yuanling';

async function basicExample() {
  const { result, context } = await processWithYuanLing(
    '你好，请介绍一下你自己',
    [],
    async (prompt, ctx) => {
      console.log('思考深度:', ctx.thinking?.depth);
      console.log('决策类型:', ctx.decision?.type);
      
      return {
        content: '我是元灵系统，一个具备思考能力的 AI 助手。',
      };
    }
  );
  
  console.log('回复:', result.content);
  console.log('验证分数:', context.validation?.score);
}
```

---

## 示例 2：工具调用

```typescript
import { getOpenClawBridge } from 'yuanling';

async function toolCallExample() {
  const bridge = getOpenClawBridge();
  
  const { result, context } = await bridge.processMessage(
    '请帮我搜索今天的天气',
    [],
    async (prompt, ctx) => {
      // 检查决策建议的工具
      const tools = ctx.decision?.suggestedTools || [];
      
      if (tools.includes('search')) {
        // 执行搜索
        const searchResult = await performSearch('今天天气');
        return {
          content: searchResult,
          toolCalls: [{
            id: 'call-1',
            name: 'search',
            arguments: { query: '今天天气' },
          }],
        };
      }
      
      return { content: '无法处理该请求' };
    }
  );
  
  console.log('搜索结果:', result.content);
}

async function performSearch(query: string): Promise<string> {
  // 实现搜索逻辑
  return `搜索 "${query}" 的结果...`;
}
```

---

## 示例 3：多轮对话

```typescript
import { getOpenClawBridge, OpenClawMessage } from 'yuanling';

async function conversationExample() {
  const bridge = getOpenClawBridge();
  const history: OpenClawMessage[] = [];
  
  // 第一轮
  const result1 = await bridge.processMessage(
    '我想了解 Python',
    history,
    mockExecutor
  );
  history.push(
    { role: 'user', content: '我想了解 Python' },
    { role: 'assistant', content: result1.result.content }
  );
  
  // 第二轮（带上下文）
  const result2 = await bridge.processMessage(
    '能详细说说它的特点吗？',
    history,
    mockExecutor
  );
  
  console.log('第二轮回复:', result2.result.content);
}

const mockExecutor = async (prompt: string) => ({
  content: '这是模拟的回复内容。',
});
```

---

## 示例 4：监控集成

```typescript
import { 
  getOpenClawBridge, 
  getMetricsCollector,
  getEnhancedCache 
} from 'yuanling';

async function monitoringExample() {
  const bridge = getOpenClawBridge();
  const metrics = getMetricsCollector();
  const cache = getEnhancedCache();
  
  // 处理消息
  const start = Date.now();
  const { result } = await bridge.processMessage(
    '你好',
    [],
    async (prompt) => ({ content: '你好！' })
  );
  const latency = Date.now() - start;
  
  // 记录指标
  metrics.recordRequest(latency, true);
  
  // 缓存结果
  const cacheKey = cache.generateKey('你好');
  cache.set(cacheKey, result.content, undefined, ['问候']);
  
  // 采集系统指标
  const sysMetrics = metrics.collectSystemMetrics({
    cacheHitRate: cache.getStats().hitRate,
    tokenEfficiency: 0.85,
    taskCompletionRate: 1.0,
  });
  
  console.log('健康度:', sysMetrics.health);
  console.log('缓存命中率:', (sysMetrics.cacheHitRate * 100).toFixed(1) + '%');
  
  // 生成报告
  console.log(metrics.generateReport());
}
```

---

## 示例 5：延迟优化

```typescript
import { getLatencyOptimizer } from 'yuanling';

async function latencyOptimizationExample() {
  const optimizer = getLatencyOptimizer();
  
  // 预热
  await optimizer.warmup();
  
  // 检查快速路径
  const message = '你好';
  
  if (optimizer.canUseFastPath(message)) {
    // 快速路径：立即返回
    const fast = optimizer.fastPathProcess(message);
    if (fast) {
      console.log('快速响应:', fast.response);
      console.log('延迟:', fast.latency, 'ms');
      return;
    }
  }
  
  // 正常路径：并行预处理
  const results = await optimizer.parallelPreprocess([
    { 
      name: 'thinking', 
      fn: async () => {
        // L0 思考
        return { depth: 'extensive' };
      }
    },
    { 
      name: 'decision', 
      fn: async () => {
        // L1 决策
        return { type: 'direct_reply' };
      }
    },
  ]);
  
  console.log('思考结果:', results.get('thinking'));
  console.log('决策结果:', results.get('decision'));
  
  // 查看延迟统计
  const stats = optimizer.getLatencyStats();
  console.log('平均延迟:', stats.avgLatency, 'ms');
}
```

---

## 示例 6：流式响应

```typescript
import { getLatencyOptimizer } from 'yuanling';

async function streamExample() {
  const optimizer = getLatencyOptimizer();
  
  const content = '这是一个流式响应的示例内容，会逐字返回给用户。';
  
  console.log('开始流式输出:');
  
  for await (const chunk of optimizer.streamResponse(content, 5)) {
    process.stdout.write(chunk);
  }
  
  console.log('\n流式输出完成');
}
```

---

## 示例 7：Token 校准

```typescript
import { getTokenCalibrator } from 'yuanling';

async function tokenCalibrationExample() {
  const calibrator = getTokenCalibrator();
  
  // 模拟估算和实际值
  const model = 'gpt-4-turbo';
  const estimated = 100;
  const actual = 105; // 实际使用
  
  // 记录校准数据
  calibrator.recordCalibration(model, estimated, actual, 'text');
  
  // 获取校准后的估算
  const calibrated = calibrator.calibrate(model, 100, 'text');
  console.log('原始估算:', estimated);
  console.log('校准后:', calibrated);
  
  // 查看统计
  const stats = calibrator.getStats();
  console.log('总样本数:', stats.totalSamples);
}
```

---

## 示例 8：完整应用

```typescript
import {
  getOpenClawBridge,
  getMetricsCollector,
  getEnhancedCache,
  getLatencyOptimizer,
} from 'yuanling';

class YuanLingApp {
  private bridge = getOpenClawBridge();
  private metrics = getMetricsCollector();
  private cache = getEnhancedCache();
  private optimizer = getLatencyOptimizer();
  
  async initialize() {
    // 预热
    await this.optimizer.warmup();
    
    // 预热缓存
    this.cache.warmup([
      { key: 'greeting', value: '你好！有什么可以帮助你的吗？', tags: ['问候'] },
    ]);
  }
  
  async handleMessage(message: string, history: any[]) {
    const start = Date.now();
    
    // 检查快速路径
    if (this.optimizer.canUseFastPath(message)) {
      const fast = this.optimizer.fastPathProcess(message);
      if (fast) {
        this.metrics.recordRequest(fast.latency, true);
        return fast.response;
      }
    }
    
    // 检查缓存
    const cacheKey = this.cache.generateKey(message);
    const cached = this.cache.get(cacheKey, message);
    if (cached) {
      this.metrics.recordRequest(0, true);
      return cached;
    }
    
    // 正常处理
    const { result } = await this.bridge.processMessage(
      message,
      history,
      this.executor.bind(this)
    );
    
    // 记录指标
    const latency = Date.now() - start;
    this.metrics.recordRequest(latency, true);
    
    // 缓存结果
    this.cache.set(cacheKey, result.content);
    
    return result.content;
  }
  
  private async executor(prompt: string, context: any) {
    // 实现你的执行逻辑
    return { content: '处理结果' };
  }
  
  getReport() {
    return this.metrics.generateReport();
  }
}

// 使用
async function main() {
  const app = new YuanLingApp();
  await app.initialize();
  
  const response = await app.handleMessage('你好', []);
  console.log(response);
  
  console.log(app.getReport());
}

main();
```

---

*最后更新：2026-04-14*
