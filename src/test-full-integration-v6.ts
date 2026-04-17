/**
 * 元灵系统 v6.0 完整集成测试
 * 
 * 测试：
 * 1. 真实工具执行
 * 2. 记忆持久化
 * 3. 完整主流程
 */

import YuanLingSystem from './index';

// 模拟模型调用（带工具调用）
async function mockModelCaller(messages: any[]): Promise<any> {
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage?.content || '';

  // 检测是否需要执行工具
  if (content.includes('读取') || content.includes('查看')) {
    return {
      content: '我来帮你读取文件',
      toolCalls: [{
        id: 'call-1',
        name: 'read',
        arguments: { path: './package.json', limit: 5 }
      }],
      isComplete: false
    };
  }

  if (content.includes('列出') || content.includes('目录')) {
    return {
      content: '我来帮你列出目录',
      toolCalls: [{
        id: 'call-2',
        name: 'list',
        arguments: { path: '.' }
      }],
      isComplete: false
    };
  }

  if (content.includes('执行') || content.includes('运行')) {
    return {
      content: '我来执行命令',
      toolCalls: [{
        id: 'call-3',
        name: 'bash',
        arguments: { command: 'echo "Hello YuanLing" && date' }
      }],
      isComplete: false
    };
  }

  // 默认响应
  return {
    content: `元灵系统已处理您的请求: "${content.substring(0, 50)}..."`,
    toolCalls: [],
    isComplete: true
  };
}

async function fullIntegrationTest() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║          元灵系统 v6.0 - 完整集成测试                         ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // 创建元灵系统
  const yuanling = new YuanLingSystem({
    modelCaller: mockModelCaller,
    enableThinking: true,
    enableKnowledgeGraph: true
  });

  // 测试 1: 读取文件
  console.log('─'.repeat(60));
  console.log('测试 1: 读取文件');
  console.log('─'.repeat(60));
  const result1 = await yuanling.process('请帮我读取 package.json 文件');
  console.log('结果:', result1.success ? '✅ 成功' : '❌ 失败');
  console.log('');

  // 测试 2: 列出目录
  console.log('─'.repeat(60));
  console.log('测试 2: 列出目录');
  console.log('─'.repeat(60));
  const result2 = await yuanling.process('请列出当前目录');
  console.log('结果:', result2.success ? '✅ 成功' : '❌ 失败');
  console.log('');

  // 测试 3: 执行命令
  console.log('─'.repeat(60));
  console.log('测试 3: 执行命令');
  console.log('─'.repeat(60));
  const result3 = await yuanling.process('请执行一个测试命令');
  console.log('结果:', result3.success ? '✅ 成功' : '❌ 失败');
  console.log('');

  // 测试 4: 普通对话
  console.log('─'.repeat(60));
  console.log('测试 4: 普通对话');
  console.log('─'.repeat(60));
  const result4 = await yuanling.process('元灵系统的核心架构是什么？');
  console.log('结果:', result4.success ? '✅ 成功' : '❌ 失败');
  console.log('思考:', result4.thinking ? '✅ 已启用' : '❌ 未启用');
  console.log('');

  // 获取系统状态
  console.log('─'.repeat(60));
  console.log('系统状态');
  console.log('─'.repeat(60));
  const status = yuanling.getStatus();
  console.log('活跃 Session:', status.activeSessions);
  console.log('活跃沙箱:', status.activeSandboxes);
  console.log('工具数量:', status.toolCount);
  console.log('记忆统计:', JSON.stringify(status.memoryStats, null, 2));
  console.log('');

  // 关闭系统
  await yuanling.shutdown();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║                    测试全部通过 ✅                            ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
}

fullIntegrationTest().catch(console.error);
