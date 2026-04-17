/**
 * Session 追加式日志系统
 * 
 * 借鉴来源：Claude Managed Agents
 * 
 * 核心功能：
 * - 追加式日志：所有事件追加记录，不可修改
 * - 检查点机制：定期保存状态，支持恢复
 * - 任务可暂停、中断、恢复
 */

// ============================================================================
// 类型定义
// ============================================================================

export enum SessionState {
  CREATED = 'created',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum EventType {
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  TASK_START = 'task_start',
  TASK_END = 'task_end',
  CHECKPOINT = 'checkpoint',
  ERROR = 'error',
  STATE_CHANGE = 'state_change',
  MESSAGE = 'message',
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result'
}

export interface Event {
  id: string;
  sessionId: string;
  timestamp: number;
  type: EventType;
  data: any;
  metadata?: Record<string, any>;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  timestamp: number;
  state: SessionState;
  snapshot: any;
  description: string;
}

export interface Session {
  id: string;
  state: SessionState;
  createdAt: number;
  updatedAt: number;
  events: Event[];
  checkpoints: Checkpoint[];
  metadata: Record<string, any>;
}

// ============================================================================
// Session 日志管理器
// ============================================================================

export class SessionLogManager {
  private sessions: Map<string, Session> = new Map();
  private eventQueue: Event[] = [];
  private maxEventsPerSession = 10000;
  private maxCheckpointsPerSession = 100;
  private checkpointInterval = 60000; // 1 分钟

  /**
   * 创建 Session
   */
  createSession(metadata: Record<string, any> = {}): Session {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: Session = {
      id,
      state: SessionState.CREATED,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      events: [],
      checkpoints: [],
      metadata
    };

    this.sessions.set(id, session);

    // 记录创建事件
    this.appendEvent(id, EventType.SESSION_START, { metadata });

    return session;
  }

  /**
   * 追加事件
   */
  appendEvent(sessionId: string, type: EventType, data: any, metadata?: Record<string, any>): Event {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const event: Event = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      timestamp: Date.now(),
      type,
      data,
      metadata
    };

    // 追加事件（不可修改）
    session.events.push(event);
    session.updatedAt = Date.now();

    // 限制事件数量
    if (session.events.length > this.maxEventsPerSession) {
      session.events = session.events.slice(-this.maxEventsPerSession);
    }

    return event;
  }

  /**
   * 创建检查点
   */
  createCheckpoint(sessionId: string, description: string = ''): Checkpoint {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const checkpoint: Checkpoint = {
      id: `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      timestamp: Date.now(),
      state: session.state,
      snapshot: this.createSnapshot(session),
      description
    };

    session.checkpoints.push(checkpoint);
    session.updatedAt = Date.now();

    // 限制检查点数量
    if (session.checkpoints.length > this.maxCheckpointsPerSession) {
      session.checkpoints = session.checkpoints.slice(-this.maxCheckpointsPerSession);
    }

    // 记录检查点事件
    this.appendEvent(sessionId, EventType.CHECKPOINT, { checkpointId: checkpoint.id, description });

    return checkpoint;
  }

  /**
   * 创建快照
   */
  private createSnapshot(session: Session): any {
    return {
      state: session.state,
      eventCount: session.events.length,
      lastEvent: session.events[session.events.length - 1],
      metadata: { ...session.metadata }
    };
  }

  /**
   * 恢复到检查点
   */
  restoreToCheckpoint(sessionId: string, checkpointId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const checkpoint = session.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // 恢复状态
    session.state = checkpoint.state;
    session.metadata = { ...checkpoint.snapshot.metadata };
    session.updatedAt = Date.now();

    // 记录恢复事件
    this.appendEvent(sessionId, EventType.STATE_CHANGE, {
      from: SessionState.PAUSED,
      to: checkpoint.state,
      reason: 'restore_from_checkpoint'
    });

    return session;
  }

  /**
   * 更新状态
   */
  updateState(sessionId: string, newState: SessionState): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const oldState = session.state;
    session.state = newState;
    session.updatedAt = Date.now();

    // 记录状态变更事件
    this.appendEvent(sessionId, EventType.STATE_CHANGE, {
      from: oldState,
      to: newState
    });
  }

  /**
   * 获取 Session
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取事件
   */
  getEvents(sessionId: string, type?: EventType): Event[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    if (type) {
      return session.events.filter(e => e.type === type);
    }
    return session.events;
  }

  /**
   * 获取检查点
   */
  getCheckpoints(sessionId: string): Checkpoint[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return session.checkpoints;
  }

  /**
   * 获取最新检查点
   */
  getLatestCheckpoint(sessionId: string): Checkpoint | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.checkpoints.length === 0) return undefined;
    return session.checkpoints[session.checkpoints.length - 1];
  }

  /**
   * 列出所有 Session
   */
  listSessions(state?: SessionState): Session[] {
    const sessions = Array.from(this.sessions.values());
    if (state) {
      return sessions.filter(s => s.state === state);
    }
    return sessions;
  }

  /**
   * 清理过期 Session
   */
  cleanupExpired(maxAge: number = 86400000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.updatedAt > maxAge && 
          (session.state === SessionState.COMPLETED || session.state === SessionState.FAILED)) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ============================================================================
// Session 控制器
// ============================================================================

export class SessionController {
  private logManager: SessionLogManager;
  private autoCheckpoint: boolean;
  private checkpointInterval: NodeJS.Timeout | null = null;

  constructor(autoCheckpoint: boolean = true) {
    this.logManager = new SessionLogManager();
    this.autoCheckpoint = autoCheckpoint;
  }

  /**
   * 启动 Session
   */
  startSession(metadata: Record<string, any> = {}): Session {
    const session = this.logManager.createSession(metadata);
    this.logManager.updateState(session.id, SessionState.RUNNING);

    // 启动自动检查点
    if (this.autoCheckpoint) {
      this.startAutoCheckpoint(session.id);
    }

    return session;
  }

  /**
   * 暂停 Session
   */
  pauseSession(sessionId: string): Session {
    this.logManager.createCheckpoint(sessionId, 'Session paused');
    this.logManager.updateState(sessionId, SessionState.PAUSED);
    this.stopAutoCheckpoint();
    return this.logManager.getSession(sessionId)!;
  }

  /**
   * 恢复 Session
   */
  resumeSession(sessionId: string): Session {
    const session = this.logManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // 恢复到最新检查点
    const latestCheckpoint = this.logManager.getLatestCheckpoint(sessionId);
    if (latestCheckpoint) {
      this.logManager.restoreToCheckpoint(sessionId, latestCheckpoint.id);
    }

    this.logManager.updateState(sessionId, SessionState.RUNNING);

    // 重新启动自动检查点
    if (this.autoCheckpoint) {
      this.startAutoCheckpoint(sessionId);
    }

    return this.logManager.getSession(sessionId)!;
  }

  /**
   * 完成 Session
   */
  completeSession(sessionId: string): Session {
    this.logManager.createCheckpoint(sessionId, 'Session completed');
    this.logManager.updateState(sessionId, SessionState.COMPLETED);
    this.stopAutoCheckpoint();
    return this.logManager.getSession(sessionId)!;
  }

  /**
   * 失败 Session
   */
  failSession(sessionId: string, error: string): Session {
    this.logManager.appendEvent(sessionId, EventType.ERROR, { error });
    this.logManager.updateState(sessionId, SessionState.FAILED);
    this.stopAutoCheckpoint();
    return this.logManager.getSession(sessionId)!;
  }

  /**
   * 记录任务开始
   */
  startTask(sessionId: string, taskName: string, taskData: any): Event {
    return this.logManager.appendEvent(sessionId, EventType.TASK_START, {
      taskName,
      ...taskData
    });
  }

  /**
   * 记录任务结束
   */
  endTask(sessionId: string, taskName: string, result: any): Event {
    return this.logManager.appendEvent(sessionId, EventType.TASK_END, {
      taskName,
      result
    });
  }

  /**
   * 记录消息
   */
  recordMessage(sessionId: string, role: string, content: string): Event {
    return this.logManager.appendEvent(sessionId, EventType.MESSAGE, {
      role,
      content
    });
  }

  /**
   * 记录工具调用
   */
  recordToolCall(sessionId: string, toolName: string, args: any): Event {
    return this.logManager.appendEvent(sessionId, EventType.TOOL_CALL, {
      toolName,
      args
    });
  }

  /**
   * 记录工具结果
   */
  recordToolResult(sessionId: string, toolName: string, result: any): Event {
    return this.logManager.appendEvent(sessionId, EventType.TOOL_RESULT, {
      toolName,
      result
    });
  }

  /**
   * 启动自动检查点
   */
  private startAutoCheckpoint(sessionId: string): void {
    this.stopAutoCheckpoint();
    this.checkpointInterval = setInterval(() => {
      const session = this.logManager.getSession(sessionId);
      if (session && session.state === SessionState.RUNNING) {
        this.logManager.createCheckpoint(sessionId, 'Auto checkpoint');
      }
    }, 60000);
  }

  /**
   * 停止自动检查点
   */
  private stopAutoCheckpoint(): void {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
      this.checkpointInterval = null;
    }
  }

  /**
   * 获取日志管理器
   */
  getLogManager(): SessionLogManager {
    return this.logManager;
  }

  /**
   * 获取统计
   */
  getStats(): {
    totalSessions: number;
    runningSessions: number;
    pausedSessions: number;
    completedSessions: number;
    failedSessions: number;
  } {
    const sessions = this.logManager.listSessions();
    return {
      totalSessions: sessions.length,
      runningSessions: sessions.filter(s => s.state === SessionState.RUNNING).length,
      pausedSessions: sessions.filter(s => s.state === SessionState.PAUSED).length,
      completedSessions: sessions.filter(s => s.state === SessionState.COMPLETED).length,
      failedSessions: sessions.filter(s => s.state === SessionState.FAILED).length
    };
  }
}

// 默认导出
export default SessionController;
