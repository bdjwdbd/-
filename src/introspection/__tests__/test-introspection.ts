/**
 * 元灵自省系统 - 测试脚本
 */

import { IntrospectionSystem } from '../introspection-system';

async function main() {
  // console.log('=== 元灵自省系统测试 ===\n');

  // 初始化 - 使用正确的 workspace 路径
  const workspaceRoot = '/home/sandbox/.openclaw/workspace';

  const system = new IntrospectionSystem(workspaceRoot);

  // 1. 快速检查
  // console.log('1. 快速检查...');
  const quickCheck = system.quickCheck();
  // console.log(`   有变更: ${quickCheck.hasChanges}`);
  if (quickCheck.changes.length > 0) {
    // console.log('   变更列表:');
    for (const change of quickCheck.changes) {
      // console.log(`   - ${change}`);
    }
  }
  // console.log('');

  // 2. 运行完整自省
  // console.log('2. 运行完整自省...');
  const report = await system.introspect('manual');
  // console.log('');

  // 3. 输出摘要
  // console.log('3. 报告摘要:');
  // console.log(system.formatSummary(report));
  // console.log('');

  // 4. 详细评分
  // console.log('4. 详细评分:');
  for (const score of report.currentSnapshot.scores) {
    const change = score.change ? ` (${score.change > 0 ? '+' : ''}${score.change.toFixed(1)})` : '';
    // console.log(`   ${score.dimension}: ${score.score.toFixed(1)}${change}`);
    // console.log(`      ${score.details}`);
  }
  // console.log('');

  // 5. 短板分析
  if (report.shortfalls.length > 0) {
    // console.log('5. 短板分析:');
    for (const shortfall of report.shortfalls) {
      // console.log(`   [${shortfall.priority}] ${shortfall.dimension}`);
      // console.log(`      当前: ${shortfall.currentScore.toFixed(1)}, 目标: ${shortfall.targetScore}, 差距: ${shortfall.gap.toFixed(1)}`);
      // console.log(`      建议: ${shortfall.suggestion}`);
    }
  } else {
    // console.log('5. 短板分析: 无明显短板');
  }
  // console.log('');

  // 6. 优化建议
  if (report.recommendations.length > 0) {
    // console.log('6. 优化建议:');
    for (let i = 0; i < Math.min(5, report.recommendations.length); i++) {
      const rec = report.recommendations[i];
      // console.log(`   ${i + 1}. ${rec.title} (${rec.effort} 工作量)`);
      // console.log(`      ${rec.description}`);
      // console.log(`      预期提升: +${rec.impact.toFixed(2)}`);
    }
  }
  // console.log('');

  // console.log('=== 测试完成 ===');
}

main().catch(console.error);
