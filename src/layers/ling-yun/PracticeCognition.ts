/**
 * 实践认识论
 *
 * 基于 qiushi-skill 的 practice-cognition
 * 核心原则：实践、认识、再实践、再认识，螺旋上升
 */

/**
 * 认识阶段
 */
export type CognitionPhase =
  | "sensory" // 感性认识阶段
  | "rational" // 理性认识形成阶段
  | "validation" // 实践验证阶段
  | "synthesis"; // 总结升华阶段

/**
 * 认识循环结果
 */
export interface CognitionCycleResult {
  cycleId: string;
  phase: CognitionPhase;
  observations: string[];
  hypothesis: string | null;
  validationResults: string[];
  learnings: string[];
  nextPhase: CognitionPhase;
  isComplete: boolean;
  summary: string;
}

/**
 * 实践认识论引擎
 */
export class PracticeCognition {
  private currentCycle: CognitionCycleResult | null = null;
  private cycleHistory: CognitionCycleResult[] = [];
  private maxHistory = 100;

  /**
   * 开始新的认识循环
   */
  startCycle(problem: string): CognitionCycleResult {
    this.currentCycle = {
      cycleId: `cycle_${Date.now()}`,
      phase: "sensory",
      observations: [],
      hypothesis: null,
      validationResults: [],
      learnings: [],
      nextPhase: "rational",
      isComplete: false,
      summary: `开始认识循环：${problem.substring(0, 50)}...`,
    };

    return this.currentCycle;
  }

  /**
   * 感性认识阶段：积累第一手材料
   */
  sensoryPhase(observations: string[]): CognitionCycleResult {
    if (!this.currentCycle) {
      throw new Error("没有活动的认识循环");
    }

    this.currentCycle.phase = "sensory";
    this.currentCycle.observations = observations;
    this.currentCycle.nextPhase = "rational";
    this.currentCycle.summary = `感性认识阶段：收集了 ${observations.length} 条观察`;

    return this.currentCycle;
  }

  /**
   * 理性认识阶段：从现象提炼规律
   */
  rationalPhase(hypothesis: string): CognitionCycleResult {
    if (!this.currentCycle) {
      throw new Error("没有活动的认识循环");
    }

    this.currentCycle.phase = "rational";
    this.currentCycle.hypothesis = hypothesis;
    this.currentCycle.nextPhase = "validation";
    this.currentCycle.summary = `理性认识阶段：形成假说 "${hypothesis.substring(0, 50)}..."`;

    return this.currentCycle;
  }

  /**
   * 实践验证阶段：检验假说
   */
  validationPhase(results: string[], success: boolean): CognitionCycleResult {
    if (!this.currentCycle) {
      throw new Error("没有活动的认识循环");
    }

    this.currentCycle.phase = "validation";
    this.currentCycle.validationResults = results;

    if (success) {
      this.currentCycle.nextPhase = "synthesis";
      this.currentCycle.summary = "验证阶段：假说被证实，进入总结";
    } else {
      // 假说被证伪，返回理性认识阶段
      this.currentCycle.nextPhase = "rational";
      this.currentCycle.hypothesis = null;
      this.currentCycle.summary = "验证阶段：假说被证伪，需要重新形成假说";
    }

    return this.currentCycle;
  }

  /**
   * 总结升华阶段：将验证结果升华为新认识
   */
  synthesisPhase(learnings: string[]): CognitionCycleResult {
    if (!this.currentCycle) {
      throw new Error("没有活动的认识循环");
    }

    this.currentCycle.phase = "synthesis";
    this.currentCycle.learnings = learnings;
    this.currentCycle.isComplete = true;
    this.currentCycle.summary = `总结升华阶段：学到 ${learnings.length} 条经验`;

    // 保存到历史
    this.cycleHistory.push(this.currentCycle);
    if (this.cycleHistory.length > this.maxHistory) {
      this.cycleHistory.shift();
    }

    const completed = this.currentCycle;
    this.currentCycle = null;

    return completed;
  }

  /**
   * 获取当前循环状态
   */
  getCurrentCycle(): CognitionCycleResult | null {
    return this.currentCycle;
  }

  /**
   * 获取循环历史
   */
  getHistory(): CognitionCycleResult[] {
    return [...this.cycleHistory];
  }

  /**
   * 格式化输出
   */
  formatResult(result: CognitionCycleResult): string {
    const lines: string[] = [];

    lines.push(`## 实践认识论循环`);
    lines.push(``);
    lines.push(`**当前阶段**：${this.getPhaseName(result.phase)}`);
    lines.push(``);

    if (result.observations.length > 0) {
      lines.push(`**观察**：`);
      for (const obs of result.observations) {
        lines.push(`- ${obs}`);
      }
      lines.push(``);
    }

    if (result.hypothesis) {
      lines.push(`**假说**：${result.hypothesis}`);
      lines.push(``);
    }

    if (result.validationResults.length > 0) {
      lines.push(`**验证结果**：`);
      for (const r of result.validationResults) {
        lines.push(`- ${r}`);
      }
      lines.push(``);
    }

    if (result.learnings.length > 0) {
      lines.push(`**学习总结**：`);
      for (const l of result.learnings) {
        lines.push(`- ${l}`);
      }
      lines.push(``);
    }

    lines.push(`**下一步**：${this.getPhaseName(result.nextPhase)}`);

    return lines.join("\n");
  }

  /**
   * 获取阶段名称
   */
  private getPhaseName(phase: CognitionPhase): string {
    const names: Record<CognitionPhase, string> = {
      sensory: "感性认识阶段（积累第一手材料）",
      rational: "理性认识阶段（从现象提炼规律）",
      validation: "实践验证阶段（检验假说）",
      synthesis: "总结升华阶段（升华为新认识）",
    };
    return names[phase];
  }
}

// 导出单例
export const practiceCognition = new PracticeCognition();
