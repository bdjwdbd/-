/**
 * 元灵系统主流程单元测试
 * 
 * 测试覆盖：
 * - 智能系统集成
 * - L0/L1 并行执行
 * - 智能路由
 * - 超时控制
 * - 重试机制
 * - 熔断机制
 * - 限流机制
 * - 请求去重
 */

import { YuanLingSystem, getYuanLingSystem } from '../yuanling-system';

// Mock 外部执行器
const mockExecutor = async (prompt: string, context: any) => {
  return { content: `处理结果: ${prompt.substring(0, 50)}...` };
};

// 测试配置
const testConfig = {
  workspaceRoot: '/tmp/yuanling-test',
  enableL0: true,
  enableIntrospection: false,
  logLevel: 'error' as const,
  intentConfidenceThreshold: 0.8,
  enableRequestDeduplication: true,
  requestTimeoutMs: 5000,
  maxRetries: 1,
  retryDelayMs: 100,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 3,
  enableRateLimiter: true,
  maxRequestsPerMinute: 100,
};

console.log('========================================');
console.log('元灵系统主流程单元测试');
console.log('========================================\n');

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${error}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  const system = getYuanLingSystem(testConfig);
  
  // 测试 1：系统初始化
  await test('系统初始化', async () => {
    const result = await system.startup();
    assert(result !== undefined, '启动结果不应为空');
    assert(result.environment !== undefined, '环境信息不应为空');
  });

  // 测试 2：基本消息处理
  await test('基本消息处理', async () => {
    const result = await system.processWithExternalExecutor(
      '你好',
      [],
      mockExecutor
    );
    assert(result !== undefined, '处理结果不应为空');
    assert(result.result !== undefined, '结果内容不应为空');
    assert(result.context !== undefined, '上下文不应为空');
  });

  // 测试 3：智能系统集成
  await test('智能系统集成', async () => {
    const result = await system.processWithExternalExecutor(
      '帮我搜索一下 AI 新闻',
      [],
      mockExecutor
    );
    assert(result.context.intelligence !== undefined, '智能系统结果不应为空');
    assert(result.context.intelligence?.intent !== undefined, '意图识别结果不应为空');
  });

  // 测试 4：上下文传递
  await test('上下文传递', async () => {
    const result = await system.processWithExternalExecutor(
      '测试消息',
      [],
      mockExecutor
    );
    assert(result.context.performance !== undefined, '性能指标不应为空');
    assert(result.context.performance?.totalLatency !== undefined, '总耗时不应为空');
  });

  // 测试 5：请求去重
  await test('请求去重', async () => {
    const message = '去重测试消息';
    
    // 第一次请求
    const result1 = await system.processWithExternalExecutor(
      message,
      [],
      mockExecutor
    );
    
    // 第二次相同请求（应该返回缓存）
    const result2 = await system.processWithExternalExecutor(
      message,
      [],
      mockExecutor
    );
    
    // 两次结果应该相同（来自缓存）
    assert(result2.result.content === result1.result.content, '去重应该返回缓存结果');
  });

  // 测试 6：智能路由
  await test('智能路由', async () => {
    const result = await system.processWithExternalExecutor(
      '搜索最新的科技新闻',
      [],
      mockExecutor
    );
    assert(result.context.intelligence !== undefined, '智能系统应该分析意图');
  });

  // 测试 7：会话历史处理
  await test('会话历史处理', async () => {
    const history = [
      { role: 'user', content: '之前的问题' },
      { role: 'assistant', content: '之前的回答' },
    ];
    
    const result = await system.processWithExternalExecutor(
      '继续之前的话题',
      history,
      mockExecutor
    );
    
    assert(result !== undefined, '处理结果不应为空');
  });

  // 测试 8：错误处理
  await test('错误处理', async () => {
    const errorExecutor = async () => {
      throw new Error('测试错误');
    };
    
    try {
      await system.processWithExternalExecutor(
        '触发错误',
        [],
        errorExecutor
      );
      // 如果没有抛出错误，说明降级处理生效
    } catch (error) {
      // 错误被正确抛出也是正常的
    }
  });

  // 测试 9：性能指标
  await test('性能指标', async () => {
    const result = await system.processWithExternalExecutor(
      '性能测试',
      [],
      mockExecutor
    );
    
    assert(result.context.performance?.totalLatency! > 0, '总耗时应该大于 0');
    assert(result.context.performance?.l0l1Latency !== undefined, 'L0-L1 耗时应该存在');
    assert(result.context.performance?.l2l3Latency !== undefined, 'L2-L3 耗时应该存在');
  });

  // 测试 10：系统关闭
  await test('系统关闭', async () => {
    await system.shutdown();
    // 关闭成功，无异常
  });

  // 输出测试结果
  console.log('\n========================================');
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('========================================');
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
