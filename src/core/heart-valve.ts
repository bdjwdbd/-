/**
 * 心脏瓣膜：JSON 物理锁
 * 解决：提前交卷
 * 对应：Harness 的 JSON 物理锁
 */
export class HeartValve {
  private checklist: Map<string, "pending" | "completed"> = new Map();

  /**
   * 初始化功能清单
   */
  init(features: string[]): void {
    this.checklist.clear();
    for (const feature of features) {
      this.checklist.set(feature, "pending");
    }
  }

  /**
   * 标记完成（只能改状态）
   */
  markComplete(feature: string): boolean {
    if (!this.checklist.has(feature)) {
      return false;
    }
    this.checklist.set(feature, "completed");
    return true;
  }

  /**
   * 检查是否全部完成
   */
  isAllComplete(): boolean {
    for (const [, status] of this.checklist) {
      if (status === "pending") {
        return false;
      }
    }
    return true;
  }

  /**
   * 阀门检查：阻止提前交卷
   */
  check(action: "submit" | "continue"): { allowed: boolean; reason?: string } {
    if (action === "submit" && !this.isAllComplete()) {
      const pending = Array.from(this.checklist.entries())
        .filter(([, status]) => status === "pending")
        .map(([feature]) => feature);
      return {
        allowed: false,
        reason: `还有 ${pending.length} 项未完成：${pending.join(", ")}`,
      };
    }
    return { allowed: true };
  }

  /**
   * 获取进度
   */
  getProgress(): { total: number; completed: number; pending: string[] } {
    const entries = Array.from(this.checklist.entries());
    const completed = entries.filter(([, s]) => s === "completed").length;
    const pending = entries.filter(([, s]) => s === "pending").map(([f]) => f);
    return {
      total: entries.length,
      completed,
      pending,
    };
  }

  /**
   * 重置清单
   */
  reset(): void {
    this.checklist.clear();
  }

  /**
   * 获取清单状态
   */
  getChecklist(): Record<string, "pending" | "completed"> {
    const result: Record<string, "pending" | "completed"> = {};
    for (const [feature, status] of this.checklist) {
      result[feature] = status;
    }
    return result;
  }
}
