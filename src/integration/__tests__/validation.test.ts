/**
 * Harness Engineering 实战验证测试
 * 
 * 验证场景：
 * 1. 简单问答
 * 2. 文件操作
 * 3. 命令执行
 * 4. 危险操作
 * 5. 多轮对话
 * 
 * @module integration/__tests__/validation.test
 */

import { YuanLingSystem } from '../../yuanling-system';
import { 
  createDeepIntegratedSystem,
  EnhancedProcessingResult 
} from '../yuanling-harness-deep';
import { SandboxLevel, RiskLevel } from '../../harness';

// ============ 测试工具 ============

function log(message: string): void {
  console.log(`[VALIDATION] ${message}`);
}

function logResult(result: EnhancedProcessingResult, scenario: string): void {
  console.log(`\n━━━━━━ ${scenario} ━━━━━━`);
  console.log(`追踪 ID: ${result.harness.traceId}`);
  console.log(`沙盒 ID: ${result.harness.sandboxId}`);
  if (result.harness.riskAssessment) {
    console.log(`风险级别: ${result.harness.riskAssessment.level}`);
    console.log(`沙盒级别: L${result.harness.riskAssessment.recommendedLevel}`);
  }
  console.log(`总耗时: ${result.harness.metrics.totalDuration}ms`);
  console.log(`评分: ${result.harness.score}`);
}

// ============ 验证场景 ============

async function runValidation(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       Harness Engineering 实战验证                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 创建系统
  const yuanling = new YuanLingSystem({
    workspaceRoot: '/tmp/harness-validation',
  });

  const integrated = await createDeepIntegratedSystem(yuanling, {
    workspaceRoot: '/tmp/harness-validation',
    enableStateManager: true,
    enableTracing: true,
    enablePPAF: true,
    enableSandbox: true,
    enableMetrics: true,
    enableAutoRiskAssessment: true,
  });

  // 模拟执行器
  const mockExecutor = async (prompt: string, context: any) => {
    return {
      content: `处理结果: ${prompt.substring(0, 50)}...`,
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  };

  // ========== 场景 1: 简单问答 ==========
  log('场景 1: 简单问答');
  const result1 = await integrated.process(
    '今天天气怎么样？',
    [],
    mockExecutor
  );
  logResult(result1, '简单问答');
  
  // 验证
  if (result1.harness.riskAssessment) {
    const isLowRisk = result1.harness.riskAssessment.level === RiskLevel.LOW;
    log(`✅ 风险评估: ${isLowRisk ? '正确' : '需检查'} (预期 LOW, 实际 ${result1.harness.riskAssessment.level})`);
  }

  // ========== 场景 2: 文件操作 ==========
  log('\n场景 2: 文件操作');
  const result2 = await integrated.process(
    '帮我读取 /tmp/test.txt 文件',
    [],
    mockExecutor
  );
  logResult(result2, '文件操作');
  
  if (result2.harness.riskAssessment) {
    const isMediumOrHigher = 
      result2.harness.riskAssessment.level === RiskLevel.MEDIUM ||
      result2.harness.riskAssessment.level === RiskLevel.HIGH;
    log(`✅ 风险评估: ${isMediumOrHigher ? '正确' : '需检查'} (预期 MEDIUM+, 实际 ${result2.harness.riskAssessment.level})`);
  }

  // ========== 场景 3: 命令执行 ==========
  log('\n场景 3: 命令执行');
  const result3 = await integrated.process(
    '执行 ls -la 命令',
    [],
    mockExecutor
  );
  logResult(result3, '命令执行');
  
  if (result3.harness.riskAssessment) {
    const isHighOrCritical = 
      result3.harness.riskAssessment.level === RiskLevel.HIGH ||
      result3.harness.riskAssessment.level === RiskLevel.CRITICAL;
    log(`✅ 风险评估: ${isHighOrCritical ? '正确' : '需检查'} (预期 HIGH+, 实际 ${result3.harness.riskAssessment.level})`);
  }

  // ========== 场景 4: 危险操作 ==========
  log('\n场景 4: 危险操作');
  const result4 = await integrated.process(
    '执行 rm -rf /',
    [],
    mockExecutor
  );
  logResult(result4, '危险操作');
  
  if (result4.harness.riskAssessment) {
    const isCritical = result4.harness.riskAssessment.level === RiskLevel.CRITICAL;
    log(`✅ 风险评估: ${isCritical ? '正确' : '需检查'} (预期 CRITICAL, 实际 ${result4.harness.riskAssessment.level})`);
    log(`✅ 推荐沙盒: L${result4.harness.riskAssessment.recommendedLevel}`);
  }

  // ========== 场景 5: 多轮对话 ==========
  log('\n场景 5: 多轮对话');
  const messages = [
    '你好',
    '今天天气怎么样？',
    '帮我查一下北京天气',
    '明天呢？',
    '谢谢',
  ];
  
  const sessionResults: EnhancedProcessingResult[] = [];
  for (const msg of messages) {
    const result = await integrated.process(msg, [], mockExecutor);
    sessionResults.push(result);
  }
  
  console.log(`\n━━━━━━ 多轮对话统计 ━━━━━━`);
  console.log(`对话轮数: ${messages.length}`);
  console.log(`平均耗时: ${sessionResults.reduce((s, r) => s + r.harness.metrics.totalDuration, 0) / messages.length}ms`);
  console.log(`最终评分: ${sessionResults[sessionResults.length - 1].harness.score}`);

  // ========== 综合统计 ==========
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    验证统计                              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const allResults = [result1, result2, result3, result4, ...sessionResults];
  
  console.log('| 场景 | 风险级别 | 沙盒级别 | 耗时 | 评分 |');
  console.log('|------|---------|---------|------|------|');
  
  const scenarios = ['简单问答', '文件操作', '命令执行', '危险操作', ...messages.map((_, i) => `对话${i+1}`)];
  allResults.forEach((r, i) => {
    const risk = r.harness.riskAssessment?.level || 'N/A';
    const sandbox = r.harness.sandboxId ? '已创建' : '无';
    const duration = r.harness.metrics.totalDuration;
    const score = r.harness.score;
    console.log(`| ${scenarios[i].padEnd(8)} | ${risk.toString().padEnd(7)} | ${sandbox.padEnd(7)} | ${duration}ms | ${score} |`);
  });

  // 最终评分
  const finalScore = integrated.getScore();
  console.log(`\n📊 最终综合评分: ${finalScore}`);

  // 优化建议
  const suggestions = integrated.getOptimizationSuggestions();
  console.log(`\n💡 优化建议: ${suggestions.length} 条`);
  if (suggestions.length > 0) {
    console.log('Top 3 建议:');
    suggestions.slice(0, 3).forEach((s: any, i: number) => {
      console.log(`  ${i + 1}. [${s.priority}] ${s.targetMetric}: ${s.description.substring(0, 50)}...`);
    });
  }

  // 关闭系统
  await integrated.close();
  
  console.log('\n✅ 实战验证完成！\n');
}

// ============ 运行验证 ============

async function main(): Promise<void> {
  try {
    await runValidation();
  } catch (error) {
    console.error('\n❌ 验证失败:', error);
    process.exit(1);
  }
}

export { runValidation };

if (require.main === module) {
  main();
}
