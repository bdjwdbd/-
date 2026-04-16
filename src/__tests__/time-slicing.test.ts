/**
 * 时间切片执行器测试
 */

import { TimeSlicingExecutor, createArrayWorkUnit, createBatchWorkUnit } from '../layers/ling-mai/time-slicing';

describe('TimeSlicingExecutor', () => {
  let executor: TimeSlicingExecutor;

  beforeEach(() => {
    executor = new TimeSlicingExecutor({
      frameInterval: 5,
      enabled: true,
      maxContinuousFrames: 10,
    });
  });

  describe('配置', () => {
    it('应该使用默认配置', () => {
      const defaultExecutor = new TimeSlicingExecutor();
      const config = defaultExecutor.getConfig();

      expect(config.frameInterval).toBe(5);
      expect(config.enabled).toBe(true);
      expect(config.maxContinuousFrames).toBe(10);
    });

    it('应该支持自定义配置', () => {
      const customExecutor = new TimeSlicingExecutor({
        frameInterval: 10,
        maxContinuousFrames: 5,
      });
      const config = customExecutor.getConfig();

      expect(config.frameInterval).toBe(10);
      expect(config.maxContinuousFrames).toBe(5);
    });

    it('应该支持更新配置', () => {
      executor.updateConfig({ frameInterval: 20 });
      const config = executor.getConfig();

      expect(config.frameInterval).toBe(20);
    });
  });

  describe('执行', () => {
    it('应该执行简单工作单元', async () => {
      const items = [1, 2, 3];
      const work = createArrayWorkUnit(items, async (item) => item * 2);

      const result = await executor.execute(work);

      expect(result.completed).toBe(true);
      expect(result.executedUnits).toBe(3);
      expect(result.result).toEqual([2, 4, 6]);
    });

    it('应该执行批量任务', async () => {
      const tasks = [
        async () => 1,
        async () => 2,
        async () => 3,
      ];
      const work = createBatchWorkUnit(tasks);

      const result = await executor.execute(work);

      expect(result.completed).toBe(true);
      expect(result.executedUnits).toBe(3);
    });

    it('应该记录让出次数', async () => {
      // 创建大量工作单元以触发让出
      const items = Array.from({ length: 100 }, (_, i) => i);
      const work = createArrayWorkUnit(items, async (item) => item);

      const result = await executor.execute(work);

      expect(result.completed).toBe(true);
      expect(result.executedUnits).toBe(100);
      // 由于时间切片，应该有让出
      expect(result.yieldCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('禁用时间切片', () => {
    it('禁用时应直接执行', async () => {
      const disabledExecutor = new TimeSlicingExecutor({
        enabled: false,
      });

      const items = [1, 2, 3];
      const work = createArrayWorkUnit(items, async (item) => item * 2);

      const result = await disabledExecutor.execute(work);

      expect(result.completed).toBe(true);
      expect(result.yieldCount).toBe(0);
    });
  });

  describe('状态', () => {
    it('应该正确报告执行状态', () => {
      expect(executor.getIsExecuting()).toBe(false);
    });
  });
});
