/**
 * 性能基准测试
 * 
 * 测试各模块的性能指标
 * 
 * @module tests/performance-benchmark
 */

import { HarnessSystem, StateCategory } from '../harness';
import { createCoordinator, TaskPriority } from '../multi-agent';

// ============ 测试配置 ============

interface BenchmarkConfig {
  iterations: number;
  warmup: number;
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  iterations: 1000,
  warmup: 100,
};

// ============ 测试工具 ============

async function measureTime<T>(
  name: string,
  fn: () => Promise<T>,
  config: BenchmarkConfig = DEFAULT_CONFIG
): Promise<{ name: string; avgMs: number; minMs: number; maxMs: number; ops: number }> {
  // 预热
  for (let i = 0; i < config.warmup; i++) {
    await fn();
  }

  // 测量
  const times: number[] = [];
  const start = Date.now();

  for (let i = 0; i < config.iterations; i++) {
    const iterStart = performance.now();
    await fn();
    times.push(performance.now() - iterStart);
  }

  const totalMs = Date.now() - start;
  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);
  const ops = (config.iterations / totalMs) * 1000;

  return { name, avgMs, minMs, maxMs, ops };
}

function formatResult(result: { name: string; avgMs: number; minMs: number; maxMs: number; ops: number }): string {
  return `${result.name}: avg=${result.avgMs.toFixed(3)}ms, min=${result.minMs.toFixed(3)}ms, max=${result.maxMs.toFixed(3)}ms, ops=${result.ops.toFixed(0)}/s`;
}

// ============ Harness 性能测试 ============

async function benchmarkHarness(): Promise<void> {
  console.log('\n━━━━━━ Harness 系统性能测试 ━━━━━━\n');

  const harness = new HarnessSystem({
    workspaceRoot: '/tmp/benchmark-harness',
    enableStateManager: true,
    enableTracing: true,
  });

  await harness.initialize();

  // 状态管理
  const stateResult = await measureTime('setState + getState', async () => {
    const key = `bench_${Date.now()}_${Math.random()}`;
    await harness.setState(key, { data: 'test' }, StateCategory.SESSION);
    await harness.getState(key);
  });
  console.log(formatResult(stateResult));

  // 追踪
  const traceResult = await measureTime('startTrace + endTrace', async () => {
    const trace = harness.startTrace(`bench_${Date.now()}`);
    if (trace) {
      harness.endTrace(trace.traceId, 'completed' as any);
    }
  });
  console.log(formatResult(traceResult));

  // 完整流程
  const fullResult = await measureTime('完整处理流程', async () => {
    const trace = harness.startTrace('full_bench');
    await harness.setState('bench_key', { value: Math.random() });
    const state = await harness.getState('bench_key');
    if (trace) {
      harness.endTrace(trace.traceId, 'completed' as any);
    }
  });
  console.log(formatResult(fullResult));

  await harness.close();
}

// ============ Multi-Agent 性能测试 ============

async function benchmarkMultiAgent(): Promise<void> {
  console.log('\n━━━━━━ Multi-Agent 系统性能测试 ━━━━━━\n');

  const coordinator = createCoordinator();
  await coordinator.start();

  // 注册 Agent
  for (let i = 0; i < 10; i++) {
    coordinator.registerAgent({
      agentId: `agent_${i}`,
      name: `Agent ${i}`,
      description: `Benchmark Agent ${i}`,
      capabilities: [
        {
          id: 'task',
          name: 'Task',
          description: 'Execute task',
          inputType: 'any',
          outputType: 'any',
          performance: { avgLatency: 100, successRate: 0.95, costPerCall: 0.01 },
        },
      ],
      resourceLimits: {
        maxConcurrentTasks: 5,
        maxMemoryMB: 512,
        timeoutMs: 30000,
      },
      priority: 1,
      tags: ['benchmark'],
    });
  }

  // Agent 注册
  const regResult = await measureTime('Agent 注册', async () => {
    coordinator.registerAgent({
      agentId: `bench_agent_${Date.now()}`,
      name: 'Bench Agent',
      description: 'Benchmark test agent',
      capabilities: [],
      resourceLimits: { maxConcurrentTasks: 1, maxMemoryMB: 256, timeoutMs: 10000 },
      priority: 1,
      tags: [],
    });
  }, { iterations: 100, warmup: 10 });
  console.log(formatResult(regResult));

  // 任务提交
  const submitResult = await measureTime('任务提交', async () => {
    coordinator.submitTask({
      taskId: `task_${Date.now()}_${Math.random()}`,
      name: 'Bench Task',
      description: 'Benchmark test task',
      input: { data: 'test' },
      expectedOutputType: 'any',
      priority: TaskPriority.NORMAL,
      dependencies: [],
      constraints: {
        timeoutMs: 10000,
        maxRetries: 2,
        requiredCapabilities: ['task'],
      },
      metadata: {},
    });
  });
  console.log(formatResult(submitResult));

  // 状态查询
  const statusResult = await measureTime('状态查询', async () => {
    coordinator.getStatus();
  });
  console.log(formatResult(statusResult));

  // Agent 列表
  const listResult = await measureTime('Agent 列表', async () => {
    coordinator.getAgents();
  });
  console.log(formatResult(listResult));

  await coordinator.stop();
}

// ============ 内存测试 ============

async function benchmarkMemory(): Promise<void> {
  console.log('\n━━━━━━ 内存使用测试 ━━━━━━\n');

  const harness = new HarnessSystem({
    workspaceRoot: '/tmp/benchmark-memory',
    enableStateManager: true,
    enableTracing: true,
  });

  await harness.initialize();

  const initialMemory = process.memoryUsage();
  console.log(`初始内存: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

  // 创建大量状态
  for (let i = 0; i < 1000; i++) {
    await harness.setState(`mem_key_${i}`, {
      data: 'x'.repeat(100),
      index: i,
      timestamp: Date.now(),
    }, StateCategory.SESSION);
  }

  const afterStateMemory = process.memoryUsage();
  console.log(`创建 1000 状态后: ${(afterStateMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`增量: ${((afterStateMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`);

  // 创建大量追踪
  for (let i = 0; i < 1000; i++) {
    const trace = harness.startTrace(`mem_trace_${i}`);
    if (trace) {
      harness.endTrace(trace.traceId, 'completed' as any);
    }
  }

  const afterTraceMemory = process.memoryUsage();
  console.log(`创建 1000 追踪后: ${(afterTraceMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`增量: ${((afterTraceMemory.heapUsed - afterStateMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`);

  await harness.close();
}

// ============ 主测试 ============

async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║              性能基准测试                               ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  await benchmarkHarness();
  await benchmarkMultiAgent();
  await benchmarkMemory();

  console.log('\n✅ 性能基准测试完成\n');
}

main().catch(console.error);
