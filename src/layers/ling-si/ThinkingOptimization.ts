/**
 * 思考压缩器
 * 
 * 在 token 预算有限时压缩思考内容
 * 保留关键洞察，删除冗余内容
 */

import {
  ThinkingResult,
  ThinkingStepResult,
  ThinkingStepName,
} from "./types";

/**
 * 压缩配置
 */
export interface CompressionConfig {
  /** 目标 token 数 */
  targetTokens: number;
  /** 是否保留洞察 */
  keepInsights: boolean;
  /** 是否保留假设 */
  keepHypotheses: boolean;
  /** 是否保留关键步骤 */
  keepKeySteps: boolean;
  /** 压缩级别 */
  level: "light" | "medium" | "aggressive";
}

/**
 * 默认压缩配置
 */
const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  targetTokens: 500,
  keepInsights: true,
  keepHypotheses: true,
  keepKeySteps: true,
  level: "medium",
};

/**
 * 关键步骤（优先保留）
 */
const KEY_STEPS: ThinkingStepName[] = [
  ThinkingStepName.INITIAL_ENGAGEMENT,
  ThinkingStepName.KNOWLEDGE_SYNTHESIS,
  ThinkingStepName.PROGRESS_TRACKING,
];

/**
 * 思考压缩器
 */
export class ThinkingCompressor {
  private config: CompressionConfig;

  constructor(config?: Partial<CompressionConfig>) {
    this.config = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
  }

  /**
   * 压缩思考结果
   */
  compress(result: ThinkingResult): ThinkingResult {
    // 估算当前 token 数
    const currentTokens = this.estimateTokens(result);

    // 如果已经在预算内，不压缩
    if (currentTokens <= this.config.targetTokens) {
      return result;
    }

    // 计算压缩比例
    const compressionRatio = this.config.targetTokens / currentTokens;

    // 根据压缩级别选择策略
    let compressed: ThinkingResult;

    switch (this.config.level) {
      case "light":
        compressed = this.lightCompress(result, compressionRatio);
        break;
      case "medium":
        compressed = this.mediumCompress(result, compressionRatio);
        break;
      case "aggressive":
        compressed = this.aggressiveCompress(result, compressionRatio);
        break;
      default:
        compressed = this.mediumCompress(result, compressionRatio);
    }

    // 更新 token 使用
    compressed.tokensUsed = this.estimateTokens(compressed);

    return compressed;
  }

  /**
   * 轻度压缩
   * - 删除过渡语句
   * - 合并相似思考
   */
  private lightCompress(
    result: ThinkingResult,
    ratio: number
  ): ThinkingResult {
    const compressedSteps = result.stepResults.map((step) =>
      this.compressStepLight(step, ratio)
    );

    return {
      ...result,
      content: this.synthesizeCompressedContent(compressedSteps),
      stepResults: compressedSteps,
    };
  }

  /**
   * 中度压缩
   * - 轻度压缩 +
   * - 删除非关键步骤
   * - 压缩假设描述
   */
  private mediumCompress(
    result: ThinkingResult,
    ratio: number
  ): ThinkingResult {
    // 保留关键步骤
    const compressedSteps = this.config.keepKeySteps
      ? result.stepResults.filter((step) =>
          KEY_STEPS.includes(step.stepName)
        )
      : result.stepResults;

    // 压缩每个步骤
    const processedSteps = compressedSteps.map((step) =>
      this.compressStepMedium(step, ratio)
    );

    // 压缩假设
    const compressedHypotheses = this.config.keepHypotheses
      ? this.compressHypotheses(result.hypotheses, ratio)
      : [];

    return {
      ...result,
      content: this.synthesizeCompressedContent(processedSteps),
      stepResults: processedSteps,
      hypotheses: compressedHypotheses,
    };
  }

  /**
   * 激进压缩
   * - 中度压缩 +
   * - 只保留洞察和最终结论
   */
  private aggressiveCompress(
    result: ThinkingResult,
    _ratio: number
  ): ThinkingResult {
    // 只保留洞察
    const insights = this.config.keepInsights ? result.insights : [];

    // 创建最小化的步骤结果
    const minimalStep: ThinkingStepResult = {
      stepName: ThinkingStepName.KNOWLEDGE_SYNTHESIS,
      thoughts: insights.length > 0 ? insights : ["Analysis completed"],
      completed: true,
    };

    return {
      ...result,
      content: insights.join("\n"),
      stepResults: [minimalStep],
      hypotheses: [],
      insights,
    };
  }

  /**
   * 轻度压缩步骤
   */
  private compressStepLight(
    step: ThinkingStepResult,
    ratio: number
  ): ThinkingStepResult {
    // 删除过渡语句
    const filteredThoughts = step.thoughts.filter(
      (t) => !this.isTransitionPhrase(t)
    );

    // 根据比例选择保留的思考
    const keepCount = Math.max(
      1,
      Math.floor(filteredThoughts.length * ratio)
    );
    const keptThoughts = filteredThoughts.slice(0, keepCount);

    return {
      ...step,
      thoughts: keptThoughts,
    };
  }

  /**
   * 中度压缩步骤
   */
  private compressStepMedium(
    step: ThinkingStepResult,
    ratio: number
  ): ThinkingStepResult {
    // 合并相似思考
    const mergedThoughts = this.mergeSimilarThoughts(step.thoughts);

    // 根据比例选择保留的思考
    const keepCount = Math.max(
      1,
      Math.floor(mergedThoughts.length * ratio * 0.7)
    );
    const keptThoughts = mergedThoughts.slice(0, keepCount);

    return {
      ...step,
      thoughts: keptThoughts,
    };
  }

  /**
   * 压缩假设
   */
  private compressHypotheses(
    hypotheses: ThinkingResult["hypotheses"],
    ratio: number
  ): ThinkingResult["hypotheses"] {
    // 按置信度排序
    const sorted = [...hypotheses].sort((a, b) => b.confidence - a.confidence);

    // 保留前 N 个
    const keepCount = Math.max(1, Math.floor(sorted.length * ratio * 0.5));

    return sorted.slice(0, keepCount).map((h) => ({
      ...h,
      // 压缩内容
      content: h.content.length > 100 
        ? h.content.substring(0, 100) + "..." 
        : h.content,
    }));
  }

  /**
   * 检查是否为过渡语句
   */
  private isTransitionPhrase(thought: string): boolean {
    const transitions = [
      "Hmm", "Actually", "Wait", "But", "Now", "This",
      "Let me", "I notice", "I wonder", "On second thought",
      "Looking at", "Speaking of", "That reminds me",
    ];

    return transitions.some((t) => thought.startsWith(t));
  }

  /**
   * 合并相似思考
   */
  private mergeSimilarThoughts(thoughts: string[]): string[] {
    if (thoughts.length <= 2) return thoughts;

    const merged: string[] = [];
    let current = thoughts[0];

    for (let i = 1; i < thoughts.length; i++) {
      const next = thoughts[i];

      // 如果当前和下一个相似，合并
      if (this.areSimilar(current, next)) {
        current = this.mergeTwo(current, next);
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * 检查两个思考是否相似
   */
  private areSimilar(a: string, b: string): boolean {
    // 简单的关键词重叠检查
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word) && word.length > 3) {
        overlap++;
      }
    }

    return overlap > 2;
  }

  /**
   * 合并两个思考
   */
  private mergeTwo(a: string, b: string): string {
    // 取较长的那个
    return a.length > b.length ? a : b;
  }

  /**
   * 合成压缩后的内容
   */
  private synthesizeCompressedContent(steps: ThinkingStepResult[]): string {
    const lines: string[] = [];

    for (const step of steps) {
      lines.push(...step.thoughts);
    }

    return lines.join("\n");
  }

  /**
   * 估算 token 数
   */
  private estimateTokens(result: ThinkingResult): number {
    let tokens = 0;

    // 内容
    tokens += result.content.length / 4;

    // 步骤
    for (const step of result.stepResults) {
      tokens += step.thoughts.join(" ").length / 4;
    }

    // 假设
    for (const h of result.hypotheses) {
      tokens += h.content.length / 4;
      tokens += h.evidence.join(" ").length / 4;
    }

    // 洞察
    tokens += result.insights.join(" ").length / 4;

    return Math.floor(tokens);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取压缩统计
   */
  getCompressionStats(
    original: ThinkingResult,
    compressed: ThinkingResult
  ): {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    stepsRemoved: number;
    hypothesesRemoved: number;
  } {
    return {
      originalTokens: this.estimateTokens(original),
      compressedTokens: this.estimateTokens(compressed),
      compressionRatio:
        this.estimateTokens(compressed) / this.estimateTokens(original),
      stepsRemoved:
        original.stepResults.length - compressed.stepResults.length,
      hypothesesRemoved:
        original.hypotheses.length - compressed.hypotheses.length,
    };
  }
}

// ============================================================
// 思考缓存
// ============================================================

/**
 * 缓存条目
 */
interface CacheEntry {
  key: string;
  result: ThinkingResult;
  timestamp: number;
  hitCount: number;
}

/**
 * 思考缓存
 */
export class ThinkingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 100;
  private ttl: number = 3600000; // 1 hour

  /**
   * 获取缓存的思考结果
   */
  get(messageContent: string): ThinkingResult | null {
    const key = this.generateKey(messageContent);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // 更新命中计数
    entry.hitCount++;

    return entry.result;
  }

  /**
   * 设置缓存
   */
  set(messageContent: string, result: ThinkingResult): void {
    // 检查是否需要清理
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    const key = this.generateKey(messageContent);
    this.cache.set(key, {
      key,
      result,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * 生成缓存键
   */
  private generateKey(content: string): string {
    // 简单的哈希
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `think_${hash}`;
  }

  /**
   * 清理最少使用的条目
   */
  private evict(): void {
    // 找到最少使用的条目
    let minHit = Infinity;
    let minKey = "";

    for (const [key, entry] of this.cache) {
      if (entry.hitCount < minHit) {
        minHit = entry.hitCount;
        minKey = key;
      }
    }

    if (minKey) {
      this.cache.delete(minKey);
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }
}

// ============================================================
// 性能监控
// ============================================================

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 平均思考时间 */
  avgThinkingTime: number;
  /** 平均 token 使用 */
  avgTokensUsed: number;
  /** 缓存命中率 */
  cacheHitRate: number;
  /** 压缩率 */
  compressionRatio: number;
  /** 深度分布 */
  depthDistribution: Record<string, number>;
}

/**
 * 性能监控器
 */
export class ThinkingPerformanceMonitor {
  private metrics: {
    thinkingTimes: number[];
    tokensUsed: number[];
    cacheHits: number;
    cacheMisses: number;
    compressions: number[];
    depths: Record<string, number>;
  } = {
    thinkingTimes: [],
    tokensUsed: [],
    cacheHits: 0,
    cacheMisses: 0,
    compressions: [],
    depths: {
      minimal: 0,
      standard: 0,
      extensive: 0,
      deep: 0,
    },
  };

  /**
   * 记录思考结果
   */
  record(result: ThinkingResult): void {
    this.metrics.thinkingTimes.push(result.duration);
    this.metrics.tokensUsed.push(result.tokensUsed);
    this.metrics.depths[result.depth] = (this.metrics.depths[result.depth] || 0) + 1;
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  /**
   * 记录压缩
   */
  recordCompression(ratio: number): void {
    this.metrics.compressions.push(ratio);
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics {
    const avgThinkingTime =
      this.metrics.thinkingTimes.length > 0
        ? this.metrics.thinkingTimes.reduce((a, b) => a + b, 0) /
          this.metrics.thinkingTimes.length
        : 0;

    const avgTokensUsed =
      this.metrics.tokensUsed.length > 0
        ? this.metrics.tokensUsed.reduce((a, b) => a + b, 0) /
          this.metrics.tokensUsed.length
        : 0;

    const totalCacheAccess =
      this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate =
      totalCacheAccess > 0 ? this.metrics.cacheHits / totalCacheAccess : 0;

    const avgCompressionRatio =
      this.metrics.compressions.length > 0
        ? this.metrics.compressions.reduce((a, b) => a + b, 0) /
          this.metrics.compressions.length
        : 1;

    return {
      avgThinkingTime,
      avgTokensUsed,
      cacheHitRate,
      compressionRatio: avgCompressionRatio,
      depthDistribution: { ...this.metrics.depths },
    };
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics = {
      thinkingTimes: [],
      tokensUsed: [],
      cacheHits: 0,
      cacheMisses: 0,
      compressions: [],
      depths: {
        minimal: 0,
        standard: 0,
        extensive: 0,
        deep: 0,
      },
    };
  }
}

// ============================================================
// 导出单例
// ============================================================

export const thinkingCompressor = new ThinkingCompressor();
export const thinkingCache = new ThinkingCache();
export const thinkingPerformanceMonitor = new ThinkingPerformanceMonitor();
