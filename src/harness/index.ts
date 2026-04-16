/**
 * Harness Engineering - 主入口
 * 
 * 整合所有 Harness 模块：
 * - 状态管理器（State Manager）
 * - 追踪系统（Trace System）
 * - PPAF 闭环（Perception-Planning-Action-Feedback）
 * - 沙盒隔离（Sandbox）
 * - 度量演进（Metrics & Evolution）
 * - Ralph Loop（强制迭代循环）
 * - REPL 容器（带边界控制的执行容器）
 * - Token 流水线（Token 治理）
 * - 熵治理（技术债务清理）
 * 
 * @module harness
 */

// 状态管理器
export * from './state-manager';

// 追踪系统
export * from './trace-system';

// PPAF 闭环
export * from './ppaf';

// 沙盒隔离
export * from './sandbox';

// 度量演进
export * from './metrics';

// Ralph Loop（强制迭代循环）
export * from './ralph-loop';

// REPL 容器（带边界控制的执行容器）
export * from './repl-container';

// Token 流水线（Token 治理）
export * from './token-pipeline';

// 熵治理（技术债务清理）
export * from './entropy-governor';

// ============ Harness 集成系统 ============

import { StateManager, StateCategory } from './state-manager';
import { TraceCollector, Layer, SpanStatus } from './trace-system';

/**
 * Harness 配置
 */
export interface HarnessConfig {
  /** 工作目录 */
  workspaceRoot: string;
  
  /** 是否启用状态管理 */
  enableStateManager: boolean;
  
  /** 是否启用追踪 */
  enableTracing: boolean;
  
  /** 追踪采样率 */
  traceSampleRate: number;
  
  /** 是否启用审计 */
  enableAudit: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  enableStateManager: true,
  enableTracing: true,
  traceSampleRate: 1.0,
  enableAudit: true,
};

/**
 * Harness 系统
 * 
 * 元灵系统的"缰绳"，提供：
 * - 状态外置（无状态原则）
 * - 全链路追踪（可观测性）
 * - 约束与控制（可靠性）
 */
export class HarnessSystem {
  private config: HarnessConfig;
  private _stateManager?: StateManager;
  private _traceCollector?: TraceCollector;
  private initialized: boolean = false;

  constructor(config: Partial<HarnessConfig> = {}) {
    this.config = { ...DEFAULT_HARNESS_CONFIG, ...config };
  }

  /**
   * 初始化 Harness 系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 初始化状态管理器
    if (this.config.enableStateManager) {
      this._stateManager = new StateManager({
        workspaceRoot: this.config.workspaceRoot,
        enableAudit: this.config.enableAudit,
      });
      await this._stateManager.initialize();
    }

    // 初始化追踪系统
    if (this.config.enableTracing) {
      this._traceCollector = new TraceCollector({
        workspaceRoot: this.config.workspaceRoot,
        sampleRate: this.config.traceSampleRate,
        enableDecisionAudit: this.config.enableAudit,
      });
      await this._traceCollector.initialize();
    }

    this.initialized = true;
  }

  /**
   * 获取状态管理器
   */
  get stateManager(): StateManager | undefined {
    return this._stateManager;
  }

  /**
   * 获取追踪收集器
   */
  get traceCollector(): TraceCollector | undefined {
    return this._traceCollector;
  }

  // ============ 状态管理接口 ============

  /**
   * 获取状态
   */
  async getState<T = unknown>(key: string): Promise<T | null> {
    if (!this._stateManager) return null;
    const result = await this._stateManager.get<T>(key);
    return result.success ? result.data || null : null;
  }

  /**
   * 设置状态
   */
  async setState<T = unknown>(
    key: string,
    value: T,
    category: StateCategory = StateCategory.SESSION
  ): Promise<boolean> {
    if (!this._stateManager) return false;
    const result = await this._stateManager.set(key, value, category);
    return result.success;
  }

  /**
   * 删除状态
   */
  async deleteState(key: string): Promise<boolean> {
    if (!this._stateManager) return false;
    const result = await this._stateManager.delete(key);
    return result.success;
  }

  /**
   * 创建检查点
   */
  async createCheckpoint(keys: string[], description?: string): Promise<string | null> {
    if (!this._stateManager) return null;
    const result = await this._stateManager.checkpoint(keys, description);
    return result.success ? result.data || null : null;
  }

  /**
   * 从检查点恢复
   */
  async restoreCheckpoint(checkpointId: string): Promise<number> {
    if (!this._stateManager) return 0;
    const result = await this._stateManager.restore(checkpointId);
    return result.success ? result.data || 0 : 0;
  }

  // ============ 追踪接口 ============

  /**
   * 开始追踪
   */
  startTrace(name: string, metadata?: Record<string, unknown>) {
    if (!this._traceCollector) return null;
    return this._traceCollector.startTrace(name, metadata);
  }

  /**
   * 结束追踪
   */
  endTrace(traceId: string, status: SpanStatus = SpanStatus.COMPLETED) {
    if (!this._traceCollector) return;
    this._traceCollector.endTrace(traceId, status);
  }

  /**
   * 开始跨度
   */
  startSpan(operationName: string, layer: Layer, parentContext?: any) {
    if (!this._traceCollector) return null;
    return this._traceCollector.startSpan(operationName, layer, parentContext);
  }

  /**
   * 结束跨度
   */
  endSpan(spanId: string, status: SpanStatus = SpanStatus.COMPLETED, message?: string) {
    if (!this._traceCollector) return;
    this._traceCollector.endSpan(spanId, status, message);
  }

  /**
   * 记录决策审计
   */
  recordDecision(audit: {
    spanId: string;
    input: unknown;
    reasoning: string;
    output: unknown;
    confidence: number;
    alternatives: Array<{ description: string; probability: number; reason: string }>;
  }): string | null {
    if (!this._traceCollector) return null;
    return this._traceCollector.recordDecisionAudit(audit);
  }

  // ============ PPAF 闭环辅助 ============

  /**
   * 执行带追踪的操作
   */
  async withTracing<T>(
    operationName: string,
    layer: Layer,
    fn: (context: any) => Promise<T>
  ): Promise<T> {
    if (!this._traceCollector) {
      return fn(null);
    }

    // 自动创建追踪
    const traceContext = this._traceCollector.startTrace(operationName);
    const span = this._traceCollector.startSpan(operationName, layer, traceContext);
    
    try {
      const result = await fn(span);
      this._traceCollector.endSpan(span.spanId);
      this._traceCollector.endTrace(traceContext.traceId);
      return result;
    } catch (error) {
      this._traceCollector.endSpan(span.spanId, SpanStatus.FAILED, (error as Error).message);
      this._traceCollector.endTrace(traceContext.traceId, SpanStatus.FAILED);
      throw error;
    }
  }

  /**
   * 执行带状态管理的操作
   */
  async withState<T>(
    stateKey: string,
    fn: () => Promise<T>,
    category: StateCategory = StateCategory.TASK
  ): Promise<T> {
    // 检查是否有缓存状态
    const cached = await this.getState<T>(stateKey);
    if (cached !== null) {
      return cached;
    }

    // 执行操作
    const result = await fn();

    // 保存状态
    await this.setState(stateKey, result, category);

    return result;
  }

  // ============ 状态查询 ============

  /**
   * 获取系统状态
   */
  getStatus(): {
    initialized: boolean;
    stateManager: {
      enabled: boolean;
      stats?: any;
    };
    traceCollector: {
      enabled: boolean;
      stats?: any;
    };
  } {
    return {
      initialized: this.initialized,
      stateManager: {
        enabled: !!this._stateManager,
        stats: this._stateManager?.getStats(),
      },
      traceCollector: {
        enabled: !!this._traceCollector,
        stats: this._traceCollector?.getStats(),
      },
    };
  }

  /**
   * 关闭系统
   */
  async close(): Promise<void> {
    if (this._stateManager) {
      await this._stateManager.close();
    }
    if (this._traceCollector) {
      await this._traceCollector.close();
    }
    this.initialized = false;
  }
}

// ============ 全局实例 ============

let globalHarness: HarnessSystem | null = null;

/**
 * 获取全局 Harness 实例
 */
export function getHarness(config?: Partial<HarnessConfig>): HarnessSystem {
  if (!globalHarness) {
    globalHarness = new HarnessSystem(config);
  }
  return globalHarness;
}

/**
 * 初始化全局 Harness
 */
export async function initializeHarness(
  config?: Partial<HarnessConfig>
): Promise<HarnessSystem> {
  const harness = getHarness(config);
  await harness.initialize();
  return harness;
}
