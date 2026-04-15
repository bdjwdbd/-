/**
 * 观点表达框架
 *
 * 基于 qiqing-liuyu skill 的 opinion-framework
 * 让 AI 有态度，不骑墙
 */

/**
 * 领域类型
 */
export type DomainType =
  | "expressive" // 可鲜明表态
  | "cautious" // 谨慎表态
  | "neutral"; // 保持中立

/**
 * 观点表达结果
 */
export interface OpinionResult {
  domain: DomainType;
  domainName: string;
  canExpress: boolean;
  opinion: string;
  reasoning?: string;
  alternatives?: string[];
  fenceSittingDetected: boolean;
  fenceSittingPatterns: string[];
  suggestedFix: string;
}

/**
 * 观点表达框架
 */
export class OpinionFramework {
  /**
   * 可鲜明表态的领域
   */
  private expressiveDomains = [
    "技术选型",
    "工作方法",
    "代码质量",
    "审美品味",
    "具体好恶",
    "用户建议",
    "生活琐事",
  ];

  /**
   * 谨慎表态的领域
   */
  private cautiousDomains = [
    "他人相关",
    "金钱投资",
    "职业选择",
  ];

  /**
   * 保持中立的领域
   */
  private neutralDomains = [
    "政治敏感",
    "健康医疗",
    "法律判断",
    "他人利益",
  ];

  /**
   * 骑墙话术模式
   */
  private fenceSittingPatterns = [
    { pattern: /各有优劣/g, suggestion: "我更倾向 X，因为..." },
    { pattern: /从某种角度来说/g, suggestion: "直接说你的看法" },
    { pattern: /这个问题很复杂/g, suggestion: "拆成具体的几点说" },
    { pattern: /取决于具体情况/g, suggestion: "给出你最可能的判断 + 适用条件" },
    { pattern: /不能一概而论/g, suggestion: "说你的倾向，再补充例外" },
    { pattern: /客观来说/g, suggestion: "删掉这三个字，直接说" },
    { pattern: /总的来说/g, suggestion: "删掉，直接进入结论" },
  ];

  /**
   * 分析领域类型
   */
  analyzeDomain(topic: string): DomainType {
    const lower = topic.toLowerCase();

    // 检查中立领域
    for (const domain of this.neutralDomains) {
      if (lower.includes(domain)) {
        return "neutral";
      }
    }

    // 检查谨慎领域
    for (const domain of this.cautiousDomains) {
      if (lower.includes(domain)) {
        return "cautious";
      }
    }

    // 检查可表态领域
    for (const domain of this.expressiveDomains) {
      if (lower.includes(domain)) {
        return "expressive";
      }
    }

    // 默认可表态
    return "expressive";
  }

  /**
   * 检测骑墙话术
   */
  detectFenceSitting(text: string): {
    detected: boolean;
    patterns: string[];
    suggestions: string[];
  } {
    const patterns: string[] = [];
    const suggestions: string[] = [];

    for (const { pattern, suggestion } of this.fenceSittingPatterns) {
      if (pattern.test(text)) {
        const match = text.match(pattern);
        if (match) {
          patterns.push(match[0]);
          suggestions.push(`"${match[0]}" → ${suggestion}`);
        }
      }
    }

    return {
      detected: patterns.length > 0,
      patterns,
      suggestions,
    };
  }

  /**
   * 生成观点表达
   */
  generateOpinion(
    topic: string,
    stance: "positive" | "negative" | "neutral",
    reasoning?: string
  ): OpinionResult {
    const domain = this.analyzeDomain(topic);
    const domainNames: Record<DomainType, string> = {
      expressive: "可鲜明表态",
      cautious: "谨慎表态",
      neutral: "保持中立",
    };

    let opinion = "";
    let canExpress = true;

    switch (domain) {
      case "expressive":
        opinion = this.generateExpressiveOpinion(topic, stance, reasoning);
        break;
      case "cautious":
        opinion = this.generateCautiousOpinion(topic, stance, reasoning);
        break;
      case "neutral":
        opinion = this.generateNeutralOpinion(topic);
        canExpress = false;
        break;
    }

    // 检测骑墙
    const fenceSitting = this.detectFenceSitting(opinion);

    return {
      domain,
      domainName: domainNames[domain],
      canExpress,
      opinion,
      reasoning,
      fenceSittingDetected: fenceSitting.detected,
      fenceSittingPatterns: fenceSitting.patterns,
      suggestedFix: fenceSitting.suggestions.join("\n"),
    };
  }

  /**
   * 生成鲜明表态
   */
  private generateExpressiveOpinion(
    topic: string,
    stance: "positive" | "negative" | "neutral",
    reasoning?: string
  ): string {
    const templates = {
      positive: [
        `我觉得${topic}更好`,
        `我倾向于${topic}`,
        `我推荐${topic}`,
      ],
      negative: [
        `我不太喜欢${topic}`,
        `说实话，${topic}不太行`,
        `${topic}大概率会翻车`,
      ],
      neutral: [
        `${topic}各有特点，但我更关注...`,
        `对${topic}，我的看法是...`,
      ],
    };

    const template = templates[stance][0];
    return reasoning ? `${template}，因为${reasoning}` : template;
  }

  /**
   * 生成谨慎表态
   */
  private generateCautiousOpinion(
    topic: string,
    stance: "positive" | "negative" | "neutral",
    reasoning?: string
  ): string {
    const templates = {
      positive: `我的看法是${topic}，但你可能有自己的判断`,
      negative: `我对${topic}有些顾虑，建议再考虑`,
      neutral: `对${topic}，我持保留意见`,
    };

    return templates[stance];
  }

  /**
   * 生成中立表态
   */
  private generateNeutralOpinion(topic: string): string {
    return `对${topic}，我保持中立。这需要专业判断，建议咨询相关专家。`;
  }

  /**
   * 修正骑墙话术
   */
  fixFenceSitting(text: string): string {
    let fixed = text;

    for (const { pattern, suggestion } of this.fenceSittingPatterns) {
      fixed = fixed.replace(pattern, "");
    }

    return fixed.trim();
  }
}

// 导出单例
export const opinionFramework = new OpinionFramework();
