/**
 * 测试元灵系统桥接层
 */

import { createBridge, createOpenClawExecutor } from './bridge';

async function testBridge() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║          元灵系统 v6.0 - 桥接层测试                           ║');
  console.log('║                                                               ║');
  console.log('║  架构: 元灵系统（主系统）→ OpenClaw（执行层）                ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // 创建执行器
  const executor = createOpenClawExecutor();
  
  // 创建桥接层
  const bridge = createBridge(executor, {
    enableThinking: true,
    enableMemory: true,
    debug: true
  });

  // 测试 1: 简单问题
  console.log('─'.repeat(60));
  console.log('测试 1: 简单问题');
  console.log('─'.repeat(60));
  const result1 = await bridge.processMessage('你好，元灵系统');
  console.log('结果:', result1.success ? '✅ 成功' : '❌ 失败');
  console.log('响应:', result1.content.substring(0, 100));
  console.log('');

  // 测试 2: 需要读取文件
  console.log('─'.repeat(60));
  console.log('测试 2: 读取文件');
  console.log('─'.repeat(60));
  const result2 = await bridge.processMessage('请读取 package.json 文件');
  console.log('结果:', result2.success ? '✅ 成功' : '❌ 失败');
  console.log('迭代次数:', result2.iterations);
  console.log('');

  // 测试 3: 需要执行命令
  console.log('─'.repeat(60));
  console.log('测试 3: 执行命令');
  console.log('─'.repeat(60));
  const result3 = await bridge.processMessage('请执行 echo "Hello YuanLing" 命令');
  console.log('结果:', result3.success ? '✅ 成功' : '❌ 失败');
  console.log('迭代次数:', result3.iterations);
  console.log('');

  // 获取记忆
  console.log('─'.repeat(60));
  console.log('记忆状态');
  console.log('─'.repeat(60));
  const memory = bridge.getMemory();
  console.log('记忆数量:', memory.size);
  console.log('');

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║                    测试完成 ✅                                ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
}

testBridge().catch(console.error);
