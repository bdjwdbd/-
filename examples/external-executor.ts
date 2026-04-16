/**
 * 元灵系统外部执行器示例
 * 
 * 本示例展示：
 * - 自定义执行器
 * - 会话历史处理
 * - 上下文获取
 */

import { getYuanLingSystem, ProcessingContext } from '../src';

// 自定义执行器
async function myExecutor(prompt: string, context: ProcessingContext) {
  console.log(`\n   📨 执行器收到提示:`);
  console.log(`   ${prompt.substring(0, 100)}...`);
  
  // 模拟 LLM 响应
  const response = `这是对 "${prompt.substring(0, 30)}..." 的回复。`;
  
  return {
    content: response,
    usage: {
      inputTokens: prompt.length,
      outputTokens: response.length,
    },
  };
}

async function main() {
  console.log('========================================');
  console.log('元灵系统外部执行器示例');
  console.log('========================================\n');

  // 1. 创建并启动系统
  console.log('🚀 创建并启动系统');
  const system = getYuanLingSystem({
    workspaceRoot: './workspace',
    enableL0: true,
    logLevel: 'error',
  });
  await system.startup();

  // 2. 基本消息处理
  console.log('\n💬 基本消息处理');
  const result1 = await system.processWithExternalExecutor(
    '你好，请介绍一下自己',
    [],
    myExecutor
  );
  console.log(`   响应: ${result1.result.content}`);
  console.log(`   耗时: ${result1.context.performance?.totalLatency}ms`);

  // 3. 带会话历史的处理
  console.log('\n📚 带会话历史的处理');
  const history = [
    { role: 'user', content: '之前我问了什么？' },
    { role: 'assistant', content: '你问了关于介绍自己的问题' },
  ];
  
  const result2 = await system.processWithExternalExecutor(
    '继续之前的话题',
    history,
    myExecutor
  );
  console.log(`   响应: ${result2.result.content}`);

  // 4. 查看上下文信息
  console.log('\n📊 上下文信息');
  console.log(`   智能系统意图: ${result2.context.intelligence?.intent.primary.type}`);
  console.log(`   意图置信度: ${((result2.context.intelligence?.intent.primary.confidence || 0) * 100).toFixed(0)}%`);
  console.log(`   决策类型: ${result2.context.decision?.type}`);
  console.log(`   验证通过: ${result2.context.validation?.passed}`);

  // 5. 性能指标
  console.log('\n⚡ 性能指标');
  console.log(`   L0-L1 耗时: ${result2.context.performance?.l0l1Latency}ms`);
  console.log(`   L2-L3 耗时: ${result2.context.performance?.l2l3Latency}ms`);
  console.log(`   L4 耗时: ${result2.context.performance?.l4Latency}ms`);
  console.log(`   总耗时: ${result2.context.performance?.totalLatency}ms`);

  // 6. 关闭系统
  await system.shutdown();

  console.log('\n========================================');
  console.log('示例完成');
  console.log('========================================');
}

main().catch(console.error);
