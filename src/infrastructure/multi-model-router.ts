/**
 * 多模型路由优化
 * 
 * 功能：
 * 1. 细粒度任务分类
 * 2. 动态权重调整
 * 3. 成本/质量平衡
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export type TaskType = 
  | 'code_generation'    // 代码生成
  | 'code_review'        // 代码审查
  | 'data_analysis'      // 数据分析
  | 'creative_writing'   // 创意写作
  | 'translation'        // 翻译
  | 'summarization'      // 摘要
  | 'qa'                 // 问答
  | 'planning'           // 规划
  | 'execution'          // 执行
  | 'verification'       // 验证
  | 'general';           // 通用

export type ModelTier = 'strong' | 'balanced' | 'fast';

export interface ModelConfig {
  id: string;
  name: string;
  tier: ModelTier;
  costPerToken: number;    // 每千 token 成本
  qualityScore: number;   // 质量评分 0-1
  speedScore: number;     // 速度评分 0-1
  maxTokens: number;
}

export interface RoutingResult {
  selectedModel: ModelConfig;
  taskType: TaskType;
  confidence: number;
  reasoning: string;
}

export interface RoutingStats {
  totalRequests: number;
  byModel: Record<string, number>;
  byTaskType: Record<string, number>;
  avgCost: number;
  avgQuality: number;
}

// ============ 多模型路由器 ============

export class MultiModelRouter {
  private logger: StructuredLogger;
  
  // 可用模型配置
  private models: ModelConfig[] = [
    { id: 'gpt-4', name: 'GPT-4', tier: 'strong', costPerToken: 0.03, qualityScore: 0.95, speedScore: 0.4, maxTokens: 8192 },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', tier: 'fast', costPerToken: 0.002, qualityScore: 0.75, speedScore: 0.9, maxTokens: 4096 },
    { id: 'claude-3', name: 'Claude 3', tier: 'strong', costPerToken: 0.025, qualityScore: 0.93, speedScore: 0.5, maxTokens: 100000 },
    { id: 'claude-instant', name: 'Claude Instant', tier: 'fast', costPerToken: 0.001, qualityScore: 0.7, speedScore: 0.95, maxTokens: 100000 },
    { id: 'glm-4', name: 'GLM-4', tier: 'balanced', costPerToken: 0.01, qualityScore: 0.85, speedScore: 0.7, maxTokens: 128000 },
  ];
  
  // 任务类型到模型层级的映射
  private static TASK_TIER_MAP: Record<TaskType, ModelTier> = {
    code_generation: 'strong',    // 代码生成需要高质量
    code_review: 'strong',        // 代码审查需要高质量
    data_analysis: 'balanced',    // 数据分析中等即可
    creative_writing: 'strong',   // 创意写作需要高质量
    translation: 'fast',          // 翻译可用快速模型
    summarization: 'fast',        // 摘要可用快速模型
    qa: 'balanced',               // 问答中等即可
    planning: 'strong',           // 规划需要高质量
    execution: 'fast',            // 执行可用快速模型
    verification: 'balanced',     // 验证中等即可
    general: 'balanced',          // 通用中等即可
  };
  
  // 任务分类关键词
  private static TASK_KEYWORDS: Record<TaskType, string[]> = {
    code_generation: ['写代码', '生成代码', '实现', '编写', 'code', 'implement', 'write code'],
    code_review: ['审查', '检查代码', 'review', '代码质量', '优化代码'],
    data_analysis: ['分析', '数据', '统计', 'analyze', 'data', 'statistics'],
    creative_writing: ['写文章', '创作', '故事', 'write', 'create', 'story', 'article'],
    translation: ['翻译', 'translate', '中译英', '英译中'],
    summarization: ['总结', '摘要', '概括', 'summarize', 'summary'],
    qa: ['是什么', '为什么', '如何', 'what', 'why', 'how', '？', '?'],
    planning: ['计划', '规划', '方案', 'plan', 'strategy', 'roadmap'],
    execution: ['执行', '运行', '操作', 'execute', 'run', '操作'],
    verification: ['验证', '检查', '确认', 'verify', 'check', 'validate'],
    general: [],
  };
  
  // 统计数据
  private stats: RoutingStats = {
    totalRequests: 0,
    byModel: {},
    byTaskType: {},
    avgCost: 0,
    avgQuality: 0,
  };
  
  // 动态权重（根据历史表现调整）
  private modelWeights: Record<string, number> = {};
  
  constructor(logger: StructuredLogger) {
    this.logger = logger;
    // 初始化权重
    for (const model of this.models) {
      this.modelWeights[model.id] = 1.0;
    }
  }
  
  /**
   * 路由到最佳模型
   */
  route(
    prompt: string,
    options?: {
      preferQuality?: boolean;
      preferSpeed?: boolean;
      maxCost?: number;
    }
  ): RoutingResult {
    const startTime = Date.now();
    
    // 1. 分类任务类型
    const taskType = this.classifyTask(prompt);
    
    // 2. 获取推荐的模型层级
    const recommendedTier = MultiModelRouter.TASK_TIER_MAP[taskType];
    
    // 3. 筛选候选模型
    let candidates = this.models.filter(m => m.tier === recommendedTier);
    
    // 4. 应用约束条件
    if (options?.maxCost) {
      candidates = candidates.filter(m => m.costPerToken <= options.maxCost!);
    }
    
    if (options?.preferSpeed) {
      candidates = candidates.sort((a, b) => b.speedScore - a.speedScore);
    } else if (options?.preferQuality) {
      candidates = candidates.sort((a, b) => b.qualityScore - a.qualityScore);
    } else {
      // 默认：按综合评分排序
      candidates = candidates.sort((a, b) => {
        const scoreA = this.calculateCompositeScore(a, taskType);
        const scoreB = this.calculateCompositeScore(b, taskType);
        return scoreB - scoreA;
      });
    }
    
    // 5. 选择最佳模型
    const selectedModel = candidates[0] || this.models[0];
    
    // 6. 更新统计
    this.updateStats(selectedModel, taskType);
    
    const result: RoutingResult = {
      selectedModel,
      taskType,
      confidence: this.calculateConfidence(prompt, taskType),
      reasoning: `任务类型: ${taskType}, 推荐层级: ${recommendedTier}, 选择模型: ${selectedModel.name}`,
    };
    
    this.logger.info('MultiModelRouter', 
      `路由完成: ${selectedModel.name} (任务: ${taskType}, 耗时: ${Date.now() - startTime}ms)`
    );
    
    return result;
  }
  
  /**
   * 分类任务类型
   */
  private classifyTask(prompt: string): TaskType {
    const lowerPrompt = prompt.toLowerCase();
    const scores: Record<TaskType, number> = {} as any;
    
    for (const [type, keywords] of Object.entries(MultiModelRouter.TASK_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerPrompt.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      scores[type as TaskType] = score;
    }
    
    // 找到最高分
    let maxScore = 0;
    let bestType: TaskType = 'general';
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestType = type as TaskType;
      }
    }
    
    return bestType;
  }
  
  /**
   * 计算综合评分
   */
  private calculateCompositeScore(model: ModelConfig, taskType: TaskType): number {
    const weight = this.modelWeights[model.id] || 1.0;
    
    // 质量 50%, 速度 30%, 成本 20%
    const qualityWeight = 0.5;
    const speedWeight = 0.3;
    const costWeight = 0.2;
    
    // 成本越低越好，所以取反
    const maxCost = Math.max(...this.models.map(m => m.costPerToken));
    const costScore = 1 - (model.costPerToken / maxCost);
    
    return (
      model.qualityScore * qualityWeight +
      model.speedScore * speedWeight +
      costScore * costWeight
    ) * weight;
  }
  
  /**
   * 计算置信度
   */
  private calculateConfidence(prompt: string, taskType: TaskType): number {
    const keywords = MultiModelRouter.TASK_KEYWORDS[taskType] || [];
    const lowerPrompt = prompt.toLowerCase();
    
    let matchCount = 0;
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    
    // 匹配关键词越多，置信度越高
    return Math.min(1, matchCount / Math.max(1, keywords.length) + 0.3);
  }
  
  /**
   * 更新统计
   */
  private updateStats(model: ModelConfig, taskType: TaskType): void {
    this.stats.totalRequests++;
    this.stats.byModel[model.id] = (this.stats.byModel[model.id] || 0) + 1;
    this.stats.byTaskType[taskType] = (this.stats.byTaskType[taskType] || 0) + 1;
    
    // 更新平均成本和质量
    const totalCost = Object.entries(this.stats.byModel).reduce((sum, [id, count]) => {
      const m = this.models.find(m => m.id === id);
      return sum + (m ? m.costPerToken * count : 0);
    }, 0);
    this.stats.avgCost = totalCost / this.stats.totalRequests;
    
    const totalQuality = Object.entries(this.stats.byModel).reduce((sum, [id, count]) => {
      const m = this.models.find(m => m.id === id);
      return sum + (m ? m.qualityScore * count : 0);
    }, 0);
    this.stats.avgQuality = totalQuality / this.stats.totalRequests;
  }
  
  /**
   * 获取统计信息
   */
  getStats(): RoutingStats {
    return { ...this.stats };
  }
  
  /**
   * 调整模型权重（用于自动调优）
   */
  adjustWeight(modelId: string, delta: number): void {
    const current = this.modelWeights[modelId] || 1.0;
    this.modelWeights[modelId] = Math.max(0.1, Math.min(2.0, current + delta));
    this.logger.info('MultiModelRouter', `调整模型权重: ${modelId} = ${this.modelWeights[modelId].toFixed(2)}`);
  }
  
  /**
   * 添加新模型
   */
  addModel(model: ModelConfig): void {
    this.models.push(model);
    this.modelWeights[model.id] = 1.0;
    this.logger.info('MultiModelRouter', `添加模型: ${model.name}`);
  }
  
  /**
   * 获取所有可用模型
   */
  getAvailableModels(): ModelConfig[] {
    return [...this.models];
  }
}
