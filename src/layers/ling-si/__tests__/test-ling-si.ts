/**
 * 灵思层测试
 * 
 * 测试思考协议引擎的各个组件
 */

import {
  ThinkingProtocolEngine,
  AdaptiveDepthController,
  MultiHypothesisManager,
  ThoughtFlowSynthesizer,
  ThinkingDepth,
  ThinkingStepName,
  HumanMessage,
  quickThink,
  deepThink,
  minimalThink,
} from "../index";

// 测试消息
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
    content: "请分析一下这个代码的性能问题，并给出优化建议",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
  {
    id: "test-4",
    content: "为什么我的程序在生产环境中会出现内存泄漏？这是一个紧急问题，需要尽快解决！",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
];

/**
 * 测试自适应深度控制器
 */
async function testAdaptiveDepthController() {
  console.log("\n=== 测试自适应深度控制器 ===\n");

  const controller = new AdaptiveDepthController();

  for (const message of testMessages) {
    const result = controller.assessDepth(message);
    console.log(`消息: "${message.content.substring(0, 30)}..."`);
    console.log(`  深度: ${result.depth}`);
    console.log(`  分数: ${result.score.toFixed(3)}`);
    console.log(`  Token 预算: ${result.tokenBudget}`);
    console.log(`  描述: ${controller.getDepthDescription(result.depth)}`);
    console.log();
  }
}

/**
 * 测试多假设管理器
 */
async function testMultiHypothesisManager() {
  console.log("\n=== 测试多假设管理器 ===\n");

  const manager = new MultiHypothesisManager();

  // 添加假设
  const h1 = manager.addHypothesis(
    "用户想要一个简单的代码示例",
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    0.6
  );
  console.log(`添加假设 1: ${h1.content} (置信度: ${h1.confidence})`);

  const h2 = manager.addHypothesis(
    "用户想要详细的教程",
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    0.4
  );
  console.log(`添加假设 2: ${h2.content} (置信度: ${h2.confidence})`);

  const h3 = manager.addHypothesis(
    "用户想要最佳实践指南",
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    0.5
  );
  console.log(`添加假设 3: ${h3.content} (置信度: ${h3.confidence})`);

  console.log("\n活跃假设:");
  const active = manager.getActiveHypotheses();
  active.forEach((h) => {
    console.log(`  - [${(h.confidence * 100).toFixed(0)}%] ${h.content}`);
  });

  // 添加证据
  console.log("\n添加支持证据到假设 1...");
  manager.addEvidence(h1.id, "用户使用了'简单'这个词", true);

  console.log("\n更新后的假设:");
  manager.getActiveHypotheses().forEach((h) => {
    console.log(`  - [${(h.confidence * 100).toFixed(0)}%] ${h.content}`);
  });

  // 生成摘要
  console.log("\n假设摘要:");
  console.log(manager.generateSummary());
}

/**
 * 测试思考协议引擎
 */
async function testThinkingProtocolEngine() {
  console.log("\n=== 测试思考协议引擎 ===\n");

  const engine = new ThinkingProtocolEngine();

  // 测试不同复杂度的问题
  const testCases = [
    { message: testMessages[0], expected: ThinkingDepth.MINIMAL },
    { message: testMessages[1], expected: ThinkingDepth.STANDARD },
    { message: testMessages[2], expected: ThinkingDepth.EXTENSIVE },
    { message: testMessages[3], expected: ThinkingDepth.DEEP },
  ];

  for (const { message, expected } of testCases) {
    console.log(`\n处理消息: "${message.content.substring(0, 40)}..."`);
    console.log(`预期深度: ${expected}`);

    const result = await engine.execute(message);

    console.log(`实际深度: ${result.depth}`);
    console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`Token 使用: ${result.tokensUsed}`);
    console.log(`耗时: ${result.duration}ms`);
    console.log(`完成步骤: ${result.stepResults.length}`);
    console.log(`洞察数量: ${result.insights.length}`);
    console.log(`需要工具: ${result.requiresToolUse}`);
    console.log(`需要澄清: ${result.needsClarification}`);
  }
}

/**
 * 测试思维流合成器
 */
async function testThoughtFlowSynthesizer() {
  console.log("\n=== 测试思维流合成器 ===\n");

  const engine = new ThinkingProtocolEngine();
  const synthesizer = new ThoughtFlowSynthesizer();

  const message: HumanMessage = {
    id: "test-synth",
    content: "如何优化数据库查询性能？",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  };

  const result = await engine.execute(message);

  console.log("完整思维流:");
  console.log(synthesizer.synthesize(result));

  console.log("\n--- 简洁版本 ---\n");
  console.log(synthesizer.synthesizeBrief(result));

  console.log("\n--- Markdown 版本 ---\n");
  console.log(synthesizer.synthesizeMarkdown(result));
}

/**
 * 测试快速思考函数
 */
async function testQuickThink() {
  console.log("\n=== 测试快速思考函数 ===\n");

  const result = await quickThink("什么是机器学习？");

  console.log(`深度: ${result.depth}`);
  console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`洞察: ${result.insights.join(", ")}`);
}

/**
 * 测试深度思考函数
 */
async function testDeepThink() {
  console.log("\n=== 测试深度思考函数 ===\n");

  const result = await deepThink(
    "请分析微服务架构的优缺点，并给出何时应该使用微服务的建议"
  );

  console.log(`深度: ${result.depth}`);
  console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`完成步骤: ${result.stepResults.length}`);
  console.log(`洞察数量: ${result.insights.length}`);
  console.log(`Token 使用: ${result.tokensUsed}`);
}

/**
 * 测试简单思考函数
 */
async function testMinimalThink() {
  console.log("\n=== 测试简单思考函数 ===\n");

  const result = await minimalThink("你好");

  console.log(`深度: ${result.depth}`);
  console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`完成步骤: ${result.stepResults.length}`);
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       灵思层（L0）测试套件                    ║");
  console.log("║    基于 Thinking Claude 协议设计              ║");
  console.log("╚══════════════════════════════════════════════╝");

  try {
    await testAdaptiveDepthController();
    await testMultiHypothesisManager();
    await testThinkingProtocolEngine();
    await testThoughtFlowSynthesizer();
    await testQuickThink();
    await testDeepThink();
    await testMinimalThink();

    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║           所有测试通过 ✅                     ║");
    console.log("╚══════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
