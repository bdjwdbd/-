/**
 * Harness Engineering 集成测试
 * 
 * 验证：
 * - 状态管理器功能
 * - 追踪系统功能
 * - 元灵系统集成
 * 
 * @module harness/__tests__/integration.test
 */

import { StateManager, StateCategory } from '../state-manager';
import { TraceCollector, Layer, SpanStatus } from '../trace-system';
import { HarnessSystem } from '../index';

// ============ 测试工具 ============

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function log(message: string): void {
  console.log(`[TEST] ${message}`);
}

// ============ 状态管理器测试 ============

async function testStateManager(): Promise<void> {
  log('========== 状态管理器测试 ==========');

  const manager = new StateManager({
    workspaceRoot: '/tmp/harness-test',
    enablePersistence: true,
    enableAudit: true,
  });

  await manager.initialize();

  // 测试 1: 设置和获取状态
  log('测试 1: 设置和获取状态');
  const setResult = await manager.set('test_key', { value: 'test_value' }, StateCategory.SESSION);
  assert(setResult.success, '设置状态应该成功');
  log(`  ✓ 设置状态成功: ${setResult.latency}ms`);

  const getResult = await manager.get('test_key');
  assert(getResult.success, '获取状态应该成功');
  assert((getResult.data as any)?.value === 'test_value', '状态值应该正确');
  log(`  ✓ 获取状态成功: ${JSON.stringify(getResult.data)}`);

  // 测试 2: 状态分类
  log('测试 2: 状态分类');
  await manager.set('user:123', { name: 'Alice' }, StateCategory.USER);
  await manager.set('task:456', { status: 'running' }, StateCategory.TASK);
  await manager.set('memory:789', { content: 'important' }, StateCategory.MEMORY);
  log('  ✓ 多类别状态设置成功');

  // 测试 3: 检查点
  log('测试 3: 检查点');
  const checkpointResult = await manager.checkpoint(
    ['test_key', 'user:123'],
    '测试检查点'
  );
  assert(checkpointResult.success, '创建检查点应该成功');
  log(`  ✓ 创建检查点成功: ${checkpointResult.data}`);

  // 测试 4: 恢复
  log('测试 4: 从检查点恢复');
  await manager.delete('test_key');
  const restoreResult = await manager.restore(checkpointResult.data!);
  assert(restoreResult.success, '恢复应该成功');
  assert(restoreResult.data === 2, '应该恢复 2 个状态');
  log(`  ✓ 恢复成功: ${restoreResult.data} 个状态`);

  // 测试 5: 统计
  log('测试 5: 统计信息');
  const stats = manager.getStats();
  log(`  ✓ 总条目: ${stats.totalEntries}`);
  log(`  ✓ 检查点: ${stats.checkpointCount}`);
  log(`  ✓ 命中率: ${(stats.hitRate * 100).toFixed(1)}%`);

  // 测试 6: 审计日志
  log('测试 6: 审计日志');
  const auditLog = manager.getAuditLog(10);
  log(`  ✓ 审计日志条数: ${auditLog.length}`);

  await manager.close();
  log('✅ 状态管理器测试通过\n');
}

// ============ 追踪系统测试 ============

async function testTraceSystem(): Promise<void> {
  log('========== 追踪系统测试 ==========');

  const collector = new TraceCollector({
    workspaceRoot: '/tmp/harness-test',
    enabled: true,
    sampleRate: 1.0,
    enableDecisionAudit: true,
  });

  await collector.initialize();

  // 测试 1: 追踪生命周期
  log('测试 1: 追踪生命周期');
  const traceContext = collector.startTrace('test_trace', { test: true });
  assert(!!traceContext.traceId, '应该有追踪 ID');
  log(`  ✓ 开始追踪: ${traceContext.traceId}`);

  // 测试 2: 跨度管理
  log('测试 2: 跨度管理');
  const l0Span = collector.startSpan('L0_思考', Layer.L0, traceContext);
  assert(!!l0Span.spanId, '应该有跨度 ID');
  log(`  ✓ 开始 L0 跨度: ${l0Span.spanId}`);

  collector.addSpanAttribute(l0Span.spanId, 'depth', 'extensive');
  collector.addSpanTag(l0Span.spanId, 'test', true);
  collector.addSpanLog(l0Span.spanId, 'info', '思考中...');
  log('  ✓ 添加属性、标签、日志');

  collector.endSpan(l0Span.spanId);
  log('  ✓ 结束 L0 跨度');

  // 测试 3: 多层级跨度
  log('测试 3: 多层级跨度');
  const l1Span = collector.startSpan('L1_决策', Layer.L1, traceContext);
  const l2Span = collector.startSpan('L2_执行', Layer.L2, l1Span);
  collector.endSpan(l2Span.spanId);
  collector.endSpan(l1Span.spanId);
  log('  ✓ 多层级跨度创建成功');

  // 测试 4: 决策审计
  log('测试 4: 决策审计');
  const decisionId = collector.recordDecisionAudit({
    spanId: l1Span.spanId,
    input: 'test input',
    reasoning: 'test reasoning',
    output: 'test output',
    confidence: 0.85,
    alternatives: [
      { description: 'option1', probability: 0.3, reason: 'test' },
    ],
  });
  assert(!!decisionId, '应该有决策 ID');
  log(`  ✓ 记录决策审计: ${decisionId}`);

  // 测试 5: 结束追踪
  log('测试 5: 结束追踪');
  collector.endTrace(traceContext.traceId);
  const trace = collector.getTrace(traceContext.traceId);
  assert(trace?.status === SpanStatus.COMPLETED, '追踪应该完成');
  log(`  ✓ 追踪完成，状态: ${trace?.status}`);

  // 测试 6: 性能指标
  log('测试 6: 性能指标');
  if (trace) {
    const metrics = collector.calculateTraceMetrics(trace);
    log(`  ✓ 总耗时: ${metrics.totalDuration}ms`);
    log(`  ✓ 并行度: ${metrics.parallelism}`);
    log(`  ✓ 关键路径: ${metrics.criticalPath.join(' → ')}`);
  }

  // 测试 7: 统计
  log('测试 7: 统计信息');
  const stats = collector.getStats();
  log(`  ✓ 活跃追踪: ${stats.activeTraces}`);
  log(`  ✓ 完成追踪: ${stats.completedTraces}`);
  log(`  ✓ 决策审计: ${stats.decisionAudits}`);

  await collector.close();
  log('✅ 追踪系统测试通过\n');
}

// ============ Harness 系统集成测试 ============

async function testHarnessSystem(): Promise<void> {
  log('========== Harness 系统集成测试 ==========');

  const harness = new HarnessSystem({
    workspaceRoot: '/tmp/harness-test',
    enableStateManager: true,
    enableTracing: true,
    enableAudit: true,
  });

  await harness.initialize();

  // 测试 1: 状态管理
  log('测试 1: 状态管理');
  await harness.setState('test', { value: 123 }, StateCategory.SESSION);
  const state = await harness.getState('test');
  assert((state as any)?.value === 123, '状态应该正确');
  log('  ✓ 状态管理正常');

  // 测试 2: 追踪
  log('测试 2: 追踪');
  const traceContext = harness.startTrace('integration_test');
  if (traceContext) {
    const span = harness.startSpan('test_operation', Layer.L2, traceContext);
    if (span) {
      harness.endSpan(span.spanId);
    }
    harness.endTrace(traceContext.traceId);
    log('  ✓ 追踪正常');
  }

  // 测试 3: PPAF 辅助
  log('测试 3: PPAF 辅助');
  const result = await harness.withTracing('test_fn', Layer.L1, async () => {
    return 'success';
  });
  assert(result === 'success', 'withTracing 应该正确执行');
  log('  ✓ withTracing 正常');

  // 测试 4: 状态缓存
  log('测试 4: 状态缓存');
  const uniqueKey = `cached_key_${Date.now()}`; // 使用唯一 key 避免旧数据干扰
  let callCount = 0;
  const cachedResult = await harness.withState(uniqueKey, async () => {
    callCount++;
    return 'computed';
  });
  const cachedResult2 = await harness.withState(uniqueKey, async () => {
    callCount++;
    return 'computed';
  });
  assert(callCount === 1, '应该只计算一次');
  log('  ✓ 状态缓存正常');

  // 测试 5: 系统状态
  log('测试 5: 系统状态');
  const status = harness.getStatus();
  log(`  ✓ 初始化: ${status.initialized}`);
  log(`  ✓ 状态管理器: ${status.stateManager.enabled}`);
  log(`  ✓ 追踪收集器: ${status.traceCollector.enabled}`);

  await harness.close();
  log('✅ Harness 系统集成测试通过\n');
}

// ============ 运行所有测试 ============

async function runAllTests(): Promise<void> {
  console.log('\n========================================');
  console.log('  Harness Engineering 集成测试');
  console.log('========================================\n');

  try {
    await testStateManager();
    await testTraceSystem();
    await testHarnessSystem();

    console.log('\n========================================');
    console.log('  ✅ 所有测试通过！');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 导出测试函数
export { runAllTests };

// 如果直接运行
if (require.main === module) {
  runAllTests();
}
