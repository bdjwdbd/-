/**
 * 动态权重系统
 * 
 * 功能：
 * 1. 向量/FTS 权重自适应
 * 2. 基于查询特征调整权重
 * 3. 基于历史反馈优化权重
 */

// ============================================================
// 类型定义
// ============================================================

export interface SearchWeights {
  vector: number;      // 向量搜索权重
  fts: number;         // FTS 权重
  llm: number;         // LLM 重排序权重
}

export interface WeightAdjustment {
  factor: number;      // 调整因子
  reason: string;      // 调整原因
}

export interface WeightConfig {
  defaultWeights: SearchWeights;
  minVectorWeight: number;
  maxVectorWeight: number;
  minFTSWeight: number;
  maxFTSWeight: number;
  learningRate: number;
}

export interface FeedbackRecord {
  query: string;
  weights: SearchWeights;
  clicked: boolean;
  position: number;
  timestamp: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: WeightConfig = {
  defaultWeights: {
    vector: 0.6,
    fts: 0.3,
    llm: 0.1,
  },
  minVectorWeight: 0.3,
  maxVectorWeight: 0.8,
  minFTSWeight: 0.1,
  maxFTSWeight: 0.5,
  learningRate: 0.05,
};

// ============================================================
// 动态权重管理器
// ============================================================

export class DynamicWeights {
  private config: WeightConfig;
  private currentWeights: SearchWeights;
  private feedbackHistory: FeedbackRecord[] = [];
  private queryTypeWeights: Map<string, SearchWeights> = new Map();

  constructor(config: Partial<WeightConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentWeights = { ...this.config.defaultWeights };

    // 初始化查询类型权重
    this.initQueryTypeWeights();
  }

  /**
   * 初始化查询类型权重
   */
  private initQueryTypeWeights(): void {
    // 精确匹配查询：FTS 权重更高
    this.queryTypeWeights.set('exact', {
      vector: 0.3,
      fts: 0.6,
      llm: 0.1,
    });

    // 语义查询：向量权重更高
    this.queryTypeWeights.set('semantic', {
      vector: 0.7,
      fts: 0.2,
      llm: 0.1,
    });

    // 混合查询：平衡权重
    this.queryTypeWeights.set('hybrid', {
      vector: 0.5,
      fts: 0.4,
      llm: 0.1,
    });

    // 复杂查询：LLM 权重更高
    this.queryTypeWeights.set('complex', {
      vector: 0.4,
      fts: 0.3,
      llm: 0.3,
    });
  }

  /**
   * 获取当前权重
   */
  getWeights(): SearchWeights {
    return { ...this.currentWeights };
  }

  /**
   * 根据查询类型调整权重
   */
  adjustForQuery(query: string, queryType: string): SearchWeights {
    const typeWeights = this.queryTypeWeights.get(queryType);
    if (typeWeights) {
      this.currentWeights = { ...typeWeights };
    }

    // 根据查询特征微调
    const adjustments = this.analyzeQueryFeatures(query);
    this.applyAdjustments(adjustments);

    return this.getWeights();
  }

  /**
   * 分析查询特征
   */
  private analyzeQueryFeatures(query: string): WeightAdjustment[] {
    const adjustments: WeightAdjustment[] = [];

    // 长查询：增加向量权重
    if (query.length > 50) {
      adjustments.push({
        factor: 1.2,
        reason: '长查询，增加语义匹配权重',
      });
    }

    // 包含专业术语：增加 FTS 权重
    if (/[A-Z]{2,}|[a-z]+_[a-z]+/.test(query)) {
      adjustments.push({
        factor: 0.8,
        reason: '包含专业术语，增加精确匹配权重',
      });
    }

    // 包含中文：增加向量权重
    if (/[\u4e00-\u9fa5]/.test(query)) {
      adjustments.push({
        factor: 1.1,
        reason: '中文查询，增加语义匹配权重',
      });
    }

    return adjustments;
  }

  /**
   * 应用调整
   */
  private applyAdjustments(adjustments: WeightAdjustment[]): void {
    for (const adj of adjustments) {
      this.currentWeights.vector *= adj.factor;
      this.currentWeights.fts /= adj.factor;
    }

    // 归一化
    this.normalizeWeights();
  }

  /**
   * 归一化权重
   */
  private normalizeWeights(): void {
    const total = this.currentWeights.vector + this.currentWeights.fts + this.currentWeights.llm;
    this.currentWeights.vector /= total;
    this.currentWeights.fts /= total;
    this.currentWeights.llm /= total;

    // 应用边界约束
    this.currentWeights.vector = Math.max(
      this.config.minVectorWeight,
      Math.min(this.config.maxVectorWeight, this.currentWeights.vector)
    );
    this.currentWeights.fts = Math.max(
      this.config.minFTSWeight,
      Math.min(this.config.maxFTSWeight, this.currentWeights.fts)
    );
  }

  /**
   * 记录反馈
   */
  recordFeedback(record: FeedbackRecord): void {
    this.feedbackHistory.push(record);

    // 保留最近 1000 条记录
    if (this.feedbackHistory.length > 1000) {
      this.feedbackHistory = this.feedbackHistory.slice(-1000);
    }

    // 学习反馈
    this.learnFromFeedback();
  }

  /**
   * 从反馈学习
   */
  private learnFromFeedback(): void {
    if (this.feedbackHistory.length < 10) {
      return;
    }

    // 计算最近反馈的平均效果
    const recentFeedback = this.feedbackHistory.slice(-100);
    const clickedRecords = recentFeedback.filter(r => r.clicked);
    
    if (clickedRecords.length < 5) {
      return;
    }

    // 计算有效权重
    const avgVectorWeight = clickedRecords.reduce((sum, r) => sum + r.weights.vector, 0) / clickedRecords.length;
    const avgFTSWeight = clickedRecords.reduce((sum, r) => sum + r.weights.fts, 0) / clickedRecords.length;

    // 渐进调整
    const lr = this.config.learningRate;
    this.currentWeights.vector = this.currentWeights.vector * (1 - lr) + avgVectorWeight * lr;
    this.currentWeights.fts = this.currentWeights.fts * (1 - lr) + avgFTSWeight * lr;

    this.normalizeWeights();
  }

  /**
   * 重置权重
   */
  reset(): void {
    this.currentWeights = { ...this.config.defaultWeights };
    this.feedbackHistory = [];
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    currentWeights: SearchWeights;
    feedbackCount: number;
    clickRate: number;
  } {
    const clickedCount = this.feedbackHistory.filter(r => r.clicked).length;
    return {
      currentWeights: this.getWeights(),
      feedbackCount: this.feedbackHistory.length,
      clickRate: this.feedbackHistory.length > 0 
        ? clickedCount / this.feedbackHistory.length 
        : 0,
    };
  }
}
