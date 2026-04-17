/**
 * 三层解耦架构 - 统一接口
 * 
 * 借鉴：Claude Managed Agents
 * 
 * 架构：
 * Session 层（会话管理）→ Harness 层（编排引擎）→ Sandbox 层（执行环境）
 */

// ============================================================================
// 导出
// ============================================================================

// Session 层
export {
  SessionLayer,
  SessionManager,
  SessionState,
  EventType,
  type SessionEvent,
  type UserMessageEvent,
  type AIResponseEvent,
  type ToolCallEvent,
  type ToolResultEvent,
  type ThinkingEvent,
  type DecisionEvent,
  type ErrorEvent,
  type CheckpointEvent,
  type StateChangeEvent,
  type MemoryOpEvent,
  type SandboxOpEvent,
  type SessionConfig,
  type SessionSnapshot,
  type EventQuery
} from './session-layer';

// Harness 层
export {
  HarnessLayer,
  HarnessState,
  type ToolDefinition,
  type ToolCallRequest,
  type ToolCallResult,
  type ModelMessage,
  type ModelResponse,
  type MiddlewareContext,
  type Middleware,
  type HarnessConfig,
  // 14 层 Middleware
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
  responseFormattingMiddleware,
  defaultMiddlewareStack
} from './harness-layer';

// Sandbox 层
export {
  SandboxLayer,
  SandboxManager,
  IsolationLevel,
  SandboxState,
  type ResourceLimits,
  type SandboxConfig,
  type ExecutionRequest,
  type ExecutionResult,
  type SandboxSnapshot,
  type SandboxManagerConfig
} from './sandbox-layer';

// ============================================================================
// 三层架构协调器
// ============================================================================

import { SessionLayer, SessionManager, SessionState } from './session-layer';
import { HarnessLayer, HarnessState, type ModelMessage, type Middleware } from './harness-layer';
import { SandboxLayer, SandboxManager, IsolationLevel, type ResourceLimits } from './sandbox-layer';

/**
 * 三层架构配置
 */
export interface ThreeLayerArchitectureConfig {
  /** Session 管理器配置 */
  session?: {
    maxConcurrentSessions?: number;
    sessionTimeout?: number;
    checkpointInterval?: number;
    maxEvents?: number;
  };
  /** Harness 配置 */
  harness?: {
    maxIterations?: number;
    iterationTimeout?: number;
    totalTimeout?: number;
    toolTimeout?: number;
    maxRetries?: number;
  };
  /** Sandbox 配置 */
  sandbox?: {
    defaultIsolationLevel?: IsolationLevel;
    defaultResources?: ResourceLimits;
    maxSandboxes?: number;
    defaultImage?: string;
  };
  /** 模型调用函数 */
  modelCaller?: (messages: ModelMessage[]) => Promise<{
    content: string;
    toolCalls?: Array<{
      callId: string;
      toolName: string;
      arguments: Record<string, unknown>;
    }>;
    isComplete: boolean;
  }>;
}

/**
 * 三层架构协调器
 * 
 * 职责：
 * 1. 协调 Session/Harness/Sandbox 三层
 * 2. 提供统一的执行入口
 * 3. 管理生命周期
 */
export class ThreeLayerArchitecture {
  /** Session 管理器 */
  private sessionManager: SessionManager;
  
  /** Harness 层 */
  private harness: HarnessLayer;
  
  /** Sandbox 管理器 */
  private sandboxManager: SandboxManager;
  
  /** 配置 */
  private readonly config: ThreeLayerArchitectureConfig;

  constructor(config: ThreeLayerArchitectureConfig = {}) {
    this.config = config;
    
    // 初始化 Session 管理器
    this.sessionManager = new SessionManager(config.session || {});
    
    // 初始化 Harness 层
    this.harness = new HarnessLayer(config.harness || {});
    
    // 初始化 Sandbox 管理器
    this.sandboxManager = new SandboxManager(config.sandbox || {});
    
    // 设置模型调用函数
    if (config.modelCaller) {
      this.harness.setModelCaller(config.modelCaller);
    }
  }

  // ==========================================================================
  // 公共 API
  // ==========================================================================

  /**
   * 执行任务
   */
  async execute(
    userId: string,
    message: string,
    options?: {
      projectId?: string;
      isolationLevel?: IsolationLevel;
      resources?: ResourceLimits;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{
    sessionId: string;
    sandboxId: string;
    messages: ModelMessage[];
    success: boolean;
  }> {
    // 1. 创建 Session
    const session = this.sessionManager.createSession(
      userId,
      options?.projectId,
      options?.metadata
    );

    // 2. 创建 Sandbox
    const sandbox = await this.sandboxManager.createSandbox(
      options?.isolationLevel,
      options?.resources
    );

    // 3. 运行 Harness
    const messages = await this.harness.run(session, message);

    // 4. 完成 Session
    session.complete('Task completed');

    return {
      sessionId: session.getId(),
      sandboxId: sandbox.getId(),
      messages,
      success: session.getState() === SessionState.COMPLETED
    };
  }

  /**
   * 暂停任务
   */
  async pause(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (session) {
      session.pause('User requested pause');
    }
  }

  /**
   * 恢复任务
   */
  async resume(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (session) {
      session.resume();
    }
  }

  /**
   * 取消任务
   */
  async cancel(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (session) {
      session.cancel('User cancelled');
    }
  }

  /**
   * 获取 Session 状态
   */
  getSessionState(sessionId: string): SessionState | undefined {
    const session = this.sessionManager.getSession(sessionId);
    return session?.getState();
  }

  /**
   * 获取 Harness 状态
   */
  getHarnessState(): HarnessState {
    return this.harness.getState();
  }

  /**
   * 获取活跃 Session 数
   */
  getActiveSessionCount(): number {
    return this.sessionManager.getActiveSessionCount();
  }

  /**
   * 获取活跃 Sandbox 数
   */
  getActiveSandboxCount(): number {
    return this.sandboxManager.getActiveSandboxCount();
  }

  /**
   * 注册工具
   */
  registerTool(
    name: string,
    description: string,
    parameters: Record<string, unknown>,
    executor: (args: Record<string, unknown>) => Promise<unknown>,
    options?: {
      requiresConfirmation?: boolean;
      isDangerous?: boolean;
      timeout?: number;
    }
  ): void {
    this.harness.registerTool(
      {
        name,
        description,
        parameters,
        ...options
      },
      executor
    );
  }

  /**
   * 添加 Middleware
   */
  use(middleware: Middleware, position?: number): void {
    this.harness.use(middleware, position);
  }

  /**
   * 关闭所有资源
   */
  async shutdown(): Promise<void> {
    this.sessionManager.closeAllSessions();
    await this.sandboxManager.destroyAllSandboxes();
  }
}

// ============================================================================
// 导出默认
// ============================================================================

export default ThreeLayerArchitecture;
