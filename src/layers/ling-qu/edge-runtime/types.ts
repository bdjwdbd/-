/**
 * 边缘计算支持
 * 
 * 轻量级运行时，支持离线模式和资源受限环境
 * 
 * @module edge/types
 */

// ============ 类型定义 ============

/**
 * 边缘节点类型
 */
export enum EdgeNodeType {
  /** 嵌入式设备 */
  EMBEDDED = 'embedded',
  
  /** IoT 网关 */
  IOT_GATEWAY = 'iot_gateway',
  
  /** 边缘服务器 */
  EDGE_SERVER = 'edge_server',
  
  /** 移动设备 */
  MOBILE = 'mobile',
}

/**
 * 边缘节点能力
 */
export interface EdgeNodeCapabilities {
  /** CPU 核心数 */
  cpuCores: number;
  
  /** 内存大小（MB） */
  memoryMB: number;
  
  /** 存储大小（MB） */
  storageMB: number;
  
  /** 是否支持持久化 */
  persistentStorage: boolean;
  
  /** 网络带宽（Mbps） */
  networkBandwidth: number;
  
  /** 是否支持离线模式 */
  offlineSupport: boolean;
  
  /** 电池供电 */
  batteryPowered: boolean;
}

/**
 * 边缘节点配置
 */
export interface EdgeNodeConfig {
  /** 节点 ID */
  nodeId: string;
  
  /** 节点名称 */
  name: string;
  
  /** 节点类型 */
  type: EdgeNodeType;
  
  /** 节点能力 */
  capabilities: EdgeNodeCapabilities;
  
  /** 资源限制 */
  limits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
    maxStorageMB: number;
    maxTasks: number;
  };
  
  /** 同步配置 */
  sync: {
    enabled: boolean;
    endpoint?: string;
    intervalMs: number;
    retryCount: number;
  };
  
  /** 离线配置 */
  offline: {
    enabled: boolean;
    maxQueueSize: number;
    ttlMs: number;
  };
}

/**
 * 边缘任务状态
 */
export enum EdgeTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  QUEUED_OFFLINE = 'queued_offline',
  SYNCING = 'syncing',
}

/**
 * 边缘任务
 */
export interface EdgeTask {
  /** 任务 ID */
  taskId: string;
  
  /** 任务名称 */
  name: string;
  
  /** 任务类型 */
  type: 'compute' | 'sync' | 'cache' | 'sensor';
  
  /** 优先级 */
  priority: number;
  
  /** 状态 */
  status: EdgeTaskStatus;
  
  /** 输入数据 */
  input: any;
  
  /** 输出数据 */
  output?: any;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 开始时间 */
  startedAt?: number;
  
  /** 完成时间 */
  completedAt?: number;
  
  /** 重试次数 */
  retryCount: number;
  
  /** 资源使用 */
  resourceUsage: {
    memoryMB: number;
    cpuMs: number;
    storageMB: number;
  };
}

/**
 * 同步状态
 */
export enum SyncStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SYNCING = 'syncing',
  ERROR = 'error',
}

/**
 * 同步记录
 */
export interface SyncRecord {
  /** 记录 ID */
  recordId: string;
  
  /** 记录类型 */
  type: 'state' | 'task' | 'trace' | 'config';
  
  /** 操作类型 */
  operation: 'create' | 'update' | 'delete';
  
  /** 数据 */
  data: any;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 是否已同步 */
  synced: boolean;
  
  /** 同步时间 */
  syncedAt?: number;
}

/**
 * 边缘运行时状态
 */
export interface EdgeRuntimeStatus {
  /** 节点信息 */
  node: {
    id: string;
    name: string;
    type: EdgeNodeType;
  };
  
  /** 同步状态 */
  sync: {
    status: SyncStatus;
    lastSyncAt?: number;
    pendingRecords: number;
  };
  
  /** 资源使用 */
  resources: {
    memoryUsedMB: number;
    memoryTotalMB: number;
    cpuPercent: number;
    storageUsedMB: number;
    storageTotalMB: number;
  };
  
  /** 任务统计 */
  tasks: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    queuedOffline: number;
  };
  
  /** 运行时间 */
  uptime: number;
}

// ============ 默认配置 ============

/**
 * 默认边缘节点配置
 */
export const DEFAULT_EDGE_CONFIG: EdgeNodeConfig = {
  nodeId: 'edge_default',
  name: 'Default Edge Node',
  type: EdgeNodeType.EDGE_SERVER,
  capabilities: {
    cpuCores: 4,
    memoryMB: 2048,
    storageMB: 10240,
    persistentStorage: true,
    networkBandwidth: 100,
    offlineSupport: true,
    batteryPowered: false,
  },
  limits: {
    maxMemoryMB: 1536,
    maxCpuPercent: 80,
    maxStorageMB: 8192,
    maxTasks: 100,
  },
  sync: {
    enabled: true,
    intervalMs: 60000,
    retryCount: 3,
  },
  offline: {
    enabled: true,
    maxQueueSize: 1000,
    ttlMs: 86400000, // 24 小时
  },
};

/**
 * 嵌入式设备配置
 */
export const EMBEDDED_CONFIG: Partial<EdgeNodeConfig> = {
  type: EdgeNodeType.EMBEDDED,
  capabilities: {
    cpuCores: 1,
    memoryMB: 256,
    storageMB: 512,
    persistentStorage: false,
    networkBandwidth: 10,
    offlineSupport: true,
    batteryPowered: true,
  },
  limits: {
    maxMemoryMB: 192,
    maxCpuPercent: 60,
    maxStorageMB: 384,
    maxTasks: 10,
  },
};

/**
 * IoT 网关配置
 */
export const IOT_GATEWAY_CONFIG: Partial<EdgeNodeConfig> = {
  type: EdgeNodeType.IOT_GATEWAY,
  capabilities: {
    cpuCores: 2,
    memoryMB: 1024,
    storageMB: 4096,
    persistentStorage: true,
    networkBandwidth: 50,
    offlineSupport: true,
    batteryPowered: false,
  },
  limits: {
    maxMemoryMB: 768,
    maxCpuPercent: 70,
    maxStorageMB: 3072,
    maxTasks: 50,
  },
};

/**
 * 移动设备配置
 */
export const MOBILE_CONFIG: Partial<EdgeNodeConfig> = {
  type: EdgeNodeType.MOBILE,
  capabilities: {
    cpuCores: 4,
    memoryMB: 2048,
    storageMB: 8192,
    persistentStorage: true,
    networkBandwidth: 20,
    offlineSupport: true,
    batteryPowered: true,
  },
  limits: {
    maxMemoryMB: 1536,
    maxCpuPercent: 50,
    maxStorageMB: 6144,
    maxTasks: 30,
  },
};
