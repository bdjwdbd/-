/**
 * Harness Engineering - 状态管理器类型定义
 * 
 * 核心原则：LLM 无状态，外部托管所有复杂状态
 * 
 * @module harness/state-manager/types
 */

// ============ 状态分类 ============

/**
 * 状态类别
 * 
 * 按生命周期和持久化需求分类
 */
export enum StateCategory {
  /** 会话状态（临时，随会话结束销毁） */
  SESSION = 'session',
  
  /** 任务状态（中期，任务完成后销毁） */
  TASK = 'task',
  
  /** 用户状态（长期，持久化存储） */
  USER = 'user',
  
  /** 记忆状态（持久化，支持检索） */
  MEMORY = 'memory',
  
  /** 工具状态（临时，工具调用期间有效） */
  TOOL = 'tool',
  
  /** 系统状态（全局，系统级配置） */
  SYSTEM = 'system',
}

// ============ 状态生命周期 ============

/**
 * 状态生命周期配置
 */
export interface StateLifecycle {
  /** 生存时间（毫秒），0 表示永久 */
  ttl: number;
  
  /** 是否持久化到磁盘 */
  persist: boolean;
  
  /** 是否加密存储 */
  encrypt: boolean;
  
  /** 是否记录审计日志 */
  audit: boolean;
  
  /** 最大大小（字节），0 表示无限制 */
  maxSize: number;
}

/**
 * 默认生命周期配置
 */
export const DEFAULT_LIFECYCLE: Record<StateCategory, StateLifecycle> = {
  [StateCategory.SESSION]: {
    ttl: 3600000,      // 1 小时
    persist: false,
    encrypt: false,
    audit: false,
    maxSize: 1024 * 1024,  // 1MB
  },
  [StateCategory.TASK]: {
    ttl: 86400000,     // 24 小时
    persist: true,
    encrypt: false,
    audit: true,
    maxSize: 10 * 1024 * 1024,  // 10MB
  },
  [StateCategory.USER]: {
    ttl: 0,            // 永久
    persist: true,
    encrypt: true,
    audit: true,
    maxSize: 100 * 1024 * 1024,  // 100MB
  },
  [StateCategory.MEMORY]: {
    ttl: 0,            // 永久
    persist: true,
    encrypt: false,
    audit: false,
    maxSize: 0,        // 无限制
  },
  [StateCategory.TOOL]: {
    ttl: 300000,       // 5 分钟
    persist: false,
    encrypt: false,
    audit: false,
    maxSize: 1024 * 1024,  // 1MB
  },
  [StateCategory.SYSTEM]: {
    ttl: 0,            // 永久
    persist: true,
    encrypt: false,
    audit: true,
    maxSize: 0,        // 无限制
  },
};

// ============ 状态条目 ============

/**
 * 状态条目
 */
export interface StateEntry<T = unknown> {
  /** 唯一标识符 */
  id: string;
  
  /** 状态键 */
  key: string;
  
  /** 状态值 */
  value: T;
  
  /** 状态类别 */
  category: StateCategory;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
  
  /** 过期时间 */
  expiresAt: number | null;
  
  /** 版本号（用于乐观锁） */
  version: number;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

// ============ 检查点 ============

/**
 * 检查点
 * 
 * 用于状态恢复
 */
export interface Checkpoint {
  /** 检查点 ID */
  id: string;
  
  /** 关联的状态键列表 */
  keys: string[];
  
  /** 创建时间 */
  createdAt: number;
  
  /** 检查点描述 */
  description?: string;
  
  /** 检查点数据（压缩后） */
  data: string;
  
  /** 校验和 */
  checksum: string;
}

// ============ 状态存储接口 ============

/**
 * 状态存储接口
 * 
 * 支持多种后端实现（内存、文件、数据库）
 */
export interface StateStore {
  /** 存储名称 */
  readonly name: string;
  
  /** 初始化存储 */
  initialize(): Promise<void>;
  
  /** 获取状态 */
  get<T = unknown>(key: string): Promise<StateEntry<T> | null>;
  
  /** 设置状态（幂等） */
  set<T = unknown>(key: string, value: T, lifecycle: StateLifecycle): Promise<StateEntry<T>>;
  
  /** 删除状态 */
  delete(key: string): Promise<boolean>;
  
  /** 检查状态是否存在 */
  exists(key: string): Promise<boolean>;
  
  /** 获取所有键 */
  keys(pattern?: string): Promise<string[]>;
  
  /** 清理过期状态 */
  cleanup(): Promise<number>;
  
  /** 关闭存储 */
  close(): Promise<void>;
}

// ============ 状态管理器配置 ============

/**
 * 状态管理器配置
 */
export interface StateManagerConfig {
  /** 工作目录 */
  workspaceRoot: string;
  
  /** 是否启用持久化 */
  enablePersistence: boolean;
  
  /** 是否启用加密 */
  enableEncryption: boolean;
  
  /** 加密密钥（可选，不提供则自动生成） */
  encryptionKey?: string;
  
  /** 清理间隔（毫秒） */
  cleanupInterval: number;
  
  /** 最大内存使用（字节） */
  maxMemoryUsage: number;
  
  /** 是否启用审计日志 */
  enableAudit: boolean;
  
  /** 审计日志路径 */
  auditLogPath?: string;
}

/**
 * 默认配置
 */
export const DEFAULT_STATE_MANAGER_CONFIG: StateManagerConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  enablePersistence: true,
  enableEncryption: false,
  cleanupInterval: 60000,  // 1 分钟
  maxMemoryUsage: 512 * 1024 * 1024,  // 512MB
  enableAudit: true,
};

// ============ 状态操作结果 ============

/**
 * 状态操作结果
 */
export interface StateOperationResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  
  /** 结果数据 */
  data?: T;
  
  /** 错误信息 */
  error?: string;
  
  /** 操作耗时（毫秒） */
  latency: number;
}

// ============ 状态统计 ============

/**
 * 状态统计信息
 */
export interface StateStats {
  /** 总条目数 */
  totalEntries: number;
  
  /** 按类别统计 */
  byCategory: Record<StateCategory, number>;
  
  /** 总内存使用 */
  totalMemoryUsage: number;
  
  /** 检查点数量 */
  checkpointCount: number;
  
  /** 命中率 */
  hitRate: number;
  
  /** 平均访问时间 */
  avgAccessTime: number;
}
