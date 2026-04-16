# Harness Engineering 示例代码

本文档提供完整的代码示例，帮助你快速上手。

---

## 📋 目录

1. [基础示例](#基础示例)
2. [状态管理示例](#状态管理示例)
3. [追踪示例](#追踪示例)
4. [沙盒隔离示例](#沙盒隔离示例)
5. [度量演进示例](#度量演进示例)
6. [深度集成示例](#深度集成示例)

---

## 基础示例

### 最小可用示例

```typescript
import { HarnessSystem } from '@yuanling/harness';

async function main() {
  // 1. 创建系统
  const harness = new HarnessSystem({
    workspaceRoot: './workspace',
  });

  // 2. 初始化
  await harness.initialize();

  // 3. 使用
  console.log('Harness 系统已启动');

  // 4. 关闭
  await harness.close();
}

main().catch(console.error);
```

---

## 状态管理示例

### 会话状态管理

```typescript
import { HarnessSystem, StateCategory } from '@yuanling/harness';

async function sessionExample() {
  const harness = new HarnessSystem({ workspaceRoot: './workspace' });
  await harness.initialize();

  // 创建会话
  const sessionId = 'session_user123';
  await harness.setState(sessionId, {
    userId: 'user123',
    messages: [],
    createdAt: Date.now(),
  }, StateCategory.SESSION);

  // 获取会话
  const session = await harness.getState(sessionId);
  console.log('会话:', session);

  // 更新会话
  session.messages.push({ role: 'user', content: '你好' });
  await harness.setState(sessionId, session, StateCategory.SESSION);

  // 创建检查点
  const checkpointId = await harness.createCheckpoint(
    [sessionId],
    '用户发送消息后'
  );
  console.log('检查点 ID:', checkpointId);

  // 模拟错误，恢复检查点
  session.messages = []; // 意外清空
  const restored = await harness.restoreCheckpoint(checkpointId);
  console.log(`恢复了 ${restored} 个状态`);

  await harness.close();
}
```

### 任务状态追踪

```typescript
async function taskExample() {
  const harness = new HarnessSystem({ workspaceRoot: './workspace' });
  await harness.initialize();

  // 创建任务
  const taskId = 'task_search_001';
  await harness.setState(taskId, {
    type: 'search',
    query: '天气',
    status: 'pending',
    createdAt: Date.now(),
  }, StateCategory.TASK);

  // 更新任务状态
  const task = await harness.getState(taskId);
  task.status = 'processing';
  await harness.setState(taskId, task, StateCategory.TASK);

  // 完成任务
  task.status = 'completed';
  task.result = '北京今天晴，25°C';
  task.completedAt = Date.now();
  await harness.setState(taskId, task, StateCategory.TASK);

  await harness.close();
}
```

---

## 追踪示例

### 基础追踪

```typescript
import { HarnessSystem, SpanStatus } from '@yuanling/harness';

async function traceExample() {
  const harness = new HarnessSystem({ workspaceRoot: './workspace' });
  await harness.initialize();

  // 开始追踪
  const trace = harness.startTrace('process_message', {
    userId: 'user123',
    messageLength: 50,
  });

  try {
    // 执行操作
    await processMessage('今天天气怎么样？');

    // 记录决策
    harness.recordDecision({
      spanId: 'decision_1',
      input: '今天天气怎么样？',
      reasoning: '用户询问天气，需要调用天气 API',
      output: 'call_weather_api',
      confidence: 0.9,
      alternatives: [
        { description: 'direct_reply', probability: 0.1, reason: '可能只是闲聊' },
      ],
    });

    // 成功结束
    harness.endTrace(trace.traceId, SpanStatus.COMPLETED);
  } catch (error) {
    // 失败结束
    harness.endTrace(trace.traceId, SpanStatus.FAILED);
    throw error;
  }

  await harness.close();
}
```

### 多层追踪

```typescript
async function multiLayerTrace() {
  const harness = new HarnessSystem({ workspaceRoot: './workspace' });
  await harness.initialize();

  // L6 灵识层追踪
  const l6Trace = harness.startTrace('L6_perception');
  await perceiveEnvironment();
  harness.endTrace(l6Trace.traceId, SpanStatus.COMPLETED);

  // L0 灵思层追踪
  const l0Trace = harness.startTrace('L0_thinking');
  await think();
  harness.endTrace(l0Trace.traceId, SpanStatus.COMPLETED);

  // L1 灵枢层追踪
  const l1Trace = harness.startTrace('L1_decision');
  await decide();
  harness.endTrace(l1Trace.traceId, SpanStatus.COMPLETED);

  await harness.close();
}
```

---

## 沙盒隔离示例

### 风险评估

```typescript
import { SandboxManager, RiskLevel, SandboxLevel } from '@yuanling/harness';

async function riskAssessmentExample() {
  const sandboxManager = new SandboxManager({ workspaceRoot: './workspace' });
  await sandboxManager.initialize();

  // 评估不同操作的风险
  const tests = [
    { type: 'process', input: '今天天气怎么样？' },
    { type: 'process', input: '帮我读取 /tmp/test.txt 文件' },
    { type: 'process', input: '执行 ls -la 命令' },
    { type: 'process', input: '执行 rm -rf /' },
  ];

  for (const test of tests) {
    const assessment = sandboxManager.assessRisk(test);
    console.log(`输入: ${test.input}`);
    console.log(`  风险级别: ${assessment.level}`);
    console.log(`  推荐沙盒: L${assessment.recommendedLevel}`);
    console.log();
  }

  await sandboxManager.close();
}
```

### 沙盒执行

```typescript
async function sandboxExecutionExample() {
  const sandboxManager = new SandboxManager({ workspaceRoot: './workspace' });
  await sandboxManager.initialize();

  // 评估风险
  const assessment = sandboxManager.assessRisk({
    type: 'exec',
    input: 'rm -rf /tmp/old_files',
    tools: ['exec'],
  });

  // 创建沙盒
  const sandbox = await sandboxManager.create({
    name: 'cleanup_sandbox',
    level: assessment.recommendedLevel,
    resourceLimits: {
      cpu: 30,
      memory: 256,
      disk: 100,
      network: 0, // 禁用网络
    },
  });

  // 在沙盒中执行
  const result = await sandboxManager.execute(sandbox.sandboxId, async () => {
    // 危险操作
    return await executeCommand('rm -rf /tmp/old_files');
  });

  if (result.success) {
    console.log('执行成功:', result.output);
  } else {
    console.error('执行失败:', result.error);
  }

  // 销毁沙盒
  await sandboxManager.destroy(sandbox.sandboxId);

  await sandboxManager.close();
}
```

---

## 度量演进示例

### 指标收集

```typescript
import { EvolutionEngine, MetricCategory } from '@yuanling/harness';

async function metricsExample() {
  const engine = new EvolutionEngine({ workspaceRoot: './workspace' });
  await engine.initialize();

  // 记录响应时间
  const startTime = Date.now();
  await processMessage('你好');
  const duration = Date.now() - startTime;
  engine.recordResponseTime(duration, 'process_message');

  // 记录任务完成
  engine.recordTaskCompletion(true, 'chat');

  // 记录自定义指标
  engine.recordMetric('cache_hit_rate', 0.85);
  engine.recordMetric('accuracy', 0.92);

  // 获取评分
  const score = engine.getScore();
  console.log(`综合评分: ${score.total}`);
  console.log(`效能: ${score.byCategory[MetricCategory.EFFICIENCY]}`);
  console.log(`质量: ${score.byCategory[MetricCategory.QUALITY]}`);

  // 获取优化建议
  const suggestions = engine.getSuggestions();
  console.log(`优化建议: ${suggestions.length} 条`);

  await engine.close();
}
```

### A/B 测试

```typescript
async function abTestExample() {
  const engine = new EvolutionEngine({ workspaceRoot: './workspace' });
  await engine.initialize();

  // 创建 A/B 测试
  const abTest = engine.createABTest({
    name: 'cache_optimization',
    controlConfig: { cache_enabled: false },
    experimentConfig: { cache_enabled: true },
    trafficSplit: 0.5,
    targetMetrics: ['response_time', 'accuracy'],
    minSampleSize: 1000,
    significanceLevel: 0.95,
  });

  console.log(`A/B 测试 ID: ${abTest.testId}`);

  // 运行一段时间后获取结果
  const result = engine.getABTestResult(abTest.testId);
  if (result) {
    console.log(`实验组改进: ${result.improvement.response_time}%`);
    console.log(`统计显著性: ${result.statisticalSignificance}`);
    console.log(`推荐方案: ${result.recommendation}`);
  }

  // 停止测试
  engine.stopABTest(abTest.testId);

  await engine.close();
}
```

### 灰度发布

```typescript
async function canaryReleaseExample() {
  const engine = new EvolutionEngine({ workspaceRoot: './workspace' });
  await engine.initialize();

  // 创建灰度发布
  const canary = engine.createCanaryRelease({
    name: 'new_algorithm_v2',
    newConfig: { algorithm: 'v2', threshold: 0.8 },
    currentRatio: 0,
    targetRatio: 1.0,
    incrementStep: 0.1,
    rollbackThreshold: 0.7,
    monitorMetrics: ['accuracy', 'error_rate'],
  });

  console.log(`灰度发布 ID: ${canary.releaseId}`);

  // 逐步推进
  for (let i = 0; i < 10; i++) {
    const advanced = engine.advanceCanary(canary.releaseId);
    const status = engine.getCanaryStatus(canary.releaseId);

    console.log(`当前比例: ${(status.currentRatio * 100).toFixed(0)}%`);
    console.log(`健康状态: ${status.isHealthy ? '健康' : '异常'}`);

    if (status.needsRollback) {
      console.log('需要回滚！');
      break;
    }

    await sleep(60000); // 等待 1 分钟
  }

  await engine.close();
}
```

---

## 深度集成示例

### 完整集成

```typescript
import { YuanLingSystem } from '@yuanling/yuanling-system';
import { createDeepIntegratedSystem } from '@yuanling/harness/integration';

async function deepIntegrationExample() {
  // 创建元灵系统
  const yuanling = new YuanLingSystem({
    workspaceRoot: './workspace',
  });

  // 创建深度集成系统
  const integrated = await createDeepIntegratedSystem(yuanling, {
    workspaceRoot: './workspace',
    enableStateManager: true,
    enableTracing: true,
    enablePPAF: true,
    enableSandbox: true,
    enableMetrics: true,
    enableAutoRiskAssessment: true,
  });

  // 定义执行器
  const executor = async (prompt: string, context: any) => {
    // 调用 LLM
    const response = await callLLM(prompt);
    return {
      content: response,
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  };

  // 处理消息（自动包含所有 Harness 能力）
  const result = await integrated.process(
    '请帮我搜索今天的天气',
    [],
    executor
  );

  // 查看结果
  console.log('处理结果:', result.result.content);
  console.log('追踪 ID:', result.harness.traceId);
  console.log('沙盒 ID:', result.harness.sandboxId);
  console.log('风险评估:', result.harness.riskAssessment);
  console.log('总耗时:', result.harness.metrics.totalDuration, 'ms');
  console.log('综合评分:', result.harness.score);

  // 获取系统状态
  const status = integrated.getStatus();
  console.log('系统状态:', status);

  await integrated.close();
}
```

### 会话管理

```typescript
async function sessionManagementExample() {
  const integrated = await createDeepIntegratedSystem(yuanling, config);

  // 保存会话状态
  await integrated.saveSessionState('session_123', {
    messages: [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！有什么可以帮你的？' },
    ],
    context: { topic: 'greeting' },
  });

  // 获取会话状态
  const session = await integrated.getSessionState('session_123');
  console.log('会话消息数:', session.messages.length);

  // 创建检查点
  const checkpoint = await integrated.createCheckpoint(
    ['session_123'],
    '对话检查点'
  );

  // 恢复检查点
  await integrated.restoreCheckpoint(checkpoint);

  await integrated.close();
}
```

---

## 📚 更多资源

- [API 文档](./API.md)
- [使用指南](./GUIDE.md)
- [性能报告](./PERFORMANCE.md)

---

*文档版本：v1.3.1 | 更新时间：2026-04-16*
