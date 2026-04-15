/**
 * 灵思层完整测试套件
 * 
 * 验证所有核心功能
 */

import {
  // 核心引擎
  ThinkingProtocolEngine,
  OptimizedThinkingProtocolEngine,
  TokenAwareThinkingEngine,
  
  // 控制器和管理器
  AdaptiveDepthController,
  MultiHypothesisManager,
  TokenAwareThinkingController,
  ContextManager,
  
  // 优化组件
  ThinkingCompressor,
  ThinkingCache,
  ThinkingPerformanceMonitor,
  
  // 模板和可视化
  templateRegistry,
  thinkingVisualizer,
  
  // 类型
  ThinkingDepth,
  ThinkingStepName,
  HumanMessage,
  HypothesisStatus,
} from "../index";

// ============================================================
// 测试工具
// ============================================================

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logSection(title: string): void {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60) + "\n");
}

function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

function logError(message: string): void {
  console.log(`❌ ${message}`);
}

function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

// ============================================================
// 测试消息
// ============================================================

const testMessages: HumanMessage[] = [
  {
    id: "test-simple",
    content: "你好",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
  {
    id: "test-standard",
    content: "如何用 Python 实现快速排序？",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
  {
    id: "test-complex",
    content: "请分析这段代码的性能问题：for i in range(1000000): result.append(str(i))",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
  {
    id: "test-deep",
    content: "设计一个高可用的分布式系统架构，需要考虑容错、负载均衡、数据一致性",
    type: "text",
    timestamp: Date.now(),
    sessionId: "test",
  },
];

// ============================================================
// 测试 1: 自适应深度控制器
// ============================================================

async function testAdaptiveDepthController(): Promise<boolean> {
  logSection("测试 1: 自适应深度控制器");

  try {
    const controller = new AdaptiveDepthController();

    for (const message of testMessages) {
      const result = controller.assessDepth(message);
      logInfo(`消息: "${message.content.substring(0, 30)}..."`);
      log(`  深度: ${result.depth}, 分数: ${result.score.toFixed(3)}, Token: ${result.tokenBudget}`);
    }

    logSuccess("自适应深度控制器测试通过");
    return true;
  } catch (error) {
    logError(`自适应深度控制器测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 2: 多假设管理器
// ============================================================

async function testMultiHypothesisManager(): Promise<boolean> {
  logSection("测试 2: 多假设管理器");

  try {
    const manager = new MultiHypothesisManager();

    // 添加假设
    const h1 = manager.addHypothesis("假设 1: 用户想要代码示例", ThinkingStepName.MULTIPLE_HYPOTHESES, 0.6);
    const h2 = manager.addHypothesis("假设 2: 用户想要详细解释", ThinkingStepName.MULTIPLE_HYPOTHESES, 0.4);
    const h3 = manager.addHypothesis("假设 3: 用户想要最佳实践", ThinkingStepName.MULTIPLE_HYPOTHESES, 0.5);

    logInfo(`添加了 3 个假设`);

    // 添加证据
    manager.addEvidence(h1.id, "用户使用了'示例'关键词", true);
    manager.addEvidence(h2.id, "用户没有要求详细解释", false);

    logInfo(`添加了证据`);

    // 确认假设
    manager.confirmHypothesis(h1.id, "用户明确要求代码");

    logInfo(`确认了假设 1`);

    // 获取状态
    const active = manager.getActiveHypotheses();
    const confirmed = manager.getConfirmedHypotheses();

    log(`活跃假设: ${active.length}, 已确认: ${confirmed.length}`);

    // 生成摘要
    logInfo("假设摘要:");
    console.log(manager.generateSummary());

    logSuccess("多假设管理器测试通过");
    return true;
  } catch (error) {
    logError(`多假设管理器测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 3: 思考协议引擎
// ============================================================

async function testThinkingProtocolEngine(): Promise<boolean> {
  logSection("测试 3: 思考协议引擎");

  try {
    const engine = new ThinkingProtocolEngine();

    for (const message of testMessages) {
      logInfo(`处理: "${message.content.substring(0, 40)}..."`);

      const result = await engine.execute(message);

      log(`  深度: ${result.depth}`);
      log(`  置信度: ${(result.confidence * 100).toFixed(1)}%`);
      log(`  步骤数: ${result.stepResults.length}`);
      log(`  假设数: ${result.hypotheses.length}`);
      log(`  洞察数: ${result.insights.length}`);
      log(`  Token: ${result.tokensUsed}`);
      log(`  耗时: ${result.duration}ms`);
    }

    logSuccess("思考协议引擎测试通过");
    return true;
  } catch (error) {
    logError(`思考协议引擎测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 4: 思考压缩器
// ============================================================

async function testThinkingCompressor(): Promise<boolean> {
  logSection("测试 4: 思考压缩器");

  try {
    const engine = new ThinkingProtocolEngine();
    const compressor = new ThinkingCompressor();

    const message = testMessages[2]; // 复杂问题
    const result = await engine.execute(message);

    logInfo(`原始 Token: ${result.tokensUsed}`);

    // 测试不同压缩级别
    const levels: Array<"light" | "medium" | "aggressive"> = ["light", "medium", "aggressive"];

    for (const level of levels) {
      compressor.updateConfig({ level, targetTokens: 500 });
      const compressed = compressor.compress(result);

      const stats = compressor.getCompressionStats(result, compressed);

      log(`  ${level}: ${stats.originalTokens} → ${stats.compressedTokens} (${(stats.compressionRatio * 100).toFixed(1)}%)`);
    }

    logSuccess("思考压缩器测试通过");
    return true;
  } catch (error) {
    logError(`思考压缩器测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 5: 思考缓存
// ============================================================

async function testThinkingCache(): Promise<boolean> {
  logSection("测试 5: 思考缓存");

  try {
    const engine = new ThinkingProtocolEngine();
    const cache = new ThinkingCache();

    const message = testMessages[1];

    // 第一次执行（缓存未命中）
    logInfo("第一次执行...");
    const result1 = await engine.execute(message);
    cache.set(message.content, result1);

    // 第二次执行（缓存命中）
    logInfo("第二次执行（从缓存）...");
    const cached = cache.get(message.content);

    if (cached) {
      log(`缓存命中: ID=${cached.id}, 深度=${cached.depth}`);
    }

    // 获取统计
    const stats = cache.getStats();
    log(`缓存统计: size=${stats.size}, hitRate=${stats.hitRate.toFixed(2)}`);

    logSuccess("思考缓存测试通过");
    return true;
  } catch (error) {
    logError(`思考缓存测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 6: Token 感知控制器
// ============================================================

async function testTokenAwareController(): Promise<boolean> {
  logSection("测试 6: Token 感知控制器");

  try {
    const controller = new TokenAwareThinkingController({
      maxTokens: 4096,
      thinkingRatio: 0.3,
      responseRatio: 0.6,
      bufferRatio: 0.1,
    });

    for (const message of testMessages) {
      const allocation = controller.analyzeBudget(message, 500);

      logInfo(`消息: "${message.content.substring(0, 30)}..."`);
      log(`  总预算: ${allocation.total}`);
      log(`  思考预算: ${allocation.thinking}`);
      log(`  响应预算: ${allocation.response}`);
      log(`  上下文使用: ${(allocation.contextUsage * 100).toFixed(1)}%`);
      log(`  推荐深度: ${allocation.recommendedDepth}`);
      log(`  需要压缩: ${allocation.needsCompression}`);
    }

    // 获取统计
    const stats = controller.getStats();
    logInfo("Token 统计:");
    log(`  平均思考预算: ${stats.avgThinkingBudget.toFixed(0)}`);
    log(`  平均上下文使用: ${(stats.avgContextUsage * 100).toFixed(1)}%`);
    log(`  压缩率: ${(stats.compressionRate * 100).toFixed(1)}%`);

    logSuccess("Token 感知控制器测试通过");
    return true;
  } catch (error) {
    logError(`Token 感知控制器测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 7: 上下文管理器
// ============================================================

async function testContextManager(): Promise<boolean> {
  logSection("测试 7: 上下文管理器");

  try {
    const manager = new ContextManager({
      maxTokens: 2000,
      resetThreshold: 0.8,
      warningThreshold: 0.6,
    });

    // 添加消息
    for (const message of testMessages) {
      manager.addMessage(message);
      const state = manager.getState();
      log(`添加消息后: Token=${state.currentTokens}, 使用率=${(state.usage * 100).toFixed(1)}%`);
    }

    // 获取状态
    const state = manager.getState();
    logInfo("上下文状态:");
    log(`  当前 Token: ${state.currentTokens}`);
    log(`  最大 Token: ${state.maxTokens}`);
    log(`  使用率: ${(state.usage * 100).toFixed(1)}%`);
    log(`  消息数: ${state.messageCount}`);

    // 生成交接文档
    const handover = manager.generateHandover();
    logInfo("交接文档:");
    log(`  摘要: ${handover.summary.substring(0, 50)}...`);
    log(`  洞察数: ${handover.keyInsights.length}`);
    log(`  建议数: ${handover.suggestedNextSteps.length}`);

    logSuccess("上下文管理器测试通过");
    return true;
  } catch (error) {
    logError(`上下文管理器测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 8: 领域模板
// ============================================================

async function testTemplates(): Promise<boolean> {
  logSection("测试 8: 领域模板");

  try {
    const templates = templateRegistry.getAll();
    logInfo(`已注册 ${templates.length} 个模板:`);

    for (const template of templates) {
      log(`  - ${template.name} (${template.domain})`);
      log(`    触发词: ${template.triggers.slice(0, 3).join(", ")}`);
    }

    // 测试模板匹配
    const codeMessage: HumanMessage = {
      id: "test-code",
      content: "请帮我审查这段代码",
      type: "text",
      timestamp: Date.now(),
      sessionId: "test",
    };

    const matched = templateRegistry.match(codeMessage);

    if (matched) {
      logInfo(`匹配到模板: ${matched.name}`);
      
      const analysis = matched.domainAnalysis(codeMessage);
      log("领域分析:");
      analysis.slice(0, 5).forEach((line) => log(`  ${line}`));
    }

    logSuccess("领域模板测试通过");
    return true;
  } catch (error) {
    logError(`领域模板测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 9: 可视化
// ============================================================

async function testVisualization(): Promise<boolean> {
  logSection("测试 9: 可视化");

  try {
    const engine = new ThinkingProtocolEngine();
    const message = testMessages[2];
    const result = await engine.execute(message);

    // ASCII
    logInfo("ASCII 格式:");
    const ascii = thinkingVisualizer.toASCII(result);
    console.log(ascii.split("\n").slice(0, 15).join("\n") + "\n...");

    // Markdown
    logInfo("Markdown 格式:");
    const markdown = thinkingVisualizer.toMarkdown(result);
    console.log(markdown.split("\n").slice(0, 20).join("\n") + "\n...");

    // JSON
    logInfo("JSON 格式:");
    const json = thinkingVisualizer.toJSON(result);
    console.log(json.split("\n").slice(0, 10).join("\n") + "\n...");

    logSuccess("可视化测试通过");
    return true;
  } catch (error) {
    logError(`可视化测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 测试 10: 完整流程
// ============================================================

async function testFullPipeline(): Promise<boolean> {
  logSection("测试 10: 完整流程");

  try {
    const engine = new TokenAwareThinkingEngine({
      tokenBudget: { maxTokens: 4096 },
      autoCompress: true,
      warnOnContextReset: true,
    });

    const message = testMessages[3]; // 最复杂的问题

    logInfo("执行完整流程...");
    const startTime = Date.now();

    const { result, allocation, wasCompressed } = await engine.executeWithTokenAwareness(
      message,
      500
    );

    const totalTime = Date.now() - startTime;

    log("结果:");
    log(`  思考深度: ${result.depth}`);
    log(`  置信度: ${(result.confidence * 100).toFixed(1)}%`);
    log(`  步骤数: ${result.stepResults.length}`);
    log(`  假设数: ${result.hypotheses.length}`);
    log(`  洞察数: ${result.insights.length}`);
    log(`  Token 使用: ${result.tokensUsed}`);
    log(`  思考预算: ${allocation.thinking}`);
    log(`  是否压缩: ${wasCompressed}`);
    log(`  总耗时: ${totalTime}ms`);

    // 获取性能指标
    const perfMetrics = engine.getPerformanceMetrics();
    logInfo("性能指标:");
    log(`  平均思考时间: ${perfMetrics.avgThinkingTime.toFixed(0)}ms`);
    log(`  平均 Token: ${perfMetrics.avgTokensUsed.toFixed(0)}`);
    log(`  缓存命中率: ${(perfMetrics.cacheHitRate * 100).toFixed(1)}%`);

    logSuccess("完整流程测试通过");
    return true;
  } catch (error) {
    logError(`完整流程测试失败: ${error}`);
    return false;
  }
}

// ============================================================
// 运行所有测试
// ============================================================

async function runAllTests(): Promise<void> {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           灵思层（L0）完整测试套件                             ║");
  console.log("║        基于 Thinking Claude 协议设计                           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const tests = [
    { name: "自适应深度控制器", fn: testAdaptiveDepthController },
    { name: "多假设管理器", fn: testMultiHypothesisManager },
    { name: "思考协议引擎", fn: testThinkingProtocolEngine },
    { name: "思考压缩器", fn: testThinkingCompressor },
    { name: "思考缓存", fn: testThinkingCache },
    { name: "Token 感知控制器", fn: testTokenAwareController },
    { name: "上下文管理器", fn: testContextManager },
    { name: "领域模板", fn: testTemplates },
    { name: "可视化", fn: testVisualization },
    { name: "完整流程", fn: testFullPipeline },
  ];

  const results: { name: string; passed: boolean }[] = [];

  for (const test of tests) {
    const passed = await test.fn();
    results.push({ name: test.name, passed });
  }

  // 汇总
  logSection("测试汇总");

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.passed) {
      logSuccess(result.name);
      passed++;
    } else {
      logError(result.name);
      failed++;
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log(`  总计: ${tests.length} 个测试`);
  console.log(`  通过: ${passed} 个`);
  console.log(`  失败: ${failed} 个`);
  console.log("═".repeat(60) + "\n");

  if (failed === 0) {
    console.log("🎉 所有测试通过！灵思层（L0）实现完整且稳定。\n");
  } else {
    console.log("⚠️  部分测试失败，请检查实现。\n");
    process.exit(1);
  }
}

// 运行测试
runAllTests();
