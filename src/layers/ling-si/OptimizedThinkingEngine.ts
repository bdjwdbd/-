/**
 * 优化版思考协议引擎
 * 
 * 集成缓存、压缩和性能监控
 */

import {
  ThinkingResult,
  ThinkingContext,
  ThinkingDepth,
  ThinkingConfig,
  DEFAULT_THINKING_CONFIG,
  HumanMessage,
} from "./types";

import { ThinkingProtocolEngine } from "./ThinkingProtocolEngine";
import {
  ThinkingCompressor,
  ThinkingCache,
  ThinkingPerformanceMonitor,
  thinkingCompressor,
  thinkingCache,
  thinkingPerformanceMonitor,
} from "./ThinkingOptimization";

/**
 * 优化版思考配置
 */
export interface OptimizedThinkingConfig extends ThinkingConfig {
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 是否启用压缩 */
  enableCompression: boolean;
  /** 是否启用性能监控 */
  enableMonitoring: boolean;
  /** 缓存 TTL (ms) */
  cacheTTL: number;
  /** 压缩目标 token */
  compressionTarget: number;
}

/**
 * 默认优化配置
 */
const DEFAULT_OPTIMIZED_CONFIG: OptimizedThinkingConfig = {
  ...DEFAULT_THINKING_CONFIG,
  enableCache: true,
  enableCompression: true,
  enableMonitoring: true,
  cacheTTL: 3600000, // 1 hour
  compressionTarget: 500,
};

/**
 * 优化版思考协议引擎
 */
export class OptimizedThinkingProtocolEngine extends ThinkingProtocolEngine {
  private cache: ThinkingCache;
  private compressor: ThinkingCompressor;
  private monitor: ThinkingPerformanceMonitor;
  private optimizedConfig: OptimizedThinkingConfig;

  constructor(config?: Partial<OptimizedThinkingConfig>) {
    super(config);
    this.optimizedConfig = { ...DEFAULT_OPTIMIZED_CONFIG, ...config };
    this.cache = thinkingCache;
    this.compressor = thinkingCompressor;
    this.monitor = thinkingPerformanceMonitor;
  }

  /**
   * 执行思考协议（带优化）
   */
  async execute(message: HumanMessage): Promise<ThinkingResult> {
    // 1. 检查缓存
    if (this.optimizedConfig.enableCache) {
      const cached = this.cache.get(message.content);
      if (cached) {
        this.monitor.recordCacheHit();
        return cached;
      }
      this.monitor.recordCacheMiss();
    }

    // 2. 执行原始思考
    let result = await super.execute(message);

    // 3. 压缩（如果需要）
    if (this.optimizedConfig.enableCompression) {
      const originalTokens = result.tokensUsed;
      result = this.compressor.compress(result);
      
      if (result.tokensUsed < originalTokens) {
        const ratio = result.tokensUsed / originalTokens;
        this.monitor.recordCompression(ratio);
      }
    }

    // 4. 记录性能
    if (this.optimizedConfig.enableMonitoring) {
      this.monitor.record(result);
    }

    // 5. 缓存结果
    if (this.optimizedConfig.enableCache) {
      this.cache.set(message.content, result);
    }

    return result;
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return this.monitor.getMetrics();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 重置性能监控
   */
  resetMonitor(): void {
    this.monitor.reset();
  }

  /**
   * 更新优化配置
   */
  updateOptimizedConfig(config: Partial<OptimizedThinkingConfig>): void {
    this.optimizedConfig = { ...this.optimizedConfig, ...config };
    super.updateConfig(config);
  }
}

// 导出单例
export const optimizedThinkingEngine = new OptimizedThinkingProtocolEngine();
