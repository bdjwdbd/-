/**
 * 全智能系统测试
 */

import { createIntelligenceSystem } from '../index';

async function testIntelligenceSystem() {
  console.log('🧪 全智能系统测试\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const intelligence = createIntelligenceSystem();

  // 测试用例
  const testCases = [
    '帮我搜索一下最新的 AI 新闻',
    '创建一篇关于元灵系统的文章',
    '分析这个 Excel 文件的数据',
    '监控一下系统状态',
    '发送消息给张三',
    '创建一个明天下午3点的会议',
    '提醒我每天早上8点起床',
    '执行 npm install 命令',
    '部署应用到 Vercel',
    '优化一下系统性能',
    '检查系统健康状态',
  ];

  for (const message of testCases) {
    console.log(`📝 测试: "${message}"`);
    console.log('─'.repeat(50));

    const result = await intelligence.analyze(message);

    console.log(`  意图: ${result.intent.primary.type}`);
    console.log(`  置信度: ${(result.intent.primary.confidence * 100).toFixed(0)}%`);
    console.log(`  目标: ${result.intent.primary.target || '(未识别)'}`);
    console.log(`  建议工具: ${result.tools.slice(0, 3).map((t: any) => t.tool.name).join(', ') || '(无)'}`);
    console.log(`  建议 Skills: ${result.skills.slice(0, 3).map((s: any) => s.skill.name).join(', ') || '(无)'}`);
    console.log(`  建议模块: ${result.modules.join(', ') || '(无)'}`);
    console.log(`  执行步骤: ${result.plan.steps.length} 步`);
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 全智能系统测试完成');
}

testIntelligenceSystem().catch(console.error);
