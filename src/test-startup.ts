/**
 * 元灵系统 v6.0 启动测试
 */

import YuanLingSystem from './index';

// 模拟模型调用函数
async function mockModelCaller(messages: any[]): Promise<any> {
  return {
    content: '这是模拟的模型响应',
    toolCalls: [],
    isComplete: true
  };
}

// 主函数
async function main() {
  console.log('='.repeat(60));
  console.log('  元灵系统 v6.0 启动测试');
  console.log('='.repeat(60));
  console.log('');

  // 创建元灵系统实例
  const yuanling = new YuanLingSystem({
    modelCaller: mockModelCaller,
    enableThinking: true,
    enableKnowledgeGraph: true
  });

  // 测试消息处理
  const response = await yuanling.process('你好，请帮我分析一下元灵系统的架构');

  console.log('\n' + '='.repeat(60));
  console.log('  响应结果');
  console.log('='.repeat(60));
  console.log('');
  console.log('Session ID:', response.sessionId);
  console.log('成功:', response.success);
  console.log('内容:', response.content);
  console.log('思考:', response.thinking ? '已启用' : '未启用');
  console.log('记忆:', response.memory);
  console.log('');

  // 获取系统状态
  const status = yuanling.getStatus();
  console.log('系统状态:');
  console.log('  活跃 Session:', status.activeSessions);
  console.log('  活跃沙箱:', status.activeSandboxes);
  console.log('  工具数量:', status.toolCount);
  console.log('');

  // 关闭系统
  await yuanling.shutdown();

  console.log('='.repeat(60));
  console.log('  测试完成');
  console.log('='.repeat(60));
}

// 运行
main().catch(console.error);
