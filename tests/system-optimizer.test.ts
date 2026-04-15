/**
 * @file system-optimizer.test.ts
 * @brief 系统优化器单元测试
 */

import { SystemOptimizer, getSystemOptimizer } from '../src/infrastructure/system-optimizer';

describe('SystemOptimizer', () => {
    let optimizer: SystemOptimizer;

    beforeEach(() => {
        optimizer = new SystemOptimizer();
    });

    describe('NUMA 优化器', () => {
        it('应该正确检测 NUMA 可用性', () => {
            const report = optimizer.getReport();
            expect(report.numa).toBeDefined();
            expect(typeof report.numa.available).toBe('boolean');
        });

        it('应该返回 NUMA 节点信息', () => {
            const report = optimizer.getReport();
            if (report.numa.available) {
                expect(report.numa.nodeCount).toBeGreaterThan(0);
            }
        });

        it('应该返回内存分配建议', () => {
            const report = optimizer.getReport();
            expect(report.numa.allocationPolicy).toBeDefined();
        });
    });

    describe('大页内存管理器', () => {
        it('应该正确检测大页内存可用性', () => {
            const report = optimizer.getReport();
            expect(report.hugePage).toBeDefined();
            expect(typeof report.hugePage.available).toBe('boolean');
        });

        it('应该返回大页大小信息', () => {
            const report = optimizer.getReport();
            if (report.hugePage.available) {
                expect(report.hugePage.hugePageSize).toBeGreaterThan(0);
            }
        });
    });

    describe('缓存感知调度器', () => {
        it('应该正确检测 CAS 可用性', () => {
            const report = optimizer.getReport();
            expect(report.cas).toBeDefined();
            expect(typeof report.cas.available).toBe('boolean');
        });

        it('应该返回缓存层级信息', () => {
            const report = optimizer.getReport();
            if (report.cas.available) {
                expect(report.cas.cacheLevels).toBeDefined();
            }
        });
    });

    describe('IRQ 隔离器', () => {
        it('应该正确检测 IRQ 隔离可用性', () => {
            const report = optimizer.getReport();
            expect(report.irq).toBeDefined();
            expect(typeof report.irq.available).toBe('boolean');
        });

        it('应该返回隔离 CPU 信息', () => {
            const report = optimizer.getReport();
            if (report.irq.available) {
                expect(report.irq.isolatedCpus).toBeDefined();
            }
        });
    });

    describe('优化建议', () => {
        it('应该返回优化建议列表', () => {
            const report = optimizer.getReport();
            expect(Array.isArray(report.recommendations)).toBe(true);
        });

        it('建议应该包含优先级', () => {
            const report = optimizer.getReport();
            if (report.recommendations.length > 0) {
                expect(report.recommendations[0]).toHaveProperty('priority');
                expect(report.recommendations[0]).toHaveProperty('description');
            }
        });
    });

    describe('优化命令生成', () => {
        it('应该生成优化启动命令', () => {
            const cmd = optimizer.getOptimizedCommand('node app.js');
            expect(typeof cmd).toBe('string');
            expect(cmd).toContain('node');
        });

        it('应该保留原始命令', () => {
            const cmd = optimizer.getOptimizedCommand('node app.js');
            expect(cmd).toContain('app.js');
        });
    });

    describe('报告输出', () => {
        it('应该正确打印报告', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            optimizer.printReport();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});

describe('getSystemOptimizer', () => {
    it('应该返回单例实例', () => {
        const o1 = getSystemOptimizer();
        const o2 = getSystemOptimizer();
        expect(o1).toBe(o2);
    });
});
