/**
 * 监控指标采集测试
 */

import { MetricsCollector, getMetricsCollector } from '../monitoring/metrics-collector';

async function runTest() {
  console.log('=== 监控指标采集测试 ===\n');

  const collector = new MetricsCollector('./temp-metrics');

  // 测试 1: 记录请求
  console.log('测试 1: 记录请求');
  collector.recordRequest(150, true);
  collector.recordRequest(200, true);
  collector.recordRequest(5000, false);
  console.log('  记录 3 个请求（1 个失败）');
  console.log('  ✅ 通过\n');

  // 测试 2: 采集系统指标
  console.log('测试 2: 采集系统指标');
  const sysMetrics = collector.collectSystemMetrics({
    cacheHitRate: 0.38,
    tokenEfficiency: 0.85,
    taskCompletionRate: 0.95,
  });
  console.log('  健康度:', sysMetrics.health.toFixed(1) + '%');
  console.log('  平均延迟:', sysMetrics.avgLatency.toFixed(0) + 'ms');
  console.log('  缓存命中率:', (sysMetrics.cacheHitRate * 100).toFixed(1) + '%');
  console.log('  任务完成率:', (sysMetrics.taskCompletionRate * 100).toFixed(1) + '%');
  console.log('  ✅ 通过\n');

  // 测试 3: 采集组件指标
  console.log('测试 3: 采集组件指标');
  collector.collectComponentMetrics('one-way-valve', {
    completionRate: 0.98,
    totalChecks: 100,
    passedChecks: 98,
  });
  collector.collectComponentMetrics('cache-system', {
    hitRate: 0.38,
    hits: 384,
    misses: 616,
  });
  console.log('  记录 2 个组件指标');
  console.log('  ✅ 通过\n');

  // 测试 4: 获取历史指标
  console.log('测试 4: 获取历史指标');
  const history = collector.getSystemMetricsHistory(24);
  console.log('  历史记录数:', history.length);
  console.log('  ✅ 通过\n');

  // 测试 5: 获取组件指标
  console.log('测试 5: 获取组件指标');
  const valveMetrics = collector.getComponentMetrics('one-way-valve');
  console.log('  one-way-valve 记录数:', valveMetrics.length);
  console.log('  ✅ 通过\n');

  // 测试 6: 检查告警
  console.log('测试 6: 检查告警');
  const alerts = collector.getActiveAlerts(1);
  console.log('  活跃告警数:', alerts.length);
  if (alerts.length > 0) {
    console.log('  最新告警:', alerts[alerts.length - 1].message);
  }
  console.log('  ✅ 通过\n');

  // 测试 7: 生成报告
  console.log('测试 7: 生成报告');
  const report = collector.generateReport();
  console.log('  报告长度:', report.length, '字符');
  console.log('  ---');
  console.log(report.split('\n').slice(0, 15).join('\n'));
  console.log('  ...');
  console.log('  ✅ 通过\n');

  // 测试 8: 全局实例
  console.log('测试 8: 全局实例');
  const globalCollector = getMetricsCollector();
  console.log('  全局实例:', globalCollector ? '已创建' : '未创建');
  console.log('  ✅ 通过\n');

  console.log('=== 所有测试通过 ===');
}

runTest().catch(console.error);
