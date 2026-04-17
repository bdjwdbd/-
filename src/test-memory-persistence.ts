/**
 * 测试记忆持久化
 */

import MemoryPersistence from './memory/persistence';

async function testMemoryPersistence() {
  console.log('='.repeat(60));
  console.log('  测试记忆持久化');
  console.log('='.repeat(60));
  console.log('');

  // 创建持久化存储
  const persistence = new MemoryPersistence('./data/memory-test');
  
  // 初始化
  console.log('1. 初始化存储');
  await persistence.init();
  console.log('');

  // 添加记忆
  console.log('2. 添加记忆');
  const mem1 = await persistence.add(0, '这是第一条记忆：元灵系统 v6.0 启动成功', { type: 'system' });
  console.log(`   ✅ 添加到 L0: ${mem1.id}`);
  
  const mem2 = await persistence.add(0, '这是第二条记忆：实现了真实工具执行', { type: 'tool' });
  console.log(`   ✅ 添加到 L0: ${mem2.id}`);
  
  const mem3 = await persistence.add(1, '这是第三条记忆：实现了记忆持久化', { type: 'memory' });
  console.log(`   ✅ 添加到 L1: ${mem3.id}`);
  console.log('');

  // 搜索记忆
  console.log('3. 搜索记忆');
  const results = await persistence.search({ text: '记忆', limit: 10 });
  console.log(`   找到 ${results.length} 条记忆:`);
  for (const r of results) {
    console.log(`   - L${r.layer}: ${r.content.substring(0, 30)}...`);
  }
  console.log('');

  // 获取统计
  console.log('4. 获取统计');
  const stats = await persistence.getStats();
  for (const [layer, stat] of Object.entries(stats)) {
    console.log(`   ${layer}: ${(stat as any).count} 条`);
  }
  console.log('');

  // 记忆晋升
  console.log('5. 记忆晋升');
  const promoted = await persistence.promote(mem1.id);
  if (promoted) {
    console.log(`   ✅ ${mem1.id} 从 L0 晋升到 L${promoted.layer}`);
  }
  console.log('');

  // 再次获取统计
  console.log('6. 晋升后统计');
  const stats2 = await persistence.getStats();
  for (const [layer, stat] of Object.entries(stats2)) {
    console.log(`   ${layer}: ${(stat as any).count} 条`);
  }
  console.log('');

  // 关闭存储
  await persistence.close();

  console.log('='.repeat(60));
  console.log('  测试完成');
  console.log('='.repeat(60));
}

testMemoryPersistence().catch(console.error);
