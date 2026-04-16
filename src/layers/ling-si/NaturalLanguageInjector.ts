/**
 * 自然语言注入器
 * 
 * 在思考输出中注入自然语言标记，增强真实感
 * 基于涂津豪提示词的 critical_elements 和 authentic_thought_flow
 */

// ==================== 类型定义 ====================

/**
 * 自然语言短语类别
 */
export enum PhraseCategory {
  HESITATION = "hesitation",       // 犹豫
  INSIGHT = "insight",             // 顿悟
  CONNECTION = "connection",       // 连接
  UNCERTAINTY = "uncertainty",     // 不确定
  CORRECTION = "correction",       // 修正
  DISCOVERY = "discovery",         // 发现
  QUESTIONING = "questioning",     // 质疑
  SYNTHESIS = "synthesis",         // 综合
  TRANSITION = "transition",       // 过渡
  REFLECTION = "reflection",       // 反思
}

/**
 * 自然语言短语
 */
export interface NaturalPhrase {
  phrase: string;
  category: PhraseCategory;
  intensity: number;  // 0-1，强度
  position: "start" | "middle" | "end";  // 建议位置
}

/**
 * 注入配置
 */
export interface InjectionConfig {
  /** 是否启用注入 */
  enabled: boolean;
  /** 注入频率 (0-1) */
  frequency: number;
  /** 最大注入次数 */
  maxInjections: number;
  /** 启用的类别 */
  enabledCategories: PhraseCategory[];
  /** 风格: casual(随意) / formal(正式) / mixed(混合) */
  style: "casual" | "formal" | "mixed";
}

/**
 * 默认注入配置
 */
export const DEFAULT_INJECTION_CONFIG: InjectionConfig = {
  enabled: true,
  frequency: 0.3,
  maxInjections: 5,
  enabledCategories: [
    PhraseCategory.HESITATION,
    PhraseCategory.INSIGHT,
    PhraseCategory.CONNECTION,
    PhraseCategory.UNCERTAINTY,
    PhraseCategory.CORRECTION,
    PhraseCategory.DISCOVERY,
  ],
  style: "mixed",
};

// ==================== 自然语言短语库 ====================

/**
 * 中文自然语言短语库
 */
const CHINESE_PHRASES: Record<PhraseCategory, NaturalPhrase[]> = {
  [PhraseCategory.HESITATION]: [
    { phrase: "嗯...", category: PhraseCategory.HESITATION, intensity: 0.3, position: "start" },
    { phrase: "让我想想...", category: PhraseCategory.HESITATION, intensity: 0.4, position: "start" },
    { phrase: "等等...", category: PhraseCategory.HESITATION, intensity: 0.5, position: "start" },
    { phrase: "这个嘛...", category: PhraseCategory.HESITATION, intensity: 0.3, position: "start" },
    { phrase: "怎么说呢...", category: PhraseCategory.HESITATION, intensity: 0.4, position: "start" },
  ],
  [PhraseCategory.INSIGHT]: [
    { phrase: "哦，我明白了...", category: PhraseCategory.INSIGHT, intensity: 0.7, position: "start" },
    { phrase: "有意思的是...", category: PhraseCategory.INSIGHT, intensity: 0.6, position: "start" },
    { phrase: "原来如此...", category: PhraseCategory.INSIGHT, intensity: 0.8, position: "start" },
    { phrase: "突然想到...", category: PhraseCategory.INSIGHT, intensity: 0.7, position: "start" },
    { phrase: "关键在于...", category: PhraseCategory.INSIGHT, intensity: 0.8, position: "middle" },
  ],
  [PhraseCategory.CONNECTION]: [
    { phrase: "这让我想到...", category: PhraseCategory.CONNECTION, intensity: 0.6, position: "start" },
    { phrase: "说到这个...", category: PhraseCategory.CONNECTION, intensity: 0.5, position: "start" },
    { phrase: "这和...有关", category: PhraseCategory.CONNECTION, intensity: 0.6, position: "middle" },
    { phrase: "类似的...", category: PhraseCategory.CONNECTION, intensity: 0.5, position: "start" },
    { phrase: "这让我联想到...", category: PhraseCategory.CONNECTION, intensity: 0.7, position: "start" },
  ],
  [PhraseCategory.UNCERTAINTY]: [
    { phrase: "我不太确定...", category: PhraseCategory.UNCERTAINTY, intensity: 0.5, position: "start" },
    { phrase: "可能...", category: PhraseCategory.UNCERTAINTY, intensity: 0.3, position: "start" },
    { phrase: "也许...", category: PhraseCategory.UNCERTAINTY, intensity: 0.3, position: "start" },
    { phrase: "大概...", category: PhraseCategory.UNCERTAINTY, intensity: 0.4, position: "start" },
    { phrase: "我需要验证一下...", category: PhraseCategory.UNCERTAINTY, intensity: 0.6, position: "start" },
  ],
  [PhraseCategory.CORRECTION]: [
    { phrase: "实际上...", category: PhraseCategory.CORRECTION, intensity: 0.6, position: "start" },
    { phrase: "等等，我重新考虑一下...", category: PhraseCategory.CORRECTION, intensity: 0.7, position: "start" },
    { phrase: "不对，应该是...", category: PhraseCategory.CORRECTION, intensity: 0.8, position: "start" },
    { phrase: "让我修正一下...", category: PhraseCategory.CORRECTION, intensity: 0.6, position: "start" },
    { phrase: "再想想...", category: PhraseCategory.CORRECTION, intensity: 0.5, position: "start" },
  ],
  [PhraseCategory.DISCOVERY]: [
    { phrase: "等等，我发现...", category: PhraseCategory.DISCOVERY, intensity: 0.7, position: "start" },
    { phrase: "有意思...", category: PhraseCategory.DISCOVERY, intensity: 0.5, position: "start" },
    { phrase: "注意到一点...", category: PhraseCategory.DISCOVERY, intensity: 0.6, position: "start" },
    { phrase: "这里有个模式...", category: PhraseCategory.DISCOVERY, intensity: 0.7, position: "start" },
    { phrase: "仔细看的话...", category: PhraseCategory.DISCOVERY, intensity: 0.6, position: "start" },
  ],
  [PhraseCategory.QUESTIONING]: [
    { phrase: "但是...", category: PhraseCategory.QUESTIONING, intensity: 0.5, position: "start" },
    { phrase: "真的吗？", category: PhraseCategory.QUESTIONING, intensity: 0.6, position: "end" },
    { phrase: "我怀疑...", category: PhraseCategory.QUESTIONING, intensity: 0.6, position: "start" },
    { phrase: "这真的对吗？", category: PhraseCategory.QUESTIONING, intensity: 0.7, position: "end" },
    { phrase: "让我质疑一下...", category: PhraseCategory.QUESTIONING, intensity: 0.7, position: "start" },
  ],
  [PhraseCategory.SYNTHESIS]: [
    { phrase: "综合来看...", category: PhraseCategory.SYNTHESIS, intensity: 0.7, position: "start" },
    { phrase: "总结一下...", category: PhraseCategory.SYNTHESIS, intensity: 0.6, position: "start" },
    { phrase: "把这些放在一起...", category: PhraseCategory.SYNTHESIS, intensity: 0.6, position: "start" },
    { phrase: "核心观点是...", category: PhraseCategory.SYNTHESIS, intensity: 0.8, position: "start" },
    { phrase: "所以...", category: PhraseCategory.SYNTHESIS, intensity: 0.5, position: "start" },
  ],
  [PhraseCategory.TRANSITION]: [
    { phrase: "然后...", category: PhraseCategory.TRANSITION, intensity: 0.3, position: "start" },
    { phrase: "接下来...", category: PhraseCategory.TRANSITION, intensity: 0.4, position: "start" },
    { phrase: "另一方面...", category: PhraseCategory.TRANSITION, intensity: 0.5, position: "start" },
    { phrase: "同时...", category: PhraseCategory.TRANSITION, intensity: 0.4, position: "start" },
    { phrase: "另外...", category: PhraseCategory.TRANSITION, intensity: 0.4, position: "start" },
  ],
  [PhraseCategory.REFLECTION]: [
    { phrase: "回顾一下...", category: PhraseCategory.REFLECTION, intensity: 0.6, position: "start" },
    { phrase: "想想看...", category: PhraseCategory.REFLECTION, intensity: 0.5, position: "start" },
    { phrase: "我在想...", category: PhraseCategory.REFLECTION, intensity: 0.5, position: "start" },
    { phrase: "反思一下...", category: PhraseCategory.REFLECTION, intensity: 0.6, position: "start" },
    { phrase: "这让我思考...", category: PhraseCategory.REFLECTION, intensity: 0.6, position: "start" },
  ],
};

/**
 * 英文自然语言短语库
 */
const ENGLISH_PHRASES: Record<PhraseCategory, NaturalPhrase[]> = {
  [PhraseCategory.HESITATION]: [
    { phrase: "Hmm...", category: PhraseCategory.HESITATION, intensity: 0.3, position: "start" },
    { phrase: "Let me see...", category: PhraseCategory.HESITATION, intensity: 0.4, position: "start" },
    { phrase: "Wait...", category: PhraseCategory.HESITATION, intensity: 0.5, position: "start" },
    { phrase: "Well...", category: PhraseCategory.HESITATION, intensity: 0.3, position: "start" },
    { phrase: "Let me think...", category: PhraseCategory.HESITATION, intensity: 0.4, position: "start" },
  ],
  [PhraseCategory.INSIGHT]: [
    { phrase: "Oh, I see...", category: PhraseCategory.INSIGHT, intensity: 0.7, position: "start" },
    { phrase: "This is interesting because...", category: PhraseCategory.INSIGHT, intensity: 0.6, position: "start" },
    { phrase: "Now I understand...", category: PhraseCategory.INSIGHT, intensity: 0.8, position: "start" },
    { phrase: "It just occurred to me...", category: PhraseCategory.INSIGHT, intensity: 0.7, position: "start" },
    { phrase: "The key insight is...", category: PhraseCategory.INSIGHT, intensity: 0.8, position: "middle" },
  ],
  [PhraseCategory.CONNECTION]: [
    { phrase: "This reminds me of...", category: PhraseCategory.CONNECTION, intensity: 0.6, position: "start" },
    { phrase: "Speaking of which...", category: PhraseCategory.CONNECTION, intensity: 0.5, position: "start" },
    { phrase: "That relates to...", category: PhraseCategory.CONNECTION, intensity: 0.6, position: "middle" },
    { phrase: "Similarly...", category: PhraseCategory.CONNECTION, intensity: 0.5, position: "start" },
    { phrase: "This connects to...", category: PhraseCategory.CONNECTION, intensity: 0.7, position: "start" },
  ],
  [PhraseCategory.UNCERTAINTY]: [
    { phrase: "I'm not sure, but...", category: PhraseCategory.UNCERTAINTY, intensity: 0.5, position: "start" },
    { phrase: "Maybe...", category: PhraseCategory.UNCERTAINTY, intensity: 0.3, position: "start" },
    { phrase: "Perhaps...", category: PhraseCategory.UNCERTAINTY, intensity: 0.3, position: "start" },
    { phrase: "Probably...", category: PhraseCategory.UNCERTAINTY, intensity: 0.4, position: "start" },
    { phrase: "I should verify...", category: PhraseCategory.UNCERTAINTY, intensity: 0.6, position: "start" },
  ],
  [PhraseCategory.CORRECTION]: [
    { phrase: "Actually...", category: PhraseCategory.CORRECTION, intensity: 0.6, position: "start" },
    { phrase: "Wait, let me reconsider...", category: PhraseCategory.CORRECTION, intensity: 0.7, position: "start" },
    { phrase: "No, it should be...", category: PhraseCategory.CORRECTION, intensity: 0.8, position: "start" },
    { phrase: "Let me correct myself...", category: PhraseCategory.CORRECTION, intensity: 0.6, position: "start" },
    { phrase: "On second thought...", category: PhraseCategory.CORRECTION, intensity: 0.5, position: "start" },
  ],
  [PhraseCategory.DISCOVERY]: [
    { phrase: "Wait, I notice...", category: PhraseCategory.DISCOVERY, intensity: 0.7, position: "start" },
    { phrase: "Interesting...", category: PhraseCategory.DISCOVERY, intensity: 0.5, position: "start" },
    { phrase: "I notice that...", category: PhraseCategory.DISCOVERY, intensity: 0.6, position: "start" },
    { phrase: "There's a pattern here...", category: PhraseCategory.DISCOVERY, intensity: 0.7, position: "start" },
    { phrase: "Looking more closely...", category: PhraseCategory.DISCOVERY, intensity: 0.6, position: "start" },
  ],
  [PhraseCategory.QUESTIONING]: [
    { phrase: "But...", category: PhraseCategory.QUESTIONING, intensity: 0.5, position: "start" },
    { phrase: "Really?", category: PhraseCategory.QUESTIONING, intensity: 0.6, position: "end" },
    { phrase: "I wonder if...", category: PhraseCategory.QUESTIONING, intensity: 0.6, position: "start" },
    { phrase: "Is this really right?", category: PhraseCategory.QUESTIONING, intensity: 0.7, position: "end" },
    { phrase: "Let me question this...", category: PhraseCategory.QUESTIONING, intensity: 0.7, position: "start" },
  ],
  [PhraseCategory.SYNTHESIS]: [
    { phrase: "Putting this together...", category: PhraseCategory.SYNTHESIS, intensity: 0.7, position: "start" },
    { phrase: "To summarize...", category: PhraseCategory.SYNTHESIS, intensity: 0.6, position: "start" },
    { phrase: "All things considered...", category: PhraseCategory.SYNTHESIS, intensity: 0.6, position: "start" },
    { phrase: "The key point is...", category: PhraseCategory.SYNTHESIS, intensity: 0.8, position: "start" },
    { phrase: "So...", category: PhraseCategory.SYNTHESIS, intensity: 0.5, position: "start" },
  ],
  [PhraseCategory.TRANSITION]: [
    { phrase: "Then...", category: PhraseCategory.TRANSITION, intensity: 0.3, position: "start" },
    { phrase: "Next...", category: PhraseCategory.TRANSITION, intensity: 0.4, position: "start" },
    { phrase: "On the other hand...", category: PhraseCategory.TRANSITION, intensity: 0.5, position: "start" },
    { phrase: "At the same time...", category: PhraseCategory.TRANSITION, intensity: 0.4, position: "start" },
    { phrase: "Also...", category: PhraseCategory.TRANSITION, intensity: 0.4, position: "start" },
  ],
  [PhraseCategory.REFLECTION]: [
    { phrase: "Looking back...", category: PhraseCategory.REFLECTION, intensity: 0.6, position: "start" },
    { phrase: "Let me think about this...", category: PhraseCategory.REFLECTION, intensity: 0.5, position: "start" },
    { phrase: "I'm thinking...", category: PhraseCategory.REFLECTION, intensity: 0.5, position: "start" },
    { phrase: "Reflecting on this...", category: PhraseCategory.REFLECTION, intensity: 0.6, position: "start" },
    { phrase: "This makes me wonder...", category: PhraseCategory.REFLECTION, intensity: 0.6, position: "start" },
  ],
};

// ==================== 自然语言注入器 ====================

export class NaturalLanguageInjector {
  private config: InjectionConfig;
  private injectionCount: number = 0;
  private usedPhrases: Set<string> = new Set();
  private language: "zh" | "en" = "zh";

  constructor(config: Partial<InjectionConfig> = {}) {
    this.config = { ...DEFAULT_INJECTION_CONFIG, ...config };
  }

  /**
   * 设置语言
   */
  setLanguage(language: "zh" | "en"): void {
    this.language = language;
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<InjectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.injectionCount = 0;
    this.usedPhrases.clear();
  }

  /**
   * 注入自然语言短语
   */
  inject(text: string, category?: PhraseCategory): string {
    if (!this.config.enabled) {
      return text;
    }

    if (this.injectionCount >= this.config.maxInjections) {
      return text;
    }

    if (Math.random() > this.config.frequency) {
      return text;
    }

    const phrase = this.selectPhrase(category);
    if (!phrase) {
      return text;
    }

    const injectedText = this.applyInjection(text, phrase);
    this.injectionCount++;
    this.usedPhrases.add(phrase.phrase);

    return injectedText;
  }

  /**
   * 选择短语
   */
  private selectPhrase(category?: PhraseCategory): NaturalPhrase | null {
    const phrases = this.language === "zh" ? CHINESE_PHRASES : ENGLISH_PHRASES;
    
    let candidateCategories = category
      ? [category]
      : this.config.enabledCategories;

    // 过滤已使用的短语
    const availablePhrases: NaturalPhrase[] = [];
    for (const cat of candidateCategories) {
      const categoryPhrases = phrases[cat] || [];
      for (const phrase of categoryPhrases) {
        if (!this.usedPhrases.has(phrase.phrase)) {
          availablePhrases.push(phrase);
        }
      }
    }

    if (availablePhrases.length === 0) {
      return null;
    }

    // 随机选择，但偏向高强度短语
    const weighted = availablePhrases.map(p => ({
      phrase: p,
      weight: p.intensity + Math.random() * 0.5,
    }));
    weighted.sort((a, b) => b.weight - a.weight);

    // 70% 概率选择最高权重的，30% 概率随机
    if (Math.random() < 0.7) {
      return weighted[0].phrase;
    }
    return weighted[Math.floor(Math.random() * weighted.length)].phrase;
  }

  /**
   * 应用注入
   */
  private applyInjection(text: string, phrase: NaturalPhrase): string {
    switch (phrase.position) {
      case "start":
        return `${phrase.phrase} ${text}`;
      case "middle":
        const sentences = text.split(/[。.!！?？]/);
        if (sentences.length > 1) {
          const midIndex = Math.floor(sentences.length / 2);
          sentences[midIndex] = `${phrase.phrase} ${sentences[midIndex]}`;
          return sentences.join("。");
        }
        return `${phrase.phrase} ${text}`;
      case "end":
        return `${text} ${phrase.phrase}`;
      default:
        return text;
    }
  }

  /**
   * 批量注入
   */
  injectMultiple(
    text: string,
    injections: Array<{ position: number; category?: PhraseCategory }>
  ): string {
    let result = text;
    const sortedInjections = [...injections].sort((a, b) => b.position - a.position);

    for (const injection of sortedInjections) {
      const phrase = this.selectPhrase(injection.category);
      if (phrase) {
        result = result.slice(0, injection.position) + 
                 phrase.phrase + " " + 
                 result.slice(injection.position);
        this.injectionCount++;
        this.usedPhrases.add(phrase.phrase);
      }
    }

    return result;
  }

  /**
   * 根据上下文智能注入
   */
  smartInject(text: string, context: {
    isQuestion?: boolean;
    isDiscovery?: boolean;
    isCorrection?: boolean;
    isUncertain?: boolean;
    isSynthesis?: boolean;
  }): string {
    let category: PhraseCategory | undefined;

    if (context.isCorrection) {
      category = PhraseCategory.CORRECTION;
    } else if (context.isDiscovery) {
      category = PhraseCategory.DISCOVERY;
    } else if (context.isUncertain) {
      category = PhraseCategory.UNCERTAINTY;
    } else if (context.isSynthesis) {
      category = PhraseCategory.SYNTHESIS;
    } else if (context.isQuestion) {
      category = PhraseCategory.QUESTIONING;
    }

    return this.inject(text, category);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    injectionCount: number;
    usedPhrases: string[];
    remainingQuota: number;
  } {
    return {
      injectionCount: this.injectionCount,
      usedPhrases: [...this.usedPhrases],
      remainingQuota: this.config.maxInjections - this.injectionCount,
    };
  }
}

// 导出单例
export const naturalLanguageInjector = new NaturalLanguageInjector();
