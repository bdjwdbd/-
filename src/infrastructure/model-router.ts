/**
 * 模型路由器
 * 
 * 功能：
 * 1. 多模型管理
 * 2. 任务类型路由
 * 3. 负载均衡
 */

// ============================================================
// 类型定义
// ============================================================

export enum TaskType {
  EMBEDDING = 'embedding',
  CHAT = 'chat',
  COMPLETION = 'completion',
  CLASSIFICATION = 'classification',
  SUMMARIZATION = 'summarization',
  TRANSLATION = 'translation',
}

export enum ModelCapability {
  EMBEDDING = 'embedding',
  CHAT = 'chat',
  COMPLETION = 'completion',
  STREAMING = 'streaming',
  VISION = 'vision',
  FUNCTION_CALLING = 'function_calling',
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  maxTokens: number;
  costPerToken: number;
  latency: number;
  quality: number;
}

export interface RoutingDecision {
  model: Model;
  reason: string;
  alternatives: Model[];
}

export interface ModelRouterConfig {
  preferQuality: boolean;
  maxLatency: number;
  maxCost: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: ModelRouterConfig = {
  preferQuality: true,
  maxLatency: 5000,
  maxCost: 0.01,
};

// ============================================================
// 模型路由器
// ============================================================

export class ModelRouter {
  private config: ModelRouterConfig;
  private models: Map<string, Model> = new Map();
  private usageStats: Map<string, { count: number; totalLatency: number; totalCost: number }> = new Map();

  constructor(config: Partial<ModelRouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 注册模型
   */
  registerModel(model: Model): void {
    this.models.set(model.id, model);
    this.usageStats.set(model.id, { count: 0, totalLatency: 0, totalCost: 0 });
  }

  /**
   * 批量注册
   */
  registerModels(models: Model[]): void {
    for (const model of models) {
      this.registerModel(model);
    }
  }

  /**
   * 路由到最佳模型
   */
  route(taskType: TaskType, requirements?: Partial<{
    maxLatency: number;
    maxCost: number;
    minQuality: number;
    capabilities: ModelCapability[];
  }>): RoutingDecision {
    const candidates = this.findCandidates(taskType, requirements);
    
    if (candidates.length === 0) {
      throw new Error(`没有找到支持 ${taskType} 的模型`);
    }

    // 排序候选模型
    const sorted = this.rankModels(candidates, requirements);
    const best = sorted[0];
    const alternatives = sorted.slice(1, 4);

    return {
      model: best,
      reason: this.explainChoice(best, taskType),
      alternatives,
    };
  }

  /**
   * 查找候选模型
   */
  private findCandidates(
    taskType: TaskType,
    requirements?: Partial<{
      maxLatency: number;
      maxCost: number;
      minQuality: number;
      capabilities: ModelCapability[];
    }>
  ): Model[] {
    const candidates: Model[] = [];

    for (const model of this.models.values()) {
      // 检查能力
      if (!this.hasCapability(model, taskType)) {
        continue;
      }

      // 检查额外能力要求
      if (requirements?.capabilities) {
        const hasAll = requirements.capabilities.every(cap =>
          model.capabilities.includes(cap)
        );
        if (!hasAll) continue;
      }

      // 检查延迟
      if (requirements?.maxLatency && model.latency > requirements.maxLatency) {
        continue;
      }

      // 检查成本
      if (requirements?.maxCost && model.costPerToken > requirements.maxCost) {
        continue;
      }

      // 检查质量
      if (requirements?.minQuality && model.quality < requirements.minQuality) {
        continue;
      }

      candidates.push(model);
    }

    return candidates;
  }

  /**
   * 检查能力
   */
  private hasCapability(model: Model, taskType: TaskType): boolean {
    const capabilityMap: Record<TaskType, ModelCapability> = {
      [TaskType.EMBEDDING]: ModelCapability.EMBEDDING,
      [TaskType.CHAT]: ModelCapability.CHAT,
      [TaskType.COMPLETION]: ModelCapability.COMPLETION,
      [TaskType.CLASSIFICATION]: ModelCapability.COMPLETION,
      [TaskType.SUMMARIZATION]: ModelCapability.COMPLETION,
      [TaskType.TRANSLATION]: ModelCapability.COMPLETION,
    };

    return model.capabilities.includes(capabilityMap[taskType]);
  }

  /**
   * 排序模型
   */
  private rankModels(
    models: Model[],
    requirements?: Partial<{ preferQuality: boolean; maxLatency: number; maxCost: number; minQuality: number; capabilities: ModelCapability[] }>
  ): Model[] {
    const preferQuality = requirements?.preferQuality ?? this.config.preferQuality;

    return [...models].sort((a, b) => {
      if (preferQuality) {
        // 优先质量
        if (a.quality !== b.quality) {
          return b.quality - a.quality;
        }
        // 质量相同时，优先低延迟
        return a.latency - b.latency;
      } else {
        // 优先速度
        if (a.latency !== b.latency) {
          return a.latency - b.latency;
        }
        // 延迟相同时，优先高质量
        return b.quality - a.quality;
      }
    });
  }

  /**
   * 解释选择
   */
  private explainChoice(model: Model, taskType: TaskType): string {
    const reasons: string[] = [];
    reasons.push(`支持 ${taskType} 任务`);
    
    if (model.quality >= 0.9) {
      reasons.push('高质量模型');
    } else if (model.latency <= 1000) {
      reasons.push('低延迟模型');
    }
    
    if (model.costPerToken <= 0.0001) {
      reasons.push('低成本');
    }

    return reasons.join('，');
  }

  /**
   * 记录使用
   */
  recordUsage(modelId: string, latency: number, tokens: number): void {
    const stats = this.usageStats.get(modelId);
    if (stats) {
      const model = this.models.get(modelId);
      stats.count++;
      stats.totalLatency += latency;
      stats.totalCost += tokens * (model?.costPerToken || 0);
    }
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): Map<string, {
    count: number;
    avgLatency: number;
    totalCost: number;
  }> {
    const result = new Map();
    
    for (const [id, stats] of this.usageStats) {
      result.set(id, {
        count: stats.count,
        avgLatency: stats.count > 0 ? stats.totalLatency / stats.count : 0,
        totalCost: stats.totalCost,
      });
    }

    return result;
  }

  /**
   * 获取所有模型
   */
  getAllModels(): Model[] {
    return Array.from(this.models.values());
  }

  /**
   * 获取模型
   */
  getModel(id: string): Model | undefined {
    return this.models.get(id);
  }
}
