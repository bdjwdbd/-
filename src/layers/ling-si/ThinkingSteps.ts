/**
 * 思考步骤实现
 * 
 * 基于 Thinking Claude 的 core_thinking_sequence
 * 每个步骤都是可独立执行的思考模块
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

/**
 * 步骤 1: 初始参与
 * 
 * 当首次遇到问题时：
 * 1. 用自己的话重述问题
 * 2. 形成初步印象
 * 3. 考虑更广泛的背景
 * 4. 映射已知和未知元素
 * 5. 思考用户为什么问这个问题
 * 6. 识别与相关知识的联系
 * 7. 识别并澄清歧义
 */
export class InitialEngagementStep implements ThinkingStep {
  name = ThinkingStepName.INITIAL_ENGAGEMENT;
  description = "初始参与：理解问题、形成印象、识别歧义";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const issues: string[] = [];
    const hypotheses: Hypothesis[] = [];

    const message = context.message;

    // 1. 重述问题
    thoughts.push(
      `${getRandomTransition("start")} Let me understand what's being asked here.`
    );
    thoughts.push(this.rephraseMessage(message));

    // 2. 形成初步印象
    thoughts.push(
      `${getRandomTransition("discovery")} My first impression is...`
    );
    thoughts.push(this.formImpression(message));

    // 3. 考虑背景
    thoughts.push("Looking at the broader context...");
    thoughts.push(this.considerContext(context));

    // 4. 映射已知/未知
    const { known, unknown } = this.mapKnownUnknown(message, context);
    thoughts.push(`What I know: ${known}`);
    thoughts.push(`What I need to find out: ${unknown}`);

    // 5. 思考用户意图
    thoughts.push(
      `${getRandomTransition("deeper")} Why might the user be asking this?`
    );
    thoughts.push(this.inferIntent(message));

    // 6. 识别歧义
    const ambiguities = this.identifyAmbiguities(message);
    if (ambiguities.length > 0) {
      thoughts.push(
        `${getRandomTransition("questioning")} I notice some potential ambiguities...`
      );
      issues.push(...ambiguities);
    }

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.PROBLEM_ANALYSIS,
      issues,
      hypotheses,
      confidenceDelta: 0.1,
    };
  }

  private rephraseMessage(message: HumanMessage): string {
    // 简化版重述
    const content = message.content;
    if (content.includes("?") || content.includes("？")) {
      return `The user is asking: "${content}"`;
    }
    return `The user wants me to: "${content}"`;
  }

  private formImpression(message: HumanMessage): string {
    const content = message.content.toLowerCase();
    
    if (content.includes("代码") || content.includes("code")) {
      return "This seems to be a coding-related request.";
    }
    if (content.includes("分析") || content.includes("analyze")) {
      return "This requires analytical thinking.";
    }
    if (content.includes("解释") || content.includes("explain")) {
      return "The user wants an explanation of something.";
    }
    if (content.includes("帮") || content.includes("help")) {
      return "The user needs assistance with a task.";
    }
    
    return "I need to understand more about what's being asked.";
  }

  private considerContext(context: ThinkingContext): string {
    const parts: string[] = [];

    if (context.userContext?.currentTask) {
      parts.push(`The user is currently working on: ${context.userContext.currentTask}`);
    }

    if (context.memories && context.memories.length > 0) {
      parts.push(`I have ${context.memories.length} relevant memories.`);
    }

    if (parts.length === 0) {
      return "This appears to be a standalone request without specific context.";
    }

    return parts.join(" ");
  }

  private mapKnownUnknown(
    message: HumanMessage,
    context: ThinkingContext
  ): { known: string; unknown: string } {
    const known: string[] = [];
    const unknown: string[] = [];

    // 已知：消息内容
    known.push("the user's message");

    // 已知：附件
    if (message.attachments && message.attachments.length > 0) {
      known.push(`${message.attachments.length} attachment(s)`);
    }

    // 已知：用户上下文
    if (context.userContext) {
      known.push("user context");
    }

    // 未知：具体需求
    unknown.push("the exact scope of the request");

    // 未知：用户期望的输出格式
    unknown.push("the expected output format");

    return {
      known: known.join(", "),
      unknown: unknown.join(", "),
    };
  }

  private inferIntent(message: HumanMessage): string {
    const content = message.content.toLowerCase();

    if (content.includes("为什么") || content.includes("why")) {
      return "The user wants to understand the reasoning behind something.";
    }
    if (content.includes("如何") || content.includes("how")) {
      return "The user wants to learn how to do something.";
    }
    if (content.includes("什么") || content.includes("what")) {
      return "The user wants to know what something is.";
    }
    if (content.includes("问题") || content.includes("problem") || content.includes("bug")) {
      return "The user has encountered a problem and needs help solving it.";
    }

    return "The user has a specific request that I need to address.";
  }

  private identifyAmbiguities(message: HumanMessage): string[] {
    const ambiguities: string[] = [];
    const content = message.content.toLowerCase();

    // 检查模糊词汇
    const vagueTerms = ["一些", "几个", "有点", "some", "few", "kind of"];
    for (const term of vagueTerms) {
      if (content.includes(term)) {
        ambiguities.push(`The term "${term}" is vague and may need clarification.`);
      }
    }

    // 检查代词
    const pronouns = ["它", "这个", "那个", "it", "this", "that"];
    for (const pronoun of pronouns) {
      if (content.includes(pronoun)) {
        ambiguities.push(`The pronoun "${pronoun}" may need clarification.`);
        break;
      }
    }

    return ambiguities;
  }
}

/**
 * 步骤 2: 问题分析
 * 
 * 在初始参与后：
 * 1. 分解问题的核心组件
 * 2. 识别显性和隐性需求
 * 3. 考虑约束和限制
 * 4. 思考成功响应的样子
 * 5. 映射所需知识范围
 */
export class ProblemAnalysisStep implements ThinkingStep {
  name = ThinkingStepName.PROBLEM_ANALYSIS;
  description = "问题分析：分解问题、识别需求、考虑约束";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const issues: string[] = [];

    const message = context.message;

    // 1. 分解问题
    thoughts.push(
      `${getRandomTransition("discovery")} Let me break this down...`
    );
    const components = this.breakDownProblem(message);
    thoughts.push(`Core components: ${components.join(", ")}`);

    // 2. 识别显性需求
    thoughts.push("Explicit requirements:");
    const explicitReqs = this.identifyExplicitRequirements(message);
    explicitReqs.forEach((req) => thoughts.push(`  - ${req}`));

    // 3. 识别隐性需求
    thoughts.push(
      `${getRandomTransition("deeper")} Implicit requirements:`
    );
    const implicitReqs = this.identifyImplicitRequirements(message);
    implicitReqs.forEach((req) => thoughts.push(`  - ${req}`));

    // 4. 考虑约束
    thoughts.push("Constraints and limitations:");
    const constraints = this.identifyConstraints(message, context);
    constraints.forEach((c) => thoughts.push(`  - ${c}`));

    // 5. 成功标准
    thoughts.push(
      `${getRandomTransition("synthesis")} A successful response would...`
    );
    thoughts.push(this.defineSuccessCriteria(message));

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      issues,
      confidenceDelta: 0.1,
    };
  }

  private breakDownProblem(message: HumanMessage): string[] {
    const content = message.content;
    const components: string[] = [];

    // 按句子分割
    const sentences = content.split(/[.!?。！？]+/).filter((s) => s.trim());
    components.push(...sentences.map((s) => s.trim().substring(0, 50)));

    // 如果只有一个句子，按关键词分割
    if (components.length === 1) {
      const keywords = content.split(/[,\s，、]+/).filter((s) => s.length > 2);
      if (keywords.length > 1) {
        components.length = 0;
        components.push(...keywords.slice(0, 5));
      }
    }

    return components.length > 0 ? components : ["the main request"];
  }

  private identifyExplicitRequirements(message: HumanMessage): string[] {
    const requirements: string[] = [];
    const content = message.content.toLowerCase();

    // 检查明确的动作词
    const actionVerbs = [
      "写", "创建", "生成", "分析", "解释", "修复", "优化",
      "write", "create", "generate", "analyze", "explain", "fix", "optimize",
    ];
    for (const verb of actionVerbs) {
      if (content.includes(verb)) {
        requirements.push(`Action: ${verb}`);
      }
    }

    // 检查具体要求
    if (content.includes("详细") || content.includes("detailed")) {
      requirements.push("Provide detailed information");
    }
    if (content.includes("简单") || content.includes("simple")) {
      requirements.push("Keep it simple");
    }
    if (content.includes("示例") || content.includes("example")) {
      requirements.push("Include examples");
    }

    return requirements.length > 0 ? requirements : ["Address the user's request"];
  }

  private identifyImplicitRequirements(message: HumanMessage): string[] {
    const requirements: string[] = [];
    const content = message.content.toLowerCase();

    // 隐性需求推断
    if (content.includes("代码") || content.includes("code")) {
      requirements.push("Code should be correct and runnable");
      requirements.push("Code should follow best practices");
    }

    if (content.includes("问题") || content.includes("problem")) {
      requirements.push("Provide a solution or explanation");
    }

    if (content.includes("?") || content.includes("？")) {
      requirements.push("Answer the question directly");
    }

    return requirements;
  }

  private identifyConstraints(
    message: HumanMessage,
    context: ThinkingContext
  ): string[] {
    const constraints: string[] = [];

    // Token 预算
    if (context.tokenBudget < 500) {
      constraints.push("Limited token budget - keep response concise");
    }

    // 时间敏感性
    if (message.content.includes("紧急") || message.content.includes("urgent")) {
      constraints.push("Time-sensitive - prioritize speed");
    }

    // 技术限制
    if (message.content.includes("不能") || message.content.includes("cannot")) {
      constraints.push("Some actions may not be possible");
    }

    return constraints.length > 0 ? constraints : ["No specific constraints identified"];
  }

  private defineSuccessCriteria(message: HumanMessage): string {
    const content = message.content.toLowerCase();

    if (content.includes("代码") || content.includes("code")) {
      return "provide working code that solves the problem";
    }
    if (content.includes("解释") || content.includes("explain")) {
      return "provide a clear, understandable explanation";
    }
    if (content.includes("分析") || content.includes("analyze")) {
      return "provide a thorough analysis with insights";
    }

    return "fully address the user's request in a helpful way";
  }
}

/**
 * 步骤 3: 多假设生成
 * 
 * 在确定方法之前：
 * 1. 写出多种可能的问题解释
 * 2. 考虑各种解决方案
 * 3. 思考替代视角
 * 4. 保持多个工作假设活跃
 * 5. 避免过早承诺单一解释
 */
export class MultipleHypothesesStep implements ThinkingStep {
  name = ThinkingStepName.MULTIPLE_HYPOTHESES;
  description = "多假设生成：考虑多种解释和方案";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const hypotheses: Hypothesis[] = [];

    const message = context.message;

    // 1. 生成多种解释
    thoughts.push(
      `${getRandomTransition("discovery")} Let me consider different ways to interpret this...`
    );
    const interpretations = this.generateInterpretations(message);
    interpretations.forEach((interp, i) => {
      thoughts.push(`Interpretation ${i + 1}: ${interp}`);
    });

    // 2. 生成多种解决方案
    thoughts.push(
      `${getRandomTransition("deeper")} Possible approaches:`
    );
    const approaches = this.generateApproaches(message);
    approaches.forEach((approach, i) => {
      thoughts.push(`Approach ${i + 1}: ${approach}`);
    });

    // 3. 创建假设对象
    interpretations.forEach((interp, i) => {
      hypotheses.push({
        id: `hyp_${i}`,
        content: interp,
        confidence: 0.5,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: this.name,
      });
    });

    // 4. 考虑非显而易见的解释
    thoughts.push(
      `${getRandomTransition("questioning")} Are there any non-obvious interpretations?`
    );
    const nonObvious = this.generateNonObviousInterpretations(message);
    nonObvious.forEach((interp) => thoughts.push(`  - ${interp}`));

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.NATURAL_DISCOVERY,
      hypotheses,
      confidenceDelta: 0.05,
    };
  }

  private generateInterpretations(message: HumanMessage): string[] {
    const content = message.content.toLowerCase();
    const interpretations: string[] = [];

    // 字面解释
    interpretations.push(`Literal: The user wants exactly what they asked for.`);

    // 深层需求
    interpretations.push(
      `Deeper need: The user might be trying to solve an underlying problem.`
    );

    // 学习意图
    if (content.includes("如何") || content.includes("how")) {
      interpretations.push(
        `Learning: The user wants to understand the process, not just get a result.`
      );
    }

    // 验证意图
    if (content.includes("对吗") || content.includes("correct")) {
      interpretations.push(
        `Validation: The user wants confirmation of their understanding.`
      );
    }

    return interpretations.slice(0, 4);
  }

  private generateApproaches(message: HumanMessage): string[] {
    const content = message.content.toLowerCase();
    const approaches: string[] = [];

    // 直接回答
    approaches.push("Direct answer: Provide a straightforward response.");

    // 示例驱动
    approaches.push("Example-driven: Use examples to illustrate.");

    // 分步指导
    if (content.includes("如何") || content.includes("how")) {
      approaches.push("Step-by-step: Break down into actionable steps.");
    }

    // 对比分析
    if (content.includes("比较") || content.includes("compare")) {
      approaches.push("Comparative: Compare different options.");
    }

    return approaches.slice(0, 3);
  }

  private generateNonObviousInterpretations(message: HumanMessage): string[] {
    const interpretations: string[] = [];
    const content = message.content.toLowerCase();

    // XY 问题检测
    if (content.includes("如何") && content.length < 50) {
      interpretations.push(
        "This might be an XY problem - the user is asking about their attempted solution, not the actual problem."
      );
    }

    // 隐性约束
    interpretations.push(
      "There might be implicit constraints the user hasn't mentioned."
    );

    return interpretations;
  }
}

/**
 * 步骤 4: 自然发现流
 * 
 * 思想像侦探故事一样流动：
 * 1. 从明显方面开始
 * 2. 注意模式或联系
 * 3. 质疑初始假设
 * 4. 建立新联系
 * 5. 回到早期想法
 * 6. 逐步建立更深洞察
 */
export class NaturalDiscoveryStep implements ThinkingStep {
  name = ThinkingStepName.NATURAL_DISCOVERY;
  description = "自然发现流：像侦探一样探索问题";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];

    // 1. 从明显开始
    thoughts.push(
      `${getRandomTransition("start")} Let me start with what's obvious...`
    );
    thoughts.push(this.identifyObvious(context.message));

    // 2. 注意模式
    thoughts.push(
      `${getRandomTransition("discovery")} I notice a pattern here...`
    );
    thoughts.push(this.identifyPatterns(context));

    // 3. 质疑假设
    thoughts.push(
      `${getRandomTransition("questioning")} But wait, let me question this assumption...`
    );
    thoughts.push(this.questionAssumptions(context));

    // 4. 建立联系
    thoughts.push(
      `${getRandomTransition("connection")} This connects to...`
    );
    thoughts.push(this.makeConnections(context));

    // 5. 深化洞察
    thoughts.push(
      `${getRandomTransition("deeper")} Looking deeper...`
    );
    thoughts.push(this.deepenInsight(context));

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.TESTING_VERIFICATION,
      confidenceDelta: 0.1,
    };
  }

  private identifyObvious(message: HumanMessage): string {
    const content = message.content.toLowerCase();

    if (content.includes("错误") || content.includes("error")) {
      return "There's clearly an error or problem that needs addressing.";
    }
    if (content.includes("代码") || content.includes("code")) {
      return "This involves code, so I need to consider syntax, logic, and best practices.";
    }
    if (content.includes("?") || content.includes("？")) {
      return "This is a question that needs a direct answer.";
    }

    return "The user has a request that I need to understand and address.";
  }

  private identifyPatterns(context: ThinkingContext): string {
    const patterns: string[] = [];

    // 检查假设模式
    if (context.hypotheses.length > 1) {
      patterns.push("Multiple interpretations are possible.");
    }

    // 检查问题模式
    if (context.openQuestions.length > 0) {
      patterns.push(`There are ${context.openQuestions.length} open questions to resolve.`);
    }

    return patterns.length > 0
      ? patterns.join(" ")
      : "No clear patterns yet - need more analysis.";
  }

  private questionAssumptions(context: ThinkingContext): string {
    const assumptions: string[] = [];

    // 检查常见假设
    assumptions.push("Am I assuming the user has certain background knowledge?");

    if (context.message.content.includes("简单")) {
      assumptions.push("The user says it's simple, but is it really?");
    }

    return assumptions[0];
  }

  private makeConnections(context: ThinkingContext): string {
    const connections: string[] = [];

    // 连接到记忆
    if (context.memories && context.memories.length > 0) {
      connections.push("This relates to previous interactions.");
    }

    // 连接到用户上下文
    if (context.userContext?.currentTask) {
      connections.push(`This might be part of: ${context.userContext.currentTask}`);
    }

    return connections.length > 0
      ? connections.join(" ")
      : "This seems to be a new topic.";
  }

  private deepenInsight(context: ThinkingContext): string {
    const message = context.message;

    // 基于问题类型深化
    if (message.content.includes("为什么")) {
      return "The 'why' question suggests the user wants to understand root causes, not just surface explanations.";
    }

    if (message.content.includes("如何")) {
      return "The 'how' question suggests the user wants actionable steps they can follow.";
    }

    return "I should focus on providing practical, useful information.";
  }
}

/**
 * 步骤 5: 测试与验证
 * 
 * 在整个思考过程中：
 * 1. 质疑自己的假设
 * 2. 测试初步结论
 * 3. 寻找潜在缺陷
 * 4. 考虑替代视角
 * 5. 验证推理一致性
 */
export class TestingVerificationStep implements ThinkingStep {
  name = ThinkingStepName.TESTING_VERIFICATION;
  description = "测试与验证：质疑假设、验证结论";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const issues: string[] = [];

    // 1. 质疑假设
    thoughts.push(
      `${getRandomTransition("questioning")} Let me verify my reasoning...`
    );

    // 2. 检查逻辑一致性
    thoughts.push("Checking for logical consistency...");
    const consistencyIssues = this.checkConsistency(context);
    if (consistencyIssues.length > 0) {
      issues.push(...consistencyIssues);
      thoughts.push(`Found ${consistencyIssues.length} potential issues.`);
    } else {
      thoughts.push("The reasoning appears consistent.");
    }

    // 3. 考虑边缘情况
    thoughts.push(
      `${getRandomTransition("deeper")} What about edge cases?`
    );
    const edgeCases = this.considerEdgeCases(context);
    edgeCases.forEach((ec) => thoughts.push(`  - ${ec}`));

    // 4. 寻找反例
    thoughts.push("Are there counter-examples to consider?");
    const counterExamples = this.findCounterExamples(context);
    counterExamples.forEach((ce) => thoughts.push(`  - ${ce}`));

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.ERROR_CORRECTION,
      issues,
      confidenceDelta: issues.length > 0 ? -0.1 : 0.1,
    };
  }

  private checkConsistency(context: ThinkingContext): string[] {
    const issues: string[] = [];

    // 检查假设冲突
    const activeHypotheses = context.hypotheses.filter(
      (h) => h.status === HypothesisStatus.ACTIVE
    );
    if (activeHypotheses.length > 3) {
      issues.push("Too many active hypotheses - may indicate confusion.");
    }

    return issues;
  }

  private considerEdgeCases(context: ThinkingContext): string[] {
    const cases: string[] = [];
    const content = context.message.content.toLowerCase();

    if (content.includes("代码") || content.includes("code")) {
      cases.push("Empty input handling");
      cases.push("Error state handling");
      cases.push("Boundary conditions");
    }

    if (content.includes("用户") || content.includes("user")) {
      cases.push("Different user skill levels");
      cases.push("Various user intentions");
    }

    return cases.length > 0 ? cases : ["No specific edge cases identified"];
  }

  private findCounterExamples(context: ThinkingContext): string[] {
    const examples: string[] = [];

    // 基于问题类型找反例
    examples.push("What if the opposite is true?");

    return examples;
  }
}

/**
 * 步骤 6: 错误识别与修正
 * 
 * 当发现错误时：
 * 1. 自然地承认发现
 * 2. 解释为什么之前的想法不完整
 * 3. 展示新理解如何发展
 * 4. 将修正后的理解整合到大局
 */
export class ErrorCorrectionStep implements ThinkingStep {
  name = ThinkingStepName.ERROR_CORRECTION;
  description = "错误识别与修正：发现错误、修正理解";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];

    // 检查是否有需要修正的错误
    const hasErrors = context.openQuestions.length > 0 || 
      context.hypotheses.some((h) => h.status === HypothesisStatus.REJECTED);

    if (hasErrors) {
      thoughts.push(
        `${getRandomTransition("correction")} Wait, I need to reconsider something...`
      );

      // 分析错误
      thoughts.push(this.analyzeErrors(context));

      // 修正理解
      thoughts.push("Let me revise my understanding...");
      thoughts.push(this.reviseUnderstanding(context));

      // 整合修正
      thoughts.push(
        `${getRandomTransition("synthesis")} This correction leads to...`
      );
      thoughts.push(this.integrateCorrection(context));
    } else {
      thoughts.push("No errors identified in the current reasoning.");
      thoughts.push("The analysis appears sound so far.");
    }

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.KNOWLEDGE_SYNTHESIS,
      confidenceDelta: hasErrors ? 0.05 : 0.1,
    };
  }

  private analyzeErrors(context: ThinkingContext): string {
    const rejectedHypotheses = context.hypotheses.filter(
      (h) => h.status === HypothesisStatus.REJECTED
    );

    if (rejectedHypotheses.length > 0) {
      return `I had ${rejectedHypotheses.length} incorrect assumption(s) that I need to correct.`;
    }

    if (context.openQuestions.length > 0) {
      return `There are ${context.openQuestions.length} unresolved question(s) that need attention.`;
    }

    return "The reasoning process has been relatively smooth.";
  }

  private reviseUnderstanding(context: ThinkingContext): string {
    const activeHypotheses = context.hypotheses.filter(
      (h) => h.status === HypothesisStatus.ACTIVE
    );

    if (activeHypotheses.length > 0) {
      const topHypothesis = activeHypotheses.reduce((top, h) =>
        h.confidence > top.confidence ? h : top
      );
      return `The most likely interpretation is: ${topHypothesis.content}`;
    }

    return "I need to gather more information to form a clear understanding.";
  }

  private integrateCorrection(context: ThinkingContext): string {
    return "With these corrections, I can now provide a more accurate response.";
  }
}

/**
 * 步骤 7: 知识综合
 * 
 * 随着理解发展：
 * 1. 连接不同信息片段
 * 2. 展示各方面如何关联
 * 3. 构建连贯的整体图景
 * 4. 识别关键原则或模式
 * 5. 注意重要含义或后果
 */
export class KnowledgeSynthesisStep implements ThinkingStep {
  name = ThinkingStepName.KNOWLEDGE_SYNTHESIS;
  description = "知识综合：连接信息、构建图景";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];
    const insights: string[] = [];

    // 1. 连接信息
    thoughts.push(
      `${getRandomTransition("synthesis")} Let me put this all together...`
    );
    thoughts.push(this.connectInformation(context));

    // 2. 构建图景
    thoughts.push("Building a coherent picture...");
    thoughts.push(this.buildPicture(context));

    // 3. 识别关键原则
    thoughts.push(
      `${getRandomTransition("discovery")} The key insight here is...`
    );
    const keyInsight = this.identifyKeyInsight(context);
    thoughts.push(keyInsight);
    insights.push(keyInsight);

    // 4. 注意含义
    thoughts.push("This implies that...");
    thoughts.push(this.identifyImplications(context));

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.PATTERN_RECOGNITION,
      issues: insights,
      confidenceDelta: 0.1,
    };
  }

  private connectInformation(context: ThinkingContext): string {
    const connections: string[] = [];

    // 连接假设
    const confirmedHypotheses = context.hypotheses.filter(
      (h) => h.status === HypothesisStatus.CONFIRMED
    );
    if (confirmedHypotheses.length > 0) {
      connections.push(
        `${confirmedHypotheses.length} interpretation(s) have been confirmed.`
      );
    }

    // 连接事实
    if (context.establishedFacts.length > 0) {
      connections.push(
        `${context.establishedFacts.length} fact(s) have been established.`
      );
    }

    return connections.length > 0
      ? connections.join(" ")
      : "Connecting the various pieces of information...";
  }

  private buildPicture(context: ThinkingContext): string {
    const message = context.message;

    // 基于问题类型构建图景
    if (message.content.includes("代码") || message.content.includes("code")) {
      return "This is a coding task that requires technical accuracy and best practices.";
    }

    if (message.content.includes("分析") || message.content.includes("analyze")) {
      return "This requires a systematic analysis covering multiple aspects.";
    }

    return "The user needs a helpful, accurate response to their request.";
  }

  private identifyKeyInsight(context: ThinkingContext): string {
    const message = context.message;

    // 基于分析识别关键洞察
    if (message.content.includes("为什么")) {
      return "Understanding the 'why' requires looking at root causes and motivations.";
    }

    if (message.content.includes("如何")) {
      return "The key is providing actionable, step-by-step guidance.";
    }

    return "The most important thing is to address the user's actual need.";
  }

  private identifyImplications(context: ThinkingContext): string {
    const implications: string[] = [];

    implications.push("I should provide a clear, well-structured response.");
    implications.push("I should anticipate follow-up questions.");

    return implications.join(" ");
  }
}

/**
 * 步骤 8: 模式识别
 * 
 * 在整个思考过程中：
 * 1. 主动寻找信息中的模式
 * 2. 与已知示例比较
 * 3. 测试模式一致性
 * 4. 考虑例外或特殊情况
 * 5. 用模式指导进一步调查
 */
export class PatternRecognitionStep implements ThinkingStep {
  name = ThinkingStepName.PATTERN_RECOGNITION;
  description = "模式识别：发现模式、应用模式";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];

    // 1. 寻找模式
    thoughts.push(
      `${getRandomTransition("discovery")} Looking for patterns...`
    );
    const patterns = this.findPatterns(context);
    patterns.forEach((p) => thoughts.push(`  - ${p}`));

    // 2. 与已知比较
    thoughts.push("Comparing with known patterns...");
    thoughts.push(this.compareToKnown(context));

    // 3. 测试一致性
    thoughts.push("Testing pattern consistency...");
    thoughts.push(this.testConsistency(context));

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: ThinkingStepName.PROGRESS_TRACKING,
      confidenceDelta: 0.05,
    };
  }

  private findPatterns(context: ThinkingContext): string[] {
    const patterns: string[] = [];
    const content = context.message.content.toLowerCase();

    // 问题类型模式
    if (content.includes("?") || content.includes("？")) {
      patterns.push("Question pattern: needs direct answer");
    }

    // 任务模式
    if (content.includes("帮") || content.includes("help")) {
      patterns.push("Help request pattern: needs assistance");
    }

    // 技术模式
    if (content.includes("代码") || content.includes("code")) {
      patterns.push("Technical pattern: needs technical solution");
    }

    return patterns.length > 0 ? patterns : ["No clear patterns identified"];
  }

  private compareToKnown(context: ThinkingContext): string {
    // 与已知模式比较
    if (context.memories && context.memories.length > 0) {
      return "This resembles previous interactions I've had.";
    }
    return "This appears to be a new type of request.";
  }

  private testConsistency(context: ThinkingContext): string {
    // 测试模式一致性
    const activeHypotheses = context.hypotheses.filter(
      (h) => h.status === HypothesisStatus.ACTIVE
    );

    if (activeHypotheses.length === 1) {
      return "The pattern is consistent with a single interpretation.";
    }

    return "Multiple patterns are possible - need to determine which applies.";
  }
}

/**
 * 步骤 9: 进度追踪
 * 
 * 频繁检查并保持明确意识：
 * 1. 目前已确定什么
 * 2. 还有什么待确定
 * 3. 当前结论置信度
 * 4. 开放问题或不确定性
 * 5. 向完整理解的进展
 */
export class ProgressTrackingStep implements ThinkingStep {
  name = ThinkingStepName.PROGRESS_TRACKING;
  description = "进度追踪：追踪进展、评估置信度";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];

    // 1. 已确定的内容
    thoughts.push(
      `${getRandomTransition("synthesis")} Let me check my progress...`
    );
    thoughts.push("What I've established:");
    context.establishedFacts.forEach((fact) => thoughts.push(`  ✓ ${fact}`));

    // 2. 待确定的内容
    thoughts.push("What remains to be determined:");
    if (context.openQuestions.length > 0) {
      context.openQuestions.forEach((q) => thoughts.push(`  ? ${q}`));
    } else {
      thoughts.push("  All key questions have been addressed.");
    }

    // 3. 置信度评估
    thoughts.push(
      `Current confidence level: ${(context.confidence * 100).toFixed(0)}%`
    );

    // 4. 进展评估
    thoughts.push("Progress toward complete understanding:");
    thoughts.push(this.assessProgress(context));

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      nextStep: context.depth === "deep" 
        ? ThinkingStepName.RECURSIVE_THINKING 
        : undefined,
      confidenceDelta: 0,
    };
  }

  private assessProgress(context: ThinkingContext): string {
    const completedSteps = context.completedSteps.length;
    const totalSteps = 10;

    const percentage = (completedSteps / totalSteps) * 100;

    if (percentage < 30) {
      return "Still in early stages of analysis.";
    }
    if (percentage < 60) {
      return "Making good progress, but more analysis needed.";
    }
    if (percentage < 90) {
      return "Nearly complete - just need to finalize.";
    }
    return "Analysis complete - ready to respond.";
  }
}

/**
 * 步骤 10: 递归思考
 * 
 * 递归应用思考过程：
 * 1. 在宏观和微观层面使用同样的严谨分析
 * 2. 跨尺度应用模式识别
 * 3. 保持一致性同时允许尺度适配的方法
 * 4. 展示详细分析如何支持更广泛的结论
 */
export class RecursiveThinkingStep implements ThinkingStep {
  name = ThinkingStepName.RECURSIVE_THINKING;
  description = "递归思考：宏观与微观层面的严谨分析";

  async execute(context: ThinkingContext): Promise<ThinkingStepResult> {
    const thoughts: string[] = [];

    // 仅在深度思考时执行
    if (context.depth !== "deep") {
      return {
        stepName: this.name,
        thoughts: ["Skipping recursive analysis for non-deep thinking."],
        completed: true,
        confidenceDelta: 0,
      };
    }

    // 1. 宏观层面分析
    thoughts.push(
      `${getRandomTransition("deeper")} Let me analyze this at a higher level...`
    );
    thoughts.push(this.macroAnalysis(context));

    // 2. 微观层面分析
    thoughts.push("Now let me zoom in to the details...");
    thoughts.push(this.microAnalysis(context));

    // 3. 跨尺度一致性
    thoughts.push("Checking consistency across scales...");
    thoughts.push(this.checkCrossScaleConsistency(context));

    // 4. 支持关系
    thoughts.push(
      `${getRandomTransition("synthesis")} How the details support the big picture...`
    );
    thoughts.push(this.explainSupportRelation(context));

    return {
      stepName: this.name,
      thoughts,
      completed: true,
      confidenceDelta: 0.1,
    };
  }

  private macroAnalysis(context: ThinkingContext): string {
    // 宏观分析
    return "At the highest level, this is about helping the user achieve their goal.";
  }

  private microAnalysis(context: ThinkingContext): string {
    // 微观分析
    const message = context.message;
    return `At the detail level, I need to address: "${message.content.substring(0, 50)}..."`;
  }

  private checkCrossScaleConsistency(context: ThinkingContext): string {
    // 跨尺度一致性检查
    return "The macro and micro analyses are consistent with each other.";
  }

  private explainSupportRelation(context: ThinkingContext): string {
    // 解释支持关系
    return "The specific details support the overall goal of providing a helpful response.";
  }
}

// 导出所有步骤
export const allThinkingSteps: ThinkingStep[] = [
  new InitialEngagementStep(),
  new ProblemAnalysisStep(),
  new MultipleHypothesesStep(),
  new NaturalDiscoveryStep(),
  new TestingVerificationStep(),
  new ErrorCorrectionStep(),
  new KnowledgeSynthesisStep(),
  new PatternRecognitionStep(),
  new ProgressTrackingStep(),
  new RecursiveThinkingStep(),
];

// 步骤映射
export const thinkingStepMap = new Map<ThinkingStepName, ThinkingStep>(
  allThinkingSteps.map((step) => [step.name, step])
);
