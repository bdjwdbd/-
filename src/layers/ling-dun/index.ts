/**
 * 灵盾层 (L4) - 执行安全防护
 * 
 * 这是元灵系统的第四层，负责在工具执行层面提供安全防护。
 * 
 * 核心功能：
 * 1. 循环检测 - 检测并中断无限循环
 * 2. 输出截断 - 防止上下文爆炸
 * 3. 强制中断 - 超时/超次自动终止
 * 
 * @author 元灵系统
 * @version 1.0.0
 */

export { LoopDetector, getLoopDetector, resetLoopDetector } from './LoopDetector';
export type { ToolCallFingerprint, LoopDetectionResult, LoopDetectorConfig } from './LoopDetector';

export { OutputTruncator, getOutputTruncator, resetOutputTruncator } from './OutputTruncator';
export type { TruncationConfig, TruncationResult } from './OutputTruncator';

export { 
  ToolExecutionGuard, 
  getToolExecutionGuard, 
  resetToolExecutionGuard,
  guardToolExecution 
} from './ToolExecutionGuard';
export type { 
  ToolExecutionContext, 
  ToolExecutionResult, 
  GuardConfig 
} from './ToolExecutionGuard';

/**
 * 快速集成示例
 * 
 * ```typescript
 * import { getToolExecutionGuard } from './layers/ling-dun';
 * 
 * // 在 OpenClaw 工具执行入口处
 * const guard = getToolExecutionGuard({
 *   enableLoopDetection: true,
 *   enableOutputTruncation: true,
 *   loopDetector: {
 *     interruptThreshold: 3,  // 重复 3 次自动中断
 *   },
 *   outputTruncator: {
 *     maxFileListItems: 100,  // 文件列表最多 100 项
 *   },
 * });
 * 
 * // 包装原有的执行函数
 * const guardedExec = guard.wrapExecutor(originalToolExecutor);
 * 
 * // 使用包装后的函数
 * const result = await guardedExec({
 *   toolName: 'exec',
 *   args: { command: 'ls /some/path' },
 *   messageId: 'msg-123',
 *   sessionId: 'session-456',
 * });
 * 
 * if (!result.success) {
 *   console.error('执行失败:', result.error);
 *   if (result.loopDetected) {
 *     console.warn('检测到循环:', result.loopDetected.reason);
 *   }
 * }
 * ```
 */
