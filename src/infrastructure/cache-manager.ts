/**
 * 高级缓存系统
 * 
 * 使用 lru-cache 实现高性能缓存
 */

import { LRUCache } from 'lru-cache';

// ============================================================
// 类型定义
// ============================================================

export interface CacheConfig {
  max: number;           // 最大条目数
  maxSize?: number;      // 最大大小（字节）
  ttl?: number;          // 过期时间（毫秒）
  allowStale?: boolean;  // 允许返回过期数据
  updateAgeOnGet?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  max: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: CacheConfig = {
  max: 10000,
  ttl: 1000 * 60 * 60, // 1小时
  allowStale: false,
  updateAgeOnGet: true,
};

// ============================================================
// 缓存管理器
// ============================================================

export class CacheManager {
  private caches: Map<string, LRUCache<string, any>> = new Map();
  private stats: Map<string, { hits: number; misses: number }> = new Map();

  /**
   * 创建或获取缓存
   */
  getCache(name: string, config?: Partial<CacheConfig>): LRUCache<string, any> {
    if (!this.caches.has(name)) {
      const finalConfig = { ...DEFAULT_CONFIG, ...config };
      const cache = new LRUCache<string, any>(finalConfig as any);
      this.caches.set(name, cache);
      this.stats.set(name, { hits: 0, misses: 0 });
    }
    
    return this.caches.get(name)!;
  }

  /**
   * 获取缓存值
   */
  get<T = any>(cacheName: string, key: string): T | undefined {
    const cache = this.caches.get(cacheName);
    const stats = this.stats.get(cacheName);
    
    if (cache && stats) {
      const value = cache.get(key);
      if (value !== undefined) {
        stats.hits++;
        return value as T;
      }
      stats.misses++;
    }
    
    return undefined;
  }

  /**
   * 设置缓存值
   */
  set<T = any>(cacheName: string, key: string, value: T): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.set(key, value);
    }
  }

  /**
   * 获取或计算
   */
  async getOrCompute<T>(
    cacheName: string,
    key: string,
    compute: () => Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(cacheName, key);
    if (cached !== undefined) {
      return cached;
    }
    
    const value = await compute();
    this.set(cacheName, key, value);
    return value;
  }

  /**
   * 删除缓存值
   */
  delete(cacheName: string, key: string): boolean {
    const cache = this.caches.get(cacheName);
    if (cache) {
      return cache.delete(key);
    }
    return false;
  }

  /**
   * 清空缓存
   */
  clear(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(cacheName: string): CacheStats {
    const cache = this.caches.get(cacheName);
    const stats = this.stats.get(cacheName);
    
    if (!cache || !stats) {
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        max: 0,
      };
    }
    
    const total = stats.hits + stats.misses;
    
    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: total > 0 ? stats.hits / total : 0,
      size: cache.size,
      max: cache.max,
    };
  }

  /**
   * 获取所有缓存统计
   */
  getAllStats(): Map<string, CacheStats> {
    const result = new Map<string, CacheStats>();
    for (const name of this.caches.keys()) {
      result.set(name, this.getStats(name));
    }
    return result;
  }
}

// ============================================================
// 全局缓存管理器
// ============================================================

let globalCacheManager: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager();
  }
  return globalCacheManager;
}
