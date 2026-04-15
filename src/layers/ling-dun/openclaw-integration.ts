/**
 * OpenClaw 集成补丁
 * 
 * 将灵盾层集成到 OpenClaw 的工具执行流程中。
 * 
 * 使用方法：
 * 1. 在 OpenClaw 启动时调用 initGuard()
 * 2. 工具执行会自动被守卫保护
 * 
 * @author 元灵系统
 */

import { getToolExecutionGuard, ToolExecutionGuard, ToolExecutionResult } from './index';

// 保存原始的 exec 函数引用
let originalExec: ((command: string, options?: unknown) => Promise<unknown>) | null = null;
let guard: ToolExecutionGuard | null = null;

/**
 * 初始化守卫
 * 
 * 在 OpenClaw 启动时调用此函数
 */
export function initGuard(config?: Parameters<typeof getToolExecutionGuard>[0]): void {
  guard = getToolExecutionGuard(config);
  console.log('[灵盾层] 已初始化，工具执行将被保护');
}

/**
 * 拦截 exec 工具调用
 * 
 * 这个函数应该在 OpenClaw 的工具执行层被调用
 */
export async function guardedExec(
  command: string,
  options: {
    workdir?: string;
    env?: Record<string, string>;
    timeout?: number;
    sessionId?: string;
    messageId?: string;
  } = {}
): Promise<ToolExecutionResult> {
  if (!guard) {
    initGuard();
  }

  const context = {
    toolName: 'exec',
    args: { command, ...options },
    messageId: options.messageId || `msg-${Date.now()}`,
    sessionId: options.sessionId || 'default',
  };

  // 执行前检查
  const preCheck = guard!.preCheck(context);
  
  if (!preCheck.allowed) {
    console.error('[灵盾层] 执行被阻止:', preCheck.reason);
    return {
      success: false,
      content: '',
      error: preCheck.reason,
      wasGuarded: true,
      guardReason: preCheck.reason,
      loopDetected: preCheck.loopResult,
    };
  }

  // 执行实际命令
  let rawContent: string;
  let error: string | undefined;

  try {
    // 这里应该调用 OpenClaw 的实际 exec 实现
    // 目前使用简化版本
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const result = await execAsync(command, {
      cwd: options.workdir,
      env: options.env,
      timeout: options.timeout || 60000,
      maxBuffer: 1024 * 1024 * 10, // 10MB
    });

    rawContent = result.stdout + (result.stderr ? `\n[stderr]\n${result.stderr}` : '');
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    rawContent = error;
  }

  // 执行后处理
  return guard!.postProcess(context, rawContent, error);
}

/**
 * Monkey Patch 方式集成
 * 
 * 如果无法修改 OpenClaw 源码，可以使用此方法在运行时注入
 */
export function patchOpenClawExec(): void {
  // 这个函数需要在 OpenClaw 的运行时环境中执行
  // 具体实现取决于 OpenClaw 的架构
  
  console.log('[灵盾层] Monkey Patch 模式：尝试注入 OpenClaw exec');
  console.warn('[灵盾层] 注意：Monkey Patch 模式可能不稳定，建议直接修改源码');
}

/**
 * 获取守卫统计信息
 */
export function getGuardStats() {
  if (!guard) {
    return { initialized: false };
  }
  
  return {
    initialized: true,
    ...guard.getStats(),
  };
}

/**
 * 重置会话（用于 /new 命令后）
 */
export function resetSession(sessionId?: string): void {
  if (guard) {
    guard.resetSession(sessionId || 'default');
    console.log('[灵盾层] 会话已重置');
  }
}

// 导出类型
export type { ToolExecutionResult };
