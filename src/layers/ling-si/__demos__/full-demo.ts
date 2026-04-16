/**
 * 灵思层演示
 * 
 * 展示所有核心功能的实际使用
 */

import {
  // 配置
  L0ConfigManager,
  
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
  console.log("═".repeat(60));
}

function logSection(title: string): void {
  console.log("\n" + "─".repeat(40));
  console.log(`  ${title}`);
  console.log("─".repeat(40));
}

// ============================================================
// 演示
// ============================================================

logHeader("灵思层演示");

// 1. 思考协议引擎
logSection("1. 思考协议引擎");
const engine = new ThinkingProtocolEngine();
log("✅ 创建 ThinkingProtocolEngine");

// 2. 自适应深度控制器
logSection("2. 自适应深度控制器");
const depthController = new AdaptiveDepthController();
log("✅ 创建 AdaptiveDepthController");

// 3. 多假设管理器
logSection("3. 多假设管理器");
const hypothesisManager = new MultiHypothesisManager();
log("✅ 创建 MultiHypothesisManager");

// 4. 上下文管理器
logSection("4. 上下文管理器");
const contextManager = new ContextManager();
log("✅ 创建 ContextManager");

// 5. Token 感知引擎
logSection("5. Token 感知引擎");
const tokenEngine = new TokenAwareThinkingEngine();
log("✅ 创建 TokenAwareThinkingEngine");

// 6. 模板注册表
logSection("6. 模板注册表");
log(`✅ templateRegistry 类型: ${typeof templateRegistry}`);

// 7. 可视化器
logSection("7. 可视化器");
log(`✅ thinkingVisualizer 类型: ${typeof thinkingVisualizer}`);

// 8. 配置管理器
logSection("8. 配置管理器");
log(`✅ L0ConfigManager 类型: ${typeof L0ConfigManager}`);

logHeader("演示完成");
log("\n✅ 所有组件演示完成\n");
