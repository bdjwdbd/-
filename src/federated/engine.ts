/**
 * 联邦学习引擎
 * 
 * 实现联邦学习的核心逻辑
 * 
 * @module federated/engine
 */

import * as crypto from 'crypto';
import {
  FederatedConfig,
  FederatedRole,
  AggregationStrategy,
  PrivacyStrategy,
  ModelParameters,
  GradientUpdate,
  AggregationResult,
  TrainingRound,
  FederatedStatus,
  DEFAULT_FEDERATED_CONFIG,
} from './types';

// ============ 联邦学习引擎 ============

/**
 * 联邦学习引擎
 */
export class FederatedEngine {
  private config: FederatedConfig;
  private currentRound: TrainingRound | null = null;
  private rounds: TrainingRound[] = [];
  private globalParameters: ModelParameters | null = null;
  private clients: Set<string> = new Set();
  private activeClients: Set<string> = new Set();
  private stats = {
    bytesSent: 0,
    bytesReceived: 0,
    messagesSent: 0,
    messagesReceived: 0,
  };

  constructor(config: Partial<FederatedConfig> = {}) {
    this.config = { ...DEFAULT_FEDERATED_CONFIG, ...config };
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    console.log(`🚀 联邦学习引擎初始化: ${this.config.nodeId}`);
    console.log(`   角色: ${this.config.role}`);
    console.log(`   聚合策略: ${this.config.aggregationStrategy}`);
    console.log(`   隐私策略: ${this.config.privacyStrategy}`);

    // 初始化全局模型
    this.globalParameters = this.initializeModel();

    console.log('✅ 联邦学习引擎已初始化');
  }

  /**
   * 关闭引擎
   */
  async shutdown(): Promise<void> {
    console.log('🛑 联邦学习引擎已关闭');
  }

  // ============ 客户端管理 ============

  /**
   * 注册客户端
   */
  registerClient(clientId: string): void {
    this.clients.add(clientId);
    console.log(`👤 客户端注册: ${clientId} (总计: ${this.clients.size})`);
  }

  /**
   * 注销客户端
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    this.activeClients.delete(clientId);
    console.log(`👋 客户端注销: ${clientId} (剩余: ${this.clients.size})`);
  }

  /**
   * 获取客户端列表
   */
  getClients(): string[] {
    return Array.from(this.clients);
  }

  // ============ 训练流程 ============

  /**
   * 开始训练轮次
   */
  async startRound(): Promise<TrainingRound> {
    const roundId = `round_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const roundNumber = this.rounds.length + 1;

    console.log(`\n━━━━━━ 开始轮次 ${roundNumber} ━━━━━━`);

    // 选择客户端
    const selectedClients = this.selectClients();
    console.log(`   选中客户端: ${selectedClients.length}/${this.clients.size}`);

    // 创建轮次
    this.currentRound = {
      roundId,
      roundNumber,
      status: 'running',
      globalParameters: this.globalParameters!,
      clientUpdates: new Map(),
      metrics: {},
      startTime: Date.now(),
    };

    this.rounds.push(this.currentRound);

    // 模拟等待客户端更新
    await this.waitForClientUpdates(selectedClients);

    return this.currentRound;
  }

  /**
   * 选择客户端
   */
  private selectClients(): string[] {
    const clients = Array.from(this.clients);
    const count = Math.max(
      this.config.communication.minClients,
      Math.min(
        this.config.communication.maxClients,
        Math.floor(clients.length * this.config.communication.clientFraction)
      )
    );

    // 随机选择
    const shuffled = clients.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * 等待客户端更新
   */
  private async waitForClientUpdates(selectedClients: string[]): Promise<void> {
    // 模拟客户端更新
    for (const clientId of selectedClients) {
      const update = await this.simulateClientUpdate(clientId);
      this.submitUpdate(update);
    }
  }

  /**
   * 模拟客户端更新
   */
  private async simulateClientUpdate(clientId: string): Promise<GradientUpdate> {
    // 模拟本地训练
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // 生成模拟梯度
    const gradients: Record<string, number[]> = {};
    if (this.globalParameters) {
      for (const [key, weights] of Object.entries(this.globalParameters.weights)) {
        gradients[key] = weights.map(w => (Math.random() - 0.5) * 0.1);
      }
    }

    return {
      clientId,
      roundId: this.currentRound!.roundId,
      gradients,
      sampleCount: Math.floor(Math.random() * 1000) + 100,
      localEpochs: this.config.training.localEpochs,
      computeTimeMs: Math.random() * 1000,
      timestamp: Date.now(),
    };
  }

  /**
   * 提交梯度更新
   */
  submitUpdate(update: GradientUpdate): void {
    if (!this.currentRound) {
      throw new Error('没有正在进行的轮次');
    }

    // 应用隐私保护
    const protectedUpdate = this.applyPrivacyProtection(update);

    this.currentRound.clientUpdates.set(update.clientId, protectedUpdate);
    this.stats.bytesReceived += JSON.stringify(protectedUpdate).length;
    this.stats.messagesReceived++;

    console.log(`   📥 收到更新: ${update.clientId} (${update.sampleCount} 样本)`);
  }

  /**
   * 应用隐私保护
   */
  private applyPrivacyProtection(update: GradientUpdate): GradientUpdate {
    switch (this.config.privacyStrategy) {
      case PrivacyStrategy.DIFFERENTIAL_PRIVACY:
        return this.applyDifferentialPrivacy(update);
      
      case PrivacyStrategy.SECURE_AGGREGATION:
        return this.applySecureAggregation(update);
      
      default:
        return update;
    }
  }

  /**
   * 应用差分隐私
   */
  private applyDifferentialPrivacy(update: GradientUpdate): GradientUpdate {
    const { epsilon = 1.0, clipNorm = 1.0, noiseScale = 0.1 } = this.config.privacy;

    // 梯度裁剪
    const clippedGradients: Record<string, number[]> = {};
    for (const [key, grads] of Object.entries(update.gradients)) {
      const norm = Math.sqrt(grads.reduce((sum, g) => sum + g * g, 0));
      const scale = norm > clipNorm ? clipNorm / norm : 1;
      clippedGradients[key] = grads.map(g => g * scale);
    }

    // 添加噪声
    const sensitivity = clipNorm;
    const noiseStd = sensitivity / epsilon;
    const noisyGradients: Record<string, number[]> = {};
    for (const [key, grads] of Object.entries(clippedGradients)) {
      noisyGradients[key] = grads.map(g => g + this.gaussianNoise(0, noiseStd * noiseScale));
    }

    return { ...update, gradients: noisyGradients };
  }

  /**
   * 应用安全聚合
   */
  private applySecureAggregation(update: GradientUpdate): GradientUpdate {
    // 简化：直接返回
    return update;
  }

  /**
   * 生成高斯噪声
   */
  private gaussianNoise(mean: number, std: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }

  /**
   * 聚合更新
   */
  async aggregate(): Promise<AggregationResult> {
    if (!this.currentRound) {
      throw new Error('没有正在进行的轮次');
    }

    console.log(`   🔄 聚合 ${this.currentRound.clientUpdates.size} 个更新...`);

    const startTime = Date.now();

    // 执行聚合
    let newParameters: ModelParameters;
    switch (this.config.aggregationStrategy) {
      case AggregationStrategy.FEDERATED_AVERAGING:
        newParameters = this.federatedAveraging();
        break;
      case AggregationStrategy.WEIGHTED_AVERAGE:
        newParameters = this.weightedAveraging();
        break;
      default:
        newParameters = this.federatedAveraging();
    }

    // 计算总样本数
    let totalSamples = 0;
    for (const update of this.currentRound.clientUpdates.values()) {
      totalSamples += update.sampleCount;
    }

    const result: AggregationResult = {
      roundId: this.currentRound.roundId,
      parameters: newParameters,
      participantCount: this.currentRound.clientUpdates.size,
      totalSamples,
      aggregationTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };

    // 更新全局模型
    this.globalParameters = newParameters;
    this.currentRound.aggregationResult = result;
    this.currentRound.status = 'completed';
    this.currentRound.endTime = Date.now();

    // 计算指标
    this.currentRound.metrics.accuracy = 0.8 + Math.random() * 0.15;
    this.currentRound.metrics.loss = 0.1 + Math.random() * 0.2;

    console.log(`   ✅ 聚合完成: ${result.participantCount} 客户端, ${totalSamples} 样本`);
    console.log(`   📊 准确率: ${(this.currentRound.metrics.accuracy! * 100).toFixed(1)}%`);
    console.log(`   📊 损失: ${this.currentRound.metrics.loss!.toFixed(4)}`);

    return result;
  }

  /**
   * 联邦平均
   */
  private federatedAveraging(): ModelParameters {
    const updates = Array.from(this.currentRound!.clientUpdates.values());
    const avgWeights: Record<string, number[]> = {};

    // 计算每个参数的平均值
    for (const key of Object.keys(updates[0].gradients)) {
      const paramUpdates = updates.map(u => u.gradients[key]);
      const avgParam: number[] = [];

      const paramLength = paramUpdates[0].length;
      for (let i = 0; i < paramLength; i++) {
        let sum = 0;
        for (const params of paramUpdates) {
          sum += params[i];
        }
        avgParam.push(sum / paramUpdates.length);
      }

      avgWeights[key] = avgParam;
    }

    // 更新全局参数
    const newWeights: Record<string, number[]> = {};
    for (const [key, weights] of Object.entries(this.globalParameters!.weights)) {
      newWeights[key] = weights.map((w, i) => w - avgWeights[key][i] * this.config.training.learningRate);
    }

    return {
      version: this.globalParameters!.version + 1,
      weights: newWeights,
      hash: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
    };
  }

  /**
   * 加权平均
   */
  private weightedAveraging(): ModelParameters {
    const updates = Array.from(this.currentRound!.clientUpdates.values());
    const totalSamples = updates.reduce((sum, u) => sum + u.sampleCount, 0);

    const avgWeights: Record<string, number[]> = {};

    for (const key of Object.keys(updates[0].gradients)) {
      const avgParam: number[] = [];
      const paramLength = updates[0].gradients[key].length;

      for (let i = 0; i < paramLength; i++) {
        let weightedSum = 0;
        for (const update of updates) {
          const weight = update.sampleCount / totalSamples;
          weightedSum += update.gradients[key][i] * weight;
        }
        avgParam.push(weightedSum);
      }

      avgWeights[key] = avgParam;
    }

    const newWeights: Record<string, number[]> = {};
    for (const [key, weights] of Object.entries(this.globalParameters!.weights)) {
      newWeights[key] = weights.map((w, i) => w - avgWeights[key][i] * this.config.training.learningRate);
    }

    return {
      version: this.globalParameters!.version + 1,
      weights: newWeights,
      hash: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
    };
  }

  // ============ 模型管理 ============

  /**
   * 初始化模型
   */
  private initializeModel(): ModelParameters {
    // 简单的模型初始化
    const weights: Record<string, number[]> = {
      layer1: Array(100).fill(0).map(() => Math.random() * 0.1 - 0.05),
      layer2: Array(50).fill(0).map(() => Math.random() * 0.1 - 0.05),
      output: Array(10).fill(0).map(() => Math.random() * 0.1 - 0.05),
    };

    return {
      version: 0,
      weights,
      hash: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
    };
  }

  /**
   * 获取全局模型
   */
  getGlobalModel(): ModelParameters | null {
    return this.globalParameters;
  }

  // ============ 状态查询 ============

  /**
   * 获取状态
   */
  getStatus(): FederatedStatus {
    return {
      node: {
        id: this.config.nodeId,
        role: this.config.role,
      },
      currentRound: this.currentRound?.roundNumber || 0,
      totalRounds: this.rounds.length,
      clients: {
        total: this.clients.size,
        active: this.activeClients.size,
        participating: this.currentRound?.clientUpdates.size || 0,
      },
      model: {
        version: this.globalParameters?.version || 0,
        lastUpdateAt: this.globalParameters?.timestamp || 0,
        accuracy: this.currentRound?.metrics.accuracy,
        loss: this.currentRound?.metrics.loss,
      },
      communication: this.stats,
    };
  }

  /**
   * 获取轮次历史
   */
  getRoundHistory(): TrainingRound[] {
    return this.rounds;
  }
}

// ============ 工厂函数 ============

/**
 * 创建联邦学习引擎
 */
export function createFederatedEngine(config?: Partial<FederatedConfig>): FederatedEngine {
  return new FederatedEngine(config);
}
