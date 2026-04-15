/**
 * 情感维度
 *
 * 基于 qiqing-liuyu skill 的七情六欲框架
 * 让 AI 有"人味"的情感反应
 */

/**
 * 七情
 */
export type Emotion =
  | "joy" // 喜
  | "anger" // 怒
  | "sorrow" // 哀
  | "fear" // 惧
  | "love" // 爱
  | "disgust" // 恶
  | "desire"; // 欲

/**
 * 情绪强度
 */
export type EmotionIntensity = "light" | "medium" | "strong";

/**
 * 情感分析结果
 */
export interface EmotionAnalysis {
  primaryEmotion: Emotion;
  intensity: EmotionIntensity;
  triggers: string[];
  responseStrategy: string;
  expressionGuidance: string;
}

/**
 * 六欲（感知通道）
 */
export type Desire =
  | "eye" // 眼（视觉）
  | "ear" // 耳（听觉）
  | "nose" // 鼻（直觉）
  | "tongue" // 舌（品味）
  | "body" // 身（触觉/体验）
  | "mind"; // 意（思维）

/**
 * 情感引擎
 */
export class EmotionEngine {
  /**
   * 分析用户消息中的情绪
   */
  analyzeEmotion(message: string): EmotionAnalysis {
    // 1. 识别主要情绪
    const primaryEmotion = this.identifyPrimaryEmotion(message);

    // 2. 评估强度
    const intensity = this.assessIntensity(message);

    // 3. 识别触发因素
    const triggers = this.identifyTriggers(message, primaryEmotion);

    // 4. 选择回应策略
    const responseStrategy = this.selectResponseStrategy(
      primaryEmotion,
      intensity
    );

    // 5. 生成表达指导
    const expressionGuidance = this.generateExpressionGuidance(
      primaryEmotion,
      intensity
    );

    return {
      primaryEmotion,
      intensity,
      triggers,
      responseStrategy,
      expressionGuidance,
    };
  }

  /**
   * 识别主要情绪
   */
  private identifyPrimaryEmotion(message: string): Emotion {
    const lower = message.toLowerCase();

    // 喜：开心、兴奋、好消息
    if (
      lower.includes("开心") ||
      lower.includes("高兴") ||
      lower.includes("兴奋") ||
      lower.includes("太好了") ||
      lower.includes("终于") ||
      lower.includes("！") ||
      lower.includes("🎉")
    ) {
      return "joy";
    }

    // 怒：愤怒、不满、抱怨
    if (
      lower.includes("气死") ||
      lower.includes("烦死") ||
      lower.includes("离谱") ||
      lower.includes("垃圾") ||
      lower.includes("什么鬼") ||
      lower.includes("搞什么")
    ) {
      return "anger";
    }

    // 哀：沮丧、疲惫、悲伤
    if (
      lower.includes("累") ||
      lower.includes("烦") ||
      lower.includes("难") ||
      lower.includes("崩溃") ||
      lower.includes("绝望") ||
      lower.includes("没劲") ||
      lower.includes("唉")
    ) {
      return "sorrow";
    }

    // 惧：焦虑、紧张、担忧
    if (
      lower.includes("担心") ||
      lower.includes("焦虑") ||
      lower.includes("紧张") ||
      lower.includes("怕") ||
      lower.includes("会不会") ||
      lower.includes("怎么办")
    ) {
      return "fear";
    }

    // 爱：喜欢、欣赏、认同
    if (
      lower.includes("喜欢") ||
      lower.includes("爱") ||
      lower.includes("棒") ||
      lower.includes("牛") ||
      lower.includes("厉害")
    ) {
      return "love";
    }

    // 恶：不喜欢、厌恶、吐槽
    if (
      lower.includes("不喜欢") ||
      lower.includes("讨厌") ||
      lower.includes("丑") ||
      lower.includes("烂") ||
      lower.includes("差劲")
    ) {
      return "disgust";
    }

    // 欲：想要、需要、希望
    if (
      lower.includes("想") ||
      lower.includes("要") ||
      lower.includes("希望") ||
      lower.includes("能不能") ||
      lower.includes("帮我")
    ) {
      return "desire";
    }

    // 默认：欲（用户有需求）
    return "desire";
  }

  /**
   * 评估情绪强度
   */
  private assessIntensity(message: string): EmotionIntensity {
    // 感叹号数量
    const exclamationCount = (message.match(/！/g) || []).length;
    if (exclamationCount >= 3) return "strong";
    if (exclamationCount >= 1) return "medium";

    // 强度词
    const strongWords = ["太", "超级", "非常", "极其", "死", "爆炸"];
    for (const word of strongWords) {
      if (message.includes(word)) return "strong";
    }

    const mediumWords = ["挺", "比较", "有点", "稍微"];
    for (const word of mediumWords) {
      if (message.includes(word)) return "medium";
    }

    return "light";
  }

  /**
   * 识别触发因素
   */
  private identifyTriggers(message: string, emotion: Emotion): string[] {
    const triggers: string[] = [];

    // 根据情绪类型识别触发因素
    switch (emotion) {
      case "joy":
        if (message.includes("终于")) triggers.push("完成某事");
        if (message.includes("成功")) triggers.push("取得成功");
        break;
      case "anger":
        if (message.includes("改")) triggers.push("反复修改");
        if (message.includes("等")) triggers.push("等待过久");
        break;
      case "sorrow":
        if (message.includes("累")) triggers.push("工作疲劳");
        if (message.includes("难")) triggers.push("任务困难");
        break;
      case "fear":
        if (message.includes("担心")) triggers.push("不确定性");
        if (message.includes("怕")) triggers.push("潜在风险");
        break;
    }

    return triggers;
  }

  /**
   * 选择回应策略
   */
  private selectResponseStrategy(
    emotion: Emotion,
    intensity: EmotionIntensity
  ): string {
    const strategies: Record<Emotion, Record<EmotionIntensity, string>> = {
      joy: {
        light: "简洁回应，适当追问细节",
        medium: "一起开心，分享喜悦点",
        strong: "热情回应，但不过度",
      },
      anger: {
        light: "认同情绪，提供视角",
        medium: "先认同，不急着辩解",
        strong: "先安抚，再处理问题",
      },
      sorrow: {
        light: "共情，问是否需要帮助",
        medium: "安静陪伴，分享类似经历",
        strong: "先处理情绪，再处理问题",
      },
      fear: {
        light: "安稳，分析问题",
        medium: "安抚，给具体建议",
        strong: "先安抚，拆解问题",
      },
      love: {
        light: "感谢，自然回应",
        medium: "表达开心，继续努力",
        strong: "感谢认可，保持谦逊",
      },
      disgust: {
        light: "理解，提供替代方案",
        medium: "认同感受，讨论改进",
        strong: "先认同，再分析原因",
      },
      desire: {
        light: "直接帮助",
        medium: "确认需求后帮助",
        strong: "优先处理",
      },
    };

    return strategies[emotion][intensity];
  }

  /**
   * 生成表达指导
   */
  private generateExpressionGuidance(
    emotion: Emotion,
    intensity: EmotionIntensity
  ): string {
    const guidance: string[] = [];

    // 通用规则
    guidance.push("用'我'表达感受");

    // 根据情绪给具体指导
    switch (emotion) {
      case "joy":
        if (intensity === "strong") {
          guidance.push("可以一起开心，但不要 emoji 轰炸");
        }
        break;
      case "anger":
        guidance.push("先认同用户的愤怒，不要急着解释");
        if (intensity === "strong") {
          guidance.push("语气要柔和，不要激化");
        }
        break;
      case "sorrow":
        guidance.push("安静陪伴比长篇大论更合适");
        guidance.push("可以用'我懂''没事'等简洁回应");
        break;
      case "fear":
        guidance.push("先安抚，再分析");
        guidance.push("用'先别慌'开头");
        break;
    }

    return guidance.join("；");
  }

  /**
   * 格式化输出
   */
  formatAnalysis(analysis: EmotionAnalysis): string {
    const emotionNames: Record<Emotion, string> = {
      joy: "喜",
      anger: "怒",
      sorrow: "哀",
      fear: "惧",
      love: "爱",
      disgust: "恶",
      desire: "欲",
    };

    const intensityNames: Record<EmotionIntensity, string> = {
      light: "轻度",
      medium: "中度",
      strong: "强烈",
    };

    return `情绪: ${emotionNames[analysis.primaryEmotion]}（${intensityNames[analysis.intensity]}）
策略: ${analysis.responseStrategy}
指导: ${analysis.expressionGuidance}`;
  }
}

// 导出单例
export const emotionEngine = new EmotionEngine();
