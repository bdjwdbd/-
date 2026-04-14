/**
 * 自适应深度控制器
 * 
 * 根据问题特征动态调整思考深度
 * 基于 Thinking Claude 的 adaptive_thinking_framework
 */

import {
  ThinkingDepth,
  DepthAssessment,
  DepthAssessmentResult,
  HumanMessage,
} from "./types";

/**
 * 深度评估权重配置
 */
const ASSESSMENT_WEIGHTS = {
  complexity: 0.25,
  stakes: 0.20,
  timeSensitivity: -0.10, // 时间敏感时降低深度
  informationAvailable: 0.15,
  humanNeeds: 0.15,
  technicalLevel: 0.10,
  emotionalLevel: 0.05,
};

/**
 * Token 预算配置
 */
const TOKEN_BUDGETS = {
  [ThinkingDepth.MINIMAL]: 100,
  [ThinkingDepth.STANDARD]: 300,
  [ThinkingDepth.EXTENSIVE]: 800,
  [ThinkingDepth.DEEP]: 1500,
};

/**
 * 自适应深度控制器
 */
export class AdaptiveDepthController {
  private customWeights: Partial<typeof ASSESSMENT_WEIGHTS> = {};

  /**
   * 设置自定义权重
   */
  setWeights(weights: Partial<typeof ASSESSMENT_WEIGHTS>): void {
    this.customWeights = { ...ASSESSMENT_WEIGHTS, ...weights };
  }

  /**
   * 评估消息的思考深度
   */
  assessDepth(message: HumanMessage): DepthAssessmentResult {
    const assessment = this.analyzeMessage(message);
    const score = this.calculateScore(assessment);
    const depth = this.determineDepth(score);
    const tokenBudget = TOKEN_BUDGETS[depth];

    return {
      depth,
      score,
      assessment,
      tokenBudget,
    };
  }

  /**
   * 分析消息特征
   */
  private analyzeMessage(message: HumanMessage): DepthAssessment {
    const content = message.content.toLowerCase();

    return {
      complexity: this.assessComplexity(content),
      stakes: this.assessStakes(content),
      timeSensitivity: this.assessTimeSensitivity(content),
      informationAvailable: this.assessInformationAvailable(message),
      humanNeeds: this.assessHumanNeeds(content),
      technicalLevel: this.assessTechnicalLevel(content),
      emotionalLevel: this.assessEmotionalLevel(content),
    };
  }

  /**
   * 评估复杂度
   */
  private assessComplexity(content: string): number {
    let score = 0;

    // 长度因素
    if (content.length > 500) score += 0.2;
    if (content.length > 1000) score += 0.2;

    // 复杂度关键词
    const complexIndicators = [
      "分析", "比较", "评估", "设计", "架构", "优化",
      "为什么", "如何", "原理", "机制", "关系",
      "多个", "各种", "不同", "综合", "系统",
      "analyze", "compare", "evaluate", "design", "architecture",
      "why", "how", "principle", "mechanism", "relationship",
    ];
    const matchCount = complexIndicators.filter((k) => content.includes(k)).length;
    score += Math.min(0.3, matchCount * 0.05);

    // 逻辑连接词
    const logicIndicators = [
      "但是", "然而", "因此", "所以", "如果", "那么",
      "but", "however", "therefore", "if", "then", "because",
    ];
    const logicCount = logicIndicators.filter((k) => content.includes(k)).length;
    score += Math.min(0.2, logicCount * 0.04);

    // 多任务/多问题
    const questionMarks = (content.match(/[?？]/g) || []).length;
    if (questionMarks > 1) score += 0.1;

    return Math.min(1, score);
  }

  /**
   * 评估风险级别
   */
  private assessStakes(content: string): number {
    let score = 0;

    // 高风险关键词
    const highStakesIndicators = [
      "重要", "关键", "紧急", "严重", "危险", "安全",
      "生产", "线上", "部署", "发布", "删除", "修改",
      "important", "critical", "urgent", "serious", "dangerous", "security",
      "production", "deploy", "release", "delete", "modify",
    ];
    const matchCount = highStakesIndicators.filter((k) => content.includes(k)).length;
    score += Math.min(0.5, matchCount * 0.1);

    // 代码相关
    if (content.includes("代码") || content.includes("code")) {
      score += 0.2;
    }

    // 决策相关
    if (content.includes("决定") || content.includes("选择") || content.includes("decide")) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * 评估时间敏感性
   */
  private assessTimeSensitivity(content: string): number {
    let score = 0;

    // 时间紧迫关键词
    const urgentIndicators = [
      "紧急", "马上", "立即", "快速", "尽快", "现在",
      "urgent", "immediately", "quickly", "asap", "now", "hurry",
    ];
    const matchCount = urgentIndicators.filter((k) => content.includes(k)).length;
    score += Math.min(0.6, matchCount * 0.15);

    // 简单请求
    const simpleIndicators = [
      "简单", "快速", "一下", "看看", "查查",
      "simple", "quick", "just", "check",
    ];
    const simpleCount = simpleIndicators.filter((k) => content.includes(k)).length;
    score += Math.min(0.4, simpleCount * 0.1);

    return Math.min(1, score);
  }

  /**
   * 评估信息可用性
   */
  private assessInformationAvailable(message: HumanMessage): number {
    let score = 0.5; // 基础分数

    // 有附件
    if (message.attachments && message.attachments.length > 0) {
      score += 0.2;
    }

    // 内容长度
    if (message.content.length > 100) {
      score += 0.1;
    }
    if (message.content.length > 300) {
      score += 0.1;
    }

    // 具体细节
    const detailIndicators = [
      "具体", "详细", "例如", "比如", "如下",
      "specific", "detail", "example", "such as", "following",
    ];
    const matchCount = detailIndicators.filter((k) =>
      message.content.toLowerCase().includes(k)
    ).length;
    score += Math.min(0.1, matchCount * 0.03);

    return Math.min(1, score);
  }

  /**
   * 评估用户需求强度
   */
  private assessHumanNeeds(content: string): number {
    let score = 0;

    // 强需求关键词
    const strongNeedIndicators = [
      "必须", "一定", "需要", "想要", "希望", "请",
      "must", "need", "want", "hope", "please", "require",
    ];
    const matchCount = strongNeedIndicators.filter((k) => content.includes(k)).length;
    score += Math.min(0.4, matchCount * 0.08);

    // 疑问词
    const questionIndicators = [
      "怎么", "如何", "为什么", "什么", "哪个", "是否",
      "how", "why", "what", "which", "whether",
    ];
    const questionCount = questionIndicators.filter((k) => content.includes(k)).length;
    score += Math.min(0.3, questionCount * 0.06);

    // 请求帮助
    if (content.includes("帮") || content.includes("help")) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * 评估技术程度
   */
  private assessTechnicalLevel(content: string): number {
    let score = 0;

    // 技术关键词
    const techIndicators = [
      "代码", "函数", "变量", "算法", "数据结构", "API",
      "数据库", "服务器", "网络", "协议", "接口", "框架",
      "code", "function", "variable", "algorithm", "data structure",
      "database", "server", "network", "protocol", "interface", "framework",
      "TypeScript", "JavaScript", "Python", "React", "Node",
    ];
    const matchCount = techIndicators.filter((k) =>
      content.toLowerCase().includes(k.toLowerCase())
    ).length;
    score += Math.min(0.6, matchCount * 0.08);

    // 代码块
    if (content.includes("```") || content.includes("`")) {
      score += 0.2;
    }

    // 技术动词
    const techVerbs = [
      "实现", "调试", "优化", "重构", "测试", "部署",
      "implement", "debug", "optimize", "refactor", "test", "deploy",
    ];
    const verbCount = techVerbs.filter((k) => content.includes(k)).length;
    score += Math.min(0.2, verbCount * 0.05);

    return Math.min(1, score);
  }

  /**
   * 评估情感程度
   */
  private assessEmotionalLevel(content: string): number {
    let score = 0;

    // 情感关键词
    const emotionalIndicators = [
      "担心", "焦虑", "开心", "难过", "生气", "害怕",
      "喜欢", "讨厌", "希望", "失望", "感谢", "抱歉",
      "worried", "anxious", "happy", "sad", "angry", "afraid",
      "like", "hate", "hope", "disappointed", "thank", "sorry",
    ];
    const matchCount = emotionalIndicators.filter((k) => content.includes(k)).length;
    score += Math.min(0.5, matchCount * 0.1);

    // 感叹号
    const exclamationCount = (content.match(/[!！]/g) || []).length;
    score += Math.min(0.3, exclamationCount * 0.1);

    // 表情符号
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
    score += Math.min(0.2, emojiCount * 0.05);

    return Math.min(1, score);
  }

  /**
   * 计算综合分数
   */
  private calculateScore(assessment: DepthAssessment): number {
    const weights = { ...ASSESSMENT_WEIGHTS, ...this.customWeights };
    
    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const value = assessment[key as keyof DepthAssessment] || 0;
      score += value * weight;
    }

    // 归一化到 0-1
    const totalWeight = Object.values(weights).reduce((a, b) => a + Math.abs(b), 0);
    return Math.max(0, Math.min(1, (score + totalWeight) / (2 * totalWeight)));
  }

  /**
   * 确定思考深度
   */
  private determineDepth(score: number): ThinkingDepth {
    if (score < 0.25) return ThinkingDepth.MINIMAL;
    if (score < 0.5) return ThinkingDepth.STANDARD;
    if (score < 0.75) return ThinkingDepth.EXTENSIVE;
    return ThinkingDepth.DEEP;
  }

  /**
   * 获取深度描述
   */
  getDepthDescription(depth: ThinkingDepth): string {
    const descriptions = {
      [ThinkingDepth.MINIMAL]: "简单思考：快速响应，1-2 句思考",
      [ThinkingDepth.STANDARD]: "标准思考：常规分析，3-5 句思考",
      [ThinkingDepth.EXTENSIVE]: "深度思考：完整分析，意识流思考",
      [ThinkingDepth.DEEP]: "递归思考：多层级分析，递归验证",
    };
    return descriptions[depth];
  }
}

// 导出单例
export const adaptiveDepthController = new AdaptiveDepthController();
