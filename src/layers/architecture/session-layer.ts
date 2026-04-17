/**
 * Session 层 - 会话管理
 * 
 * 借鉴：Claude Managed Agents
 * 
 * 核心职责：
 * 1. append-only 日志 - 所有操作不可变记录
 * 2. 断线重连支持 - 任务可暂停、中断、恢复
 * 3. 历史事件检索 - 按时间、类型、关键词检索
 * 4. 跨会话状态持久化 - Session 独立于模型上下文窗口
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Session 状态
 */
export enum SessionState {
  /** 创建中 */
  CREATING = 'creating',
  /** 运行中 */
  RUNNING = 'running',
  /** 暂停 */
  PAUSED = 'paused',
  /** 完成 */
  COMPLETED = 'completed',
  /** 失败 */
  FAILED = 'failed',
  /** 已取消 */
  CANCELLED = 'cancelled'
}

/**
 * 事件类型
 */
export enum EventType {
  /** 用户消息 */
  USER_MESSAGE = 'user_message',
  /** AI 响应 */
  AI_RESPONSE = 'ai_response',
  /** 工具调用 */
  TOOL_CALL = 'tool_call',
  /** 工具结果 */
  TOOL_RESULT = 'tool_result',
  /** 思考过程 */
  THINKING = 'thinking',
  /** 决策 */
  DECISION = 'decision',
  /** 错误 */
  ERROR = 'error',
  /** 检查点 */
  CHECKPOINT = 'checkpoint',
  /** 状态变更 */
  STATE_CHANGE = 'state_change',
  /** 记忆操作 */
  MEMORY_OP = 'memory_op',
  /** 沙箱操作 */
  SANDBOX_OP = 'sandbox_op'
}

/**
 * 事件基础接口
 */
export interface BaseEvent {
  /** 事件 ID */
  id: string;
  /** 事件类型 */
  type: EventType;
  /** 时间戳 */
  timestamp: number;
  /** Session ID */
  sessionId: string;
  /** 序列号 */
  sequence: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 用户消息事件
 */
export interface UserMessageEvent extends BaseEvent {
  type: EventType.USER_MESSAGE;
  content: string;
  attachments?: Array<{
    type: string;
    url: string;
    name?: string;
  }>;
}

/**
 * AI 响应事件
 */
export interface AIResponseEvent extends BaseEvent {
  type: EventType.AI_RESPONSE;
  content: string;
  model?: string;
  tokens?: {
    input: number;
    output: number;
  };
}

/**
 * 工具调用事件
 */
export interface ToolCallEvent extends BaseEvent {
  type: EventType.TOOL_CALL;
  toolName: string;
  arguments: Record<string, unknown>;
  callId: string;
}

/**
 * 工具结果事件
 */
export interface ToolResultEvent extends BaseEvent {
  type: EventType.TOOL_RESULT;
  callId: string;
  result: unknown;
  success: boolean;
  error?: string;
}

/**
 * 思考事件
 */
export interface ThinkingEvent extends BaseEvent {
  type: EventType.THINKING;
  content: string;
  depth: 'minimal' | 'standard' | 'extensive' | 'deep';
  hypotheses?: string[];
}

/**
 * 决策事件
 */
export interface DecisionEvent extends BaseEvent {
  type: EventType.DECISION;
  decision: string;
  reasoning: string;
  confidence: number;
  alternatives?: string[];
}

/**
 * 错误事件
 */
export interface ErrorEvent extends BaseEvent {
  type: EventType.ERROR;
  error: string;
  stack?: string;
  recoverable: boolean;
}

/**
 * 检查点事件
 */
export interface CheckpointEvent extends BaseEvent {
  type: EventType.CHECKPOINT;
  checkpointId: string;
  state: SessionState;
  summary: string;
}

/**
 * 状态变更事件
 */
export interface StateChangeEvent extends BaseEvent {
  type: EventType.STATE_CHANGE;
  fromState: SessionState;
  toState: SessionState;
  reason: string;
}

/**
 * 记忆操作事件
 */
export interface MemoryOpEvent extends BaseEvent {
  type: EventType.MEMORY_OP;
  operation: 'add' | 'update' | 'delete' | 'search';
  layer: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  key?: string;
  query?: string;
  result?: unknown;
}

/**
 * 沙箱操作事件
 */
export interface SandboxOpEvent extends BaseEvent {
  type: EventType.SANDBOX_OP;
  operation: 'create' | 'execute' | 'destroy' | 'checkpoint';
  sandboxId?: string;
  command?: string;
  result?: unknown;
}

/**
 * 事件联合类型
 */
export type SessionEvent =
  | UserMessageEvent
  | AIResponseEvent
  | ToolCallEvent
  | ToolResultEvent
  | ThinkingEvent
  | DecisionEvent
  | ErrorEvent
  | CheckpointEvent
  | StateChangeEvent
  | MemoryOpEvent
  | SandboxOpEvent;

/**
 * Session 配置
 */
export interface SessionConfig {
  /** Session ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 项目 ID */
  projectId?: string;
  /** 初始状态 */
  initialState?: SessionState;
  /** 最大事件数 */
  maxEvents?: number;
  /** 检查点间隔（事件数） */
  checkpointInterval?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Session 快照
 */
export interface SessionSnapshot {
  /** Session ID */
  id: string;
  /** 当前状态 */
  state: SessionState;
  /** 事件总数 */
  eventCount: number;
  /** 最后事件序列号 */
  lastSequence: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 检查点列表 */
  checkpoints: string[];
  /** 元数据 */
  metadata: Record<string, unknown>;
}

/**
 * 事件查询条件
 */
export interface EventQuery {
  /** 事件类型过滤 */
  types?: EventType[];
  /** 时间范围 */
  timeRange?: {
    start: number;
    end: number;
  };
  /** 序列号范围 */
  sequenceRange?: {
    start: number;
    end: number;
  };
  /** 关键词搜索 */
  keyword?: string;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 逆序 */
  reverse?: boolean;
}

// ============================================================================
// Session 层实现
// ============================================================================

/**
 * Session 层
 * 
 * 核心特性：
 * 1. append-only 日志 - 所有事件不可变追加
 * 2. 检查点机制 - 定期保存状态快照
 * 3. 事件检索 - 支持多维度查询
 * 4. 断线重连 - 可从任意检查点恢复
 */
export class SessionLayer {
  /** Session ID */
  private readonly id: string;
  
  /** 用户 ID */
  private readonly userId: string;
  
  /** 项目 ID */
  private readonly projectId?: string;
  
  /** 当前状态 */
  private state: SessionState;
  
  /** 事件日志 */
  private events: SessionEvent[] = [];
  
  /** 事件序列号 */
  private sequence: number = 0;
  
  /** 检查点列表 */
  private checkpoints: string[] = [];
  
  /** 创建时间 */
  private readonly createdAt: number;
  
  /** 更新时间 */
  private updatedAt: number;
  
  /** 配置 */
  private readonly config: Required<Omit<SessionConfig, 'initialState'>>;
  
  /** 事件监听器 */
  private listeners: Map<EventType, Set<(event: SessionEvent) => void>> = new Map();
  
  /** 状态变更监听器 */
  private stateListeners: Set<(from: SessionState, to: SessionState) => void> = new Set();

  constructor(config: SessionConfig) {
    this.id = config.id;
    this.userId = config.userId;
    this.projectId = config.projectId;
    this.state = config.initialState || SessionState.CREATING;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    
    this.config = {
      id: config.id,
      userId: config.userId,
      projectId: config.projectId || '',
      maxEvents: config.maxEvents || 10000,
      checkpointInterval: config.checkpointInterval || 100,
      timeout: config.timeout || 3600000, // 1 小时
      metadata: config.metadata || {}
    };

    // 初始化事件监听器映射
    for (const type of Object.values(EventType)) {
      this.listeners.set(type, new Set());
    }
  }

  // ==========================================================================
  // 公共 API
  // ==========================================================================

  /**
   * 获取 Session ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * 获取当前状态
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * 获取事件总数
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * 获取快照
   */
  getSnapshot(): SessionSnapshot {
    return {
      id: this.id,
      state: this.state,
      eventCount: this.events.length,
      lastSequence: this.sequence,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      checkpoints: [...this.checkpoints],
      metadata: { ...this.config.metadata }
    };
  }

  /**
   * 追加事件
   */
  appendEvent<T extends SessionEvent>(event: Omit<T, 'id' | 'timestamp' | 'sessionId' | 'sequence'>): T {
    const fullEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
      sessionId: this.id,
      sequence: ++this.sequence
    } as T;

    // 追加到事件日志
    this.events.push(fullEvent);
    this.updatedAt = fullEvent.timestamp;

    // 检查是否需要创建检查点
    if (this.events.length % this.config.checkpointInterval === 0) {
      this.createCheckpoint();
    }

    // 触发事件监听器
    this.emitEvent(fullEvent);

    // 检查事件数量限制
    if (this.events.length > this.config.maxEvents) {
      this.trimEvents();
    }

    return fullEvent;
  }

  /**
   * 查询事件
   */
  queryEvents(query: EventQuery): SessionEvent[] {
    let results = [...this.events];

    // 按类型过滤
    if (query.types && query.types.length > 0) {
      results = results.filter(e => query.types!.includes(e.type));
    }

    // 按时间范围过滤
    if (query.timeRange) {
      results = results.filter(e => 
        e.timestamp >= query.timeRange!.start && 
        e.timestamp <= query.timeRange!.end
      );
    }

    // 按序列号范围过滤
    if (query.sequenceRange) {
      results = results.filter(e => 
        e.sequence >= query.sequenceRange!.start && 
        e.sequence <= query.sequenceRange!.end
      );
    }

    // 关键词搜索
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(e => this.eventContainsKeyword(e, keyword));
    }

    // 排序
    if (query.reverse) {
      results.reverse();
    }

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * 获取指定事件
   */
  getEvent(eventId: string): SessionEvent | undefined {
    return this.events.find(e => e.id === eventId);
  }

  /**
   * 获取指定序列号的事件
   */
  getEventBySequence(sequence: number): SessionEvent | undefined {
    return this.events.find(e => e.sequence === sequence);
  }

  /**
   * 获取最后一个事件
   */
  getLastEvent(): SessionEvent | undefined {
    return this.events[this.events.length - 1];
  }

  /**
   * 创建检查点
   */
  createCheckpoint(summary?: string): CheckpointEvent {
    const checkpointId = this.generateCheckpointId();
    
    const event: CheckpointEvent = {
      id: this.generateEventId(),
      type: EventType.CHECKPOINT,
      timestamp: Date.now(),
      sessionId: this.id,
      sequence: ++this.sequence,
      checkpointId,
      state: this.state,
      summary: summary || `Checkpoint at sequence ${this.sequence}`
    };

    this.events.push(event);
    this.updatedAt = event.timestamp;
    this.checkpoints.push(checkpointId);
    this.emitEvent(event);
    
    return event;
  }

  /**
   * 获取检查点列表
   */
  getCheckpoints(): string[] {
    return [...this.checkpoints];
  }

  /**
   * 从检查点恢复
   */
  restoreFromCheckpoint(checkpointId: string): SessionEvent[] {
    const checkpoint = this.events.find(
      e => e.type === EventType.CHECKPOINT && 
           (e as CheckpointEvent).checkpointId === checkpointId
    ) as CheckpointEvent | undefined;

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // 返回检查点之后的所有事件
    return this.events.filter(e => e.sequence > checkpoint.sequence);
  }

  /**
   * 状态转换
   */
  transitionState(toState: SessionState, reason: string): StateChangeEvent {
    const fromState = this.state;
    
    // 验证状态转换
    if (!this.isValidTransition(fromState, toState)) {
      throw new Error(`Invalid state transition: ${fromState} -> ${toState}`);
    }

    this.state = toState;
    
    const event: StateChangeEvent = {
      id: this.generateEventId(),
      type: EventType.STATE_CHANGE,
      timestamp: Date.now(),
      sessionId: this.id,
      sequence: ++this.sequence,
      fromState,
      toState,
      reason
    };

    this.events.push(event);
    this.updatedAt = event.timestamp;
    this.emitEvent(event);
    this.emitStateChange(fromState, toState);

    return event;
  }

  /**
   * 暂停 Session
   */
  pause(reason: string = 'User requested'): void {
    if (this.state === SessionState.RUNNING) {
      this.transitionState(SessionState.PAUSED, reason);
      this.createCheckpoint('Session paused');
    }
  }

  /**
   * 恢复 Session
   */
  resume(): void {
    if (this.state === SessionState.PAUSED) {
      this.transitionState(SessionState.RUNNING, 'Session resumed');
    }
  }

  /**
   * 完成 Session
   */
  complete(summary?: string): void {
    if (this.state === SessionState.RUNNING || this.state === SessionState.PAUSED) {
      this.transitionState(SessionState.COMPLETED, summary || 'Session completed');
      this.createCheckpoint('Session completed');
    }
  }

  /**
   * 失败 Session
   */
  fail(error: string, recoverable: boolean = false): void {
    if (this.state === SessionState.RUNNING) {
      const errorEvent: ErrorEvent = {
        id: this.generateEventId(),
        type: EventType.ERROR,
        timestamp: Date.now(),
        sessionId: this.id,
        sequence: ++this.sequence,
        error,
        recoverable
      };
      
      this.events.push(errorEvent);
      this.updatedAt = errorEvent.timestamp;
      this.emitEvent(errorEvent);
      
      this.transitionState(
        recoverable ? SessionState.PAUSED : SessionState.FAILED,
        `Error: ${error}`
      );
    }
  }

  /**
   * 取消 Session
   */
  cancel(reason: string = 'User cancelled'): void {
    if (this.state !== SessionState.COMPLETED && this.state !== SessionState.FAILED) {
      this.transitionState(SessionState.CANCELLED, reason);
    }
  }

  // ==========================================================================
  // 事件监听
  // ==========================================================================

  /**
   * 添加事件监听器
   */
  on(type: EventType, listener: (event: SessionEvent) => void): () => void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.add(listener);
    }
    
    // 返回取消订阅函数
    return () => {
      listeners?.delete(listener);
    };
  }

  /**
   * 添加状态变更监听器
   */
  onStateChange(listener: (from: SessionState, to: SessionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 生成事件 ID
   */
  private generateEventId(): string {
    return `evt_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成检查点 ID
   */
  private generateCheckpointId(): string {
    return `ckpt_${this.id}_${Date.now()}`;
  }

  /**
   * 检查事件是否包含关键词
   */
  private eventContainsKeyword(event: SessionEvent, keyword: string): boolean {
    // 搜索事件内容
    const searchFields: string[] = [event.type];
    
    if ('content' in event && typeof event.content === 'string') {
      searchFields.push(event.content);
    }
    if ('error' in event && typeof event.error === 'string') {
      searchFields.push(event.error);
    }
    if ('toolName' in event && typeof event.toolName === 'string') {
      searchFields.push(event.toolName);
    }
    if ('decision' in event && typeof event.decision === 'string') {
      searchFields.push(event.decision);
    }
    if ('summary' in event && typeof event.summary === 'string') {
      searchFields.push(event.summary);
    }

    return searchFields.some(field => 
      field.toLowerCase().includes(keyword)
    );
  }

  /**
   * 验证状态转换
   */
  private isValidTransition(from: SessionState, to: SessionState): boolean {
    const validTransitions: Record<SessionState, SessionState[]> = {
      [SessionState.CREATING]: [SessionState.RUNNING, SessionState.FAILED, SessionState.CANCELLED],
      [SessionState.RUNNING]: [SessionState.PAUSED, SessionState.COMPLETED, SessionState.FAILED, SessionState.CANCELLED],
      [SessionState.PAUSED]: [SessionState.RUNNING, SessionState.COMPLETED, SessionState.FAILED, SessionState.CANCELLED],
      [SessionState.COMPLETED]: [],
      [SessionState.FAILED]: [],
      [SessionState.CANCELLED]: []
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * 触发事件监听器
   */
  private emitEvent(event: SessionEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  /**
   * 触发状态变更监听器
   */
  private emitStateChange(from: SessionState, to: SessionState): void {
    this.stateListeners.forEach(listener => {
      try {
        listener(from, to);
      } catch (error) {
        console.error('State change listener error:', error);
      }
    });
  }

  /**
   * 裁剪事件
   */
  private trimEvents(): void {
    // 保留最近的检查点之后的事件
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
    if (lastCheckpoint) {
      const checkpointEvent = this.events.find(
        e => e.type === EventType.CHECKPOINT && 
             (e as CheckpointEvent).checkpointId === lastCheckpoint
      );
      
      if (checkpointEvent) {
        this.events = this.events.filter(e => e.sequence >= checkpointEvent.sequence);
      }
    } else {
      // 没有检查点，保留最近的一半事件
      const keepCount = Math.floor(this.config.maxEvents * 0.8);
      this.events = this.events.slice(-keepCount);
    }
  }
}

// ============================================================================
// Session 管理器
// ============================================================================

/**
 * Session 管理器配置
 */
export interface SessionManagerConfig {
  /** 最大并发 Session 数 */
  maxConcurrentSessions?: number;
  /** Session 超时时间（毫秒） */
  sessionTimeout?: number;
  /** 检查点间隔（事件数） */
  checkpointInterval?: number;
  /** 最大事件数 */
  maxEvents?: number;
}

/**
 * Session 管理器
 * 
 * 职责：
 * 1. 创建和管理多个 Session
 * 2. Session 生命周期管理
 * 3. 跨 Session 状态持久化
 */
export class SessionManager {
  /** 活跃的 Session */
  private sessions: Map<string, SessionLayer> = new Map();
  
  /** 配置 */
  private readonly config: Required<SessionManagerConfig>;
  
  /** Session 计数器 */
  private sessionCounter: number = 0;

  constructor(config: SessionManagerConfig = {}) {
    this.config = {
      maxConcurrentSessions: config.maxConcurrentSessions || 100,
      sessionTimeout: config.sessionTimeout || 3600000,
      checkpointInterval: config.checkpointInterval || 100,
      maxEvents: config.maxEvents || 10000
    };
  }

  /**
   * 创建新 Session
   */
  createSession(userId: string, projectId?: string, metadata?: Record<string, unknown>): SessionLayer {
    // 检查并发限制
    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      this.cleanupExpiredSessions();
      
      if (this.sessions.size >= this.config.maxConcurrentSessions) {
        throw new Error('Maximum concurrent sessions reached');
      }
    }

    const sessionId = this.generateSessionId();
    const session = new SessionLayer({
      id: sessionId,
      userId,
      projectId,
      maxEvents: this.config.maxEvents,
      checkpointInterval: this.config.checkpointInterval,
      timeout: this.config.sessionTimeout,
      metadata
    });

    this.sessions.set(sessionId, session);
    
    return session;
  }

  /**
   * 获取 Session
   */
  getSession(sessionId: string): SessionLayer | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取用户的所有 Session
   */
  getUserSessions(userId: string): SessionLayer[] {
    return Array.from(this.sessions.values())
      .filter(s => s.getSnapshot().metadata.userId === userId);
  }

  /**
   * 关闭 Session
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.complete('Session closed by manager');
      this.sessions.delete(sessionId);
    }
  }

  /**
   * 关闭所有 Session
   */
  closeAllSessions(): void {
    for (const session of this.sessions.values()) {
      session.complete('All sessions closed');
    }
    this.sessions.clear();
  }

  /**
   * 获取活跃 Session 数量
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 生成 Session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${++this.sessionCounter}`;
  }

  /**
   * 清理过期 Session
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, session] of this.sessions) {
      const snapshot = session.getSnapshot();
      if (now - snapshot.updatedAt > this.config.sessionTimeout) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      this.closeSession(id);
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

export default SessionLayer;
