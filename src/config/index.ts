/**
 * 元灵系统统一配置
 * 
 * 提供统一的配置管理
 * 
 * @module config
 */

// ============ 配置类型定义 ============

/**
 * 系统配置
 */
export interface SystemConfig {
  /** 工作目录 */
  workspaceRoot: string;
  /** 记忆目录 */
  memoryDir: string;
  /** 是否启用 L0 思考 */
  enableL0: boolean;
  /** 是否启用自省 */
  enableIntrospection: boolean;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** 超时时间（毫秒） */
  timeout: number;
}

/**
 * Harness 配置
 */
export interface HarnessConfig {
  /** 是否启用状态管理 */
  enableStateManager: boolean;
  /** 是否启用追踪 */
  enableTracing: boolean;
  /** 是否启用审计 */
  enableAudit: boolean;
  /** 状态存储类型 */
  stateStoreType: 'memory' | 'file' | 'tiered';
  /** 追踪历史大小 */
  traceHistorySize: number;
}

/**
 * Dashboard 配置
 */
export interface DashboardConfig {
  /** 端口 */
  port: number;
  /** 是否启用认证 */
  enableAuth: boolean;
  /** 刷新间隔（毫秒） */
  refreshInterval: number;
}

/**
 * Multi-Agent 配置
 */
export interface MultiAgentConfig {
  /** 最大 Agent 数量 */
  maxAgents: number;
  /** 最大任务数量 */
  maxTasks: number;
  /** 调度策略 */
  schedulingStrategy: 'round_robin' | 'least_tasks' | 'priority';
  /** 任务超时（毫秒） */
  taskTimeout: number;
}

/**
 * Edge 配置
 */
export interface EdgeConfig {
  /** 节点类型 */
  nodeType: 'embedded' | 'iot_gateway' | 'edge_server';
  /** 内存限制（MB） */
  memoryLimit: number;
  /** 存储限制（MB） */
  storageLimit: number;
  /** 最大任务数 */
  maxTasks: number;
  /** 同步间隔（毫秒） */
  syncInterval: number;
}

/**
 * Federated 配置
 */
export interface FederatedConfig {
  /** 角色 */
  role: 'server' | 'client';
  /** 聚合策略 */
  aggregationStrategy: 'federated_averaging' | 'weighted_average' | 'median';
  /** 隐私策略 */
  privacyStrategy: 'differential_privacy' | 'secure_aggregation' | 'homomorphic_encryption';
  /** 最小客户端数 */
  minClients: number;
  /** 训练轮次 */
  trainingRounds: number;
}

/**
 * 错误处理配置
 */
export interface ErrorHandlingConfig {
  /** 是否启用日志 */
  enableLogging: boolean;
  /** 是否启用上报 */
  enableReporting: boolean;
  /** 是否启用恢复 */
  enableRecovery: boolean;
  /** 最大历史记录 */
  maxHistorySize: number;
}

/**
 * 性能监控配置
 */
export interface PerformanceConfig {
  /** 健康度警告阈值 */
  healthWarningThreshold: number;
  /** 健康度严重阈值 */
  healthCriticalThreshold: number;
  /** 延迟警告阈值（毫秒） */
  latencyWarningThreshold: number;
  /** 延迟严重阈值（毫秒） */
  latencyCriticalThreshold: number;
  /** 成功率警告阈值 */
  successRateWarningThreshold: number;
  /** 成功率严重阈值 */
  successRateCriticalThreshold: number;
}

/**
 * 元灵系统统一配置
 */
export interface YuanLingConfig {
  system: SystemConfig;
  harness: HarnessConfig;
  dashboard: DashboardConfig;
  multiAgent: MultiAgentConfig;
  edge: EdgeConfig;
  federated: FederatedConfig;
  errorHandling: ErrorHandlingConfig;
  performance: PerformanceConfig;
}

// ============ 默认配置 ============

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  memoryDir: './memory',
  enableL0: true,
  enableIntrospection: true,
  logLevel: 'info',
  timeout: 30000,
};

export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  enableStateManager: true,
  enableTracing: true,
  enableAudit: true,
  stateStoreType: 'memory',
  traceHistorySize: 1000,
};

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  port: 3000,
  enableAuth: false,
  refreshInterval: 1000,
};

export const DEFAULT_MULTI_AGENT_CONFIG: MultiAgentConfig = {
  maxAgents: 100,
  maxTasks: 1000,
  schedulingStrategy: 'round_robin',
  taskTimeout: 30000,
};

export const DEFAULT_EDGE_CONFIG: EdgeConfig = {
  nodeType: 'edge_server',
  memoryLimit: 2048,
  storageLimit: 10240,
  maxTasks: 100,
  syncInterval: 60000,
};

export const DEFAULT_FEDERATED_CONFIG: FederatedConfig = {
  role: 'server',
  aggregationStrategy: 'federated_averaging',
  privacyStrategy: 'differential_privacy',
  minClients: 3,
  trainingRounds: 10,
};

export const DEFAULT_ERROR_HANDLING_CONFIG: ErrorHandlingConfig = {
  enableLogging: true,
  enableReporting: false,
  enableRecovery: true,
  maxHistorySize: 100,
};

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  healthWarningThreshold: 0.8,
  healthCriticalThreshold: 0.7,
  latencyWarningThreshold: 2000,
  latencyCriticalThreshold: 5000,
  successRateWarningThreshold: 0.95,
  successRateCriticalThreshold: 0.8,
};

export const DEFAULT_YUANLING_CONFIG: YuanLingConfig = {
  system: DEFAULT_SYSTEM_CONFIG,
  harness: DEFAULT_HARNESS_CONFIG,
  dashboard: DEFAULT_DASHBOARD_CONFIG,
  multiAgent: DEFAULT_MULTI_AGENT_CONFIG,
  edge: DEFAULT_EDGE_CONFIG,
  federated: DEFAULT_FEDERATED_CONFIG,
  errorHandling: DEFAULT_ERROR_HANDLING_CONFIG,
  performance: DEFAULT_PERFORMANCE_CONFIG,
};

// ============ 配置管理器 ============

/**
 * 配置管理器
 */
export class ConfigManager {
  private config: YuanLingConfig;
  private static instance: ConfigManager;
  
  private constructor(config?: Partial<YuanLingConfig>) {
    this.config = this.mergeConfig(config);
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<YuanLingConfig>): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(config);
    }
    return ConfigManager.instance;
  }
  
  /**
   * 合并配置
   */
  private mergeConfig(config?: Partial<YuanLingConfig>): YuanLingConfig {
    return {
      system: { ...DEFAULT_SYSTEM_CONFIG, ...config?.system },
      harness: { ...DEFAULT_HARNESS_CONFIG, ...config?.harness },
      dashboard: { ...DEFAULT_DASHBOARD_CONFIG, ...config?.dashboard },
      multiAgent: { ...DEFAULT_MULTI_AGENT_CONFIG, ...config?.multiAgent },
      edge: { ...DEFAULT_EDGE_CONFIG, ...config?.edge },
      federated: { ...DEFAULT_FEDERATED_CONFIG, ...config?.federated },
      errorHandling: { ...DEFAULT_ERROR_HANDLING_CONFIG, ...config?.errorHandling },
      performance: { ...DEFAULT_PERFORMANCE_CONFIG, ...config?.performance },
    };
  }
  
  /**
   * 获取完整配置
   */
  getConfig(): YuanLingConfig {
    return this.config;
  }
  
  /**
   * 获取系统配置
   */
  getSystemConfig(): SystemConfig {
    return this.config.system;
  }
  
  /**
   * 获取 Harness 配置
   */
  getHarnessConfig(): HarnessConfig {
    return this.config.harness;
  }
  
  /**
   * 获取 Dashboard 配置
   */
  getDashboardConfig(): DashboardConfig {
    return this.config.dashboard;
  }
  
  /**
   * 获取 Multi-Agent 配置
   */
  getMultiAgentConfig(): MultiAgentConfig {
    return this.config.multiAgent;
  }
  
  /**
   * 获取 Edge 配置
   */
  getEdgeConfig(): EdgeConfig {
    return this.config.edge;
  }
  
  /**
   * 获取 Federated 配置
   */
  getFederatedConfig(): FederatedConfig {
    return this.config.federated;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<YuanLingConfig>): void {
    this.config = this.mergeConfig(config);
  }
  
  /**
   * 重置为默认配置
   */
  reset(): void {
    this.config = DEFAULT_YUANLING_CONFIG;
  }
  
  /**
   * 验证配置
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 验证系统配置
    if (!this.config.system.workspaceRoot) {
      errors.push('workspaceRoot is required');
    }
    
    // 验证 Dashboard 配置
    if (this.config.dashboard.port < 1 || this.config.dashboard.port > 65535) {
      errors.push('dashboard.port must be between 1 and 65535');
    }
    
    // 验证 Multi-Agent 配置
    if (this.config.multiAgent.maxAgents < 1) {
      errors.push('multiAgent.maxAgents must be at least 1');
    }
    
    // 验证 Edge 配置
    if (this.config.edge.memoryLimit < 256) {
      errors.push('edge.memoryLimit must be at least 256');
    }
    
    // 验证 Federated 配置
    if (this.config.federated.minClients < 1) {
      errors.push('federated.minClients must be at least 1');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * 导出配置为 JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }
  
  /**
   * 从 JSON 导入配置
   */
  fromJSON(json: string): void {
    try {
      const config = JSON.parse(json);
      this.config = this.mergeConfig(config);
    } catch (error) {
      throw new Error(`Failed to parse config JSON: ${error}`);
    }
  }
}

// ============ 便捷函数 ============

/**
 * 获取配置管理器
 */
export function getConfigManager(config?: Partial<YuanLingConfig>): ConfigManager {
  return ConfigManager.getInstance(config);
}

/**
 * 获取配置
 */
export function getConfig(): YuanLingConfig {
  return getConfigManager().getConfig();
}
