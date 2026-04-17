/**
 * PerformanceMonitor 集成测试
 */

import { YuanLingSystem } from '../yuanling-system';

describe('YuanLingSystem PerformanceMonitor 集成', () => {
  let system: YuanLingSystem;

  beforeEach(() => {
    system = new YuanLingSystem();
  });

  describe('getStatus', () => {
    it('应该返回性能指标', async () => {
      // 模拟几次请求
      for (let i = 0; i < 3; i++) {
        try {
          await system.processWithExternalExecutor(
            `测试消息 ${i}`,
            [],
            async (prompt, context) => {
              await new Promise(r => setTimeout(r, 10));
              return { content: `回复 ${i}` };
            }
          );
        } catch (e) {
          // 忽略错误
        }
      }

      const status = system.getStatus();
      expect(status.performance).toBeDefined();
      expect(status.performance.totalRequests).toBe(3);
      expect(status.performance.avgLatency).toBeGreaterThan(0);
    });

    it('应该返回健康状态', async () => {
      const status = system.getStatus();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status.health);
    });
  });

  describe('getPerformanceReport', () => {
    it('应该生成性能报告', async () => {
      // 模拟请求
      await system.processWithExternalExecutor(
        '测试',
        [],
        async (prompt, context) => ({ content: '回复' })
      );

      const report = system.getPerformanceReport();
      expect(report).toContain('性能报告');
      expect(report).toContain('系统级指标');
      expect(report).toContain('层级延迟');
    });
  });

  describe('层级延迟记录', () => {
    it('应该记录各层级延迟', async () => {
      await system.processWithExternalExecutor(
        '测试',
        [],
        async (prompt, context) => ({ content: '回复' })
      );

      const monitor = system.getPerformanceMonitor();
      const report = monitor.getFullReport();
      
      // 更新期望值以匹配实际实现
      expect(report).toContain('L0-记忆-并行');
      expect(report).toContain('L1-决策');
      expect(report).toContain('L2-L3-灵脉灵躯层');
      expect(report).toContain('L4-灵盾层');
    });
  });
});
