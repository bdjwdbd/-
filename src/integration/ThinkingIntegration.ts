/**
 * 灵思层集成模块
 * 
 * 将 L0 灵思层与其他层级集成：
 * - DecisionCenter（L1 灵枢层）
 * - LearningValidator（L4 灵盾层）
 * - TokenEstimator（L6 灵识层）
 */

import {
  ThinkingProtocolEngine,
  ThinkingResult,
  ThinkingContext,
  ThinkingDepth,
  HumanMessage,
  MultiHypothesisManager,
  AdaptiveDepthController,
} from "../layers/ling-si";

import { DecisionCenter, Decision, DecisionType } from "../core/decision";
import { LearningValidator } from "../core/security";

// ============================================================
// 类型定义
// ============================================================

/**
 * 增强的决策上下文
 */
export interface EnhancedDecisionContext {
  /** 原始消息 */
  message: HumanMessage;
  /** 思考结果 */
  thinking: ThinkingResult;
  /** 用户上下文 */
  userContext?: Record<string, unknown>;
  /** 历史决策 */
  recentDecisions?: Decision[];
  /** 记忆 */
  memories?: any[];
}

/**
 * 增强的决策结果
 */
export interface EnhancedDecision extends Decision {
  /** 思考结果 */
  thinking: ThinkingResult;
  /** 活跃假设 */
  activeHypotheses: number;
  /** 思考深度 */
  thinkingDepth: ThinkingDepth;
  /** 思考耗时 */
  thinkingDuration: number;
}

/**
 * 验证增强结果
 */
export interface EnhancedValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 总分 */
  score: number;
  /** 问题列表 */
  issues: string[];
  /** 假设验证结果 */
  hypothesisValidation: Array<{
    hypothesisId: string;
    content: string;
    confirmed: boolean;
    evidence: string;
  }>;
  /** 思考质量评分 */
  thinkingQuality: number;
}

// ============================================================
// DecisionCenterV3 - 集成灵思层的决策中心
// ============================================================

export class DecisionCenterV3 extends DecisionCenter {
  private thinkingEngine: ThinkingProtocolEngine;
  private hypothesisManager: MultiHypothesisManager;
  private depthController: AdaptiveDepthController;
  private enhancedHistory: EnhancedDecision[] = [];

  constructor(config?: any) {
    super(config);
    this.thinkingEngine = new ThinkingProtocolEngine();
    this.hypothesisManager = new MultiHypothesisManager();
    this.depthController = new AdaptiveDepthController();
  }

  /**
   * 增强决策：先思考，再决策
   */
  async makeDecision(context: EnhancedDecisionContext): Promise<EnhancedDecision> {
    // 1. 执行思考协议
    const thinking = await this.thinkingEngine.execute(context.message);

    // 2. 将思考结果注入决策上下文
    const enrichedContext = {
      ...context,
      thinking,
      thinkingInsights: thinking.insights,
      thinkingConfidence: thinking.confidence,
    };

    // 3. 基于思考结果选择决策类型
    const decisionType = this.selectDecisionType(thinking);

    // 4. 执行原有决策流程
    const baseDecision = await this.decide(decisionType, context.message.content);

    // 5. 构建增强决策
    const enhancedDecision: EnhancedDecision = {
      ...baseDecision,
      thinking,
      activeHypotheses: thinking.hypotheses.filter((h) => h.status === "active").length,
      thinkingDepth: thinking.depth,
      thinkingDuration: thinking.duration,
    };

    // 6. 记录历史
    this.enhancedHistory.push(enhancedDecision);

    return enhancedDecision;
  }

  /**
   * 基于思考结果选择决策类型
   */
  private selectDecisionType(thinking: ThinkingResult): DecisionType {
    // 如果需要澄清，先规划
    if (thinking.needsClarification) {
      return "plan";
    }

    // 如果需要工具调用，执行
    if (thinking.requiresToolUse) {
      return "act";
    }

    // 如果置信度低，反思
    if (thinking.confidence < 0.5) {
      return "reflect";
    }

    // 默认执行
    return "act";
  }

  /**
   * 获取增强历史
   */
  getEnhancedHistory(): EnhancedDecision[] {
    return [...this.enhancedHistory];
  }

  /**
   * 获取思考引擎
   */
  getThinkingEngine(): ThinkingProtocolEngine {
    return this.thinkingEngine;
  }

  /**
   * 获取假设管理器
   */
  getHypothesisManager(): MultiHypothesisManager {
    return this.hypothesisManager;
  }

  /**
   * 清除历史
   */
  clearEnhancedHistory(): void {
    this.enhancedHistory = [];
    this.thinkingEngine.clearHistory();
    this.hypothesisManager.clear();
  }
}

// ============================================================
// LearningValidatorV3 - 集成灵思层的学习验证器
// ============================================================

export class LearningValidatorV3 extends LearningValidator {
  private hypothesisManager: MultiHypothesisManager;
  private thinkingEngine: ThinkingProtocolEngine;

  constructor() {
    super();
    this.hypothesisManager = new MultiHypothesisManager();
    this.thinkingEngine = new ThinkingProtocolEngine();
  }

  /**
   * 增强验证：验证假设 + 验证输出
   */
  async validateWithThinking(
    input: string,
    output: string,
    thinking: ThinkingResult
  ): Promise<EnhancedValidationResult> {
    // 1. 执行基础验证
    const baseValidation = await this.validate(input, output);

    // 2. 验证假设
    const hypothesisValidation = await this.validateHypotheses(thinking, output);

    // 3. 评估思考质量
    const thinkingQuality = this.assessThinkingQuality(thinking);

    // 4. 综合评分
    const score = this.calculateCombinedScore(
      baseValidation.score,
      hypothesisValidation,
      thinkingQuality
    );

    // 5. 收集问题
    const issues = [
      ...baseValidation.issues,
      ...hypothesisValidation
        .filter((h) => !h.confirmed)
        .map((h) => `假设未确认: ${h.content}`),
    ];

    return {
      valid: score >= 0.5 && baseValidation.valid,
      score,
      issues,
      hypothesisValidation,
      thinkingQuality,
    };
  }

  /**
   * 验证假设
   */
  private async validateHypotheses(
    thinking: ThinkingResult,
    output: string
  ): Promise<
    Array<{
      hypothesisId: string;
      content: string;
      confirmed: boolean;
      evidence: string;
    }>
  > {
    const results: Array<{
      hypothesisId: string;
      content: string;
      confirmed: boolean;
      evidence: string;
    }> = [];

    for (const hypothesis of thinking.hypotheses) {
      // 检查输出是否支持假设
      const confirmed = this.checkHypothesisSupport(hypothesis.content, output);

      // 更新假设状态
      if (confirmed) {
        this.hypothesisManager.confirmHypothesis(
          hypothesis.id,
          `Output supports: ${output.substring(0, 100)}`
        );
      } else {
        this.hypothesisManager.addEvidence(
          hypothesis.id,
          `Output does not clearly support`,
          false
        );
      }

      results.push({
        hypothesisId: hypothesis.id,
        content: hypothesis.content,
        confirmed,
        evidence: confirmed ? "Output supports hypothesis" : "Output does not support",
      });
    }

    return results;
  }

  /**
   * 检查输出是否支持假设
   */
  private checkHypothesisSupport(hypothesis: string, output: string): boolean {
    // 简单的关键词匹配
    const hypothesisKeywords = hypothesis.toLowerCase().split(/\s+/);
    const outputLower = output.toLowerCase();

    const matchCount = hypothesisKeywords.filter((k) =>
      k.length > 3 && outputLower.includes(k)
    ).length;

    return matchCount >= hypothesisKeywords.length * 0.3;
  }

  /**
   * 评估思考质量
   */
  private assessThinkingQuality(thinking: ThinkingResult): number {
    let score = 0;

    // 深度加分
    const depthScores = {
      minimal: 0.25,
      standard: 0.5,
      extensive: 0.75,
      deep: 1.0,
    };
    score += depthScores[thinking.depth] * 0.3;

    // 置信度加分
    score += thinking.confidence * 0.3;

    // 洞察数量加分
    score += Math.min(thinking.insights.length / 3, 1) * 0.2;

    // 步骤完成度加分
    score += (thinking.stepResults.length / 10) * 0.2;

    return Math.min(1, score);
  }

  /**
   * 计算综合评分
   */
  private calculateCombinedScore(
    baseScore: number,
    hypothesisValidation: Array<{ confirmed: boolean }>,
    thinkingQuality: number
  ): number {
    const confirmedRate =
      hypothesisValidation.length > 0
        ? hypothesisValidation.filter((h) => h.confirmed).length /
          hypothesisValidation.length
        : 0.5;

    return baseScore * 0.4 + confirmedRate * 0.3 + thinkingQuality * 0.3;
  }

  /**
   * 获取假设管理器
   */
  getHypothesisManager(): MultiHypothesisManager {
    return this.hypothesisManager;
  }
}

// ============================================================
// ThinkingOrchestrator - 思考编排器
// ============================================================

export class ThinkingOrchestrator {
  private decisionCenter: DecisionCenterV3;
  private learningValidator: LearningValidatorV3;
  private thinkingEngine: ThinkingProtocolEngine;

  constructor() {
    this.thinkingEngine = new ThinkingProtocolEngine();
    this.decisionCenter = new DecisionCenterV3();
    this.learningValidator = new LearningValidatorV3();
  }

  /**
   * 完整的思考-决策-验证流程
   */
  async process(message: HumanMessage): Promise<{
    thinking: ThinkingResult;
    decision: EnhancedDecision;
    validation: EnhancedValidationResult;
  }> {
    // 1. 思考
    const thinking = await this.thinkingEngine.execute(message);

    // 2. 决策
    const decision = await this.decisionCenter.makeDecision({
      message,
      thinking,
    });

    // 3. 验证
    const validation = await this.learningValidator.validateWithThinking(
      message.content,
      decision.output?.toString() || "",
      thinking
    );

    return {
      thinking,
      decision,
      validation,
    };
  }

  /**
   * 快速处理（仅思考 + 决策）
   */
  async quickProcess(message: HumanMessage): Promise<{
    thinking: ThinkingResult;
    decision: EnhancedDecision;
  }> {
    const thinking = await this.thinkingEngine.execute(message);
    const decision = await this.decisionCenter.makeDecision({
      message,
      thinking,
    });

    return { thinking, decision };
  }

  /**
   * 获取组件
   */
  getDecisionCenter(): DecisionCenterV3 {
    return this.decisionCenter;
  }

  getLearningValidator(): LearningValidatorV3 {
    return this.learningValidator;
  }

  getThinkingEngine(): ThinkingProtocolEngine {
    return this.thinkingEngine;
  }
}

// ============================================================
// 导出
// ============================================================

export {
  ThinkingProtocolEngine,
  ThinkingResult,
  ThinkingContext,
  ThinkingDepth,
  HumanMessage,
  MultiHypothesisManager,
  AdaptiveDepthController,
};

export const thinkingOrchestrator = new ThinkingOrchestrator();
