/**
 * 灵思层集成验证
 * 
 * 验证所有组件是否正确导出和集成
 */

// 导入所有组件
import {
  // 核心引擎
  ThinkingProtocolEngine,
  thinkingProtocolEngine,
  OptimizedThinkingProtocolEngine,
  optimizedThinkingEngine,
  TokenAwareThinkingEngine,
  tokenAwareThinkingEngine,
  
  // 控制器和管理器
  AdaptiveDepthController,
  adaptiveDepthController,
  MultiHypothesisManager,
  multiHypothesisManager,
  TokenAwareThinkingController,
  ContextManager,
  contextManager,
  
  // 优化组件
  ThinkingCompressor,
  thinkingCompressor,
  ThinkingCache,
  thinkingCache,
  ThinkingPerformanceMonitor,
  thinkingPerformanceMonitor,
  
  // 合成器
  ThoughtFlowSynthesizer,
  thoughtFlowSynthesizer,
  
  // 思考步骤
  allThinkingSteps,
  thinkingStepMap,
  InitialEngagementStep,
  ProblemAnalysisStep,
  MultipleHypothesesStep,
  NaturalDiscoveryStep,
  TestingVerificationStep,
  ErrorCorrectionStep,
  KnowledgeSynthesisStep,
  PatternRecognitionStep,
  ProgressTrackingStep,
  RecursiveThinkingStep,
  
  // 增强步骤
  EnhancedInitialEngagementStep,
  EnhancedProblemAnalysisStep,
  EnhancedMultipleHypothesesStep,
  EnhancedTestingVerificationStep,
  enhancedThinkingSteps,
  
  // 模板
  ThinkingTemplate,
  TemplateRegistry,
  templateRegistry,
  codeReviewTemplate,
  architectureDesignTemplate,
  problemDiagnosisTemplate,
  dataAnalysisTemplate,
  learningTeachingTemplate,
  allTemplates,
  
  // 可视化
  ThinkingVisualizer,
  thinkingVisualizer,
  
  // 配置
  ConfigManager,
  configManager,
  DEFAULT_CONFIG,
  PRODUCTION_CONFIG,
  QUALITY_CONFIG,
  FAST_CONFIG,
  
  // 类型
  ThinkingDepth,
  ThinkingStepName,
  ThinkingConfig,
  ThinkingResult,
  ThinkingContext,
  HumanMessage,
  Hypothesis,
  HypothesisStatus,
  NATURAL_TRANSITIONS,
  getRandomTransition,
  
  // 快速函数
  quickThink,
  deepThink,
  minimalThink,
  
  // 层级标识
  LING_SI_NAME,
  LING_SI_LEVEL,
  LING_SI_DESCRIPTION,
  LING_SI_VERSION,
} from "../index";

// ============================================================
// 验证函数
// ============================================================

function verify(name: string, value: unknown): boolean {
  const exists = value !== undefined && value !== null;
  const status = exists ? "✅" : "❌";
  console.log(`${status} ${name}`);
  return exists;
}

// ============================================================
// 主验证
// ============================================================

console.log("\n" + "═".repeat(60));
console.log("  灵思层（L0）集成验证");
console.log("═".repeat(60) + "\n");

let passed = 0;
let failed = 0;

// 核心引擎
console.log("📦 核心引擎:");
if (verify("ThinkingProtocolEngine", ThinkingProtocolEngine)) passed++; else failed++;
if (verify("thinkingProtocolEngine", thinkingProtocolEngine)) passed++; else failed++;
if (verify("OptimizedThinkingProtocolEngine", OptimizedThinkingProtocolEngine)) passed++; else failed++;
if (verify("optimizedThinkingEngine", optimizedThinkingEngine)) passed++; else failed++;
if (verify("TokenAwareThinkingEngine", TokenAwareThinkingEngine)) passed++; else failed++;
if (verify("tokenAwareThinkingEngine", tokenAwareThinkingEngine)) passed++; else failed++;

// 控制器和管理器
console.log("\n📦 控制器和管理器:");
if (verify("AdaptiveDepthController", AdaptiveDepthController)) passed++; else failed++;
if (verify("adaptiveDepthController", adaptiveDepthController)) passed++; else failed++;
if (verify("MultiHypothesisManager", MultiHypothesisManager)) passed++; else failed++;
if (verify("multiHypothesisManager", multiHypothesisManager)) passed++; else failed++;
if (verify("TokenAwareThinkingController", TokenAwareThinkingController)) passed++; else failed++;
if (verify("ContextManager", ContextManager)) passed++; else failed++;
if (verify("contextManager", contextManager)) passed++; else failed++;

// 优化组件
console.log("\n📦 优化组件:");
if (verify("ThinkingCompressor", ThinkingCompressor)) passed++; else failed++;
if (verify("thinkingCompressor", thinkingCompressor)) passed++; else failed++;
if (verify("ThinkingCache", ThinkingCache)) passed++; else failed++;
if (verify("thinkingCache", thinkingCache)) passed++; else failed++;
if (verify("ThinkingPerformanceMonitor", ThinkingPerformanceMonitor)) passed++; else failed++;
if (verify("thinkingPerformanceMonitor", thinkingPerformanceMonitor)) passed++; else failed++;

// 合成器
console.log("\n📦 合成器:");
if (verify("ThoughtFlowSynthesizer", ThoughtFlowSynthesizer)) passed++; else failed++;
if (verify("thoughtFlowSynthesizer", thoughtFlowSynthesizer)) passed++; else failed++;

// 思考步骤
console.log("\n📦 思考步骤:");
if (verify("allThinkingSteps", allThinkingSteps)) passed++; else failed++;
if (verify("thinkingStepMap", thinkingStepMap)) passed++; else failed++;
if (verify("InitialEngagementStep", InitialEngagementStep)) passed++; else failed++;
if (verify("ProblemAnalysisStep", ProblemAnalysisStep)) passed++; else failed++;
if (verify("MultipleHypothesesStep", MultipleHypothesesStep)) passed++; else failed++;
if (verify("NaturalDiscoveryStep", NaturalDiscoveryStep)) passed++; else failed++;
if (verify("TestingVerificationStep", TestingVerificationStep)) passed++; else failed++;
if (verify("ErrorCorrectionStep", ErrorCorrectionStep)) passed++; else failed++;
if (verify("KnowledgeSynthesisStep", KnowledgeSynthesisStep)) passed++; else failed++;
if (verify("PatternRecognitionStep", PatternRecognitionStep)) passed++; else failed++;
if (verify("ProgressTrackingStep", ProgressTrackingStep)) passed++; else failed++;
if (verify("RecursiveThinkingStep", RecursiveThinkingStep)) passed++; else failed++;

// 增强步骤
console.log("\n📦 增强步骤:");
if (verify("EnhancedInitialEngagementStep", EnhancedInitialEngagementStep)) passed++; else failed++;
if (verify("EnhancedProblemAnalysisStep", EnhancedProblemAnalysisStep)) passed++; else failed++;
if (verify("EnhancedMultipleHypothesesStep", EnhancedMultipleHypothesesStep)) passed++; else failed++;
if (verify("EnhancedTestingVerificationStep", EnhancedTestingVerificationStep)) passed++; else failed++;
if (verify("enhancedThinkingSteps", enhancedThinkingSteps)) passed++; else failed++;

// 模板
console.log("\n📦 模板:");
if (verify("TemplateRegistry", TemplateRegistry)) passed++; else failed++;
if (verify("templateRegistry", templateRegistry)) passed++; else failed++;
if (verify("codeReviewTemplate", codeReviewTemplate)) passed++; else failed++;
if (verify("architectureDesignTemplate", architectureDesignTemplate)) passed++; else failed++;
if (verify("problemDiagnosisTemplate", problemDiagnosisTemplate)) passed++; else failed++;
if (verify("dataAnalysisTemplate", dataAnalysisTemplate)) passed++; else failed++;
if (verify("learningTeachingTemplate", learningTeachingTemplate)) passed++; else failed++;
if (verify("allTemplates", allTemplates)) passed++; else failed++;

// 可视化
console.log("\n📦 可视化:");
if (verify("ThinkingVisualizer", ThinkingVisualizer)) passed++; else failed++;
if (verify("thinkingVisualizer", thinkingVisualizer)) passed++; else failed++;

// 配置
console.log("\n📦 配置:");
if (verify("ConfigManager", ConfigManager)) passed++; else failed++;
if (verify("configManager", configManager)) passed++; else failed++;
if (verify("DEFAULT_CONFIG", DEFAULT_CONFIG)) passed++; else failed++;
if (verify("PRODUCTION_CONFIG", PRODUCTION_CONFIG)) passed++; else failed++;
if (verify("QUALITY_CONFIG", QUALITY_CONFIG)) passed++; else failed++;
if (verify("FAST_CONFIG", FAST_CONFIG)) passed++; else failed++;

// 类型
console.log("\n📦 类型:");
if (verify("ThinkingDepth", ThinkingDepth)) passed++; else failed++;
if (verify("ThinkingStepName", ThinkingStepName)) passed++; else failed++;
if (verify("NATURAL_TRANSITIONS", NATURAL_TRANSITIONS)) passed++; else failed++;
if (verify("getRandomTransition", getRandomTransition)) passed++; else failed++;

// 快速函数
console.log("\n📦 快速函数:");
if (verify("quickThink", quickThink)) passed++; else failed++;
if (verify("deepThink", deepThink)) passed++; else failed++;
if (verify("minimalThink", minimalThink)) passed++; else failed++;

// 层级标识
console.log("\n📦 层级标识:");
if (verify("LING_SI_NAME", LING_SI_NAME)) passed++; else failed++;
if (verify("LING_SI_LEVEL", LING_SI_LEVEL)) passed++; else failed++;
if (verify("LING_SI_DESCRIPTION", LING_SI_DESCRIPTION)) passed++; else failed++;
if (verify("LING_SI_VERSION", LING_SI_VERSION)) passed++; else failed++;

// 汇总
console.log("\n" + "═".repeat(60));
console.log(`  验证完成: ${passed} 通过, ${failed} 失败`);
console.log("═".repeat(60) + "\n");

if (failed > 0) {
  console.log("❌ 部分组件验证失败，请检查导出配置");
  process.exit(1);
} else {
  console.log("✅ 所有组件验证通过，灵思层集成正确");
}
