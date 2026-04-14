/**
 * 模型热切换管理器
 * 
 * 功能：
 * 1. 运行时模型切换
 * 2. 模型健康监控
 * 3. 自动降级
 * 4. 模型池管理
 */

// ============================================================
// 类型定义
// ============================================================

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  priority: number;
  maxTokens: number;
  costPerToken: number;
  latency: number; // ms
  capabilities: string[];
  status: 'active' | 'standby' | 'degraded' | 'offline';
}

interface ModelPoolConfig {
  defaultModel: string;
  fallbackModels: string[];
  healthCheckInterval: number;
  autoSwitch: boolean;
  switchThreshold: {
    latency: number;
    errorRate: number;
  };
}

interface ModelStats {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  avgLatency: number;
  lastError: string | null;
  lastSwitch: number;
}

// ============================================================
// 模型池
// ============================================================

export class ModelPool {
  private models: Map<string, ModelConfig> = new Map();
  private stats: Map<string, ModelStats> = new Map();
  private currentModel: string;
  private config: ModelPoolConfig;

  constructor(config?: Partial<ModelPoolConfig>) {
    this.config = {
      defaultModel: 'gpt-4-turbo',
      fallbackModels: ['gpt-3.5-turbo', 'qwen'],
      healthCheckInterval: 60000,
      autoSwitch: true,
      switchThreshold: {
        latency: 5000,
        errorRate: 0.1,
      },
      ...config,
    };
    this.currentModel = this.config.defaultModel;
  }

  /**
   * 注册模型
   */
  registerModel(model: ModelConfig): void {
    this.models.set(model.id, model);
    this.stats.set(model.id, {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      avgLatency: 0,
      lastError: null,
      lastSwitch: 0,
    });
  }

  /**
   * 注销模型
   */
  unregisterModel(modelId: string): void {
    this.models.delete(modelId);
    this.stats.delete(modelId);
  }

  /**
   * 获取当前模型
   */
  getCurrentModel(): ModelConfig | null {
    return this.models.get(this.currentModel) || null;
  }

  /**
   * 切换模型
   */
  switchModel(modelId: string): { success: boolean; previousModel: string; message: string } {
    const targetModel = this.models.get(modelId);
    
    if (!targetModel) {
      return {
        success: false,
        previousModel: this.currentModel,
        message: `Model ${modelId} not found`,
      };
    }

    if (targetModel.status === 'offline') {
      return {
        success: false,
        previousModel: this.currentModel,
        message: `Model ${modelId} is offline`,
      };
    }

    const previousModel = this.currentModel;
    this.currentModel = modelId;

    // 更新统计
    const stats = this.stats.get(modelId);
    if (stats) {
      stats.lastSwitch = Date.now();
    }

    return {
      success: true,
      previousModel,
      message: `Switched from ${previousModel} to ${modelId}`,
    };
  }

  /**
   * 自动切换（基于性能）
   */
  autoSwitch(): string | null {
    if (!this.config.autoSwitch) return null;

    const currentStats = this.stats.get(this.currentModel);
    if (!currentStats) return null;

    // 检查是否需要切换
    const errorRate = currentStats.totalRequests > 0
      ? currentStats.failedRequests / currentStats.totalRequests
      : 0;

    if (
      currentStats.avgLatency > this.config.switchThreshold.latency ||
      errorRate > this.config.switchThreshold.errorRate
    ) {
      // 找到最佳替代模型
      const bestModel = this.findBestModel();
      if (bestModel && bestModel !== this.currentModel) {
        const result = this.switchModel(bestModel);
        return result.success ? bestModel : null;
      }
    }

    return null;
  }

  /**
   * 找到最佳模型
   */
  private findBestModel(): string | null {
    const activeModels = Array.from(this.models.values())
      .filter(m => m.status === 'active' || m.status === 'standby');

    if (activeModels.length === 0) return null;

    // 按优先级和延迟排序
    activeModels.sort((a, b) => {
      const statsA = this.stats.get(a.id);
      const statsB = this.stats.get(b.id);

      const scoreA = a.priority * 0.5 + (100 - (statsA?.avgLatency || 100)) * 0.3 + (100 - a.costPerToken * 1000) * 0.2;
      const scoreB = b.priority * 0.5 + (100 - (statsB?.avgLatency || 100)) * 0.3 + (100 - b.costPerToken * 1000) * 0.2;

      return scoreB - scoreA;
    });

    return activeModels[0].id;
  }

  /**
   * 记录请求结果
   */
  recordRequest(modelId: string, success: boolean, latency: number, error?: string): void {
    const stats = this.stats.get(modelId);
    if (!stats) return;

    stats.totalRequests++;
    if (success) {
      stats.successRequests++;
      stats.avgLatency = (stats.avgLatency * (stats.successRequests - 1) + latency) / stats.successRequests;
    } else {
      stats.failedRequests++;
      stats.lastError = error || 'Unknown error';
    }
  }

  /**
   * 更新模型状态
   */
  updateModelStatus(modelId: string, status: ModelConfig['status']): void {
    const model = this.models.get(modelId);
    if (model) {
      model.status = status;

      // 如果当前模型离线，自动切换
      if (modelId === this.currentModel && status === 'offline') {
        this.autoSwitch();
      }
    }
  }

  /**
   * 获取所有模型
   */
  getModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  /**
   * 获取模型统计
   */
  getModelStats(modelId: string): ModelStats | null {
    return this.stats.get(modelId) || null;
  }

  /**
   * 获取所有统计
   */
  getAllStats(): Map<string, ModelStats> {
    return new Map(this.stats);
  }
}

// ============================================================
// 模型热切换管理器
// ============================================================

export class ModelHotSwapper {
  private pool: ModelPool;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ModelPoolConfig>) {
    this.pool = new ModelPool(config);
  }

  /**
   * 初始化默认模型
   */
  initDefaultModels(): void {
    const defaultModels: ModelConfig[] = [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        priority: 10,
        maxTokens: 128000,
        costPerToken: 0.00001,
        latency: 1500,
        capabilities: ['chat', 'code', 'reasoning'],
        status: 'active',
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        priority: 8,
        maxTokens: 16000,
        costPerToken: 0.000001,
        latency: 500,
        capabilities: ['chat', 'code'],
        status: 'standby',
      },
      {
        id: 'qwen',
        name: 'Qwen',
        provider: 'alibaba',
        priority: 7,
        maxTokens: 32000,
        costPerToken: 0.0000005,
        latency: 300,
        capabilities: ['chat', 'code', 'chinese'],
        status: 'standby',
      },
      {
        id: 'glm-4',
        name: 'GLM-4',
        provider: 'zhipu',
        priority: 6,
        maxTokens: 128000,
        costPerToken: 0.0000003,
        latency: 200,
        capabilities: ['chat', 'chinese'],
        status: 'standby',
      },
    ];

    for (const model of defaultModels) {
      this.pool.registerModel(model);
    }
  }

  /**
   * 启动健康检查
   */
  startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkModelHealth();
    }, 60000);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * 检查模型健康
   */
  private checkModelHealth(): void {
    for (const [id, stats] of this.pool.getAllStats()) {
      const errorRate = stats.totalRequests > 0
        ? stats.failedRequests / stats.totalRequests
        : 0;

      if (errorRate > 0.5) {
        this.pool.updateModelStatus(id, 'degraded');
      } else if (errorRate > 0.8) {
        this.pool.updateModelStatus(id, 'offline');
      }
    }

    // 尝试自动切换
    this.pool.autoSwitch();
  }

  /**
   * 执行请求（带自动切换）
   */
  async execute<T>(requestFn: (model: ModelConfig) => Promise<T>): Promise<T> {
    const model = this.pool.getCurrentModel();
    if (!model) {
      throw new Error('No active model available');
    }

    const start = Date.now();
    try {
      const result = await requestFn(model);
      this.pool.recordRequest(model.id, true, Date.now() - start);
      return result;
    } catch (error) {
      this.pool.recordRequest(model.id, false, Date.now() - start, String(error));
      
      // 尝试切换到备用模型
      const switched = this.pool.autoSwitch();
      if (switched) {
        const newModel = this.pool.getCurrentModel();
        if (newModel) {
          return requestFn(newModel);
        }
      }

      throw error;
    }
  }

  /**
   * 手动切换模型
   */
  switchTo(modelId: string): { success: boolean; message: string } {
    const result = this.pool.switchModel(modelId);
    return {
      success: result.success,
      message: result.message,
    };
  }

  /**
   * 获取当前模型
   */
  getCurrentModel(): ModelConfig | null {
    return this.pool.getCurrentModel();
  }

  /**
   * 获取所有模型
   */
  getModels(): ModelConfig[] {
    return this.pool.getModels();
  }

  /**
   * 获取模型池
   */
  getPool(): ModelPool {
    return this.pool;
  }
}

// ============================================================
// 单例
// ============================================================

let instance: ModelHotSwapper | null = null;

export function getModelHotSwapper(config?: Partial<ModelPoolConfig>): ModelHotSwapper {
  if (!instance) {
    instance = new ModelHotSwapper(config);
    instance.initDefaultModels();
  }
  return instance;
}
