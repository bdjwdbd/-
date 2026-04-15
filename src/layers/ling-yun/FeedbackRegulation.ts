/**
 * 反馈调节引擎 - L5 灵韵层核心
 * 
 * 职责：
 * - 质量评估：输出质量、响应质量评估
 * - 反馈收集：用户反馈、系统反馈收集
 * - 自适应调节：根据反馈调整参数
 * - 持续改进：记录改进点、追踪改进效果
 */

// ============================================================
// 类型定义
// ============================================================

export type FeedbackType = "positive" | "negative" | "neutral" | "suggestion";

export type QualityDimension = 
  | "accuracy"      // 准确性
  | "relevance"     // 相关性
  | "completeness"  // 完整性
  | "clarity"       // 清晰度
  | "timeliness"    // 及时性
  | "helpfulness";  // 有用性

export interface Feedback {
  id: string;
  type: FeedbackType;
  source: "user" | "system" | "auto";
  target: string;
  content: string;
  ratings: Partial<Record<QualityDimension, number>>;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface QualityScore {
  overall: number;
  dimensions: Record<QualityDimension, number>;
  trend: "improving" | "stable" | "declining";
  confidence: number;
}

export interface Adjustment {
  parameter: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  timestamp: Date;
}

export interface ImprovementRecord {
  id: string;
  area: string;
  description: string;
  status: "identified" | "planned" | "in_progress" | "completed" | "verified";
  impact: "low" | "medium" | "high";
  createdAt: Date;
  completedAt?: Date;
  metrics?: {
    before: number;
    after: number;
    improvement: number;
  };
}

// ============================================================
// 反馈收集器
// ============================================================

export class FeedbackCollector {
  private feedbacks: Feedback[] = [];
  private maxFeedbacks: number = 1000;

  /**
   * 收集反馈
   */
  collect(feedback: Omit<Feedback, "id" | "timestamp">): Feedback {
    const newFeedback: Feedback = {
      ...feedback,
      id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date(),
    };

    this.feedbacks.push(newFeedback);

    // 限制数量
    if (this.feedbacks.length > this.maxFeedbacks) {
      this.feedbacks.shift();
    }

    return newFeedback;
  }

  /**
   * 获取反馈
   */
  getFeedbacks(filter?: {
    type?: FeedbackType;
    source?: "user" | "system" | "auto";
    target?: string;
    since?: Date;
  }): Feedback[] {
    let result = [...this.feedbacks];

    if (filter) {
      if (filter.type) {
        result = result.filter((f) => f.type === filter.type);
      }
      if (filter.source) {
        result = result.filter((f) => f.source === filter.source);
      }
      if (filter.target) {
        result = result.filter((f) => f.target === filter.target);
      }
      if (filter.since) {
        result = result.filter((f) => f.timestamp >= filter.since!);
      }
    }

    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取统计
   */
  getStatistics(since?: Date): {
    total: number;
    byType: Record<FeedbackType, number>;
    bySource: Record<"user" | "system" | "auto", number>;
    averageRatings: Partial<Record<QualityDimension, number>>;
  } {
    const feedbacks = since ? this.feedbacks.filter((f) => f.timestamp >= since) : this.feedbacks;

    const byType: Record<FeedbackType, number> = {
      positive: 0,
      negative: 0,
      neutral: 0,
      suggestion: 0,
    };

    const bySource: Record<"user" | "system" | "auto", number> = {
      user: 0,
      system: 0,
      auto: 0,
    };

    const ratingSums: Partial<Record<QualityDimension, number[]>> = {};

    for (const f of feedbacks) {
      byType[f.type]++;
      bySource[f.source]++;

      for (const [dim, rating] of Object.entries(f.ratings)) {
        if (!ratingSums[dim as QualityDimension]) {
          ratingSums[dim as QualityDimension] = [];
        }
        ratingSums[dim as QualityDimension]!.push(rating);
      }
    }

    const averageRatings: Partial<Record<QualityDimension, number>> = {};
    for (const [dim, ratings] of Object.entries(ratingSums)) {
      if (ratings.length > 0) {
        averageRatings[dim as QualityDimension] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      }
    }

    return {
      total: feedbacks.length,
      byType,
      bySource,
      averageRatings,
    };
  }
}

// ============================================================
// 质量评估器
// ============================================================

export class QualityAssessor {
  private history: QualityScore[] = [];
  private maxHistory: number = 100;

  /**
   * 评估质量
   */
  assess(target: string, feedbacks: Feedback[]): QualityScore {
    const relevantFeedbacks = feedbacks.filter((f) => f.target === target);

    // 计算各维度分数
    const dimensions: Record<QualityDimension, number> = {
      accuracy: this.calculateDimension(relevantFeedbacks, "accuracy"),
      relevance: this.calculateDimension(relevantFeedbacks, "relevance"),
      completeness: this.calculateDimension(relevantFeedbacks, "completeness"),
      clarity: this.calculateDimension(relevantFeedbacks, "clarity"),
      timeliness: this.calculateDimension(relevantFeedbacks, "timeliness"),
      helpfulness: this.calculateDimension(relevantFeedbacks, "helpfulness"),
    };

    // 计算总体分数
    const overall = Object.values(dimensions).reduce((a, b) => a + b, 0) / 6;

    // 计算趋势
    const trend = this.calculateTrend(overall);

    // 计算置信度
    const confidence = Math.min(relevantFeedbacks.length / 10, 1);

    const score: QualityScore = {
      overall,
      dimensions,
      trend,
      confidence,
    };

    this.history.push(score);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return score;
  }

  /**
   * 计算维度分数
   */
  private calculateDimension(feedbacks: Feedback[], dimension: QualityDimension): number {
    const ratings = feedbacks
      .filter((f) => f.ratings[dimension] !== undefined)
      .map((f) => f.ratings[dimension]!);

    if (ratings.length === 0) {
      return 0.7; // 默认分数
    }

    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  }

  /**
   * 计算趋势
   */
  private calculateTrend(currentScore: number): "improving" | "stable" | "declining" {
    if (this.history.length < 3) {
      return "stable";
    }

    const recent = this.history.slice(-5);
    const avgRecent = recent.reduce((a, b) => a + b.overall, 0) / recent.length;
    const avgOlder = this.history.slice(0, -5).reduce((a, b) => a + b.overall, 0) / Math.max(this.history.length - 5, 1);

    const diff = avgRecent - avgOlder;
    if (diff > 0.05) return "improving";
    if (diff < -0.05) return "declining";
    return "stable";
  }

  /**
   * 获取历史
   */
  getHistory(): QualityScore[] {
    return [...this.history];
  }
}

// ============================================================
// 自适应调节器
// ============================================================

export class AdaptiveRegulator {
  private parameters: Map<string, unknown> = new Map();
  private adjustments: Adjustment[] = [];
  private maxAdjustments: number = 500;

  constructor() {
    // 初始化默认参数
    this.parameters.set("responseLength", "medium");
    this.parameters.set("detailLevel", "normal");
    this.parameters.set("formality", "neutral");
    this.parameters.set("proactivity", "moderate");
    this.parameters.set("creativity", "balanced");
  }

  /**
   * 获取参数
   */
  getParameter(key: string): unknown {
    return this.parameters.get(key);
  }

  /**
   * 设置参数
   */
  setParameter(key: string, value: unknown, reason: string): void {
    const oldValue = this.parameters.get(key);
    this.parameters.set(key, value);

    this.adjustments.push({
      parameter: key,
      oldValue,
      newValue: value,
      reason,
      timestamp: new Date(),
    });

    if (this.adjustments.length > this.maxAdjustments) {
      this.adjustments.shift();
    }
  }

  /**
   * 根据反馈自动调节
   */
  autoAdjust(feedbacks: Feedback[]): Adjustment[] {
    const adjustments: Adjustment[] = [];
    const stats = this.calculateFeedbackStats(feedbacks);

    // 根据负面反馈调整
    if (stats.negativeRatio > 0.3) {
      // 负面反馈过多，降低主动性
      const current = this.parameters.get("proactivity");
      if (current !== "low") {
        this.setParameter("proactivity", "low", "负面反馈过多，降低主动性");
        adjustments.push(this.adjustments[this.adjustments.length - 1]);
      }
    }

    // 根据正面反馈调整
    if (stats.positiveRatio > 0.7) {
      // 正面反馈多，可以更主动
      const current = this.parameters.get("proactivity");
      if (current === "low") {
        this.setParameter("proactivity", "moderate", "正面反馈多，恢复正常主动性");
        adjustments.push(this.adjustments[this.adjustments.length - 1]);
      }
    }

    // 根据建议调整
    if (stats.suggestionCount > 5) {
      // 有较多建议，提高详细程度
      const current = this.parameters.get("detailLevel");
      if (current !== "high") {
        this.setParameter("detailLevel", "high", "用户建议较多，提高详细程度");
        adjustments.push(this.adjustments[this.adjustments.length - 1]);
      }
    }

    return adjustments;
  }

  /**
   * 计算反馈统计
   */
  private calculateFeedbackStats(feedbacks: Feedback[]): {
    positiveRatio: number;
    negativeRatio: number;
    suggestionCount: number;
  } {
    const total = feedbacks.length || 1;
    const positive = feedbacks.filter((f) => f.type === "positive").length;
    const negative = feedbacks.filter((f) => f.type === "negative").length;
    const suggestions = feedbacks.filter((f) => f.type === "suggestion").length;

    return {
      positiveRatio: positive / total,
      negativeRatio: negative / total,
      suggestionCount: suggestions,
    };
  }

  /**
   * 获取调整历史
   */
  getAdjustments(limit: number = 50): Adjustment[] {
    return this.adjustments.slice(-limit);
  }

  /**
   * 获取所有参数
   */
  getAllParameters(): Record<string, unknown> {
    return Object.fromEntries(this.parameters);
  }
}

// ============================================================
// 持续改进追踪器
// ============================================================

export class ImprovementTracker {
  private records: ImprovementRecord[] = [];
  private maxRecords: number = 200;

  /**
   * 记录改进点
   */
  identify(area: string, description: string, impact: "low" | "medium" | "high" = "medium"): ImprovementRecord {
    const record: ImprovementRecord = {
      id: `imp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      area,
      description,
      status: "identified",
      impact,
      createdAt: new Date(),
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    return record;
  }

  /**
   * 更新状态
   */
  updateStatus(id: string, status: ImprovementRecord["status"]): boolean {
    const record = this.records.find((r) => r.id === id);
    if (!record) return false;

    record.status = status;
    if (status === "completed" || status === "verified") {
      record.completedAt = new Date();
    }

    return true;
  }

  /**
   * 记录改进效果
   */
  recordMetrics(id: string, before: number, after: number): boolean {
    const record = this.records.find((r) => r.id === id);
    if (!record) return false;

    record.metrics = {
      before,
      after,
      improvement: after - before,
    };

    return true;
  }

  /**
   * 获取改进记录
   */
  getRecords(filter?: {
    area?: string;
    status?: ImprovementRecord["status"];
    impact?: "low" | "medium" | "high";
  }): ImprovementRecord[] {
    let result = [...this.records];

    if (filter) {
      if (filter.area) {
        result = result.filter((r) => r.area === filter.area);
      }
      if (filter.status) {
        result = result.filter((r) => r.status === filter.status);
      }
      if (filter.impact) {
        result = result.filter((r) => r.impact === filter.impact);
      }
    }

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 获取改进统计
   */
  getStatistics(): {
    total: number;
    byStatus: Record<ImprovementRecord["status"], number>;
    byImpact: Record<"low" | "medium" | "high", number>;
    averageImprovement: number;
  } {
    const byStatus: Record<ImprovementRecord["status"], number> = {
      identified: 0,
      planned: 0,
      in_progress: 0,
      completed: 0,
      verified: 0,
    };

    const byImpact: Record<"low" | "medium" | "high", number> = {
      low: 0,
      medium: 0,
      high: 0,
    };

    let totalImprovement = 0;
    let improvementCount = 0;

    for (const r of this.records) {
      byStatus[r.status]++;
      byImpact[r.impact]++;

      if (r.metrics) {
        totalImprovement += r.metrics.improvement;
        improvementCount++;
      }
    }

    return {
      total: this.records.length,
      byStatus,
      byImpact,
      averageImprovement: improvementCount > 0 ? totalImprovement / improvementCount : 0,
    };
  }
}

// ============================================================
// 反馈调节系统
// ============================================================

export class FeedbackRegulationSystem {
  private collector: FeedbackCollector;
  private assessor: QualityAssessor;
  private regulator: AdaptiveRegulator;
  private tracker: ImprovementTracker;

  constructor() {
    this.collector = new FeedbackCollector();
    this.assessor = new QualityAssessor();
    this.regulator = new AdaptiveRegulator();
    this.tracker = new ImprovementTracker();
  }

  /**
   * 收集反馈
   */
  collectFeedback(feedback: Omit<Feedback, "id" | "timestamp">): Feedback {
    const fb = this.collector.collect(feedback);

    // 触发自动调节
    const recentFeedbacks = this.collector.getFeedbacks({ since: new Date(Date.now() - 3600000) });
    this.regulator.autoAdjust(recentFeedbacks);

    return fb;
  }

  /**
   * 评估质量
   */
  assessQuality(target: string): QualityScore {
    const feedbacks = this.collector.getFeedbacks({ target });
    return this.assessor.assess(target, feedbacks);
  }

  /**
   * 识别改进点
   */
  identifyImprovement(area: string, description: string, impact?: "low" | "medium" | "high"): ImprovementRecord {
    return this.tracker.identify(area, description, impact);
  }

  /**
   * 获取当前参数
   */
  getCurrentParameters(): Record<string, unknown> {
    return this.regulator.getAllParameters();
  }

  /**
   * 获取组件
   */
  getCollector(): FeedbackCollector {
    return this.collector;
  }

  getAssessor(): QualityAssessor {
    return this.assessor;
  }

  getRegulator(): AdaptiveRegulator {
    return this.regulator;
  }

  getTracker(): ImprovementTracker {
    return this.tracker;
  }
}

// ============================================================
// 单例导出
// ============================================================

let feedbackSystemInstance: FeedbackRegulationSystem | null = null;

export function getFeedbackRegulationSystem(): FeedbackRegulationSystem {
  if (!feedbackSystemInstance) {
    feedbackSystemInstance = new FeedbackRegulationSystem();
  }
  return feedbackSystemInstance;
}
