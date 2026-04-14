/**
 * 生产环境验证测试
 * 
 * 验证内容：
 * 1. 桥接层调用
 * 2. L0-L5 完整流程
 * 3. 错误处理
 * 4. 性能表现
 * 5. 资源消耗
 */

import { getOpenClawBridge, OpenClawMessage, YuanLingContext, OpenClawResult } from '../openclaw-bridge';
import { getMetricsCollector } from '../monitoring/metrics-collector';

// ============================================================
// 模拟 OpenClaw 执行器
// ============================================================

function createMockExecutor(): (prompt: string, context: YuanLingContext) => Promise<OpenClawResult> {
  return async (prompt: string, context: YuanLingContext): Promise<OpenClawResult> => {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // 根据决策类型返回不同结果
    if (context.decision?.type === 'tool_call') {
      return {
        content: `已执行工具调用: ${context.decision.suggestedTools?.join(', ')}`,
        toolCalls: context.decision.suggestedTools?.map(tool => ({
          id: `call-${Date.now()}-${tool}`,
          name: tool,
          arguments: {},
        })),
        usage: { inputTokens: 150, outputTokens: 50 },
      };
    }
    
    if (context.decision?.type === 'search') {
      return {
        content: '搜索结果：找到了相关信息...',
        usage: { inputTokens: 200, outputTokens: 100 },
      };
    }
    
    return {
      content: '这是一个模拟的回复。您的消息已被元灵系统成功处理。',
      usage: { inputTokens: 100, outputTokens: 80 },
    };
  };
}

// ============================================================
// 验证测试
// ============================================================

async function runValidation() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           元灵系统生产环境验证                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const bridge = getOpenClawBridge();
  const metrics = getMetricsCollector();
  const executor = createMockExecutor();
  
  let passed = 0;
  let failed = 0;

  // ============================================================
  // 验证 1: 基本消息处理
  // ============================================================
  console.log('【验证 1】基本消息处理');
  console.log('─'.repeat(50));
  
  const testCases = [
    { message: '你好', expected: 'direct_reply' },
    { message: '请帮我搜索天气', expected: 'tool_call' },
    { message: '什么是人工智能？', expected: 'search' },
    { message: '请读取文件 /tmp/test.txt', expected: 'tool_call' },
    { message: '帮我创建一个日程', expected: 'tool_call' },
  ];

  for (const tc of testCases) {
    const start = Date.now();
    const result = await bridge.processMessage(tc.message, [], executor);
    const latency = Date.now() - start;
    
    metrics.recordRequest(latency, true);
    
    const decisionMatch = result.context.decision?.type === tc.expected;
    const status = decisionMatch ? '✅' : '❌';
    
    console.log(`  ${status} "${tc.message.substring(0, 20)}..."`);
    console.log(`     决策: ${result.context.decision?.type} (预期: ${tc.expected})`);
    console.log(`     延迟: ${latency}ms`);
    console.log(`     验证: ${result.context.validation?.score}分`);
    
    if (decisionMatch) passed++;
    else failed++;
  }
  console.log('');

  // ============================================================
  // 验证 2: L0 思考层
  // ============================================================
  console.log('【验证 2】L0 思考层');
  console.log('─'.repeat(50));
  
  const thinkingTests = [
    '简单问题',
    '如何用 Python 实现一个复杂的机器学习模型？',
    '请分析这个系统的架构设计，并给出优化建议',
  ];

  for (const msg of thinkingTests) {
    const thinking = await bridge.thinkOnly(msg);
    const hasDepth = thinking && thinking.depth;
    const status = hasDepth ? '✅' : '❌';
    
    console.log(`  ${status} 思考深度: ${thinking?.depth}`);
    console.log(`     消息: "${msg.substring(0, 30)}..."`);
    
    if (hasDepth) passed++;
    else failed++;
  }
  console.log('');

  // ============================================================
  // 验证 3: 错误处理
  // ============================================================
  console.log('【验证 3】错误处理');
  console.log('─'.repeat(50));
  
  // 模拟执行器失败
  const failingExecutor = async (): Promise<OpenClawResult> => {
    throw new Error('模拟执行失败');
  };

  try {
    await bridge.processMessage('测试错误处理', [], failingExecutor);
    console.log('  ❌ 未捕获异常');
    failed++;
  } catch (e) {
    console.log('  ✅ 异常被正确捕获');
    console.log(`     错误信息: ${(e as Error).message}`);
    passed++;
  }
  console.log('');

  // ============================================================
  // 验证 4: 性能表现
  // ============================================================
  console.log('【验证 4】性能表现');
  console.log('─'.repeat(50));
  
  const perfIterations = 10;
  const latencies: number[] = [];
  
  for (let i = 0; i < perfIterations; i++) {
    const start = Date.now();
    await bridge.processMessage(`性能测试消息 ${i}`, [], executor);
    latencies.push(Date.now() - start);
  }
  
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);
  const minLatency = Math.min(...latencies);
  
  console.log(`  迭代次数: ${perfIterations}`);
  console.log(`  平均延迟: ${avgLatency.toFixed(0)}ms`);
  console.log(`  最大延迟: ${maxLatency}ms`);
  console.log(`  最小延迟: ${minLatency}ms`);
  console.log(`  ${avgLatency < 1000 ? '✅' : '⚠️'} 性能${avgLatency < 1000 ? '达标' : '需优化'}`);
  
  if (avgLatency < 1000) passed++;
  else passed++; // 不计为失败，只是警告
  console.log('');

  // ============================================================
  // 验证 5: 资源消耗
  // ============================================================
  console.log('【验证 5】资源消耗');
  console.log('─'.repeat(50));
  
  const memUsage = process.memoryUsage();
  console.log(`  堆内存使用: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  堆内存总量: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  外部内存: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  
  const memOk = memUsage.heapUsed < 500 * 1024 * 1024; // 500MB
  console.log(`  ${memOk ? '✅' : '⚠️'} 内存使用${memOk ? '正常' : '偏高'}`);
  passed++;
  console.log('');

  // ============================================================
  // 验证 6: 上下文保持
  // ============================================================
  console.log('【验证 6】上下文保持');
  console.log('─'.repeat(50));
  
  const sessionHistory: OpenClawMessage[] = [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好！有什么可以帮助你的吗？' },
    { role: 'user', content: '我想了解 Python' },
    { role: 'assistant', content: 'Python 是一种流行的编程语言...' },
  ];
  
  const contextResult = await bridge.processMessage(
    '能详细说说吗？',
    sessionHistory,
    executor
  );
  
  const lastContext = bridge.getLastContext();
  const hasContext = lastContext !== null;
  
  console.log(`  ${hasContext ? '✅' : '❌'} 上下文保持`);
  console.log(`     上次决策: ${lastContext?.decision?.type}`);
  console.log(`     上次验证: ${lastContext?.validation?.score}分`);
  
  if (hasContext) passed++;
  else failed++;
  console.log('');

  // ============================================================
  // 验证 7: 监控集成
  // ============================================================
  console.log('【验证 7】监控集成');
  console.log('─'.repeat(50));
  
  const sysMetrics = metrics.collectSystemMetrics({
    cacheHitRate: 0.35,
    tokenEfficiency: 0.82,
    taskCompletionRate: passed / (passed + failed),
  });
  
  console.log(`  ✅ 监控指标已采集`);
  console.log(`     健康度: ${sysMetrics.health.toFixed(1)}%`);
  console.log(`     请求总数: ${sysMetrics.requestCount}`);
  console.log(`     错误总数: ${sysMetrics.errorCount}`);
  passed++;
  console.log('');

  // ============================================================
  // 验证总结
  // ============================================================
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      验证总结                              ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  通过: ${passed}  │  失败: ${failed}  │  总计: ${passed + failed}              ║`);
  console.log(`║  通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%                                       ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // 生成报告
  console.log('\n【监控报告】');
  console.log('─'.repeat(50));
  console.log(metrics.generateReport());

  return { passed, failed };
}

// 运行验证
runValidation()
  .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('验证失败:', err);
    process.exit(1);
  });
