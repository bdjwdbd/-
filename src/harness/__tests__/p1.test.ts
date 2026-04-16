/**
 * Harness Engineering P1 阶段测试
 * 
 * 测试：
 * - PPAF 闭环系统
 * - 四级沙盒隔离
 * 
 * @module harness/__tests__/p1.test
 */

import { PPAFEngine, PerceptionType, PlanningLevel, ActionType } from '../ppaf';
import { SandboxManager, SandboxLevel, RiskLevel } from '../sandbox';

// ============ 测试工具 ============

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function log(message: string): void {
  console.log(`[TEST] ${message}`);
}

// ============ PPAF 闭环测试 ============

async function testPPAF(): Promise<void> {
  log('========== PPAF 闭环系统测试 ==========');

  const engine = new PPAFEngine({
    workspaceRoot: '/tmp/harness-test',
    maxIterations: 5,
    enableAutoReplanning: true,
    enableLearning: true,
  });

  // 测试 1: 感知
  log('测试 1: 感知');
  const perceptor = engine.getPerceptor();
  const perceptionResult = await perceptor.perceive([
    {
      type: PerceptionType.TEXT,
      data: '请帮我执行一个命令',
      timestamp: Date.now(),
    },
    {
      type: PerceptionType.SYSTEM,
      data: null,
      timestamp: Date.now(),
    },
  ]);
  assert(!!perceptionResult.perceptionId, '应该有感知 ID');
  log(`  ✓ 感知成功: ${perceptionResult.perceptionId}`);
  log(`  ✓ 置信度: ${(perceptionResult.confidence * 100).toFixed(1)}%`);
  log(`  ✓ 异常数: ${perceptionResult.anomalies.length}`);

  // 测试 2: 规划
  log('测试 2: 规划');
  const planner = engine.getPlanner();
  const planResult = await planner.plan(perceptionResult, PlanningLevel.OPERATIONAL);
  assert(!!planResult.planId, '应该有规划 ID');
  log(`  ✓ 规划成功: ${planResult.planId}`);
  log(`  ✓ 步骤数: ${planResult.steps.length}`);
  log(`  ✓ 并行组: ${planResult.parallelGroups.length}`);
  log(`  ✓ 预计耗时: ${planResult.totalEstimatedDuration}ms`);

  // 测试 3: 执行
  log('测试 3: 执行');
  const executor = engine.getExecutor();
  const actionResult = await executor.execute({
    actionId: 'test_action',
    type: ActionType.TOOL_CALL,
    name: '测试动作',
    input: { test: true },
    preconditions: [],
    postconditions: [],
    timeout: 5000,
    maxRetries: 2,
  });
  assert(!!actionResult.actionId, '应该有动作 ID');
  log(`  ✓ 执行成功: ${actionResult.actionId}`);
  log(`  ✓ 状态: ${actionResult.status}`);
  log(`  ✓ 耗时: ${actionResult.duration}ms`);

  // 测试 4: 反馈
  log('测试 4: 反馈');
  const feedbackProcessor = engine.getFeedbackProcessor();
  const feedbackResult = await feedbackProcessor.process(actionResult, planResult);
  assert(feedbackResult.processed, '反馈应该已处理');
  log(`  ✓ 反馈处理成功`);
  log(`  ✓ 行动数: ${feedbackResult.actions.length}`);
  if (feedbackResult.learning) {
    log(`  ✓ 学习: ${feedbackResult.learning.knowledge.substring(0, 50)}...`);
  }

  // 测试 5: 完整闭环
  log('测试 5: 完整 PPAF 闭环');
  const context = await engine.run([
    {
      type: PerceptionType.TEXT,
      data: '帮我搜索一下天气',
      timestamp: Date.now(),
    },
  ]);
  assert(context.completed, '闭环应该完成');
  log(`  ✓ 闭环完成: ${context.loopId}`);
  log(`  ✓ 迭代次数: ${context.iteration}`);
  log(`  ✓ 动作数: ${context.actions.length}`);
  log(`  ✓ 完成原因: ${context.completionReason}`);

  log('✅ PPAF 闭环系统测试通过\n');
}

// ============ 沙盒隔离测试 ============

async function testSandbox(): Promise<void> {
  log('========== 四级沙盒隔离测试 ==========');

  const manager = new SandboxManager({
    workspaceRoot: '/tmp/harness-test',
    defaultLevel: SandboxLevel.PROCESS,
    maxSandboxes: 10,
    enableMonitoring: true,
    enableAudit: true,
  });

  await manager.initialize();

  // 测试 1: 创建沙盒
  log('测试 1: 创建沙盒');
  const sandbox1 = await manager.create({
    name: 'test_sandbox_1',
    level: SandboxLevel.PROCESS,
  });
  assert(!!sandbox1.sandboxId, '应该有沙盒 ID');
  log(`  ✓ 创建成功: ${sandbox1.sandboxId}`);
  log(`  ✓ 级别: L${sandbox1.config.level}`);
  log(`  ✓ 内存限制: ${sandbox1.config.resourceLimits.memory}MB`);

  // 测试 2: 不同级别沙盒
  log('测试 2: 不同级别沙盒');
  const sandbox2 = await manager.create({
    name: 'test_sandbox_2',
    level: SandboxLevel.CONTAINER,
  });
  log(`  ✓ L2 容器级沙盒: ${sandbox2.sandboxId}`);

  // 测试 3: 执行操作
  log('测试 3: 执行操作');
  const result = await manager.execute(sandbox1.sandboxId, async () => {
    return { output: 'test result' };
  });
  assert(result.success, '执行应该成功');
  log(`  ✓ 执行成功: ${result.executionId}`);
  log(`  ✓ 耗时: ${result.duration}ms`);

  // 测试 4: 风险评估
  log('测试 4: 风险评估');
  const assessment = manager.assessRisk({
    type: 'exec',
    input: 'rm -rf /',
    tools: ['exec', 'shell'],
  });
  log(`  风险级别: ${assessment.level}`);
  log(`  平均风险: ${assessment.riskFactors.reduce((sum, f) => sum + f.weight, 0) / assessment.riskFactors.length}`);
  log(`  推荐沙盒级别: L${assessment.recommendedLevel}`);
  log(`  风险因素: ${assessment.riskFactors.map(f => `${f.factor}=${f.weight}`).join(', ')}`);
  log(`  缓解措施: ${assessment.mitigations.length}`);
  assert(assessment.level === RiskLevel.CRITICAL || assessment.level === RiskLevel.HIGH, '应该是高风险或极高风险');

  // 测试 5: 自动风险评估创建
  log('测试 5: 自动风险评估创建');
  const sandbox3 = await manager.createWithRiskAssessment({
    name: 'auto_risk_sandbox',
    operation: {
      type: 'read',
      input: '/etc/passwd',
      tools: ['read'],
    },
  });
  log(`  ✓ 自动创建沙盒: ${sandbox3.sandboxId}`);
  log(`  ✓ 自动选择级别: L${sandbox3.config.level}`);

  // 测试 6: 统计信息
  log('测试 6: 统计信息');
  const stats = manager.getStats();
  log(`  ✓ 总沙盒数: ${stats.totalSandboxes}`);
  log(`  ✓ L1 进程级: ${stats.byLevel[SandboxLevel.PROCESS]}`);
  log(`  ✓ L2 容器级: ${stats.byLevel[SandboxLevel.CONTAINER]}`);

  // 测试 7: 销毁沙盒
  log('测试 7: 销毁沙盒');
  const destroyed = await manager.destroy(sandbox1.sandboxId);
  assert(destroyed, '销毁应该成功');
  log(`  ✓ 销毁成功: ${sandbox1.sandboxId}`);

  // 测试 8: 审计日志
  log('测试 8: 审计日志');
  const auditLog = manager.getAuditLog(10);
  log(`  ✓ 审计日志条数: ${auditLog.length}`);

  await manager.close();
  log('✅ 四级沙盒隔离测试通过\n');
}

// ============ 运行所有测试 ============

async function runAllTests(): Promise<void> {
  console.log('\n========================================');
  console.log('  Harness Engineering P1 阶段测试');
  console.log('========================================\n');

  try {
    await testPPAF();
    await testSandbox();

    console.log('\n========================================');
    console.log('  ✅ 所有 P1 测试通过！');
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
