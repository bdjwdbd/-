/**
 * 联邦学习集成
 * 
 * 在保护隐私的前提下，让多个节点协同学习
 * 
 * @module federated/types
 */

// ============ 类型定义 ============

/**
 * 联邦学习节点角色
 */
export enum FederatedRole {
  /** 服务器（聚合器） */
  SERVER = 'server',
  
  /** 客户端（参与者） */
  CLIENT = 'client',
  
  /** 两者兼具 */
  HYBRID = 'hybrid',
}

/**
 * 聚合策略
 */
export enum AggregationStrategy {
  /** 联邦平均 */
  FEDERATED_AVERAGING = 'federated_averaging',
  
  /** 加权平均 */
  WEIGHTED_AVERAGE = 'weighted_average',
  
  /** 中位数 */
  MEDIAN = 'median',
  
  /** 裁剪平均 */
  TRIMMED_MEAN = 'trimmed_mean',
  
  /** 鲁棒聚合 */
  ROBUST = 'robust',
}

/**
 * 隐私策略
 */
export enum PrivacyStrategy {
  /** 无隐私保护 */
  NONE = 'none',
  
  /** 差分隐私 */
  DIFFERENTIAL_PRIVACY = 'differential_privacy',
  
  /** 安全聚合 */
  SECURE_AGGREGATION = 'secure_aggregation',
  
  /** 同态加密 */
  HOMOMORPHIC_ENCRYPTION = 'homomorphic_encryption',
  
  /** 混合策略 */
  HYBRID = 'hybrid',
}

/**
 * 联邦学习配置
 */
export interface FederatedConfig {
  /** 节点 ID */
  nodeId: string;
  
  /** 节点角色 */
  role: FederatedRole;
  
  /** 聚合策略 */
  aggregationStrategy: AggregationStrategy;
  
  /** 隐私策略 */
  privacyStrategy: PrivacyStrategy;
  
  /** 训练配置 */
  training: {
    /** 本地训练轮数 */
    localEpochs: number;
    
    /** 批次大小 */
    batchSize: number;
    
    /** 学习率 */
    learningRate: number;
    
    /** 优化器 */
    optimizer: 'sgd' | 'adam' | 'rmsprop';
  };
  
  /** 通信配置 */
  communication: {
    /** 最小客户端数 */
    minClients: number;
    
    /** 最大客户端数 */
    maxClients: number;
    
    /** 客户端选择比例 */
    clientFraction: number;
    
    /** 超时时间（毫秒） */
    timeoutMs: number;
    
    /** 重试次数 */
    maxRetries: number;
  };
  
  /** 隐私配置 */
  privacy: {
    /** 差分隐私参数 ε */
    epsilon?: number;
    
    /** 差分隐私参数 δ */
    delta?: number;
    
    /** 梯度裁剪阈值 */
    clipNorm?: number;
    
    /** 噪声尺度 */
    noiseScale?: number;
  };
}

/**
 * 模型参数
 */
export interface ModelParameters {
  /** 参数版本 */
  version: number;
  
  /** 参数数据 */
  weights: Record<string, number[]>;
  
  /** 参数哈希 */
  hash: string;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 梯度更新
 */
export interface GradientUpdate {
  /** 客户端 ID */
  clientId: string;
  
  /** 轮次 ID */
  roundId: string;
  
  /** 梯度数据 */
  gradients: Record<string, number[]>;
  
  /** 样本数量 */
  sampleCount: number;
  
  /** 本地训练轮数 */
  localEpochs: number;
  
  /** 计算时间（毫秒） */
  computeTimeMs: number;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 聚合结果
 */
export interface AggregationResult {
  /** 轮次 ID */
  roundId: string;
  
  /** 聚合后的模型参数 */
  parameters: ModelParameters;
  
  /** 参与的客户端数 */
  participantCount: number;
  
  /** 总样本数 */
  totalSamples: number;
  
  /** 聚合时间（毫秒） */
  aggregationTimeMs: number;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 训练轮次
 */
export interface TrainingRound {
  /** 轮次 ID */
  roundId: string;
  
  /** 轮次编号 */
  roundNumber: number;
  
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  /** 全局模型参数 */
  globalParameters?: ModelParameters;
  
  /** 客户端更新 */
  clientUpdates: Map<string, GradientUpdate>;
  
  /** 聚合结果 */
  aggregationResult?: AggregationResult;
  
  /** 开始时间 */
  startTime?: number;
  
  /** 结束时间 */
  endTime?: number;
  
  /** 指标 */
  metrics: {
    accuracy?: number;
    loss?: number;
    [key: string]: number | undefined;
  };
}

/**
 * 联邦学习状态
 */
export interface FederatedStatus {
  /** 节点信息 */
  node: {
    id: string;
    role: FederatedRole;
  };
  
  /** 当前轮次 */
  currentRound: number;
  
  /** 总轮次数 */
  totalRounds: number;
  
  /** 客户端状态 */
  clients: {
    total: number;
    active: number;
    participating: number;
  };
  
  /** 模型状态 */
  model: {
    version: number;
    lastUpdateAt: number;
    accuracy?: number;
    loss?: number;
  };
  
  /** 通信状态 */
  communication: {
    bytesSent: number;
    bytesReceived: number;
    messagesSent: number;
    messagesReceived: number;
  };
}

// ============ 默认配置 ============

/**
 * 默认联邦学习配置
 */
export const DEFAULT_FEDERATED_CONFIG: FederatedConfig = {
  nodeId: 'federated_default',
  role: FederatedRole.SERVER,
  aggregationStrategy: AggregationStrategy.FEDERATED_AVERAGING,
  privacyStrategy: PrivacyStrategy.DIFFERENTIAL_PRIVACY,
  training: {
    localEpochs: 5,
    batchSize: 32,
    learningRate: 0.01,
    optimizer: 'adam',
  },
  communication: {
    minClients: 3,
    maxClients: 100,
    clientFraction: 0.1,
    timeoutMs: 60000,
    maxRetries: 3,
  },
  privacy: {
    epsilon: 1.0,
    delta: 1e-5,
    clipNorm: 1.0,
    noiseScale: 0.1,
  },
};
