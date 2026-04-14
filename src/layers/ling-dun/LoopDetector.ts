/**
 * 灵盾层 - 循环检测器
 * 
 * 功能：检测并中断工具调用的无限循环
 * 
 * 核心原理：
 * 1. 维护最近 N 次工具调用的指纹
 * 2. 检测相同指纹的重复出现
 * 3. 超过阈值时触发中断机制
 * 
 * @author 元灵系统
 * @version 1.0.0
 */

export interface ToolCallFingerprint {
  toolName: string;
  argumentsHash: string;
  timestamp: number;
  messageId: string;
}

export interface LoopDetectionResult {
  isLoop: boolean;
  loopCount: number;
  loopPattern?: {
    toolName: string;
    argumentsHash: string;
    firstOccurrence: number;
    lastOccurrence: number;
  };
  shouldInterrupt: boolean;
  reason: string;
}

export interface LoopDetectorConfig {
  /** 最大历史记录数 */
  maxHistorySize: number;
  /** 触发中断的重复次数阈值 */
  interruptThreshold: number;
  /** 警告阈值 */
  warningThreshold: number;
  /** 时间窗口（毫秒），超过此时间的记录会被清理 */
  timeWindowMs: number;
  /** 是否启用自动中断 */
  enableAutoInterrupt: boolean;
  /** 相同工具连续调用最大次数 */
  maxConsecutiveCalls: number;
}

const DEFAULT_CONFIG: LoopDetectorConfig = {
  maxHistorySize: 100,
  interruptThreshold: 3,
  warningThreshold: 2,
  timeWindowMs: 60000, // 1 分钟
  enableAutoInterrupt: true,
  maxConsecutiveCalls: 5,
};

/**
 * 循环检测器
 */
export class LoopDetector {
  private history: ToolCallFingerprint[] = [];
  private config: LoopDetectorConfig;
  private consecutiveCallCount: Map<string, number> = new Map();

  constructor(config: Partial<LoopDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成参数的哈希值
   */
  private hashArguments(args: Record<string, unknown>): string {
    try {
      const sorted = JSON.stringify(args, Object.keys(args).sort());
      return this.simpleHash(sorted);
    } catch {
      return 'unhashable';
    }
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * 清理过期记录
   */
  private cleanupExpired(): void {
    const now = Date.now();
    this.history = this.history.filter(
      (f) => now - f.timestamp < this.config.timeWindowMs
    );
  }

  /**
   * 记录工具调用
   */
  recordCall(
    toolName: string,
    args: Record<string, unknown>,
    messageId: string
  ): LoopDetectionResult {
    this.cleanupExpired();

    const fingerprint: ToolCallFingerprint = {
      toolName,
      argumentsHash: this.hashArguments(args),
      timestamp: Date.now(),
      messageId,
    };

    // 检测完全相同的调用
    const sameCalls = this.history.filter(
      (f) => f.toolName === toolName && f.argumentsHash === fingerprint.argumentsHash
    );

    // 检测连续相同工具调用
    const recentCalls = this.history
      .filter((f) => f.toolName === toolName)
      .slice(-this.config.maxConsecutiveCalls);

    // 更新连续调用计数
    const lastCall = this.history[this.history.length - 1];
    if (lastCall?.toolName === toolName) {
      const count = (this.consecutiveCallCount.get(toolName) || 0) + 1;
      this.consecutiveCallCount.set(toolName, count);
    } else {
      this.consecutiveCallCount.set(toolName, 1);
    }

    // 添加到历史
    this.history.push(fingerprint);

    // 限制历史大小
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }

    // 判断是否为循环
    const loopCount = sameCalls.length + 1;
    const consecutiveCount = this.consecutiveCallCount.get(toolName) || 1;

    // 检测条件
    const isExactLoop = loopCount >= this.config.warningThreshold;
    const isConsecutiveLoop = consecutiveCount >= this.config.maxConsecutiveCalls;
    const shouldInterrupt = 
      (loopCount >= this.config.interruptThreshold || isConsecutiveLoop) && 
      this.config.enableAutoInterrupt;

    let reason = '';
    if (isExactLoop) {
      reason = `检测到工具 "${toolName}" 被重复调用 ${loopCount} 次（相同参数）`;
    } else if (isConsecutiveLoop) {
      reason = `检测到工具 "${toolName}" 被连续调用 ${consecutiveCount} 次`;
    }

    return {
      isLoop: isExactLoop || isConsecutiveLoop,
      loopCount: isExactLoop ? loopCount : consecutiveCount,
      loopPattern: isExactLoop
        ? {
            toolName,
            argumentsHash: fingerprint.argumentsHash,
            firstOccurrence: sameCalls[0]?.timestamp || fingerprint.timestamp,
            lastOccurrence: fingerprint.timestamp,
          }
        : undefined,
      shouldInterrupt,
      reason,
    };
  }

  /**
   * 重置连续调用计数
   */
  resetConsecutiveCount(toolName?: string): void {
    if (toolName) {
      this.consecutiveCallCount.delete(toolName);
    } else {
      this.consecutiveCallCount.clear();
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    historySize: number;
    topTools: Array<{ toolName: string; count: number }>;
    recentLoops: LoopDetectionResult[];
  } {
    const toolCounts = new Map<string, number>();
    for (const f of this.history) {
      toolCounts.set(f.toolName, (toolCounts.get(f.toolName) || 0) + 1);
    }

    const topTools = Array.from(toolCounts.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      historySize: this.history.length,
      topTools,
      recentLoops: [], // 可以扩展为返回最近的循环检测结果
    };
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.history = [];
    this.consecutiveCallCount.clear();
  }
}

// 单例实例
let globalLoopDetector: LoopDetector | null = null;

/**
 * 获取全局循环检测器
 */
export function getLoopDetector(config?: Partial<LoopDetectorConfig>): LoopDetector {
  if (!globalLoopDetector) {
    globalLoopDetector = new LoopDetector(config);
  }
  return globalLoopDetector;
}

/**
 * 重置全局循环检测器
 */
export function resetLoopDetector(): void {
  globalLoopDetector = null;
}
