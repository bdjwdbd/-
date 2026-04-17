/**
 * 性能基准测试
 */

import { BPlusTreeIndex } from '../layers/ling-qu/bplustree-index';
import { TimeSlicingExecutor, createArrayWorkUnit } from '../layers/ling-mai/time-slicing';
import { LaneScheduler, Lanes } from '../layers/ling-shu/lane';

async function runBenchmark() {
  console.log('=== 性能基准测试 ===\n');

  // 1. B+ 树索引性能
  console.log('1. B+ 树索引性能');
  const bptree = new BPlusTreeIndex({ order: 64 });
  const itemCount = 10000;

  console.time('插入 10000 项');
  for (let i = 0; i < itemCount; i++) {
    bptree.insert({
      id: `item-${i}`,
      key: `key-${i.toString().padStart(5, '0')}`,
      content: { value: i },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  console.timeEnd('插入 10000 项');

  console.time('精确查找 1000 次');
  for (let i = 0; i < 1000; i++) {
    bptree.find(`key-${(i * 10).toString().padStart(5, '0')}`);
  }
  console.timeEnd('精确查找 1000 次');

  console.time('范围查询 100 次');
  for (let i = 0; i < 100; i++) {
    bptree.range(`key-${(i * 100).toString().padStart(5, '0')}`, `key-${(i * 100 + 50).toString().padStart(5, '0')}`);
  }
  console.timeEnd('范围查询 100 次');

  console.log(`树高度: ${bptree.getHeight()}`);
  console.log(`总项数: ${bptree.getSize()}\n`);

  // 2. 时间切片性能
  console.log('2. 时间切片性能');
  const executor = new TimeSlicingExecutor({ frameInterval: 5, enabled: true });
  const items = Array.from({ length: 1000 }, (_, i) => i);

  console.time('处理 1000 项（启用时间切片）');
  const result1 = await executor.execute(createArrayWorkUnit(items, async (item) => item * 2));
  console.timeEnd('处理 1000 项（启用时间切片）');
  console.log(`让出次数: ${result1.yieldCount}`);

  const disabledExecutor = new TimeSlicingExecutor({ enabled: false });
  console.time('处理 1000 项（禁用时间切片）');
  const result2 = await disabledExecutor.execute(createArrayWorkUnit(items, async (item) => item * 2));
  console.timeEnd('处理 1000 项（禁用时间切片）');
  console.log(`让出次数: ${result2.yieldCount}\n`);

  // 3. Lane 调度器性能
  console.log('3. Lane 调度器性能');
  const scheduler = new LaneScheduler();

  console.time('标记 10000 个 Lane');
  for (let i = 0; i < 10000; i++) {
    scheduler.markLanePending(Lanes.Transition1 << (i % 16));
  }
  console.timeEnd('标记 10000 个 Lane');

  console.time('获取下一个 Lane 1000 次');
  for (let i = 0; i < 1000; i++) {
    scheduler.getNextLane();
  }
  console.timeEnd('获取下一个 Lane 1000 次');

  console.log('\n=== 测试完成 ===');
}

runBenchmark().catch(console.error);
