/**
 * 元灵系统 Harness Engineering 示例
 * 
 * 本示例展示：
 * - Harness 系统使用
 * - 风险评估
 * - 沙盒隔离
 * - 追踪系统
 */

import { getYuanLingSystem } from '../src';

async function main() {
  console.log('========================================');
  console.log('元灵系统 Harness Engineering 示例');
  console.log('========================================\n');

  // 1. 创建并启动系统
  console.log('🚀 创建并启动系统');
  const system = getYuanLingSystem({
    workspaceRoot: './workspace',
    enableL0: true,
    logLevel: 'info',
  });
  await system.startup();

  // 2. 初始化 Harness 系统
  console.log('\n🔧 初始化 Harness 系统');
  const harness = await system.initializeHarness();
  console.log(`   Harness 状态: ${harness ? '已初始化' : '初始化失败'}`);

  // 3. 风险评估
  console.log('\n⚠️ 风险评估示例');
  
  // 低风险操作
  const lowRisk = await harness?.assessRisk({
    input: '你好',
    tools: [],
    context: {},
  });
  console.log(`   低风险操作: ${lowRisk?.level} (分数: ${lowRisk?.score?.toFixed(2)})`);
  
  // 中风险操作
  const medRisk = await harness?.assessRisk({
    input: '读取文件 /etc/passwd',
    tools: [{ name: 'read', description: '读取文件' }],
    context: {},
  });
  console.log(`   中风险操作: ${medRisk?.level} (分数: ${medRisk?.score?.toFixed(2)})`);
  
  // 高风险操作
  const highRisk = await harness?.assessRisk({
    input: '执行命令 rm -rf /',
    tools: [{ name: 'exec', description: '执行命令' }],
    context: {},
  });
  console.log(`   高风险操作: ${highRisk?.level} (分数: ${highRisk?.score?.toFixed(2)})`);

  // 4. 沙盒隔离
  console.log('\n🔒 沙盒隔离示例');
  const sandbox = await harness?.createSandbox(highRisk?.level || 'MEDIUM');
  console.log(`   沙盒级别: ${sandbox?.level}`);
  console.log(`   沙盒 ID: ${sandbox?.id}`);

  // 5. 追踪系统
  console.log('\n📍 追踪系统示例');
  const trace = harness?.startTrace('demo-operation');
  console.log(`   追踪 ID: ${trace?.id}`);
  
  // 添加追踪跨度
  harness?.addSpan(trace?.id!, {
    name: 'step-1',
    duration: 100,
    metadata: { action: 'initialize' },
  });
  
  harness?.addSpan(trace?.id!, {
    name: 'step-2',
    duration: 200,
    metadata: { action: 'process' },
  });
  
  // 结束追踪
  const traceResult = harness?.endTrace(trace?.id!);
  console.log(`   追踪耗时: ${traceResult?.duration}ms`);
  console.log(`   跨度数量: ${traceResult?.spans?.length}`);

  // 6. 状态管理
  console.log('\n💾 状态管理示例');
  const stateId = harness?.setState('demo-state', {
    counter: 0,
    lastUpdate: new Date().toISOString(),
  });
  console.log(`   状态 ID: ${stateId}`);
  
  const state = harness?.getState('demo-state');
  console.log(`   状态内容: ${JSON.stringify(state)}`);

  // 7. 关闭系统
  await system.shutdown();

  console.log('\n========================================');
  console.log('示例完成');
  console.log('========================================');
}

main().catch(console.error);
