/**
 * 向量搜索缓存模块
 * 
 * 缓存向量搜索结果，加速重复查询
 */

// ============================================================
// 类型定义
// ============================================================

export interface VectorCacheConfig {
  /** 最大缓存条目数，默认 1000 */
  maxSize?: number;
  /** 缓存过期时间（毫秒），默认 300000 (5分钟) */
  ttl?: number;
  /** 是否启用缓存，默认 true */
  enabled?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
  key: string;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

// ============================================================
// LRU 缓存
// ============================================================

export class LRUCache<K, V> {
  private cache: Map<string, CacheEntry<V>> = new Map();
  private config: Required<VectorCacheConfig>;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(config: VectorCacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      ttl: config.ttl || 300000, // 5 分钟
      enabled: config.enabled !== false,
    };
  }

  /**
   * 生成缓存键
   */
  static createVectorKey(query: number[], operation: string): string {
    // 使用前 4 个元素 + 长度 + 操作类型作为键
    // 平衡精度和性能
    const prefix = query.slice(0, 4).map(v => v.toFixed(4)).join(',');
    return `${operation}:${query.length}:${prefix}`;
  }

  /**
   * 获取缓存
   */
  get(key: string): V | undefined {
    if (!this.config.enabled) return undefined;

    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // 更新命中次数和访问时间
    entry.hits++;
    entry.timestamp = Date.now();
    this.hits++;

    // LRU: 移到末尾（Map 保持插入顺序）
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * 设置缓存
   */
  set(key: string, value: V): void {
    if (!this.config.enabled) return;

    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 检查容量
    while (this.cache.size >= this.config.maxSize) {
      // 删除最旧的条目（Map 的第一个元素）
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }

    // 添加新条目
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
      key,
    });
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    if (!this.config.enabled) return false;
    
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // 检查是否过期
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
    this.evictions = 0;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      evictions: this.evictions,
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
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 是否启用
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }
}

// ============================================================
// 向量搜索缓存
// ============================================================

export class VectorSearchCache {
  private cache: LRUCache<string, number[]>;
  private queryNormCache: LRUCache<string, number>;

  constructor(config: VectorCacheConfig = {}) {
    this.cache = new LRUCache(config);
    this.queryNormCache = new LRUCache({ ...config, maxSize: (config.maxSize || 1000) * 2 });
  }

  /**
   * 获取搜索结果缓存
   */
  getSearchResult(query: number[], operation: string): number[] | undefined {
    const key = LRUCache.createVectorKey(query, operation);
    return this.cache.get(key);
  }

  /**
   * 设置搜索结果缓存
   */
  setSearchResult(query: number[], operation: string, result: number[]): void {
    const key = LRUCache.createVectorKey(query, operation);
    this.cache.set(key, result);
  }

  /**
   * 获取查询向量范数缓存
   */
  getQueryNorm(query: number[]): number | undefined {
    const key = `norm:${query.length}:${query.slice(0, 4).join(',')}`;
    return this.queryNormCache.get(key);
  }

  /**
   * 设置查询向量范数缓存
   */
  setQueryNorm(query: number[], norm: number): void {
    const key = `norm:${query.length}:${query.slice(0, 4).join(',')}`;
    this.queryNormCache.set(key, norm);
  }

  /**
   * 获取统计信息
   */
  getStats(): { search: CacheStats; norm: CacheStats } {
    return {
      search: this.cache.getStats(),
      norm: this.queryNormCache.getStats(),
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.queryNormCache.clear();
  }

  /**
   * 清理过期条目
   */
  cleanup(): { search: number; norm: number } {
    return {
      search: this.cache.cleanup(),
      norm: this.queryNormCache.cleanup(),
    };
  }
}

// ============================================================
// 导出
// ============================================================

export function createVectorCache(config?: VectorCacheConfig): VectorSearchCache {
  return new VectorSearchCache(config);
}
