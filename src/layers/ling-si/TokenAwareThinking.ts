/**
 * Token 感知思考控制器
 * 
 * 与 TokenEstimator 深度集成，动态调整思考深度
 * 基于 token 预算优化思考过程
 */

import {
  ThinkingDepth,
  ThinkingResult,
  ThinkingConfig,
  HumanMessage,
} from "./types";

import { TokenEstimator } from "../../core/infrastructure";

/**
 * Token 预算配置
 */
export interface TokenBudgetConfig {
  /** 最大 token 预算 */
  maxTokens: number;
  /** 思考 token 占比 */
  thinkingRatio: number;
  /** 响应 token 占比 */
  responseRatio: number;
  /** 缓冲 token 占比 */
  bufferRatio: number;
  /** 上下文使用阈值 */
  contextThreshold: number;
  /** 是否启用动态调整 */
  enableDynamicAdjustment: boolean;
}

/**
 * 默认 Token 预算配置
 */
const DEFAULT_TOKEN_BUDGET_CONFIG: TokenBudgetConfig = {
  maxTokens: 4096,
  thinkingRatio: 0.3,  // 30% 用于思考
  responseRatio: 0.6,  // 60% 用于响应
  bufferRatio: 0.1,    // 10% 缓冲
  contextThreshold: 0.55,
  enableDynamicAdjustment: true,
};

/**
 * Token 预算分配结果
 */
export interface TokenBudgetAllocation {
  /** 总预算 */
  total: number;
  /** 思考预算 */
  thinking: number;
  /** 响应预算 */
  response: number;
  /** 缓冲预算 */
  buffer: number;
  /** 当前上下文使用率 */
  contextUsage: number;
  /** 是否需要压缩 */
  needsCompression: boolean;
  /** 推荐的思考深度 */
  recommendedDepth: ThinkingDepth;
}

/**
 * 深度-Token 映射
 */
const DEPTH_TOKEN_MAP: Record<ThinkingDepth, { min: number; max: number }> = {
  [ThinkingDepth.MINIMAL]: { min: 50, max: 150 },
  [ThinkingDepth.STANDARD]: { min: 150, max: 400 },
  [ThinkingDepth.EXTENSIVE]: { min: 400, max: 1000 },
  [ThinkingDepth.DEEP]: { min: 1000, max: 2000 },
};

/**
 * Token 感知思考控制器
 */
export class TokenAwareThinkingController {
  private tokenEstimator: TokenEstimator;
  private config: TokenBudgetConfig;
  private currentContextTokens: number = 0;
  private history: TokenBudgetAllocation[] = [];

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = { ...DEFAULT_TOKEN_BUDGET_CONFIG, ...config };
    this.tokenEstimator = new TokenEstimator();
  }

  /**
   * 分析并分配 token 预算
   */
  analyzeBudget(
    message: HumanMessage,
    contextTokens: number = 0
  ): TokenBudgetAllocation {
    // 1. 计算消息 token
    const messageTokens = this.tokenEstimator.estimate(message.content);

    // 2. 更新上下文 token
    this.currentContextTokens = contextTokens + messageTokens;

    // 3. 计算可用预算
    const availableTokens = this.config.maxTokens - this.currentContextTokens;

    // 4. 分配预算
    const thinking = Math.floor(availableTokens * this.config.thinkingRatio);
    const response = Math.floor(availableTokens * this.config.responseRatio);
    const buffer = Math.floor(availableTokens * this.config.bufferRatio);

    // 5. 计算上下文使用率
    const contextUsage = this.currentContextTokens / this.config.maxTokens;

    // 6. 判断是否需要压缩
    const needsCompression = contextUsage > this.config.contextThreshold;

    // 7. 推荐思考深度
    const recommendedDepth = this.recommendDepth(thinking, message);

    const allocation: TokenBudgetAllocation = {
      total: availableTokens,
      thinking,
      response,
      buffer,
      contextUsage,
      needsCompression,
      recommendedDepth,
    };

    // 8. 记录历史
    this.history.push(allocation);

    return allocation;
  }

  /**
   * 推荐思考深度
   */
  private recommendDepth(
    thinkingBudget: number,
    message: HumanMessage
  ): ThinkingDepth {
    // 基于预算确定基础深度
    let depth: ThinkingDepth;

    if (thinkingBudget < DEPTH_TOKEN_MAP[ThinkingDepth.MINIMAL].max) {
      depth = ThinkingDepth.MINIMAL;
    } else if (thinkingBudget < DEPTH_TOKEN_MAP[ThinkingDepth.STANDARD].max) {
      depth = ThinkingDepth.STANDARD;
    } else if (thinkingBudget < DEPTH_TOKEN_MAP[ThinkingDepth.EXTENSIVE].max) {
      depth = ThinkingDepth.EXTENSIVE;
    } else {
      depth = ThinkingDepth.DEEP;
    }

    // 动态调整
    if (this.config.enableDynamicAdjustment) {
      depth = this.adjustDepthBasedOnContext(depth, message);
    }

    return depth;
  }

  /**
   * 基于上下文调整深度
   */
  private adjustDepthBasedOnContext(
    baseDepth: ThinkingDepth,
    message: HumanMessage
  ): ThinkingDepth {
    const content = message.content.toLowerCase();

    // 紧急情况降低深度
    if (content.includes("紧急") || content.includes("urgent")) {
      return this.decreaseDepth(baseDepth);
    }

    // 复杂问题提高深度（如果预算允许）
    if (
      content.includes("分析") ||
      content.includes("设计") ||
      content.includes("架构")
    ) {
      const currentBudget = this.history.length > 0
        ? this.history[this.history.length - 1].thinking
        : 500;

      if (currentBudget >= DEPTH_TOKEN_MAP[this.increaseDepth(baseDepth)].min) {
        return this.increaseDepth(baseDepth);
      }
    }

    return baseDepth;
  }

  /**
   * 提高深度
   */
  private increaseDepth(depth: ThinkingDepth): ThinkingDepth {
    const order = [
      ThinkingDepth.MINIMAL,
      ThinkingDepth.STANDARD,
      ThinkingDepth.EXTENSIVE,
      ThinkingDepth.DEEP,
    ];
    const index = order.indexOf(depth);
    return index < order.length - 1 ? order[index + 1] : depth;
  }

  /**
   * 降低深度
   */
  private decreaseDepth(depth: ThinkingDepth): ThinkingDepth {
    const order = [
      ThinkingDepth.MINIMAL,
      ThinkingDepth.STANDARD,
      ThinkingDepth.EXTENSIVE,
      ThinkingDepth.DEEP,
    ];
    const index = order.indexOf(depth);
    return index > 0 ? order[index - 1] : depth;
  }

  /**
   * 计算压缩目标
   */
  calculateCompressionTarget(
    result: ThinkingResult,
    allocation: TokenBudgetAllocation
  ): number {
    const currentTokens = result.tokensUsed;
    const targetTokens = allocation.thinking;

    // 如果已经在预算内，不需要压缩
    if (currentTokens <= targetTokens) {
      return currentTokens;
    }

    // 计算压缩比例
    const compressionRatio = targetTokens / currentTokens;

    // 根据压缩比例选择压缩级别
    if (compressionRatio > 0.7) {
      return Math.floor(currentTokens * 0.7); // 轻度压缩
    } else if (compressionRatio > 0.4) {
      return Math.floor(currentTokens * 0.5); // 中度压缩
    } else {
      return Math.floor(currentTokens * 0.3); // 激进压缩
    }
  }

  /**
   * 检查是否应该重置上下文
   */
  shouldResetContext(): boolean {
    return this.currentContextTokens / this.config.maxTokens > this.config.contextThreshold;
  }

  /**
   * 获取上下文使用率
   */
  getContextUsage(): number {
    return this.currentContextTokens / this.config.maxTokens;
  }

  /**
   * 重置上下文
   */
  resetContext(): void {
    this.currentContextTokens = 0;
  }

  /**
   * 更新上下文 token
   */
  updateContextTokens(tokens: number): void {
    this.currentContextTokens = tokens;
  }

  /**
   * 获取历史分配
   */
  getHistory(): TokenBudgetAllocation[] {
    return [...this.history];
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    avgThinkingBudget: number;
    avgContextUsage: number;
    compressionRate: number;
    depthDistribution: Record<ThinkingDepth, number>;
  } {
    if (this.history.length === 0) {
      return {
        avgThinkingBudget: 0,
        avgContextUsage: 0,
        compressionRate: 0,
        depthDistribution: {
          [ThinkingDepth.MINIMAL]: 0,
          [ThinkingDepth.STANDARD]: 0,
          [ThinkingDepth.EXTENSIVE]: 0,
          [ThinkingDepth.DEEP]: 0,
        },
      };
    }

    const avgThinkingBudget =
      this.history.reduce((sum, a) => sum + a.thinking, 0) / this.history.length;

    const avgContextUsage =
      this.history.reduce((sum, a) => sum + a.contextUsage, 0) / this.history.length;

    const compressionRate =
      this.history.filter((a) => a.needsCompression).length / this.history.length;

    const depthDistribution: Record<ThinkingDepth, number> = {
      [ThinkingDepth.MINIMAL]: 0,
      [ThinkingDepth.STANDARD]: 0,
      [ThinkingDepth.EXTENSIVE]: 0,
      [ThinkingDepth.DEEP]: 0,
    };

    for (const allocation of this.history) {
      depthDistribution[allocation.recommendedDepth]++;
    }

    return {
      avgThinkingBudget,
      avgContextUsage,
      compressionRate,
      depthDistribution,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TokenBudgetConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): TokenBudgetConfig {
    return { ...this.config };
  }
}

// ============================================================
// Token 感知思考引擎
// ============================================================

import { OptimizedThinkingProtocolEngine } from "./OptimizedThinkingEngine";

/**
 * Token 感知思考引擎配置
 */
export interface TokenAwareThinkingConfig extends ThinkingConfig {
  /** Token 预算配置 */
  tokenBudget: Partial<TokenBudgetConfig>;
  /** 是否启用自动压缩 */
  autoCompress: boolean;
  /** 是否启用上下文重置警告 */
  warnOnContextReset: boolean;
}

/**
 * 默认 Token 感知思考配置
 */
const DEFAULT_TOKEN_AWARE_CONFIG: TokenAwareThinkingConfig = {
  visible: false,
  format: "hidden",
  maxThinkingTokens: 1500,
  enableMultiHypothesis: true,
  maxHypotheses: 5,
  enableRecursiveThinking: true,
  maxRecursionDepth: 3,
  enableSelfVerification: true,
  timeout: 30000,
  tokenBudget: DEFAULT_TOKEN_BUDGET_CONFIG,
  autoCompress: true,
  warnOnContextReset: true,
};

/**
 * Token 感知思考引擎
 */
export class TokenAwareThinkingEngine extends OptimizedThinkingProtocolEngine {
  private tokenController: TokenAwareThinkingController;
  private tokenAwareConfig: TokenAwareThinkingConfig;

  constructor(config?: Partial<TokenAwareThinkingConfig>) {
    super(config);

    this.tokenAwareConfig = {
      ...DEFAULT_TOKEN_AWARE_CONFIG,
      ...config,
      tokenBudget: {
        ...DEFAULT_TOKEN_BUDGET_CONFIG,
        ...(config?.tokenBudget || {}),
      },
      autoCompress: true,
      warnOnContextReset: true,
    };

    this.tokenController = new TokenAwareThinkingController(
      this.tokenAwareConfig.tokenBudget
    );
  }

  /**
   * 执行思考（Token 感知）
   */
  async executeWithTokenAwareness(
    message: HumanMessage,
    contextTokens: number = 0
  ): Promise<{
    result: ThinkingResult;
    allocation: TokenBudgetAllocation;
    wasCompressed: boolean;
  }> {
    // 1. 分析 token 预算
    const allocation = this.tokenController.analyzeBudget(message, contextTokens);

    // 2. 检查是否需要上下文重置
    if (this.tokenController.shouldResetContext()) {
      if (this.tokenAwareConfig.warnOnContextReset) {
        console.warn(
          `[TokenAware] Context usage at ${(allocation.contextUsage * 100).toFixed(1)}%, ` +
          `consider resetting context`
        );
      }
    }

    // 3. 执行思考
    let result = await this.execute(message);

    // 4. 检查是否需要压缩
    let wasCompressed = false;

    if (
      this.tokenAwareConfig.autoCompress &&
      result.tokensUsed > allocation.thinking
    ) {
      const targetTokens = this.tokenController.calculateCompressionTarget(
        result,
        allocation
      );

      // 使用压缩器
      const { thinkingCompressor } = await import("./ThinkingOptimization");
      thinkingCompressor.updateConfig({ targetTokens });
      result = thinkingCompressor.compress(result);
      wasCompressed = true;
    }

    return {
      result,
      allocation,
      wasCompressed,
    };
  }

  /**
   * 获取 Token 控制器
   */
  getTokenController(): TokenAwareThinkingController {
    return this.tokenController;
  }

  /**
   * 获取 Token 统计
   */
  getTokenStats() {
    return this.tokenController.getStats();
  }

  /**
   * 检查是否应该重置上下文
   */
  shouldResetContext(): boolean {
    return this.tokenController.shouldResetContext();
  }

  /**
   * 重置上下文
   */
  resetContext(): void {
    this.tokenController.resetContext();
    this.clearCache();
  }
}

// 导出单例
export const tokenAwareThinkingEngine = new TokenAwareThinkingEngine();
