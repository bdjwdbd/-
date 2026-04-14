/**
 * 查询缓存
 * 
 * 功能：
 * 1. 结果缓存
 * 2. LRU 淘汰
 * 3. TTL 过期
 */

// ============================================================
// 类型定义
// ============================================================

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

export interface QueryCacheConfig {
  maxSize: number;
  ttl: number;           // 毫秒
  enableCompression: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: QueryCacheConfig = {
  maxSize: 1000,
  ttl: 3600000,  // 1 小时
  enableCompression: false,
};

// ============================================================
// 查询缓存类
// ============================================================

export class QueryCache<T = unknown> {
  private config: QueryCacheConfig;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  constructor(config: Partial<QueryCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取缓存
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // 检查 TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.hits++;

    return entry.value;
  }

  /**
   * 设置缓存
   */
  set(key: string, value: T): void {
    // 检查容量
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
    });
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // 检查 TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 淘汰条目（LRU）
   */
  private evict(): void {
    // 找到最少使用的条目
    let minAccess = Infinity;
    let oldestTime = Infinity;
    let evictKey: string | null = null;

    for (const [key, entry] of this.cache) {
      // 优先淘汰访问次数少的
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        oldestTime = entry.lastAccess;
        evictKey = key;
      } else if (entry.accessCount === minAccess && entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        evictKey = key;
      }
    }

    if (evictKey) {
      this.cache.delete(evictKey);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.config.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<QueryCacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================
// 查询结果缓存
// ============================================================

export interface QueryResult {
  query: string;
  results: unknown[];
  timestamp: number;
}

export class QueryResultCache extends QueryCache<QueryResult> {
  constructor(config: Partial<QueryCacheConfig> = {}) {
    super(config);
  }

  /**
   * 缓存查询结果
   */
  cacheQuery(query: string, results: unknown[]): void {
    this.set(this.hashQuery(query), {
      query,
      results,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取缓存的查询结果
   */
  getCachedQuery(query: string): QueryResult | null {
    return this.get(this.hashQuery(query));
  }

  /**
   * 哈希查询
   */
  private hashQuery(query: string): string {
    // 简单哈希：规范化查询
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }
}
