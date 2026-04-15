/**
 * 灵思层集成测试
 * 
 * 测试灵思层与 DecisionCenter、LearningValidator 的集成
 */

import {
  DecisionCenterV3,
  LearningValidatorV3,
  ThinkingOrchestrator,
  thinkingOrchestrator,
  HumanMessage,
} from "../index";

// ============================================================
// 测试用例
// ============================================================

const testMessages: HumanMessage[] = [
  {
    id: "test-1",
    content: "你好",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
  {
    id: "test-2",
    content: "如何用 Python 实现一个简单的 Web 服务器？",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
  {
    id: "test-3",
    content: "请分析这段代码的性能问题：for i in range(1000000): result.append(str(i))",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
  {
    id: "test-4",
    content: "为什么我的程序在生产环境中会出现内存泄漏？这是一个紧急问题！",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
];

// ============================================================
// 测试 DecisionCenterV3
// ============================================================

async function testDecisionCenterV3() {
  // console.log("\n=== 测试 DecisionCenterV3 ===\n");

  const decisionCenter = new DecisionCenterV3();

  for (const message of testMessages) {
    // console.log(`处理消息: "${message.content.substring(0, 40)}..."`);

    const decision = await decisionCenter.makeDecision({ 
      message
    } as any);

    // console.log(`  决策类型: ${decision.type}`);
    // console.log(`  思考深度: ${decision.thinkingDepth}`);
    // console.log(`  思考置信度: ${(decision.confidence * 100).toFixed(0)}%`);
    // console.log(`  活跃假设: ${decision.activeHypotheses}`);
    // console.log(`  思考耗时: ${decision.thinkingDuration}ms`);
    // console.log();
  }

  // 获取历史
  const history = decisionCenter.getEnhancedHistory();
  // console.log(`历史决策数量: ${history.length}`);
}

// ============================================================
// 测试 LearningValidatorV3
// ============================================================

async function testLearningValidatorV3() {
  // console.log("\n=== 测试 LearningValidatorV3 ===\n");

  const validator = new LearningValidatorV3();
  const thinkingEngine = validator.getHypothesisManager();

  // 模拟思考结果
  const mockThinking = {
    id: "think-test",
    depth: "extensive" as const,
    content: "分析代码性能问题...",
    stepResults: [],
    hypotheses: [
      {
        id: "hyp-1",
        content: "代码使用了低效的字符串拼接方式",
        confidence: 0.7,
        evidence: [],
        counterEvidence: [],
        status: "active" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: "multiple_hypotheses" as const,
      },
      {
        id: "hyp-2",
        content: "循环次数过多导致性能问题",
        confidence: 0.5,
        evidence: [],
        counterEvidence: [],
        status: "active" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: "multiple_hypotheses" as const,
      },
    ],
    insights: ["字符串拼接是主要性能瓶颈"],
    confidence: 0.75,
    requiresToolUse: false,
    needsClarification: false,
    tokensUsed: 500,
    duration: 100,
  };

  const input = "请分析这段代码的性能问题";
  const output = "这段代码使用了 append 和 str() 进行字符串拼接，建议使用列表推导式或 join() 方法来提高性能。";

  // console.log("输入:", input);
  // console.log("输出:", output);
  // console.log();

  const result = await validator.validateWithThinking(input, output, mockThinking as any);

  // console.log("验证结果:");
  // console.log(`  有效: ${result.valid}`);
  // console.log(`  分数: ${result.score.toFixed(2)}`);
  // console.log(`  思考质量: ${result.thinkingQuality.toFixed(2)}`);
  // console.log(`  问题: ${result.issues.join(", ") || "无"}`);
  // console.log();

  // console.log("假设验证:");
  result.hypothesisValidation.forEach((h) => {
    // console.log(`  - [${h.confirmed ? "✓" : "✗"}] ${h.content}`);
  });
}

// ============================================================
// 测试 ThinkingOrchestrator
// ============================================================

async function testThinkingOrchestrator() {
  // console.log("\n=== 测试 ThinkingOrchestrator ===\n");

  const orchestrator = new ThinkingOrchestrator();

  const message: HumanMessage = {
    id: "test-orch",
    content: "如何优化数据库查询性能？",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  };

  // console.log("完整流程测试:");
  // console.log(`消息: "${message.content}"`);
  // console.log();

  const result = await orchestrator.process(message);

  // console.log("=== 思考结果 ===");
  // console.log(`深度: ${result.thinking.depth}`);
  // console.log(`置信度: ${(result.thinking.confidence * 100).toFixed(0)}%`);
  // console.log(`洞察: ${result.thinking.insights.length} 个`);
  // console.log(`耗时: ${result.thinking.duration}ms`);

  // console.log("\n=== 决策结果 ===");
  // console.log(`类型: ${result.decision.type}`);
  // console.log(`推理: ${result.decision.reasoning}`);
  // console.log(`置信度: ${(result.decision.confidence * 100).toFixed(0)}%`);

  // console.log("\n=== 验证结果 ===");
  // console.log(`有效: ${result.validation.valid}`);
  // console.log(`分数: ${result.validation.score.toFixed(2)}`);
  // console.log(`思考质量: ${result.validation.thinkingQuality.toFixed(2)}`);
}

// ============================================================
// 测试快速处理
// ============================================================

async function testQuickProcess() {
  // console.log("\n=== 测试快速处理 ===\n");

  const orchestrator = new ThinkingOrchestrator();

  const messages = [
    "你好",
    "什么是机器学习？",
    "如何用 Python 实现快速排序？",
  ];

  for (const content of messages) {
    const message: HumanMessage = {
      id: `quick-${Date.now()}`,
      content,
      type: "text",
      timestamp: Date.now(),
      sessionId: "test",
    };

    const result = await orchestrator.quickProcess(message);

    // console.log(`消息: "${content}"`);
    // console.log(`  思考深度: ${result.thinking.depth}`);
    // console.log(`  决策类型: ${result.decision.type}`);
    // console.log(`  总耗时: ${result.thinking.duration + result.decision.thinkingDuration}ms`);
    // console.log();
  }
}

// ============================================================
// 测试假设追踪
// ============================================================

async function testHypothesisTracking() {
  // console.log("\n=== 测试假设追踪 ===\n");

  const orchestrator = new ThinkingOrchestrator();
  const hypothesisManager = orchestrator.getThinkingEngine().getHypothesisManager();

  // 处理多个相关问题
  const messages = [
    "如何优化 Python 代码性能？",
    "列表推导式比普通循环快吗？",
    "使用 map() 函数有什么优势？",
  ];

  for (const content of messages) {
    const message: HumanMessage = {
      id: `track-${Date.now()}`,
      content,
      type: "text",
      timestamp: Date.now(),
      sessionId: "test",
    };

    await orchestrator.quickProcess(message);
  }

  // 查看假设状态
  // console.log("假设摘要:");
  // console.log(hypothesisManager.generateSummary());
}

// ============================================================
// 运行所有测试
// ============================================================

async function runAllTests() {
  // console.log("╔══════════════════════════════════════════════╗");
  // console.log("║     灵思层集成测试套件                        ║");
  // console.log("║  测试 DecisionCenterV3 + LearningValidatorV3 ║");
  // console.log("╚══════════════════════════════════════════════╝");

  try {
    await testDecisionCenterV3();
    await testLearningValidatorV3();
    await testThinkingOrchestrator();
    await testQuickProcess();
    await testHypothesisTracking();

    // console.log("\n╔══════════════════════════════════════════════╗");
    // console.log("║           所有集成测试通过 ✅                 ║");
    // console.log("╚══════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
