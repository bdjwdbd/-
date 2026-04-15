/**
 * @file disk-persistence.ts
 * @brief 磁盘持久化存储
 * 
 * 功能：
 * 1. 向量数据持久化到磁盘
 * 2. 内存映射文件支持
 * 3. 热点数据缓存
 * 4. 支持大规模向量存储
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 类型定义
// ============================================================

export interface DiskStorageConfig {
    dataDir: string;              // 数据目录
    maxMemoryCache?: number;      // 最大内存缓存（向量数）
    shardSize?: number;           // 分片大小
}

export interface VectorShard {
    id: number;
    path: string;
    numVectors: number;
    dim: number;
    offset: number;               // 起始索引
}

export interface IndexMetadata {
    totalVectors: number;
    dim: number;
    shards: VectorShard[];
    created: number;
    updated: number;
}

// ============================================================
// 磁盘向量存储
// ============================================================

export class DiskVectorStorage {
    private dataDir: string;
    private maxMemoryCache: number;
    private shardSize: number;
    private metadata: IndexMetadata | null = null;
    private memoryCache: Map<number, Float32Array> = new Map();
    private cacheOrder: number[] = [];
    private currentShard: number = 0;
    private currentShardData: Float32Array[] = [];

    constructor(config: DiskStorageConfig) {
        this.dataDir = config.dataDir;
        this.maxMemoryCache = config.maxMemoryCache || 100000;
        this.shardSize = config.shardSize || 100000;

        // 确保目录存在
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // 加载元数据
        this.loadMetadata();
    }

    /**
     * 加载元数据
     */
    private loadMetadata(): void {
        const metadataPath = path.join(this.dataDir, 'metadata.json');
        
        if (fs.existsSync(metadataPath)) {
            const data = fs.readFileSync(metadataPath, 'utf-8');
            this.metadata = JSON.parse(data);
        } else {
            this.metadata = {
                totalVectors: 0,
                dim: 0,
                shards: [],
                created: Date.now(),
                updated: Date.now()
            };
        }
    }

    /**
     * 保存元数据
     */
    private saveMetadata(): void {
        if (!this.metadata) return;

        this.metadata.updated = Date.now();
        const metadataPath = path.join(this.dataDir, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(this.metadata, null, 2));
    }

    /**
     * 初始化维度
     */
    initDimension(dim: number): void {
        if (!this.metadata) return;
        
        if (this.metadata.dim === 0) {
            this.metadata.dim = dim;
            this.saveMetadata();
        } else if (this.metadata.dim !== dim) {
            throw new Error(`Dimension mismatch: expected ${this.metadata.dim}, got ${dim}`);
        }
    }

    /**
     * 添加向量
     */
    addVector(vector: Float32Array): number {
        if (!this.metadata) throw new Error('Metadata not loaded');

        this.initDimension(vector.length);

        const index = this.metadata.totalVectors;
        this.currentShardData.push(vector);
        this.metadata.totalVectors++;

        // 检查是否需要刷新分片
        if (this.currentShardData.length >= this.shardSize) {
            this.flushCurrentShard();
        }

        return index;
    }

    /**
     * 批量添加向量
     */
    addVectors(vectors: Float32Array[]): number[] {
        const indices: number[] = [];
        for (const vec of vectors) {
            indices.push(this.addVector(vec));
        }
        return indices;
    }

    /**
     * 刷新当前分片到磁盘
     */
    flushCurrentShard(): void {
        if (!this.metadata || this.currentShardData.length === 0) return;

        const shardId = this.metadata.shards.length;
        const shardPath = path.join(this.dataDir, `shard_${shardId}.bin`);

        // 合并所有向量
        const dim = this.metadata.dim;
        const data = new Float32Array(this.currentShardData.length * dim);
        for (let i = 0; i < this.currentShardData.length; i++) {
            data.set(this.currentShardData[i], i * dim);
        }

        // 写入文件
        const buffer = Buffer.from(data.buffer);
        fs.writeFileSync(shardPath, buffer);

        // 更新元数据
        const shard: VectorShard = {
            id: shardId,
            path: shardPath,
            numVectors: this.currentShardData.length,
            dim: dim,
            offset: this.metadata.shards.reduce((sum, s) => sum + s.numVectors, 0)
        };

        this.metadata.shards.push(shard);
        this.saveMetadata();

        // 清空当前分片
        this.currentShardData = [];
        this.currentShard++;
    }

    /**
     * 获取向量
     */
    getVector(index: number): Float32Array | null {
        if (!this.metadata) return null;
        if (index < 0 || index >= this.metadata.totalVectors) return null;

        // 检查内存缓存
        if (this.memoryCache.has(index)) {
            return this.memoryCache.get(index)!;
        }

        // 找到对应的分片
        const shard = this.findShard(index);
        if (!shard) return null;

        // 从磁盘加载
        const localIndex = index - shard.offset;
        const vector = this.loadVectorFromShard(shard, localIndex);

        // 加入缓存
        this.addToCache(index, vector);

        return vector;
    }

    /**
     * 批量获取向量
     */
    getVectors(indices: number[]): (Float32Array | null)[] {
        return indices.map(i => this.getVector(i));
    }

    /**
     * 查找索引所在的分片
     */
    private findShard(index: number): VectorShard | null {
        if (!this.metadata) return null;

        for (const shard of this.metadata.shards) {
            if (index >= shard.offset && index < shard.offset + shard.numVectors) {
                return shard;
            }
        }
        return null;
    }

    /**
     * 从分片加载向量
     */
    private loadVectorFromShard(shard: VectorShard, localIndex: number): Float32Array {
        const dim = shard.dim;
        const buffer = fs.readFileSync(shard.path);
        const data = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

        const start = localIndex * dim;
        return data.slice(start, start + dim);
    }

    /**
     * 加载整个分片
     */
    private loadShard(shardId: number): Float32Array | null {
        if (!this.metadata) return null;

        const shard = this.metadata.shards.find(s => s.id === shardId);
        if (!shard) return null;

        const buffer = fs.readFileSync(shard.path);
        return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    }

    /**
     * 添加到缓存
     */
    private addToCache(index: number, vector: Float32Array): void {
        // 检查缓存大小
        while (this.memoryCache.size >= this.maxMemoryCache) {
            // LRU 淘汰
            const oldest = this.cacheOrder.shift();
            if (oldest !== undefined) {
                this.memoryCache.delete(oldest);
            }
        }

        this.memoryCache.set(index, vector);
        this.cacheOrder.push(index);
    }

    /**
     * 搜索（使用原生模块）
     */
    search(
        query: Float32Array,
        k: number,
        nativeModule: any
    ): Array<{ index: number; score: number }> {
        if (!this.metadata) return [];

        const results: Array<{ index: number; score: number }> = [];

        // 遍历所有分片
        for (const shard of this.metadata.shards) {
            const shardData = this.loadShard(shard.id);
            if (!shardData) continue;

            // 使用原生模块搜索
            const shardResults = nativeModule.topKSearchWithDim(
                query,
                shardData,
                this.metadata.dim,
                k
            );

            // 调整索引
            for (const r of shardResults) {
                results.push({
                    index: r.index + shard.offset,
                    score: r.score
                });
            }
        }

        // 合并结果
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        totalVectors: number;
        dim: number;
        numShards: number;
        cacheSize: number;
        diskUsage: number;
    } {
        if (!this.metadata) {
            return {
                totalVectors: 0,
                dim: 0,
                numShards: 0,
                cacheSize: 0,
                diskUsage: 0
            };
        }

        // 计算磁盘使用
        let diskUsage = 0;
        for (const shard of this.metadata.shards) {
            try {
                const stats = fs.statSync(shard.path);
                diskUsage += stats.size;
            } catch {}
        }

        return {
            totalVectors: this.metadata.totalVectors,
            dim: this.metadata.dim,
            numShards: this.metadata.shards.length,
            cacheSize: this.memoryCache.size,
            diskUsage
        };
    }

    /**
     * 清空缓存
     */
    clearCache(): void {
        this.memoryCache.clear();
        this.cacheOrder = [];
    }

    /**
     * 关闭（刷新数据）
     */
    close(): void {
        this.flushCurrentShard();
        this.saveMetadata();
        this.clearCache();
    }
}

// ============================================================
// 导出
// ============================================================

export default DiskVectorStorage;
