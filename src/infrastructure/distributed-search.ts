/**
 * @file distributed-search.ts
 * @brief 分布式向量搜索
 * 
 * 功能：
 * 1. 数据分片
 * 2. 并行搜索
 * 3. 结果聚合
 */

// ============================================================
// 类型定义
// ============================================================

export interface ShardConfig {
    id: string;
    host: string;
    port: number;
    weight?: number;
}

export interface DistributedSearchResult {
    id: string;
    score: number;
    shardId: string;
}

export interface SearchRequest {
    query: Float32Array;
    k: number;
    timeout?: number;
}

// ============================================================
// 分片管理器
// ============================================================

export class ShardManager {
    private shards: Map<string, ShardConfig> = new Map();
    private hashRing: string[] = [];

    addShard(config: ShardConfig): void {
        this.shards.set(config.id, config);
        this.hashRing.push(config.id);
        this.hashRing.sort();
    }

    removeShard(id: string): void {
        this.shards.delete(id);
        this.hashRing = this.hashRing.filter(s => s !== id);
    }

    getShard(id: string): ShardConfig | undefined {
        return this.shards.get(id);
    }

    getAllShards(): ShardConfig[] {
        return Array.from(this.shards.values());
    }

    getShardCount(): number {
        return this.shards.size;
    }

    // 一致性哈希
    getShardForKey(key: string): ShardConfig {
        const hash = this.simpleHash(key);
        const idx = hash % this.hashRing.length;
        return this.shards.get(this.hashRing[idx])!;
    }

    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

// ============================================================
// 本地分片
// ============================================================

export class LocalShard {
    private id: string;
    private vectors: Map<string, Float32Array> = new Map();
    private dimensions: number;

    constructor(id: string, dimensions: number = 128) {
        this.id = id;
        this.dimensions = dimensions;
    }

    add(id: string, vector: Float32Array): void {
        this.vectors.set(id, vector);
    }

    get(id: string): Float32Array | undefined {
        return this.vectors.get(id);
    }

    search(query: Float32Array, k: number): DistributedSearchResult[] {
        const results: DistributedSearchResult[] = [];

        for (const [id, vector] of this.vectors) {
            const score = this.cosineSimilarity(query, vector);
            results.push({ id, score, shardId: this.id });
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }

    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    }

    getStats() {
        return {
            id: this.id,
            vectorCount: this.vectors.size,
            dimensions: this.dimensions,
        };
    }
}

// ============================================================
// 分布式搜索引擎
// ============================================================

export class DistributedSearchEngine {
    private shardManager: ShardManager;
    private localShards: Map<string, LocalShard> = new Map();
    private dimensions: number;

    constructor(dimensions: number = 128) {
        this.dimensions = dimensions;
        this.shardManager = new ShardManager();
    }

    // ============================================================
    // 分片管理
    // ============================================================

    addShard(id: string): void {
        this.shardManager.addShard({ id, host: 'localhost', port: 0 });
        this.localShards.set(id, new LocalShard(id, this.dimensions));
    }

    removeShard(id: string): void {
        this.shardManager.removeShard(id);
        this.localShards.delete(id);
    }

    // ============================================================
    // 数据分布
    // ============================================================

    addVector(id: string, vector: Float32Array): void {
        // 根据向量 ID 分配到分片
        const shard = this.shardManager.getShardForKey(id);
        const localShard = this.localShards.get(shard.id);
        if (localShard) {
            localShard.add(id, vector);
        }
    }

    // ============================================================
    // 并行搜索
    // ============================================================

    async search(query: Float32Array, k: number): Promise<DistributedSearchResult[]> {
        const shards = this.shardManager.getAllShards();
        const perShardK = Math.ceil(k * 1.5); // 每个分片多取一些

        // 并行搜索所有分片
        const promises = shards.map(async shard => {
            const localShard = this.localShards.get(shard.id);
            if (!localShard) return [];
            return localShard.search(query, perShardK);
        });

        const results = await Promise.all(promises);

        // 聚合结果
        const allResults = results.flat();
        allResults.sort((a, b) => b.score - a.score);

        return allResults.slice(0, k);
    }

    // ============================================================
    // 统计
    // ============================================================

    getStats() {
        const shardStats = Array.from(this.localShards.values()).map(s => s.getStats());
        const totalVectors = shardStats.reduce((sum, s) => sum + s.vectorCount, 0);

        return {
            shardCount: this.shardManager.getShardCount(),
            totalVectors,
            dimensions: this.dimensions,
            shards: shardStats,
        };
    }
}

// ============================================================
// 导出
// ============================================================

export default {
    ShardManager,
    LocalShard,
    DistributedSearchEngine,
};
