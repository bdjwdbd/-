/**
 * 线程池测试
 */

import { ThreadPool, createVectorThreadPool } from '../infrastructure/thread-pool';
import * as os from 'os';

describe('ThreadPool', () => {
  let pool: ThreadPool;

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
  });

  describe('constructor', () => {
    it('应该能创建线程池', () => {
      pool = new ThreadPool({ minThreads: 1, maxThreads: 2 });
      expect(pool).toBeDefined();
    });

    it('应该创建最小数量的线程', () => {
      pool = new ThreadPool({ minThreads: 2, maxThreads: 4 });
      const stats = pool.getStats();
      expect(stats.totalThreads).toBe(2);
    });
  });

  describe('getStats', () => {
    it('应该能获取统计信息', () => {
      pool = new ThreadPool({ minThreads: 1, maxThreads: 2 });
      const stats = pool.getStats();

      expect(stats).toHaveProperty('totalThreads');
      expect(stats).toHaveProperty('activeThreads');
      expect(stats).toHaveProperty('idleThreads');
      expect(stats).toHaveProperty('pendingTasks');
      expect(stats).toHaveProperty('completedTasks');
    });
  });

  describe('shutdown', () => {
    it('应该能关闭线程池', async () => {
      pool = new ThreadPool({ minThreads: 1, maxThreads: 2 });
      await pool.shutdown();

      const stats = pool.getStats();
      expect(stats.totalThreads).toBe(0);
    });
  });
});

describe('createVectorThreadPool', () => {
  it('应该能创建向量计算线程池', async () => {
    const pool = createVectorThreadPool({ minThreads: 1 });
    expect(pool).toBeDefined();
    await pool.shutdown();
  });
});
