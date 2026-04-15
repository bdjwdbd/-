/**
 * 高级思考步骤
 * 
 * 细化实现的思考步骤，提供更深入的分析能力
 * 
 * @note 增强版思考步骤，推荐用于新代码
 */

import {
  ThinkingStepName,
  ThinkingStepResult,
  ThinkingContext,
  Hypothesis,
  HypothesisStatus,
  getRandomTransition,
  HumanMessage,
} from "./types";

/**
 * 思考步骤接口
 */
export interface ThinkingStep {
  name: ThinkingStepName;
  description: string;
  execute(context: ThinkingContext): Promise<ThinkingStepResult>;
}

// ============================================================
// 增强的初始参与步骤
// ============================================================

export class EnhancedInitialEngagementStep implements ThinkingStep {
  name = ThinkingStepName.INITIAL_ENGAGEMENT;
  description = "增强的初始参与：深度理解、多维度分析";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const issues: string[] = [];
    const hypotheses: Hypothesis[] = [];

    const message = context.message;

    // 1. 多角度重述
    thoughts.push(`${getRandomTransition("start")} Let me understand this from multiple angles...`);
    
    const rephrasings = this.multiAngleRephrase(message);
    rephrasings.forEach((r, i) => {
      thoughts.push(`Angle ${i + 1}: ${r}`);
    });

    // 2. 情感分析
    thoughts.push("\nEmotional context:");
    const emotionalAnalysis = this.analyzeEmotion(message);
    thoughts.push(`  Tone: ${emotionalAnalysis.tone}`);
    thoughts.push(`  Urgency: ${emotionalAnalysis.urgency}`);
    thoughts.push(`  Complexity: ${emotionalAnalysis.complexity}`);

    // 3. 隐含需求识别
    thoughts.push(`\n${getRandomTransition("deeper")} Looking for implicit needs...`);
    const implicitNeeds = this.identifyImplicitNeeds(message);
    implicitNeeds.forEach((need) => {
      thoughts.push(`  - ${need}`);
    });

    // 4. 知识领域映射
    thoughts.push("\nKnowledge domains involved:");
    const domains = this.mapKnowledgeDomains(message);
    domains.forEach((domain) => {
      thoughts.push(`  - ${domain}`);
    });

    // 5. 生成初步假设
    thoughts.push(`\n${getRandomTransition("discovery")} Initial hypotheses...`);
    const initialHypotheses = this.generateInitialHypotheses(message);
    initialHypotheses.forEach((h, i) => {
      thoughts.push(`  H${i + 1}: ${h.content}`);
      hypotheses.push({
        id: `init_hyp_${i}`,
        content: h.content,
        confidence: h.confidence,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: this.name,
      });
    });

    // 6. 识别潜在歧义
    const ambiguities = this.deepIdentifyAmbiguities(message);
    if (ambiguities.length > 0) {
      thoughts.push(`\n${getRandomTransition("questioning")} Potential ambiguities detected:`);
      ambiguities.forEach((a) => {
        thoughts.push(`  - ${a}`);
        issues.push(a);
      });
    }

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.PROBLEM_ANALYSIS,
      issues,
      hypotheses,
      confidenceDelta: 0.15,
    };
  }

  private multiAngleRephrase(message: HumanMessage): string[] {
    const content = message.content;
    const rephrasings: string[] = [];

    // 字面理解
    rephrasings.push(`Literal: "${content}"`);

    // 意图理解
    if (content.includes("?") || content.includes("？")) {
      rephrasings.push(`Intent: User is seeking information or clarification`);
    } else if (content.includes("帮") || content.includes("help")) {
      rephrasings.push(`Intent: User needs assistance with a task`);
    } else {
      rephrasings.push(`Intent: User has a request to fulfill`);
    }

    // 深层理解
    rephrasings.push(`Deeper: User may have an underlying goal not explicitly stated`);

    return rephrasings;
  }

  private analyzeEmotion(message: HumanMessage): {
    tone: string;
    urgency: string;
    complexity: string;
  } {
    const content = message.content.toLowerCase();

    // 语气分析
    let tone = "neutral";
    if (content.includes("请") || content.includes("麻烦") || content.includes("谢谢")) {
      tone = "polite";
    } else if (content.includes("!") || content.includes("！")) {
      tone = "emphatic";
    } else if (content.includes("?") || content.includes("？")) {
      tone = "inquisitive";
    }

    // 紧迫性分析
    let urgency = "normal";
    if (content.includes("紧急") || content.includes("尽快") || content.includes("马上")) {
      urgency = "high";
    } else if (content.includes("有空") || content.includes("方便时")) {
      urgency = "low";
    }

    // 复杂度分析
    let complexity = "medium";
    const wordCount = content.split(/\s+/).length;
    const hasMultipleQuestions = (content.match(/[?？]/g) || []).length > 1;
    const hasTechnicalTerms = /代码|算法|架构|系统|数据库|api|function/i.test(content);

    if (wordCount < 10 && !hasMultipleQuestions) {
      complexity = "low";
    } else if (wordCount > 50 || hasMultipleQuestions || hasTechnicalTerms) {
      complexity = "high";
    }

    return { tone, urgency, complexity };
  }

  private identifyImplicitNeeds(message: HumanMessage): string[] {
    const needs: string[] = [];
    const content = message.content.toLowerCase();

    // 基于关键词推断隐含需求
    if (content.includes("代码") || content.includes("code")) {
      needs.push("May need code examples or implementation details");
      needs.push("May want best practices and common pitfalls");
    }

    if (content.includes("问题") || content.includes("problem") || content.includes("bug")) {
      needs.push("May need root cause analysis");
      needs.push("May want prevention strategies");
    }

    if (content.includes("优化") || content.includes("optimize")) {
      needs.push("May need performance metrics");
      needs.push("May want trade-off analysis");
    }

    if (content.includes("如何") || content.includes("how")) {
      needs.push("May need step-by-step guidance");
      needs.push("May want to understand the reasoning");
    }

    return needs.length > 0 ? needs : ["No specific implicit needs identified"];
  }

  private mapKnowledgeDomains(message: HumanMessage): string[] {
    const domains: string[] = [];
    const content = message.content.toLowerCase();

    const domainKeywords: Record<string, string[]> = {
      "Programming": ["代码", "函数", "变量", "算法", "code", "function", "algorithm"],
      "Database": ["数据库", "sql", "查询", "database", "query"],
      "Web Development": ["网页", "前端", "后端", "api", "web", "frontend", "backend"],
      "System Design": ["架构", "系统", "设计", "architecture", "system", "design"],
      "DevOps": ["部署", "服务器", "容器", "deploy", "server", "docker"],
      "Data Science": ["数据", "分析", "机器学习", "data", "analysis", "ml"],
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some((k) => content.includes(k))) {
        domains.push(domain);
      }
    }

    return domains.length > 0 ? domains : ["General Knowledge"];
  }

  private generateInitialHypotheses(message: HumanMessage): Array<{
    content: string;
    confidence: number;
  }> {
    const hypotheses: Array<{ content: string; confidence: number }> = [];
    const content = message.content.toLowerCase();

    // 基于问题类型生成假设
    if (content.includes("如何") || content.includes("how")) {
      hypotheses.push({
        content: "User wants a tutorial or guide",
        confidence: 0.7,
      });
    }

    if (content.includes("为什么") || content.includes("why")) {
      hypotheses.push({
        content: "User wants to understand underlying reasons",
        confidence: 0.7,
      });
    }

    if (content.includes("问题") || content.includes("error") || content.includes("bug")) {
      hypotheses.push({
        content: "User has encountered an error and needs troubleshooting",
        confidence: 0.6,
      });
    }

    if (content.includes("优化") || content.includes("optimize")) {
      hypotheses.push({
        content: "User wants performance improvement suggestions",
        confidence: 0.65,
      });
    }

    // 默认假设
    if (hypotheses.length === 0) {
      hypotheses.push({
        content: "User has a general request that needs clarification",
        confidence: 0.5,
      });
    }

    return hypotheses;
  }

  private deepIdentifyAmbiguities(message: HumanMessage): string[] {
    const ambiguities: string[] = [];
    const content = message.content;

    // 检查代词引用
    const pronouns = ["它", "这个", "那个", "这些", "那些", "it", "this", "that", "these", "those"];
    for (const pronoun of pronouns) {
      if (content.toLowerCase().includes(pronoun)) {
        ambiguities.push(`Pronoun "${pronoun}" may need clarification`);
        break;
      }
    }

    // 检查模糊量词
    const vagueQuantifiers = ["一些", "很多", "少量", "some", "many", "few", "several"];
    for (const quantifier of vagueQuantifiers) {
      if (content.toLowerCase().includes(quantifier)) {
        ambiguities.push(`Quantifier "${quantifier}" is imprecise`);
        break;
      }
    }

    // 检查技术术语歧义
    const ambiguousTerms = ["优化", "改进", "更好", "optimize", "improve", "better"];
    for (const term of ambiguousTerms) {
      if (content.toLowerCase().includes(term)) {
        ambiguities.push(`Term "${term}" may have multiple interpretations`);
        break;
      }
    }

    return ambiguities;
  }
}

// ============================================================
// 增强的问题分析步骤
// ============================================================

export class EnhancedProblemAnalysisStep implements ThinkingStep {
  name = ThinkingStepName.PROBLEM_ANALYSIS;
  description = "增强的问题分析：结构化分解、约束识别";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const issues: string[] = [];

    const message = context.message;

    // 1. 结构化分解
    thoughts.push(`${getRandomTransition("discovery")} Let me break this down systematically...`);
    
    const breakdown = this.structuralBreakdown(message);
    thoughts.push("\nProblem Structure:");
    thoughts.push(`  Main Goal: ${breakdown.mainGoal}`);
    thoughts.push(`  Sub-tasks: ${breakdown.subTasks.join(", ")}`);
    thoughts.push(`  Dependencies: ${breakdown.dependencies.join(", ")}`);

    // 2. 约束分析
    thoughts.push(`\n${getRandomTransition("deeper")} Analyzing constraints...`);
    const constraints = this.analyzeConstraints(message, context);
    constraints.forEach((c) => {
      thoughts.push(`  - [${c.type}] ${c.description}`);
    });

    // 3. 成功标准定义
    thoughts.push("\nSuccess Criteria:");
    const successCriteria = this.defineSuccessCriteria(message);
    successCriteria.forEach((c, i) => {
      thoughts.push(`  ${i + 1}. ${c}`);
    });

    // 4. 风险识别
    thoughts.push(`\n${getRandomTransition("questioning")} Potential risks to consider...`);
    const risks = this.identifyRisks(message);
    risks.forEach((r) => {
      thoughts.push(`  - ${r}`);
    });

    // 5. 资源需求
    thoughts.push("\nResources needed:");
    const resources = this.assessResourceNeeds(message);
    resources.forEach((r) => {
      thoughts.push(`  - ${r}`);
    });

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      issues,
      confidenceDelta: 0.1,
    };
  }

  private structuralBreakdown(message: HumanMessage): {
    mainGoal: string;
    subTasks: string[];
    dependencies: string[];
  } {
    const content = message.content;

    // 提取主要目标
    let mainGoal = content;
    if (content.includes("为了") || content.includes("以便")) {
      const parts = content.split(/为了|以便/);
      mainGoal = parts[parts.length - 1].trim();
    }

    // 提取子任务
    const subTasks: string[] = [];
    const actionVerbs = ["分析", "实现", "优化", "设计", "创建", "修复"];
    actionVerbs.forEach((verb) => {
      if (content.includes(verb)) {
        subTasks.push(verb);
      }
    });

    // 识别依赖
    const dependencies: string[] = [];
    if (content.includes("基于") || content.includes("根据")) {
      dependencies.push("Requires input data/context");
    }
    if (content.includes("使用") || content.includes("using")) {
      dependencies.push("Requires specific tools/technologies");
    }

    return {
      mainGoal: mainGoal.substring(0, 100),
      subTasks: subTasks.length > 0 ? subTasks : ["Complete the main task"],
      dependencies: dependencies.length > 0 ? dependencies : ["None identified"],
    };
  }

  private analyzeConstraints(
    message: HumanMessage,
    context: ThinkingContext
  ): Array<{ type: string; description: string }> {
    const constraints: Array<{ type: string; description: string }> = [];
    const content = message.content.toLowerCase();

    // 时间约束
    if (content.includes("紧急") || content.includes("尽快") || content.includes("urgent")) {
      constraints.push({
        type: "TIME",
        description: "Time-sensitive request, prioritize speed",
      });
    }

    // 技术约束
    if (content.includes("不能") || content.includes("无法") || content.includes("cannot")) {
      constraints.push({
        type: "TECHNICAL",
        description: "Some approaches may not be available",
      });
    }

    // 资源约束
    if (context.tokenBudget < 500) {
      constraints.push({
        type: "RESOURCE",
        description: "Limited token budget, keep response concise",
      });
    }

    // 质量约束
    if (content.includes("生产") || content.includes("线上") || content.includes("production")) {
      constraints.push({
        type: "QUALITY",
        description: "Production environment, need robust solution",
      });
    }

    return constraints.length > 0
      ? constraints
      : [{ type: "GENERAL", description: "No specific constraints identified" }];
  }

  private defineSuccessCriteria(message: HumanMessage): string[] {
    const criteria: string[] = [];
    const content = message.content.toLowerCase();

    if (content.includes("代码") || content.includes("code")) {
      criteria.push("Code is correct and runnable");
      criteria.push("Code follows best practices");
      criteria.push("Code is well-documented");
    }

    if (content.includes("解释") || content.includes("explain")) {
      criteria.push("Explanation is clear and understandable");
      criteria.push("Key concepts are covered");
    }

    if (content.includes("优化") || content.includes("optimize")) {
      criteria.push("Performance improvement is measurable");
      criteria.push("Trade-offs are explained");
    }

    if (criteria.length === 0) {
      criteria.push("User's request is fully addressed");
      criteria.push("Response is helpful and accurate");
    }

    return criteria;
  }

  private identifyRisks(message: HumanMessage): string[] {
    const risks: string[] = [];
    const content = message.content.toLowerCase();

    if (content.includes("生产") || content.includes("线上")) {
      risks.push("Changes may affect production systems");
    }

    if (content.includes("数据") && content.includes("删除")) {
      risks.push("Data loss risk if not careful");
    }

    if (content.includes("性能") || content.includes("performance")) {
      risks.push("Optimization may introduce new bugs");
    }

    return risks.length > 0 ? risks : ["No significant risks identified"];
  }

  private assessResourceNeeds(message: HumanMessage): string[] {
    const resources: string[] = [];
    const content = message.content.toLowerCase();

    if (content.includes("代码") || content.includes("code")) {
      resources.push("Code examples");
    }

    if (content.includes("文档") || content.includes("document")) {
      resources.push("Documentation references");
    }

    if (content.includes("数据") || content.includes("data")) {
      resources.push("Data samples or schemas");
    }

    return resources.length > 0 ? resources : ["General knowledge"];
  }
}

// ============================================================
// 增强的多假设生成步骤
// ============================================================

export class EnhancedMultipleHypothesesStep implements ThinkingStep {
  name = ThinkingStepName.MULTIPLE_HYPOTHESES;
  description = "增强的多假设生成：系统化假设空间探索";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const hypotheses: Hypothesis[] = [];

    const message = context.message;

    // 1. 假设空间定义
    thoughts.push(`${getRandomTransition("discovery")} Exploring the hypothesis space...`);
    
    const hypothesisSpace = this.defineHypothesisSpace(message);
    thoughts.push("\nHypothesis Dimensions:");
    hypothesisSpace.dimensions.forEach((d) => {
      thoughts.push(`  - ${d}`);
    });

    // 2. 生成竞争假设
    thoughts.push(`\n${getRandomTransition("deeper")} Generating competing hypotheses...`);
    const competingHypotheses = this.generateCompetingHypotheses(message);
    
    competingHypotheses.forEach((h, i) => {
      thoughts.push(`\nHypothesis ${i + 1}: ${h.content}`);
      thoughts.push(`  Confidence: ${(h.confidence * 100).toFixed(0)}%`);
      thoughts.push(`  Reasoning: ${h.reasoning}`);
      
      hypotheses.push({
        id: `comp_hyp_${i}`,
        content: h.content,
        confidence: h.confidence,
        evidence: [h.reasoning],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: this.name,
      });
    });

    // 3. 假设关系分析
    thoughts.push(`\n${getRandomTransition("connection")} Analyzing hypothesis relationships...`);
    const relationships = this.analyzeHypothesisRelationships(competingHypotheses);
    relationships.forEach((r) => {
      thoughts.push(`  - ${r}`);
    });

    // 4. 关键区分点
    thoughts.push("\nKey differentiating factors:");
    const differentiators = this.identifyDifferentiators(message);
    differentiators.forEach((d) => {
      thoughts.push(`  - ${d}`);
    });

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.NATURAL_DISCOVERY,
      hypotheses,
      confidenceDelta: 0.05,
    };
  }

  private defineHypothesisSpace(message: HumanMessage): {
    dimensions: string[];
  } {
    const content = message.content.toLowerCase();
    const dimensions: string[] = [];

    // 意图维度
    dimensions.push("Intent: What does the user really want?");

    // 范围维度
    if (content.includes("所有") || content.includes("全部")) {
      dimensions.push("Scope: Comprehensive vs. focused");
    }

    // 深度维度
    if (content.includes("详细") || content.includes("简单")) {
      dimensions.push("Depth: Detailed vs. concise");
    }

    // 方法维度
    dimensions.push("Approach: Which solution method is best?");

    return { dimensions };
  }

  private generateCompetingHypotheses(message: HumanMessage): Array<{
    content: string;
    confidence: number;
    reasoning: string;
  }> {
    const hypotheses: Array<{
      content: string;
      confidence: number;
      reasoning: string;
    }> = [];

    const content = message.content.toLowerCase();

    // 假设 1：字面理解
    hypotheses.push({
      content: "User's request should be interpreted literally",
      confidence: 0.6,
      reasoning: "Most straightforward interpretation",
    });

    // 假设 2：XY 问题
    if (content.includes("如何") && content.length < 100) {
      hypotheses.push({
        content: "This might be an XY problem - user is asking about their attempted solution",
        confidence: 0.4,
        reasoning: "Short 'how to' questions often hide the real problem",
      });
    }

    // 假设 3：学习意图
    if (content.includes("如何") || content.includes("怎么")) {
      hypotheses.push({
        content: "User wants to learn the process, not just get a result",
        confidence: 0.5,
        reasoning: "Process-oriented questions suggest learning intent",
      });
    }

    // 假设 4：问题解决
    if (content.includes("问题") || content.includes("错误") || content.includes("error")) {
      hypotheses.push({
        content: "User has encountered a specific problem and needs troubleshooting",
        confidence: 0.55,
        reasoning: "Problem-related keywords suggest troubleshooting need",
      });
    }

    return hypotheses;
  }

  private analyzeHypothesisRelationships(
    hypotheses: Array<{ content: string }>
  ): string[] {
    const relationships: string[] = [];

    if (hypotheses.length >= 2) {
      relationships.push(`H1 and H2 may be complementary rather than exclusive`);
    }

    if (hypotheses.length >= 3) {
      relationships.push(`H3 could be a subset of H1`);
    }

    relationships.push(`Need more information to distinguish between hypotheses`);

    return relationships;
  }

  private identifyDifferentiators(message: HumanMessage): string[] {
    const differentiators: string[] = [];
    const content = message.content.toLowerCase();

    if (content.includes("?") || content.includes("？")) {
      differentiators.push("The specific question being asked");
    }

    if (content.includes("代码") || content.includes("code")) {
      differentiators.push("The programming language and context");
    }

    differentiators.push("The user's background and expertise level");
    differentiators.push("The expected output format");

    return differentiators;
  }
}

// ============================================================
// 增强的测试验证步骤
// ============================================================

export class EnhancedTestingVerificationStep implements ThinkingStep {
  name = ThinkingStepName.TESTING_VERIFICATION;
  description = "增强的测试验证：系统化验证、边缘案例分析";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const issues: string[] = [];

    // 1. 逻辑一致性检查
    thoughts.push(`${getRandomTransition("questioning")} Checking logical consistency...`);
    const consistencyChecks = this.checkLogicalConsistency(context);
    consistencyChecks.forEach((c) => {
      thoughts.push(`  ${c.passed ? "✓" : "✗"} ${c.check}`);
      if (!c.passed) {
        issues.push(c.check);
      }
    });

    // 2. 边缘案例分析
    thoughts.push(`\n${getRandomTransition("deeper")} Analyzing edge cases...`);
    const edgeCases = this.analyzeEdgeCases(context);
    edgeCases.forEach((ec) => {
      thoughts.push(`  - ${ec.description}: ${ec.implication}`);
    });

    // 3. 假设压力测试
    thoughts.push("\nStress-testing hypotheses...");
    const stressTestResults = this.stressTestHypotheses(context);
    stressTestResults.forEach((r) => {
      thoughts.push(`  - ${r}`);
    });

    // 4. 反例搜索
    thoughts.push(`\n${getRandomTransition("questioning")} Searching for counter-examples...`);
    const counterExamples = this.searchCounterExamples(context);
    counterExamples.forEach((ce) => {
      thoughts.push(`  - ${ce}`);
    });

    // 5. 置信度校准
    thoughts.push("\nConfidence calibration:");
    const calibration = this.calibrateConfidence(context, issues);
    thoughts.push(`  Current confidence: ${(context.confidence * 100).toFixed(0)}%`);
    thoughts.push(`  Adjusted confidence: ${(calibration.adjusted * 100).toFixed(0)}%`);
    thoughts.push(`  Adjustment reason: ${calibration.reason}`);

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.ERROR_CORRECTION,
      issues,
      confidenceDelta: calibration.delta,
    };
  }

  private checkLogicalConsistency(
    context: ThinkingContext
  ): Array<{ check: string; passed: boolean }> {
    const checks: Array<{ check: string; passed: boolean }> = [];

    // 检查假设冲突
    const activeHypotheses = context.hypotheses.filter(
      (h) => h.status === HypothesisStatus.ACTIVE
    );
    checks.push({
      check: "No conflicting active hypotheses",
      passed: activeHypotheses.length < 5,
    });

    // 检查事实一致性
    checks.push({
      check: "Established facts are consistent",
      passed: context.establishedFacts.length < 10,
    });

    // 检查开放问题
    checks.push({
      check: "Open questions are addressable",
      passed: context.openQuestions.length < 5,
    });

    return checks;
  }

  private analyzeEdgeCases(
    context: ThinkingContext
  ): Array<{ description: string; implication: string }> {
    const cases: Array<{ description: string; implication: string }> = [];
    const content = context.message.content.toLowerCase();

    if (content.includes("代码") || content.includes("code")) {
      cases.push({
        description: "Empty input handling",
        implication: "Need to handle null/undefined cases",
      });
      cases.push({
        description: "Large input handling",
        implication: "May need pagination or streaming",
      });
    }

    if (content.includes("数据") || content.includes("data")) {
      cases.push({
        description: "Invalid data format",
        implication: "Need validation and error handling",
      });
    }

    if (cases.length === 0) {
      cases.push({
        description: "General edge case",
        implication: "Consider boundary conditions",
      });
    }

    return cases;
  }

  private stressTestHypotheses(context: ThinkingContext): string[] {
    const results: string[] = [];

    const activeHypotheses = context.hypotheses.filter(
      (h) => h.status === HypothesisStatus.ACTIVE
    );

    activeHypotheses.forEach((h, i) => {
      // 测试假设的脆弱性
      if (h.confidence > 0.8) {
        results.push(`H${i + 1} may be overconfident - need more evidence`);
      } else if (h.confidence < 0.3) {
        results.push(`H${i + 1} has low confidence - consider rejecting`);
      } else {
        results.push(`H${i + 1} confidence is reasonable`);
      }
    });

    return results.length > 0 ? results : ["No active hypotheses to test"];
  }

  private searchCounterExamples(context: ThinkingContext): string[] {
    const counterExamples: string[] = [];

    // 搜索可能的反例
    counterExamples.push("What if the user's context is different?");
    counterExamples.push("What if there are hidden constraints?");
    counterExamples.push("What if the problem is more complex than stated?");

    return counterExamples;
  }

  private calibrateConfidence(
    context: ThinkingContext,
    issues: string[]
  ): { adjusted: number; delta: number; reason: string } {
    let adjustment = 0;
    let reason = "No adjustment needed";

    // 基于问题数量调整
    if (issues.length > 2) {
      adjustment = -0.1;
      reason = "Multiple issues found";
    } else if (issues.length === 1) {
      adjustment = -0.05;
      reason = "One issue found";
    }

    // 基于假设数量调整
    const activeHypotheses = context.hypotheses.filter(
      (h) => h.status === HypothesisStatus.ACTIVE
    );
    if (activeHypotheses.length > 3) {
      adjustment -= 0.05;
      reason = "Too many active hypotheses";
    }

    const adjusted = Math.max(0.1, Math.min(0.95, context.confidence + adjustment));

    return {
      adjusted,
      delta: adjustment,
      reason,
    };
  }
}

// ============================================================
// 导出所有增强步骤
// ============================================================

export const enhancedThinkingSteps = {
  initialEngagement: EnhancedInitialEngagementStep,
  problemAnalysis: EnhancedProblemAnalysisStep,
  multipleHypotheses: EnhancedMultipleHypothesesStep,
  testingVerification: EnhancedTestingVerificationStep,
};
