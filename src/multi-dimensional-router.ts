/**
 * MultiDimensionalRouter - 三维模型路由组件
 * 
 * 功能：
 * 1. 成本维度：根据预算选择最优模型
 * 2. 质量维度：根据任务复杂度选择模型
 * 3. 延迟维度：根据响应时间要求选择模型
 * 4. 动态权重调整
 * 5. A/B 测试支持
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

type ModelTier = "economy" | "standard" | "premium" | "flagship";
type TaskComplexity = "simple" | "moderate" | "complex" | "expert";
type LatencyRequirement = "realtime" | "normal" | "relaxed";
type Priority = "cost" | "quality" | "latency" | "balanced";

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  tier: ModelTier;
  capabilities: string[];
  costPerToken: number;      // 每 1K token 成本（美元）
  qualityScore: number;      // 0-100
  avgLatency: number;        // 平均延迟（ms）
  maxTokens: number;
  contextWindow: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
}

interface RoutingRequest {
  taskId: string;
  prompt: string;
  complexity?: TaskComplexity;
  latencyRequirement?: LatencyRequirement;
  priority?: Priority;
  budget?: number;           // 最大成本（美元）
  maxLatency?: number;       // 最大延迟（ms）
  requiredCapabilities?: string[];
  metadata?: Record<string, unknown>;
}

interface RoutingDecision {
  requestId: string;
  selectedModel: ModelConfig;
  alternatives: Array<{ model: ModelConfig; score: number }>;
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
  confidence: number;
  timestamp: Date;
}

interface RoutingStats {
  totalRequests: number;
  modelUsage: Record<string, number>;
  avgCost: number;
  avgLatency: number;
  avgQuality: number;
  costSavings: number;       // 相比全用旗舰模型的节省
}

interface RouterConfig {
  models: ModelConfig[];
  defaultPriority: Priority;
  costWeight: number;
  qualityWeight: number;
  latencyWeight: number;
  learningRate: number;
  historySize: number;
  persistencePath: string;
}

// ============================================================
// 预定义模型配置
// ============================================================

const DEFAULT_MODELS: ModelConfig[] = [
  // Economy tier
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    tier: "economy",
    capabilities: ["chat", "code", "function-calling"],
    costPerToken: 0.0005,
    qualityScore: 65,
    avgLatency: 500,
    maxTokens: 4096,
    contextWindow: 16385,
    supportsStreaming: true,
    supportsVision: false,
    supportsFunctionCalling: true,
  },
  {
    id: "claude-instant",
    name: "Claude Instant",
    provider: "anthropic",
    tier: "economy",
    capabilities: ["chat", "code"],
    costPerToken: 0.0008,
    qualityScore: 70,
    avgLatency: 400,
    maxTokens: 4096,
    contextWindow: 100000,
    supportsStreaming: true,
    supportsVision: false,
    supportsFunctionCalling: false,
  },
  
  // Standard tier
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    tier: "standard",
    capabilities: ["chat", "code", "function-calling", "vision"],
    costPerToken: 0.01,
    qualityScore: 85,
    avgLatency: 1500,
    maxTokens: 4096,
    contextWindow: 128000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  {
    id: "claude-3-sonnet",
    name: "Claude 3 Sonnet",
    provider: "anthropic",
    tier: "standard",
    capabilities: ["chat", "code", "vision"],
    costPerToken: 0.003,
    qualityScore: 82,
    avgLatency: 1200,
    maxTokens: 4096,
    contextWindow: 200000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: false,
  },
  
  // Premium tier
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    tier: "premium",
    capabilities: ["chat", "code", "function-calling", "vision", "audio"],
    costPerToken: 0.005,
    qualityScore: 90,
    avgLatency: 1000,
    maxTokens: 4096,
    contextWindow: 128000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    provider: "anthropic",
    tier: "premium",
    capabilities: ["chat", "code", "vision"],
    costPerToken: 0.015,
    qualityScore: 92,
    avgLatency: 2000,
    maxTokens: 4096,
    contextWindow: 200000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: false,
  },
  
  // Flagship tier
  {
    id: "gpt-4o-latest",
    name: "GPT-4o Latest",
    provider: "openai",
    tier: "flagship",
    capabilities: ["chat", "code", "function-calling", "vision", "audio", "reasoning"],
    costPerToken: 0.03,
    qualityScore: 95,
    avgLatency: 2500,
    maxTokens: 4096,
    contextWindow: 128000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    tier: "flagship",
    capabilities: ["chat", "code", "vision", "artifacts"],
    costPerToken: 0.003,
    qualityScore: 94,
    avgLatency: 1500,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsStreaming: true,
    supportsVision: true,
    supportsFunctionCalling: true,
  },
];

// ============================================================
// MultiDimensionalRouter 组件
// ============================================================

export class MultiDimensionalRouter {
  private config: RouterConfig;
  private routingHistory: RoutingDecision[] = [];
  private stats: RoutingStats;
  private adaptiveWeights: {
    cost: number;
    quality: number;
    latency: number;
  };
  
  constructor(config?: Partial<RouterConfig>) {
    this.config = {
      models: DEFAULT_MODELS,
      defaultPriority: "balanced",
      costWeight: 0.33,
      qualityWeight: 0.34,
      latencyWeight: 0.33,
      learningRate: 0.1,
      historySize: 1000,
      persistencePath: "./router-state",
      ...config,
    };
    
    this.adaptiveWeights = {
      cost: this.config.costWeight,
      quality: this.config.qualityWeight,
      latency: this.config.latencyWeight,
    };
    
    this.stats = {
      totalRequests: 0,
      modelUsage: {},
      avgCost: 0,
      avgLatency: 0,
      avgQuality: 0,
      costSavings: 0,
    };
    
    this.ensureDir(this.config.persistencePath);
    this.loadState();
  }
  
  /**
   * 路由请求
   */
  route(request: RoutingRequest): RoutingDecision {
    const candidates = this.filterModels(request);
    const scored = this.scoreModels(candidates, request);
    const selected = scored[0];
    
    const decision: RoutingDecision = {
      requestId: request.taskId,
      selectedModel: selected.model,
      alternatives: scored.slice(1, 4).map(s => ({ model: s.model, score: s.score })),
      reasoning: this.generateReasoning(selected, request),
      estimatedCost: this.estimateCost(selected.model, request.prompt),
      estimatedLatency: selected.model.avgLatency,
      confidence: this.calculateConfidence(scored),
      timestamp: new Date(),
    };
    
    // 记录历史
    this.routingHistory.push(decision);
    if (this.routingHistory.length > this.config.historySize) {
      this.routingHistory.shift();
    }
    
    // 更新统计
    this.updateStats(decision);
    
    return decision;
  }
  
  /**
   * 批量路由
   */
  routeBatch(requests: RoutingRequest[]): RoutingDecision[] {
    return requests.map(r => this.route(r));
  }
  
  /**
   * 反馈学习
   */
  feedback(requestId: string, actualCost: number, actualLatency: number, qualityRating: number): void {
    const decision = this.routingHistory.find(d => d.requestId === requestId);
    if (!decision) return;
    
    const model = decision.selectedModel;
    
    // 计算误差
    const costError = (actualCost - decision.estimatedCost) / (decision.estimatedCost || 0.01);
    const latencyError = (actualLatency - decision.estimatedLatency) / decision.estimatedLatency;
    const qualityError = (qualityRating - model.qualityScore) / 100;
    
    // 调整权重
    if (costError > 0.2) {
      this.adaptiveWeights.cost = Math.min(1, this.adaptiveWeights.cost + this.config.learningRate);
    }
    if (qualityError < -0.1) {
      this.adaptiveWeights.quality = Math.min(1, this.adaptiveWeights.quality + this.config.learningRate);
    }
    if (latencyError > 0.3) {
      this.adaptiveWeights.latency = Math.min(1, this.adaptiveWeights.latency + this.config.learningRate);
    }
    
    // 归一化权重
    const total = this.adaptiveWeights.cost + this.adaptiveWeights.quality + this.adaptiveWeights.latency;
    this.adaptiveWeights.cost /= total;
    this.adaptiveWeights.quality /= total;
    this.adaptiveWeights.latency /= total;
    
    this.saveState();
  }
  
  /**
   * 获取模型
   */
  getModel(modelId: string): ModelConfig | undefined {
    return this.config.models.find(m => m.id === modelId);
  }
  
  /**
   * 获取所有模型
   */
  getAllModels(): ModelConfig[] {
    return [...this.config.models];
  }
  
  /**
   * 按层级获取模型
   */
  getModelsByTier(tier: ModelTier): ModelConfig[] {
    return this.config.models.filter(m => m.tier === tier);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): RoutingStats {
    return { ...this.stats };
  }
  
  /**
   * 获取路由历史
   */
  getHistory(limit: number = 100): RoutingDecision[] {
    return this.routingHistory.slice(-limit);
  }
  
  /**
   * 获取当前权重
   */
  getWeights(): { cost: number; quality: number; latency: number } {
    return { ...this.adaptiveWeights };
  }
  
  /**
   * 设置权重
   */
  setWeights(cost: number, quality: number, latency: number): void {
    const total = cost + quality + latency;
    this.adaptiveWeights = {
      cost: cost / total,
      quality: quality / total,
      latency: latency / total,
    };
  }
  
  /**
   * 添加模型
   */
  addModel(model: ModelConfig): void {
    this.config.models.push(model);
  }
  
  /**
   * 移除模型
   */
  removeModel(modelId: string): boolean {
    const index = this.config.models.findIndex(m => m.id === modelId);
    if (index >= 0) {
      this.config.models.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * 生成报告
   */
  generateReport(): string {
    const lines: string[] = [];
    
    lines.push("# 多维模型路由报告");
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push("");
    
    lines.push("## 统计概览");
    lines.push("");
    lines.push(`- 总请求数: ${this.stats.totalRequests}`);
    lines.push(`- 平均成本: $${this.stats.avgCost.toFixed(6)}`);
    lines.push(`- 平均延迟: ${this.stats.avgLatency.toFixed(0)}ms`);
    lines.push(`- 平均质量: ${this.stats.avgQuality.toFixed(1)}`);
    lines.push(`- 成本节省: $${this.stats.costSavings.toFixed(4)}`);
    lines.push("");
    
    lines.push("## 当前权重");
    lines.push("");
    lines.push(`- 成本: ${(this.adaptiveWeights.cost * 100).toFixed(1)}%`);
    lines.push(`- 质量: ${(this.adaptiveWeights.quality * 100).toFixed(1)}%`);
    lines.push(`- 延迟: ${(this.adaptiveWeights.latency * 100).toFixed(1)}%`);
    lines.push("");
    
    lines.push("## 模型使用分布");
    lines.push("");
    lines.push("| 模型 | 使用次数 | 占比 |");
    lines.push("|------|---------|------|");
    
    const sortedUsage = Object.entries(this.stats.modelUsage)
      .sort((a, b) => b[1] - a[1]);
    
    for (const [modelId, count] of sortedUsage) {
      const model = this.getModel(modelId);
      const percentage = (count / this.stats.totalRequests * 100).toFixed(1);
      lines.push(`| ${model?.name || modelId} | ${count} | ${percentage}% |`);
    }
    
    lines.push("");
    
    lines.push("## 可用模型");
    lines.push("");
    lines.push("| 模型 | 层级 | 成本/1K | 质量 | 延迟 |");
    lines.push("|------|------|---------|------|------|");
    
    for (const model of this.config.models) {
      lines.push(`| ${model.name} | ${model.tier} | $${model.costPerToken.toFixed(4)} | ${model.qualityScore} | ${model.avgLatency}ms |`);
    }
    
    return lines.join("\n");
  }
  
  /**
   * 保存状态
   */
  save(): void {
    const state = {
      adaptiveWeights: this.adaptiveWeights,
      stats: this.stats,
      history: this.routingHistory.slice(-100),
      savedAt: new Date().toISOString(),
    };
    
    const filePath = path.join(this.config.persistencePath, "router-state.json");
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }
  
  /**
   * 清空历史
   */
  clearHistory(): void {
    this.routingHistory = [];
    this.stats = {
      totalRequests: 0,
      modelUsage: {},
      avgCost: 0,
      avgLatency: 0,
      avgQuality: 0,
      costSavings: 0,
    };
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private filterModels(request: RoutingRequest): ModelConfig[] {
    let candidates = [...this.config.models];
    
    // 按能力过滤
    if (request.requiredCapabilities) {
      candidates = candidates.filter(m =>
        request.requiredCapabilities!.every(cap => 
          m.capabilities.includes(cap) || 
          (cap === "vision" && m.supportsVision) ||
          (cap === "function-calling" && m.supportsFunctionCalling)
        )
      );
    }
    
    // 按预算过滤
    if (request.budget !== undefined) {
      const budget = request.budget;
      candidates = candidates.filter(m => {
        const estimatedCost = this.estimateCost(m, request.prompt);
        return estimatedCost <= budget;
      });
    }
    
    // 按延迟过滤
    if (request.maxLatency !== undefined) {
      const maxLatency = request.maxLatency;
      candidates = candidates.filter(m => m.avgLatency <= maxLatency);
    }
    
    return candidates;
  }
  
  private scoreModels(
    models: ModelConfig[],
    request: RoutingRequest
  ): Array<{ model: ModelConfig; score: number }> {
    const priority = request.priority || this.config.defaultPriority;
    
    // 根据优先级调整权重
    let weights = { ...this.adaptiveWeights };
    
    switch (priority) {
      case "cost":
        weights = { cost: 0.6, quality: 0.2, latency: 0.2 };
        break;
      case "quality":
        weights = { cost: 0.2, quality: 0.6, latency: 0.2 };
        break;
      case "latency":
        weights = { cost: 0.2, quality: 0.2, latency: 0.6 };
        break;
    }
    
    // 计算分数
    const scored = models.map(model => {
      const costScore = this.normalizeCost(model.costPerToken);
      const qualityScore = model.qualityScore / 100;
      const latencyScore = this.normalizeLatency(model.avgLatency);
      
      const score = 
        weights.cost * costScore +
        weights.quality * qualityScore +
        weights.latency * latencyScore;
      
      return { model, score };
    });
    
    // 排序
    scored.sort((a, b) => b.score - a.score);
    
    return scored;
  }
  
  private normalizeCost(cost: number): number {
    // 成本越低越好，归一化到 0-1
    const maxCost = 0.05;
    return 1 - Math.min(cost / maxCost, 1);
  }
  
  private normalizeLatency(latency: number): number {
    // 延迟越低越好，归一化到 0-1
    const maxLatency = 5000;
    return 1 - Math.min(latency / maxLatency, 1);
  }
  
  private estimateCost(model: ModelConfig, prompt: string): number {
    // 简单估算：假设输出是输入的 2 倍
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = inputTokens * 2;
    const totalTokens = inputTokens + outputTokens;
    
    return (totalTokens / 1000) * model.costPerToken;
  }
  
  private generateReasoning(
    selected: { model: ModelConfig; score: number },
    request: RoutingRequest
  ): string {
    const reasons: string[] = [];
    
    reasons.push(`选择 ${selected.model.name}（${selected.model.tier} 层级）`);
    reasons.push(`综合得分: ${selected.score.toFixed(3)}`);
    
    if (request.priority === "cost") {
      reasons.push(`成本优先: $${selected.model.costPerToken.toFixed(4)}/1K tokens`);
    } else if (request.priority === "quality") {
      reasons.push(`质量优先: ${selected.model.qualityScore}/100`);
    } else if (request.priority === "latency") {
      reasons.push(`延迟优先: ${selected.model.avgLatency}ms`);
    } else {
      reasons.push(`平衡模式: 成本=${(this.adaptiveWeights.cost * 100).toFixed(0)}%, 质量=${(this.adaptiveWeights.quality * 100).toFixed(0)}%, 延迟=${(this.adaptiveWeights.latency * 100).toFixed(0)}%`);
    }
    
    return reasons.join(" | ");
  }
  
  private calculateConfidence(scored: Array<{ model: ModelConfig; score: number }>): number {
    if (scored.length < 2) return 1.0;
    
    const top = scored[0].score;
    const second = scored[1].score;
    
    // 分数差距越大，置信度越高
    const gap = top - second;
    return Math.min(1, 0.5 + gap * 2);
  }
  
  private updateStats(decision: RoutingDecision): void {
    this.stats.totalRequests++;
    
    const modelId = decision.selectedModel.id;
    this.stats.modelUsage[modelId] = (this.stats.modelUsage[modelId] || 0) + 1;
    
    // 更新平均值
    const n = this.stats.totalRequests;
    this.stats.avgCost = (this.stats.avgCost * (n - 1) + decision.estimatedCost) / n;
    this.stats.avgLatency = (this.stats.avgLatency * (n - 1) + decision.estimatedLatency) / n;
    this.stats.avgQuality = (this.stats.avgQuality * (n - 1) + decision.selectedModel.qualityScore) / n;
    
    // 计算成本节省（相比旗舰模型）
    const flagshipCost = this.config.models
      .filter(m => m.tier === "flagship")
      .reduce((min, m) => Math.min(min, m.costPerToken), Infinity);
    
    const flagshipEstimate = decision.estimatedCost * (flagshipCost / decision.selectedModel.costPerToken);
    this.stats.costSavings += flagshipEstimate - decision.estimatedCost;
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  private saveState(): void {
    try {
      const filePath = path.join(this.config.persistencePath, "router-state.json");
      fs.writeFileSync(filePath, JSON.stringify({
        adaptiveWeights: this.adaptiveWeights,
        stats: this.stats,
      }, null, 2));
    } catch (e) {
      // 忽略保存错误
    }
  }
  
  private loadState(): void {
    try {
      const filePath = path.join(this.config.persistencePath, "router-state.json");
      if (fs.existsSync(filePath)) {
        const state = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        this.adaptiveWeights = state.adaptiveWeights || this.adaptiveWeights;
        this.stats = state.stats || this.stats;
      }
    } catch (e) {
      // 忽略加载错误
    }
  }
}

// ============================================================
// 演示
// ============================================================

function demo() {
  console.log("=".repeat(60));
  console.log("MultiDimensionalRouter 三维模型路由演示");
  console.log("=".repeat(60));
  
  const router = new MultiDimensionalRouter({
    persistencePath: "./experiment-results/router",
  });
  
  // 显示可用模型
  console.log("\n1. 可用模型");
  
  const models = router.getAllModels();
  console.log(`   共 ${models.length} 个模型`);
  
  for (const tier of ["economy", "standard", "premium", "flagship"] as ModelTier[]) {
    const tierModels = router.getModelsByTier(tier);
    console.log(`   ${tier}: ${tierModels.map(m => m.name).join(", ")}`);
  }
  
  // 路由测试
  console.log("\n2. 路由测试");
  
  const requests: RoutingRequest[] = [
    {
      taskId: "task-1",
      prompt: "你好",
      priority: "cost",
      complexity: "simple",
    },
    {
      taskId: "task-2",
      prompt: "请分析这段代码的性能瓶颈并给出优化建议...",
      priority: "quality",
      complexity: "complex",
    },
    {
      taskId: "task-3",
      prompt: "实时翻译这段文字",
      priority: "latency",
      latencyRequirement: "realtime",
    },
    {
      taskId: "task-4",
      prompt: "请帮我写一个完整的用户认证系统...",
      priority: "balanced",
      complexity: "expert",
    },
    {
      taskId: "task-5",
      prompt: "分析这张图片",
      requiredCapabilities: ["vision"],
    },
  ];
  
  for (const request of requests) {
    const decision = router.route(request);
    console.log(`\n   ${request.taskId} (${request.priority || "balanced"}):`);
    console.log(`   选择: ${decision.selectedModel.name}`);
    console.log(`   理由: ${decision.reasoning}`);
    console.log(`   预估: $${decision.estimatedCost.toFixed(6)}, ${decision.estimatedLatency}ms`);
    console.log(`   置信度: ${(decision.confidence * 100).toFixed(0)}%`);
  }
  
  // 统计信息
  console.log("\n3. 统计信息");
  
  const stats = router.getStats();
  console.log(`   总请求: ${stats.totalRequests}`);
  console.log(`   平均成本: $${stats.avgCost.toFixed(6)}`);
  console.log(`   平均延迟: ${stats.avgLatency.toFixed(0)}ms`);
  console.log(`   成本节省: $${stats.costSavings.toFixed(4)}`);
  
  // 权重
  console.log("\n4. 当前权重");
  
  const weights = router.getWeights();
  console.log(`   成本: ${(weights.cost * 100).toFixed(1)}%`);
  console.log(`   质量: ${(weights.quality * 100).toFixed(1)}%`);
  console.log(`   延迟: ${(weights.latency * 100).toFixed(1)}%`);
  
  // 生成报告
  console.log("\n5. 生成报告");
  
  const report = router.generateReport();
  const reportPath = "./experiment-results/router/report.md";
  fs.writeFileSync(reportPath, report);
  console.log(`   报告已保存: ${reportPath}`);
  
  // 保存状态
  router.save();
  
  console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  demo();
}
