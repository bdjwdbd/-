/**
 * 记忆增强自我改进引擎
 * 
 * 在原有自我改进引擎基础上，集成 ML 遗忘检测器
 * 实现基于用户反馈的持续学习
 */

import { MLForgetDetector, ForgetFeatures, MLPrediction } from '../../infrastructure/ml-forget-detector';

/**
 * 学习记录
 */
export interface LearningRecord {
  id: string;
  timestamp: number;
  type: "success" | "failure" | "insight" | "correction" | "forget_feedback";
  context: string;
  lesson: string;
  actionItems: string[];
  applied: boolean;
  // 新增：遗忘反馈
  forgetFeedback?: {
    memoryId: string;
    shouldForget: boolean;
    userAction: 'forget' | 'keep' | 'unsure';
  };
}

/**
 * 改进建议
 */
export interface ImprovementSuggestion {
  id: string;
  area: string;
  current: string;
  suggested: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}

/**
 * 遗忘反馈统计
 */
export interface ForgetFeedbackStats {
  totalFeedback: number;
  forgetCount: number;
  keepCount: number;
  accuracy: number;
}

/**
 * 记忆增强自我改进引擎
 */
export class MemoryEnhancedSelfImprovementEngine {
  private learningHistory: LearningRecord[] = [];
  private suggestions: ImprovementSuggestion[] = [];
  private maxHistory = 1000;
  
  // ML 遗忘检测器
  private forgetDetector: MLForgetDetector | null = null;
  
  // 遗忘反馈统计
  private forgetFeedbackStats: ForgetFeedbackStats = {
    totalFeedback: 0,
    forgetCount: 0,
    keepCount: 0,
    accuracy: 0,
  };

  /**
   * 设置遗忘检测器
   */
  setForgetDetector(detector: MLForgetDetector): void {
    this.forgetDetector = detector;
  }

  /**
   * 获取遗忘检测器
   */
  getForgetDetector(): MLForgetDetector | null {
    return this.forgetDetector;
  }

  /**
   * 记录学习
   */
  recordLearning(
    type: LearningRecord["type"],
    context: string,
    lesson: string,
    actionItems: string[] = []
  ): LearningRecord {
    const record: LearningRecord = {
      id: `learn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type,
      context,
      lesson,
      actionItems,
      applied: false,
    };

    this.learningHistory.push(record);

    // 限制历史大小
    if (this.learningHistory.length > this.maxHistory) {
      this.learningHistory = this.learningHistory.slice(-this.maxHistory);
    }

    // 自动生成改进建议
    if (type === "failure" || type === "correction") {
      this.generateSuggestion(record);
    }

    return record;
  }

  /**
   * 记录遗忘反馈（新增）
   */
  recordForgetFeedback(
    memoryId: string,
    features: ForgetFeatures,
    shouldForget: boolean,
    userAction: 'forget' | 'keep' | 'unsure'
  ): LearningRecord {
    // 更新统计
    this.forgetFeedbackStats.totalFeedback++;
    if (userAction === 'forget') {
      this.forgetFeedbackStats.forgetCount++;
    } else if (userAction === 'keep') {
      this.forgetFeedbackStats.keepCount++;
    }

    // 计算准确率
    const correctPredictions = this.learningHistory
      .filter(r => r.forgetFeedback)
      .filter(r => {
        const feedback = r.forgetFeedback!;
        // 如果用户选择与预测一致，则准确
        return (feedback.userAction === 'forget' && feedback.shouldForget) ||
               (feedback.userAction === 'keep' && !feedback.shouldForget);
      }).length;
    
    if (this.forgetFeedbackStats.totalFeedback > 0) {
      this.forgetFeedbackStats.accuracy = correctPredictions / this.forgetFeedbackStats.totalFeedback;
    }

    // 添加训练样本到遗忘检测器
    if (this.forgetDetector) {
      const actualShouldForget = userAction === 'forget';
      this.forgetDetector.addTrainingSample(features, actualShouldForget);
    }

    // 记录学习
    return this.recordLearning(
      'forget_feedback',
      `记忆遗忘反馈: ${memoryId}`,
      `用户选择${userAction === 'forget' ? '遗忘' : '保留'}该记忆`,
      []
    );
  }

  /**
   * 批量记录遗忘反馈（新增）
   */
  recordForgetFeedbackBatch(
    feedbacks: Array<{
      memoryId: string;
      features: ForgetFeatures;
      shouldForget: boolean;
      userAction: 'forget' | 'keep' | 'unsure';
    }>
  ): LearningRecord[] {
    return feedbacks.map(f => 
      this.recordForgetFeedback(f.memoryId, f.features, f.shouldForget, f.userAction)
    );
  }

  /**
   * 训练遗忘模型（新增）
   */
  trainForgetModel(): { accuracy: number; samples: number } | null {
    if (!this.forgetDetector) {
      return null;
    }

    return this.forgetDetector.train();
  }

  /**
   * 获取遗忘反馈统计（新增）
   */
  getForgetFeedbackStats(): ForgetFeedbackStats {
    return { ...this.forgetFeedbackStats };
  }

  /**
   * 生成改进建议
   */
  private generateSuggestion(record: LearningRecord): void {
    const area = this.identifyArea(record.context);
    const priority = record.type === "failure" ? "high" : "medium";

    const suggestion: ImprovementSuggestion = {
      id: `sug_${Date.now()}`,
      area,
      current: record.context,
      suggested: record.lesson,
      priority,
      status: "pending",
    };

    const existing = this.suggestions.find(
      (s) => s.area === area && s.status !== "completed"
    );

    if (!existing) {
      this.suggestions.push(suggestion);
    }
  }

  /**
   * 识别改进领域
   */
  private identifyArea(context: string): string {
    const areas: Record<string, string[]> = {
      "工具调用": ["工具", "调用", "执行", "命令"],
      "记忆管理": ["记忆", "存储", "检索", "遗忘"],
      "决策质量": ["决策", "判断", "选择", "优先级"],
      "输出质量": ["输出", "回复", "格式", "表达"],
      "错误处理": ["错误", "异常", "失败", "重试"],
    };

    for (const [area, keywords] of Object.entries(areas)) {
      if (keywords.some((k) => context.includes(k))) {
        return area;
      }
    }

    return "其他";
  }

  /**
   * 获取待处理的改进建议
   */
  getPendingSuggestions(): ImprovementSuggestion[] {
    return this.suggestions
      .filter((s) => s.status === "pending")
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * 标记建议为进行中
   */
  startSuggestion(id: string): void {
    const suggestion = this.suggestions.find((s) => s.id === id);
    if (suggestion) {
      suggestion.status = "in_progress";
    }
  }

  /**
   * 完成建议
   */
  completeSuggestion(id: string): void {
    const suggestion = this.suggestions.find((s) => s.id === id);
    if (suggestion) {
      suggestion.status = "completed";
    }
  }

  /**
   * 获取学习统计
   */
  getStats(): {
    totalLearnings: number;
    successRate: number;
    topAreas: string[];
    pendingSuggestions: number;
    forgetFeedbackStats: ForgetFeedbackStats;
  } {
    const total = this.learningHistory.length;
    const successes = this.learningHistory.filter((r) => r.type === "success").length;
    const pending = this.suggestions.filter((s) => s.status === "pending").length;

    const areaCounts: Record<string, number> = {};
    for (const record of this.learningHistory) {
      const area = this.identifyArea(record.context);
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    }

    const topAreas = Object.entries(areaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([area]) => area);

    return {
      totalLearnings: total,
      successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
      topAreas,
      pendingSuggestions: pending,
      forgetFeedbackStats: this.forgetFeedbackStats,
    };
  }

  /**
   * 生成每日复盘报告
   */
  generateDailyReview(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const todayLearnings = this.learningHistory.filter(
      (r) => r.timestamp >= todayStart
    );

    const lines: string[] = [];

    lines.push(`## 每日复盘 - ${new Date().toLocaleDateString("zh-CN")}`);
    lines.push(``);
    lines.push(`**今日学习**：${todayLearnings.length} 条`);
    lines.push(``);

    // 按类型分组
    const byType: Record<string, LearningRecord[]> = {};
    for (const record of todayLearnings) {
      if (!byType[record.type]) {
        byType[record.type] = [];
      }
      byType[record.type].push(record);
    }

    const typeNames: Record<string, string> = {
      success: "成功",
      failure: "失败",
      insight: "洞察",
      correction: "修正",
      forget_feedback: "遗忘反馈",
    };

    for (const [type, records] of Object.entries(byType)) {
      lines.push(`### ${typeNames[type] || type}（${records.length}）`);
      for (const record of records.slice(0, 3)) {
        lines.push(`- ${record.lesson}`);
      }
      lines.push(``);
    }

    // 遗忘反馈统计
    if (this.forgetFeedbackStats.totalFeedback > 0) {
      lines.push(`### 遗忘反馈统计`);
      lines.push(`- 总反馈数: ${this.forgetFeedbackStats.totalFeedback}`);
      lines.push(`- 遗忘: ${this.forgetFeedbackStats.forgetCount}`);
      lines.push(`- 保留: ${this.forgetFeedbackStats.keepCount}`);
      lines.push(`- 准确率: ${(this.forgetFeedbackStats.accuracy * 100).toFixed(1)}%`);
      lines.push(``);
    }

    // 待处理建议
    const pending = this.getPendingSuggestions();
    if (pending.length > 0) {
      lines.push(`### 待改进项（${pending.length}）`);
      for (const sug of pending.slice(0, 5)) {
        lines.push(`- [${sug.priority}] ${sug.area}: ${sug.suggested}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * 获取学习历史
   */
  getHistory(limit = 20): LearningRecord[] {
    return this.learningHistory.slice(-limit);
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.learningHistory = [];
    this.suggestions = [];
    this.forgetFeedbackStats = {
      totalFeedback: 0,
      forgetCount: 0,
      keepCount: 0,
      accuracy: 0,
    };
  }
}

// 导出单例
export const memoryEnhancedSelfImprovementEngine = new MemoryEnhancedSelfImprovementEngine();

// 向后兼容
export const selfImprovementEngine = memoryEnhancedSelfImprovementEngine;
export const SelfImprovementEngine = MemoryEnhancedSelfImprovementEngine;
