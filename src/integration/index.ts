/**
 * 集成模块入口
 * 
 * 导出所有集成组件
 */

// 灵思层集成
export {
  DecisionCenterV3,
  LearningValidatorV3,
  ThinkingOrchestrator,
  thinkingOrchestrator,
  EnhancedDecisionContext,
  EnhancedDecision,
  EnhancedValidationResult,
} from "./ThinkingIntegration";

// 从灵思层重新导出
export {
  ThinkingProtocolEngine,
  ThinkingResult,
  ThinkingContext,
  ThinkingDepth,
  HumanMessage,
  MultiHypothesisManager,
  AdaptiveDepthController,
  quickThink,
  deepThink,
  minimalThink,
} from "../layers/ling-si";
