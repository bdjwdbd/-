/**
 * Harness 层 - 编排引擎
 * 
 * 借鉴：Claude Managed Agents + DeerFlow
 * 
 * 核心职责：
 * 1. 调用模型的循环 - Agent Loop
 * 2. 工具路由 - 选择和调用工具
 * 3. 上下文管理 - 构建和维护上下文
 * 4. 错误恢复 - 自动重试和降级
 */

// ============================================================================
// 类型定义
// ============================================================================

import type { SessionLayer, SessionEvent, EventType } from './session-layer';

/**
 * Harness 状态
 */
export enum HarnessState {
  /** 空闲 */
  IDLE = 'idle',
  /** 思考中 */
  THINKING = 'thinking',
  /** 执行工具 */
  EXECUTING = 'executing',
  /** 等待用户 */
  WAITING = 'waiting',
  /** 错误恢复 */
  RECOVERING = 'recovering',
  /** 完成 */
  DONE = 'done'
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 参数 Schema */
  parameters: Record<string, unknown>;
  /** 是否需要确认 */
  requiresConfirmation?: boolean;
  /** 是否危险 */
  isDangerous?: boolean;
  /** 超时时间 */
  timeout?: number;
  /** 重试次数 */
  maxRetries?: number;
}

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  /** 调用 ID */
  callId: string;
  /** 工具名称 */
  toolName: string;
  /** 参数 */
  arguments: Record<string, unknown>;
  /** 上下文 */
  context?: Record<string, unknown>;
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  /** 调用 ID */
  callId: string;
  /** 是否成功 */
  success: boolean;
  /** 结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  duration: number;
  /** 重试次数 */
  retries: number;
}

/**
 * 模型消息
 */
export interface ModelMessage {
  /** 角色 */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** 内容 */
  content: string;
  /** 工具调用（仅 assistant） */
  toolCalls?: ToolCallRequest[];
  /** 工具结果（仅 tool） */
  toolResult?: ToolCallResult;
}

/**
 * 模型响应
 */
export interface ModelResponse {
  /** 内容 */
  content: string;
  /** 工具调用 */
  toolCalls?: ToolCallRequest[];
  /** 是否完成 */
  isComplete: boolean;
  /** Token 使用 */
  tokens?: {
    input: number;
    output: number;
  };
  /** 模型名称 */
  model?: string;
}

/**
 * Middleware 上下文
 */
export interface MiddlewareContext {
  /** Session */
  session: SessionLayer;
  /** 当前状态 */
  state: HarnessState;
  /** 消息历史 */
  messages: ModelMessage[];
  /** 工具调用历史 */
  toolCalls: ToolCallResult[];
  /** 迭代次数 */
  iteration: number;
  /** 最大迭代次数 */
  maxIterations: number;
  /** 开始时间 */
  startTime: number;
  /** 元数据 */
  metadata: Record<string, unknown>;
  /** 错误 */
  error?: Error;
  /** 下一步动作 */
  nextAction?: 'continue' | 'pause' | 'complete' | 'error';
}

/**
 * Middleware 函数
 */
export type Middleware = (
  context: MiddlewareContext,
  next: () => Promise<MiddlewareContext>
) => Promise<MiddlewareContext>;

/**
 * Harness 配置
 */
export interface HarnessConfig {
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 单次迭代超时（毫秒） */
  iterationTimeout?: number;
  /** 总超时（毫秒） */
  totalTimeout?: number;
  /** 工具执行超时（毫秒） */
  toolTimeout?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 模型配置 */
  modelConfig?: {
    name: string;
    temperature?: number;
    maxTokens?: number;
  };
  /** 工具列表 */
  tools?: ToolDefinition[];
}

// ============================================================================
// 14 层 Middleware 实现
// ============================================================================

/**
 * Layer 1: 认证中间件
 */
export const authenticationMiddleware: Middleware = async (context, next) => {
  // 验证 Session 有效性
  if (!context.session || context.session.getState() !== 'running') {
    context.error = new Error('Invalid or inactive session');
    context.nextAction = 'error';
    return context;
  }
  return next();
};

/**
 * Layer 2: 授权中间件
 */
export const authorizationMiddleware: Middleware = async (context, next) => {
  // 检查权限（这里可以集成权限系统）
  // TODO: 实现权限检查
  return next();
};

/**
 * Layer 3: 限流中间件
 */
export const rateLimitMiddleware: Middleware = async (context, next) => {
  // 检查调用频率
  // TODO: 实现限流逻辑
  return next();
};

/**
 * Layer 4: 日志中间件
 */
export const loggingMiddleware: Middleware = async (context, next) => {
  const startTime = Date.now();
  console.log(`[Harness] Iteration ${context.iteration} started`);
  
  try {
    const result = await next();
    const duration = Date.now() - startTime;
    console.log(`[Harness] Iteration ${context.iteration} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Harness] Iteration ${context.iteration} failed after ${duration}ms:`, error);
    throw error;
  }
};

/**
 * Layer 5: 追踪中间件
 */
export const tracingMiddleware: Middleware = async (context, next) => {
  // 添加追踪信息
  context.metadata.traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return next();
};

/**
 * Layer 6: 记忆加载中间件
 */
export const memoryLoadingMiddleware: Middleware = async (context, next) => {
  // 加载三层记忆
  // TODO: 集成记忆系统
  context.metadata.memoryLoaded = true;
  return next();
};

/**
 * Layer 7: 上下文构建中间件
 */
export const contextBuildingMiddleware: Middleware = async (context, next) => {
  // 构建上下文
  // TODO: 实现上下文构建逻辑
  return next();
};

/**
 * Layer 8: 意图识别中间件
 */
export const intentRecognitionMiddleware: Middleware = async (context, next) => {
  // 识别用户意图
  // TODO: 实现意图识别
  return next();
};

/**
 * Layer 9: 任务分解中间件
 */
export const taskDecompositionMiddleware: Middleware = async (context, next) => {
  // 分解复杂任务
  // TODO: 实现任务分解
  return next();
};

/**
 * Layer 10: 工具选择中间件
 */
export const toolSelectionMiddleware: Middleware = async (context, next) => {
  // 选择合适的工具
  // TODO: 实现工具选择逻辑
  return next();
};

/**
 * Layer 11: 执行监控中间件
 */
export const executionMonitoringMiddleware: Middleware = async (context, next) => {
  // 监控执行状态
  // TODO: 实现执行监控
  return next();
};

/**
 * Layer 12: 结果验证中间件
 */
export const resultValidationMiddleware: Middleware = async (context, next) => {
  // 验证执行结果
  // TODO: 实现结果验证
  return next();
};

/**
 * Layer 13: 记忆存储中间件
 */
export const memoryStorageMiddleware: Middleware = async (context, next) => {
  const result = await next();
  
  // 存储执行结果到记忆
  // TODO: 集成记忆系统
  context.metadata.memoryStored = true;
  
  return result;
};

/**
 * Layer 14: 响应格式化中间件
 */
export const responseFormattingMiddleware: Middleware = async (context, next) => {
  const result = await next();
  
  // 格式化响应
  // TODO: 实现响应格式化
  return result;
};

/**
 * 默认 Middleware 栈
 */
export const defaultMiddlewareStack: Middleware[] = [
  authenticationMiddleware,
  authorizationMiddleware,
  rateLimitMiddleware,
  loggingMiddleware,
  tracingMiddleware,
  memoryLoadingMiddleware,
  contextBuildingMiddleware,
  intentRecognitionMiddleware,
  taskDecompositionMiddleware,
  toolSelectionMiddleware,
  executionMonitoringMiddleware,
  resultValidationMiddleware,
  memoryStorageMiddleware,
  responseFormattingMiddleware
];

// ============================================================================
// Harness 层实现
// ============================================================================

/**
 * Harness 层
 * 
 * 核心特性：
 * 1. Agent Loop - 持续调用模型直到任务完成
 * 2. Middleware 洋葱模型 - 14 层中间件处理
 * 3. 工具路由 - 智能选择和调用工具
 * 4. 错误恢复 - 自动重试和降级策略
 */
export class HarnessLayer {
  /** 配置 */
  private readonly config: Required<HarnessConfig>;
  
  /** Middleware 栈 */
  private middlewareStack: Middleware[];
  
  /** 工具注册表 */
  private tools: Map<string, ToolDefinition> = new Map();
  
  /** 工具执行器 */
  private toolExecutors: Map<string, (args: Record<string, unknown>) => Promise<unknown>> = new Map();
  
  /** 当前状态 */
  private state: HarnessState = HarnessState.IDLE;
  
  /** 模型调用函数 */
  private modelCaller?: (messages: ModelMessage[]) => Promise<ModelResponse>;

  constructor(config: HarnessConfig = {}) {
    this.config = {
      maxIterations: config.maxIterations || 50,
      iterationTimeout: config.iterationTimeout || 60000,
      totalTimeout: config.totalTimeout || 3600000,
      toolTimeout: config.toolTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      modelConfig: config.modelConfig || {
        name: 'default',
        temperature: 0.7,
        maxTokens: 4096
      },
      tools: config.tools || []
    };

    this.middlewareStack = [...defaultMiddlewareStack];
    
    // 注册默认工具
    for (const tool of this.config.tools) {
      this.registerTool(tool);
    }
  }

  // ==========================================================================
  // 公共 API
  // ==========================================================================

  /**
   * 注册工具
   */
  registerTool(
    tool: ToolDefinition,
    executor?: (args: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.tools.set(tool.name, tool);
    if (executor) {
      this.toolExecutors.set(tool.name, executor);
    }
  }

  /**
   * 设置模型调用函数
   */
  setModelCaller(caller: (messages: ModelMessage[]) => Promise<ModelResponse>): void {
    this.modelCaller = caller;
  }

  /**
   * 添加 Middleware
   */
  use(middleware: Middleware, position?: number): void {
    if (position !== undefined) {
      this.middlewareStack.splice(position, 0, middleware);
    } else {
      this.middlewareStack.push(middleware);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): HarnessState {
    return this.state;
  }

  /**
   * 获取工具列表
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 执行 Agent Loop
   */
  async run(session: SessionLayer, initialMessage: string): Promise<ModelMessage[]> {
    // 初始化上下文
    let context: MiddlewareContext = {
      session,
      state: HarnessState.IDLE,
      messages: [{
        role: 'user',
        content: initialMessage
      }],
      toolCalls: [],
      iteration: 0,
      maxIterations: this.config.maxIterations,
      startTime: Date.now(),
      metadata: {}
    };

    // 执行 Middleware 洋葱模型
    const executeMiddlewareChain = async (ctx: MiddlewareContext): Promise<MiddlewareContext> => {
      let index = 0;

      const dispatch = async (currentCtx: MiddlewareContext): Promise<MiddlewareContext> => {
        if (index >= this.middlewareStack.length) {
          // 所有 Middleware 执行完毕，执行核心逻辑
          return this.executeCore(currentCtx);
        }

        const middleware = this.middlewareStack[index++];
        return middleware(currentCtx, () => dispatch(currentCtx));
      };

      return dispatch(ctx);
    };

    // Agent Loop
    while (context.iteration < context.maxIterations) {
      context.iteration++;
      context.state = HarnessState.THINKING;

      try {
        // 执行 Middleware 链
        context = await executeMiddlewareChain(context);

        // 检查是否完成
        if (context.nextAction === 'complete' || context.nextAction === 'error') {
          break;
        }

        // 检查超时
        if (Date.now() - context.startTime > this.config.totalTimeout) {
          context.error = new Error('Total timeout exceeded');
          context.nextAction = 'error';
          break;
        }

      } catch (error) {
        context.error = error instanceof Error ? error : new Error(String(error));
        context.state = HarnessState.RECOVERING;

        // 尝试恢复
        if (context.iteration < this.config.maxRetries) {
          console.log(`[Harness] Retrying after error (attempt ${context.iteration})`);
          continue;
        }

        context.nextAction = 'error';
        break;
      }
    }

    context.state = HarnessState.DONE;
    return context.messages;
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 执行核心逻辑
   */
  private async executeCore(context: MiddlewareContext): Promise<MiddlewareContext> {
    if (!this.modelCaller) {
      throw new Error('Model caller not set');
    }

    // 调用模型
    const response = await this.modelCaller(context.messages);

    // 记录 AI 响应
    context.messages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls
    });

    // 处理工具调用
    if (response.toolCalls && response.toolCalls.length > 0) {
      context.state = HarnessState.EXECUTING;

      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        context.toolCalls.push(result);

        context.messages.push({
          role: 'tool',
          content: JSON.stringify(result.result),
          toolResult: result
        });
      }
    }

    // 检查是否完成
    if (response.isComplete) {
      context.nextAction = 'complete';
    } else {
      context.nextAction = 'continue';
    }

    return context;
  }

  /**
   * 执行工具
   */
  private async executeTool(request: ToolCallRequest): Promise<ToolCallResult> {
    const tool = this.tools.get(request.toolName);
    const executor = this.toolExecutors.get(request.toolName);

    if (!tool || !executor) {
      return {
        callId: request.callId,
        success: false,
        error: `Tool not found: ${request.toolName}`,
        duration: 0,
        retries: 0
      };
    }

    const startTime = Date.now();
    let retries = 0;
    let lastError: string | undefined;

    while (retries <= (tool.maxRetries || this.config.maxRetries)) {
      try {
        const result = await Promise.race([
          executor(request.arguments),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Tool timeout')), tool.timeout || this.config.toolTimeout)
          )
        ]);

        return {
          callId: request.callId,
          success: true,
          result,
          duration: Date.now() - startTime,
          retries
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retries++;

        if (retries <= (tool.maxRetries || this.config.maxRetries)) {
          // 指数退避
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retries) * 1000)
          );
        }
      }
    }

    return {
      callId: request.callId,
      success: false,
      error: lastError,
      duration: Date.now() - startTime,
      retries
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

export default HarnessLayer;
