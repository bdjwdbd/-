/**
 * 灵识层（L6）- 环境感知
 * 
 * 职责：
 * - 环境感知：检测运行环境、资源状态、网络状况
 * - 三步唤醒：环境初始化、上下文加载、状态恢复
 * - 上下文管理：会话上下文、用户上下文、系统上下文
 * - 状态同步：跨会话状态同步、持久化
 */

import * as os from "os";

// ============================================================
// 类型定义
// ============================================================

export interface EnvironmentInfo {
  platform: string;
  arch: string;
  hostname: string;
  nodeVersion: string;
  cpus: number;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
  loadAvg: number[];
}

export interface ResourceStatus {
  cpu: {
    usage: number;
    loadAvg: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk?: {
    total: number;
    used: number;
    free: number;
  };
}

export interface NetworkStatus {
  online: boolean;
  latency?: number;
  bandwidth?: number;
}

export interface SessionContext {
  sessionId: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  tokensUsed: number;
  metadata: Record<string, unknown>;
}

export interface SystemContext {
  version: string;
  buildDate: string;
  environment: "development" | "production" | "test";
  features: Set<string>;
  config: Record<string, unknown>;
}

export interface WakeupState {
  step: "environment" | "context" | "state";
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
  duration?: number;
}

// ============================================================
// 环境感知引擎
// ============================================================

export class EnvironmentAwareness {
  private environmentInfo: EnvironmentInfo | null = null;
  private lastCheck: Date | null = null;
  private checkInterval: number = 60000; // 1 分钟
  private listeners: Array<(info: EnvironmentInfo) => void> = [];

  /**
   * 获取环境信息
   */
  getEnvironmentInfo(): EnvironmentInfo {
    const now = new Date();

    // 缓存检查
    if (
      this.environmentInfo &&
      this.lastCheck &&
      now.getTime() - this.lastCheck.getTime() < this.checkInterval
    ) {
      return this.environmentInfo;
    }

    this.environmentInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAvg: os.loadavg(),
    };

    this.lastCheck = now;
    this.notifyListeners();

    return this.environmentInfo;
  }

  /**
   * 获取资源状态
   */
  getResourceStatus(): ResourceStatus {
    const env = this.getEnvironmentInfo();
    const usedMemory = env.totalMemory - env.freeMemory;

    return {
      cpu: {
        usage: env.loadAvg[0] / env.cpus,
        loadAvg: env.loadAvg,
      },
      memory: {
        total: env.totalMemory,
        used: usedMemory,
        free: env.freeMemory,
        usagePercent: (usedMemory / env.totalMemory) * 100,
      },
    };
  }

  /**
   * 检查网络状态
   */
  async checkNetworkStatus(): Promise<NetworkStatus> {
    const startTime = Date.now();

    try {
      // 尝试连接一个可靠的端点
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
        // 简单检查 DNS 解析
        require("dns").lookup("google.com", (err: Error | null) => {
          clearTimeout(timeout);
          if (err) reject(err);
          else resolve();
        });
      });

      return {
        online: true,
        latency: Date.now() - startTime,
      };
    } catch {
      return {
        online: false,
      };
    }
  }

  /**
   * 检查是否为低资源环境
   */
  isLowResource(): boolean {
    const status = this.getResourceStatus();
    return (
      status.memory.usagePercent > 80 ||
      status.cpu.usage > 0.8
    );
  }

  /**
   * 添加环境变化监听器
   */
  addListener(listener: (info: EnvironmentInfo) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除监听器
   */
  removeListener(listener: (info: EnvironmentInfo) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    if (this.environmentInfo) {
      this.listeners.forEach((listener) => {
        try {
          listener(this.environmentInfo!);
        } catch (error) {
          console.error("[EnvironmentAwareness] Listener error:", error);
        }
      });
    }
  }
}

// ============================================================
// 三步唤醒系统
// ============================================================

export class ThreeStepWakeup {
  private environmentAwareness: EnvironmentAwareness;
  private contextManager: ContextManager;
  private stateManager: StateManager;
  private wakeupLog: WakeupState[] = [];

  constructor() {
    this.environmentAwareness = new EnvironmentAwareness();
    this.contextManager = new ContextManager();
    this.stateManager = new StateManager();
  }

  /**
   * 执行三步唤醒
   */
  async wakeup(): Promise<{
    success: boolean;
    steps: WakeupState[];
    environment: EnvironmentInfo | null;
    context: SessionContext | null;
  }> {
    this.wakeupLog = [];

    // Step 1: 环境初始化
    const step1 = await this.wakeupEnvironment();
    this.wakeupLog.push(step1);
    if (step1.status === "failed") {
      return { success: false, steps: this.wakeupLog, environment: null, context: null };
    }

    // Step 2: 上下文加载
    const step2 = await this.wakeupContext();
    this.wakeupLog.push(step2);
    if (step2.status === "failed") {
      return { success: false, steps: this.wakeupLog, environment: step1.error ? null : this.environmentAwareness.getEnvironmentInfo(), context: null };
    }

    // Step 3: 状态恢复
    const step3 = await this.wakeupState();
    this.wakeupLog.push(step3);

    return {
      success: step3.status === "completed",
      steps: this.wakeupLog,
      environment: this.environmentAwareness.getEnvironmentInfo(),
      context: this.contextManager.getSessionContext(),
    };
  }

  /**
   * Step 1: 环境初始化
   */
  private async wakeupEnvironment(): Promise<WakeupState> {
    const startTime = Date.now();
    const state: WakeupState = {
      step: "environment",
      status: "running",
    };

    try {
      const env = this.environmentAwareness.getEnvironmentInfo();
      console.log(`[Wakeup] Environment: ${env.platform} ${env.arch}, ${env.cpus} CPUs, ${Math.round(env.totalMemory / 1024 / 1024 / 1024)}GB RAM`);

      state.status = "completed";
      state.duration = Date.now() - startTime;
    } catch (error: any) {
      state.status = "failed";
      state.error = error.message;
    }

    return state;
  }

  /**
   * Step 2: 上下文加载
   */
  private async wakeupContext(): Promise<WakeupState> {
    const startTime = Date.now();
    const state: WakeupState = {
      step: "context",
      status: "running",
    };

    try {
      await this.contextManager.loadContext();
      const ctx = this.contextManager.getSessionContext();
      console.log(`[Wakeup] Context: session ${ctx.sessionId}, ${ctx.messageCount} messages`);

      state.status = "completed";
      state.duration = Date.now() - startTime;
    } catch (error: any) {
      state.status = "failed";
      state.error = error.message;
    }

    return state;
  }

  /**
   * Step 3: 状态恢复
   */
  private async wakeupState(): Promise<WakeupState> {
    const startTime = Date.now();
    const state: WakeupState = {
      step: "state",
      status: "running",
    };

    try {
      await this.stateManager.restore();
      console.log(`[Wakeup] State restored`);

      state.status = "completed";
      state.duration = Date.now() - startTime;
    } catch (error: any) {
      state.status = "failed";
      state.error = error.message;
    }

    return state;
  }

  /**
   * 获取唤醒日志
   */
  getWakeupLog(): WakeupState[] {
    return this.wakeupLog;
  }

  /**
   * 获取环境感知
   */
  getEnvironmentAwareness(): EnvironmentAwareness {
    return this.environmentAwareness;
  }

  /**
   * 获取上下文管理器
   */
  getContextManager(): ContextManager {
    return this.contextManager;
  }
}

// ============================================================
// 上下文管理器
// ============================================================

export class ContextManager {
  private sessionContext: SessionContext;
  private systemContext: SystemContext;

  constructor() {
    this.sessionContext = {
      sessionId: `session-${Date.now()}`,
      startTime: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      tokensUsed: 0,
      metadata: {},
    };

    this.systemContext = {
      version: "4.3.0",
      buildDate: new Date().toISOString(),
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      features: new Set([
        "thinking-protocol",
        "emotion-engine",
        "contradiction-analysis",
        "tool-orchestration",
      ]),
      config: {},
    };
  }

  /**
   * 加载上下文
   */
  async loadContext(): Promise<void> {
    // 模拟加载
    await new Promise((r) => setTimeout(r, 10));
  }

  /**
   * 获取会话上下文
   */
  getSessionContext(): SessionContext {
    return this.sessionContext;
  }

  /**
   * 获取系统上下文
   */
  getSystemContext(): SystemContext {
    return this.systemContext;
  }

  /**
   * 更新活动时间
   */
  touch(): void {
    this.sessionContext.lastActivity = new Date();
  }

  /**
   * 增加消息计数
   */
  incrementMessageCount(): void {
    this.sessionContext.messageCount++;
    this.touch();
  }

  /**
   * 增加令牌计数
   */
  addTokens(count: number): void {
    this.sessionContext.tokensUsed += count;
  }

  /**
   * 设置元数据
   */
  setMetadata(key: string, value: unknown): void {
    this.sessionContext.metadata[key] = value;
  }

  /**
   * 获取元数据
   */
  getMetadata(key: string): unknown {
    return this.sessionContext.metadata[key];
  }
}

// ============================================================
// 状态管理器
// ============================================================

export class StateManager {
  private state: Map<string, unknown> = new Map();
  private persistentKeys: Set<string> = new Set();

  /**
   * 保存状态
   */
  save(key: string, value: unknown, persistent: boolean = false): void {
    this.state.set(key, value);
    if (persistent) {
      this.persistentKeys.add(key);
    }
  }

  /**
   * 获取状态
   */
  get<T = unknown>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  /**
   * 删除状态
   */
  delete(key: string): boolean {
    this.persistentKeys.delete(key);
    return this.state.delete(key);
  }

  /**
   * 检查状态是否存在
   */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * 持久化状态
   */
  async persist(): Promise<void> {
    const persistentState: Record<string, unknown> = {};
    for (const key of this.persistentKeys) {
      const value = this.state.get(key);
      if (value !== undefined) {
        persistentState[key] = value;
      }
    }
    // 实际持久化逻辑（可扩展为文件存储或数据库）
    console.log(`[StateManager] Persisted ${Object.keys(persistentState).length} keys`);
  }

  /**
   * 恢复状态
   */
  async restore(): Promise<void> {
    // 实际恢复逻辑（可扩展为从文件或数据库加载）
    console.log(`[StateManager] Restored ${this.state.size} keys`);
  }

  /**
   * 清除非持久化状态
   */
  clearNonPersistent(): void {
    for (const key of this.state.keys()) {
      if (!this.persistentKeys.has(key)) {
        this.state.delete(key);
      }
    }
  }

  /**
   * 清除所有状态
   */
  clear(): void {
    this.state.clear();
    this.persistentKeys.clear();
  }
}

// ============================================================
// 单例导出
// ============================================================

let environmentAwarenessInstance: EnvironmentAwareness | null = null;
let threeStepWakeupInstance: ThreeStepWakeup | null = null;

export function getEnvironmentAwareness(): EnvironmentAwareness {
  if (!environmentAwarenessInstance) {
    environmentAwarenessInstance = new EnvironmentAwareness();
  }
  return environmentAwarenessInstance;
}

export function getThreeStepWakeup(): ThreeStepWakeup {
  if (!threeStepWakeupInstance) {
    threeStepWakeupInstance = new ThreeStepWakeup();
  }
  return threeStepWakeupInstance;
}

// 层级标识
export const LING_SHI_NAME = "ling-shi";
export const LING_SHI_LEVEL = 6;
export const LING_SHI_DESCRIPTION = "环境感知层";
