/**
 * @file distributed-search.test.ts
 * @brief 分布式搜索单元测试
 */

import { 
    ShardManager, 
    LocalShard, 
    DistributedSearchEngine 
} from '../src/infrastructure/distributed-search';

describe('ShardManager', () => {
    let manager: ShardManager;

    beforeEach(() => {
        manager = new ShardManager();
    });

    describe('分片管理', () => {
        it('应该正确添加分片', () => {
            manager.addShard({ id: 'shard1', host: 'localhost', port: 3001 });
            expect(manager.getShardCount()).toBe(1);
        });

        it('应该正确添加多个分片', () => {
            manager.addShard({ id: 'shard1', host: 'localhost', port: 3001 });
            manager.addShard({ id: 'shard2', host: 'localhost', port: 3002 });
            manager.addShard({ id: 'shard3', host: 'localhost', port: 3003 });
            
            expect(manager.getShardCount()).toBe(3);
        });

        it('应该正确移除分片', () => {
            manager.addShard({ id: 'shard1', host: 'localhost', port: 3001 });
            manager.removeShard('shard1');
            
            expect(manager.getShardCount()).toBe(0);
        });

        it('应该正确获取分片', () => {
            manager.addShard({ id: 'shard1', host: 'localhost', port: 3001 });
            const shard = manager.getShard('shard1');
            
            expect(shard).toBeDefined();
            expect(shard?.id).toBe('shard1');
        });

        it('应该正确获取所有分片', () => {
            manager.addShard({ id: 'shard1', host: 'localhost', port: 3001 });
            manager.addShard({ id: 'shard2', host: 'localhost', port: 3002 });
            
            const shards = manager.getAllShards();
            expect(shards.length).toBe(2);
        });
    });

    describe('一致性哈希', () => {
        beforeEach(() => {
            manager.addShard({ id: 'shard1', host: 'localhost', port: 3001 });
            manager.addShard({ id: 'shard2', host: 'localhost', port: 3002 });
            manager.addShard({ id: 'shard3', host: 'localhost', port: 3003 });
        });

        it('应该正确分配键到分片', () => {
            const shard = manager.getShardForKey('test_key');
            expect(shard).toBeDefined();
        });

        it('应该一致地分配相同的键', () => {
            const shard1 = manager.getShardForKey('test_key');
            const shard2 = manager.getShardForKey('test_key');
            
            expect(shard1.id).toBe(shard2.id);
        });
    });
});

describe('LocalShard', () => {
    let shard: LocalShard;

    beforeEach(() => {
        shard = new LocalShard('test-shard', 128);
    });

    describe('向量操作', () => {
        it('应该正确添加向量', () => {
            const vector = new Float32Array(128).fill(0.5);
            shard.add('vec1', vector);
            
            const stats = shard.getStats();
            expect(stats.vectorCount).toBe(1);
        });

        it('应该正确获取向量', () => {
            const vector = new Float32Array(128).fill(0.5);
            shard.add('vec1', vector);
            
            const retrieved = shard.get('vec1');
            expect(retrieved).toBeDefined();
        });
    });

    describe('搜索功能', () => {
        beforeEach(() => {
            for (let i = 0; i < 50; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                shard.add(`vec${i}`, vector);
            }
        });

        it('应该正确搜索 Top-K', () => {
            const query = new Float32Array(128).fill(0.5);
            const results = shard.search(query, 10);
            
            expect(results.length).toBe(10);
        });

        it('应该返回正确的结果格式', () => {
            const query = new Float32Array(128).fill(0.5);
            const results = shard.search(query, 5);
            
            results.forEach(result => {
                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('score');
                expect(result).toHaveProperty('shardId');
            });
        });

        it('应该按分数降序排列', () => {
            const query = new Float32Array(128).fill(0.5);
            const results = shard.search(query, 10);
            
            for (let i = 1; i < results.length; i++) {
                expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });
    });
});

describe('DistributedSearchEngine', () => {
    let engine: DistributedSearchEngine;

    beforeEach(() => {
        engine = new DistributedSearchEngine(128);
    });

    describe('分片管理', () => {
        it('应该正确添加分片', () => {
            engine.addShard('shard1');
            const stats = engine.getStats();
            
            expect(stats.shardCount).toBe(1);
        });

        it('应该正确添加多个分片', () => {
            engine.addShard('shard1');
            engine.addShard('shard2');
            engine.addShard('shard3');
            
            const stats = engine.getStats();
            expect(stats.shardCount).toBe(3);
        });
    });

    describe('数据分布', () => {
        beforeEach(() => {
            engine.addShard('shard1');
            engine.addShard('shard2');
            engine.addShard('shard3');
        });

        it('应该正确分布向量到分片', () => {
            for (let i = 0; i < 100; i++) {
                const vector = new Float32Array(128).fill(Math.random());
                engine.addVector(`vec${i}`, vector);
            }
            
            const stats = engine.getStats();
            expect(stats.totalVectors).toBe(100);
        });
    });

    describe('并行搜索', () => {
        beforeEach(() => {
            engine.addShard('shard1');
            engine.addShard('shard2');
            engine.addShard('shard3');
            
            for (let i = 0; i < 100; i++) {
                const vector = new Float32Array(128);
                for (let j = 0; j < 128; j++) {
                    vector[j] = Math.random();
                }
                engine.addVector(`vec${i}`, vector);
            }
        });

        it('应该正确执行并行搜索', async () => {
            const query = new Float32Array(128).fill(0.5);
            const results = await engine.search(query, 10);
            
            expect(results.length).toBe(10);
        });

        it('应该返回正确的结果格式', async () => {
            const query = new Float32Array(128).fill(0.5);
            const results = await engine.search(query, 5);
            
            results.forEach(result => {
                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('score');
                expect(result).toHaveProperty('shardId');
            });
        });
    });
});
