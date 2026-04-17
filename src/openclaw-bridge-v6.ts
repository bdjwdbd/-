/**
 * OpenClaw 薄适配器
 * 
 * 注意：
 * - 这里只做适配，不再承载 L1/L4/L5 逻辑
 * - 真正主执行链全部下沉到 YuanLingSystem
 */

import {
  getYuanLingSystem,
  type ExternalExecutor,
  type OpenClawCompatibleMessage,
  type YuanLingRunContext,
  type YuanLingRunResult,
} from './yuanling-system-v6';

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenClawToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface OpenClawResult {
  content: string;
  toolCalls?: OpenClawToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type YuanLingContext = YuanLingRunContext;

/**
 * OpenClaw 桥接类（薄适配器）
 * 
 * 只做格式转换，不承载业务逻辑
 */
export class OpenClawBridge {
  private readonly system = getYuanLingSystem();
  private lastContext: YuanLingContext | null = null;

  /**
   * 处理消息
   * 
   * 委托给 YuanLingSystem.processWithExternalExecutor()
   */
  async processMessage(
    userMessage: string,
    sessionHistory: OpenClawMessage[],
    executor: (prompt: string, context: YuanLingContext) => Promise<OpenClawResult>
  ): Promise<{ result: OpenClawResult; context: YuanLingContext }> {
    
    // 转换消息格式
    const adaptedHistory: OpenClawCompatibleMessage[] = sessionHistory.map(item => ({
      role: item.role,
      content: item.content,
    }));

    // 适配执行器
    const adaptedExecutor: ExternalExecutor = async (prompt, context) => {
      const result = await executor(prompt, context);
      return result as YuanLingRunResult;
    };

    // 委托给 YuanLingSystem
    const { result, context: runContext } = await this.system.processWithExternalExecutor(
      userMessage,
      adaptedHistory,
      adaptedExecutor
    );

    this.lastContext = runContext;

    return {
      result: result as OpenClawResult,
      context: runContext,
    };
  }

  /**
   * 获取上次上下文
   */
  getLastContext(): YuanLingContext | null {
    return this.lastContext;
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    return this.system.getStatus();
  }
}

// ============================================================================
// 全局实例
// ============================================================================

let globalBridge: OpenClawBridge | null = null;

export function getOpenClawBridge(): OpenClawBridge {
  if (!globalBridge) {
    globalBridge = new OpenClawBridge();
  }
  return globalBridge;
}

export async function processWithBridge(
  userMessage: string,
  sessionHistory: OpenClawMessage[],
  executor: (prompt: string, context: YuanLingContext) => Promise<OpenClawResult>
): Promise<{ result: OpenClawResult; context: YuanLingContext }> {
  return getOpenClawBridge().processMessage(userMessage, sessionHistory, executor);
}

export default OpenClawBridge;
