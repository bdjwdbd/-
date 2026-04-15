#!/usr/bin/env node
/**
 * 元灵系统 CLI
 * 
 * 命令行入口，用于启动和测试系统
 */

import { startup, quickIntrospect, IntrospectionSystem, ThinkingProtocolEngine } from './index';

const workspaceRoot = process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'start':
      // console.log('🧠 元灵系统启动...\n');
      const result = await startup({
        workspaceRoot,
        enableIntrospection: true,
      });
      
      if (result.introspectionReport) {
        // console.log('\n📊 自省报告:');
        // console.log(`   综合评分: ${result.introspectionReport.currentSnapshot.overallScore.toFixed(1)}`);
        // console.log(`   提升维度: ${result.introspectionReport.improvements.length}`);
        // console.log(`   待优化项: ${result.introspectionReport.shortfalls.length}`);
      }
      break;

    case 'introspect':
      // console.log('🔍 运行自省评估...\n');
      const system = new IntrospectionSystem(workspaceRoot);
      const report = await system.introspect('manual');
      
      // console.log(system.formatSummary(report));
      
      // console.log('\n📁 报告已保存到:');
      // console.log(`   ${workspaceRoot}/memory/introspection/reports/`);
      // console.log(`   ${workspaceRoot}/memory/introspection/visualization/`);
      break;

    case 'quick':
      // console.log('⚡ 快速检查...\n');
      const quick = await quickIntrospect(workspaceRoot);
      
      if (quick.hasChanges) {
        // console.log('检测到变更:');
        quick.changes.forEach(c => // console.log(`  - ${c}`));
        if (quick.overallScore) {
          // console.log(`\n综合评分: ${quick.overallScore.toFixed(1)}`);
        }
      } else {
        // console.log('✅ 无变更');
      }
      break;

    case 'radar':
      // console.log('📊 能力雷达图\n');
      const radarSystem = new IntrospectionSystem(workspaceRoot);
      const radarReport = await radarSystem.introspect('manual');
      // console.log(radarSystem.formatASCIIRadar(radarReport.currentSnapshot.scores));
      break;

    case 'think':
      // console.log('💭 L0 灵思层测试\n');
      const question = args[1] || '这是一个测试问题';
      // console.log(`问题: ${question}\n`);
      
      const engine = new ThinkingProtocolEngine();
      
      const thinking = await engine.execute({
        id: `msg_${Date.now()}`,
        content: question,
        type: 'text',
        timestamp: Date.now(),
        sessionId: 'cli',
      });
      
      // console.log('思考深度:', thinking.depth);
      // console.log('思考步骤:', thinking.stepResults?.length || 0);
      // console.log('假设数量:', thinking.hypotheses?.length || 0);
      // console.log('置信度:', thinking.confidence?.toFixed(2) || 'N/A');
      // console.log('\n✅ L0 灵思层运行成功');
      break;

    case 'help':
    default:
      // console.log(`
元灵系统 CLI v4.0.0

用法:
  yuanling <command> [options]

命令:
  start       启动元灵系统（包含自省评估）
  introspect  运行完整的自省评估
  quick       快速检查变更
  radar       显示能力雷达图
  think       测试 L0 灵思层思考引擎
  help        显示帮助信息

环境变量:
  WORKSPACE_ROOT  工作目录（默认: /home/sandbox/.openclaw/workspace）

示例:
  yuanling start
  yuanling introspect
  yuanling quick
  yuanling think "如何优化系统性能？"
`);
      break;
  }
}

main().catch(console.error);
