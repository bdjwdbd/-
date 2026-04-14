/**
 * 上下文管理器
 * 
 * 智能管理上下文，包括：
 * - 上下文使用率监控
 * - 自动压缩和重置
 * - 重要信息保留
 * - 交接文档生成
 */

import {
  ThinkingResult,
  HumanMessage,
} from "./types";

import { TokenEstimator } from "../../core/infrastructure";

/**
 * 上下文状态
 */
export interface ContextState {
  /** 当前 token 数 */
  currentTokens: number;
  /** 最大 token 数 */
  maxTokens: number;
  /** 使用率 */
  usage: number;
  /** 消息数量 */
  messageCount: number;
  /** 思考结果数量 */
  thinkingCount: number;
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 上下文条目
 */
export interface ContextEntry {
  id: string;
  type: "message" | "thinking" | "system";
  content: string;
  tokens: number;
  importance: number; // 0-1
  timestamp: number;
  canCompress: boolean;
}

/**
 * 上下文管理配置
 */
export interface ContextManagerConfig {
  /** 最大 token 数 */
  maxTokens: number;
  /** 重置阈值 */
  resetThreshold: number;
  /** 警告阈值 */
  warningThreshold: number;
  /** 是否自动压缩 */
  autoCompress: boolean;
  /** 是否保留重要信息 */
  preserveImportant: boolean;
  /** 重要信息阈值 */
  importanceThreshold: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONTEXT_MANAGER_CONFIG: ContextManagerConfig = {
  maxTokens: 4096,
  resetThreshold: 0.8,
  warningThreshold: 0.6,
  autoCompress: true,
  preserveImportant: true,
  importanceThreshold: 0.7,
};

/**
 * 交接文档
 */
export interface HandoverDocument {
  /** 摘要 */
  summary: string;
  /** 关键洞察 */
  keyInsights: string[];
  /** 活跃假设 */
  activeHypotheses: string[];
  /** 未解决问题 */
  openQuestions: string[];
  /** 重要上下文 */
  importantContext: string[];
  /** 建议的下一步 */
  suggestedNextSteps: string[];
  /** 生成时间 */
  generatedAt: number;
}

/**
 * 上下文管理器
 */
export class ContextManager {
  private config: ContextManagerConfig;
  private tokenEstimator: TokenEstimator;
  private entries: ContextEntry[] = [];
  private currentTokens: number = 0;
  private resetCount: number = 0;
  private compressionCount: number = 0;

  constructor(config?: Partial<ContextManagerConfig>) {
    this.config = { ...DEFAULT_CONTEXT_MANAGER_CONFIG, ...config };
    this.tokenEstimator = new TokenEstimator();
  }

  /**
   * 添加消息
   */
  addMessage(message: HumanMessage): void {
    const tokens = this.tokenEstimator.estimate(message.content);

    const entry: ContextEntry = {
      id: message.id,
      type: "message",
      content: message.content,
      tokens,
      importance: this.assessImportance(message.content),
      timestamp: message.timestamp,
      canCompress: true,
    };

    this.entries.push(entry);
    this.currentTokens += tokens;

    this.checkThresholds();
  }

  /**
   * 添加思考结果
   */
  addThinking(result: ThinkingResult): void {
    const tokens = result.tokensUsed;

    const entry: ContextEntry = {
      id: result.id,
      type: "thinking",
      content: result.content,
      tokens,
      importance: this.assessThinkingImportance(result),
      timestamp: Date.now(),
      canCompress: true,
    };

    this.entries.push(entry);
    this.currentTokens += tokens;

    this.checkThresholds();
  }

  /**
   * 评估消息重要性
   */
  private assessImportance(content: string): number {
    let importance = 0.5;

    const contentLower = content.toLowerCase();

    // 关键决策
    if (contentLower.includes("决定") || contentLower.includes("选择")) {
      importance += 0.2;
    }

    // 重要信息
    if (contentLower.includes("重要") || contentLower.includes("关键")) {
      importance += 0.15;
    }

    // 用户偏好
    if (contentLower.includes("我喜欢") || contentLower.includes("我想要")) {
      importance += 0.1;
    }

    // 问题
    if (contentLower.includes("?") || contentLower.includes("？")) {
      importance += 0.05;
    }

    return Math.min(1, importance);
  }

  /**
   * 评估思考结果重要性
   */
  private assessThinkingImportance(result: ThinkingResult): number {
    let importance = 0.5;

    // 高置信度洞察
    if (result.confidence > 0.8) {
      importance += 0.2;
    }

    // 有洞察
    if (result.insights.length > 0) {
      importance += 0.1;
    }

    // 深度思考
    if (result.depth === "deep" || result.depth === "extensive") {
      importance += 0.1;
    }

    return Math.min(1, importance);
  }

  /**
   * 检查阈值
   */
  private checkThresholds(): void {
    const usage = this.currentTokens / this.config.maxTokens;

    if (usage >= this.config.resetThreshold) {
      this.handleResetThreshold();
    } else if (usage >= this.config.warningThreshold) {
      this.handleWarningThreshold();
    }
  }

  /**
   * 处理警告阈值
   */
  private handleWarningThreshold(): void {
    if (this.config.autoCompress) {
      this.compress();
    }
  }

  /**
   * 处理重置阈值
   */
  private handleResetThreshold(): void {
    // 先尝试压缩
    if (this.config.autoCompress) {
      this.compressAggressively();
    }

    // 如果还是超限，生成交接文档并重置
    if (this.currentTokens / this.config.maxTokens >= this.config.resetThreshold) {
      const handover = this.generateHandover();
      this.reset();
      // 保留交接文档
      this.addSystemContext(handover.summary, 0.9);
    }
  }

  /**
   * 压缩上下文
   */
  compress(): void {
    // 按重要性排序，保留重要的
    const sorted = [...this.entries].sort((a, b) => b.importance - a.importance);

    // 计算目标 token
    const targetTokens = Math.floor(this.config.maxTokens * this.config.warningThreshold * 0.9);

    // 选择保留的条目
    const kept: ContextEntry[] = [];
    let currentTokens = 0;

    for (const entry of sorted) {
      if (currentTokens + entry.tokens <= targetTokens) {
        kept.push(entry);
        currentTokens += entry.tokens;
      } else if (
        this.config.preserveImportant &&
        entry.importance >= this.config.importanceThreshold
      ) {
        // 压缩重要条目
        const compressed = this.compressEntry(entry);
        kept.push(compressed);
        currentTokens += compressed.tokens;
      }
    }

    // 按时间排序
    kept.sort((a, b) => a.timestamp - b.timestamp);

    this.entries = kept;
    this.currentTokens = currentTokens;
    this.compressionCount++;
  }

  /**
   * 激进压缩
   */
  compressAggressively(): void {
    // 只保留最重要的条目
    const important = this.entries.filter(
      (e) => e.importance >= this.config.importanceThreshold
    );

    // 计算目标 token
    const targetTokens = Math.floor(this.config.maxTokens * 0.3);

    const kept: ContextEntry[] = [];
    let currentTokens = 0;

    for (const entry of important) {
      const compressed = this.compressEntry(entry, 0.5);
      if (currentTokens + compressed.tokens <= targetTokens) {
        kept.push(compressed);
        currentTokens += compressed.tokens;
      }
    }

    this.entries = kept;
    this.currentTokens = currentTokens;
  }

  /**
   * 压缩单个条目
   */
  private compressEntry(entry: ContextEntry, ratio: number = 0.7): ContextEntry {
    const targetLength = Math.floor(entry.content.length * ratio);
    const compressedContent = entry.content.substring(0, targetLength) + "...";

    return {
      ...entry,
      content: compressedContent,
      tokens: this.tokenEstimator.estimate(compressedContent),
    };
  }

  /**
   * 重置上下文
   */
  reset(): void {
    this.entries = [];
    this.currentTokens = 0;
    this.resetCount++;
  }

  /**
   * 添加系统上下文
   */
  addSystemContext(content: string, importance: number = 0.5): void {
    const tokens = this.tokenEstimator.estimate(content);

    const entry: ContextEntry = {
      id: `sys_${Date.now()}`,
      type: "system",
      content,
      tokens,
      importance,
      timestamp: Date.now(),
      canCompress: false,
    };

    this.entries.push(entry);
    this.currentTokens += tokens;
  }

  /**
   * 生成交接文档
   */
  generateHandover(): HandoverDocument {
    // 提取关键洞察
    const keyInsights: string[] = [];
    const activeHypotheses: string[] = [];
    const openQuestions: string[] = [];
    const importantContext: string[] = [];

    for (const entry of this.entries) {
      if (entry.type === "thinking") {
        // 尝试解析思考结果
        if (entry.content.includes("insight") || entry.content.includes("洞察")) {
          keyInsights.push(entry.content.substring(0, 200));
        }
        if (entry.content.includes("hypothesis") || entry.content.includes("假设")) {
          activeHypotheses.push(entry.content.substring(0, 200));
        }
      }

      if (entry.importance >= this.config.importanceThreshold) {
        importantContext.push(entry.content.substring(0, 200));
      }
    }

    // 生成摘要
    const summary = this.generateSummary();

    // 建议下一步
    const suggestedNextSteps = this.suggestNextSteps();

    return {
      summary,
      keyInsights: keyInsights.slice(0, 5),
      activeHypotheses: activeHypotheses.slice(0, 3),
      openQuestions: openQuestions.slice(0, 3),
      importantContext: importantContext.slice(0, 5),
      suggestedNextSteps,
      generatedAt: Date.now(),
    };
  }

  /**
   * 生成摘要
   */
  private generateSummary(): string {
    const messageCount = this.entries.filter((e) => e.type === "message").length;
    const thinkingCount = this.entries.filter((e) => e.type === "thinking").length;

    return (
      `Context reset after ${messageCount} messages and ${thinkingCount} thinking cycles. ` +
      `Total resets: ${this.resetCount}. ` +
      `Last context usage: ${((this.currentTokens / this.config.maxTokens) * 100).toFixed(1)}%`
    );
  }

  /**
   * 建议下一步
   */
  private suggestNextSteps(): string[] {
    const suggestions: string[] = [];

    // 基于上下文提供建议
    if (this.entries.some((e) => e.content.includes("问题"))) {
      suggestions.push("Continue troubleshooting the identified problem");
    }

    if (this.entries.some((e) => e.content.includes("优化"))) {
      suggestions.push("Proceed with optimization implementation");
    }

    if (suggestions.length === 0) {
      suggestions.push("Continue with the current task");
    }

    return suggestions;
  }

  /**
   * 获取上下文状态
   */
  getState(): ContextState {
    return {
      currentTokens: this.currentTokens,
      maxTokens: this.config.maxTokens,
      usage: this.currentTokens / this.config.maxTokens,
      messageCount: this.entries.filter((e) => e.type === "message").length,
      thinkingCount: this.entries.filter((e) => e.type === "thinking").length,
      lastUpdated: Date.now(),
    };
  }

  /**
   * 获取所有条目
   */
  getEntries(): ContextEntry[] {
    return [...this.entries];
  }

  /**
   * 获取重要条目
   */
  getImportantEntries(): ContextEntry[] {
    return this.entries.filter(
      (e) => e.importance >= this.config.importanceThreshold
    );
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取统计
   */
  getStats(): {
    totalEntries: number;
    totalTokens: number;
    avgImportance: number;
    resetCount: number;
    compressionCount: number;
  } {
    return {
      totalEntries: this.entries.length,
      totalTokens: this.currentTokens,
      avgImportance:
        this.entries.length > 0
          ? this.entries.reduce((sum, e) => sum + e.importance, 0) /
            this.entries.length
          : 0,
      resetCount: this.resetCount,
      compressionCount: this.compressionCount,
    };
  }
}

// 导出单例
export const contextManager = new ContextManager();
