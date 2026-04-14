/**
 * 灵思层演示
 * 
 * 展示所有核心功能的实际使用
 */

import {
  // 配置
  ConfigManager,
  configManager,
  
  // 引擎
  ThinkingProtocolEngine,
  TokenAwareThinkingEngine,
  
  // 组件
  AdaptiveDepthController,
  MultiHypothesisManager,
  ContextManager,
  templateRegistry,
  thinkingVisualizer,
  
  // 类型
  ThinkingDepth,
  ThinkingStepName,
  HumanMessage,
  HypothesisStatus,
} from "../index";

// ============================================================
// 演示工具
// ============================================================

function log(message: string): void {
  console.log(message);
}

function logHeader(title: string): void {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60) + "\n");
}

function logSubHeader(title: string): void {
  console.log("\n" + "─".repeat(40));
  console.log(`  ${title}`);
  console.log("─".repeat(40) + "\n");
}

// ============================================================
// 演示 1: 基础使用
// ============================================================

async function demo1_BasicUsage(): Promise<void> {
  logHeader("演示 1: 基础使用");

  // 创建引擎
  const engine = new ThinkingProtocolEngine();

  // 创建消息
  const message: HumanMessage = {
    id: "demo-1",
    content: "如何用 Python 实现快速排序？",
    type: "text",
    timestamp: Date.now(),
    sessionId: "demo",
  };

  log("📝 用户消息:");
  log(`   "${message.content}"\n`);

  // 执行思考
  log("🔄 执行思考...\n");
  const result = await engine.execute(message);

  // 显示结果
  log("📊 思考结果:");
  log(`   深度: ${result.depth}`);
  log(`   置信度: ${(result.confidence * 100).toFixed(1)}%`);
  log(`   步骤数: ${result.stepResults.length}`);
  log(`   假设数: ${result.hypotheses.length}`);
  log(`   洞察数: ${result.insights.length}`);
  log(`   Token: ${result.tokensUsed}`);
  log(`   耗时: ${result.duration}ms`);

  // 显示洞察
  if (result.insights.length > 0) {
    log("\n💡 关键洞察:");
    result.insights.forEach((insight, i) => {
      log(`   ${i + 1}. ${insight}`);
    });
  }
}

// ============================================================
// 演示 2: 配置预设
// ============================================================

async function demo2_ConfigPresets(): Promise<void> {
  logHeader("演示 2: 配置预设");

  const manager = new ConfigManager();

  // 显示可用预设
  log("📦 可用预设:");
  manager.getPresetNames().forEach((name) => {
    log(`   - ${name}`);
  });

  // 切换预设
  log("\n🔄 切换到 'quality' 预设...");
  manager.usePreset("quality");

  const config = manager.getConfig();
  log("\n📊 当前配置:");
  log(`   最大思考 Token: ${config.thinking.maxThinkingTokens}`);
  log(`   最大假设数: ${config.thinking.maxHypotheses}`);
  log(`   递归思考: ${config.thinking.enableRecursiveThinking}`);
  log(`   压缩级别: ${config.compression.level}`);

  // 验证配置
  const validation = manager.validate();
  log(`\n✅ 配置验证: ${validation.valid ? "通过" : "失败"}`);
  if (!validation.valid) {
    validation.errors.forEach((err) => log(`   ❌ ${err}`));
  }
}

// ============================================================
// 演示 3: 深度控制
// ============================================================

async function demo3_DepthControl(): Promise<void> {
  logHeader("演示 3: 深度控制");

  const controller = new AdaptiveDepthController();

  const messages = [
    { content: "你好", expected: "MINIMAL" },
    { content: "什么是机器学习？", expected: "STANDARD" },
    { content: "请分析这段代码的性能问题并给出优化建议", expected: "EXTENSIVE" },
    { content: "设计一个高可用的分布式系统架构，需要考虑容错、负载均衡、数据一致性", expected: "DEEP" },
  ];

  log("🎯 深度评估测试:\n");

  for (const { content, expected } of messages) {
    const message: HumanMessage = {
      id: `test-${Date.now()}`,
      content,
      type: "text",
      timestamp: Date.now(),
      sessionId: "demo",
    };

    const result = controller.assessDepth(message);

    log(`📝 "${content.substring(0, 40)}..."`);
    log(`   预期: ${expected}`);
    log(`   实际: ${result.depth}`);
    log(`   分数: ${result.score.toFixed(3)}`);
    log(`   Token: ${result.tokenBudget}`);
    log("");
  }
}

// ============================================================
// 演示 4: 假设管理
// ============================================================

async function demo4_HypothesisManagement(): Promise<void> {
  logHeader("演示 4: 假设管理");

  const manager = new MultiHypothesisManager();

  logSubHeader("添加假设");

  const h1 = manager.addHypothesis(
    "用户想要代码示例",
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    0.6
  );
  log(`   H1: ${h1.content} (${(h1.confidence * 100).toFixed(0)}%)`);

  const h2 = manager.addHypothesis(
    "用户想要详细解释",
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    0.4
  );
  log(`   H2: ${h2.content} (${(h2.confidence * 100).toFixed(0)}%)`);

  const h3 = manager.addHypothesis(
    "用户想要最佳实践",
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    0.5
  );
  log(`   H3: ${h3.content} (${(h3.confidence * 100).toFixed(0)}%)`);

  logSubHeader("添加证据");

  manager.addEvidence(h1.id, "用户使用了'示例'关键词", true);
  log(`   ✓ H1 获得支持证据`);

  manager.addEvidence(h2.id, "用户没有要求详细解释", false);
  log(`   ✗ H2 获得反对证据`);

  logSubHeader("确认假设");

  manager.confirmHypothesis(h1.id, "用户明确要求代码");
  log(`   ✓ H1 已确认`);

  logSubHeader("假设状态");

  const active = manager.getActiveHypotheses();
  const confirmed = manager.getConfirmedHypotheses();
  const rejected = manager.getRejectedHypotheses();

  log(`   活跃: ${active.length}`);
  log(`   已确认: ${confirmed.length}`);
  log(`   已拒绝: ${rejected.length}`);

  log("\n📋 假设摘要:");
  console.log(manager.generateSummary());
}

// ============================================================
// 演示 5: 领域模板
// ============================================================

async function demo5_DomainTemplates(): Promise<void> {
  logHeader("演示 5: 领域模板");

  // 显示所有模板
  const templates = templateRegistry.getAll();
  log("📚 已注册模板:\n");

  templates.forEach((template) => {
    log(`   📁 ${template.name}`);
    log(`      领域: ${template.domain}`);
    log(`      触发词: ${template.triggers.slice(0, 3).join(", ")}`);
    log("");
  });

  // 测试模板匹配
  logSubHeader("模板匹配测试");

  const testCases = [
    "请帮我审查这段代码",
    "设计一个微服务架构",
    "程序报错了，帮我诊断问题",
    "分析一下销售数据",
    "我想学习 Python",
  ];

  for (const content of testCases) {
    const message: HumanMessage = {
      id: `test-${Date.now()}`,
      content,
      type: "text",
      timestamp: Date.now(),
      sessionId: "demo",
    };

    const matched = templateRegistry.match(message);

    log(`📝 "${content}"`);
    if (matched) {
      log(`   ✅ 匹配: ${matched.name}`);
    } else {
      log(`   ⚪ 无匹配`);
    }
    log("");
  }
}

// ============================================================
// 演示 6: 可视化
// ============================================================

async function demo6_Visualization(): Promise<void> {
  logHeader("演示 6: 可视化");

  const engine = new ThinkingProtocolEngine();

  const message: HumanMessage = {
    id: "demo-6",
    content: "如何优化数据库查询性能？",
    type: "text",
    timestamp: Date.now(),
    sessionId: "demo",
  };

  const result = await engine.execute(message);

  logSubHeader("ASCII 格式");
  const ascii = thinkingVisualizer.toASCII(result);
  console.log(ascii.split("\n").slice(0, 20).join("\n"));

  logSubHeader("Markdown 格式");
  const markdown = thinkingVisualizer.toMarkdown(result);
  console.log(markdown.split("\n").slice(0, 25).join("\n"));

  logSubHeader("JSON 格式");
  const json = thinkingVisualizer.toJSON(result);
  console.log(json.split("\n").slice(0, 15).join("\n"));
}

// ============================================================
// 演示 7: Token 感知
// ============================================================

async function demo7_TokenAware(): Promise<void> {
  logHeader("演示 7: Token 感知");

  const engine = new TokenAwareThinkingEngine({
    tokenBudget: { maxTokens: 4096 },
    autoCompress: true,
    warnOnContextReset: true,
  });

  const message: HumanMessage = {
    id: "demo-7",
    content: "设计一个高可用的分布式系统架构",
    type: "text",
    timestamp: Date.now(),
    sessionId: "demo",
  };

  log("📝 用户消息:");
  log(`   "${message.content}"\n`);

  log("🔄 执行 Token 感知思考...\n");

  const { result, allocation, wasCompressed } = await engine.executeWithTokenAwareness(
    message,
    500 // 假设已有 500 tokens 上下文
  );

  log("📊 Token 分配:");
  log(`   总预算: ${allocation.total}`);
  log(`   思考预算: ${allocation.thinking}`);
  log(`   响应预算: ${allocation.response}`);
  log(`   缓冲预算: ${allocation.buffer}`);
  log(`   上下文使用: ${(allocation.contextUsage * 100).toFixed(1)}%`);

  log("\n📊 思考结果:");
  log(`   深度: ${result.depth}`);
  log(`   Token 使用: ${result.tokensUsed}`);
  log(`   是否压缩: ${wasCompressed}`);

  // 获取性能指标
  const metrics = engine.getPerformanceMetrics();
  log("\n📈 性能指标:");
  log(`   平均思考时间: ${metrics.avgThinkingTime.toFixed(0)}ms`);
  log(`   平均 Token: ${metrics.avgTokensUsed.toFixed(0)}`);
  log(`   缓存命中率: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
}

// ============================================================
// 演示 8: 上下文管理
// ============================================================

async function demo8_ContextManagement(): Promise<void> {
  logHeader("演示 8: 上下文管理");

  const manager = new ContextManager({
    maxTokens: 2000,
    resetThreshold: 0.8,
    warningThreshold: 0.6,
  });

  logSubHeader("添加消息");

  const messages = [
    "你好，我想学习 Python",
    "请给我推荐一些学习资源",
    "能给我一个快速排序的代码示例吗？",
    "这段代码的时间复杂度是多少？",
    "如何优化它？",
  ];

  for (const content of messages) {
    const message: HumanMessage = {
      id: `msg-${Date.now()}`,
      content,
      type: "text",
      timestamp: Date.now(),
      sessionId: "demo",
    };

    manager.addMessage(message);
    const state = manager.getState();

    log(`   📝 "${content}"`);
    log(`      Token: ${state.currentTokens}, 使用率: ${(state.usage * 100).toFixed(1)}%`);
    log("");
  }

  logSubHeader("上下文状态");
  const state = manager.getState();
  log(`   当前 Token: ${state.currentTokens}`);
  log(`   最大 Token: ${state.maxTokens}`);
  log(`   使用率: ${(state.usage * 100).toFixed(1)}%`);
  log(`   消息数: ${state.messageCount}`);

  logSubHeader("交接文档");
  const handover = manager.generateHandover();
  log(`   摘要: ${handover.summary.substring(0, 60)}...`);
  log(`   洞察数: ${handover.keyInsights.length}`);
  log(`   建议数: ${handover.suggestedNextSteps.length}`);
}

// ============================================================
// 运行所有演示
// ============================================================

async function runAllDemos(): Promise<void> {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           灵思层（L0）功能演示                                 ║");
  console.log("║        基于 Thinking Claude 协议设计                           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  try {
    await demo1_BasicUsage();
    await demo2_ConfigPresets();
    await demo3_DepthControl();
    await demo4_HypothesisManagement();
    await demo5_DomainTemplates();
    await demo6_Visualization();
    await demo7_TokenAware();
    await demo8_ContextManagement();

    console.log("\n");
    console.log("═".repeat(60));
    console.log("  🎉 所有演示完成！");
    console.log("═".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ 演示失败:", error);
    process.exit(1);
  }
}

// 运行演示
runAllDemos();
