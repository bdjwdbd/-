/**
 * 灵脉层（L2）- 执行与流转
 *
 * 职责：
 * - 执行引擎：命令执行、任务调度
 * - 消息通道：消息传递、事件广播
 * - 单向阀门：完成度验证、流程控制
 * - 流程编排：DAG 调度、依赖管理
 * - 工作流编排：标准化工作流组合
 * - 执行流转：顺序、并行、条件、循环
 */

// 从 core/ 导入组件
export { ExecutionEngine, MessageChannel, OneWayValve, ToolExecutor, ToolFramework } from "../../core/execution";

// 导出工作流编排
export { WorkflowOrchestrator, workflowOrchestrator } from "./WorkflowOrchestrator";
export type { Workflow, WorkflowStep, WorkflowResult } from "./WorkflowOrchestrator";

// 导出执行流转引擎
export { FlowEngine, getFlowEngine, FLOW_TEMPLATES } from "./FlowEngine";
export type {
  FlowStatus,
  FlowNodeType,
  FlowNode,
  FlowEdge,
  FlowDefinition,
  FlowExecution,
  FlowLog,
} from "./FlowEngine";

// 导出类型
export type {
  ExecutionStatus,
  MessagePriority,
  Execution,
  Message,
  ChecklistItem,
  Tool,
  ToolCall,
} from "../../core/execution";

// 层级标识
export const LING_MAI_NAME = "ling-mai";
export const LING_MAI_LEVEL = 2;
export const LING_MAI_DESCRIPTION = "执行与流转层";
