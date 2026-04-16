/**
 * 统一错误处理测试
 */

import { YuanLingSystem } from './yuanling-system';
import {
  YuanLingError,
  ErrorCode,
  L0Error,
  L1Error,
  L2Error,
  L3Error,
  L4Error,
  L5Error,
  L6Error,
  SystemError,
  ModuleError,
  ErrorHandler,
  handleError,
} from './error-handling';

function testErrorHandling() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       统一错误处理测试                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 测试错误类型
  console.log('━━━━━━ 错误类型测试 ━━━━━━\n');

  // L0 错误
  const l0Error = new L0Error(ErrorCode.L0_THINKING_FAILED, '思考失败', {
    context: { input: '测试输入' },
  });
  console.log(`✅ L0Error: ${l0Error.toUserMessage()}`);
  console.log(`   代码: ${l0Error.code}, 层级: ${l0Error.layer}, 严重程度: ${l0Error.severity}`);

  // L1 错误
  const l1Error = new L1Error(ErrorCode.L1_DECISION_FAILED, '决策失败');
  console.log(`✅ L1Error: ${l1Error.toUserMessage()}`);

  // L2 错误
  const l2Error = new L2Error(ErrorCode.L2_EXECUTION_FAILED, '执行失败');
  console.log(`✅ L2Error: ${l2Error.toUserMessage()}`);

  // L3 错误
  const l3Error = new L3Error(ErrorCode.L3_TOOL_NOT_FOUND, '工具未找到');
  console.log(`✅ L3Error: ${l3Error.toUserMessage()}`);

  // L4 错误
  const l4Error = new L4Error(ErrorCode.L4_SECURITY_VIOLATION, '安全违规');
  console.log(`✅ L4Error: ${l4Error.toUserMessage()}`);

  // L5 错误
  const l5Error = new L5Error(ErrorCode.L5_FEEDBACK_FAILED, '反馈失败');
  console.log(`✅ L5Error: ${l5Error.toUserMessage()}`);

  // L6 错误
  const l6Error = new L6Error(ErrorCode.L6_INITIALIZATION_FAILED, '初始化失败');
  console.log(`✅ L6Error: ${l6Error.toUserMessage()}`);

  // 系统错误
  const sysError = new SystemError(ErrorCode.SYSTEM_MEMORY_ERROR, '内存不足');
  console.log(`✅ SystemError: ${sysError.toUserMessage()}`);

  // 模块错误
  const moduleError = new ModuleError(ErrorCode.MODULE_HARNESS_ERROR, 'Harness', '状态管理失败');
  console.log(`✅ ModuleError: ${moduleError.toUserMessage()}`);

  // 测试错误处理器
  console.log('\n━━━━━━ 错误处理器测试 ━━━━━━\n');

  const handler = new ErrorHandler({ enableLogging: true });

  // 处理各种错误
  handler.handle(l0Error);
  handler.handle(l1Error);
  handler.handle(l2Error);
  handler.handle(new Error('普通错误'));

  // 获取统计
  const stats = handler.getErrorStats();
  console.log(`✅ 总错误数: ${stats.total}`);
  console.log(`   按层级: L0=${stats.byLayer.L0}, L1=${stats.byLayer.L1}, L2=${stats.byLayer.L2}, SYSTEM=${stats.byLayer.SYSTEM}`);
  console.log(`   按严重程度: low=${stats.bySeverity.low}, medium=${stats.bySeverity.medium}, high=${stats.bySeverity.high}, critical=${stats.bySeverity.critical}`);

  // 测试 JSON 序列化
  console.log('\n━━━━━━ JSON 序列化测试 ━━━━━━\n');

  const json = l0Error.toJSON();
  console.log('✅ L0Error JSON:');
  console.log(`   ${JSON.stringify(json, null, 2).split('\n').join('\n   ')}`);

  // 测试系统集成
  console.log('\n━━━━━━ 系统集成测试 ━━━━━━\n');

  const system = new YuanLingSystem({
    workspaceRoot: '/tmp/yuanling-error-test',
    enableIntrospection: false,
  });

  // 获取错误处理器
  const systemHandler = system.errorHandler;
  console.log(`✅ 系统错误处理器: ${systemHandler ? '已初始化' : '未初始化'}`);

  // 模拟错误
  systemHandler.handle(new L4Error(ErrorCode.L4_LOOP_DETECTED, '检测到循环'));
  systemHandler.handle(new L3Error(ErrorCode.L3_TOOL_EXECUTION_FAILED, '工具执行失败'));

  // 获取错误统计
  const systemStats = system.getErrorStats();
  console.log(`✅ 系统错误统计: 总计 ${systemStats.total} 个错误`);

  // 获取错误历史
  const history = system.getErrorHistory(5);
  console.log(`✅ 错误历史: ${history.length} 条记录`);

  for (const error of history) {
    console.log(`   - [${error.layer}] ${error.code}: ${error.message}`);
  }

  // 清除历史
  system.clearErrorHistory();
  console.log(`✅ 错误历史已清除`);

  const clearedStats = system.getErrorStats();
  console.log(`✅ 清除后统计: 总计 ${clearedStats.total} 个错误`);

  console.log('\n✅ 统一错误处理测试通过\n');
}

// 运行测试
testErrorHandling();
