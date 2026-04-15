/**
 * @file monitor.test.ts
 * @brief 监控系统单元测试
 */

import { Monitor, getMonitor } from '../src/infrastructure/monitor';

describe('Monitor', () => {
    let monitor: Monitor;

    beforeEach(() => {
        monitor = new Monitor();
    });

    describe('指标记录', () => {
        it('应该正确记录指标', () => {
            monitor.recordMetric('test_metric', 100);
            const latest = monitor.getLatestMetric('test_metric');
            
            expect(latest).toBeDefined();
            expect(latest?.value).toBe(100);
        });

        it('应该正确记录延迟', () => {
            monitor.recordLatency('search', 50);
            const latest = monitor.getLatestMetric('latency_search');
            
            expect(latest).toBeDefined();
            expect(latest?.value).toBe(50);
        });

        it('应该正确记录计数', () => {
            monitor.incrementCounter('requests');
            monitor.incrementCounter('requests');
            monitor.incrementCounter('requests');
            
            const latest = monitor.getLatestMetric('requests');
            expect(latest?.value).toBe(3);
        });
    });

    describe('统计查询', () => {
        beforeEach(() => {
            // 记录多个值
            for (let i = 1; i <= 100; i++) {
                monitor.recordMetric('test_values', i);
            }
        });

        it('应该正确计算百分位', () => {
            const p50 = monitor.getPercentile('test_values', 50);
            const p99 = monitor.getPercentile('test_values', 99);
            
            expect(p50).toBeCloseTo(50, 0);
            expect(p99).toBeCloseTo(99, 0);
        });

        it('应该正确计算平均值', () => {
            const avg = monitor.getAverage('test_values');
            expect(avg).toBeCloseTo(50.5, 1);
        });

        it('应该正确获取历史记录', () => {
            const history = monitor.getMetricHistory('test_values');
            expect(history.length).toBe(100);
        });
    });

    describe('告警系统', () => {
        it('应该正确设置阈值', () => {
            monitor.setThreshold('test_threshold', 50, 100);
            
            // 触发警告
            monitor.recordMetric('test_threshold', 60);
            const alerts = monitor.getActiveAlerts();
            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts[0].level).toBe('warning');
        });

        it('应该正确触发严重告警', () => {
            monitor.setThreshold('critical_test', 50, 100);
            
            monitor.recordMetric('critical_test', 150);
            const alerts = monitor.getActiveAlerts();
            
            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts[0].level).toBe('critical');
        });

        it('应该正确解决告警', () => {
            monitor.setThreshold('resolve_test', 50, 100);
            monitor.recordMetric('resolve_test', 150);
            
            const alerts = monitor.getActiveAlerts();
            monitor.resolveAlert(alerts[0].id);
            
            const activeAlerts = monitor.getActiveAlerts();
            expect(activeAlerts.length).toBe(0);
        });
    });

    describe('健康检查', () => {
        it('应该正确执行健康检查', async () => {
            const checks = {
                memory: async () => {
                    const usage = process.memoryUsage();
                    return usage.heapUsed < usage.heapTotal * 0.9;
                },
                cpu: async () => true,
            };

            const health = await monitor.healthCheck(checks);
            
            expect(health.status).toBe('healthy');
            expect(health.checks.memory.status).toBe(true);
            expect(health.checks.cpu.status).toBe(true);
        });

        it('应该正确检测降级状态', async () => {
            const checks = {
                check1: async () => true,
                check2: async () => false,
            };

            const health = await monitor.healthCheck(checks);
            expect(health.status).toBe('degraded');
        });

        it('应该正确检测不健康状态', async () => {
            const checks = {
                check1: async () => false,
                check2: async () => false,
            };

            const health = await monitor.healthCheck(checks);
            expect(health.status).toBe('unhealthy');
        });
    });
});

describe('getMonitor', () => {
    it('应该返回单例实例', () => {
        const m1 = getMonitor();
        const m2 = getMonitor();
        expect(m1).toBe(m2);
    });
});
