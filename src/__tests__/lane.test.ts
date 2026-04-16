/**
 * Lane 优先级模型测试
 */

import {
  Lanes,
  LaneScheduler,
  PriorityTaskQueue,
  getHighestPriorityLane,
  mergeLanes,
  removeLane,
  includesLane,
  getLanePriority,
  compareLanes,
} from '../layers/ling-shu/lane';

describe('Lane 操作函数', () => {
  describe('getHighestPriorityLane', () => {
    it('应该获取最高优先级的 Lane', () => {
      const lanes = Lanes.Default | Lanes.UserInput | Lanes.Idle;
      const highest = getHighestPriorityLane(lanes);

      expect(highest).toBe(Lanes.UserInput);
    });

    it('空 Lanes 应返回 NoLanes', () => {
      const highest = getHighestPriorityLane(Lanes.NoLanes);
      expect(highest).toBe(Lanes.NoLanes);
    });
  });

  describe('mergeLanes', () => {
    it('应该合并多个 Lane', () => {
      const merged = mergeLanes(Lanes.Sync, Lanes.Default);
      expect(merged).toBe(Lanes.Sync | Lanes.Default);
    });
  });

  describe('removeLane', () => {
    it('应该移除指定的 Lane', () => {
      const lanes = Lanes.Sync | Lanes.Default;
      const removed = removeLane(lanes, Lanes.Sync);

      expect(removed).toBe(Lanes.Default);
    });
  });

  describe('includesLane', () => {
    it('应该检查是否包含 Lane', () => {
      const lanes = Lanes.Sync | Lanes.Default;

      expect(includesLane(lanes, Lanes.Sync)).toBe(true);
      expect(includesLane(lanes, Lanes.Idle)).toBe(false);
    });
  });

  describe('getLanePriority', () => {
    it('Sync 应该有最高优先级（最小数字）', () => {
      const syncPriority = getLanePriority(Lanes.Sync);
      const defaultPriority = getLanePriority(Lanes.Default);
      const idlePriority = getLanePriority(Lanes.Idle);

      expect(syncPriority).toBeLessThan(defaultPriority);
      expect(defaultPriority).toBeLessThan(idlePriority);
    });
  });

  describe('compareLanes', () => {
    it('应该正确比较优先级', () => {
      expect(compareLanes(Lanes.Sync, Lanes.Default)).toBeLessThan(0);
      expect(compareLanes(Lanes.Default, Lanes.Sync)).toBeGreaterThan(0);
      expect(compareLanes(Lanes.Sync, Lanes.Sync)).toBe(0);
    });
  });
});

describe('LaneScheduler', () => {
  let scheduler: LaneScheduler;

  beforeEach(() => {
    scheduler = new LaneScheduler();
  });

  describe('标记 Lane', () => {
    it('应该标记 Lane 为待处理', () => {
      scheduler.markLanePending(Lanes.Sync);

      expect(scheduler.hasPendingLanes()).toBe(true);
      expect(scheduler.getPendingLanes()).toBe(Lanes.Sync);
    });

    it('应该标记 Lane 为已暂停', () => {
      scheduler.markLanePending(Lanes.Sync);
      scheduler.markLaneSuspended(Lanes.Sync);

      expect(scheduler.hasPendingLanes()).toBe(false);
    });

    it('应该标记 Lane 为已唤醒', () => {
      scheduler.markLanePending(Lanes.Sync);
      scheduler.markLaneSuspended(Lanes.Sync);
      scheduler.markLanePinged(Lanes.Sync);

      expect(scheduler.getNextLane()).toBe(Lanes.Sync);
    });
  });

  describe('获取下一个 Lane', () => {
    it('应该返回最高优先级的 Lane', () => {
      scheduler.markLanePending(Lanes.Default);
      scheduler.markLanePending(Lanes.Sync);
      scheduler.markLanePending(Lanes.Idle);

      const next = scheduler.getNextLane();

      expect(next).toBe(Lanes.Sync);
    });

    it('没有待处理 Lane 时应返回 null', () => {
      const next = scheduler.getNextLane();
      expect(next).toBeNull();
    });
  });

  describe('清除 Lane', () => {
    it('应该清除指定的 Lane', () => {
      scheduler.markLanePending(Lanes.Sync);
      scheduler.clearLane(Lanes.Sync);

      expect(scheduler.hasPendingLanes()).toBe(false);
    });
  });

  describe('重置', () => {
    it('应该重置所有状态', () => {
      scheduler.markLanePending(Lanes.Sync);
      scheduler.markLanePending(Lanes.Default);
      scheduler.reset();

      expect(scheduler.hasPendingLanes()).toBe(false);
    });
  });
});

describe('PriorityTaskQueue', () => {
  let queue: PriorityTaskQueue;

  beforeEach(() => {
    queue = new PriorityTaskQueue();
  });

  describe('入队和出队', () => {
    it('应该按优先级出队', () => {
      queue.enqueue({
        id: 'task-1',
        lane: Lanes.Default,
        execute: async () => 'default',
        createdAt: Date.now(),
      });

      queue.enqueue({
        id: 'task-2',
        lane: Lanes.Sync,
        execute: async () => 'sync',
        createdAt: Date.now(),
      });

      const first = queue.dequeue();
      expect(first?.lane).toBe(Lanes.Sync);

      const second = queue.dequeue();
      expect(second?.lane).toBe(Lanes.Default);
    });

    it('应该正确报告队列状态', () => {
      expect(queue.hasTasks()).toBe(false);
      expect(queue.size()).toBe(0);

      queue.enqueue({
        id: 'task-1',
        lane: Lanes.Default,
        execute: async () => 'result',
        createdAt: Date.now(),
      });

      expect(queue.hasTasks()).toBe(true);
      expect(queue.size()).toBe(1);
    });
  });

  describe('清空', () => {
    it('应该清空队列', () => {
      queue.enqueue({
        id: 'task-1',
        lane: Lanes.Default,
        execute: async () => 'result',
        createdAt: Date.now(),
      });

      queue.clear();

      expect(queue.hasTasks()).toBe(false);
      expect(queue.size()).toBe(0);
    });
  });
});
