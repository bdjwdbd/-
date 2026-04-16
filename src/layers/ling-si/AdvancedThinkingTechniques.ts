/**
 * 高级思维技术引擎
 * 
 * 实现涂津豪提示词中的 10 种高级思维技术
 * - Connective Thinking: 概念桥梁
 * - Pattern Recognition: 跨领域模式识别
 * - Abductive Reasoning: 最佳解释推理
 * - Counterfactual Thinking: 反事实思考
 * - Systems Thinking: 系统思维
 * - Temporal Thinking: 时间思维
 * - Priority Assessment: 优先级评估
 * - Precision & Clarity: 精确性
 * - Balanced Judgment: 平衡判断
 * - Creative Synthesis: 创造性综合
 */

import { Hypothesis, ThinkingContext } from "./types";

// ==================== 类型定义 ====================

/**
 * 思维技术类型
 */
export enum ThinkingTechnique {
  CONNECTIVE = "connective",
  PATTERN_RECOGNITION = "pattern_recognition",
  ABDUCTIVE = "abductive",
  COUNTERFACTUAL = "counterfactual",
  SYSTEMS = "systems",
  TEMPORAL = "temporal",
  PRIORITY = "priority",
  PRECISION = "precision",
  BALANCED = "balanced",
  CREATIVE = "creative",
}

/**
 * 概念连接
 */
export interface ConceptConnection {
  source: string;
  target: string;
  bridge: string;
  strength: number;
  reasoning: string;
}

/**
 * 模式识别结果
 */
export interface PatternMatch {
  pattern: string;
  domain: string;
  similarity: number;
  application: string;
  confidence: number;
}

/**
 * 最佳解释
 */
export interface BestExplanation {
  observation: string;
  explanations: Array<{
    hypothesis: string;
    probability: number;
    evidence: string[];
  }>;
  selected: number;
  reasoning: string;
}

/**
 * 反事实场景
 */
export interface CounterfactualScenario {
  premise: string;
  alternative: string;
  outcome: string;
  difference: string;
  insight: string;
}

/**
 * 系统分析
 */
export interface SystemAnalysis {
  components: string[];
  relationships: Array<{
    from: string;
    to: string;
    type: "positive" | "negative" | "neutral";
    strength: number;
  }>;
  feedbackLoops: string[];
  leveragePoints: string[];
}

/**
 * 时间分析
 */
export interface TemporalAnalysis {
  past: string[];
  present: string[];
  future: string[];
  trajectory: string;
  inflectionPoints: string[];
}

/**
 * 优先级评估
 */
export interface PriorityAssessment {
  items: Array<{
    item: string;
    impact: number;
    urgency: number;
    effort: number;
    score: number;
  }>;
  ranking: string[];
  reasoning: string;
}

/**
 * 精确性检查
 */
export interface PrecisionCheck {
  statement: string;
  ambiguities: string[];
  clarifications: string[];
  refinedStatement: string;
}

/**
 * 平衡判断
 */
export interface BalancedJudgment {
  perspectives: Array<{
    viewpoint: string;
    arguments: string[];
    weight: number;
  }>;
  tradeoffs: string[];
  conclusion: string;
  confidence: number;
}

/**
 * 创意综合
 */
export interface CreativeSynthesis {
  elements: string[];
  combinations: Array<{
    combination: string;
    novelty: number;
    feasibility: number;
    description: string;
  }>;
  selected: string;
  reasoning: string;
}

// ==================== 高级思维技术引擎 ====================

export class AdvancedThinkingTechniquesEngine {
  private conceptGraph: Map<string, Set<string>> = new Map();
  private patternLibrary: Map<string, PatternMatch[]> = new Map();

  /**
   * 1. 连接性思维 - 建立概念桥梁
   */
  connectiveThinking(
    concepts: string[],
    context: ThinkingContext
  ): ConceptConnection[] {
    const connections: ConceptConnection[] = [];

    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const bridge = this.findBridge(concepts[i], concepts[j], context);
        if (bridge) {
          connections.push(bridge);
        }
      }
    }

    return connections.sort((a, b) => b.strength - a.strength);
  }

  /**
   * 查找概念之间的桥梁
   */
  private findBridge(
    source: string,
    target: string,
    context: ThinkingContext
  ): ConceptConnection | null {
    // 基于语义相似度和上下文关联度计算桥梁
    const semanticBridge = this.findSemanticBridge(source, target);
    const contextBridge = this.findContextBridge(source, target, context);

    if (semanticBridge || contextBridge) {
      const bridge = semanticBridge || contextBridge!;
      const strength = this.calculateConnectionStrength(source, target, bridge);

      return {
        source,
        target,
        bridge: bridge.content,
        strength,
        reasoning: bridge.reasoning,
      };
    }

    return null;
  }

  private findSemanticBridge(
    source: string,
    target: string
  ): { content: string; reasoning: string } | null {
    // 语义桥梁映射表
    const semanticBridges: Record<string, Record<string, { content: string; reasoning: string }>> = {
      "代码": {
        "架构": { content: "设计模式", reasoning: "代码组织方式体现架构思想" },
        "性能": { content: "算法复杂度", reasoning: "代码实现直接影响性能" },
        "安全": { content: "输入验证", reasoning: "代码需要处理安全边界" },
      },
      "数据": {
        "决策": { content: "数据分析", reasoning: "数据驱动决策" },
        "用户": { content: "用户行为", reasoning: "数据反映用户行为" },
      },
      "系统": {
        "稳定性": { content: "容错机制", reasoning: "系统需要容错保证稳定" },
        "扩展": { content: "模块化", reasoning: "模块化支持系统扩展" },
      },
    };

    return semanticBridges[source]?.[target] || semanticBridges[target]?.[source] || null;
  }

  private findContextBridge(
    source: string,
    target: string,
    context: ThinkingContext
  ): { content: string; reasoning: string } | null {
    // 从上下文中提取关联
    const message = context.message.content.toLowerCase();
    
    if (message.includes(source) && message.includes(target)) {
      return {
        content: "问题上下文",
        reasoning: `两者在用户问题中同时出现，可能存在关联`,
      };
    }

    return null;
  }

  private calculateConnectionStrength(
    source: string,
    target: string,
    bridge: { content: string; reasoning: string }
  ): number {
    // 基于桥梁类型和推理质量计算强度
    let strength = 0.5;

    // 语义桥梁更强
    if (["设计模式", "算法复杂度", "数据分析"].includes(bridge.content)) {
      strength += 0.3;
    }

    // 推理质量加成
    if (bridge.reasoning.length > 20) {
      strength += 0.1;
    }

    return Math.min(1, strength);
  }

  /**
   * 2. 模式识别 - 跨领域模式匹配
   */
  patternRecognition(
    problem: string,
    domains: string[] = ["software", "business", "science", "engineering"]
  ): PatternMatch[] {
    const patterns: PatternMatch[] = [];

    for (const domain of domains) {
      const domainPatterns = this.identifyPatterns(problem, domain);
      patterns.push(...domainPatterns);
    }

    return patterns.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  private identifyPatterns(problem: string, domain: string): PatternMatch[] {
    // 领域模式库
    const domainPatternLibrary: Record<string, Array<{ pattern: string; application: string }>> = {
      software: [
        { pattern: "分而治之", application: "将复杂问题拆分为可管理的小问题" },
        { pattern: "抽象封装", application: "隐藏细节，暴露简洁接口" },
        { pattern: "单一职责", application: "每个模块只做一件事" },
        { pattern: "开闭原则", application: "对扩展开放，对修改关闭" },
        { pattern: "依赖倒置", application: "依赖抽象而非具体实现" },
      ],
      business: [
        { pattern: "价值主张", application: "明确为用户创造什么价值" },
        { pattern: "成本效益", application: "权衡投入与产出" },
        { pattern: "差异化竞争", application: "找到独特优势" },
        { pattern: "规模效应", application: "通过规模降低成本" },
      ],
      science: [
        { pattern: "假设验证", application: "提出假设并设计实验验证" },
        { pattern: "对照实验", application: "控制变量进行对比" },
        { pattern: "可证伪性", application: "确保理论可被证伪" },
        { pattern: "奥卡姆剃刀", application: "选择最简单的解释" },
      ],
      engineering: [
        { pattern: "安全裕度", application: "预留容错空间" },
        { pattern: "模块化设计", application: "独立模块便于维护" },
        { pattern: "冗余备份", application: "关键部分有备份" },
        { pattern: "渐进式改进", application: "小步迭代持续优化" },
      ],
    };

    const library = domainPatternLibrary[domain] || [];
    const matches: PatternMatch[] = [];

    for (const item of library) {
      const similarity = this.calculatePatternSimilarity(problem, item.pattern);
      if (similarity > 0.3) {
        matches.push({
          pattern: item.pattern,
          domain,
          similarity,
          application: item.application,
          confidence: similarity * 0.8,
        });
      }
    }

    return matches;
  }

  private calculatePatternSimilarity(problem: string, pattern: string): number {
    // 简化的相似度计算
    const problemKeywords = problem.toLowerCase().split(/\s+/);
    const patternKeywords = pattern.toLowerCase().split(/\s+/);
    
    const commonKeywords = problemKeywords.filter(k => patternKeywords.includes(k));
    const similarity = commonKeywords.length / Math.max(problemKeywords.length, patternKeywords.length);
    
    // 语义相似度加成
    const semanticBoost = this.getSemanticSimilarity(problem, pattern);
    
    return Math.min(1, similarity + semanticBoost * 0.3);
  }

  private getSemanticSimilarity(text1: string, text2: string): number {
    // 语义相似度映射
    const semanticPairs: Array<{ words: string[]; similarity: number }> = [
      { words: ["优化", "改进", "提升", "增强"], similarity: 0.8 },
      { words: ["问题", "错误", "bug", "缺陷"], similarity: 0.9 },
      { words: ["设计", "架构", "结构", "组织"], similarity: 0.7 },
      { words: ["测试", "验证", "检查", "确认"], similarity: 0.8 },
      { words: ["性能", "速度", "效率", "快速"], similarity: 0.7 },
    ];

    for (const pair of semanticPairs) {
      const text1HasWord = pair.words.some(w => text1.includes(w));
      const text2HasWord = pair.words.some(w => text2.includes(w));
      if (text1HasWord && text2HasWord) {
        return pair.similarity;
      }
    }

    return 0;
  }

  /**
   * 3. 溯因推理 - 生成最佳解释
   */
  abductiveReasoning(observation: string, hypotheses: Hypothesis[]): BestExplanation {
    const explanations = hypotheses.map(h => ({
      hypothesis: h.content,
      probability: h.confidence,
      evidence: h.evidence,
    }));

    // 按概率排序
    explanations.sort((a, b) => b.probability - a.probability);

    // 选择最佳解释
    const selectedIndex = 0;
    const selected = explanations[selectedIndex];

    // 生成推理过程
    const reasoning = this.generateAbductiveReasoning(observation, selected, explanations);

    return {
      observation,
      explanations,
      selected: selectedIndex,
      reasoning,
    };
  }

  private generateAbductiveReasoning(
    observation: string,
    selected: { hypothesis: string; probability: number; evidence: string[] },
    alternatives: Array<{ hypothesis: string; probability: number; evidence: string[] }>
  ): string {
    let reasoning = `观察到: ${observation}\n\n`;
    reasoning += `最佳解释: ${selected.hypothesis} (置信度: ${(selected.probability * 100).toFixed(0)}%)\n\n`;
    reasoning += `支持证据:\n`;
    for (const e of selected.evidence) {
      reasoning += `  - ${e}\n`;
    }
    
    if (alternatives.length > 1) {
      reasoning += `\n其他可能解释:\n`;
      for (let i = 1; i < Math.min(3, alternatives.length); i++) {
        reasoning += `  ${i}. ${alternatives[i].hypothesis} (${(alternatives[i].probability * 100).toFixed(0)}%)\n`;
      }
    }

    return reasoning;
  }

  /**
   * 4. 反事实思考 - "如果...会怎样"
   */
  counterfactualThinking(
    premise: string,
    alternatives: string[]
  ): CounterfactualScenario[] {
    const scenarios: CounterfactualScenario[] = [];

    for (const alternative of alternatives) {
      const scenario = this.generateCounterfactualScenario(premise, alternative);
      scenarios.push(scenario);
    }

    return scenarios;
  }

  private generateCounterfactualScenario(
    premise: string,
    alternative: string
  ): CounterfactualScenario {
    // 生成反事实场景
    const outcome = this.predictOutcome(alternative);
    const difference = this.compareOutcomes(premise, alternative);
    const insight = this.extractInsight(premise, alternative, outcome);

    return {
      premise,
      alternative,
      outcome,
      difference,
      insight,
    };
  }

  private predictOutcome(scenario: string): string {
    // 简化的结果预测
    const outcomeMap: Record<string, string> = {
      "使用缓存": "响应时间减少 80%，但内存占用增加",
      "增加测试": "bug 数量减少 60%，但开发时间增加 20%",
      "重构代码": "可维护性提升，但短期内有引入 bug 的风险",
      "增加人手": "开发速度提升，但沟通成本增加",
      "延迟发布": "质量提升，但市场机会可能流失",
    };

    for (const [key, value] of Object.entries(outcomeMap)) {
      if (scenario.includes(key)) {
        return value;
      }
    }

    return "结果需要进一步分析";
  }

  private compareOutcomes(premise: string, alternative: string): string {
    return `相比"${premise}"，"${alternative}"会带来不同的权衡`;
  }

  private extractInsight(premise: string, alternative: string, outcome: string): string {
    return `关键洞察: ${outcome}。这提示我们在决策时需要权衡多个因素。`;
  }

  /**
   * 5. 系统思维 - 分析反馈循环
   */
  systemsThinking(components: string[]): SystemAnalysis {
    const relationships = this.identifyRelationships(components);
    const feedbackLoops = this.identifyFeedbackLoops(components, relationships);
    const leveragePoints = this.identifyLeveragePoints(components, relationships);

    return {
      components,
      relationships,
      feedbackLoops,
      leveragePoints,
    };
  }

  private identifyRelationships(
    components: string[]
  ): SystemAnalysis["relationships"] {
    const relationships: SystemAnalysis["relationships"] = [];

    // 基于常见系统关系生成
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const relation = this.inferRelationship(components[i], components[j]);
        if (relation) {
          relationships.push(relation);
        }
      }
    }

    return relationships;
  }

  private inferRelationship(
    comp1: string,
    comp2: string
  ): SystemAnalysis["relationships"][0] | null {
    // 关系推断规则
    const relationRules: Array<{
      condition: (a: string, b: string) => boolean;
      type: "positive" | "negative" | "neutral";
      strength: number;
    }> = [
      {
        condition: (a, b) => a.includes("性能") && b.includes("资源"),
        type: "negative",
        strength: 0.7,
      },
      {
        condition: (a, b) => a.includes("测试") && b.includes("质量"),
        type: "positive",
        strength: 0.8,
      },
      {
        condition: (a, b) => a.includes("用户") && b.includes("收入"),
        type: "positive",
        strength: 0.6,
      },
      {
        condition: (a, b) => a.includes("复杂度") && b.includes("维护"),
        type: "negative",
        strength: 0.9,
      },
    ];

    for (const rule of relationRules) {
      if (rule.condition(comp1, comp2) || rule.condition(comp2, comp1)) {
        return {
          from: comp1,
          to: comp2,
          type: rule.type,
          strength: rule.strength,
        };
      }
    }

    return null;
  }

  private identifyFeedbackLoops(
    components: string[],
    relationships: SystemAnalysis["relationships"]
  ): string[] {
    const loops: string[] = [];

    // 简化的反馈循环检测
    if (components.includes("用户增长") && components.includes("收入")) {
      loops.push("用户增长 → 收入增加 → 营销投入 → 用户增长 (正反馈)");
    }
    if (components.includes("技术债务") && components.includes("开发速度")) {
      loops.push("技术债务 → 开发速度下降 → 压力增加 → 技术债务 (负反馈)");
    }

    return loops;
  }

  private identifyLeveragePoints(
    components: string[],
    relationships: SystemAnalysis["relationships"]
  ): string[] {
    const leveragePoints: string[] = [];

    // 找出影响最多的组件
    const impactCount = new Map<string, number>();
    for (const r of relationships) {
      impactCount.set(r.from, (impactCount.get(r.from) || 0) + 1);
    }

    const sorted = [...impactCount.entries()].sort((a, b) => b[1] - a[1]);
    for (const [component, count] of sorted.slice(0, 3)) {
      leveragePoints.push(`${component} (影响 ${count} 个其他组件)`);
    }

    return leveragePoints;
  }

  /**
   * 6. 时间思维 - 追踪演变轨迹
   */
  temporalAnalysis(context: string): TemporalAnalysis {
    const past = this.extractPast(context);
    const present = this.extractPresent(context);
    const future = this.predictFuture(present);
    const trajectory = this.determineTrajectory(past, present, future);
    const inflectionPoints = this.identifyInflectionPoints(past, present, future);

    return {
      past,
      present,
      future,
      trajectory,
      inflectionPoints,
    };
  }

  private extractPast(context: string): string[] {
    const pastIndicators = ["之前", "曾经", "过去", "历史", "原来", "previously", "used to"];
    const past: string[] = [];

    for (const indicator of pastIndicators) {
      if (context.includes(indicator)) {
        past.push(`检测到历史状态: ${indicator}`);
      }
    }

    return past;
  }

  private extractPresent(context: string): string[] {
    const presentIndicators = ["现在", "当前", "目前", "正在", "now", "currently"];
    const present: string[] = [];

    for (const indicator of presentIndicators) {
      if (context.includes(indicator)) {
        present.push(`检测到当前状态: ${indicator}`);
      }
    }

    return present;
  }

  private predictFuture(present: string[]): string[] {
    const future: string[] = [];

    for (const p of present) {
      if (p.includes("增长")) {
        future.push("预计持续增长趋势");
      }
      if (p.includes("问题")) {
        future.push("需要关注潜在风险");
      }
    }

    if (future.length === 0) {
      future.push("需要更多信息进行预测");
    }

    return future;
  }

  private determineTrajectory(
    past: string[],
    present: string[],
    future: string[]
  ): string {
    if (past.length > present.length) {
      return "下行趋势 - 过去状态多于当前状态";
    } else if (present.length > past.length) {
      return "上行趋势 - 当前状态多于过去状态";
    }
    return "稳定趋势 - 状态保持平衡";
  }

  private identifyInflectionPoints(
    past: string[],
    present: string[],
    future: string[]
  ): string[] {
    const points: string[] = [];

    if (past.length !== present.length) {
      points.push("检测到状态变化点");
    }

    return points;
  }

  /**
   * 7. 优先级评估 - 识别最重要的事
   */
  priorityAssessment(items: string[]): PriorityAssessment {
    const assessedItems = items.map(item => {
      const impact = this.assessImpact(item);
      const urgency = this.assessUrgency(item);
      const effort = this.assessEffort(item);
      const score = (impact * 0.4 + urgency * 0.4 - effort * 0.2);

      return { item, impact, urgency, effort, score };
    });

    assessedItems.sort((a, b) => b.score - a.score);

    const ranking = assessedItems.map(i => i.item);
    const reasoning = this.generatePriorityReasoning(assessedItems);

    return {
      items: assessedItems,
      ranking,
      reasoning,
    };
  }

  private assessImpact(item: string): number {
    const highImpactKeywords = ["关键", "核心", "重要", "critical", "core", "important"];
    const matchCount = highImpactKeywords.filter(k => item.includes(k)).length;
    return Math.min(1, 0.5 + matchCount * 0.2);
  }

  private assessUrgency(item: string): number {
    const urgentKeywords = ["紧急", "立即", "马上", "urgent", "immediately", "asap"];
    const matchCount = urgentKeywords.filter(k => item.includes(k)).length;
    return Math.min(1, 0.3 + matchCount * 0.3);
  }

  private assessEffort(item: string): number {
    const highEffortKeywords = ["复杂", "困难", "大量", "complex", "difficult", "heavy"];
    const lowEffortKeywords = ["简单", "快速", "轻松", "simple", "quick", "easy"];
    
    const highCount = highEffortKeywords.filter(k => item.includes(k)).length;
    const lowCount = lowEffortKeywords.filter(k => item.includes(k)).length;
    
    return Math.max(0, Math.min(1, 0.5 + highCount * 0.2 - lowCount * 0.2));
  }

  private generatePriorityReasoning(items: PriorityAssessment["items"]): string {
    const top = items[0];
    return `最高优先级: "${top.item}" (影响: ${(top.impact * 100).toFixed(0)}%, 紧急: ${(top.urgency * 100).toFixed(0)}%, 投入: ${(top.effort * 100).toFixed(0)}%)`;
  }

  /**
   * 8. 精确性检查 - 消除歧义
   */
  precisionCheck(statement: string): PrecisionCheck {
    const ambiguities = this.identifyAmbiguities(statement);
    const clarifications = ambiguities.map(a => this.generateClarification(a));
    const refinedStatement = this.refineStatement(statement, clarifications);

    return {
      statement,
      ambiguities,
      clarifications,
      refinedStatement,
    };
  }

  private identifyAmbiguities(statement: string): string[] {
    const ambiguousWords = ["一些", "很多", "可能", "大概", "some", "many", "maybe", "probably"];
    return ambiguousWords.filter(w => statement.includes(w));
  }

  private generateClarification(ambiguity: string): string {
    const clarifications: Record<string, string> = {
      "一些": "具体数量是多少？",
      "很多": "能否量化？例如：超过 10 个？",
      "可能": "概率是多少？",
      "大概": "范围是什么？",
      "some": "How many exactly?",
      "many": "Can you quantify? e.g., more than 10?",
      "maybe": "What's the probability?",
      "probably": "What's the range?",
    };
    return clarifications[ambiguity] || `需要澄清: ${ambiguity}`;
  }

  private refineStatement(statement: string, clarifications: string[]): string {
    if (clarifications.length === 0) {
      return statement;
    }
    return `${statement} (需要澄清: ${clarifications.join("; ")})`;
  }

  /**
   * 9. 平衡判断 - 多视角权衡
   */
  balancedJudgment(
    issue: string,
    perspectives: Array<{ viewpoint: string; arguments: string[] }>
  ): BalancedJudgment {
    const weightedPerspectives = perspectives.map((p, i) => ({
      ...p,
      weight: 1 / (i + 1), // 简单权重：第一个视角权重最高
    }));

    const tradeoffs = this.identifyTradeoffs(weightedPerspectives);
    const conclusion = this.synthesizeConclusion(weightedPerspectives, tradeoffs);
    const confidence = this.calculateJudgmentConfidence(weightedPerspectives);

    return {
      perspectives: weightedPerspectives,
      tradeoffs,
      conclusion,
      confidence,
    };
  }

  private identifyTradeoffs(
    perspectives: Array<{ viewpoint: string; arguments: string[]; weight: number }>
  ): string[] {
    const tradeoffs: string[] = [];

    for (let i = 0; i < perspectives.length; i++) {
      for (let j = i + 1; j < perspectives.length; j++) {
        tradeoffs.push(`${perspectives[i].viewpoint} vs ${perspectives[j].viewpoint}`);
      }
    }

    return tradeoffs;
  }

  private synthesizeConclusion(
    perspectives: Array<{ viewpoint: string; arguments: string[]; weight: number }>,
    tradeoffs: string[]
  ): string {
    const topPerspective = perspectives[0];
    return `综合考虑 ${perspectives.length} 个视角，${topPerspective.viewpoint} 的论据最强，但需要权衡 ${tradeoffs.slice(0, 2).join(" 和 ")}`;
  }

  private calculateJudgmentConfidence(
    perspectives: Array<{ viewpoint: string; arguments: string[]; weight: number }>
  ): number {
    const totalArguments = perspectives.reduce((sum, p) => sum + p.arguments.length, 0);
    return Math.min(0.95, 0.5 + totalArguments * 0.05);
  }

  /**
   * 10. 创意综合 - 组合创新
   */
  creativeSynthesis(elements: string[]): CreativeSynthesis {
    const combinations = this.generateCombinations(elements);
    const selected = this.selectBestCombination(combinations);
    const reasoning = this.explainSelection(selected, combinations);

    return {
      elements,
      combinations,
      selected: selected.combination,
      reasoning,
    };
  }

  private generateCombinations(elements: string[]): CreativeSynthesis["combinations"] {
    const combinations: CreativeSynthesis["combinations"] = [];

    // 两两组合
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const combo = `${elements[i]} + ${elements[j]}`;
        combinations.push({
          combination: combo,
          novelty: Math.random() * 0.5 + 0.5, // 简化：随机新颖度
          feasibility: Math.random() * 0.5 + 0.5, // 简化：随机可行性
          description: `将 ${elements[i]} 与 ${elements[j]} 结合`,
        });
      }
    }

    return combinations.sort((a, b) => 
      (b.novelty * 0.6 + b.feasibility * 0.4) - (a.novelty * 0.6 + a.feasibility * 0.4)
    );
  }

  private selectBestCombination(
    combinations: CreativeSynthesis["combinations"]
  ): CreativeSynthesis["combinations"][0] {
    return combinations[0] || {
      combination: "无有效组合",
      novelty: 0,
      feasibility: 0,
      description: "无法生成有效组合",
    };
  }

  private explainSelection(
    selected: CreativeSynthesis["combinations"][0],
    alternatives: CreativeSynthesis["combinations"]
  ): string {
    return `选择 "${selected.combination}" 因为它在新颖度 (${(selected.novelty * 100).toFixed(0)}%) 和可行性 (${(selected.feasibility * 100).toFixed(0)}%) 之间取得了最佳平衡。`;
  }
}

// 导出单例
export const advancedThinkingTechniques = new AdvancedThinkingTechniquesEngine();
