/**
 * 查询结果缓存
 * 
 * 职责：
 * - 缓存热门查询结果
 * - LRU 淘汰策略
 * - TTL 过期机制
 * - 命中率统计
 */

import * as crypto from 'crypto';

// ============================================================
// 类型定义
// ============================================================

export interface CacheEntry<T> {
  /** 缓存数据 */
  data: T;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** 访问次数 */
  hitCount: number;
  /** 过期时间 */
  expiresAt: number;
  /** 数据大小（字节） */
  size: number;
}

export interface CacheConfig {
  /** 最大条目数 */
  maxSize: number;
  /** 默认 TTL（毫秒） */
  defaultTTL: number;
  /** 是否启用统计 */
  enableStats: boolean;
}

export interface CacheStats {
  /** 总条目数 */
  size: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 总数据大小 */
  totalSize: number;
  /** 平均访问次数 */
  avgHitCount: number;
}

export interface QueryCacheOptions {
  /** 自定义 TTL */
  ttl?: number;
  /** 自定义键 */
  key?: string;
  /** 是否跳过缓存 */
  skipCache?: boolean;
}

// ============================================================
// 查询结果缓存
// ============================================================

export class QueryCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: Required<CacheConfig>;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 10000,
      defaultTTL: config.defaultTTL ?? 3600000, // 1 小时
      enableStats: config.enableStats ?? true,
    };
  }

  /**
   * 生成查询哈希
   */
  private hashQuery(query: Float32Array | number[], k: number): string {
    const buffer = query instanceof Float32Array 
      ? Buffer.from(query.buffer)
      : Buffer.from(new Float32Array(query).buffer);
    
    return crypto
      .createHash('sha256')
      .update(buffer)
      .update(k.toString())
      .digest('hex')
      .substring(0, 32); // 取前 32 字符
  }

  /**
   * 获取缓存
   */
  get(query: Float32Array | number[], k: number): T | null {
    const key = this.hashQuery(query, k);
    return this.getByKey(key);
  }

  /**
   * 通过键获取缓存
   */
  getByKey(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.recordMiss();
      return null;
    }

    // 更新访问信息
    entry.lastAccessedAt = Date.now();
    entry.hitCount++;

    this.recordHit();
    return entry.data;
  }

  /**
   * 设置缓存
   */
  set(
    query: Float32Array | number[],
    k: number,
    data: T,
    options?: QueryCacheOptions
  ): void {
    const key = options?.key ?? this.hashQuery(query, k);
    const ttl = options?.ttl ?? this.config.defaultTTL;

    this.setByKey(key, data, ttl);
  }

  /**
   * 通过键设置缓存
   */
  setByKey(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl ?? this.config.defaultTTL);

    // 估算数据大小
    const size = this.estimateSize(data);

    // 检查是否需要淘汰
    this.evictIfNeeded(size);

    // 添加或更新
    this.cache.set(key, {
      data,
      createdAt: now,
      lastAccessedAt: now,
      hitCount: 0,
      expiresAt,
      size,
    });
  }

  /**
   * 删除缓存
   */
  delete(query: Float32Array | number[], k: number): boolean {
    const key = this.hashQuery(query, k);
    return this.cache.delete(key);
  }

  /**
   * 通过键删除缓存
   */
  deleteByKey(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    let totalSize = 0;
    let totalHitCount = 0;

    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      totalHitCount += entry.hitCount;
    }

    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    const avgHitCount = this.cache.size > 0 ? totalHitCount / this.cache.size : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalSize,
      avgHitCount,
    };
  }

  /**
   * 获取热门查询
   */
  getTopQueries(limit: number = 10): Array<{ key: string; hitCount: number }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, hitCount: entry.hitCount }))
      .sort((a, b) => b.hitCount - a.hitCount);

    return entries.slice(0, limit);
  }

  /**
   * 检查是否存在
   */
  has(query: Float32Array | number[], k: number): boolean {
    const key = this.hashQuery(query, k);
    const entry = this.cache.get(key);

    if (!entry) return false;

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private recordHit(): void {
    if (this.config.enableStats) {
      this.stats.hits++;
    }
  }

  private recordMiss(): void {
    if (this.config.enableStats) {
      this.stats.misses++;
    }
  }

  private evictIfNeeded(newSize: number): void {
    // 检查条目数限制
    while (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    // 找到最久未访问的条目
    let oldest: { key: string; lastAccessedAt: number } | null = null;

    for (const [key, entry] of this.cache) {
      if (!oldest || entry.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = { key, lastAccessedAt: entry.lastAccessedAt };
      }
    }

    if (oldest) {
      this.cache.delete(oldest.key);
    }
  }

  private estimateSize(data: T): number {
    // 简单估算
    if (data === null || data === undefined) return 0;

    if (typeof data === 'string') {
      return data.length * 2;
    }

    if (data instanceof Float32Array) {
      return data.byteLength;
    }

    if (Array.isArray(data)) {
      return data.length * 100; // 估算每个元素 100 字节
    }

    if (typeof data === 'object') {
      return JSON.stringify(data).length * 2;
    }

    return 100; // 默认估算
  }
}

// ============================================================
// 向量搜索缓存
// ============================================================

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class VectorSearchCache extends QueryCache<VectorSearchResult[]> {
  constructor(config: Partial<CacheConfig> = {}) {
    super(config);
  }

  /**
   * 获取搜索结果
   */
  getSearchResult(query: Float32Array, k: number): VectorSearchResult[] | null {
    return this.get(query, k);
  }

  /**
   * 设置搜索结果
   */
  setSearchResult(
    query: Float32Array,
    k: number,
    results: VectorSearchResult[],
    ttl?: number
  ): void {
    this.set(query, k, results, { ttl });
  }
}

// ============================================================
// 带缓存的搜索引擎
// ============================================================

export interface SearchEngine {
  search(query: Float32Array, k: number): Promise<VectorSearchResult[]>;
}

export class CachedSearchEngine {
  private engine: SearchEngine;
  private cache: VectorSearchCache;

  constructor(engine: SearchEngine, config?: Partial<CacheConfig>) {
    this.engine = engine;
    this.cache = new VectorSearchCache(config);
  }

  /**
   * 搜索（带缓存）
   */
  async search(query: Float32Array, k: number): Promise<VectorSearchResult[]> {
    // 检查缓存
    const cached = this.cache.getSearchResult(query, k);
    if (cached) {
      return cached;
    }

    // 执行搜索
    const results = await this.engine.search(query, k);

    // 缓存结果
    this.cache.setSearchResult(query, k, results);

    return results;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清理过期缓存
   */
  cleanupCache(): number {
    return this.cache.cleanup();
  }
}

// ============================================================
// 单例实例
// ============================================================

let defaultCache: QueryCache | null = null;

export function getQueryCache<T = unknown>(config?: Partial<CacheConfig>): QueryCache<T> {
  if (!defaultCache) {
    defaultCache = new QueryCache(config);
  }
  return defaultCache as QueryCache<T>;
}

let defaultVectorCache: VectorSearchCache | null = null;

export function getVectorSearchCache(config?: Partial<CacheConfig>): VectorSearchCache {
  if (!defaultVectorCache) {
    defaultVectorCache = new VectorSearchCache(config);
  }
  return defaultVectorCache;
}
