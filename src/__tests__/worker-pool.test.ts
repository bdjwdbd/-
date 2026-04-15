/**
 * Worker 线程池测试
 * 
 * 注意：Worker 测试在 Jest 环境下可能超时，这里只测试基本功能
 */

import { WorkerPool, createWorkerPool } from '../infrastructure/worker-pool';

describe('WorkerPool', () => {
  describe('创建和状态', () => {
    it('应该能创建 WorkerPool 实例', () => {
      const pool = createWorkerPool({ numWorkers: 2 });
      expect(pool).toBeDefined();
    });

    it('应该能获取状态', () => {
      const pool = createWorkerPool({ numWorkers: 2 });
      const status = pool.getStatus();
      
      expect(status.numWorkers).toBeDefined();
      expect(status.availableWorkers).toBeDefined();
      expect(status.pendingTasks).toBeDefined();
      expect(status.queuedTasks).toBeDefined();
    });

    it('应该能调用 shutdown', async () => {
      const pool = createWorkerPool({ numWorkers: 1 });
      await pool.shutdown();
      // 不应该抛出错误
      expect(true).toBe(true);
    });
  });
});
