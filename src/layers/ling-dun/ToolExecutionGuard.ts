/**
 * 灵盾层 - 工具执行守卫
 * 
 * 功能：在工具执行前后进行安全检查，防止无限循环和上下文爆炸
 * 
 * 集成点：OpenClaw 工具执行层
 * 
 * @author 元灵系统
 * @version 1.0.0
 */

import { LoopDetector, getLoopDetector, LoopDetectionResult } from './LoopDetector';
import { OutputTruncator, getOutputTruncator, TruncationResult } from './OutputTruncator';

export interface ToolExecutionContext {
  toolName: string;
  args: Record<string, unknown>;
  messageId: string;
  sessionId: string;
}

export interface ToolExecutionResult {
  success: boolean;
  content: string;
  error?: string;
  wasGuarded: boolean;
  guardReason?: string;
  loopDetected?: LoopDetectionResult;
  truncationApplied?: TruncationResult;
}

export interface GuardConfig {
  /** 是否启用循环检测 */
  enableLoopDetection: boolean;
  /** 是否启用输出截断 */
  enableOutputTruncation: boolean;
  /** 是否启用强制中断 */
  enableForceInterrupt: boolean;
  /** 单个会话最大工具调用次数 */
  maxCallsPerSession: number;
  /** 单个会话最大执行时间（毫秒） */
  maxSessionDurationMs: number;
  /** 循环检测配置 */
  loopDetector: {
    maxHistorySize: number;
    interruptThreshold: number;
    warningThreshold: number;
    timeWindowMs: number;
    maxConsecutiveCalls: number;
  };
  /** 输出截断配置 */
  outputTruncator: {
    maxOutputChars: number;
    maxOutputLines: number;
    maxFileListItems: number;
    strategy: 'head' | 'tail' | 'middle' | 'smart';
  };
}

const DEFAULT_CONFIG: GuardConfig = {
  enableLoopDetection: true,
  enableOutputTruncation: true,
  enableForceInterrupt: true,
  maxCallsPerSession: 1000,
  maxSessionDurationMs: 600000, // 10 分钟
  loopDetector: {
    maxHistorySize: 100,
    interruptThreshold: 3,
    warningThreshold: 2,
    timeWindowMs: 60000,
    maxConsecutiveCalls: 5,
  },
  outputTruncator: {
    maxOutputChars: 50000,
    maxOutputLines: 500,
    maxFileListItems: 100,
    strategy: 'smart',
  },
};

/**
 * 会话状态追踪
 */
interface SessionState {
  callCount: number;
  startTime: number;
  lastCallTime: number;
}

/**
 * 工具执行守卫
 */
export class ToolExecutionGuard {
  private config: GuardConfig;
  private loopDetector: LoopDetector;
  private outputTruncator: OutputTruncator;
  private sessionStates: Map<string, SessionState> = new Map();

  constructor(config: Partial<GuardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loopDetector = new LoopDetector(this.config.loopDetector);
    this.outputTruncator = new OutputTruncator(this.config.outputTruncator);
  }

  /**
   * 获取或创建会话状态
   */
  private getOrCreateSession(sessionId: string): SessionState {
    let state = this.sessionStates.get(sessionId);
    if (!state) {
      state = {
        callCount: 0,
        startTime: Date.now(),
        lastCallTime: Date.now(),
      };
      this.sessionStates.set(sessionId, state);
    }
    return state;
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const maxAge = this.config.maxSessionDurationMs * 2;
    
    for (const [sessionId, state] of this.sessionStates.entries()) {
      if (now - state.lastCallTime > maxAge) {
        this.sessionStates.delete(sessionId);
      }
    }
  }

  /**
   * 执行前检查
   * 
   * @returns 如果返回 null，表示可以继续执行；否则返回错误信息
   */
  preCheck(context: ToolExecutionContext): {
    allowed: boolean;
    reason?: string;
    loopResult?: LoopDetectionResult;
  } {
    this.cleanupExpiredSessions();

    const session = this.getOrCreateSession(context.sessionId);

    // 1. 检查会话调用次数
    if (this.config.enableForceInterrupt && session.callCount >= this.config.maxCallsPerSession) {
      return {
        allowed: false,
        reason: `会话调用次数超限：已调用 ${session.callCount} 次，最大允许 ${this.config.maxCallsPerSession} 次`,
      };
    }

    // 2. 检查会话执行时间
    if (this.config.enableForceInterrupt) {
      const duration = Date.now() - session.startTime;
      if (duration > this.config.maxSessionDurationMs) {
        return {
          allowed: false,
          reason: `会话执行时间超限：已执行 ${Math.round(duration / 1000)} 秒，最大允许 ${Math.round(this.config.maxSessionDurationMs / 1000)} 秒`,
        };
      }
    }

    // 3. 循环检测
    if (this.config.enableLoopDetection) {
      const loopResult = this.loopDetector.recordCall(
        context.toolName,
        context.args,
        context.messageId
      );

      if (loopResult.shouldInterrupt) {
        return {
          allowed: false,
          reason: `检测到无限循环：${loopResult.reason}。已自动中断以防止系统崩溃。`,
          loopResult,
        };
      }

      if (loopResult.isLoop) {
        // 警告但不中断
        console.warn(`[ToolExecutionGuard] 警告：${loopResult.reason}`);
      }

      return {
        allowed: true,
        loopResult,
      };
    }

    return { allowed: true };
  }

  /**
   * 执行后处理
   */
  postProcess(
    context: ToolExecutionContext,
    rawContent: string,
    error?: string
  ): ToolExecutionResult {
    const session = this.getOrCreateSession(context.sessionId);
    session.callCount++;
    session.lastCallTime = Date.now();

    // 如果有错误，直接返回
    if (error) {
      return {
        success: false,
        content: rawContent,
        error,
        wasGuarded: false,
      };
    }

    // 输出截断
    let content = rawContent;
    let truncationApplied: TruncationResult | undefined;

    if (this.config.enableOutputTruncation) {
      truncationApplied = this.outputTruncator.process(rawContent);
      content = truncationApplied.content;

      if (truncationApplied.wasTruncated) {
        console.warn(
          `[ToolExecutionGuard] 输出已截断：${truncationApplied.truncationType}，` +
          `原文 ${truncationApplied.originalLength} 字符 → ${truncationApplied.truncatedLength} 字符`
        );
      }
    }

    return {
      success: true,
      content,
      wasGuarded: truncationApplied?.wasTruncated || false,
      truncationApplied,
    };
  }

  /**
   * 包装工具执行函数
   * 
   * 使用示例：
   * ```typescript
   * const guardedExec = guard.wrapExecutor(originalExec);
   * const result = await guardedExec(context);
   * ```
   */
  wrapExecutor<T extends ToolExecutionContext>(
    executor: (context: T) => Promise<string>
  ): (context: T) => Promise<ToolExecutionResult> {
    return async (context: T): Promise<ToolExecutionResult> => {
      // 执行前检查
      const preCheckResult = this.preCheck(context);
      
      if (!preCheckResult.allowed) {
        return {
          success: false,
          content: '',
          error: preCheckResult.reason,
          wasGuarded: true,
          guardReason: preCheckResult.reason,
          loopDetected: preCheckResult.loopResult,
        };
      }

      // 执行工具
      let rawContent: string;
      let error: string | undefined;

      try {
        rawContent = await executor(context);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        rawContent = '';
      }

      // 执行后处理
      return this.postProcess(context, rawContent, error);
    };
  }

  /**
   * 重置会话状态
   */
  resetSession(sessionId: string): void {
    this.sessionStates.delete(sessionId);
    this.loopDetector.resetConsecutiveCount();
  }

  /**
   * 获取统计信息
   */
  getStats(sessionId?: string): {
    sessionCount: number;
    totalCalls: number;
    loopDetectorStats: ReturnType<LoopDetector['getStats']>;
    activeSessions: number;
  } {
    let totalCalls = 0;
    for (const state of this.sessionStates.values()) {
      totalCalls += state.callCount;
    }

    return {
      sessionCount: this.sessionStates.size,
      totalCalls,
      loopDetectorStats: this.loopDetector.getStats(),
      activeSessions: sessionId ? (this.sessionStates.has(sessionId) ? 1 : 0) : this.sessionStates.size,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<GuardConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.loopDetector) {
      this.loopDetector = new LoopDetector({ ...this.config.loopDetector, ...config.loopDetector });
    }
    
    if (config.outputTruncator) {
      this.outputTruncator.updateConfig(config.outputTruncator);
    }
  }
}

// 全局实例
let globalGuard: ToolExecutionGuard | null = null;

/**
 * 获取全局守卫实例
 */
export function getToolExecutionGuard(config?: Partial<GuardConfig>): ToolExecutionGuard {
  if (!globalGuard) {
    globalGuard = new ToolExecutionGuard(config);
  }
  return globalGuard;
}

/**
 * 重置全局守卫
 */
export function resetToolExecutionGuard(): void {
  globalGuard = null;
}

/**
 * 便捷函数：包装工具执行
 */
export function guardToolExecution<T extends ToolExecutionContext>(
  executor: (context: T) => Promise<string>,
  config?: Partial<GuardConfig>
): (context: T) => Promise<ToolExecutionResult> {
  const guard = new ToolExecutionGuard(config);
  return guard.wrapExecutor(executor);
}
