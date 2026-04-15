/**
 * 自我改进引擎
 *
 * 让元灵系统能够持续学习、自我进化
 */

/**
 * 学习记录
 */
export interface LearningRecord {
  id: string;
  timestamp: number;
  type: "success" | "failure" | "insight" | "correction";
  context: string;
  lesson: string;
  actionItems: string[];
  applied: boolean;
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
 * 自我改进引擎
 */
export class SelfImprovementEngine {
  private learningHistory: LearningRecord[] = [];
  private suggestions: ImprovementSuggestion[] = [];
  private maxHistory = 1000;

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
   * 生成改进建议
   */
  private generateSuggestion(record: LearningRecord): void {
    // 根据学习记录生成改进建议
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

    // 检查是否已有类似建议
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
  } {
    const total = this.learningHistory.length;
    const successes = this.learningHistory.filter((r) => r.type === "success").length;
    const pending = this.suggestions.filter((s) => s.status === "pending").length;

    // 统计各领域的学习次数
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

    for (const [type, records] of Object.entries(byType)) {
      const typeNames: Record<string, string> = {
        success: "成功",
        failure: "失败",
        insight: "洞察",
        correction: "修正",
      };
      lines.push(`### ${typeNames[type]}（${records.length}）`);
      for (const record of records.slice(0, 3)) {
        lines.push(`- ${record.lesson}`);
      }
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
  }
}

// 导出单例
export const selfImprovementEngine = new SelfImprovementEngine();
