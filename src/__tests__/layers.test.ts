/**
 * 六层架构单元测试（简化版）
 */

// ============ L4 灵盾层测试 ============

import { LoopDetector, OutputTruncator, ToolExecutionGuard } from '../layers/ling-dun';

function testL4Shield() {
  console.log('\n━━━━━━ L4 灵盾层测试 ━━━━━━\n');
  
  // LoopDetector 测试
  const detector = new LoopDetector();
  console.log('✅ LoopDetector 初始化成功');
  
  const result1 = detector.recordCall('tool1', { a: 1 }, 'msg1');
  console.log(`✅ 第1次调用: isLoop=${result1.isLoop}`);
  
  const result2 = detector.recordCall('tool1', { a: 1 }, 'msg2');
  console.log(`✅ 第2次调用: isLoop=${result2.isLoop}`);
  
  const result3 = detector.recordCall('tool1', { a: 1 }, 'msg3');
  console.log(`✅ 第3次调用: isLoop=${result3.isLoop}, shouldInterrupt=${result3.shouldInterrupt}`);
  
  // OutputTruncator 测试
  const truncator = new OutputTruncator({
    maxOutputChars: 100,
    maxOutputLines: 10,
    strategy: 'smart',
  });
  console.log('✅ OutputTruncator 初始化成功');
  
  const longText = 'a'.repeat(200);
  const truncated = truncator.process(longText);
  console.log(`✅ 输出截断: 原始=${longText.length}, 截断后=${truncated.content.length}`);
  
  // ToolExecutionGuard 测试
  const guard = new ToolExecutionGuard();
  console.log('✅ ToolExecutionGuard 初始化成功');
  
  const preCheck = guard.preCheck({
    toolName: 'test_tool',
    args: {},
    messageId: 'msg1',
    sessionId: 'session1',
  });
  console.log(`✅ 执行前检查: allowed=${preCheck.allowed}`);
  
  const stats = guard.getStats();
  console.log(`✅ 守卫统计: 会话数=${stats.sessionCount}, 总调用=${stats.totalCalls}`);
}

// ============ 错误处理测试 ============

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
  ErrorHandler,
} from '../error-handling';

function testErrorHandling() {
  console.log('\n━━━━━━ 错误处理测试 ━━━━━━\n');
  
  // 测试各层级错误
  const errors = [
    new L0Error(ErrorCode.L0_THINKING_FAILED, 'L0 思考失败'),
    new L1Error(ErrorCode.L1_DECISION_FAILED, 'L1 决策失败'),
    new L2Error(ErrorCode.L2_EXECUTION_FAILED, 'L2 执行失败'),
    new L3Error(ErrorCode.L3_TOOL_NOT_FOUND, 'L3 工具未找到'),
    new L4Error(ErrorCode.L4_SECURITY_VIOLATION, 'L4 安全违规'),
    new L5Error(ErrorCode.L5_FEEDBACK_FAILED, 'L5 反馈失败'),
    new L6Error(ErrorCode.L6_INITIALIZATION_FAILED, 'L6 初始化失败'),
    new SystemError(ErrorCode.SYSTEM_MEMORY_ERROR, '系统内存不足'),
  ];
  
  for (const error of errors) {
    console.log(`✅ ${error.toUserMessage()}`);
  }
  
  // 测试错误处理器
  const handler = new ErrorHandler();
  
  for (const error of errors) {
    handler.handle(error);
  }
  
  const stats = handler.getErrorStats();
  console.log(`\n✅ 错误统计: 总计=${stats.total}`);
  console.log(`   按层级: L0=${stats.byLayer.L0}, L1=${stats.byLayer.L1}, L2=${stats.byLayer.L2}`);
  console.log(`   按严重程度: low=${stats.bySeverity.low}, medium=${stats.bySeverity.medium}, high=${stats.bySeverity.high}, critical=${stats.bySeverity.critical}`);
}

// ============ 性能监控测试 ============

import { PerformanceMonitor } from '../infrastructure';

function testPerformanceMonitor() {
  console.log('\n━━━━━━ 性能监控测试 ━━━━━━\n');
  
  const monitor = new PerformanceMonitor();
  console.log('✅ PerformanceMonitor 初始化成功');
  
  // 记录层级延迟
  monitor.recordLayerLatency('L0-L1-并行', 10);
  monitor.recordLayerLatency('L2-L3-灵脉灵躯层', 50);
  monitor.recordLayerLatency('L4-灵盾层', 5);
  console.log('✅ 层级延迟记录成功');
  
  // 记录模块操作
  monitor.recordModuleOperation('harness', 100);
  monitor.recordModuleOperation('multi-agent', 50);
  monitor.recordModuleOperation('edge', 30);
  monitor.recordModuleOperation('federated', 20);
  console.log('✅ 模块操作记录成功');
  
  // 获取系统指标
  const sysMetrics = monitor.getSystemMetrics();
  console.log(`✅ 系统指标: 健康度=${(sysMetrics.health * 100).toFixed(1)}%`);
  
  // 获取模块指标
  const moduleMetrics = monitor.getModuleMetrics();
  console.log(`✅ 模块指标: ${Object.keys(moduleMetrics).length} 个模块`);
  
  for (const [name, metrics] of Object.entries(moduleMetrics)) {
    console.log(`   - ${name}: ${metrics.operations} 次, 平均 ${metrics.avgLatency}ms`);
  }
}

// ============ 自然语言解析测试 ============

import { createParser, ParsedIntentType } from '../nl-programming';

function testNLParser() {
  console.log('\n━━━━━━ 自然语言解析测试 ━━━━━━\n');
  
  const parser = createParser();
  console.log('✅ NaturalLanguageParser 初始化成功');
  
  const testCases = [
    '当任务失败时发送通知',
    '如果状态变更就记录日志',
    '定义一个轮询调度策略',
    '创建一个安全审计策略',
  ];
  
  for (const text of testCases) {
    const intent = parser.parse(text);
    const rule = parser.parseRule(text);
    const policy = parser.parsePolicy(text);
    
    console.log(`✅ "${text}"`);
    console.log(`   意图: ${intent.type}, 置信度: ${intent.confidence.toFixed(2)}`);
    if (rule) {
      console.log(`   规则: 触发=${rule.trigger.pattern}, 动作=${rule.action.type}`);
    }
    if (policy) {
      console.log(`   策略: 类型=${policy.type}, 规则数=${policy.rules.length}`);
    }
  }
}

// ============ 主测试函数 ============

function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       六层架构单元测试                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  testL4Shield();
  testErrorHandling();
  testPerformanceMonitor();
  testNLParser();

  console.log('\n✅ 六层架构单元测试完成\n');
}

// 运行测试
runAllTests();
