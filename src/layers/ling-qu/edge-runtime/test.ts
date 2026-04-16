/**
 * 边缘计算测试
 */

import { createEdgeRuntime, EdgeNodeType, SyncStatus } from './index';

async function testEdgeComputing() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       边缘计算支持测试                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 创建边缘运行时
  const runtime = createEdgeRuntime({
    nodeId: 'edge_test_001',
    name: 'Test Edge Node',
    type: EdgeNodeType.EDGE_SERVER,
    capabilities: {
      cpuCores: 4,
      memoryMB: 2048,
      storageMB: 10240,
      persistentStorage: true,
      networkBandwidth: 100,
      offlineSupport: true,
      batteryPowered: false,
    },
    limits: {
      maxMemoryMB: 1536,
      maxCpuPercent: 80,
      maxStorageMB: 8192,
      maxTasks: 100,
    },
    sync: {
      enabled: true,
      intervalMs: 5000,
      retryCount: 3,
    },
    offline: {
      enabled: true,
      maxQueueSize: 1000,
      ttlMs: 86400000,
    },
  });

  // 启动运行时
  await runtime.start();

  // 提交任务
  console.log('\n━━━━━━ 任务测试 ━━━━━━');
  
  const task1 = await runtime.submitTask('数据处理', 'compute', { data: 'test1' }, 5);
  console.log(`  ✓ 任务 1: ${task1.taskId}`);

  const task2 = await runtime.submitTask('状态同步', 'sync', { key: 'test' }, 3);
  console.log(`  ✓ 任务 2: ${task2.taskId}`);

  const task3 = await runtime.submitTask('传感器读取', 'sensor', { sensorId: 'temp_01' }, 8);
  console.log(`  ✓ 任务 3: ${task3.taskId}`);

  // 执行任务
  console.log('\n━━━━━━ 执行任务 ━━━━━━');
  
  const result1 = await runtime.executeTask(task1.taskId);
  console.log(`  ✓ 结果: ${JSON.stringify(result1)}`);

  const result2 = await runtime.executeTask(task2.taskId);
  console.log(`  ✓ 结果: ${JSON.stringify(result2)}`);

  // 状态管理
  console.log('\n━━━━━━ 状态管理 ━━━━━━');
  
  await runtime.setState('config', { timeout: 30000 });
  console.log('  ✓ 状态已设置');

  // 查看状态
  console.log('\n━━━━━━ 运行时状态 ━━━━━━');
  
  const status = runtime.getStatus();
  console.log(`  节点: ${status.node.name} (${status.node.type})`);
  console.log(`  同步状态: ${status.sync.status}`);
  console.log(`  待同步记录: ${status.sync.pendingRecords}`);
  console.log(`  内存使用: ${status.resources.memoryUsedMB.toFixed(2)}MB / ${status.resources.memoryTotalMB}MB`);
  console.log(`  任务统计:`);
  console.log(`    - 待处理: ${status.tasks.pending}`);
  console.log(`    - 执行中: ${status.tasks.running}`);
  console.log(`    - 已完成: ${status.tasks.completed}`);
  console.log(`    - 已失败: ${status.tasks.failed}`);
  console.log(`    - 离线队列: ${status.tasks.queuedOffline}`);
  console.log(`  运行时间: ${(status.uptime / 1000).toFixed(1)}秒`);

  // 同步队列
  console.log('\n━━━━━━ 同步队列 ━━━━━━');
  
  const syncQueue = runtime.getSyncQueue();
  console.log(`  队列长度: ${syncQueue.length}`);
  for (const record of syncQueue.slice(0, 3)) {
    console.log(`  - ${record.type}/${record.operation}: ${record.synced ? '已同步' : '待同步'}`);
  }

  // 测试不同节点类型
  console.log('\n━━━━━━ 节点类型测试 ━━━━━━');

  const embeddedRuntime = createEdgeRuntime({
    nodeId: 'embedded_001',
    name: 'Embedded Device',
    type: EdgeNodeType.EMBEDDED,
    capabilities: {
      cpuCores: 1,
      memoryMB: 256,
      storageMB: 512,
      persistentStorage: false,
      networkBandwidth: 10,
      offlineSupport: true,
      batteryPowered: true,
    },
    limits: {
      maxMemoryMB: 192,
      maxCpuPercent: 60,
      maxStorageMB: 384,
      maxTasks: 10,
    },
    sync: { enabled: false, intervalMs: 60000, retryCount: 3 },
    offline: { enabled: true, maxQueueSize: 100, ttlMs: 86400000 },
  });

  await embeddedRuntime.start();
  const embeddedStatus = embeddedRuntime.getStatus();
  console.log(`  嵌入式设备: ${embeddedStatus.node.name}`);
  console.log(`    内存: ${embeddedStatus.resources.memoryTotalMB}MB`);
  console.log(`    电池供电: 是`);

  await embeddedRuntime.stop();

  // 停止运行时
  await runtime.stop();

  console.log('\n✅ 边缘计算支持测试通过\n');
}

// 运行测试
testEdgeComputing().catch(console.error);
