/**
 * 灵枢层（L1）- 决策与协调
 * 
 * 职责：
 * - 决策制定：分析任务、制定计划、选择行动
 * - 记忆管理：存储、检索、压缩记忆
 * - 安全评估：风险评估、威胁检测
 * - 协调调度：多 Agent 协调、资源分配
 */

// 从 core/ 导入组件
export { DecisionCenter, MemoryCenter, SecurityAssessment } from "../../core/decision";
export { MemoryCenterV2 } from "../../core";
export { AgentCoordinator } from "../../agent-coordinator";

// 导出类型
export type {
  DecisionType,
  MemoryType,
  Decision,
  Memory,
  SecurityRisk,
} from "../../core/decision";

// 层级标识
export const LING_SHU_NAME = "ling-shu";
export const LING_SHU_LEVEL = 1;
export const LING_SHU_DESCRIPTION = "决策与协调层";
