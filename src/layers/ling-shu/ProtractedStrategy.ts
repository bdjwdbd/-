/**
 * 持久战略
 *
 * 基于 qiushi-skill 的 protracted-strategy
 * 核心原则：既不急于求成（速胜论），也不畏难放弃（悲观论）
 */

/**
 * 战略阶段
 */
export type StrategicPhase =
  | "defense" // 战略防御期
  | "stalemate" // 战略相持期
  | "counterattack"; // 战略反攻期

/**
 * 阶段评估结果
 */
export interface PhaseAssessment {
  currentPhase: StrategicPhase;
  judgment: string;
  ourAdvantages: string[];
  ourDisadvantages: string[];
  keyObstacles: string[];
  coreTask: string;
  forbiddenActions: string[];
  transitionCondition: string;
  localAttackPoints: string[];
  checkpoint: string;
}

/**
 * 持久战略引擎
 */
export class ProtractedStrategy {
  /**
   * 评估当前阶段
   */
  assessPhase(context: {
    goal: string;
    currentProgress: string;
    resources: string[];
    obstacles: string[];
    timeline?: string;
  }): PhaseAssessment {
    // 1. 判断当前阶段
    const phase = this.determinePhase(context);

    // 2. 分析优劣势
    const { advantages, disadvantages } = this.analyzeStrengths(context);

    // 3. 识别关键障碍
    const keyObstacles = this.identifyKeyObstacles(context.obstacles);

    // 4. 确定核心任务
    const coreTask = this.determineCoreTask(phase, context);

    // 5. 确定禁止事项
    const forbiddenActions = this.determineForbiddenActions(phase);

    // 6. 设置转换条件
    const transitionCondition = this.setTransitionCondition(phase, context);

    // 7. 找出局部进攻点
    const localAttackPoints = this.findLocalAttackPoints(phase, context);

    // 8. 设置检查点
    const checkpoint = this.setCheckpoint(phase, context);

    return {
      currentPhase: phase,
      judgment: this.generateJudgment(phase, context),
      ourAdvantages: advantages,
      ourDisadvantages: disadvantages,
      keyObstacles,
      coreTask,
      forbiddenActions,
      transitionCondition,
      localAttackPoints,
      checkpoint,
    };
  }

  /**
   * 判断当前阶段
   */
  private determinePhase(context: {
    goal: string;
    currentProgress: string;
    resources: string[];
    obstacles: string[];
  }): StrategicPhase {
    const { resources, obstacles, currentProgress } = context;

    // 资源不足、障碍多、进展少 → 防御期
    if (resources.length < 3 && obstacles.length > 3) {
      return "defense";
    }

    // 有一定资源、有进展但未突破 → 相持期
    if (resources.length >= 3 && currentProgress.length > 50) {
      // 检查是否有突破性进展
      if (currentProgress.includes("完成") || currentProgress.includes("突破")) {
        return "counterattack";
      }
      return "stalemate";
    }

    // 默认防御期
    return "defense";
  }

  /**
   * 分析优劣势
   */
  private analyzeStrengths(context: {
    resources: string[];
    obstacles: string[];
  }): { advantages: string[]; disadvantages: string[] } {
    const advantages: string[] = [];
    const disadvantages: string[] = [];

    // 资源即优势
    for (const resource of context.resources) {
      advantages.push(`拥有${resource}`);
    }

    // 障碍即劣势
    for (const obstacle of context.obstacles) {
      disadvantages.push(`面临${obstacle}`);
    }

    // 补充常见劣势
    if (context.resources.length < 3) {
      disadvantages.push("资源暂时不足");
    }
    if (context.obstacles.length > 3) {
      disadvantages.push("障碍较多");
    }

    return { advantages, disadvantages };
  }

  /**
   * 识别关键障碍
   */
  private identifyKeyObstacles(obstacles: string[]): string[] {
    // 优先级排序
    const priorityKeywords = ["时间", "资源", "技术", "人力", "预算"];
    const sorted: string[] = [];

    for (const keyword of priorityKeywords) {
      const found = obstacles.find((o) => o.includes(keyword));
      if (found) {
        sorted.push(found);
      }
    }

    // 添加其他障碍
    for (const obstacle of obstacles) {
      if (!sorted.includes(obstacle)) {
        sorted.push(obstacle);
      }
    }

    return sorted.slice(0, 3);
  }

  /**
   * 确定核心任务
   */
  private determineCoreTask(
    phase: StrategicPhase,
    context: { goal: string }
  ): string {
    switch (phase) {
      case "defense":
        return `站稳脚跟，积累认识，为${context.goal}打基础`;
      case "stalemate":
        return `积小胜为大胜，逐步推进${context.goal}`;
      case "counterattack":
        return `利用积累优势，全面推进${context.goal}`;
    }
  }

  /**
   * 确定禁止事项
   */
  private determineForbiddenActions(phase: StrategicPhase): string[] {
    switch (phase) {
      case "defense":
        return [
          "急于求成，盲目冒进",
          "因困难而放弃",
          "分散资源，全面出击",
        ];
      case "stalemate":
        return [
          "因进展缓慢而气馁",
          "急于转入反攻",
          "忽视小胜利的积累",
        ];
      case "counterattack":
        return [
          "因优势而大意",
          "忽视残余障碍",
          "过度扩张",
        ];
    }
  }

  /**
   * 设置转换条件
   */
  private setTransitionCondition(
    phase: StrategicPhase,
    context: { goal: string }
  ): string {
    switch (phase) {
      case "defense":
        return `当积累了足够的资源和认识，能够稳定推进${context.goal}时，转入相持期`;
      case "stalemate":
        return `当主要障碍被消除，资源充足，${context.goal}出现突破性进展时，转入反攻期`;
      case "counterattack":
        return `${context.goal}完成`;
    }
  }

  /**
   * 找出局部进攻点
   */
  private findLocalAttackPoints(
    phase: StrategicPhase,
    context: { resources: string[]; obstacles: string[] }
  ): string[] {
    const points: string[] = [];

    if (phase === "defense" || phase === "stalemate") {
      // 在防御/相持期，找出可以快速拿下的小目标
      if (context.resources.length > 0) {
        points.push(`利用${context.resources[0]}，快速解决一个小问题`);
      }
      if (context.obstacles.length > 0) {
        points.push(`集中力量消除"${context.obstacles[0]}"这个障碍`);
      }
    }

    return points;
  }

  /**
   * 设置检查点
   */
  private setCheckpoint(
    phase: StrategicPhase,
    context: { goal: string }
  ): string {
    switch (phase) {
      case "defense":
        return `完成基础积累后，重新评估是否转入相持期`;
      case "stalemate":
        return `每取得一个小胜利后，评估是否具备转入反攻期的条件`;
      case "counterattack":
        return `${context.goal}完成后，总结经验教训`;
    }
  }

  /**
   * 生成判断说明
   */
  private generateJudgment(
    phase: StrategicPhase,
    context: { goal: string }
  ): string {
    const phaseNames: Record<StrategicPhase, string> = {
      defense: "战略防御期",
      stalemate: "战略相持期",
      counterattack: "战略反攻期",
    };

    return `当前处于${phaseNames[phase]}，目标是${context.goal}`;
  }

  /**
   * 格式化输出
   */
  formatAssessment(assessment: PhaseAssessment): string {
    const lines: string[] = [];

    lines.push(`## 阶段评估表`);
    lines.push(``);
    lines.push(`**当前阶段**：${this.getPhaseName(assessment.currentPhase)}`);
    lines.push(`**判断依据**：${assessment.judgment}`);
    lines.push(``);

    lines.push(`**我方优势**：`);
    for (const a of assessment.ourAdvantages) {
      lines.push(`- ${a}`);
    }
    lines.push(``);

    lines.push(`**我方劣势**：`);
    for (const d of assessment.ourDisadvantages) {
      lines.push(`- ${d}`);
    }
    lines.push(``);

    lines.push(`**关键障碍**：${assessment.keyObstacles.join("、")}`);
    lines.push(``);

    lines.push(`**本阶段核心任务**：${assessment.coreTask}`);
    lines.push(``);

    lines.push(`**禁止事项**：`);
    for (const f of assessment.forbiddenActions) {
      lines.push(`- ❌ ${f}`);
    }
    lines.push(``);

    lines.push(`**转入下一阶段条件**：${assessment.transitionCondition}`);
    lines.push(``);

    if (assessment.localAttackPoints.length > 0) {
      lines.push(`**局部进攻点**：`);
      for (const p of assessment.localAttackPoints) {
        lines.push(`- 🎯 ${p}`);
      }
      lines.push(``);
    }

    lines.push(`**检查点**：${assessment.checkpoint}`);

    return lines.join("\n");
  }

  /**
   * 获取阶段名称
   */
  private getPhaseName(phase: StrategicPhase): string {
    const names: Record<StrategicPhase, string> = {
      defense: "战略防御期",
      stalemate: "战略相持期",
      counterattack: "战略反攻期",
    };
    return names[phase];
  }
}

// 导出单例
export const protractedStrategy = new ProtractedStrategy();
