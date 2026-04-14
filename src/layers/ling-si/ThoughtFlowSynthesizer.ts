/**
 * 思维流合成器
 * 
 * 将思考过程合成为自然的意识流文本
 * 基于 Thinking Claude 的 authentic_thought_flow
 */

import {
  ThinkingResult,
  ThinkingStepResult,
  ThinkingStepName,
  NATURAL_TRANSITIONS,
  getRandomTransition,
} from "./types";

/**
 * 思维流合成器
 */
export class ThoughtFlowSynthesizer {
  /**
   * 合成完整的思维流
   */
  synthesize(result: ThinkingResult): string {
    const sections: string[] = [];

    // 1. 开场
    sections.push(this.createOpening(result));

    // 2. 主体思考流
    sections.push(this.createMainFlow(result));

    // 3. 结论
    sections.push(this.createConclusion(result));

    return sections.join("\n\n");
  }

  /**
   * 创建开场
   */
  private createOpening(result: ThinkingResult): string {
    const transition = getRandomTransition("start");
    return `${transition}\n\nLet me work through this carefully...`;
  }

  /**
   * 创建主体思考流
   */
  private createMainFlow(result: ThinkingResult): string {
    const flow: string[] = [];
    let previousStep: ThinkingStepName | null = null;

    for (const stepResult of result.stepResults) {
      // 添加步骤过渡
      if (previousStep) {
        flow.push(this.createStepTransition(previousStep, stepResult.stepName));
      }

      // 添加思考内容
      flow.push(this.formatStepThoughts(stepResult));

      previousStep = stepResult.stepName;
    }

    return flow.join("\n\n");
  }

  /**
   * 创建步骤过渡
   */
  private createStepTransition(
    from: ThinkingStepName,
    to: ThinkingStepName
  ): string {
    const transitions: Record<ThinkingStepName, string> = {
      [ThinkingStepName.INITIAL_ENGAGEMENT]: "First, let me understand the question...",
      [ThinkingStepName.PROBLEM_ANALYSIS]: "Now, let me break this down...",
      [ThinkingStepName.MULTIPLE_HYPOTHESES]: "Let me consider different possibilities...",
      [ThinkingStepName.NATURAL_DISCOVERY]: "Following this line of thought...",
      [ThinkingStepName.TESTING_VERIFICATION]: "Let me verify my reasoning...",
      [ThinkingStepName.ERROR_CORRECTION]: "Wait, let me reconsider...",
      [ThinkingStepName.KNOWLEDGE_SYNTHESIS]: "Putting this together...",
      [ThinkingStepName.PATTERN_RECOGNITION]: "I notice a pattern here...",
      [ThinkingStepName.PROGRESS_TRACKING]: "Let me check my progress...",
      [ThinkingStepName.RECURSIVE_THINKING]: "Looking at this from another angle...",
    };

    return transitions[to] || getRandomTransition("connection");
  }

  /**
   * 格式化步骤思考
   */
  private formatStepThoughts(stepResult: ThinkingStepResult): string {
    const lines: string[] = [];

    for (const thought of stepResult.thoughts) {
      // 添加自然语言标记
      const formattedThought = this.addNaturalMarkers(thought, stepResult.stepName);
      lines.push(formattedThought);
    }

    return lines.join("\n");
  }

  /**
   * 添加自然语言标记
   */
  private addNaturalMarkers(thought: string, stepName: ThinkingStepName): string {
    // 如果已经包含自然语言标记，直接返回
    if (this.hasNaturalMarker(thought)) {
      return thought;
    }

    // 根据步骤类型添加标记
    const markerChance = Math.random();

    if (stepName === ThinkingStepName.TESTING_VERIFICATION) {
      if (markerChance < 0.3) {
        return `${getRandomTransition("questioning")} ${thought}`;
      }
    }

    if (stepName === ThinkingStepName.ERROR_CORRECTION) {
      if (markerChance < 0.4) {
        return `${getRandomTransition("correction")} ${thought}`;
      }
    }

    if (stepName === ThinkingStepName.KNOWLEDGE_SYNTHESIS) {
      if (markerChance < 0.3) {
        return `${getRandomTransition("synthesis")} ${thought}`;
      }
    }

    if (stepName === ThinkingStepName.NATURAL_DISCOVERY) {
      if (markerChance < 0.3) {
        return `${getRandomTransition("discovery")} ${thought}`;
      }
    }

    return thought;
  }

  /**
   * 检查是否已有自然语言标记
   */
  private hasNaturalMarker(thought: string): boolean {
    const markers = [
      "Hmm", "Actually", "Wait", "But", "Now", "This",
      "Let me", "I notice", "I wonder", "On second thought",
    ];

    return markers.some((marker) => thought.startsWith(marker));
  }

  /**
   * 创建结论
   */
  private createConclusion(result: ThinkingResult): string {
    const lines: string[] = [];

    // 置信度声明
    const confidencePercent = (result.confidence * 100).toFixed(0);
    lines.push(
      `${getRandomTransition("synthesis")} I'm about ${confidencePercent}% confident in this analysis.`
    );

    // 洞察总结
    if (result.insights.length > 0) {
      lines.push("\nKey insights:");
      result.insights.forEach((insight, i) => {
        lines.push(`  ${i + 1}. ${insight}`);
      });
    }

    // 下一步建议
    if (result.requiresToolUse && result.recommendedTools) {
      lines.push("\nI should use some tools to get more information:");
      result.recommendedTools.forEach((tool) => {
        lines.push(`  - ${tool.toolName}: ${tool.reason}`);
      });
    }

    if (result.needsClarification && result.clarificationQuestions) {
      lines.push("\nI might need to ask:");
      result.clarificationQuestions.forEach((q) => {
        lines.push(`  - ${q}`);
      });
    }

    return lines.join("\n");
  }

  /**
   * 合成为简洁版本
   */
  synthesizeBrief(result: ThinkingResult): string {
    const lines: string[] = [];

    // 开场
    lines.push(getRandomTransition("start"));

    // 主要洞察
    if (result.insights.length > 0) {
      lines.push(`The key insight is: ${result.insights[0]}`);
    }

    // 置信度
    const confidencePercent = (result.confidence * 100).toFixed(0);
    lines.push(`Confidence: ${confidencePercent}%`);

    return lines.join("\n");
  }

  /**
   * 合成为 Markdown 格式
   */
  synthesizeMarkdown(result: ThinkingResult): string {
    const lines: string[] = [];

    lines.push("## Thinking Process\n");

    // 深度信息
    lines.push(`**Depth:** ${result.depth}`);
    lines.push(`**Confidence:** ${(result.confidence * 100).toFixed(0)}%`);
    lines.push(`**Duration:** ${result.duration}ms\n`);

    // 步骤结果
    for (const stepResult of result.stepResults) {
      lines.push(`### ${this.formatStepName(stepResult.stepName)}\n`);
      for (const thought of stepResult.thoughts) {
        lines.push(`- ${thought}`);
      }
      lines.push("");
    }

    // 洞察
    if (result.insights.length > 0) {
      lines.push("### Key Insights\n");
      result.insights.forEach((insight, i) => {
        lines.push(`${i + 1}. ${insight}`);
      });
    }

    return lines.join("\n");
  }

  /**
   * 格式化步骤名称
   */
  private formatStepName(stepName: ThinkingStepName): string {
    const names: Record<ThinkingStepName, string> = {
      [ThinkingStepName.INITIAL_ENGAGEMENT]: "Initial Engagement",
      [ThinkingStepName.PROBLEM_ANALYSIS]: "Problem Analysis",
      [ThinkingStepName.MULTIPLE_HYPOTHESES]: "Multiple Hypotheses",
      [ThinkingStepName.NATURAL_DISCOVERY]: "Natural Discovery",
      [ThinkingStepName.TESTING_VERIFICATION]: "Testing & Verification",
      [ThinkingStepName.ERROR_CORRECTION]: "Error Correction",
      [ThinkingStepName.KNOWLEDGE_SYNTHESIS]: "Knowledge Synthesis",
      [ThinkingStepName.PATTERN_RECOGNITION]: "Pattern Recognition",
      [ThinkingStepName.PROGRESS_TRACKING]: "Progress Tracking",
      [ThinkingStepName.RECURSIVE_THINKING]: "Recursive Thinking",
    };

    return names[stepName] || stepName;
  }
}

// 导出单例
export const thoughtFlowSynthesizer = new ThoughtFlowSynthesizer();
