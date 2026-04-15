/**
 * 灵韵层（L5）- 反馈与调节
 *
 * 职责：
 * - 反馈中心：收集反馈、分析反馈、响应反馈
 * - 调节中心：参数调节、策略调整、自动优化
 * - 应激响应：压力检测、自动降级、熔断保护
 * - 自我改进：学习改进、持续优化
 * - 实践认识论：螺旋上升的认识循环
 * - 质量评估：输出质量、响应质量评估
 */

// 从 core/ 导入组件
export { FeedbackCenter, RegulationCenter, StressResponse } from "../../core/feedback";
export { AutoTuner } from "../../infrastructure/auto-tuner";

// 导出实践认识论
export { PracticeCognition, practiceCognition } from "./PracticeCognition";
export type { CognitionPhase, CognitionCycleResult } from "./PracticeCognition";

// 导出自我改进
export { SelfImprovementEngine, selfImprovementEngine } from "./SelfImprovement";
export type { LearningRecord, ImprovementSuggestion } from "./SelfImprovement";

// 导出反馈调节系统
export {
  FeedbackCollector,
  QualityAssessor,
  AdaptiveRegulator,
  ImprovementTracker,
  FeedbackRegulationSystem,
  getFeedbackRegulationSystem,
} from "./FeedbackRegulation";

export type {
  FeedbackType as FeedbackTypeV2,
  QualityDimension,
  Feedback as FeedbackV2,
  QualityScore,
  Adjustment,
  ImprovementRecord,
} from "./FeedbackRegulation";

// 导出类型
export type {
  FeedbackType,
  FeedbackSource,
  RegulationAction,
  StressLevel,
  Feedback,
  RegulationRule,
  RegulationEvent,
  StressIndicator,
} from "../../core/feedback";

// 层级标识
export const LING_YUN_NAME = "ling-yun";
export const LING_YUN_LEVEL = 5;
export const LING_YUN_DESCRIPTION = "反馈与调节层";
