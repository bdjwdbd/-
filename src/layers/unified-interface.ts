/**
 * 元灵系统统一层级接口
 * 
 * 定义所有层级必须实现的接口，确保架构一致性
 * 
 * @module layers/unified-interface
 */

// ============ 基础类型 ============

/**
 * 层级标识
 */
export type LayerId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';

/**
 * 层级名称
 */
export type LayerName = 'ling-si' | 'ling-shu' | 'ling-mai' | 'ling-qu' | 'ling-dun' | 'ling-yun' | 'ling-shi' | 'ling-sha';

/**
 * 层级配置基类
 */
export interface LayerConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 层级状态
 */
export interface LayerState {
  /** 层级 ID */
  layerId: LayerId;
  /** 层级名称 */
  layerName: LayerName;
  /** 是否已初始化 */
  initialized: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 最后执行时间 */
  lastExecutionTime?: number;
  /** 执行次数 */
  executionCount: number;
  /** 错误次数 */
  errorCount: number;
}

/**
 * 层级执行上下文
 */
export interface LayerContext {
  /** 会话 ID */
  sessionId: string;
  /** 消息 ID */
  messageId: string;
  /** 用户消息 */
  userMessage: string;
  /** 上一步结果 */
  previousResult?: LayerResult;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 层级执行结果
 */
export interface LayerResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 层级 ID */
  layerId: LayerId;
  /** 结果数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  executionTimeMs: number;
  /** 置信度（0-1） */
  confidence?: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

// ============ 统一层级接口 ============

/**
 * 统一层级接口
 * 
 * 所有层级必须实现此接口
 */
export interface ILayer<TConfig extends LayerConfig = LayerConfig, TResult = unknown> {
  /** 层级 ID */
  readonly layerId: LayerId;
  
  /** 层级名称 */
  readonly layerName: LayerName;
  
  /** 层级描述 */
  readonly description: string;
  
  /** 层级配置 */
  readonly config: TConfig;
  
  /**
   * 初始化层级
   */
  initialize(): Promise<void>;
  
  /**
   * 执行层级逻辑
   */
  execute(context: LayerContext): Promise<LayerResult<TResult>>;
  
  /**
   * 获取层级状态
   */
  getState(): LayerState;
  
  /**
   * 重置层级状态
   */
  reset(): void;
  
  /**
   * 关闭层级
   */
  shutdown(): Promise<void>;
}

// ============ 层级基类 ============

/**
 * 层级基类
 * 
 * 提供通用的层级实现
 */
export abstract class BaseLayer<TConfig extends LayerConfig = LayerConfig, TResult = unknown> 
  implements ILayer<TConfig, TResult> {
  
  abstract readonly layerId: LayerId;
  abstract readonly layerName: LayerName;
  abstract readonly description: string;
  
  protected _config: TConfig;
  protected _initialized: boolean = false;
  protected _executionCount: number = 0;
  protected _errorCount: number = 0;
  protected _lastExecutionTime?: number;
  
  constructor(config: TConfig) {
    this._config = config;
  }
  
  get config(): TConfig {
    return this._config;
  }
  
  async initialize(): Promise<void> {
    if (this._initialized) return;
    await this.onInitialize();
    this._initialized = true;
  }
  
  async execute(context: LayerContext): Promise<LayerResult<TResult>> {
    const startTime = Date.now();
    
    try {
      if (!this._initialized) {
        await this.initialize();
      }
      
      const result = await this.onExecute(context);
      this._executionCount++;
      this._lastExecutionTime = Date.now();
      
      return {
        ...result,
        layerId: this.layerId,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this._errorCount++;
      
      return {
        success: false,
        layerId: this.layerId,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
  
  getState(): LayerState {
    return {
      layerId: this.layerId,
      layerName: this.layerName,
      initialized: this._initialized,
      enabled: this._config.enabled ?? true,
      lastExecutionTime: this._lastExecutionTime,
      executionCount: this._executionCount,
      errorCount: this._errorCount,
    };
  }
  
  reset(): void {
    this._executionCount = 0;
    this._errorCount = 0;
    this._lastExecutionTime = undefined;
  }
  
  async shutdown(): Promise<void> {
    await this.onShutdown();
    this._initialized = false;
  }
  
  /**
   * 子类实现：初始化逻辑
   */
  protected async onInitialize(): Promise<void> {
    // 默认空实现
  }
  
  /**
   * 子类实现：执行逻辑
   */
  protected abstract onExecute(context: LayerContext): Promise<LayerResult<TResult>>;
  
  /**
   * 子类实现：关闭逻辑
   */
  protected async onShutdown(): Promise<void> {
    // 默认空实现
  }
}

// ============ 层级管理器 ============

/**
 * 层级管理器配置
 */
export interface LayerManagerConfig {
  /** 是否按顺序执行 */
  sequential?: boolean;
  /** 是否并行执行 */
  parallel?: boolean;
  /** 错误处理策略 */
  errorStrategy?: 'stop' | 'continue' | 'skip';
}

/**
 * 层级管理器
 * 
 * 管理所有层级的执行
 */
export class LayerManager {
  private layers: Map<LayerId, ILayer> = new Map();
  private config: LayerManagerConfig;
  
  constructor(config: LayerManagerConfig = {}) {
    this.config = {
      sequential: true,
      parallel: false,
      errorStrategy: 'continue',
      ...config,
    };
  }
  
  /**
   * 注册层级
   */
  registerLayer(layer: ILayer): void {
    this.layers.set(layer.layerId, layer);
  }
  
  /**
   * 获取层级
   */
  getLayer<T extends ILayer>(layerId: LayerId): T | undefined {
    return this.layers.get(layerId) as T | undefined;
  }
  
  /**
   * 初始化所有层级
   */
  async initializeAll(): Promise<void> {
    const promises = Array.from(this.layers.values()).map(layer => layer.initialize());
    await Promise.all(promises);
  }
  
  /**
   * 按顺序执行所有层级
   */
  async executeSequential(context: LayerContext): Promise<Map<LayerId, LayerResult>> {
    const results = new Map<LayerId, LayerResult>();
    const order: LayerId[] = ['L6', 'L0', 'L1', 'L2', 'L7', 'L3', 'L4', 'L5'];
    
    let currentContext = context;
    
    for (const layerId of order) {
      const layer = this.layers.get(layerId);
      if (!layer || !layer.config.enabled) continue;
      
      const result = await layer.execute(currentContext);
      results.set(layerId, result);
      
      // 更新上下文
      currentContext = {
        ...currentContext,
        previousResult: result,
      };
      
      // 错误处理
      if (!result.success && this.config.errorStrategy === 'stop') {
        break;
      }
    }
    
    return results;
  }
  
  /**
   * 并行执行所有层级
   */
  async executeParallel(context: LayerContext): Promise<Map<LayerId, LayerResult>> {
    const promises = Array.from(this.layers.entries()).map(async ([layerId, layer]) => {
      if (!layer.config.enabled) return [layerId, null] as [LayerId, LayerResult | null];
      const result = await layer.execute(context);
      return [layerId, result] as [LayerId, LayerResult];
    });
    
    const entries = await Promise.all(promises);
    return new Map(entries.filter(([_, r]) => r !== null) as [LayerId, LayerResult][]);
  }
  
  /**
   * 获取所有层级状态
   */
  getAllStates(): Map<LayerId, LayerState> {
    const states = new Map<LayerId, LayerState>();
    for (const [id, layer] of this.layers) {
      states.set(id, layer.getState());
    }
    return states;
  }
  
  /**
   * 关闭所有层级
   */
  async shutdownAll(): Promise<void> {
    const promises = Array.from(this.layers.values()).map(layer => layer.shutdown());
    await Promise.all(promises);
  }
}

// ============ 层级工厂 ============

/**
 * 层级工厂
 * 
 * 创建层级实例
 */
export class LayerFactory {
  private static instance: LayerFactory;
  private creators: Map<LayerId, () => ILayer> = new Map();
  
  static getInstance(): LayerFactory {
    if (!LayerFactory.instance) {
      LayerFactory.instance = new LayerFactory();
    }
    return LayerFactory.instance;
  }
  
  /**
   * 注册层级创建器
   */
  registerCreator(layerId: LayerId, creator: () => ILayer): void {
    this.creators.set(layerId, creator);
  }
  
  /**
   * 创建层级实例
   */
  createLayer(layerId: LayerId): ILayer | undefined {
    const creator = this.creators.get(layerId);
    return creator?.();
  }
  
  /**
   * 创建所有层级
   */
  createAllLayers(): ILayer[] {
    return Array.from(this.creators.values()).map(creator => creator());
  }
}
