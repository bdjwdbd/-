/**
 * 14 层 Middleware 完整实现
 * 
 * 借鉴：DeerFlow 洋葱模型
 * 
 * 架构：
 * Layer 1:  认证中间件（Authentication）
 * Layer 2:  授权中间件（Authorization）
 * Layer 3:  限流中间件（Rate Limiting）
 * Layer 4:  日志中间件（Logging）
 * Layer 5:  追踪中间件（Tracing）
 * Layer 6:  记忆加载中间件（Memory Loading）
 * Layer 7:  上下文构建中间件（Context Building）
 * Layer 8:  意图识别中间件（Intent Recognition）
 * Layer 9:  任务分解中间件（Task Decomposition）
 * Layer 10: 工具选择中间件（Tool Selection）
 * Layer 11: 执行监控中间件（Execution Monitoring）
 * Layer 12: 结果验证中间件（Result Validation）
 * Layer 13: 记忆存储中间件（Memory Storage）
 * Layer 14: 响应格式化中间件（Response Formatting）
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Middleware 上下文
 */
export interface MiddlewareContext {
  /** 请求 ID */
  requestId: string;
  /** Session ID */
  sessionId: string;
  /** 用户 ID */
  userId: string;
  /** 当前状态 */
  state: MiddlewareState;
  /** 原始输入 */
  input: string;
  /** 处理后的输入 */
  processedInput?: string;
  /** 消息历史 */
  messages: Message[];
  /** 工具调用历史 */
  toolCalls: ToolCallRecord[];
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
  nextAction?: 'continue' | 'pause' | 'complete' | 'error' | 'retry';
  /** 响应 */
  response?: {
    content: string;
    success: boolean;
    data?: unknown;
  };
}

/**
 * Middleware 状态
 */
export enum MiddlewareState {
  /** 初始化 */
  INIT = 'init',
  /** 认证中 */
  AUTHENTICATING = 'authenticating',
  /** 授权中 */
  AUTHORIZING = 'authorizing',
  /** 限流检查中 */
  RATE_LIMITING = 'rate_limiting',
  /** 记忆加载中 */
  MEMORY_LOADING = 'memory_loading',
  /** 上下文构建中 */
  CONTEXT_BUILDING = 'context_building',
  /** 意图识别中 */
  INTENT_RECOGNIZING = 'intent_recognizing',
  /** 任务分解中 */
  TASK_DECOMPOSING = 'task_decomposing',
  /** 工具选择中 */
  TOOL_SELECTING = 'tool_selecting',
  /** 执行中 */
  EXECUTING = 'executing',
  /** 验证中 */
  VALIDATING = 'validating',
  /** 记忆存储中 */
  MEMORY_STORING = 'memory_storing',
  /** 格式化中 */
  FORMATTING = 'formatting',
  /** 完成 */
  COMPLETED = 'completed',
  /** 错误 */
  ERROR = 'error'
}

/**
 * 消息类型
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  success: boolean;
  duration: number;
  timestamp: number;
}

/**
 * Middleware 函数
 */
export type Middleware = (
  context: MiddlewareContext,
  next: () => Promise<MiddlewareContext>
) => Promise<MiddlewareContext>;

/**
 * Middleware 配置
 */
export interface MiddlewareConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 超时时间 */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
  /** 自定义配置 */
  options?: Record<string, unknown>;
}

// ============================================================================
// Layer 1: 认证中间件
// ============================================================================

export interface AuthenticationConfig extends MiddlewareConfig {
  /** 认证提供者 */
  provider?: 'jwt' | 'api_key' | 'session' | 'custom';
  /** 自定义验证函数 */
  validateFn?: (userId: string, metadata: Record<string, unknown>) => Promise<boolean>;
}

export function createAuthenticationMiddleware(config: AuthenticationConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.AUTHENTICATING;

    try {
      // 验证用户身份
      const isValid = config.validateFn
        ? await config.validateFn(context.userId, context.metadata)
        : true; // 默认通过

      if (!isValid) {
        context.error = new Error('Authentication failed');
        context.nextAction = 'error';
        return context;
      }

      context.metadata.authenticated = true;
      return next();

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 2: 授权中间件
// ============================================================================

export interface AuthorizationConfig extends MiddlewareConfig {
  /** 权限检查函数 */
  checkPermission?: (
    userId: string,
    action: string,
    resource?: string
  ) => Promise<boolean>;
  /** 默认权限 */
  defaultPermissions?: string[];
}

export function createAuthorizationMiddleware(config: AuthorizationConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.AUTHORIZING;

    try {
      // 检查用户权限
      const hasPermission = config.checkPermission
        ? await config.checkPermission(context.userId, 'execute', context.metadata.resource as string)
        : true; // 默认通过

      if (!hasPermission) {
        context.error = new Error('Authorization failed: insufficient permissions');
        context.nextAction = 'error';
        return context;
      }

      context.metadata.authorized = true;
      return next();

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 3: 限流中间件
// ============================================================================

export interface RateLimitConfig extends MiddlewareConfig {
  /** 时间窗口（毫秒） */
  windowMs?: number;
  /** 最大请求数 */
  maxRequests?: number;
  /** 存储后端 */
  storage?: Map<string, { count: number; resetTime: number }>;
}

export function createRateLimitMiddleware(config: RateLimitConfig = {}): Middleware {
  const storage = config.storage || new Map();
  const windowMs = config.windowMs || 60000; // 1 分钟
  const maxRequests = config.maxRequests || 100;

  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.RATE_LIMITING;

    try {
      const key = context.userId;
      const now = Date.now();
      const record = storage.get(key);

      if (record) {
        // 检查是否在时间窗口内
        if (now < record.resetTime) {
          if (record.count >= maxRequests) {
            context.error = new Error('Rate limit exceeded');
            context.nextAction = 'error';
            context.metadata.rateLimitExceeded = true;
            return context;
          }
          record.count++;
        } else {
          // 重置计数
          record.count = 1;
          record.resetTime = now + windowMs;
        }
      } else {
        // 创建新记录
        storage.set(key, { count: 1, resetTime: now + windowMs });
      }

      context.metadata.rateLimitRemaining = maxRequests - (storage.get(key)?.count || 0);
      return next();

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 4: 日志中间件
// ============================================================================

export interface LoggingConfig extends MiddlewareConfig {
  /** 日志级别 */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** 日志输出函数 */
  logger?: (level: string, message: string, data?: unknown) => void;
  /** 是否记录请求体 */
  logBody?: boolean;
  /** 是否记录响应体 */
  logResponse?: boolean;
}

export function createLoggingMiddleware(config: LoggingConfig = {}): Middleware {
  const logger = config.logger || console.log;
  const level = config.level || 'info';

  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    const startTime = Date.now();
    logger(level, `[Middleware] Request started`, {
      requestId: context.requestId,
      userId: context.userId,
      input: config.logBody ? context.input : undefined
    });

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      logger(level, `[Middleware] Request completed`, {
        requestId: context.requestId,
        duration,
        success: result.response?.success,
        response: config.logResponse ? result.response : undefined
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger('error', `[Middleware] Request failed`, {
        requestId: context.requestId,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
}

// ============================================================================
// Layer 5: 追踪中间件
// ============================================================================

export interface TracingConfig extends MiddlewareConfig {
  /** 追踪 ID 生成函数 */
  generateTraceId?: () => string;
  /** 追踪数据存储 */
  storage?: Map<string, unknown>;
}

export function createTracingMiddleware(config: TracingConfig = {}): Middleware {
  const generateTraceId = config.generateTraceId || (() => 
    `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const storage = config.storage || new Map();

  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    const traceId = generateTraceId();
    context.metadata.traceId = traceId;

    // 记录追踪数据
    const traceData = {
      requestId: context.requestId,
      userId: context.userId,
      startTime: Date.now(),
      events: [] as Array<{ timestamp: number; event: string; data?: unknown }>
    };
    storage.set(traceId, traceData);

    try {
      const result = await next();

      // 更新追踪数据
      const trace = storage.get(traceId) as { events: Array<{ timestamp: number; event: string; data?: unknown }> };
      trace.events.push({
        timestamp: Date.now(),
        event: 'completed'
      });

      return result;

    } catch (error) {
      const trace = storage.get(traceId) as { events: Array<{ timestamp: number; event: string; data?: unknown }> };
      trace.events.push({
        timestamp: Date.now(),
        event: 'error',
        data: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
}

// ============================================================================
// Layer 6: 记忆加载中间件
// ============================================================================

export interface MemoryLoadingConfig extends MiddlewareConfig {
  /** 记忆提供者 */
  memoryProvider?: {
    load: (userId: string, sessionId: string) => Promise<unknown>;
    save: (userId: string, sessionId: string, data: unknown) => Promise<void>;
  };
  /** 加载层级 */
  layers?: ('L0' | 'L1' | 'L2' | 'L3' | 'L4')[];
}

export function createMemoryLoadingMiddleware(config: MemoryLoadingConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.MEMORY_LOADING;

    try {
      if (config.memoryProvider) {
        const memory = await config.memoryProvider.load(context.userId, context.sessionId);
        context.metadata.memory = memory;
        context.metadata.memoryLayers = config.layers || ['L0', 'L1', 'L2'];
      }

      return next();

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      // 记忆加载失败不阻止执行
      context.metadata.memoryLoadError = context.error.message;
      return next();
    }
  };
}

// ============================================================================
// Layer 7: 上下文构建中间件
// ============================================================================

export interface ContextBuildingConfig extends MiddlewareConfig {
  /** 最大上下文长度 */
  maxContextLength?: number;
  /** 上下文构建函数 */
  buildContext?: (
    input: string,
    memory: unknown,
    messages: Message[]
  ) => Promise<string>;
}

export function createContextBuildingMiddleware(config: ContextBuildingConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.CONTEXT_BUILDING;

    try {
      if (config.buildContext) {
        context.processedInput = await config.buildContext(
          context.input,
          context.metadata.memory,
          context.messages
        );
      } else {
        // 默认上下文构建
        context.processedInput = context.input;
      }

      // 检查上下文长度
      const maxLength = config.maxContextLength || 100000;
      if ((context.processedInput?.length || 0) > maxLength) {
        context.processedInput = context.processedInput?.substring(0, maxLength);
        context.metadata.contextTruncated = true;
      }

      return next();

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 8: 意图识别中间件
// ============================================================================

export interface IntentRecognitionConfig extends MiddlewareConfig {
  /** 意图识别函数 */
  recognizeIntent?: (input: string) => Promise<{
    intent: string;
    confidence: number;
    entities?: Record<string, unknown>;
  }>;
  /** 支持的意图列表 */
  supportedIntents?: string[];
}

export function createIntentRecognitionMiddleware(config: IntentRecognitionConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.INTENT_RECOGNIZING;

    try {
      if (config.recognizeIntent) {
        const result = await config.recognizeIntent(context.processedInput || context.input);
        
        context.metadata.intent = result.intent;
        context.metadata.intentConfidence = result.confidence;
        context.metadata.entities = result.entities;

        // 检查意图是否支持
        if (config.supportedIntents && !config.supportedIntents.includes(result.intent)) {
          context.error = new Error(`Unsupported intent: ${result.intent}`);
          context.nextAction = 'error';
          return context;
        }
      }

      return next();

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 9: 任务分解中间件
// ============================================================================

export interface TaskDecompositionConfig extends MiddlewareConfig {
  /** 任务分解函数 */
  decomposeTask?: (input: string, intent: string) => Promise<{
    tasks: Array<{
      id: string;
      description: string;
      dependencies?: string[];
      priority?: number;
    }>;
  }>;
  /** 最大任务数 */
  maxTasks?: number;
}

export function createTaskDecompositionMiddleware(config: TaskDecompositionConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.TASK_DECOMPOSING;

    try {
      if (config.decomposeTask) {
        const result = await config.decomposeTask(
          context.processedInput || context.input,
          context.metadata.intent as string
        );

        // 限制任务数量
        const maxTasks = config.maxTasks || 10;
        context.metadata.tasks = result.tasks.slice(0, maxTasks);
        context.metadata.taskCount = result.tasks.length;
      }

      return next();

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 10: 工具选择中间件
// ============================================================================

export interface ToolSelectionConfig extends MiddlewareConfig {
  /** 工具选择函数 */
  selectTools?: (
    input: string,
    intent: string,
    tasks: unknown
  ) => Promise<Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>>;
  /** 可用工具列表 */
  availableTools?: string[];
}

export function createToolSelectionMiddleware(config: ToolSelectionConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.TOOL_SELECTING;

    try {
      if (config.selectTools) {
        const tools = await config.selectTools(
          context.processedInput || context.input,
          context.metadata.intent as string,
          context.metadata.tasks
        );

        // 过滤不可用的工具
        if (config.availableTools) {
          context.metadata.selectedTools = tools.filter(t => 
            config.availableTools!.includes(t.name)
          );
        } else {
          context.metadata.selectedTools = tools;
        }
      }

      return next();

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 11: 执行监控中间件
// ============================================================================

export interface ExecutionMonitoringConfig extends MiddlewareConfig {
  /** 超时时间 */
  timeout?: number;
  /** 资源监控函数 */
  monitorResources?: () => Promise<{
    cpu: number;
    memory: number;
    disk: number;
  }>;
  /** 资源限制 */
  resourceLimits?: {
    cpu?: number;
    memory?: number;
    disk?: number;
  };
}

export function createExecutionMonitoringMiddleware(config: ExecutionMonitoringConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.EXECUTING;

    const timeout = config.timeout || 60000;
    const startTime = Date.now();

    // 设置超时
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Execution timeout')), timeout);
    });

    try {
      // 执行并监控
      const result = await Promise.race([
        next(),
        timeoutPromise
      ]);

      // 记录资源使用
      if (config.monitorResources) {
        const resources = await config.monitorResources();
        context.metadata.resourceUsage = resources;

        // 检查资源限制
        if (config.resourceLimits) {
          if (config.resourceLimits.cpu && resources.cpu > config.resourceLimits.cpu) {
            context.metadata.resourceExceeded = 'cpu';
          }
          if (config.resourceLimits.memory && resources.memory > config.resourceLimits.memory) {
            context.metadata.resourceExceeded = 'memory';
          }
        }
      }

      context.metadata.executionTime = Date.now() - startTime;
      return result;

    } catch (error) {
      context.metadata.executionTime = Date.now() - startTime;
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 12: 结果验证中间件
// ============================================================================

export interface ResultValidationConfig extends MiddlewareConfig {
  /** 验证函数 */
  validate?: (result: unknown) => Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }>;
  /** 是否自动重试 */
  autoRetry?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
}

export function createResultValidationMiddleware(config: ResultValidationConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    context.state = MiddlewareState.VALIDATING;

    try {
      const result = await next();

      if (config.validate && result.response) {
        const validation = await config.validate(result.response.data);

        if (!validation.valid) {
          context.metadata.validationErrors = validation.errors;
          context.metadata.validationWarnings = validation.warnings;

          if (config.autoRetry && (context.iteration < (config.maxRetries || 3))) {
            context.nextAction = 'retry';
            context.metadata.retryReason = 'validation_failed';
          } else {
            context.error = new Error(`Validation failed: ${validation.errors?.join(', ')}`);
            context.nextAction = 'error';
          }
        }
      }

      return result;

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Layer 13: 记忆存储中间件
// ============================================================================

export interface MemoryStorageConfig extends MiddlewareConfig {
  /** 记忆提供者 */
  memoryProvider?: {
    save: (userId: string, sessionId: string, data: unknown) => Promise<void>;
  };
  /** 存储内容 */
  storeContent?: ('input' | 'output' | 'toolCalls' | 'metadata')[];
}

export function createMemoryStorageMiddleware(config: MemoryStorageConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    const result = await next();

    context.state = MiddlewareState.MEMORY_STORING;

    try {
      if (config.memoryProvider) {
        const data: Record<string, unknown> = {};
        const storeContent = config.storeContent || ['output', 'toolCalls'];

        if (storeContent.includes('input')) {
          data.input = context.input;
        }
        if (storeContent.includes('output') && result.response) {
          data.output = result.response;
        }
        if (storeContent.includes('toolCalls')) {
          data.toolCalls = context.toolCalls;
        }
        if (storeContent.includes('metadata')) {
          data.metadata = context.metadata;
        }

        await config.memoryProvider.save(context.userId, context.sessionId, data);
        context.metadata.memoryStored = true;
      }

      return result;

    } catch (error) {
      // 记忆存储失败不阻止响应
      context.metadata.memoryStoreError = error instanceof Error ? error.message : String(error);
      return result;
    }
  };
}

// ============================================================================
// Layer 14: 响应格式化中间件
// ============================================================================

export interface ResponseFormattingConfig extends MiddlewareConfig {
  /** 格式化函数 */
  format?: (response: unknown) => Promise<{
    content: string;
    success: boolean;
    data?: unknown;
  }>;
  /** 输出格式 */
  outputFormat?: 'json' | 'markdown' | 'text';
}

export function createResponseFormattingMiddleware(config: ResponseFormattingConfig = {}): Middleware {
  return async (context, next) => {
    if (config.enabled === false) {
      return next();
    }

    const result = await next();

    context.state = MiddlewareState.FORMATTING;

    try {
      if (config.format && result.response) {
        result.response = await config.format(result.response.data);
      } else if (result.response) {
        // 默认格式化
        const format = config.outputFormat || 'text';
        
        switch (format) {
          case 'json':
            result.response.content = JSON.stringify(result.response.data, null, 2);
            break;
          case 'markdown':
            result.response.content = `## Result\n\n\`\`\`json\n${JSON.stringify(result.response.data, null, 2)}\n\`\`\``;
            break;
          default:
            result.response.content = String(result.response.data);
        }
      }

      context.state = MiddlewareState.COMPLETED;
      return result;

    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.nextAction = 'error';
      return context;
    }
  };
}

// ============================================================================
// Middleware 管道
// ============================================================================

/**
 * 创建 Middleware 管道
 */
export function createMiddlewarePipeline(middlewares: Middleware[]): Middleware {
  return async (context, next) => {
    let index = 0;

    const dispatch = async (ctx: MiddlewareContext): Promise<MiddlewareContext> => {
      if (index >= middlewares.length) {
        return next ? next() : ctx;
      }

      const middleware = middlewares[index++];
      return middleware(ctx, () => dispatch(ctx));
    };

    return dispatch(context);
  };
}

/**
 * 默认 Middleware 栈
 */
export function createDefaultMiddlewareStack(configs: {
  authentication?: AuthenticationConfig;
  authorization?: AuthorizationConfig;
  rateLimit?: RateLimitConfig;
  logging?: LoggingConfig;
  tracing?: TracingConfig;
  memoryLoading?: MemoryLoadingConfig;
  contextBuilding?: ContextBuildingConfig;
  intentRecognition?: IntentRecognitionConfig;
  taskDecomposition?: TaskDecompositionConfig;
  toolSelection?: ToolSelectionConfig;
  executionMonitoring?: ExecutionMonitoringConfig;
  resultValidation?: ResultValidationConfig;
  memoryStorage?: MemoryStorageConfig;
  responseFormatting?: ResponseFormattingConfig;
} = {}): Middleware[] {
  return [
    createAuthenticationMiddleware(configs.authentication),
    createAuthorizationMiddleware(configs.authorization),
    createRateLimitMiddleware(configs.rateLimit),
    createLoggingMiddleware(configs.logging),
    createTracingMiddleware(configs.tracing),
    createMemoryLoadingMiddleware(configs.memoryLoading),
    createContextBuildingMiddleware(configs.contextBuilding),
    createIntentRecognitionMiddleware(configs.intentRecognition),
    createTaskDecompositionMiddleware(configs.taskDecomposition),
    createToolSelectionMiddleware(configs.toolSelection),
    createExecutionMonitoringMiddleware(configs.executionMonitoring),
    createResultValidationMiddleware(configs.resultValidation),
    createMemoryStorageMiddleware(configs.memoryStorage),
    createResponseFormattingMiddleware(configs.responseFormatting)
  ];
}

// ============================================================================
// 导出
// ============================================================================

export default {
  createAuthenticationMiddleware,
  createAuthorizationMiddleware,
  createRateLimitMiddleware,
  createLoggingMiddleware,
  createTracingMiddleware,
  createMemoryLoadingMiddleware,
  createContextBuildingMiddleware,
  createIntentRecognitionMiddleware,
  createTaskDecompositionMiddleware,
  createToolSelectionMiddleware,
  createExecutionMonitoringMiddleware,
  createResultValidationMiddleware,
  createMemoryStorageMiddleware,
  createResponseFormattingMiddleware,
  createMiddlewarePipeline,
  createDefaultMiddlewareStack
};
