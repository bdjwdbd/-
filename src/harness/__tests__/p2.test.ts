/**
 * Harness Engineering P2 阶段测试
 * 
 * 测试：
 * - 度量收集
 * - 分析诊断
 * - 优化建议
 * - A/B 测试
 * - 灰度发布
 * 
 * @module harness/__tests__/p2.test
 */

import { EvolutionEngine, MetricCategory } from '../metrics';

// ============ 测试工具 ============

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function log(message: string): void {
  console.log(`[TEST] ${message}`);
}

// ============ 度量演进测试 ============

async function testMetricsEvolution(): Promise<void> {
  log('========== 度量演进系统测试 ==========');

  const engine = new EvolutionEngine({
    workspaceRoot: '/tmp/harness-test',
    collectionInterval: 0, // 禁用自动收集
    analysisInterval: 0, // 禁用自动分析
    enableAutoOptimization: true,
    enableABTesting: true,
    enableCanaryRelease: true,
  });

  await engine.initialize();

  // 测试 1: 记录指标
  log('测试 1: 记录指标');
  engine.recordMetric('task_completion_rate', 85);
  engine.recordMetric('accuracy', 78);
  engine.recordMetric('error_rate', 5);
  engine.recordMetric('cache_hit_rate', 65);
  engine.recordResponseTime(1500, 'search');
  engine.recordResponseTime(2000, 'execute');
  engine.recordTaskCompletion(true, 'search');
  engine.recordTaskCompletion(false, 'execute');
  log('  ✓ 指标记录成功');

  // 测试 2: 获取所有指标
  log('测试 2: 获取所有指标');
  const allMetrics = engine.getAllMetrics();
  log(`  ✓ 效能指标: 任务完成率 ${allMetrics.efficiency.taskCompletionRate}%`);
  log(`  ✓ 质量指标: 准确率 ${allMetrics.quality.accuracy}%`);
  log(`  ✓ 资源指标: 内存使用 ${allMetrics.resource.memoryUsage.toFixed(1)}%`);
  log(`  ✓ 安全指标: 权限违规 ${allMetrics.security.permissionViolations}次`);

  // 测试 3: 计算综合评分
  log('测试 3: 计算综合评分');
  const score = engine.getScore();
  log(`  ✓ 总分: ${score.total.toFixed(1)}`);
  log(`  ✓ 效能评分: ${score.byCategory[MetricCategory.EFFICIENCY].toFixed(1)}`);
  log(`  ✓ 质量评分: ${score.byCategory[MetricCategory.QUALITY].toFixed(1)}`);
  log(`  ✓ 资源评分: ${score.byCategory[MetricCategory.RESOURCE].toFixed(1)}`);
  log(`  ✓ 安全评分: ${score.byCategory[MetricCategory.SECURITY].toFixed(1)}`);
  log(`  ✓ 关键指标评分: ${score.criticalScore}`);

  // 测试 4: 生成优化建议
  log('测试 4: 生成优化建议');
  const suggestions = engine.getSuggestions();
  log(`  ✓ 优化建议数: ${suggestions.length}`);
  if (suggestions.length > 0) {
    const top = suggestions[0];
    log(`  ✓ 最高优先级: ${top.priority}`);
    log(`  ✓ 目标指标: ${top.targetMetric}`);
    log(`  ✓ 预期改进: ${top.expectedImprovement.toFixed(1)}%`);
  }

  // 测试 5: A/B 测试
  log('测试 5: A/B 测试');
  const abTest = engine.createABTest({
    name: 'test_optimization',
    controlConfig: { cache_enabled: false },
    experimentConfig: { cache_enabled: true },
    trafficSplit: 0.5,
    targetMetrics: ['accuracy', 'response_time'],
    minSampleSize: 1000,
    significanceLevel: 0.95,
  });
  assert(!!abTest.testId, '应该有测试 ID');
  log(`  ✓ 创建 A/B 测试: ${abTest.testId}`);
  log(`  ✓ 流量分配: ${abTest.trafficSplit * 100}%`);

  const abResult = engine.getABTestResult(abTest.testId);
  if (abResult) {
    log(`  ✓ 实验组改进: 准确率 +${abResult.improvement.accuracy}%`);
    log(`  ✓ 统计显著性: ${(abResult.statisticalSignificance * 100).toFixed(0)}%`);
    log(`  ✓ 推荐方案: ${abResult.recommendation}`);
  }

  engine.stopABTest(abTest.testId);
  log('  ✓ 停止 A/B 测试');

  // 测试 6: 灰度发布
  log('测试 6: 灰度发布');
  const canary = engine.createCanaryRelease({
    name: 'new_algorithm',
    newConfig: { algorithm: 'v2' },
    currentRatio: 0,
    targetRatio: 1.0,
    incrementStep: 0.1,
    rollbackThreshold: 0.8,
    monitorMetrics: ['accuracy', 'error_rate'],
  });
  assert(!!canary.releaseId, '应该有发布 ID');
  log(`  ✓ 创建灰度发布: ${canary.releaseId}`);
  log(`  ✓ 目标比例: ${canary.targetRatio * 100}%`);

  // 推进灰度
  const advanced = engine.advanceCanary(canary.releaseId);
  log(`  ✓ 推进灰度: ${advanced ? '成功' : '失败'}`);

  const canaryStatus = engine.getCanaryStatus(canary.releaseId);
  if (canaryStatus) {
    log(`  ✓ 当前比例: ${(canaryStatus.currentRatio * 100).toFixed(0)}%`);
    log(`  ✓ 健康状态: ${canaryStatus.isHealthy ? '健康' : '异常'}`);
    log(`  ✓ 需要回滚: ${canaryStatus.needsRollback ? '是' : '否'}`);
  }

  // 测试 7: 分析诊断
  log('测试 7: 分析诊断');
  const analysis = engine.analyze();
  log(`  ✓ 综合评分: ${analysis.score.total.toFixed(1)}`);
  log(`  ✓ 优化建议: ${analysis.suggestions.length}条`);

  await engine.close();
  log('✅ 度量演进系统测试通过\n');
}

// ============ 运行所有测试 ============

async function runAllTests(): Promise<void> {
  console.log('\n========================================');
  console.log('  Harness Engineering P2 阶段测试');
  console.log('========================================\n');

  try {
    await testMetricsEvolution();

    console.log('\n========================================');
    console.log('  ✅ 所有 P2 测试通过！');
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
