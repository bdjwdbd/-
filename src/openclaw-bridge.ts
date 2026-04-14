/**
 * OpenClaw 桥接层 - 薄适配器
 * 
 * 这是一个薄适配器，将所有逻辑委托给 YuanLingSystem。
 * 
 * 架构原则：
 * - YuanLingSystem 是唯一主入口
 * - 本文件仅作为 OpenClaw 生态的适配层
 * - 禁止在此实现 L1 决策 / L4 验证 / L5 反馈等主逻辑
 * 
 * 流程：
 * 用户消息 → YuanLingSystem.processWithExternalExecutor() → 返回结果
 */

import { 
  YuanLingSystem, 
  getYuanLingSystem,
  Message,
  ProcessingContext,
  ToolCall
} from './yuanling-system';

// ============ 类型定义 ============

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenClawToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface OpenClawResult {
  content: string;
  toolCalls?: OpenClawToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface YuanLingContext {
  // L0 思考结果
  thinking?: {
    depth: string;
    hypotheses: Array<{
      id: string;
      content: string;
      confidence: number;
    }>;
    process: string;
  };
  
  // L1 决策结果
  decision?: {
    type: 'direct_reply' | 'tool_call' | 'search' | 'clarify';
    reasoning: string;
    suggestedTools?: string[];
  };
  
  // L4 验证结果
  validation?: {
    score: number;
    issues: string[];
    passed: boolean;
  };
  
  // L5 反馈结果
  feedback?: {
    suggestions: string[];
    shouldLearn: boolean;
  };
}

// ============ OpenClaw 桥接类（薄适配器）============

export class OpenClawBridge {
  private system: YuanLingSystem;
  private lastContext: YuanLingContext | null = null;

  constructor() {
    // 获取 YuanLingSystem 单例
    this.system = getYuanLingSystem();
  }

  /**
   * 处理用户消息
   * 
   * 委托给 YuanLingSystem.processWithExternalExecutor()
   */
  async processMessage(
    userMessage: string,
    sessionHistory: OpenClawMessage[],
    executor: (prompt: string, context: YuanLingContext) => Promise<OpenClawResult>
  ): Promise<{
    result: OpenClawResult;
    context: YuanLingContext;
  }> {
    // 转换消息格式
    const messages: Message[] = sessionHistory.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 委托给 YuanLingSystem
    const { result, context } = await this.system.processWithExternalExecutor(
      userMessage,
      messages,
      async (prompt: string, ctx: ProcessingContext) => {
        // 转换上下文格式
        const yuanlingContext: YuanLingContext = {
          thinking: ctx.thinking ? {
            depth: ctx.thinking.depth,
            hypotheses: ctx.thinking.hypotheses,
            process: ctx.thinking.process,
          } : undefined,
          decision: ctx.decision,
          validation: ctx.validation,
          feedback: ctx.feedback,
        };

        // 调用外部执行器
        return executor(prompt, yuanlingContext);
      }
    );

    // 转换结果格式
    const yuanlingContext: YuanLingContext = {
      thinking: context.thinking ? {
        depth: context.thinking.depth,
        hypotheses: context.thinking.hypotheses,
        process: context.thinking.process,
      } : undefined,
      decision: context.decision,
      validation: context.validation,
      feedback: context.feedback,
    };

    this.lastContext = yuanlingContext;

    return {
      result: {
        content: result.content,
        toolCalls: result.toolCalls?.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        })),
        usage: result.usage,
      },
      context: yuanlingContext,
    };
  }

  /**
   * 获取上次上下文
   */
  getLastContext(): YuanLingContext | null {
    return this.lastContext;
  }

  /**
   * 仅运行 L0 思考（不执行）
   * 
   * 委托给 YuanLingSystem.thinkOnly()
   */
  async thinkOnly(message: string): Promise<YuanLingContext['thinking']> {
    const result = await this.system.thinkOnly(message);
    
    if (!result) {
      return {
        depth: 'standard',
        hypotheses: [],
        process: '思考未完成',
      };
    }

    return {
      depth: result.depth,
      hypotheses: result.hypotheses,
      process: result.process,
    };
  }

  /**
   * 运行自省检查
   * 
   * 委托给 YuanLingSystem.introspect()
   */
  async introspect(): Promise<string | null> {
    return this.system.introspect();
  }
}

// ============ 全局实例 ============

let globalBridge: OpenClawBridge | null = null;

/**
 * 获取全局桥接实例
 */
export function getOpenClawBridge(): OpenClawBridge {
  if (!globalBridge) {
    globalBridge = new OpenClawBridge();
  }
  return globalBridge;
}

/**
 * 快速处理消息
 * 
 * 委托给 OpenClawBridge.processMessage()
 */
export async function processWithYuanLing(
  message: string,
  sessionHistory: OpenClawMessage[],
  executor: (prompt: string, context: YuanLingContext) => Promise<OpenClawResult>
): Promise<{
  result: OpenClawResult;
  context: YuanLingContext;
}> {
  const bridge = getOpenClawBridge();
  return bridge.processMessage(message, sessionHistory, executor);
}
