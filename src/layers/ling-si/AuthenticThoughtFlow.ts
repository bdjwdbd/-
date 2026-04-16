/**
 * 真实思维流模拟器
 * 
 * 让思考流程更"人性化"，模拟人类思维的不完美感
 * 基于涂津豪提示词的 authentic_thought_flow
 */

import { ThinkingStepName, ThinkingContext } from "./types";
import { NaturalLanguageInjector, PhraseCategory } from "./NaturalLanguageInjector";

// ==================== 类型定义 ====================

/**
 * 思维流特征
 */
export enum ThoughtFlowFeature {
  NON_LINEAR = "non_linear",           // 非线性推进
  SELF_CORRECTION = "self_correction", // 自我修正
  DIGRESSION = "digression",           // 离题探索
  FALSE_START = "false_start",         // 错误尝试
  UNCERTAINTY = "uncertainty",         // 承认不确定
  CONNECTION = "connection",           // 连接无关想法
  INSIGHT = "insight",                 // 突然顿悟
  QUESTION = "question",               // 内部问答
  REFLECTION = "reflection",           // 反思过程
}

/**
 * 思维流节点
 */
export interface ThoughtFlowNode {
  id: string;
  content: string;
  step: ThinkingStepName;
  features: ThoughtFlowFeature[];
  confidence: number;
  branches?: ThoughtFlowNode[];
  parent?: string;
  isMainPath: boolean;
  timestamp: number;
}

/**
 * 思维流路径
 */
export interface ThoughtFlowPath {
  nodes: ThoughtFlowNode[];
  totalConfidence: number;
  features: ThoughtFlowFeature[];
  isComplete: boolean;
}

/**
 * 离题探索
 */
export interface Digression {
  topic: string;
  reason: string;
  content: string;
  relevance: number;
  returnPoint: string;
}

/**
 * 错误尝试
 */
export interface FalseStart {
  approach: string;
  reason: string;
  failurePoint: string;
  lesson: string;
  alternativeApproach: string;
}

/**
 * 顿悟时刻
 */
export interface InsightMoment {
  content: string;
  trigger: string;
  connections: string[];
  impact: number;
  timestamp: number;
}

/**
 * 思维流配置
 */
export interface ThoughtFlowConfig {
  /** 启用的特征 */
  enabledFeatures: ThoughtFlowFeature[];
  /** 离题概率 (0-1) */
  digressionProbability: number;
  /** 错误尝试概率 (0-1) */
  falseStartProbability: number;
  /** 顿悟概率 (0-1) */
  insightProbability: number;
  /** 最大离题深度 */
  maxDigressionDepth: number;
  /** 是否允许回溯 */
  allowBacktracking: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_THOUGHT_FLOW_CONFIG: ThoughtFlowConfig = {
  enabledFeatures: [
    ThoughtFlowFeature.NON_LINEAR,
    ThoughtFlowFeature.SELF_CORRECTION,
    ThoughtFlowFeature.DIGRESSION,
    ThoughtFlowFeature.FALSE_START,
    ThoughtFlowFeature.UNCERTAINTY,
    ThoughtFlowFeature.CONNECTION,
    ThoughtFlowFeature.INSIGHT,
    ThoughtFlowFeature.QUESTION,
    ThoughtFlowFeature.REFLECTION,
  ],
  digressionProbability: 0.15,
  falseStartProbability: 0.1,
  insightProbability: 0.2,
  maxDigressionDepth: 2,
  allowBacktracking: true,
};

// ==================== 真实思维流模拟器 ====================

export class AuthenticThoughtFlowSimulator {
  private config: ThoughtFlowConfig;
  private nodes: Map<string, ThoughtFlowNode> = new Map();
  private mainPath: string[] = [];
  private digressions: Digression[] = [];
  private falseStarts: FalseStart[] = [];
  private insights: InsightMoment[] = [];
  private injector: NaturalLanguageInjector;
  private nodeIdCounter: number = 0;

  constructor(config: Partial<ThoughtFlowConfig> = {}) {
    this.config = { ...DEFAULT_THOUGHT_FLOW_CONFIG, ...config };
    this.injector = new NaturalLanguageInjector();
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.nodes.clear();
    this.mainPath = [];
    this.digressions = [];
    this.falseStarts = [];
    this.insights = [];
    this.nodeIdCounter = 0;
    this.injector.reset();
  }

  /**
   * 添加思维节点
   */
  addNode(
    content: string,
    step: ThinkingStepName,
    options: {
      features?: ThoughtFlowFeature[];
      confidence?: number;
      isMainPath?: boolean;
      parent?: string;
    } = {}
  ): ThoughtFlowNode {
    const node: ThoughtFlowNode = {
      id: `node_${++this.nodeIdCounter}`,
      content,
      step,
      features: options.features || [],
      confidence: options.confidence ?? 0.7,
      isMainPath: options.isMainPath ?? true,
      timestamp: Date.now(),
      parent: options.parent,
    };

    this.nodes.set(node.id, node);

    if (node.isMainPath) {
      this.mainPath.push(node.id);
    }

    if (options.parent) {
      const parentNode = this.nodes.get(options.parent);
      if (parentNode) {
        parentNode.branches = parentNode.branches || [];
        parentNode.branches.push(node);
      }
    }

    return node;
  }

  /**
   * 模拟非线性推进
   */
  simulateNonLinearProgression(
    steps: ThinkingStepName[],
    context: ThinkingContext
  ): ThoughtFlowNode[] {
    const result: ThoughtFlowNode[] = [];
    let currentStepIndex = 0;
    let visitedSteps = new Set<ThinkingStepName>();

    while (currentStepIndex < steps.length) {
      const currentStep = steps[currentStepIndex];
      
      // 决定是否跳跃
      if (
        this.config.enabledFeatures.includes(ThoughtFlowFeature.NON_LINEAR) &&
        Math.random() < 0.2 &&
        currentStepIndex > 0 &&
        currentStepIndex < steps.length - 1
      ) {
        // 跳跃到相关步骤
        const jumpTarget = this.selectJumpTarget(currentStep, steps, visitedSteps);
        if (jumpTarget !== currentStepIndex) {
          const jumpNode = this.createJumpNode(currentStep, steps[jumpTarget]);
          result.push(jumpNode);
          currentStepIndex = jumpTarget;
          continue;
        }
      }

      // 正常推进
      visitedSteps.add(currentStep);
      currentStepIndex++;
    }

    return result;
  }

  private selectJumpTarget(
    currentStep: ThinkingStepName,
    steps: ThinkingStepName[],
    visited: Set<ThinkingStepName>
  ): number {
    // 跳跃规则
    const jumpRules: Partial<Record<ThinkingStepName, ThinkingStepName[]>> = {
      [ThinkingStepName.MULTIPLE_HYPOTHESES]: [
        ThinkingStepName.TESTING_VERIFICATION,
        ThinkingStepName.ERROR_CORRECTION,
      ],
      [ThinkingStepName.NATURAL_DISCOVERY]: [
        ThinkingStepName.PATTERN_RECOGNITION,
        ThinkingStepName.KNOWLEDGE_SYNTHESIS,
      ],
      [ThinkingStepName.TESTING_VERIFICATION]: [
        ThinkingStepName.MULTIPLE_HYPOTHESES,
        ThinkingStepName.ERROR_CORRECTION,
      ],
    };

    const possibleTargets = jumpRules[currentStep] || [];
    const unvisitedTargets = possibleTargets.filter(t => !visited.has(t));

    if (unvisitedTargets.length > 0) {
      const target = unvisitedTargets[Math.floor(Math.random() * unvisitedTargets.length)];
      return steps.indexOf(target);
    }

    return steps.indexOf(currentStep);
  }

  private createJumpNode(from: ThinkingStepName, to: ThinkingStepName): ThoughtFlowNode {
    return {
      id: `jump_${Date.now()}`,
      content: `从 ${from} 跳转到 ${to}，因为发现了新的关联`,
      step: from,
      features: [ThoughtFlowFeature.NON_LINEAR],
      confidence: 0.6,
      isMainPath: true,
      timestamp: Date.now(),
    };
  }

  /**
   * 模拟离题探索
   */
  simulateDigression(
    mainTopic: string,
    context: ThinkingContext
  ): Digression | null {
    if (
      !this.config.enabledFeatures.includes(ThoughtFlowFeature.DIGRESSION) ||
      Math.random() > this.config.digressionProbability
    ) {
      return null;
    }

    // 生成离题话题
    const digressionTopic = this.generateDigressionTopic(mainTopic, context);
    const content = this.generateDigressionContent(digressionTopic);
    const relevance = this.calculateRelevance(digressionTopic, mainTopic);

    const digression: Digression = {
      topic: digressionTopic,
      reason: `这与 ${mainTopic} 有间接关联，值得探索`,
      content,
      relevance,
      returnPoint: `回到主线: ${mainTopic}`,
    };

    this.digressions.push(digression);
    return digression;
  }

  private generateDigressionTopic(mainTopic: string, context: ThinkingContext): string {
    const relatedTopics = [
      "历史背景",
      "相关案例",
      "理论基础",
      "类似问题",
      "边界条件",
    ];
    return relatedTopics[Math.floor(Math.random() * relatedTopics.length)];
  }

  private generateDigressionContent(topic: string): string {
    const templates = [
      `顺便说一下，关于${topic}，有一个有趣的角度...`,
      `这让我想到${topic}，虽然不是直接相关...`,
      `从${topic}的角度来看，可能会有新的发现...`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private calculateRelevance(digressionTopic: string, mainTopic: string): number {
    // 简化的相关性计算
    return 0.3 + Math.random() * 0.4;
  }

  /**
   * 模拟错误尝试
   */
  simulateFalseStart(
    approach: string,
    context: ThinkingContext
  ): FalseStart | null {
    if (
      !this.config.enabledFeatures.includes(ThoughtFlowFeature.FALSE_START) ||
      Math.random() > this.config.falseStartProbability
    ) {
      return null;
    }

    const failureReasons = [
      "假设不成立",
      "缺少关键信息",
      "逻辑有漏洞",
      "忽略了重要因素",
    ];

    const lessons = [
      "需要先验证假设",
      "应该收集更多信息",
      "需要重新审视逻辑",
      "要考虑更多因素",
    ];

    const reasonIndex = Math.floor(Math.random() * failureReasons.length);

    const falseStart: FalseStart = {
      approach,
      reason: failureReasons[reasonIndex],
      failurePoint: `在尝试 ${approach} 时发现问题`,
      lesson: lessons[reasonIndex],
      alternativeApproach: this.generateAlternativeApproach(approach),
    };

    this.falseStarts.push(falseStart);
    return falseStart;
  }

  private generateAlternativeApproach(failedApproach: string): string {
    const alternatives = [
      "换个角度思考",
      "分解问题后再尝试",
      "寻求更多信息",
      "简化假设",
    ];
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  /**
   * 模拟顿悟时刻
   */
  simulateInsight(
    context: ThinkingContext,
    accumulatedThoughts: string[]
  ): InsightMoment | null {
    if (
      !this.config.enabledFeatures.includes(ThoughtFlowFeature.INSIGHT) ||
      Math.random() > this.config.insightProbability
    ) {
      return null;
    }

    // 从积累的思考中提取连接
    const connections = this.extractConnections(accumulatedThoughts);
    const trigger = this.identifyTrigger(accumulatedThoughts);
    const content = this.generateInsightContent(connections, trigger);

    const insight: InsightMoment = {
      content,
      trigger,
      connections,
      impact: 0.7 + Math.random() * 0.3,
      timestamp: Date.now(),
    };

    this.insights.push(insight);
    return insight;
  }

  private extractConnections(thoughts: string[]): string[] {
    // 简化的连接提取
    if (thoughts.length < 2) return [];
    return [
      thoughts[Math.floor(Math.random() * thoughts.length)],
      thoughts[Math.floor(Math.random() * thoughts.length)],
    ];
  }

  private identifyTrigger(thoughts: string[]): string {
    const triggers = [
      "突然意识到两个概念之间的联系",
      "发现了一个被忽略的模式",
      "从不同角度重新审视问题",
      "回忆起相关的先验知识",
    ];
    return triggers[Math.floor(Math.random() * triggers.length)];
  }

  private generateInsightContent(connections: string[], trigger: string): string {
    return `顿悟！${trigger}。${connections.join(" 和 ")} 之间存在深层关联。`;
  }

  /**
   * 生成真实思维流
   */
  generateAuthenticFlow(
    steps: Array<{ step: ThinkingStepName; content: string }>,
    context: ThinkingContext
  ): string {
    const flowParts: string[] = [];
    const accumulatedThoughts: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      const { step, content } = steps[i];
      let processedContent = content;

      // 1. 检查是否需要离题
      const digression = this.simulateDigression(content, context);
      if (digression) {
        flowParts.push(`\n[离题探索] ${digression.content}`);
        flowParts.push(`[回归主线] ${digression.returnPoint}\n`);
      }

      // 2. 检查是否需要错误尝试
      if (i > 0 && i < steps.length - 1) {
        const falseStart = this.simulateFalseStart(content, context);
        if (falseStart) {
          flowParts.push(`\n[尝试] ${falseStart.approach}`);
          flowParts.push(`[失败] ${falseStart.reason}`);
          flowParts.push(`[教训] ${falseStart.lesson}`);
          flowParts.push(`[新方向] ${falseStart.alternativeApproach}\n`);
        }
      }

      // 3. 检查是否需要顿悟
      const insight = this.simulateInsight(context, accumulatedThoughts);
      if (insight) {
        flowParts.push(`\n[顿悟] ${insight.content}\n`);
      }

      // 4. 添加自然语言标记
      processedContent = this.injector.smartInject(processedContent, {
        isUncertain: step === ThinkingStepName.MULTIPLE_HYPOTHESES,
        isDiscovery: step === ThinkingStepName.NATURAL_DISCOVERY,
        isCorrection: step === ThinkingStepName.ERROR_CORRECTION,
        isSynthesis: step === ThinkingStepName.KNOWLEDGE_SYNTHESIS,
      });

      flowParts.push(processedContent);
      accumulatedThoughts.push(content);
    }

    return flowParts.join("\n");
  }

  /**
   * 获取思维流统计
   */
  getStats(): {
    totalNodes: number;
    mainPathLength: number;
    digressions: number;
    falseStarts: number;
    insights: number;
    features: ThoughtFlowFeature[];
  } {
    return {
      totalNodes: this.nodes.size,
      mainPathLength: this.mainPath.length,
      digressions: this.digressions.length,
      falseStarts: this.falseStarts.length,
      insights: this.insights.length,
      features: this.config.enabledFeatures,
    };
  }

  /**
   * 导出思维流
   */
  exportFlow(): {
    nodes: ThoughtFlowNode[];
    mainPath: string[];
    digressions: Digression[];
    falseStarts: FalseStart[];
    insights: InsightMoment[];
  } {
    return {
      nodes: [...this.nodes.values()],
      mainPath: [...this.mainPath],
      digressions: [...this.digressions],
      falseStarts: [...this.falseStarts],
      insights: [...this.insights],
    };
  }
}

// 导出单例
export const authenticThoughtFlow = new AuthenticThoughtFlowSimulator();
