/**
 * 元灵系统主流程性能基准测试
 * 
 * 测试指标：
 * - 启动时间
 * - 单次请求处理时间
 * - 并发请求处理时间
 * - 内存使用
 * - 缓存命中率
 */

import { YuanLingSystem, getYuanLingSystem } from '../yuanling-system';

// Mock 外部执行器
const mockExecutor = async (prompt: string, context: any) => {
  return { content: `处理结果: ${prompt.substring(0, 50)}...` };
};

// 测试配置
const testConfig = {
  workspaceRoot: '/tmp/yuanling-benchmark',
  enableL0: true,
  enableIntrospection: false,
  logLevel: 'error' as const,
  intentConfidenceThreshold: 0.8,
  enableRequestDeduplication: true,
  requestTimeoutMs: 30000,
  maxRetries: 2,
  retryDelayMs: 100,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  enableRateLimiter: false, // 基准测试时禁用限流
  maxRequestsPerMinute: 1000,
};

console.log('========================================');
console.log('元灵系统主流程性能基准测试');
console.log('========================================\n');

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = [];
  
  // 预热
  for (let i = 0; i < 5; i++) {
    await fn();
  }
  
  // 正式测试
  const startTime = Date.now();
  for (let i = 0; i < iterations; i++) {
    const iterStart = Date.now();
    await fn();
    times.push(Date.now() - iterStart);
  }
  const totalTime = Date.now() - startTime;
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = (iterations / totalTime) * 1000;
  
  return {
    name,
    iterations,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond,
  };
}

function printResult(result: BenchmarkResult) {
  console.log(`\n📊 ${result.name}`);
  console.log('─'.repeat(50));
  console.log(`  迭代次数: ${result.iterations}`);
  console.log(`  总耗时: ${result.totalTime}ms`);
  console.log(`  平均耗时: ${result.avgTime.toFixed(2)}ms`);
  console.log(`  最小耗时: ${result.minTime}ms`);
  console.log(`  最大耗时: ${result.maxTime}ms`);
  console.log(`  吞吐量: ${result.opsPerSecond.toFixed(2)} ops/s`);
}

async function runBenchmarks() {
  const system = getYuanLingSystem(testConfig);
  
  // 基准测试 1：启动时间
  console.log('\n🚀 基准测试 1: 启动时间');
  console.log('─'.repeat(50));
  const startupStart = Date.now();
  await system.startup();
  const startupTime = Date.now() - startupStart;
  console.log(`  启动时间: ${startupTime}ms`);
  
  // 基准测试 2：单次请求处理
  const singleResult = await benchmark(
    '单次请求处理',
    async () => {
      await system.processWithExternalExecutor(
        '测试消息',
        [],
        mockExecutor
      );
    },
    100
  );
  printResult(singleResult);
  
  // 基准测试 3：带会话历史的请求
  const historyResult = await benchmark(
    '带会话历史的请求',
    async () => {
      await system.processWithExternalExecutor(
        '继续之前的话题',
        [
          { role: 'user', content: '之前的问题' },
          { role: 'assistant', content: '之前的回答' },
        ],
        mockExecutor
      );
    },
    50
  );
  printResult(historyResult);
  
  // 基准测试 4：搜索意图请求
  const searchResult = await benchmark(
    '搜索意图请求',
    async () => {
      await system.processWithExternalExecutor(
        '帮我搜索一下 AI 新闻',
        [],
        mockExecutor
      );
    },
    50
  );
  printResult(searchResult);
  
  // 基准测试 5：缓存命中请求
  const cachedResult = await benchmark(
    '缓存命中请求（相同消息）',
    async () => {
      await system.processWithExternalExecutor(
        '缓存测试消息',
        [],
        mockExecutor
      );
    },
    100
  );
  printResult(cachedResult);
  
  // 基准测试 6：并发请求
  console.log('\n📊 并发请求处理');
  console.log('─'.repeat(50));
  const concurrentStart = Date.now();
  const concurrentPromises = [];
  for (let i = 0; i < 10; i++) {
    concurrentPromises.push(
      system.processWithExternalExecutor(
        `并发测试消息 ${i}`,
        [],
        mockExecutor
      )
    );
  }
  await Promise.all(concurrentPromises);
  const concurrentTime = Date.now() - concurrentStart;
  console.log(`  10 个并发请求总耗时: ${concurrentTime}ms`);
  console.log(`  平均每个请求: ${(concurrentTime / 10).toFixed(2)}ms`);
  
  // 基准测试 7：内存使用
  console.log('\n📊 内存使用');
  console.log('─'.repeat(50));
  const memUsage = process.memoryUsage();
  console.log(`  堆内存使用: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  堆内存总量: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  外部内存: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  
  // 关闭系统
  await system.shutdown();
  
  // 输出总结
  console.log('\n========================================');
  console.log('性能基准测试总结');
  console.log('========================================');
  console.log(`\n| 指标 | 值 |`);
  console.log(`|------|-----|`);
  console.log(`| 启动时间 | ${startupTime}ms |`);
  console.log(`| 单次请求平均耗时 | ${singleResult.avgTime.toFixed(2)}ms |`);
  console.log(`| 单次请求吞吐量 | ${singleResult.opsPerSecond.toFixed(2)} ops/s |`);
  console.log(`| 带历史请求平均耗时 | ${historyResult.avgTime.toFixed(2)}ms |`);
  console.log(`| 搜索意图请求平均耗时 | ${searchResult.avgTime.toFixed(2)}ms |`);
  console.log(`| 缓存命中请求平均耗时 | ${cachedResult.avgTime.toFixed(2)}ms |`);
  console.log(`| 10 并发请求总耗时 | ${concurrentTime}ms |`);
  console.log(`| 堆内存使用 | ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB |`);
}

runBenchmarks().catch(console.error);
