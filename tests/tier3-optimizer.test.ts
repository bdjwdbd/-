/**
 * @file tier3-optimizer.test.ts
 * @brief Tier 3 优化器单元测试
 */

import { Tier3Optimizer, HybridIndexOptimized } from '../src/infrastructure/tier3-optimizer';

describe('Tier3Optimizer', () => {
    let optimizer: Tier3Optimizer;

    beforeEach(() => {
        optimizer = new Tier3Optimizer({ dimensions: 128 });
    });

    describe('向量操作', () => {
        it('应该正确添加向量', () => {
            const vector = new Float32Array(128).fill(0.5);
            optimizer.add('vec1', vector);
            
            const stats = optimizer.getStats();
            expect(stats.vectorCount).toBe(1);
        });

        it('应该正确批量添加向量', () => {
            for (let i = 0; i < 100; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                optimizer.add(`vec${i}`, vector);
            }
            
            const stats = optimizer.getStats();
            expect(stats.vectorCount).toBe(100);
        });
    });

    describe('索引训练', () => {
        it('应该正确训练索引', async () => {
            // 添加训练数据
            for (let i = 0; i < 100; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                optimizer.add(`vec${i}`, vector);
            }

            await optimizer.train();
            const stats = optimizer.getStats();
            expect(stats.trained).toBe(true);
        });
    });

    describe('搜索功能', () => {
        beforeEach(async () => {
            // 添加测试数据
            for (let i = 0; i < 50; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                optimizer.add(`vec${i}`, vector);
            }
            await optimizer.train();
        });

        it('应该正确搜索 Top-K', () => {
            const query = new Float32Array(128).fill(0.5);
            const results = optimizer.search(query, 10);
            
            expect(results.length).toBe(10);
        });

        it('应该返回正确的结果格式', () => {
            const query = new Float32Array(128).fill(0.5);
            const results = optimizer.search(query, 5);
            
            results.forEach(result => {
                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('score');
            });
        });

        it('应该按分数降序排列', () => {
            const query = new Float32Array(128).fill(0.5);
            const results = optimizer.search(query, 10);
            
            for (let i = 1; i < results.length; i++) {
                expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });
    });

    describe('性能统计', () => {
        it('应该返回正确的统计信息', () => {
            const stats = optimizer.getStats();
            
            expect(stats).toHaveProperty('vectorCount');
            expect(stats).toHaveProperty('trained');
            expect(stats).toHaveProperty('dimensions');
        });
    });
});

describe('HybridIndexOptimized', () => {
    let index: HybridIndexOptimized;

    beforeEach(() => {
        index = new HybridIndexOptimized({ dimensions: 64 });
    });

    describe('基本功能', () => {
        it('应该正确创建实例', () => {
            expect(index).toBeDefined();
        });

        it('应该正确添加向量', () => {
            const vector = new Float32Array(64).fill(0.5);
            index.add('test1', vector);
            
            // 验证添加成功
            const stats = index.getStats();
            expect(stats.vectorCount).toBe(1);
        });
    });

    describe('搜索功能', () => {
        beforeEach(async () => {
            for (let i = 0; i < 30; i++) {
                const vector = new Float32Array(64);
                for (let j = 0; j < 64; j++) {
                    vector[j] = Math.random();
                }
                index.add(`vec${i}`, vector);
            }
            await index.train();
        });

        it('应该正确搜索', () => {
            const query = new Float32Array(64).fill(0.5);
            const results = index.search(query, 5);
            
            expect(results.length).toBeLessThanOrEqual(5);
        });
    });
});
