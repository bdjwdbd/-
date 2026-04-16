/**
 * 渐进式理解追踪器
 * 
 * 追踪理解的深化过程，实现涂津豪提示词的 Progressive Understanding
 */

import { ThinkingContext, Hypothesis } from "./types";

// ==================== 类型定义 ====================

/**
 * 理解阶段
 */
export enum UnderstandingPhase {
  INITIAL = "initial",           // 初始观察
  BUILDING = "building",         // 逐步构建
  CONNECTING = "connecting",     // 连接想法
  EVOLVING = "evolving",         // 演进理解
  REFINING = "refining",         // 精炼思考
  CONSOLIDATED = "consolidated", // 巩固理解
}

/**
 * 理解快照
 */
export interface UnderstandingSnapshot {
  id: string;
  phase: UnderstandingPhase;
  timestamp: number;
  observations: string[];
  insights: string[];
  connections: string[];
  openQuestions: string[];
  confidence: number;
  hypotheses: Hypothesis[];
  metadata: Record<string, unknown>;
}

/**
 * 理解演进记录
 */
export interface UnderstandingEvolution {
  from: UnderstandingPhase;
  to: UnderstandingPhase;
  trigger: string;
  newInsights: string[];
  refinedUnderstanding: string;
  confidenceChange: number;
}

/**
 * 连接发现
 */
export interface ConnectionDiscovery {
  source: string;
  target: string;
  connectionType: "causal" | "correlational" | "conceptual" | "temporal";
  strength: number;
  description: string;
  discoveredAt: number;
}

/**
 * 理解差距
 */
export interface UnderstandingGap {
  id: string;
  description: string;
  importance: number;
  possibleApproaches: string[];
  status: "open" | "investigating" | "resolved";
  resolvedAt?: number;
  resolution?: string;
}

/**
 * 渐进式理解状态
 */
export interface ProgressiveUnderstandingState {
  currentPhase: UnderstandingPhase;
  snapshots: UnderstandingSnapshot[];
  evolutions: UnderstandingEvolution[];
  connections: ConnectionDiscovery[];
  gaps: UnderstandingGap[];
  totalInsights: number;
  totalConnections: number;
  averageConfidence: number;
  understandingDepth: number;
}

/**
 * 渐进式理解配置
 */
export interface ProgressiveUnderstandingConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 快照间隔（思考步骤数） */
  snapshotInterval: number;
  /** 最小置信度阈值 */
  minConfidenceThreshold: number;
  /** 最大理解深度 */
  maxUnderstandingDepth: number;
  /** 是否自动检测差距 */
  autoDetectGaps: boolean;
  /** 是否追踪连接 */
  trackConnections: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveUnderstandingConfig = {
  enabled: true,
  snapshotInterval: 3,
  minConfidenceThreshold: 0.5,
  maxUnderstandingDepth: 10,
  autoDetectGaps: true,
  trackConnections: true,
};

// ==================== 渐进式理解追踪器 ====================

export class ProgressiveUnderstandingTracker {
  private config: ProgressiveUnderstandingConfig;
  private state: ProgressiveUnderstandingState;
  private stepCount: number = 0;
  private snapshotIdCounter: number = 0;
  private gapIdCounter: number = 0;

  constructor(config: Partial<ProgressiveUnderstandingConfig> = {}) {
    this.config = { ...DEFAULT_PROGRESSIVE_CONFIG, ...config };
    this.state = this.initializeState();
  }

  /**
   * 初始化状态
   */
  private initializeState(): ProgressiveUnderstandingState {
    return {
      currentPhase: UnderstandingPhase.INITIAL,
      snapshots: [],
      evolutions: [],
      connections: [],
      gaps: [],
      totalInsights: 0,
      totalConnections: 0,
      averageConfidence: 0,
      understandingDepth: 0,
    };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = this.initializeState();
    this.stepCount = 0;
    this.snapshotIdCounter = 0;
    this.gapIdCounter = 0;
  }

  /**
   * 记录初始观察
   */
  recordInitialObservations(
    observations: string[],
    context: ThinkingContext
  ): UnderstandingSnapshot {
    const snapshot: UnderstandingSnapshot = {
      id: `snapshot_${++this.snapshotIdCounter}`,
      phase: UnderstandingPhase.INITIAL,
      timestamp: Date.now(),
      observations,
      insights: [],
      connections: [],
      openQuestions: this.generateInitialQuestions(observations),
      confidence: 0.3,
      hypotheses: [],
      metadata: { context: context.message.id },
    };

    this.state.snapshots.push(snapshot);
    this.state.currentPhase = UnderstandingPhase.INITIAL;
    this.updateAverageConfidence();

    return snapshot;
  }

  /**
   * 生成初始问题
   */
  private generateInitialQuestions(observations: string[]): string[] {
    const questions: string[] = [];
    
    for (const obs of observations) {
      if (obs.includes("?") || obs.includes("？")) {
        questions.push(obs);
      } else {
        questions.push(`${obs} 的原因是什么？`);
        questions.push(`${obs} 会带来什么影响？`);
      }
    }

    return questions.slice(0, 5);
  }

  /**
   * 构建理解
   */
  buildUnderstanding(
    newInsights: string[],
    context: ThinkingContext
  ): UnderstandingSnapshot | null {
    if (!this.config.enabled) return null;

    this.stepCount++;
    
    // 检查是否需要创建快照
    if (this.stepCount % this.config.snapshotInterval !== 0) {
      return null;
    }

    const previousSnapshot = this.state.snapshots[this.state.snapshots.length - 1];
    const newPhase = this.determineNextPhase(previousSnapshot?.phase);

    const snapshot: UnderstandingSnapshot = {
      id: `snapshot_${++this.snapshotIdCounter}`,
      phase: newPhase,
      timestamp: Date.now(),
      observations: previousSnapshot?.observations || [],
      insights: [...(previousSnapshot?.insights || []), ...newInsights],
      connections: previousSnapshot?.connections || [],
      openQuestions: this.updateOpenQuestions(
        previousSnapshot?.openQuestions || [],
        newInsights
      ),
      confidence: this.calculateNewConfidence(previousSnapshot?.confidence || 0.3, newInsights),
      hypotheses: previousSnapshot?.hypotheses || [],
      metadata: { stepCount: this.stepCount },
    };

    // 记录演进
    if (previousSnapshot && newPhase !== previousSnapshot.phase) {
      this.recordEvolution(previousSnapshot.phase, newPhase, newInsights);
    }

    this.state.snapshots.push(snapshot);
    this.state.currentPhase = newPhase;
    this.state.totalInsights += newInsights.length;
    this.updateAverageConfidence();

    return snapshot;
  }

  /**
   * 确定下一阶段
   */
  private determineNextPhase(currentPhase?: UnderstandingPhase): UnderstandingPhase {
    const phaseOrder = [
      UnderstandingPhase.INITIAL,
      UnderstandingPhase.BUILDING,
      UnderstandingPhase.CONNECTING,
      UnderstandingPhase.EVOLVING,
      UnderstandingPhase.REFINING,
      UnderstandingPhase.CONSOLIDATED,
    ];

    if (!currentPhase) return UnderstandingPhase.BUILDING;

    const currentIndex = phaseOrder.indexOf(currentPhase);
    
    // 70% 概率前进，30% 概率保持
    if (Math.random() < 0.7 && currentIndex < phaseOrder.length - 1) {
      return phaseOrder[currentIndex + 1];
    }

    return currentPhase;
  }

  /**
   * 更新开放问题
   */
  private updateOpenQuestions(
    currentQuestions: string[],
    newInsights: string[]
  ): string[] {
    // 移除已回答的问题
    const remainingQuestions = currentQuestions.filter(q => {
      const isAnswered = newInsights.some(insight => 
        this.isQuestionAnsweredByInsight(q, insight)
      );
      return !isAnswered;
    });

    // 添加新问题
    const newQuestions = newInsights
      .filter(insight => insight.includes("?") || insight.includes("？"))
      .slice(0, 2);

    return [...remainingQuestions, ...newQuestions].slice(0, 10);
  }

  /**
   * 检查问题是否被洞察回答
   */
  private isQuestionAnsweredByInsight(question: string, insight: string): boolean {
    // 简化的匹配逻辑
    const questionKeywords = question.toLowerCase().split(/\s+/);
    const insightKeywords = insight.toLowerCase().split(/\s+/);
    
    const commonKeywords = questionKeywords.filter(k => 
      k.length > 2 && insightKeywords.includes(k)
    );
    
    return commonKeywords.length >= 2;
  }

  /**
   * 计算新置信度
   */
  private calculateNewConfidence(
    currentConfidence: number,
    newInsights: string[]
  ): number {
    const insightBoost = newInsights.length * 0.05;
    return Math.min(0.95, currentConfidence + insightBoost);
  }

  /**
   * 记录演进
   */
  private recordEvolution(
    from: UnderstandingPhase,
    to: UnderstandingPhase,
    newInsights: string[]
  ): void {
    const evolution: UnderstandingEvolution = {
      from,
      to,
      trigger: `获得 ${newInsights.length} 个新洞察`,
      newInsights,
      refinedUnderstanding: this.summarizeUnderstanding(newInsights),
      confidenceChange: 0.1,
    };

    this.state.evolutions.push(evolution);
  }

  /**
   * 总结理解
   */
  private summarizeUnderstanding(insights: string[]): string {
    if (insights.length === 0) return "暂无新理解";
    if (insights.length === 1) return insights[0];
    return `综合理解: ${insights.slice(0, 2).join("; ")}`;
  }

  /**
   * 发现连接
   */
  discoverConnection(
    source: string,
    target: string,
    connectionType: ConnectionDiscovery["connectionType"]
  ): ConnectionDiscovery | null {
    if (!this.config.trackConnections) return null;

    // 检查是否已存在
    const exists = this.state.connections.some(
      c => (c.source === source && c.target === target) ||
           (c.source === target && c.target === source)
    );

    if (exists) return null;

    const connection: ConnectionDiscovery = {
      source,
      target,
      connectionType,
      strength: this.calculateConnectionStrength(source, target),
      description: `${source} 与 ${target} 存在${this.getConnectionTypeName(connectionType)}关系`,
      discoveredAt: Date.now(),
    };

    this.state.connections.push(connection);
    this.state.totalConnections++;

    return connection;
  }

  /**
   * 计算连接强度
   */
  private calculateConnectionStrength(source: string, target: string): number {
    // 基于词汇重叠计算
    const sourceWords = source.toLowerCase().split(/\s+/);
    const targetWords = target.toLowerCase().split(/\s+/);
    const commonWords = sourceWords.filter(w => targetWords.includes(w));
    return Math.min(1, commonWords.length * 0.2 + 0.3);
  }

  /**
   * 获取连接类型名称
   */
  private getConnectionTypeName(type: ConnectionDiscovery["connectionType"]): string {
    const names: Record<ConnectionDiscovery["connectionType"], string> = {
      causal: "因果",
      correlational: "相关",
      conceptual: "概念",
      temporal: "时间",
    };
    return names[type];
  }

  /**
   * 检测理解差距
   */
  detectGaps(): UnderstandingGap[] {
    if (!this.config.autoDetectGaps) return [];

    const gaps: UnderstandingGap[] = [];
    const lastSnapshot = this.state.snapshots[this.state.snapshots.length - 1];

    if (!lastSnapshot) return [];

    // 检测未回答的问题
    for (const question of lastSnapshot.openQuestions) {
      const gap: UnderstandingGap = {
        id: `gap_${++this.gapIdCounter}`,
        description: `未解答: ${question}`,
        importance: 0.7,
        possibleApproaches: [
          "收集更多信息",
          "进行假设验证",
          "寻求专家意见",
        ],
        status: "open",
      };
      gaps.push(gap);
      this.state.gaps.push(gap);
    }

    // 检测低置信度领域
    if (lastSnapshot.confidence < this.config.minConfidenceThreshold) {
      const gap: UnderstandingGap = {
        id: `gap_${++this.gapIdCounter}`,
        description: "整体理解置信度较低",
        importance: 0.9,
        possibleApproaches: [
          "重新审视假设",
          "收集更多证据",
          "进行验证测试",
        ],
        status: "open",
      };
      gaps.push(gap);
      this.state.gaps.push(gap);
    }

    return gaps;
  }

  /**
   * 解决差距
   */
  resolveGap(gapId: string, resolution: string): void {
    const gap = this.state.gaps.find(g => g.id === gapId);
    if (gap) {
      gap.status = "resolved";
      gap.resolvedAt = Date.now();
      gap.resolution = resolution;
    }
  }

  /**
   * 更新平均置信度
   */
  private updateAverageConfidence(): void {
    if (this.state.snapshots.length === 0) {
      this.state.averageConfidence = 0;
      return;
    }

    const totalConfidence = this.state.snapshots.reduce(
      (sum, s) => sum + s.confidence,
      0
    );
    this.state.averageConfidence = totalConfidence / this.state.snapshots.length;
  }

  /**
   * 获取当前状态
   */
  getState(): ProgressiveUnderstandingState {
    return { ...this.state };
  }

  /**
   * 获取当前阶段
   */
  getCurrentPhase(): UnderstandingPhase {
    return this.state.currentPhase;
  }

  /**
   * 获取最新快照
   */
  getLatestSnapshot(): UnderstandingSnapshot | null {
    return this.state.snapshots[this.state.snapshots.length - 1] || null;
  }

  /**
   * 获取理解深度
   */
  getUnderstandingDepth(): number {
    return this.state.understandingDepth;
  }

  /**
   * 增加理解深度
   */
  increaseUnderstandingDepth(): void {
    if (this.state.understandingDepth < this.config.maxUnderstandingDepth) {
      this.state.understandingDepth++;
    }
  }

  /**
   * 生成理解报告
   */
  generateReport(): string {
    const lines: string[] = [
      `## 渐进式理解报告`,
      ``,
      `**当前阶段**: ${this.getPhaseName(this.state.currentPhase)}`,
      `**理解深度**: ${this.state.understandingDepth}`,
      `**平均置信度**: ${(this.state.averageConfidence * 100).toFixed(1)}%`,
      `**总洞察数**: ${this.state.totalInsights}`,
      `**总连接数**: ${this.state.totalConnections}`,
      ``,
      `### 理解演进`,
    ];

    for (const evolution of this.state.evolutions) {
      lines.push(`- ${this.getPhaseName(evolution.from)} → ${this.getPhaseName(evolution.to)}: ${evolution.trigger}`);
    }

    if (this.state.gaps.length > 0) {
      lines.push(``, `### 理解差距`);
      for (const gap of this.state.gaps.filter(g => g.status === "open")) {
        lines.push(`- [ ] ${gap.description}`);
      }
      for (const gap of this.state.gaps.filter(g => g.status === "resolved")) {
        lines.push(`- [x] ${gap.description} → ${gap.resolution}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * 获取阶段名称
   */
  private getPhaseName(phase: UnderstandingPhase): string {
    const names: Record<UnderstandingPhase, string> = {
      [UnderstandingPhase.INITIAL]: "初始观察",
      [UnderstandingPhase.BUILDING]: "逐步构建",
      [UnderstandingPhase.CONNECTING]: "连接想法",
      [UnderstandingPhase.EVOLVING]: "演进理解",
      [UnderstandingPhase.REFINING]: "精炼思考",
      [UnderstandingPhase.CONSOLIDATED]: "巩固理解",
    };
    return names[phase];
  }
}

// 导出单例
export const progressiveUnderstandingTracker = new ProgressiveUnderstandingTracker();
