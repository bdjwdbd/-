/**
 * 思考过程可视化
 * 
 * 将思考过程转换为可视化格式
 * 支持：ASCII 图、Mermaid 图、JSON 结构
 */

import {
  ThinkingResult,
  ThinkingStepResult,
  ThinkingStepName,
  ThinkingDepth,
  Hypothesis,
  HypothesisStatus,
} from "./types";

// ============================================================
// 可视化类型
// ============================================================

/**
 * 可视化格式
 */
export type VisualizationFormat = "ascii" | "mermaid" | "json" | "markdown";

/**
 * 可视化选项
 */
export interface VisualizationOptions {
  /** 格式 */
  format: VisualizationFormat;
  /** 是否显示详细内容 */
  detailed: boolean;
  /** 是否显示假设 */
  showHypotheses: boolean;
  /** 是否显示洞察 */
  showInsights: boolean;
  /** 最大内容长度 */
  maxContentLength: number;
}

/**
 * 默认选项
 */
const DEFAULT_OPTIONS: VisualizationOptions = {
  format: "ascii",
  detailed: false,
  showHypotheses: true,
  showInsights: true,
  maxContentLength: 100,
};

// ============================================================
// ASCII 可视化
// ============================================================

/**
 * ASCII 可视化器
 */
export class ASCIIVisualizer {
  /**
   * 可视化思考结果
   */
  visualize(result: ThinkingResult, options: VisualizationOptions): string {
    const lines: string[] = [];

    // 标题
    lines.push("╔══════════════════════════════════════════════════════════╗");
    lines.push("║                    思考过程可视化                          ║");
    lines.push("╚══════════════════════════════════════════════════════════╝");
    lines.push("");

    // 基本信息
    lines.push("┌─ 基本信息 ─────────────────────────────────────────────┐");
    lines.push(`│ ID: ${result.id.padEnd(50)}│`);
    lines.push(`│ 深度: ${result.depth.padEnd(48)}│`);
    lines.push(`│ 置信度: ${((result.confidence * 100).toFixed(1) + "%").padEnd(47)}│`);
    lines.push(`│ Token: ${result.tokensUsed.toString().padEnd(48)}│`);
    lines.push(`│ 耗时: ${(result.duration + "ms").padEnd(49)}│`);
    lines.push("└─────────────────────────────────────────────────────────┘");
    lines.push("");

    // 思考步骤
    lines.push("┌─ 思考步骤 ─────────────────────────────────────────────┐");
    for (let i = 0; i < result.stepResults.length; i++) {
      const step = result.stepResults[i];
      const status = step.completed ? "✓" : "○";
      const name = this.formatStepName(step.stepName);
      lines.push(`│ ${status} ${i + 1}. ${name.padEnd(46)}│`);

      if (options.detailed && step.thoughts.length > 0) {
        const preview = step.thoughts[0].substring(0, options.maxContentLength);
        lines.push(`│    └─ ${preview.padEnd(47)}│`);
      }
    }
    lines.push("└─────────────────────────────────────────────────────────┘");
    lines.push("");

    // 假设
    if (options.showHypotheses && result.hypotheses.length > 0) {
      lines.push("┌─ 假设追踪 ─────────────────────────────────────────────┐");
      for (const hypothesis of result.hypotheses) {
        const status = this.getHypothesisStatusIcon(hypothesis.status);
        const confidence = ((hypothesis.confidence * 100).toFixed(0) + "%").padStart(4);
        const content = hypothesis.content.substring(0, options.maxContentLength);
        lines.push(`│ ${status} [${confidence}] ${content.padEnd(38)}│`);
      }
      lines.push("└─────────────────────────────────────────────────────────┘");
      lines.push("");
    }

    // 洞察
    if (options.showInsights && result.insights.length > 0) {
      lines.push("┌─ 关键洞察 ─────────────────────────────────────────────┐");
      for (let i = 0; i < result.insights.length; i++) {
        const insight = result.insights[i].substring(0, options.maxContentLength);
        lines.push(`│ 💡 ${i + 1}. ${insight.padEnd(46)}│`);
      }
      lines.push("└─────────────────────────────────────────────────────────┘");
    }

    return lines.join("\n");
  }

  /**
   * 格式化步骤名称
   */
  private formatStepName(name: ThinkingStepName): string {
    const names: Record<ThinkingStepName, string> = {
      [ThinkingStepName.INITIAL_ENGAGEMENT]: "初始参与",
      [ThinkingStepName.PROBLEM_ANALYSIS]: "问题分析",
      [ThinkingStepName.MULTIPLE_HYPOTHESES]: "多假设生成",
      [ThinkingStepName.NATURAL_DISCOVERY]: "自然发现",
      [ThinkingStepName.TESTING_VERIFICATION]: "测试验证",
      [ThinkingStepName.ERROR_CORRECTION]: "错误修正",
      [ThinkingStepName.KNOWLEDGE_SYNTHESIS]: "知识综合",
      [ThinkingStepName.PATTERN_RECOGNITION]: "模式识别",
      [ThinkingStepName.PROGRESS_TRACKING]: "进度追踪",
      [ThinkingStepName.RECURSIVE_THINKING]: "递归思考",
    };
    return names[name] || name;
  }

  /**
   * 获取假设状态图标
   */
  private getHypothesisStatusIcon(status: HypothesisStatus): string {
    const icons: Record<HypothesisStatus, string> = {
      [HypothesisStatus.ACTIVE]: "○",
      [HypothesisStatus.CONFIRMED]: "✓",
      [HypothesisStatus.REJECTED]: "✗",
      [HypothesisStatus.PENDING]: "◐",
    };
    return icons[status] || "?";
  }
}

// ============================================================
// Mermaid 可视化
// ============================================================

/**
 * Mermaid 可视化器
 */
export class MermaidVisualizer {
  /**
   * 可视化思考流程
   */
  visualize(result: ThinkingResult, options: VisualizationOptions): string {
    const lines: string[] = [];

    lines.push("```mermaid");
    lines.push("graph TD");

    // 添加节点
    for (let i = 0; i < result.stepResults.length; i++) {
      const step = result.stepResults[i];
      const name = this.formatStepName(step.stepName);
      const nodeId = `step${i}`;

      if (step.completed) {
        lines.push(`    ${nodeId}["${name}"]:::completed`);
      } else {
        lines.push(`    ${nodeId}["${name}"]:::pending`);
      }
    }

    // 添加连接
    for (let i = 0; i < result.stepResults.length - 1; i++) {
      lines.push(`    step${i} --> step${i + 1}`);
    }

    // 添加假设节点
    if (options.showHypotheses && result.hypotheses.length > 0) {
      lines.push("    subgraph hypotheses[假设追踪]");
      for (let i = 0; i < result.hypotheses.length; i++) {
        const h = result.hypotheses[i];
        const content = h.content.substring(0, 30).replace(/"/g, "'");
        const status = h.status;
        lines.push(`        hyp${i}["${content}<br/>${(h.confidence * 100).toFixed(0)}%"]:::${status}`);
      }
      lines.push("    end");
    }

    // 添加洞察节点
    if (options.showInsights && result.insights.length > 0) {
      lines.push("    subgraph insights[关键洞察]");
      for (let i = 0; i < result.insights.length; i++) {
        const insight = result.insights[i].substring(0, 30).replace(/"/g, "'");
        lines.push(`        insight${i}["${insight}"]:::insight`);
      }
      lines.push("    end");
    }

    // 添加样式
    lines.push("    classDef completed fill:#90EE90,stroke:#2E8B57");
    lines.push("    classDef pending fill:#FFE4B5,stroke:#DAA520");
    lines.push("    classDef active fill:#87CEEB,stroke:#4169E1");
    lines.push("    classDef confirmed fill:#98FB98,stroke:#228B22");
    lines.push("    classDef rejected fill:#FFB6C1,stroke:#DC143C");
    lines.push("    classDef insight fill:#DDA0DD,stroke:#8B008B");

    lines.push("```");

    return lines.join("\n");
  }

  /**
   * 格式化步骤名称
   */
  private formatStepName(name: ThinkingStepName): string {
    const names: Record<ThinkingStepName, string> = {
      [ThinkingStepName.INITIAL_ENGAGEMENT]: "初始参与",
      [ThinkingStepName.PROBLEM_ANALYSIS]: "问题分析",
      [ThinkingStepName.MULTIPLE_HYPOTHESES]: "多假设生成",
      [ThinkingStepName.NATURAL_DISCOVERY]: "自然发现",
      [ThinkingStepName.TESTING_VERIFICATION]: "测试验证",
      [ThinkingStepName.ERROR_CORRECTION]: "错误修正",
      [ThinkingStepName.KNOWLEDGE_SYNTHESIS]: "知识综合",
      [ThinkingStepName.PATTERN_RECOGNITION]: "模式识别",
      [ThinkingStepName.PROGRESS_TRACKING]: "进度追踪",
      [ThinkingStepName.RECURSIVE_THINKING]: "递归思考",
    };
    return names[name] || name;
  }
}

// ============================================================
// JSON 可视化
// ============================================================

/**
 * JSON 可视化器
 */
export class JSONVisualizer {
  /**
   * 可视化为 JSON
   */
  visualize(result: ThinkingResult, options: VisualizationOptions): string {
    const json: Record<string, unknown> = {
      id: result.id,
      depth: result.depth,
      confidence: result.confidence,
      tokensUsed: result.tokensUsed,
      duration: result.duration,
      steps: result.stepResults.map((step) => ({
        name: step.stepName,
        completed: step.completed,
        thoughtCount: step.thoughts.length,
        thoughts: options.detailed
          ? step.thoughts.map((t) => t.substring(0, options.maxContentLength))
          : undefined,
      })),
    };

    if (options.showHypotheses) {
      json.hypotheses = result.hypotheses.map((h) => ({
        id: h.id,
        content: h.content.substring(0, options.maxContentLength),
        confidence: h.confidence,
        status: h.status,
      }));
    }

    if (options.showInsights) {
      json.insights = result.insights.map((i) =>
        i.substring(0, options.maxContentLength)
      );
    }

    return JSON.stringify(json, null, 2);
  }
}

// ============================================================
// Markdown 可视化
// ============================================================

/**
 * Markdown 可视化器
 */
export class MarkdownVisualizer {
  /**
   * 可视化为 Markdown
   */
  visualize(result: ThinkingResult, options: VisualizationOptions): string {
    const lines: string[] = [];

    // 标题
    lines.push("# 思考过程分析");
    lines.push("");

    // 基本信息
    lines.push("## 📊 基本信息");
    lines.push("");
    lines.push("| 属性 | 值 |");
    lines.push("|------|-----|");
    lines.push(`| ID | \`${result.id}\` |`);
    lines.push(`| 深度 | ${result.depth} |`);
    lines.push(`| 置信度 | ${(result.confidence * 100).toFixed(1)}% |`);
    lines.push(`| Token 使用 | ${result.tokensUsed} |`);
    lines.push(`| 耗时 | ${result.duration}ms |`);
    lines.push("");

    // 思考步骤
    lines.push("## 🔄 思考步骤");
    lines.push("");

    for (let i = 0; i < result.stepResults.length; i++) {
      const step = result.stepResults[i];
      const status = step.completed ? "✅" : "⏳";
      const name = this.formatStepName(step.stepName);

      lines.push(`### ${status} ${i + 1}. ${name}`);
      lines.push("");

      if (options.detailed && step.thoughts.length > 0) {
        lines.push("**思考内容：**");
        lines.push("");
        for (const thought of step.thoughts) {
          lines.push(`- ${thought}`);
        }
        lines.push("");
      }
    }

    // 假设
    if (options.showHypotheses && result.hypotheses.length > 0) {
      lines.push("## 💭 假设追踪");
      lines.push("");
      lines.push("| 状态 | 置信度 | 内容 |");
      lines.push("|------|--------|------|");

      for (const h of result.hypotheses) {
        const status = this.getHypothesisStatusEmoji(h.status);
        const confidence = (h.confidence * 100).toFixed(0) + "%";
        const content = h.content.substring(0, options.maxContentLength);
        lines.push(`| ${status} | ${confidence} | ${content} |`);
      }
      lines.push("");
    }

    // 洞察
    if (options.showInsights && result.insights.length > 0) {
      lines.push("## 💡 关键洞察");
      lines.push("");
      for (let i = 0; i < result.insights.length; i++) {
        lines.push(`${i + 1}. ${result.insights[i]}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 格式化步骤名称
   */
  private formatStepName(name: ThinkingStepName): string {
    const names: Record<ThinkingStepName, string> = {
      [ThinkingStepName.INITIAL_ENGAGEMENT]: "初始参与",
      [ThinkingStepName.PROBLEM_ANALYSIS]: "问题分析",
      [ThinkingStepName.MULTIPLE_HYPOTHESES]: "多假设生成",
      [ThinkingStepName.NATURAL_DISCOVERY]: "自然发现",
      [ThinkingStepName.TESTING_VERIFICATION]: "测试验证",
      [ThinkingStepName.ERROR_CORRECTION]: "错误修正",
      [ThinkingStepName.KNOWLEDGE_SYNTHESIS]: "知识综合",
      [ThinkingStepName.PATTERN_RECOGNITION]: "模式识别",
      [ThinkingStepName.PROGRESS_TRACKING]: "进度追踪",
      [ThinkingStepName.RECURSIVE_THINKING]: "递归思考",
    };
    return names[name] || name;
  }

  /**
   * 获取假设状态 emoji
   */
  private getHypothesisStatusEmoji(status: HypothesisStatus): string {
    const emojis: Record<HypothesisStatus, string> = {
      [HypothesisStatus.ACTIVE]: "🔵",
      [HypothesisStatus.CONFIRMED]: "✅",
      [HypothesisStatus.REJECTED]: "❌",
      [HypothesisStatus.PENDING]: "🟡",
    };
    return emojis[status] || "❓";
  }
}

// ============================================================
// 可视化器工厂
// ============================================================

/**
 * 可视化器工厂
 */
export class ThinkingVisualizer {
  private asciiVisualizer: ASCIIVisualizer;
  private mermaidVisualizer: MermaidVisualizer;
  private jsonVisualizer: JSONVisualizer;
  private markdownVisualizer: MarkdownVisualizer;

  constructor() {
    this.asciiVisualizer = new ASCIIVisualizer();
    this.mermaidVisualizer = new MermaidVisualizer();
    this.jsonVisualizer = new JSONVisualizer();
    this.markdownVisualizer = new MarkdownVisualizer();
  }

  /**
   * 可视化思考结果
   */
  visualize(
    result: ThinkingResult,
    options: Partial<VisualizationOptions> = {}
  ): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    switch (opts.format) {
      case "ascii":
        return this.asciiVisualizer.visualize(result, opts);
      case "mermaid":
        return this.mermaidVisualizer.visualize(result, opts);
      case "json":
        return this.jsonVisualizer.visualize(result, opts);
      case "markdown":
        return this.markdownVisualizer.visualize(result, opts);
      default:
        return this.asciiVisualizer.visualize(result, opts);
    }
  }

  /**
   * 快速 ASCII 可视化
   */
  toASCII(result: ThinkingResult): string {
    return this.visualize(result, { format: "ascii" });
  }

  /**
   * 快速 Mermaid 可视化
   */
  toMermaid(result: ThinkingResult): string {
    return this.visualize(result, { format: "mermaid" });
  }

  /**
   * 快速 JSON 可视化
   */
  toJSON(result: ThinkingResult): string {
    return this.visualize(result, { format: "json" });
  }

  /**
   * 快速 Markdown 可视化
   */
  toMarkdown(result: ThinkingResult): string {
    return this.visualize(result, { format: "markdown" });
  }

  /**
   * 详细可视化
   */
  detailed(result: ThinkingResult, format: VisualizationFormat = "markdown"): string {
    return this.visualize(result, {
      format,
      detailed: true,
      showHypotheses: true,
      showInsights: true,
    });
  }
}

// 导出单例
export const thinkingVisualizer = new ThinkingVisualizer();
