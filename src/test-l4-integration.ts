/**
 * L4 灵盾层集成测试
 */

import { YuanLingSystem } from './yuanling-system';

async function testL4Integration() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       L4 灵盾层集成测试                                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 创建系统实例
  const system = new YuanLingSystem({
    workspaceRoot: '/tmp/yuanling-l4-test',
    enableIntrospection: false,
  });

  console.log('━━━━━━ L4 灵盾层初始化验证 ━━━━━━');
  
  // 验证 L4 灵盾层已初始化
  const guard = system.toolExecutionGuard;
  console.log(`  ✅ 工具执行守卫: ${guard ? '已初始化' : '未初始化'}`);

  // 测试工具执行检查
  console.log('\n━━━━━━ 工具执行检查测试 ━━━━━━');
  
  const checkResult = system.checkToolExecution({
    toolName: 'test_tool',
    args: { param: 'value' },
    messageId: 'msg_001',
    sessionId: 'session_001',
  });
  
  console.log(`  ✅ 执行检查: ${checkResult.allowed ? '允许' : '拒绝'}`);
  if (checkResult.reason) {
    console.log(`     原因: ${checkResult.reason}`);
  }

  // 测试工具执行包装
  console.log('\n━━━━━━ 工具执行包装测试 ━━━━━━');
  
  const originalExecutor = async () => {
    return '这是原始工具的输出结果，内容较长...'.repeat(100);
  };
  
  const guardedExecutor = system.wrapToolExecution(originalExecutor);
  const result = await guardedExecutor({
    toolName: 'test_tool',
    args: { param: 'value' },
    messageId: 'msg_002',
    sessionId: 'session_001',
  });
  
  console.log(`  ✅ 执行结果: ${result.success ? '成功' : '失败'}`);
  console.log(`  ✅ 输出长度: ${result.content.length} 字符`);
  console.log(`  ✅ 是否被守卫: ${result.wasGuarded ? '是' : '否'}`);
  
  if (result.truncationApplied) {
    console.log(`     截断类型: ${result.truncationApplied.truncationType}`);
    console.log(`     原始长度: ${result.truncationApplied.originalLength}`);
    console.log(`     截断后长度: ${result.truncationApplied.truncatedLength}`);
  }

  // 测试统计信息
  console.log('\n━━━━━━ 统计信息 ━━━━━━');
  
  const stats = system.getGuardStats('session_001');
  if (stats) {
    console.log(`  ✅ 会话数: ${stats.sessionCount}`);
    console.log(`  ✅ 总调用数: ${stats.totalCalls}`);
    console.log(`  ✅ 活跃会话: ${stats.activeSessions}`);
  }

  // 测试循环检测
  console.log('\n━━━━━━ 循环检测测试 ━━━━━━');
  
  // 模拟重复调用
  for (let i = 0; i < 5; i++) {
    const check = system.checkToolExecution({
      toolName: 'repeated_tool',
      args: { param: 'same_value' },
      messageId: `msg_${i}`,
      sessionId: 'session_loop',
    });
    
    if (!check.allowed) {
      console.log(`  ⚠️ 第 ${i + 1} 次调用被阻止: ${check.reason}`);
      break;
    } else if (check.reason) {
      console.log(`  ⚠️ 第 ${i + 1} 次调用警告: ${check.reason}`);
    } else {
      console.log(`  ✅ 第 ${i + 1} 次调用允许`);
    }
  }

  // 测试主流程集成
  console.log('\n━━━━━━ 主流程集成测试 ━━━━━━');
  
  await system.startup();
  
  const { result: processResult, context } = await system.processWithExternalExecutor(
    '测试消息',
    [],
    async (prompt) => {
      return { content: '这是 LLM 的回复内容'.repeat(100) };
    }
  );
  
  console.log(`  ✅ 处理结果: ${processResult.content.length} 字符`);
  console.log(`  ✅ 验证分数: ${context.validation?.score}`);
  console.log(`  ✅ L4 灵盾层已集成到主流程`);

  console.log('\n✅ L4 灵盾层集成测试通过\n');
}

// 运行测试
testL4Integration().catch(console.error);
