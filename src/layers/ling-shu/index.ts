/**
 * 灵枢层（L1）- 决策与协调
 *
 * 职责：
 * - 决策制定：分析任务、制定计划、选择行动
 * - 矛盾分析：识别主要矛盾，选择切入点
 * - 阶段管理：持久战略，分阶段推进
 * - 记忆管理：存储、检索、压缩记忆
 * - 安全评估：风险评估、威胁检测
 * - 协调调度：多 Agent 协调、资源分配
 */

// 从 core/ 导入组件
export { DecisionCenter, MemoryCenter, SecurityAssessment } from "../../core/decision";
export { MemoryCenterV2 } from "../../core";
export { AgentCoordinator } from "../../agent-coordinator";

// 导出矛盾分析
export { ContradictionAnalyzer, contradictionAnalyzer } from "./ContradictionAnalyzer";
export type { Contradiction, ContradictionAnalysisResult } from "./ContradictionAnalyzer";

// 导出持久战略
export { ProtractedStrategy, protractedStrategy } from "./ProtractedStrategy";
export type { StrategicPhase, PhaseAssessment } from "./ProtractedStrategy";

// 导出决策中心
export {
  IntentEngine,
  DecisionReasoningEngine,
  TaskQueueManager,
  getIntentEngine,
  getDecisionReasoningEngine,
  getTaskQueueManager,
} from "./DecisionCenter";

export type {
  IntentType,
  Priority,
  Intent,
  Decision,
  TaskQueue,
} from "./DecisionCenter";

// 导出类型
export type {
  DecisionType,
  MemoryType,
  Memory,
  SecurityRisk,
} from "../../core/decision";

export type { Decision as CoreDecision } from "../../core/decision";

// 层级标识
export const LING_SHU_NAME = "ling-shu";
export const LING_SHU_LEVEL = 1;
export const LING_SHU_DESCRIPTION = "决策与协调层";
