import { YuanLingSystem, getYuanLingSystem } from './src/yuanling-system';

async function performanceTest() {
  const system = getYuanLingSystem({
    workspaceRoot: '/tmp/yuanling-perf-test',
    enableL0: true,
    enableIntrospection: false,
    logLevel: 'error',
    enableRequestDeduplication: false, // 禁用去重以测试真实性能
  });

  await system.startup();

  const mockExecutor = async (prompt: string, context: any) => {
    return { content: `处理完成` };
  };

  // 预热
  await system.processWithExternalExecutor('预热请求', [], mockExecutor);

  // 测试
  const iterations = 10;
  const latencies: number[] = [];

  console.log('开始性能测试...\n');

  for (let i = 0; i < iterations; i++) {
    const result = await system.processWithExternalExecutor(
      `测试消息 ${i}`,
      [],
      mockExecutor
    );
    
    latencies.push(result.context.performance?.totalLatency || 0);
  }

  // 获取性能报告
  const report = system.getPerformanceReport();
  const status = system.getStatus();

  console.log('========================================');
  console.log('元灵系统性能报告');
  console.log('========================================\n');

  console.log('📊 总体性能:');
  console.log(`  总请求数: ${status.performance.totalRequests}`);
  console.log(`  平均延迟: ${status.performance.avgLatency.toFixed(2)}ms`);
  console.log(`  最小延迟: ${Math.min(...latencies).toFixed(2)}ms`);
  console.log(`  最大延迟: ${Math.max(...latencies).toFixed(2)}ms`);
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(`  P50: ${sorted[Math.floor(iterations * 0.5)].toFixed(2)}ms`);
  console.log(`  P95: ${sorted[Math.floor(iterations * 0.95)].toFixed(2)}ms`);

  console.log('\n📈 模块指标:');
  const moduleMetrics = system.getModuleMetrics();
  for (const [name, data] of Object.entries(moduleMetrics)) {
    const d = data as { operations: number; avgLatency: number };
    console.log(`  ${name}: ${d.operations} ops, ${d.avgLatency.toFixed(2)}ms avg`);
  }

  console.log('\n📋 详细报告:');
  console.log(report);

  await system.shutdown();
}

performanceTest().catch(console.error);
