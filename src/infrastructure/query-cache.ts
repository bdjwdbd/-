/**
 * @file query-cache.ts
 * @brief LRU 查询结果缓存
 * 
 * 功能：
 * 1. 缓存热门查询结果
 * 2. LRU 淘汰策略
 * 3. 支持相似查询命中（可选）
 */

// ============================================================
// 类型定义
// ============================================================

export interface CacheEntry<T> {
    key: string;
    value: T;
    timestamp: number;
    hits: number;
}

export interface CacheOptions {
    maxSize?: number;
    ttl?: number;           // 生存时间（毫秒）
    enableSimilarity?: boolean;  // 启用相似查询命中
    similarityThreshold?: number; // 相似度阈值
}

// ============================================================
// LRU 缓存
// ============================================================

export class LRUCache<K, V> {
    private cache: Map<K, CacheEntry<V>> = new Map();
    private maxSize: number;
    private ttl: number;

    constructor(maxSize: number = 10000, ttl: number = 3600000) {
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    /**
     * 获取缓存
     */
    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        // 检查是否过期
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }

        // 更新命中次数和位置（LRU）
        entry.hits++;
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    /**
     * 设置缓存
     */
    set(key: K, value: V): void {
        // 如果已存在，先删除
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // 检查容量
        if (this.cache.size >= this.maxSize) {
            this.evict();
        }

        // 添加新条目
        const entry: CacheEntry<V> = {
            key: key as any,
            value,
            timestamp: Date.now(),
            hits: 0
        };
        this.cache.set(key, entry);
    }

    /**
     * 淘汰最少使用的条目
     */
    private evict(): void {
        // 删除最旧的条目（Map 保持插入顺序）
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
            this.cache.delete(firstKey);
        }
    }

    /**
     * 检查是否存在
     */
    has(key: K): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        // 检查是否过期
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * 删除缓存
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * 清空缓存
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * 获取大小
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
    } {
        let totalHits = 0;
        for (const entry of this.cache.values()) {
            totalHits += entry.hits;
        }

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: totalHits / Math.max(1, this.cache.size)
        };
    }
}

// ============================================================
// 向量查询缓存
// ============================================================

export class VectorQueryCache {
    private cache: LRUCache<string, Array<{ index: number; score: number }>>;
    private enableSimilarity: boolean;
    private similarityThreshold: number;
    private vectorCache: Map<string, Float32Array> = new Map();

    constructor(options: CacheOptions = {}) {
        this.cache = new LRUCache(options.maxSize || 10000, options.ttl || 3600000);
        this.enableSimilarity = options.enableSimilarity || false;
        this.similarityThreshold = options.similarityThreshold || 0.99;
    }

    /**
     * 生成查询键
     */
    private hashVector(vector: Float32Array): string {
        // 简化哈希：使用前几个元素和长度
        const parts: string[] = [vector.length.toString()];
        const sampleSize = Math.min(16, vector.length);
        for (let i = 0; i < sampleSize; i++) {
            parts.push(vector[i].toFixed(6));
        }
        return parts.join('_');
    }

    /**
     * 获取缓存结果
     */
    get(query: Float32Array): Array<{ index: number; score: number }> | undefined {
        const key = this.hashVector(query);
        return this.cache.get(key);
    }

    /**
     * 设置缓存结果
     */
    set(query: Float32Array, results: Array<{ index: number; score: number }>): void {
        const key = this.hashVector(query);
        this.cache.set(key, results);

        // 如果启用相似查询，存储原始向量
        if (this.enableSimilarity) {
            this.vectorCache.set(key, query);
        }
    }

    /**
     * 查找相似查询（可选功能）
     */
    findSimilar(query: Float32Array): Array<{ index: number; score: number }> | undefined {
        if (!this.enableSimilarity) return undefined;

        const queryKey = this.hashVector(query);

        for (const [key, cachedQuery] of this.vectorCache) {
            const similarity = this.cosineSimilarity(query, cachedQuery);
            if (similarity >= this.similarityThreshold) {
                return this.cache.get(key);
            }
        }

        return undefined;
    }

    /**
     * 余弦相似度
     */
    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        if (a.length !== b.length) return 0;

        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        cacheSize: number;
        vectorCacheSize: number;
        hitRate: number;
    } {
        const stats = this.cache.getStats();
        return {
            cacheSize: stats.size,
            vectorCacheSize: this.vectorCache.size,
            hitRate: stats.hitRate
        };
    }

    /**
     * 清空缓存
     */
    clear(): void {
        this.cache.clear();
        this.vectorCache.clear();
    }
}

// ============================================================
// 带缓存的搜索引擎
// ============================================================

export class CachedSearchEngine {
    private cache: VectorQueryCache;
    private native: any;
    private hits = 0;
    private misses = 0;

    constructor(options: CacheOptions = {}) {
        this.cache = new VectorQueryCache(options);

        try {
            const path = require('path');
            this.native = require(path.join(__dirname, '../../native/build/Release/yuanling_native.node'));
        } catch (e) {
            console.warn('Native module not available');
        }
    }

    /**
     * 搜索（带缓存）
     */
    search(
        query: Float32Array,
        vectors: Float32Array,
        dim: number,
        k: number
    ): Array<{ index: number; score: number }> {
        // 尝试从缓存获取
        const cached = this.cache.get(query);
        if (cached) {
            this.hits++;
            return cached;
        }

        // 尝试查找相似查询
        const similar = this.cache.findSimilar(query);
        if (similar) {
            this.hits++;
            return similar;
        }

        this.misses++;

        // 执行搜索
        let results: Array<{ index: number; score: number }>;

        if (this.native) {
            results = this.native.topKSearchWithDim(query, vectors, dim, k);
        } else {
            results = this.fallbackSearch(query, vectors, dim, k);
        }

        // 缓存结果
        this.cache.set(query, results);

        return results;
    }

    /**
     * 回退搜索（无原生模块）
     */
    private fallbackSearch(
        query: Float32Array,
        vectors: Float32Array,
        dim: number,
        k: number
    ): Array<{ index: number; score: number }> {
        const numVectors = vectors.length / dim;
        const results: Array<{ index: number; score: number }> = [];

        for (let i = 0; i < numVectors; i++) {
            const vec = vectors.slice(i * dim, (i + 1) * dim);
            const score = this.cosineSimilarity(query, vec);
            results.push({ index: i, score });
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }

    /**
     * 余弦相似度
     */
    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        hits: number;
        misses: number;
        hitRate: number;
        cacheStats: any;
    } {
        const total = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            cacheStats: this.cache.getStats()
        };
    }

    /**
     * 清空缓存
     */
    clearCache(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
}

// ============================================================
// 导出
// ============================================================

export default CachedSearchEngine;
