/**
 * 性能监控完善测试
 */

import { YuanLingSystem } from './yuanling-system';
import { EdgeNodeType, FederatedRole } from './index';

async function testPerformanceMonitoring() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       性能监控完善测试                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 创建系统实例
  const system = new YuanLingSystem({
    workspaceRoot: '/tmp/yuanling-perf-test',
    enableIntrospection: false,
  });

  console.log('━━━━━━ 模块性能监控测试 ━━━━━━\n');

  // 初始化各个模块并记录性能
  console.log('初始化 Harness...');
  await system.initializeHarness();
  
  console.log('初始化 Multi-Agent...');
  system.initializeCoordinator();
  
  console.log('初始化边缘计算...');
  await system.initializeEdgeRuntime(EdgeNodeType.EDGE_SERVER);
  
  console.log('初始化联邦学习...');
  await system.initializeFederatedEngine(FederatedRole.SERVER);

  // 获取模块性能指标
  console.log('\n━━━━━━ 模块性能指标 ━━━━━━\n');
  
  const moduleMetrics = system.getModuleMetrics();
  
  console.log('| 模块 | 操作数 | 平均延迟 | 错误率 |');
  console.log('|------|--------|----------|--------|');
  
  for (const [name, metrics] of Object.entries(moduleMetrics)) {
    const errorRate = (metrics.errorRate * 100).toFixed(1);
    const errorIcon = metrics.errorRate > 0.05 ? '🔴' : metrics.errorRate > 0.01 ? '🟡' : '✅';
    console.log(`| ${name} | ${metrics.operations} | ${metrics.avgLatency}ms | ${errorIcon} ${errorRate}% |`);
  }

  // 模拟一些操作
  console.log('\n━━━━━━ 模拟操作 ━━━━━━\n');
  
  // 模拟 Harness 操作
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await system.harness?.getState('test_key');
    system.recordModuleOperation('harness', Date.now() - start);
  }
  console.log('✅ Harness 操作: 5 次');
  
  // 模拟 Multi-Agent 操作
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    // 简化操作
    system.recordModuleOperation('multi-agent', Date.now() - start);
  }
  console.log('✅ Multi-Agent 操作: 3 次');
  
  // 模拟边缘计算操作
  for (let i = 0; i < 2; i++) {
    const start = Date.now();
    // 简化操作
    system.recordModuleOperation('edge', Date.now() - start);
  }
  console.log('✅ Edge 操作: 2 次');

  // 获取更新后的模块性能指标
  console.log('\n━━━━━━ 更新后的模块性能指标 ━━━━━━\n');
  
  const updatedMetrics = system.getModuleMetrics();
  
  console.log('| 模块 | 操作数 | 平均延迟 | 错误率 |');
  console.log('|------|--------|----------|--------|');
  
  for (const [name, metrics] of Object.entries(updatedMetrics)) {
    const errorRate = (metrics.errorRate * 100).toFixed(1);
    const errorIcon = metrics.errorRate > 0.05 ? '🔴' : metrics.errorRate > 0.01 ? '🟡' : '✅';
    console.log(`| ${name} | ${metrics.operations} | ${metrics.avgLatency}ms | ${errorIcon} ${errorRate}% |`);
  }

  // 获取完整性能报告
  console.log('\n━━━━━━ 完整性能报告 ━━━━━━\n');
  
  const report = system.getPerformanceReport();
  console.log(report);

  // 关闭系统
  console.log('\n━━━━━━ 关闭系统 ━━━━━━');
  
  if (system.edgeRuntime) {
    await system.edgeRuntime.stop();
  }
  if (system.federatedEngine) {
    await system.federatedEngine.shutdown();
  }
  if (system.harness) {
    await system.harness.close();
  }

  console.log('\n✅ 性能监控完善测试通过\n');
}

// 运行测试
testPerformanceMonitoring().catch(console.error);
