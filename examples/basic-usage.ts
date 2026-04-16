/**
 * 元灵系统基本使用示例
 * 
 * 本示例展示：
 * - 系统初始化
 * - 基本消息处理
 * - 记忆管理
 * - 健康检查
 */

import { getYuanLingSystem } from '../src';

async function main() {
  console.log('========================================');
  console.log('元灵系统基本使用示例');
  console.log('========================================\n');

  // 1. 创建系统实例
  console.log('📦 步骤 1: 创建系统实例');
  const system = getYuanLingSystem({
    workspaceRoot: './workspace',
    enableL0: true,
    enableIntrospection: false,
    logLevel: 'info',
  });

  // 2. 启动系统
  console.log('\n🚀 步骤 2: 启动系统');
  const startupResult = await system.startup();
  console.log(`   启动耗时: ${startupResult.environment ? '成功' : '失败'}`);

  // 3. 全智能处理
  console.log('\n🧠 步骤 3: 全智能处理');
  const intelligentResult = await system.processIntelligently('帮我搜索一下最新的 AI 新闻');
  console.log(`   意图类型: ${intelligentResult.analysis.intent.primary.type}`);
  console.log(`   置信度: ${(intelligentResult.analysis.intent.primary.confidence * 100).toFixed(0)}%`);
  console.log(`   建议工具: ${intelligentResult.analysis.tools.slice(0, 3).map(t => t.tool.name).join(', ')}`);
  console.log(`   执行状态: ${intelligentResult.execution?.success ? '成功' : '失败'}`);

  // 4. 添加记忆
  console.log('\n📝 步骤 4: 添加记忆');
  const memId1 = await system.addMemory('元灵系统是一个多 Agent 协作框架', 'fact');
  console.log(`   添加记忆 1: ${memId1}`);
  
  const memId2 = await system.addMemory('系统版本是 v4.9.6', 'fact');
  console.log(`   添加记忆 2: ${memId2}`);

  // 5. 搜索记忆
  console.log('\n🔍 步骤 5: 搜索记忆');
  const searchResults = await system.searchMemory('元灵系统');
  console.log(`   搜索结果: ${searchResults.length} 条`);
  searchResults.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.memory.content.substring(0, 50)}...`);
  });

  // 6. 健康检查
  console.log('\n💊 步骤 6: 健康检查');
  const health = await system.checkHealth();
  console.log(`   系统状态: ${health.status}`);
  console.log(`   检查项: ${health.checks.length} 个`);
  
  // 7. 关闭系统
  console.log('\n🛑 步骤 7: 关闭系统');
  await system.shutdown();
  console.log('   系统已关闭');

  console.log('\n========================================');
  console.log('示例完成');
  console.log('========================================');
}

main().catch(console.error);
