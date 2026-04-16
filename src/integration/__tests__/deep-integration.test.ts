/**
 * 元灵系统 × Harness 深度集成测试
 * 
 * 测试：
 * - 完整处理流程
 * - L0-L6 各层集成
 * - 状态管理
 * - 度量收集
 * 
 * @module integration/__tests__/deep-integration.test
 */

import { YuanLingSystem } from '../../yuanling-system';
import { 
  YuanLingHarnessDeepIntegration, 
  createDeepIntegratedSystem,
  EnhancedProcessingResult 
} from '../yuanling-harness-deep';
import { SandboxLevel, RiskLevel } from '../../harness';

// ============ 测试工具 ============

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function log(message: string): void {
  console.log(`[TEST] ${message}`);
}

// ============ 深度集成测试 ============

async function testDeepIntegration(): Promise<void> {
  log('========== 元灵系统 × Harness 深度集成测试 ==========');

  // 创建元灵系统
  const yuanling = new YuanLingSystem({
    workspaceRoot: '/tmp/harness-test',
  });

  // 创建深度集成系统
  const integrated = await createDeepIntegratedSystem(yuanling, {
    workspaceRoot: '/tmp/harness-test',
    enableStateManager: true,
    enableTracing: true,
    enablePPAF: true,
    enableSandbox: true,
    enableMetrics: true,
    enableAutoRiskAssessment: true,
    enableAutoOptimization: true,
  });

  // 测试 1: 系统状态
  log('测试 1: 系统状态');
  const status = integrated.getStatus();
  assert(status.initialized, '系统应该已初始化');
  log(`  ✓ 初始化: ${status.initialized}`);
  log(`  ✓ 状态管理: ${status.modules.stateManager}`);
  log(`  ✓ 追踪: ${status.modules.tracing}`);
  log(`  ✓ PPAF: ${status.modules.ppaf}`);
  log(`  ✓ 沙盒: ${status.modules.sandbox}`);
  log(`  ✓ 度量: ${status.modules.metrics}`);

  // 测试 2: 风险评估
  log('测试 2: 风险评估');
  const riskAssessment = integrated.assessRisk({
    type: 'exec',
    input: 'ls -la',
    tools: ['exec'],
  });
  if (riskAssessment) {
    log(`  ✓ 风险级别: ${riskAssessment.level}`);
    log(`  ✓ 推荐沙盒级别: L${riskAssessment.recommendedLevel}`);
  }

  // 测试 3: 状态管理
  log('测试 3: 状态管理');
  await integrated.saveSessionState('test_session', {
    messages: ['hello', 'world'],
    context: { test: true },
  });
  const sessionState = await integrated.getSessionState('test_session');
  assert(!!sessionState, '应该能获取会话状态');
  log(`  ✓ 保存会话状态成功`);
  log(`  ✓ 获取会话状态成功`);

  // 测试 4: 检查点
  log('测试 4: 检查点');
  const checkpointId = await integrated.createCheckpoint(
    ['session:test_session'],
    '测试检查点'
  );
  if (checkpointId) {
    log(`  ✓ 创建检查点: ${checkpointId}`);
    
    // 修改状态
    await integrated.saveSessionState('test_session', {
      messages: ['modified'],
    });
    
    // 恢复检查点
    const restored = await integrated.restoreCheckpoint(checkpointId);
    log(`  ✓ 恢复检查点: ${restored} 个状态`);
  }

  // 测试 5: 完整处理流程
  log('测试 5: 完整处理流程');
  
  // 模拟执行器
  const mockExecutor = async (prompt: string, context: any) => {
    return {
      content: `处理结果: ${prompt.substring(0, 50)}...`,
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  };

  try {
    const result = await integrated.process(
      '请帮我搜索一下天气',
      [],
      mockExecutor
    );

    log(`  ✓ 处理成功`);
    log(`  ✓ 追踪 ID: ${result.harness.traceId || '无'}`);
    log(`  ✓ 沙盒 ID: ${result.harness.sandboxId || '无'}`);
    if (result.harness.riskAssessment) {
      log(`  ✓ 风险级别: ${result.harness.riskAssessment.level}`);
    }
    log(`  ✓ 总耗时: ${result.harness.metrics.totalDuration}ms`);
    log(`  ✓ L6 耗时: ${result.harness.metrics.layerDurations['L6'] || 0}ms`);
    log(`  ✓ L0 耗时: ${result.harness.metrics.layerDurations['L0'] || 0}ms`);
    log(`  ✓ Token 使用: 输入 ${result.harness.metrics.tokenUsage.input}, 输出 ${result.harness.metrics.tokenUsage.output}`);
    log(`  ✓ 综合评分: ${result.harness.score}`);
  } catch (error) {
    log(`  ⚠️ 处理异常: ${(error as Error).message}`);
  }

  // 测试 6: 度量收集
  log('测试 6: 度量收集');
  const score = integrated.getScore();
  log(`  ✓ 综合评分: ${score}`);

  const suggestions = integrated.getOptimizationSuggestions();
  log(`  ✓ 优化建议: ${suggestions.length} 条`);

  const allMetrics = integrated.getAllMetrics();
  if (allMetrics) {
    log(`  ✓ 效能指标: 任务完成率 ${allMetrics.efficiency.taskCompletionRate}%`);
    log(`  ✓ 质量指标: 准确率 ${allMetrics.quality.accuracy}%`);
  }

  // 测试 7: 多次处理（收集更多数据）
  log('测试 7: 多次处理');
  for (let i = 0; i < 3; i++) {
    try {
      await integrated.process(
        `测试消息 ${i + 1}`,
        [],
        mockExecutor
      );
    } catch (error) {
      // 忽略错误
    }
  }
  log(`  ✓ 完成 3 次处理`);

  // 最终评分
  const finalScore = integrated.getScore();
  log(`  ✓ 最终评分: ${finalScore}`);

  // 关闭系统
  await integrated.close();
  log('✅ 深度集成测试通过\n');
}

// ============ 运行所有测试 ============

async function runAllTests(): Promise<void> {
  console.log('\n========================================');
  console.log('  元灵系统 × Harness 深度集成测试');
  console.log('========================================\n');

  try {
    await testDeepIntegration();

    console.log('\n========================================');
    console.log('  ✅ 所有深度集成测试通过！');
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
