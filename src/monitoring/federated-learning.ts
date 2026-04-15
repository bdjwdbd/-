/**
 * 联邦学习支持模块
 * 
 * 功能：
 * 1. 分布式训练协调
 * 2. 模型聚合
 * 3. 隐私保护
 * 4. 通信优化
 */

// ============================================================
// 类型定义
// ============================================================

interface FederatedClient {
  id: string;
  name: string;
  dataSize: number;
  computePower: number;
  lastUpdate: number;
  status: 'idle' | 'training' | 'uploading' | 'offline';
}

interface ModelWeights {
  version: number;
  weights: Map<string, number[]>;
  timestamp: number;
  metrics: {
    accuracy: number;
    loss: number;
  };
}

interface TrainingRound {
  roundId: number;
  globalModel: ModelWeights;
  clientUpdates: Map<string, ModelWeights>;
  aggregationStrategy: 'fedavg' | 'fedprox' | 'fedadam';
  startTime: number;
  endTime?: number;
}

interface FederatedConfig {
  minClients: number;
  maxRounds: number;
  localEpochs: number;
  learningRate: number;
  aggregationStrategy: 'fedavg' | 'fedprox' | 'fedadam';
  privacyBudget?: number;
}

// ============================================================
// 联邦学习协调器
// ============================================================

export class FederatedCoordinator {
  private clients: Map<string, FederatedClient> = new Map();
  private currentRound: TrainingRound | null = null;
  private globalModel: ModelWeights | null = null;
  private config: FederatedConfig;
  private roundHistory: TrainingRound[] = [];

  constructor(config?: Partial<FederatedConfig>) {
    this.config = {
      minClients: 3,
      maxRounds: 100,
      localEpochs: 5,
      learningRate: 0.01,
      aggregationStrategy: 'fedavg',
      ...config,
    };
  }

  /**
   * 注册客户端
   */
  registerClient(client: Omit<FederatedClient, 'id' | 'lastUpdate'>): FederatedClient {
    const id = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newClient: FederatedClient = {
      ...client,
      id,
      lastUpdate: Date.now(),
    };

    this.clients.set(id, newClient);
    return newClient;
  }

  /**
   * 注销客户端
   */
  unregisterClient(clientId: string): boolean {
    return this.clients.delete(clientId);
  }

  /**
   * 获取活跃客户端
   */
  getActiveClients(): FederatedClient[] {
    const now = Date.now();
    const timeout = 300000; // 5 分钟超时

    return Array.from(this.clients.values()).filter(client => {
      if (now - client.lastUpdate > timeout) {
        client.status = 'offline';
        return false;
      }
      return client.status !== 'offline';
    });
  }

  /**
   * 初始化全局模型
   */
  initializeGlobalModel(initialWeights?: Map<string, number[]>): ModelWeights {
    this.globalModel = {
      version: 0,
      weights: initialWeights || new Map([
        ['layer1', Array(100).fill(0).map(() => Math.random() * 0.1)],
        ['layer2', Array(50).fill(0).map(() => Math.random() * 0.1)],
        ['output', Array(10).fill(0).map(() => Math.random() * 0.1)],
      ]),
      timestamp: Date.now(),
      metrics: { accuracy: 0, loss: 1 },
    };

    return this.globalModel;
  }

  /**
   * 开始训练轮次
   */
  startTrainingRound(): TrainingRound {
    const activeClients = this.getActiveClients();
    
    if (activeClients.length < this.config.minClients) {
      throw new Error(`Not enough clients: ${activeClients.length} < ${this.config.minClients}`);
    }

    if (!this.globalModel) {
      this.initializeGlobalModel();
    }

    const roundId = (this.currentRound?.roundId || 0) + 1;

    this.currentRound = {
      roundId,
      globalModel: this.globalModel!,
      clientUpdates: new Map(),
      aggregationStrategy: this.config.aggregationStrategy,
      startTime: Date.now(),
    };

    return this.currentRound;
  }

  /**
   * 接收客户端更新
   */
  receiveClientUpdate(clientId: string, weights: ModelWeights): void {
    if (!this.currentRound) {
      throw new Error('No active training round');
    }

    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    this.currentRound.clientUpdates.set(clientId, weights);
    client.lastUpdate = Date.now();
    client.status = 'idle';
  }

  /**
   * 聚合模型
   */
  aggregateModels(): ModelWeights {
    if (!this.currentRound || this.currentRound.clientUpdates.size === 0) {
      throw new Error('No client updates to aggregate');
    }

    const updates = Array.from(this.currentRound.clientUpdates.values());
    const clients = Array.from(this.currentRound.clientUpdates.keys());

    // 计算权重（基于数据量）
    const totalData = clients.reduce((sum, id) => {
      const client = this.clients.get(id);
      return sum + (client?.dataSize || 1);
    }, 0);

    const clientWeights = clients.map(id => {
      const client = this.clients.get(id);
      return (client?.dataSize || 1) / totalData;
    });

    // 聚合策略
    let newWeights: Map<string, number[]>;

    switch (this.config.aggregationStrategy) {
      case 'fedavg':
        newWeights = this.fedAvgAggregate(updates, clientWeights);
        break;
      case 'fedprox':
        newWeights = this.fedProxAggregate(updates, clientWeights);
        break;
      case 'fedadam':
        newWeights = this.fedAdamAggregate(updates, clientWeights);
        break;
      default:
        newWeights = this.fedAvgAggregate(updates, clientWeights);
    }

    // 更新全局模型
    this.globalModel = {
      version: this.currentRound.roundId,
      weights: newWeights,
      timestamp: Date.now(),
      metrics: this.calculateMetrics(updates),
    };

    // 结束轮次
    this.currentRound.endTime = Date.now();
    this.roundHistory.push(this.currentRound);

    return this.globalModel;
  }

  /**
   * FedAvg 聚合
   */
  private fedAvgAggregate(updates: ModelWeights[], weights: number[]): Map<string, number[]> {
    const result = new Map<string, number[]>();
    const layers = Array.from(updates[0].weights.keys());

    for (const layer of layers) {
      const layerUpdates = updates.map(u => u.weights.get(layer)!);
      const aggregated = layerUpdates[0].map((_, i) => {
        let sum = 0;
        for (let j = 0; j < layerUpdates.length; j++) {
          sum += layerUpdates[j][i] * weights[j];
        }
        return sum;
      });
      result.set(layer, aggregated);
    }

    return result;
  }

  /**
   * FedProx 聚合
   */
  private fedProxAggregate(updates: ModelWeights[], weights: number[]): Map<string, number[]> {
    // 简化实现，与 FedAvg 类似
    return this.fedAvgAggregate(updates, weights);
  }

  /**
   * FedAdam 聚合
   */
  private fedAdamAggregate(updates: ModelWeights[], weights: number[]): Map<string, number[]> {
    // 简化实现，与 FedAvg 类似
    return this.fedAvgAggregate(updates, weights);
  }

  /**
   * 计算指标
   */
  private calculateMetrics(updates: ModelWeights[]): { accuracy: number; loss: number } {
    const avgAccuracy = updates.reduce((sum, u) => sum + u.metrics.accuracy, 0) / updates.length;
    const avgLoss = updates.reduce((sum, u) => sum + u.metrics.loss, 0) / updates.length;

    return {
      accuracy: avgAccuracy,
      loss: avgLoss,
    };
  }

  /**
   * 获取全局模型
   */
  getGlobalModel(): ModelWeights | null {
    return this.globalModel;
  }

  /**
   * 获取训练历史
   */
  getTrainingHistory(): TrainingRound[] {
    return [...this.roundHistory];
  }

  /**
   * 获取统计
   */
  getStats(): { totalClients: number; activeClients: number; totalRounds: number; modelVersion: number } {
    return {
      totalClients: this.clients.size,
      activeClients: this.getActiveClients().length,
      totalRounds: this.roundHistory.length,
      modelVersion: this.globalModel?.version || 0,
    };
  }
}

// ============================================================
// 联邦学习客户端
// ============================================================

export class FederatedClientNode {
  private id: string;
  private coordinator: FederatedCoordinator;
  private localModel: ModelWeights | null = null;
  private localData: any[] = [];

  constructor(id: string, coordinator: FederatedCoordinator) {
    this.id = id;
    this.coordinator = coordinator;
  }

  /**
   * 设置本地数据
   */
  setLocalData(data: any[]): void {
    this.localData = data;
  }

  /**
   * 本地训练
   */
  async trainLocal(globalWeights: ModelWeights, epochs: number): Promise<ModelWeights> {
    // 模拟本地训练
    this.localModel = {
      version: globalWeights.version,
      weights: new Map(globalWeights.weights),
      timestamp: Date.now(),
      metrics: {
        accuracy: 0.7 + Math.random() * 0.2,
        loss: 0.3 + Math.random() * 0.2,
      },
    };

    // 模拟训练过程
    for (let epoch = 0; epoch < epochs; epoch++) {
      // 模拟梯度更新
      for (const [layer, weights] of this.localModel.weights) {
        const noise = weights.map(w => w + (Math.random() - 0.5) * 0.01);
        this.localModel.weights.set(layer, noise);
      }
    }

    return this.localModel;
  }

  /**
   * 上传更新
   */
  async uploadUpdate(): Promise<void> {
    if (!this.localModel) {
      throw new Error('No local model to upload');
    }

    this.coordinator.receiveClientUpdate(this.id, this.localModel);
  }

  /**
   * 获取本地模型
   */
  getLocalModel(): ModelWeights | null {
    return this.localModel;
  }
}

// ============================================================
// 隐私保护模块
// ============================================================

export class PrivacyProtector {
  private epsilon: number;
  private delta: number;

  constructor(epsilon: number = 1.0, delta: number = 1e-5) {
    this.epsilon = epsilon;
    this.delta = delta;
  }

  /**
   * 差分隐私噪声
   */
  addDifferentialPrivacy(weights: Map<string, number[]>): Map<string, number[]> {
    const result = new Map<string, number[]>();

    for (const [layer, w] of weights) {
      const noise = w.map(v => {
        // Laplace 机制
        const scale = 1 / this.epsilon;
        const u = Math.random() - 0.5;
        const laplace = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
        return v + laplace;
      });
      result.set(layer, noise);
    }

    return result;
  }

  /**
   * 梯度裁剪
   */
  clipGradients(weights: Map<string, number[]>, maxNorm: number = 1.0): Map<string, number[]> {
    const result = new Map<string, number[]>();

    for (const [layer, w] of weights) {
      const norm = Math.sqrt(w.reduce((sum, v) => sum + v * v, 0));
      const scale = norm > maxNorm ? maxNorm / norm : 1;
      const clipped = w.map(v => v * scale);
      result.set(layer, clipped);
    }

    return result;
  }

  /**
   * 安全聚合（模拟）
   */
  secureAggregation(clientUpdates: Map<string, ModelWeights>): ModelWeights {
    // 简化实现：直接平均
    const updates = Array.from(clientUpdates.values());
    const weights = updates.map(() => 1 / updates.length);

    const result = new Map<string, number[]>();
    const layers = Array.from(updates[0].weights.keys());

    for (const layer of layers) {
      const layerUpdates = updates.map(u => u.weights.get(layer)!);
      const aggregated = layerUpdates[0].map((_, i) => {
        let sum = 0;
        for (let j = 0; j < layerUpdates.length; j++) {
          sum += layerUpdates[j][i] * weights[j];
        }
        return sum;
      });
      result.set(layer, aggregated);
    }

    return {
      version: updates[0].version,
      weights: result,
      timestamp: Date.now(),
      metrics: { accuracy: 0.8, loss: 0.2 },
    };
  }
}

// ============================================================
// 单例
// ============================================================

let federatedCoordinatorInstance: FederatedCoordinator | null = null;
let privacyProtectorInstance: PrivacyProtector | null = null;

export function getFederatedCoordinator(): FederatedCoordinator {
  if (!federatedCoordinatorInstance) {
    federatedCoordinatorInstance = new FederatedCoordinator();
  }
  return federatedCoordinatorInstance;
}

export function getPrivacyProtector(): PrivacyProtector {
  if (!privacyProtectorInstance) {
    privacyProtectorInstance = new PrivacyProtector();
  }
  return privacyProtectorInstance;
}
