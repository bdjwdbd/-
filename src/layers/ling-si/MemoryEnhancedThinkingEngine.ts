/**
 * 记忆增强思考协议引擎
 * 
 * 在原有思考协议基础上，集成记忆召回功能
 * 增强上下文理解能力
 */

import {
  ThinkingDepth,
  ThinkingResult,
  ThinkingContext,
  ThinkingStepName,
  ThinkingStepResult,
  ThinkingConfig,
  DEFAULT_THINKING_CONFIG,
  HumanMessage,
  Hypothesis,
  ToolRecommendation,
} from "./types";

import { AdaptiveDepthController } from "./AdaptiveDepthController";
import { MultiHypothesisManager } from "./MultiHypothesisManager";
import {
  ThinkingStep,
  thinkingStepMap,
  allThinkingSteps,
} from "./ThinkingSteps";

// 导入记忆系统
import { SQLiteMemoryStore } from '../../infrastructure/sqlite-memory-store';
import { NativeHNSWIndex, createNativeHNSW } from '../../infrastructure/native-hnsw';

/**
 * 记忆增强配置
 */
export interface MemoryEnhancedConfig extends ThinkingConfig {
  enableMemoryRecall: boolean;
  memoryStorePath?: string;
  maxRecalledMemories: number;
  memoryWeight: number;
}

/**
 * 默认记忆增强配置
 */
const DEFAULT_MEMORY_CONFIG: MemoryEnhancedConfig = {
  ...DEFAULT_THINKING_CONFIG,
  enableMemoryRecall: true,
  maxRecalledMemories: 5,
  memoryWeight: 0.3,
};

/**
 * 记忆增强思考协议引擎
 */
export class MemoryEnhancedThinkingEngine {
  private depthController: AdaptiveDepthController;
  private hypothesisManager: MultiHypothesisManager;
  private config: MemoryEnhancedConfig;
  private thinkingHistory: ThinkingResult[] = [];
  
  // 记忆系统组件
  private memoryStore: SQLiteMemoryStore | null = null;
  private vectorIndex: NativeHNSWIndex | null = null;
  private initialized: boolean = false;

  constructor(config?: Partial<MemoryEnhancedConfig>) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.depthController = new AdaptiveDepthController();
    this.hypothesisManager = new MultiHypothesisManager();
  }

  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.enableMemoryRecall) {
      // 创建简单日志器
      const logger = {
        info: (...args: any[]) => {},
        debug: (...args: any[]) => {},
        warn: (...args: any[]) => {},
        error: (...args: any[]) => {},
      };

      // 初始化记忆存储
      this.memoryStore = new SQLiteMemoryStore(logger, {
        dataPath: this.config.memoryStorePath,
      });
      await this.memoryStore.initialize();

      // 初始化向量索引
      this.vectorIndex = createNativeHNSW({
        dimensions: 128,
        maxConnections: 16,
        efConstruction: 100,
        efSearch: 50,
      });
    }

    this.initialized = true;
  }

  /**
   * 执行思考协议（带记忆增强）
   */
  async execute(message: HumanMessage): Promise<ThinkingResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const thinkingId = this.generateThinkingId();

    // 1. 记忆召回（新增）
    const recalledMemories = await this.recallMemories(message.content);

    // 2. 评估思考深度
    const depthAssessment = this.depthController.assessDepth(message);
    const depth = depthAssessment.depth;

    // 3. 初始化思考上下文（包含召回的记忆）
    const context: ThinkingContext = {
      message,
      depth,
      completedSteps: [],
      hypotheses: [],
      establishedFacts: recalledMemories.map(m => m.content), // 注入记忆
      openQuestions: [],
      confidence: 0.5 + (recalledMemories.length > 0 ? 0.1 : 0), // 有记忆时置信度更高
      tokenBudget: depthAssessment.tokenBudget,
      tokensUsed: 0,
    };

    // 4. 根据深度选择步骤
    const steps = this.selectSteps(depth);

    // 5. 执行思考步骤
    const stepResults: ThinkingStepResult[] = [];
    for (const stepName of steps) {
      const step = thinkingStepMap.get(stepName);
      if (!step) continue;

      if (context.tokensUsed >= context.tokenBudget) {
        break;
      }

      const result = await step.execute(context);
      stepResults.push(result);

      context.completedSteps.push(stepName);
      context.tokensUsed += this.estimateStepTokens(result);

      if (result.hypotheses) {
        context.hypotheses.push(...result.hypotheses);
        result.hypotheses.forEach((h) => this.hypothesisManager.addHypothesis(
          h.content,
          h.sourceStep,
          h.confidence
        ));
      }

      if (result.confidenceDelta) {
        context.confidence = Math.max(0, Math.min(1, 
          context.confidence + result.confidenceDelta
        ));
      }

      if (result.issues) {
        context.openQuestions.push(...result.issues);
      }
    }

    // 6. 合成思考内容
    const content = this.synthesizeThinkingContent(stepResults, recalledMemories);

    // 7. 提取洞察
    const insights = this.extractInsights(stepResults);

    // 8. 确定是否需要工具调用
    const { requiresToolUse, recommendedTools } = this.analyzeToolNeeds(context);

    // 9. 确定是否需要澄清
    const { needsClarification, clarificationQuestions } = this.analyzeClarificationNeeds(context);

    // 10. 构建结果
    const result: ThinkingResult = {
      id: thinkingId,
      depth,
      content,
      stepResults,
      hypotheses: context.hypotheses,
      insights,
      confidence: context.confidence,
      requiresToolUse,
      recommendedTools,
      needsClarification,
      clarificationQuestions,
      tokensUsed: context.tokensUsed,
      duration: Date.now() - startTime,
    };

    // 11. 存储思考结果（新增）
    await this.storeThinkingResult(result);

    // 12. 记录历史
    this.thinkingHistory.push(result);

    return result;
  }

  /**
   * 召回相关记忆
   */
  private async recallMemories(query: string): Promise<Array<{ id: string; content: string; score: number }>> {
    if (!this.config.enableMemoryRecall || !this.memoryStore) {
      return [];
    }

    try {
      // 使用 FTS 搜索
      const results = await this.memoryStore.ftsSearch(query, {
        limit: this.config.maxRecalledMemories,
      });

      return results.map(r => ({
        id: r.id,
        content: r.content,
        score: r.score,
      }));
    } catch (e) {
      // 搜索失败时静默返回空
      return [];
    }
  }

  /**
   * 存储思考结果
   */
  private async storeThinkingResult(result: ThinkingResult): Promise<void> {
    if (!this.config.enableMemoryRecall || !this.memoryStore) {
      return;
    }

    try {
      // 将思考结果存储为记忆
      await this.memoryStore.add({
        content: result.content,
        type: 'insight',
        tags: ['thinking', result.depth],
        confidence: result.confidence,
        importance: result.confidence,
        source: 'thinking_engine',
      });
    } catch (e) {
      // 存储失败时静默忽略
    }
  }

  /**
   * 合成思考内容（包含记忆）
   */
  private synthesizeThinkingContent(
    stepResults: ThinkingStepResult[],
    recalledMemories: Array<{ id: string; content: string; score: number }>
  ): string {
    const lines: string[] = [];

    // 如果有召回的记忆，先添加
    if (recalledMemories.length > 0) {
      lines.push(`[记忆召回] 找到 ${recalledMemories.length} 条相关记忆:`);
      for (const memory of recalledMemories.slice(0, 3)) {
        lines.push(`  - ${memory.content.substring(0, 100)}...`);
      }
      lines.push("");
    }

    // 添加思考步骤结果
    for (const result of stepResults) {
      lines.push(...result.thoughts);
      lines.push("");
    }

    return lines.join("\n");
  }

  // ============ 以下方法与原 ThinkingProtocolEngine 相同 ============

  private selectSteps(depth: ThinkingDepth): ThinkingStepName[] {
    switch (depth) {
      case ThinkingDepth.MINIMAL:
        return [
          ThinkingStepName.INITIAL_ENGAGEMENT,
          ThinkingStepName.PROBLEM_ANALYSIS,
        ];

      case ThinkingDepth.STANDARD:
        return [
          ThinkingStepName.INITIAL_ENGAGEMENT,
          ThinkingStepName.PROBLEM_ANALYSIS,
          ThinkingStepName.MULTIPLE_HYPOTHESES,
          ThinkingStepName.KNOWLEDGE_SYNTHESIS,
        ];

      case ThinkingDepth.EXTENSIVE:
        return [
          ThinkingStepName.INITIAL_ENGAGEMENT,
          ThinkingStepName.PROBLEM_ANALYSIS,
          ThinkingStepName.MULTIPLE_HYPOTHESES,
          ThinkingStepName.NATURAL_DISCOVERY,
          ThinkingStepName.TESTING_VERIFICATION,
          ThinkingStepName.ERROR_CORRECTION,
          ThinkingStepName.KNOWLEDGE_SYNTHESIS,
          ThinkingStepName.PROGRESS_TRACKING,
        ];

      case ThinkingDepth.DEEP:
        return allThinkingSteps.map((s) => s.name);
    }
  }

  private extractInsights(stepResults: ThinkingStepResult[]): string[] {
    const insights: string[] = [];

    for (const result of stepResults) {
      if (result.issues) {
        insights.push(...result.issues);
      }
    }

    return [...new Set(insights)];
  }

  private analyzeToolNeeds(context: ThinkingContext): {
    requiresToolUse: boolean;
    recommendedTools?: ToolRecommendation[];
  } {
    const content = context.message.content.toLowerCase();
    const tools: ToolRecommendation[] = [];

    if (
      content.includes("搜索") ||
      content.includes("查找") ||
      content.includes("search") ||
      content.includes("find")
    ) {
      tools.push({
        toolName: "web_search",
        parameters: { query: context.message.content },
        reason: "User is asking to search for information",
        priority: 1,
      });
    }

    if (
      content.includes("读取") ||
      content.includes("查看") ||
      content.includes("read") ||
      content.includes("file")
    ) {
      tools.push({
        toolName: "read_file",
        parameters: {},
        reason: "User wants to read a file",
        priority: 2,
      });
    }

    if (
      content.includes("执行") ||
      content.includes("运行") ||
      content.includes("execute") ||
      content.includes("run")
    ) {
      tools.push({
        toolName: "execute_command",
        parameters: {},
        reason: "User wants to execute a command",
        priority: 3,
      });
    }

    return {
      requiresToolUse: tools.length > 0,
      recommendedTools: tools.length > 0 ? tools : undefined,
    };
  }

  private analyzeClarificationNeeds(context: ThinkingContext): {
    needsClarification: boolean;
    clarificationQuestions?: string[];
  } {
    const questions: string[] = [];

    if (context.openQuestions.length > 2) {
      questions.push(...context.openQuestions.slice(0, 3));
    }

    const activeHypotheses = context.hypotheses.filter((h) => h.status === "active");
    if (activeHypotheses.length > 2) {
      questions.push("Could you clarify which interpretation is correct?");
    }

    return {
      needsClarification: questions.length > 0,
      clarificationQuestions: questions.length > 0 ? questions : undefined,
    };
  }

  private estimateStepTokens(result: ThinkingStepResult): number {
    return result.thoughts.length * 15;
  }

  private generateThinkingId(): string {
    return `think_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  getHistory(): ThinkingResult[] {
    return [...this.thinkingHistory];
  }

  getHypothesisManager(): MultiHypothesisManager {
    return this.hypothesisManager;
  }

  getDepthController(): AdaptiveDepthController {
    return this.depthController;
  }

  updateConfig(config: Partial<MemoryEnhancedConfig>): void {
    this.config = { ...this.config, ...config };
  }

  clearHistory(): void {
    this.thinkingHistory = [];
    this.hypothesisManager.clear();
  }

  /**
   * 关闭记忆系统
   */
  async close(): Promise<void> {
    if (this.memoryStore) {
      await this.memoryStore.close();
    }
  }
}

// 导出单例
export const memoryEnhancedThinkingEngine = new MemoryEnhancedThinkingEngine();
