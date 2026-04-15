/**
 * 资源管理器
 * 
 * 统一管理：
 * - 全局缓存
 * - 性能监控
 * - 内存管理
 * - 资源清理
 */

import { CacheSystem, PerformanceMonitor, StructuredLogger } from "./infrastructure";

// ============================================================
// 类型定义
// ============================================================

interface ResourceManagerConfig {
  cacheMaxSize: number;
  cacheDefaultTTL: number;
  memoryWarningThreshold: number;  // MB
  memoryCriticalThreshold: number; // MB
  gcInterval: number;              // ms
  enableMetrics: boolean;
}

interface ResourceStats {
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    usagePercent: number;
  };
  cache: {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  uptime: number;
}

// ============================================================
// ResourceManager - 资源管理器
// ============================================================

export class ResourceManager {
  private static instance: ResourceManager | null = null;
  
  private config: ResourceManagerConfig;
  private cache: CacheSystem;
  private monitor: PerformanceMonitor;
  private logger: StructuredLogger;
  private gcTimer?: NodeJS.Timeout;
  private startTime: number;
  
  private constructor(config?: Partial<ResourceManagerConfig>) {
    this.config = {
      cacheMaxSize: 5000,
      cacheDefaultTTL: 3600000, // 1小时
      memoryWarningThreshold: 500,  // 500MB
      memoryCriticalThreshold: 800, // 800MB
      gcInterval: 60000, // 1分钟
      enableMetrics: true,
      ...config,
    };
    
    this.cache = new CacheSystem(this.config.cacheMaxSize, this.config.cacheDefaultTTL);
    this.monitor = new PerformanceMonitor();
    this.logger = new StructuredLogger();
    this.startTime = Date.now();
    
    // 启动自动 GC
    this.startAutoGC();
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<ResourceManagerConfig>): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager(config);
    }
    return ResourceManager.instance;
  }
  
  /**
   * 重置单例（测试用）
   */
  static reset(): void {
    if (ResourceManager.instance) {
      ResourceManager.instance.stopAutoGC();
      ResourceManager.instance = null;
    }
  }
  
  // ============ 缓存管理 ============
  
  /**
   * 获取缓存值
   */
  getCached<T>(key: string): T | null {
    return this.cache.get(key) as T | null;
  }
  
  /**
   * 设置缓存值
   */
  setCache(key: string, value: any, ttl?: number): void {
    this.cache.set(key, value, ttl);
  }
  
  /**
   * 获取或创建缓存值
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.getCached<T>(key);
    if (cached !== null) {
      this.monitor.record("cache_hit", 1);
      return cached;
    }
    
    this.monitor.record("cache_miss", 1);
    const value = await factory();
    this.setCache(key, value, ttl);
    return value;
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info("缓存已清除");
  }
  
  // ============ 性能监控 ============
  
  /**
   * 记录性能指标
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (this.config.enableMetrics) {
      this.monitor.record(name, value, tags);
    }
  }
  
  /**
   * 开始计时
   */
  startTimer(name: string): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordMetric(`${name}_duration`, duration);
      return duration;
    };
  }
  
  /**
   * 获取性能报告
   */
  getPerformanceReport(): any {
    return {
      metrics: this.monitor.getMetrics(),
      averages: {
        cache_hit: this.monitor.getAverage("cache_hit"),
        cache_miss: this.monitor.getAverage("cache_miss"),
        memory_heap_used: this.monitor.getAverage("memory_heap_used"),
      },
    };
  }
  
  // ============ 内存管理 ============
  
  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): ResourceStats["memory"] {
    const used = process.memoryUsage();
    const usagePercent = (used.heapUsed / used.heapTotal) * 100;
    
    return {
      rss: Math.round(used.rss / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024),
      usagePercent: Math.round(usagePercent * 100) / 100,
    };
  }
  
  /**
   * 检查内存状态
   */
  checkMemoryStatus(): "ok" | "warning" | "critical" {
    const memory = this.getMemoryUsage();
    
    if (memory.heapUsed >= this.config.memoryCriticalThreshold) {
      this.logger.error("内存使用达到临界值", { memory });
      return "critical";
    }
    
    if (memory.heapUsed >= this.config.memoryWarningThreshold) {
      this.logger.warn("内存使用达到警告值", { memory });
      return "warning";
    }
    
    return "ok";
  }
  
  /**
   * 执行垃圾回收（如果可用）
   */
  forceGC(): boolean {
    if (global.gc) {
      global.gc();
      this.logger.info("手动 GC 已执行");
      return true;
    }
    return false;
  }
  
  // ============ 自动 GC ============
  
  private startAutoGC(): void {
    this.gcTimer = setInterval(() => {
      const status = this.checkMemoryStatus();
      
      if (status === "critical") {
        this.clearCache();
        this.forceGC();
        this.logger.warn("内存临界，已清理缓存");
      } else if (status === "warning") {
        // 清理过期缓存（通过 clear 实现）
        const stats = this.cache.getStats();
        if (stats.size > this.config.cacheMaxSize * 0.8) {
          this.cache.clear();
          this.logger.warn("缓存已清理（超过80%容量）");
        }
        this.forceGC();
      }
      
      // 记录内存指标
      const memory = this.getMemoryUsage();
      this.recordMetric("memory_heap_used", memory.heapUsed);
      this.recordMetric("memory_usage_percent", memory.usagePercent);
      
    }, this.config.gcInterval);
  }
  
  private stopAutoGC(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = undefined;
    }
  }
  
  // ============ 统计信息 ============
  
  /**
   * 获取资源统计
   */
  getStats(): ResourceStats {
    const cacheStats = this.cache.getStats();
    
    return {
      memory: this.getMemoryUsage(),
      cache: {
        size: cacheStats.size,
        maxSize: this.config.cacheMaxSize,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
      },
      uptime: Math.round((Date.now() - this.startTime) / 1000),
    };
  }
  
  /**
   * 打印资源报告
   */
  printReport(): void {
    const stats = this.getStats();
    
    console.log("\n=== 资源管理报告 ===");
    console.log(`\n【内存】`);
    console.log(`  RSS: ${stats.memory.rss} MB`);
    console.log(`  Heap: ${stats.memory.heapUsed}/${stats.memory.heapTotal} MB (${stats.memory.usagePercent}%)`);
    console.log(`  External: ${stats.memory.external} MB`);
    
    console.log(`\n【缓存】`);
    console.log(`  大小: ${stats.cache.size}/${stats.cache.maxSize}`);
    console.log(`  命中率: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
    console.log(`  命中: ${stats.cache.hits}, 未命中: ${stats.cache.misses}`);
    
    console.log(`\n【运行时间】`);
    console.log(`  ${stats.uptime} 秒`);
    
    const memStatus = this.checkMemoryStatus();
    console.log(`\n【状态】`);
    console.log(`  内存: ${memStatus === "ok" ? "✅ 正常" : memStatus === "warning" ? "⚠️ 警告" : "🔴 临界"}`);
  }
}

// ============================================================
// 导出便捷函数
// ============================================================

export function getResourceManager(): ResourceManager {
  return ResourceManager.getInstance();
}

export function getCached<T>(key: string): T | null {
  return getResourceManager().getCached<T>(key);
}

export function setCache(key: string, value: any, ttl?: number): void {
  getResourceManager().setCache(key, value, ttl);
}

export async function cacheOrCompute<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
  return getResourceManager().getOrSet(key, factory, ttl);
}
