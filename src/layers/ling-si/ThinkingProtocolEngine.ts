/**
 * 思考协议引擎
 * 
 * 核心组件：强制在每次交互前执行思考过程
 * 基于 Thinking Claude 的 anthropic_thinking_protocol
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

/**
 * 思考协议引擎
 */
export class ThinkingProtocolEngine {
  private depthController: AdaptiveDepthController;
  private hypothesisManager: MultiHypothesisManager;
  private config: ThinkingConfig;
  private thinkingHistory: ThinkingResult[] = [];

  constructor(config?: Partial<ThinkingConfig>) {
    this.config = { ...DEFAULT_THINKING_CONFIG, ...config };
    this.depthController = new AdaptiveDepthController();
    this.hypothesisManager = new MultiHypothesisManager();
  }

  /**
   * 执行思考协议
   */
  async execute(message: HumanMessage): Promise<ThinkingResult> {
    const startTime = Date.now();
    const thinkingId = this.generateThinkingId();

    // 1. 评估思考深度
    const depthAssessment = this.depthController.assessDepth(message);
    const depth = depthAssessment.depth;

    // 2. 初始化思考上下文
    const context: ThinkingContext = {
      message,
      depth,
      completedSteps: [],
      hypotheses: [],
      establishedFacts: [],
      openQuestions: [],
      confidence: 0.5,
      tokenBudget: depthAssessment.tokenBudget,
      tokensUsed: 0,
    };

    // 3. 根据深度选择步骤
    const steps = this.selectSteps(depth);

    // 4. 执行思考步骤
    const stepResults: ThinkingStepResult[] = [];
    for (const stepName of steps) {
      const step = thinkingStepMap.get(stepName);
      if (!step) continue;

      // 检查 token 预算
      if (context.tokensUsed >= context.tokenBudget) {
        break;
      }

      // 执行步骤
      const result = await step.execute(context);
      stepResults.push(result);

      // 更新上下文
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

    // 5. 合成思考内容
    const content = this.synthesizeThinkingContent(stepResults);

    // 6. 提取洞察
    const insights = this.extractInsights(stepResults);

    // 7. 确定是否需要工具调用
    const { requiresToolUse, recommendedTools } = this.analyzeToolNeeds(context);

    // 8. 确定是否需要澄清
    const { needsClarification, clarificationQuestions } = this.analyzeClarificationNeeds(context);

    // 9. 构建结果
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

    // 10. 记录历史
    this.thinkingHistory.push(result);

    return result;
  }

  /**
   * 根据深度选择思考步骤
   */
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

  /**
   * 合成思考内容
   */
  private synthesizeThinkingContent(stepResults: ThinkingStepResult[]): string {
    const lines: string[] = [];

    for (const result of stepResults) {
      lines.push(...result.thoughts);
      lines.push(""); // 空行分隔
    }

    return lines.join("\n");
  }

  /**
   * 提取洞察
   */
  private extractInsights(stepResults: ThinkingStepResult[]): string[] {
    const insights: string[] = [];

    for (const result of stepResults) {
      if (result.issues) {
        insights.push(...result.issues);
      }
    }

    // 去重
    return [...new Set(insights)];
  }

  /**
   * 分析工具需求
   */
  private analyzeToolNeeds(context: ThinkingContext): {
    requiresToolUse: boolean;
    recommendedTools?: ToolRecommendation[];
  } {
    const content = context.message.content.toLowerCase();
    const tools: ToolRecommendation[] = [];

    // 检查是否需要搜索
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

    // 检查是否需要读取文件
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

    // 检查是否需要执行命令
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

  /**
   * 分析澄清需求
   */
  private analyzeClarificationNeeds(context: ThinkingContext): {
    needsClarification: boolean;
    clarificationQuestions?: string[];
  } {
    const questions: string[] = [];

    // 检查开放问题
    if (context.openQuestions.length > 2) {
      questions.push(...context.openQuestions.slice(0, 3));
    }

    // 检查假设冲突
    const activeHypotheses = context.hypotheses.filter((h) => h.status === "active");
    if (activeHypotheses.length > 2) {
      questions.push("Could you clarify which interpretation is correct?");
    }

    return {
      needsClarification: questions.length > 0,
      clarificationQuestions: questions.length > 0 ? questions : undefined,
    };
  }

  /**
   * 估算步骤 token 数
   */
  private estimateStepTokens(result: ThinkingStepResult): number {
    // 简单估算：每行约 15 tokens
    return result.thoughts.length * 15;
  }

  /**
   * 生成思考 ID
   */
  private generateThinkingId(): string {
    return `think_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取思考历史
   */
  getHistory(): ThinkingResult[] {
    return [...this.thinkingHistory];
  }

  /**
   * 获取假设管理器
   */
  getHypothesisManager(): MultiHypothesisManager {
    return this.hypothesisManager;
  }

  /**
   * 获取深度控制器
   */
  getDepthController(): AdaptiveDepthController {
    return this.depthController;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ThinkingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.thinkingHistory = [];
    this.hypothesisManager.clear();
  }
}

// 导出单例
export const thinkingProtocolEngine = new ThinkingProtocolEngine();
