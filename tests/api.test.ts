/**
 * @file api.test.ts
 * @brief API 模块单元测试
 */

import { YuanLingAPI, createYuanLing } from '../src/infrastructure/api';

describe('YuanLingAPI', () => {
    let api: YuanLingAPI;

    beforeEach(() => {
        api = createYuanLing({ dimensions: 128 });
    });

    describe('基本功能', () => {
        it('应该正确创建实例', () => {
            expect(api).toBeDefined();
        });

        it('应该返回正确的系统信息', () => {
            const info = api.getInfo();
            expect(info.dimensions).toBe(128);
            expect(info.vectorCount).toBe(0);
        });

        it('应该正确添加向量', () => {
            const vector = new Float32Array(128).fill(0.5);
            api.add('test1', vector);
            
            const stats = api.getStats();
            expect(stats.totalVectors).toBe(1);
        });

        it('应该正确添加多个向量', () => {
            for (let i = 0; i < 10; i++) {
                const vector = new Float32Array(128).fill(Math.random());
                api.add(`test${i}`, vector);
            }
            
            const stats = api.getStats();
            expect(stats.totalVectors).toBe(10);
        });
    });

    describe('相似度计算', () => {
        it('应该正确计算余弦相似度', () => {
            const a = new Float32Array([1, 0, 0, 0]);
            const b = new Float32Array([1, 0, 0, 0]);
            
            const similarity = api.cosineSimilarity(a, b);
            expect(similarity).toBeCloseTo(1, 5);
        });

        it('应该正确计算正交向量的相似度', () => {
            const a = new Float32Array([1, 0, 0, 0]);
            const b = new Float32Array([0, 1, 0, 0]);
            
            const similarity = api.cosineSimilarity(a, b);
            expect(similarity).toBeCloseTo(0, 5);
        });

        it('应该正确计算相反向量的相似度', () => {
            const a = new Float32Array([1, 0, 0, 0]);
            const b = new Float32Array([-1, 0, 0, 0]);
            
            const similarity = api.cosineSimilarity(a, b);
            expect(similarity).toBeCloseTo(-1, 5);
        });
    });

    describe('搜索功能', () => {
        beforeEach(() => {
            // 添加测试向量
            for (let i = 0; i < 100; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                api.add(`vec${i}`, vector);
            }
        });

        it('应该正确搜索 Top-K', () => {
            const query = new Float32Array(128).fill(0.5);
            const results = api.search(query, 10);
            
            expect(results.length).toBe(10);
            expect(results[0].score).toBeGreaterThanOrEqual(results[9].score);
        });

        it('应该返回正确的结果格式', () => {
            const query = new Float32Array(128).fill(0.5);
            const results = api.search(query, 5);
            
            results.forEach(result => {
                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('score');
                expect(typeof result.id).toBe('string');
                expect(typeof result.score).toBe('number');
            });
        });
    });
});

describe('createYuanLing', () => {
    it('应该使用默认配置创建实例', () => {
        const api = createYuanLing();
        const info = api.getInfo();
        expect(info.dimensions).toBe(1024);
    });

    it('应该使用自定义配置创建实例', () => {
        const api = createYuanLing({ dimensions: 256 });
        const info = api.getInfo();
        expect(info.dimensions).toBe(256);
    });
});
