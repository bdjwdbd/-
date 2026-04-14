/**
 * 灵思层（L0）- 思考协议
 * 
 * 基于 Thinking Claude 的思考协议设计
 * 在所有交互前执行深度思考过程
 * 
 * 职责：
 * - 强制思考：每次交互前必须思考
 * - 自适应深度：根据问题复杂度动态调整
 * - 多假设管理：保持多个工作假设
 * - 思维流合成：生成自然的意识流思考
 * 
 * 组件：
 * - ThinkingProtocolEngine - 思考协议引擎
 * - AdaptiveDepthController - 自适应深度控制器
 * - MultiHypothesisManager - 多假设管理器
 * - ThoughtFlowSynthesizer - 思维流合成器
 * - ThinkingSteps - 思考步骤集合
 * - EnhancedThinkingSteps - 增强思考步骤
 * - ThinkingOptimization - 思考优化（压缩、缓存、监控）
 */

// 核心引擎
export { ThinkingProtocolEngine, thinkingProtocolEngine } from "./ThinkingProtocolEngine";

// 优化引擎
export {
  OptimizedThinkingProtocolEngine,
  optimizedThinkingEngine,
  OptimizedThinkingConfig,
} from "./OptimizedThinkingEngine";

// 控制器
export { AdaptiveDepthController, adaptiveDepthController } from "./AdaptiveDepthController";

// 管理器
export { MultiHypothesisManager, multiHypothesisManager } from "./MultiHypothesisManager";

// 合成器
export { ThoughtFlowSynthesizer, thoughtFlowSynthesizer } from "./ThoughtFlowSynthesizer";

// 思考步骤
export {
  ThinkingStep,
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
} from "./ThinkingSteps";

// 增强思考步骤
export {
  EnhancedInitialEngagementStep,
  EnhancedProblemAnalysisStep,
  EnhancedMultipleHypothesesStep,
  EnhancedTestingVerificationStep,
  enhancedThinkingSteps,
} from "./EnhancedThinkingSteps";

// 思考优化
export {
  ThinkingCompressor,
  ThinkingCache,
  ThinkingPerformanceMonitor,
  thinkingCompressor,
  thinkingCache,
  thinkingPerformanceMonitor,
  PerformanceMetrics,
} from "./ThinkingOptimization";

// Token 感知思考
export {
  TokenAwareThinkingController,
  TokenAwareThinkingEngine,
  tokenAwareThinkingEngine,
  TokenBudgetAllocation,
  TokenAwareThinkingConfig,
} from "./TokenAwareThinking";

// 上下文管理
export {
  ContextManager,
  contextManager,
  ContextState,
  ContextEntry,
  ContextManagerConfig,
  HandoverDocument,
} from "./ContextManager";

// 思考模板
export {
  ThinkingTemplate,
  TemplateRegistry,
  templateRegistry,
  codeReviewTemplate,
  architectureDesignTemplate,
  problemDiagnosisTemplate,
  dataAnalysisTemplate,
  learningTeachingTemplate,
  allTemplates,
} from "./ThinkingTemplates";

// 思考可视化
export {
  ThinkingVisualizer,
  thinkingVisualizer,
  VisualizationFormat,
  VisualizationOptions,
} from "./ThinkingVisualization";

// 配置管理
export {
  ConfigManager,
  configManager,
  LingSiConfig,
  TokenBudgetConfig as ConfigTokenBudgetConfig,
  CacheConfig,
  CompressionConfig as ConfigCompressionConfig,
  ContextConfig,
  TemplateConfig,
  VisualizationConfig,
  PerformanceConfig,
  DEFAULT_CONFIG,
  PRODUCTION_CONFIG,
  QUALITY_CONFIG,
  FAST_CONFIG,
} from "./ConfigManager";

// 类型
export {
  ThinkingDepth,
  DepthAssessment,
  DepthAssessmentResult,
  ThinkingStepName,
  ThinkingStepResult,
  ThinkingContext,
  Hypothesis,
  HypothesisStatus,
  HypothesisUpdate,
  ThinkingResult,
  ToolRecommendation,
  HumanMessage,
  Attachment,
  UserContext,
  Memory as ThinkingMemory,
  ThinkingConfig,
  DEFAULT_THINKING_CONFIG,
  NATURAL_TRANSITIONS,
  getRandomTransition,
} from "./types";

// 层级标识
export const LING_SI_NAME = "ling-si";
export const LING_SI_LEVEL = 0;
export const LING_SI_DESCRIPTION = "思考协议层";

/**
 * 灵思层版本信息
 */
export const LING_SI_VERSION = {
  version: "1.0.0",
  basedOn: "Thinking Claude v5.1-extensive",
  author: "Yuanling System",
  createdAt: "2026-04-13",
};

// 导入类型供函数使用
import {
  ThinkingDepth as TD,
  ThinkingResult as TR,
  HumanMessage as HM,
} from "./types";
import { ThinkingProtocolEngine as TPE } from "./ThinkingProtocolEngine";

/**
 * 快速思考函数
 * 
 * 简化的思考入口，用于快速集成
 */
export async function quickThink(
  message: string,
  options?: {
    depth?: TD;
    visible?: boolean;
  }
): Promise<TR> {
  const engine = new TPE({
    visible: options?.visible ?? false,
  });

  const humanMessage: HM = {
    id: `msg_${Date.now()}`,
    content: message,
    type: "text",
    timestamp: Date.now(),
    sessionId: "default",
  };

  return engine.execute(humanMessage);
}

/**
 * 深度思考函数
 * 
 * 强制使用深度思考模式
 */
export async function deepThink(message: string): Promise<TR> {
  const engine = new TPE({
    maxThinkingTokens: 2000,
    enableRecursiveThinking: true,
    enableMultiHypothesis: true,
  });

  const humanMessage: HM = {
    id: `msg_${Date.now()}`,
    content: message,
    type: "text",
    timestamp: Date.now(),
    sessionId: "default",
  };

  return engine.execute(humanMessage);
}

/**
 * 简单思考函数
 * 
 * 快速响应，最小思考
 */
export async function minimalThink(message: string): Promise<TR> {
  const engine = new TPE({
    maxThinkingTokens: 100,
    enableRecursiveThinking: false,
    enableMultiHypothesis: false,
  });

  const humanMessage: HM = {
    id: `msg_${Date.now()}`,
    content: message,
    type: "text",
    timestamp: Date.now(),
    sessionId: "default",
  };

  return engine.execute(humanMessage);
}
