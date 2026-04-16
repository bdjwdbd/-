/**
 * 增强型思考引擎
 * 
 * 整合所有优化模块的统一思考引擎
 * 基于涂津豪提示词 v5.1-extensive 的完整实现
 */

import {
  ThinkingDepth,
  ThinkingStepName,
  ThinkingContext,
  ThinkingResult,
  Hypothesis,
  HumanMessage,
  HypothesisStatus,
} from "./types";
import { AdaptiveDepthController } from "./AdaptiveDepthController";
import { MultiHypothesisManager } from "./MultiHypothesisManager";
import { AdvancedThinkingTechniquesEngine, ThinkingTechnique } from "./AdvancedThinkingTechniques";
import { NaturalLanguageInjector, PhraseCategory } from "./NaturalLanguageInjector";
import { AuthenticThoughtFlowSimulator, ThoughtFlowFeature } from "./AuthenticThoughtFlow";
import { DomainIntegrator, Domain } from "./DomainIntegrator";
import { ProgressiveUnderstandingTracker, UnderstandingPhase } from "./ProgressiveUnderstandingTracker";

// ==================== 类型定义 ====================

/**
 * 增强型思考配置
 */
export interface EnhancedThinkingConfig {
  /** 思考深度 */
  depth: ThinkingDepth;
  /** 启用的思维技术 */
  enabledTechniques: ThinkingTechnique[];
  /** 是否启用自然语言注入 */
  enableNaturalLanguage: boolean;
  /** 是否启用真实思维流 */
  enableAuthenticFlow: boolean;
  /** 是否启用领域集成 */
  enableDomainIntegration: boolean;
  /** 是否启用渐进式理解 */
  enableProgressiveUnderstanding: boolean;
  /** 最大思考步骤 */
  maxSteps: number;
  /** Token 预算 */
  tokenBudget: number;
}

/**
 * 默认配置
 */
export const DEFAULT_ENHANCED_CONFIG: EnhancedThinkingConfig = {
  depth: ThinkingDepth.EXTENSIVE,
  enabledTechniques: [
    ThinkingTechnique.CONNECTIVE,
    ThinkingTechnique.PATTERN_RECOGNITION,
    ThinkingTechnique.ABDUCTIVE,
    ThinkingTechnique.SYSTEMS,
    ThinkingTechnique.PRIORITY,
  ],
  enableNaturalLanguage: true,
  enableAuthenticFlow: true,
  enableDomainIntegration: true,
  enableProgressiveUnderstanding: true,
  maxSteps: 10,
  tokenBudget: 1000,
};

/**
 * 增强型思考结果
 */
export interface EnhancedThinkingResult {
  /** 思考 ID */
  id: string;
  /** 思考深度 */
  depth: ThinkingDepth;
  /** 完整思考内容 */
  content: string;
  /** 各步骤结果 */
  stepResults: Array<{ stepName: string; thoughts: string[]; completed: boolean }>;
  /** 最终假设 */
  hypotheses: Hypothesis[];
  /** 关键洞察 */
  insights: string[];
  /** 置信度 */
  confidence: number;
  /** 使用的思维技术 */
  techniquesUsed: ThinkingTechnique[];
  /** 检测到的领域 */
  detectedDomains: Domain[];
  /** 理解演进 */
  understandingEvolution: string[];
  /** 自然语言注入统计 */
  naturalLanguageStats: {
    injectionCount: number;
    usedPhrases: string[];
  };
  /** 思维流特征 */
  thoughtFlowFeatures: ThoughtFlowFeature[];
  /** 置信度变化 */
  confidenceProgression: number[];
}

// ==================== 增强型思考引擎 ====================

export class EnhancedThinkingEngine {
  private config: EnhancedThinkingConfig;
  private depthController: AdaptiveDepthController;
  private hypothesisManager: MultiHypothesisManager;
  private techniquesEngine: AdvancedThinkingTechniquesEngine;
  private languageInjector: NaturalLanguageInjector;
  private thoughtFlowSimulator: AuthenticThoughtFlowSimulator;
  private domainIntegrator: DomainIntegrator;
  private understandingTracker: ProgressiveUnderstandingTracker;

  constructor(config: Partial<EnhancedThinkingConfig> = {}) {
    this.config = { ...DEFAULT_ENHANCED_CONFIG, ...config };
    this.depthController = new AdaptiveDepthController();
    this.hypothesisManager = new MultiHypothesisManager();
    this.techniquesEngine = new AdvancedThinkingTechniquesEngine();
    this.languageInjector = new NaturalLanguageInjector();
    this.thoughtFlowSimulator = new AuthenticThoughtFlowSimulator();
    this.domainIntegrator = new DomainIntegrator();
    this.understandingTracker = new ProgressiveUnderstandingTracker();
  }

  /**
   * 执行增强型思考
   */
  async think(message: HumanMessage): Promise<EnhancedThinkingResult> {
    // 重置所有模块状态
    this.reset();

    // 1. 评估思考深度
    const depthResult = this.depthController.assessDepth(message);
    const actualDepth = this.config.depth || depthResult.depth;

    const context: ThinkingContext = {
      message,
      depth: actualDepth,
      completedSteps: [],
      hypotheses: [],
      establishedFacts: [],
      openQuestions: [],
      confidence: 0.5,
      tokenBudget: this.config.tokenBudget,
      tokensUsed: 0,
    };

    // 2. 检测领域
    const domainResult = this.config.enableDomainIntegration
      ? this.domainIntegrator.detectDomains(context)
      : { primaryDomain: null, detectedDomains: [], secondaryDomains: [], crossDomain: false };

    // 3. 初始化渐进式理解
    if (this.config.enableProgressiveUnderstanding) {
      const initialObservations = this.extractInitialObservations(message.content);
      this.understandingTracker.recordInitialObservations(initialObservations, context);
    }

    // 4. 执行思考步骤
    const thinkingSteps = this.executeThinkingSteps(context, actualDepth, domainResult);

    // 5. 应用高级思维技术
    const techniquesUsed = this.applyAdvancedTechniques(context, domainResult.primaryDomain);

    // 6. 生成最终结果
    const result = this.generateResult(context, thinkingSteps, {
      depth: actualDepth,
      domainResult,
      techniquesUsed,
    });

    return result;
  }

  /**
   * 重置所有模块
   */
  private reset(): void {
    this.hypothesisManager.clear();
    this.languageInjector.reset();
    this.thoughtFlowSimulator.reset();
    this.understandingTracker.reset();
  }

  /**
   * 提取初始观察
   */
  private extractInitialObservations(content: string): string[] {
    const observations: string[] = [];
    const sentences = content.split(/[。.!！?？]/).filter(s => s.trim());
    
    for (const sentence of sentences.slice(0, 3)) {
      observations.push(`观察到: ${sentence.trim()}`);
    }

    return observations;
  }

  /**
   * 执行思考步骤
   */
  private executeThinkingSteps(
    context: ThinkingContext,
    depth: ThinkingDepth,
    domainResult: { primaryDomain: Domain | null; detectedDomains: Array<{ domain: Domain; confidence: number; matchedKeywords: string[] }> }
  ): Array<{ step: ThinkingStepName; content: string; confidence: number }> {
    const steps: Array<{ step: ThinkingStepName; content: string; confidence: number }> = [];
    const stepOrder = this.getStepOrderForDepth(depth);

    for (const stepName of stepOrder) {
      const stepContent = this.executeStep(stepName, context, domainResult);
      
      // 应用自然语言注入
      let processedContent = stepContent.content;
      if (this.config.enableNaturalLanguage) {
        processedContent = this.injectNaturalLanguage(processedContent, stepName);
      }

      steps.push({
        step: stepName,
        content: processedContent,
        confidence: stepContent.confidence,
      });

      // 更新渐进式理解
      if (this.config.enableProgressiveUnderstanding) {
        this.understandingTracker.buildUnderstanding(
          [stepContent.content],
          context
        );
      }
    }

    return steps;
  }

  /**
   * 根据深度获取步骤顺序
   */
  private getStepOrderForDepth(depth: ThinkingDepth): ThinkingStepName[] {
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
          ThinkingStepName.TESTING_VERIFICATION,
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
          ThinkingStepName.PATTERN_RECOGNITION,
        ];
      case ThinkingDepth.DEEP:
        return [
          ThinkingStepName.INITIAL_ENGAGEMENT,
          ThinkingStepName.PROBLEM_ANALYSIS,
          ThinkingStepName.MULTIPLE_HYPOTHESES,
          ThinkingStepName.NATURAL_DISCOVERY,
          ThinkingStepName.TESTING_VERIFICATION,
          ThinkingStepName.ERROR_CORRECTION,
          ThinkingStepName.KNOWLEDGE_SYNTHESIS,
          ThinkingStepName.PATTERN_RECOGNITION,
          ThinkingStepName.PROGRESS_TRACKING,
          ThinkingStepName.RECURSIVE_THINKING,
        ];
      default:
        return Object.values(ThinkingStepName);
    }
  }

  /**
   * 执行单个思考步骤
   */
  private executeStep(
    step: ThinkingStepName,
    context: ThinkingContext,
    domainResult: { primaryDomain: Domain | null }
  ): { content: string; confidence: number } {
    const content = context.message.content;

    switch (step) {
      case ThinkingStepName.INITIAL_ENGAGEMENT:
        return {
          content: `理解问题: ${content.substring(0, 100)}...`,
          confidence: 0.7,
        };

      case ThinkingStepName.PROBLEM_ANALYSIS:
        return {
          content: `分析问题结构，识别关键要素`,
          confidence: 0.6,
        };

      case ThinkingStepName.MULTIPLE_HYPOTHESES:
        const hypotheses = this.generateHypotheses(content);
        return {
          content: `生成 ${hypotheses.length} 个假设: ${hypotheses.map(h => h.content).join(", ")}`,
          confidence: 0.5,
        };

      case ThinkingStepName.NATURAL_DISCOVERY:
        return {
          content: `探索问题的不同角度和可能性`,
          confidence: 0.6,
        };

      case ThinkingStepName.TESTING_VERIFICATION:
        return {
          content: `验证假设，检查逻辑一致性`,
          confidence: 0.7,
        };

      case ThinkingStepName.ERROR_CORRECTION:
        return {
          content: `检查可能的错误和遗漏`,
          confidence: 0.8,
        };

      case ThinkingStepName.KNOWLEDGE_SYNTHESIS:
        return {
          content: `综合所有信息，形成完整理解`,
          confidence: 0.8,
        };

      case ThinkingStepName.PATTERN_RECOGNITION:
        if (domainResult.primaryDomain) {
          const patterns = this.domainIntegrator.getCommonPatterns(domainResult.primaryDomain);
          return {
            content: `识别模式: ${patterns.slice(0, 3).join(", ")}`,
            confidence: 0.7,
          };
        }
        return {
          content: `识别问题中的模式和规律`,
          confidence: 0.6,
        };

      case ThinkingStepName.PROGRESS_TRACKING:
        return {
          content: `追踪思考进展，确保完整性`,
          confidence: 0.9,
        };

      case ThinkingStepName.RECURSIVE_THINKING:
        return {
          content: `递归审视，深化理解`,
          confidence: 0.85,
        };

      default:
        return {
          content: `执行步骤: ${step}`,
          confidence: 0.5,
        };
    }
  }

  /**
   * 生成假设
   */
  private generateHypotheses(content: string): Hypothesis[] {
    const now = Date.now();
    const hypotheses: Hypothesis[] = [
      {
        id: "h1",
        content: "假设1: 问题可能涉及技术实现",
        confidence: 0.7,
        evidence: ["包含技术关键词"],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      },
      {
        id: "h2",
        content: "假设2: 问题可能需要架构层面的考虑",
        confidence: 0.6,
        evidence: ["涉及系统设计"],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      },
      {
        id: "h3",
        content: "假设3: 问题可能有多种解决方案",
        confidence: 0.5,
        evidence: ["问题开放性"],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      },
    ];

    for (const h of hypotheses) {
      const added = this.hypothesisManager.addHypothesis(
        h.content,
        h.sourceStep,
        h.confidence
      );
      // 更新假设的其他属性
      Object.assign(added, {
        evidence: h.evidence,
        counterEvidence: h.counterEvidence,
        status: h.status,
      });
    }

    return hypotheses;
  }

  /**
   * 注入自然语言
   */
  private injectNaturalLanguage(content: string, step: ThinkingStepName): string {
    const categoryMap: Partial<Record<ThinkingStepName, PhraseCategory>> = {
      [ThinkingStepName.INITIAL_ENGAGEMENT]: PhraseCategory.HESITATION,
      [ThinkingStepName.MULTIPLE_HYPOTHESES]: PhraseCategory.UNCERTAINTY,
      [ThinkingStepName.NATURAL_DISCOVERY]: PhraseCategory.DISCOVERY,
      [ThinkingStepName.TESTING_VERIFICATION]: PhraseCategory.QUESTIONING,
      [ThinkingStepName.ERROR_CORRECTION]: PhraseCategory.CORRECTION,
      [ThinkingStepName.KNOWLEDGE_SYNTHESIS]: PhraseCategory.SYNTHESIS,
    };

    const category = categoryMap[step];
    return this.languageInjector.inject(content, category);
  }

  /**
   * 应用高级思维技术
   */
  private applyAdvancedTechniques(
    context: ThinkingContext,
    primaryDomain: Domain | null
  ): ThinkingTechnique[] {
    const usedTechniques: ThinkingTechnique[] = [];

    for (const technique of this.config.enabledTechniques) {
      const applied = this.applyTechnique(technique, context, primaryDomain);
      if (applied) {
        usedTechniques.push(technique);
      }
    }

    return usedTechniques;
  }

  /**
   * 应用单个思维技术
   */
  private applyTechnique(
    technique: ThinkingTechnique,
    context: ThinkingContext,
    primaryDomain: Domain | null
  ): boolean {
    switch (technique) {
      case ThinkingTechnique.CONNECTIVE:
        // 连接性思维
        const concepts = this.extractConcepts(context.message.content);
        if (concepts.length >= 2) {
          this.techniquesEngine.connectiveThinking(concepts, context);
          return true;
        }
        return false;

      case ThinkingTechnique.PATTERN_RECOGNITION:
        // 模式识别
        this.techniquesEngine.patternRecognition(context.message.content);
        return true;

      case ThinkingTechnique.ABDUCTIVE:
        // 溯因推理
        const hypotheses = this.hypothesisManager.getAllHypotheses();
        if (hypotheses.length > 0) {
          this.techniquesEngine.abductiveReasoning(
            context.message.content,
            hypotheses
          );
          return true;
        }
        return false;

      case ThinkingTechnique.SYSTEMS:
        // 系统思维
        const components = this.extractComponents(context.message.content);
        if (components.length >= 2) {
          this.techniquesEngine.systemsThinking(components);
          return true;
        }
        return false;

      case ThinkingTechnique.PRIORITY:
        // 优先级评估
        const items = this.extractItems(context.message.content);
        if (items.length >= 2) {
          this.techniquesEngine.priorityAssessment(items);
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * 提取概念
   */
  private extractConcepts(content: string): string[] {
    // 简化的概念提取
    const keywords = content.split(/[\s,，、]+/).filter(w => w.length > 2);
    return [...new Set(keywords)].slice(0, 5);
  }

  /**
   * 提取组件
   */
  private extractComponents(content: string): string[] {
    const componentKeywords = ["系统", "模块", "服务", "组件", "接口", "数据库"];
    return componentKeywords.filter(k => content.includes(k));
  }

  /**
   * 提取项目
   */
  private extractItems(content: string): string[] {
    // 按逗号或顿号分割
    return content.split(/[,，、]+/).filter(s => s.trim().length > 0).slice(0, 5);
  }

  /**
   * 生成最终结果
   */
  private generateResult(
    context: ThinkingContext,
    steps: Array<{ step: ThinkingStepName; content: string; confidence: number }>,
    options: {
      depth: ThinkingDepth;
      domainResult: { primaryDomain: Domain | null; detectedDomains: Array<{ domain: Domain; confidence: number; matchedKeywords: string[] }> };
      techniquesUsed: ThinkingTechnique[];
    }
  ): EnhancedThinkingResult {
    // 构建思考输出
    const thinkingOutput = steps.map(s => s.content).join("\n");

    // 获取各模块统计
    const nlStats = this.languageInjector.getStats();
    const flowStats = this.thoughtFlowSimulator.getStats();
    const understandingState = this.understandingTracker.getState();

    // 置信度变化
    const confidenceProgression = steps.map(s => s.confidence);

    return {
      id: `think_${Date.now()}`,
      content: thinkingOutput,
      stepResults: steps.map(s => ({
        stepName: s.step,
        thoughts: [s.content],
        completed: true,
      })),
      confidence: steps[steps.length - 1]?.confidence || 0.5,
      depth: options.depth,
      hypotheses: this.hypothesisManager.getAllHypotheses(),
      insights: [],
      techniquesUsed: options.techniquesUsed,
      detectedDomains: options.domainResult.detectedDomains.map(d => d.domain),
      understandingEvolution: understandingState.evolutions.map(
        e => `${e.from} → ${e.to}: ${e.trigger}`
      ),
      naturalLanguageStats: {
        injectionCount: nlStats.injectionCount,
        usedPhrases: nlStats.usedPhrases,
      },
      thoughtFlowFeatures: flowStats.features,
      confidenceProgression,
    };
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<EnhancedThinkingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): EnhancedThinkingConfig {
    return { ...this.config };
  }
}

// 导出单例
export const enhancedThinkingEngine = new EnhancedThinkingEngine();
