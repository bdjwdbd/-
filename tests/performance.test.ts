/**
 * @file performance.test.ts
 * @brief 性能回归测试
 */

import { createYuanLing } from '../src/infrastructure/api';

describe('性能回归测试', () => {
    const api = createYuanLing({ dimensions: 128 });

    describe('向量添加性能', () => {
        it('应该在合理时间内添加 1000 个向量', () => {
            const start = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                api.add(`perf_vec_${i}`, vector);
            }
            
            const elapsed = Date.now() - start;
            console.log(`添加 1000 个向量耗时: ${elapsed}ms`);
            
            // 性能基准：应该小于 1 秒
            expect(elapsed).toBeLessThan(1000);
        });
    });

    describe('搜索性能', () => {
        beforeAll(() => {
            // 准备测试数据
            for (let i = 0; i < 10000; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                api.add(`search_vec_${i}`, vector);
            }
        });

        it('应该在合理时间内完成 Top-10 搜索', () => {
            const query = new Float32Array(128).fill(0.5);
            
            const start = Date.now();
            const results = api.search(query, 10);
            const elapsed = Date.now() - start;
            
            console.log(`Top-10 搜索耗时: ${elapsed}ms`);
            
            expect(results.length).toBe(10);
            // 性能基准：应该小于 100ms
            expect(elapsed).toBeLessThan(100);
        });

        it('应该在合理时间内完成 Top-100 搜索', () => {
            const query = new Float32Array(128).fill(0.5);
            
            const start = Date.now();
            const results = api.search(query, 100);
            const elapsed = Date.now() - start;
            
            console.log(`Top-100 搜索耗时: ${elapsed}ms`);
            
            expect(results.length).toBe(100);
            // 性能基准：应该小于 200ms
            expect(elapsed).toBeLessThan(200);
        });

        it('多次搜索性能应该稳定', () => {
            const query = new Float32Array(128).fill(0.5);
            const times: number[] = [];
            
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                api.search(query, 10);
                times.push(Date.now() - start);
            }
            
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);
            
            console.log(`10 次搜索平均耗时: ${avgTime}ms, 最大: ${maxTime}ms`);
            
            // 性能稳定性：最大时间不应超过平均时间的 3 倍
            expect(maxTime).toBeLessThan(avgTime * 3 + 50);
        });
    });

    describe('相似度计算性能', () => {
        it('应该在合理时间内计算批量相似度', () => {
            const query = new Float32Array(128).fill(0.5);
            const vectors: Float32Array[] = [];
            
            for (let i = 0; i < 1000; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                vectors.push(vector);
            }
            
            const start = Date.now();
            const scores = api.cosineSimilarityBatch(query, vectors);
            const elapsed = Date.now() - start;
            
            console.log(`批量计算 1000 个相似度耗时: ${elapsed}ms`);
            
            expect(scores.length).toBe(1000);
            // 性能基准：应该小于 100ms
            expect(elapsed).toBeLessThan(100);
        });
    });

    describe('内存使用', () => {
        it('内存使用应该在合理范围内', () => {
            const memBefore = process.memoryUsage().heapUsed;
            
            // 添加 5000 个向量
            for (let i = 0; i < 5000; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                api.add(`mem_vec_${i}`, vector);
            }
            
            const memAfter = process.memoryUsage().heapUsed;
            const memUsed = (memAfter - memBefore) / 1024 / 1024;
            
            console.log(`5000 个向量内存占用: ${memUsed.toFixed(2)} MB`);
            
            // 内存基准：每个向量 128 * 4 = 512 bytes，5000 个约 2.5 MB
            // 加上索引开销，应该小于 50 MB
            expect(memUsed).toBeLessThan(50);
        });
    });

    describe('并发性能', () => {
        it('应该正确处理并发搜索', async () => {
            const queries: Float32Array[] = [];
            for (let i = 0; i < 10; i++) {
                const query = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    query[j] = Math.random();
                }
                queries.push(query);
            }
            
            const start = Date.now();
            
            const promises = queries.map(query => 
                Promise.resolve(api.search(query, 10))
            );
            
            const results = await Promise.all(promises);
            const elapsed = Date.now() - start;
            
            console.log(`10 个并发搜索耗时: ${elapsed}ms`);
            
            expect(results.length).toBe(10);
            results.forEach(r => expect(r.length).toBe(10));
        });
    });
});
