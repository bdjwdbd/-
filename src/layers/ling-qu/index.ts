/**
 * 灵躯层（L3）- 行动与工具
 * 
 * 职责：
 * - 工具执行：调用外部工具、管理工具生命周期
 * - 工具框架：工具注册、参数验证、结果处理
 * - 工具编排：多工具协同、依赖管理、并行执行
 * - 技能管理：技能加载、技能执行、技能缓存
 * - 资源管理：资源分配、资源回收
 */

// 从 core/ 导入组件
export { ToolExecutor, ToolFramework } from "../../core/execution";

// 导出工具编排引擎
export {
  ToolOrchestrator,
  getToolOrchestrator,
  PLAN_TEMPLATES,
} from "./ToolOrchestrator";

export type {
  ToolStep,
  ExecutionPlan,
  ExecutionContext,
  ExecutionResult,
  ResourceUsage,
} from "./ToolOrchestrator";

// 导出类型
export type { Tool, ToolCall } from "../../core/execution";

// 层级标识
export const LING_QU_NAME = "ling-qu";
export const LING_QU_LEVEL = 3;
export const LING_QU_DESCRIPTION = "行动与工具层";
