/**
 * 矛盾分析法
 * 
 * 基于 qiushi-skill 的 contradiction-analysis
 * 核心原则：找到主要矛盾，集中力量解决
 */

/**
 * 矛盾定义
 */
export interface Contradiction {
  id: string;
  name: string;
  sideA: string;
  sideB: string;
  description: string;
  isPrincipal: boolean;
  nature: "antagonistic" | "non_antagonistic";
  status: "active" | "resolved" | "transformed";
}

/**
 * 矛盾分析结果
 */
export interface ContradictionAnalysisResult {
  contradictions: Contradiction[];
  principalContradiction: Contradiction | null;
  principalSide: "A" | "B";
  resolutionMethod: string;
  monitoringPoints: string[];
  summary: string;
}

/**
 * 矛盾分析器
 */
export class ContradictionAnalyzer {
  /**
   * 分析问题中的矛盾
   */
  analyze(problem: string, context?: string): ContradictionAnalysisResult {
    // 1. 识别所有矛盾
    const contradictions = this.identifyContradictions(problem, context);

    // 2. 判定主要矛盾
    const principalContradiction = this.identifyPrincipal(contradictions);

    // 3. 分析主要方面
    const principalSide = this.identifyPrincipalSide(principalContradiction);

    // 4. 区分矛盾性质
    this.classifyNature(contradictions);

    // 5. 选择解决方法
    const resolutionMethod = this.selectResolutionMethod(principalContradiction);

    // 6. 设置监控点
    const monitoringPoints = this.setMonitoringPoints(contradictions);

    // 7. 生成摘要
    const summary = this.generateSummary(
      contradictions,
      principalContradiction,
      resolutionMethod
    );

    return {
      contradictions,
      principalContradiction,
      principalSide,
      resolutionMethod,
      monitoringPoints,
      summary,
    };
  }

  /**
   * 识别所有矛盾
   */
  private identifyContradictions(
    problem: string,
    context?: string
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const text = (problem + " " + (context || "")).toLowerCase();

    // 常见矛盾模式
    const patterns = [
      {
        keywords: ["时间", "紧迫", "deadline", "赶", "来不及"],
        sideA: "时间紧迫",
        sideB: "任务复杂",
        name: "时间vs质量",
      },
      {
        keywords: ["资源", "不足", "有限", "预算", "人力"],
        sideA: "资源有限",
        sideB: "需求多样",
        name: "资源vs需求",
      },
      {
        keywords: ["性能", "速度", "优化", "快", "慢"],
        sideA: "性能要求",
        sideB: "功能复杂",
        name: "性能vs功能",
      },
      {
        keywords: ["稳定", "可靠", "风险", "安全"],
        sideA: "稳定优先",
        sideB: "创新需求",
        name: "稳定vs创新",
      },
      {
        keywords: ["简单", "复杂", "过度", "设计"],
        sideA: "简单方案",
        sideB: "复杂需求",
        name: "简单vs复杂",
      },
      {
        keywords: ["短期", "长期", "临时", "永久"],
        sideA: "短期目标",
        sideB: "长期规划",
        name: "短期vs长期",
      },
      {
        keywords: ["成本", "质量", "便宜", "好"],
        sideA: "成本控制",
        sideB: "质量要求",
        name: "成本vs质量",
      },
      {
        keywords: ["用户", "需求", "冲突", "矛盾"],
        sideA: "用户A需求",
        sideB: "用户B需求",
        name: "需求冲突",
      },
    ];

    for (const pattern of patterns) {
      const matchCount = pattern.keywords.filter((k) => text.includes(k)).length;
      if (matchCount >= 2) {
        contradictions.push({
          id: `con_${contradictions.length}`,
          name: pattern.name,
          sideA: pattern.sideA,
          sideB: pattern.sideB,
          description: `${pattern.sideA} 与 ${pattern.sideB} 之间的张力`,
          isPrincipal: false,
          nature: "non_antagonistic",
          status: "active",
        });
      }
    }

    // 如果没有识别到矛盾，添加一个通用矛盾
    if (contradictions.length === 0) {
      contradictions.push({
        id: "con_0",
        name: "目标vs现状",
        sideA: "期望目标",
        sideB: "当前现状",
        description: "期望与现状之间的差距",
        isPrincipal: true,
        nature: "non_antagonistic",
        status: "active",
      });
    }

    return contradictions;
  }

  /**
   * 判定主要矛盾
   */
  private identifyPrincipal(
    contradictions: Contradiction[]
  ): Contradiction | null {
    if (contradictions.length === 0) return null;
    if (contradictions.length === 1) {
      contradictions[0].isPrincipal = true;
      return contradictions[0];
    }

    // 优先级规则
    const priorityOrder = [
      "时间vs质量",
      "资源vs需求",
      "目标vs现状",
      "成本vs质量",
      "性能vs功能",
      "稳定vs创新",
      "简单vs复杂",
      "短期vs长期",
      "需求冲突",
    ];

    for (const name of priorityOrder) {
      const found = contradictions.find((c) => c.name === name);
      if (found) {
        found.isPrincipal = true;
        return found;
      }
    }

    // 默认第一个
    contradictions[0].isPrincipal = true;
    return contradictions[0];
  }

  /**
   * 分析主要方面
   */
  private identifyPrincipalSide(
    contradiction: Contradiction | null
  ): "A" | "B" {
    if (!contradiction) return "A";

    // 根据矛盾类型判断
    const sideAPriority = ["时间vs质量", "资源vs需求", "成本vs质量"];
    const sideBPriority = ["性能vs功能", "简单vs复杂"];

    if (sideAPriority.includes(contradiction.name)) {
      return "A";
    }
    if (sideBPriority.includes(contradiction.name)) {
      return "B";
    }

    return "A";
  }

  /**
   * 区分矛盾性质
   */
  private classifyNature(contradictions: Contradiction[]): void {
    for (const c of contradictions) {
      // 对抗性矛盾：利益根本冲突
      const antagonisticPatterns = ["需求冲突", "成本vs质量"];
      if (antagonisticPatterns.includes(c.name)) {
        c.nature = "antagonistic";
      }
    }
  }

  /**
   * 选择解决方法
   */
  private selectResolutionMethod(
    contradiction: Contradiction | null
  ): string {
    if (!contradiction) return "无需处理";

    if (contradiction.nature === "antagonistic") {
      return "对抗性矛盾：需要明确立场，果断取舍";
    }

    // 非对抗性矛盾的处理方法
    const methods: Record<string, string> = {
      "时间vs质量": "分阶段交付：先核心功能，再迭代优化",
      "资源vs需求": "优先级排序：集中资源解决最重要需求",
      "目标vs现状": "调查研究：先摸清现状，再制定路径",
      "性能vs功能": "权衡取舍：核心功能优先，非核心可简化",
      "稳定vs创新": "渐进式创新：在稳定基础上小步尝试",
      "简单vs复杂": "KISS原则：能用简单方案就别复杂",
      "短期vs长期": "阶段规划：短期目标服务于长期规划",
      "成本vs质量": "性价比思维：在预算内追求最优质量",
    };

    return methods[contradiction.name] || "调查研究后制定具体方案";
  }

  /**
   * 设置监控点
   */
  private setMonitoringPoints(contradictions: Contradiction[]): string[] {
    const points: string[] = [];

    // 监控次要矛盾是否上升
    const secondary = contradictions.filter((c) => !c.isPrincipal);
    for (const c of secondary.slice(0, 2)) {
      points.push(`需监控：${c.name} 是否上升为主要矛盾`);
    }

    // 监控矛盾转化
    if (contradictions.some((c) => c.nature === "non_antagonistic")) {
      points.push("需监控：非对抗性矛盾是否因处理不当转化为对抗性");
    }

    return points;
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    contradictions: Contradiction[],
    principal: Contradiction | null,
    method: string
  ): string {
    const lines: string[] = [];

    lines.push(`## 矛盾分析结果`);
    lines.push(``);
    lines.push(`**识别矛盾数**：${contradictions.length}`);
    lines.push(``);

    if (principal) {
      lines.push(`**主要矛盾**：${principal.name}`);
      lines.push(`- ${principal.sideA} vs ${principal.sideB}`);
      lines.push(`- 性质：${principal.nature === "antagonistic" ? "对抗性" : "非对抗性"}`);
      lines.push(``);
      lines.push(`**解决方法**：${method}`);
    }

    return lines.join("\n");
  }

  /**
   * 格式化输出（用于 L1 决策）
   */
  formatForDecision(result: ContradictionAnalysisResult): string {
    if (!result.principalContradiction) {
      return "未识别到明确矛盾";
    }

    const c = result.principalContradiction;
    return `主要矛盾: [${c.sideA}] vs [${c.sideB}]
性质: ${c.nature === "antagonistic" ? "对抗性" : "非对抗性"}
切入点: ${result.resolutionMethod}`;
  }
}

// 导出单例
export const contradictionAnalyzer = new ContradictionAnalyzer();
