/**
 * 灵韵层（L5）- 反馈与调节
 * 
 * 职责：
 * - 反馈中心：收集反馈、分析反馈、响应反馈
 * - 调节中心：参数调节、策略调整、自动优化
 * - 应激响应：压力检测、自动降级、熔断保护
 * - 自我改进：学习改进、持续优化
 */

// 从 core/ 导入组件
export { FeedbackCenter, RegulationCenter, StressResponse } from "../../core/feedback";
export { AutoTuner } from "../../auto-tuner";

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
