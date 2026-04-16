/**
 * L4 灵盾层 - 防护与验证
 * 
 * 负责安全验证、沙盒隔离、风险评估
 */

// 原有组件
export { ToolExecutionGuard } from './ToolExecutionGuard';
export { LoopDetector } from './LoopDetector';
export { OutputTruncator } from './OutputTruncator';

// 从 ToolExecutionGuard 导出类型
export type { ToolExecutionContext, ToolExecutionResult, GuardConfig } from './ToolExecutionGuard';

export * from './manager';
export * from './openclaw-integration';
