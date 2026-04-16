/**
 * Harness Engineering - 沙盒隔离类型定义
 * 
 * 四级沙盒隔离：
 * - L1: 进程级隔离
 * - L2: 容器级隔离
 * - L3: 虚拟机级隔离
 * - L4: 物理级隔离
 * 
 * @module harness/sandbox/types
 */

// ============ 沙盒级别 ============

/**
 * 沙盒隔离级别
 */
export enum SandboxLevel {
  /** L1: 进程级隔离 - 同一进程内隔离 */
  PROCESS = 1,
  
  /** L2: 容器级隔离 - Docker 容器隔离 */
  CONTAINER = 2,
  
  /** L3: 虚拟机级隔离 - 虚拟机隔离 */
  VM = 3,
  
  /** L4: 物理级隔离 - 物理机隔离 */
  PHYSICAL = 4,
}

/**
 * 沙盒状态
 */
export enum SandboxStatus {
  /** 创建中 */
  CREATING = 'creating',
  
  /** 运行中 */
  RUNNING = 'running',
  
  /** 暂停 */
  PAUSED = 'paused',
  
  /** 停止中 */
  STOPPING = 'stopping',
  
  /** 已停止 */
  STOPPED = 'stopped',
  
  /** 错误 */
  ERROR = 'error',
}

// ============ 资源限制 ============

/**
 * 资源限制配置
 */
export interface ResourceLimits {
  /** CPU 限制（核心数） */
  cpu: number;
  
  /** 内存限制（MB） */
  memory: number;
  
  /** 磁盘限制（MB） */
  disk: number;
  
  /** 网络带宽限制（KB/s） */
  networkBandwidth: number;
  
  /** 最大进程数 */
  maxProcesses: number;
  
  /** 最大文件描述符数 */
  maxFileDescriptors: number;
  
  /** 执行超时（毫秒） */
  timeout: number;
}

/**
 * 默认资源限制（按级别）
 */
export const DEFAULT_RESOURCE_LIMITS: Record<SandboxLevel, ResourceLimits> = {
  [SandboxLevel.PROCESS]: {
    cpu: 1,
    memory: 512,
    disk: 100,
    networkBandwidth: 1024,
    maxProcesses: 10,
    maxFileDescriptors: 100,
    timeout: 30000,
  },
  [SandboxLevel.CONTAINER]: {
    cpu: 2,
    memory: 1024,
    disk: 500,
    networkBandwidth: 2048,
    maxProcesses: 50,
    maxFileDescriptors: 500,
    timeout: 60000,
  },
  [SandboxLevel.VM]: {
    cpu: 4,
    memory: 4096,
    disk: 10000,
    networkBandwidth: 10240,
    maxProcesses: 200,
    maxFileDescriptors: 2000,
    timeout: 300000,
  },
  [SandboxLevel.PHYSICAL]: {
    cpu: 8,
    memory: 16384,
    disk: 100000,
    networkBandwidth: 102400,
    maxProcesses: 1000,
    maxFileDescriptors: 10000,
    timeout: 600000,
  },
};

// ============ 权限配置 ============

/**
 * 文件系统权限
 */
export interface FileSystemPermission {
  /** 允许访问的路径 */
  allowedPaths: string[];
  
  /** 禁止访问的路径 */
  deniedPaths: string[];
  
  /** 是否只读 */
  readOnly: boolean;
  
  /** 是否允许执行 */
  allowExecute: boolean;
}

/**
 * 网络权限
 */
export interface NetworkPermission {
  /** 是否允许网络访问 */
  enabled: boolean;
  
  /** 允许的域名 */
  allowedDomains: string[];
  
  /** 允许的端口 */
  allowedPorts: number[];
  
  /** 是否允许入站连接 */
  allowInbound: boolean;
  
  /** 是否允许出站连接 */
  allowOutbound: boolean;
}

/**
 * 工具权限
 */
export interface ToolPermission {
  /** 允许使用的工具列表 */
  allowedTools: string[];
  
  /** 禁止使用的工具列表 */
  deniedTools: string[];
  
  /** 工具参数限制 */
  parameterLimits: Record<string, Record<string, unknown>>;
}

/**
 * 权限配置
 */
export interface PermissionConfig {
  /** 文件系统权限 */
  fileSystem: FileSystemPermission;
  
  /** 网络权限 */
  network: NetworkPermission;
  
  /** 工具权限 */
  tools: ToolPermission;
  
  /** 环境变量白名单 */
  allowedEnvVars: string[];
  
  /** 是否允许创建子进程 */
  allowFork: boolean;
}

/**
 * 默认权限配置（按级别）
 */
export const DEFAULT_PERMISSIONS: Record<SandboxLevel, PermissionConfig> = {
  [SandboxLevel.PROCESS]: {
    fileSystem: {
      allowedPaths: ['/tmp'],
      deniedPaths: ['/etc', '/root', '/home'],
      readOnly: true,
      allowExecute: false,
    },
    network: {
      enabled: false,
      allowedDomains: [],
      allowedPorts: [],
      allowInbound: false,
      allowOutbound: false,
    },
    tools: {
      allowedTools: ['read', 'write'],
      deniedTools: ['exec', 'shell'],
      parameterLimits: {},
    },
    allowedEnvVars: ['PATH', 'HOME'],
    allowFork: false,
  },
  [SandboxLevel.CONTAINER]: {
    fileSystem: {
      allowedPaths: ['/workspace', '/tmp'],
      deniedPaths: ['/etc/passwd', '/etc/shadow'],
      readOnly: false,
      allowExecute: true,
    },
    network: {
      enabled: true,
      allowedDomains: ['api.openai.com', 'api.anthropic.com'],
      allowedPorts: [80, 443],
      allowInbound: false,
      allowOutbound: true,
    },
    tools: {
      allowedTools: ['read', 'write', 'exec', 'http'],
      deniedTools: ['sudo', 'su'],
      parameterLimits: {
        exec: { timeout: 30000 },
      },
    },
    allowedEnvVars: ['PATH', 'HOME', 'API_KEY'],
    allowFork: true,
  },
  [SandboxLevel.VM]: {
    fileSystem: {
      allowedPaths: ['/'],
      deniedPaths: [],
      readOnly: false,
      allowExecute: true,
    },
    network: {
      enabled: true,
      allowedDomains: [],
      allowedPorts: [],
      allowInbound: true,
      allowOutbound: true,
    },
    tools: {
      allowedTools: ['*'],
      deniedTools: [],
      parameterLimits: {},
    },
    allowedEnvVars: ['*'],
    allowFork: true,
  },
  [SandboxLevel.PHYSICAL]: {
    fileSystem: {
      allowedPaths: ['/'],
      deniedPaths: [],
      readOnly: false,
      allowExecute: true,
    },
    network: {
      enabled: true,
      allowedDomains: [],
      allowedPorts: [],
      allowInbound: true,
      allowOutbound: true,
    },
    tools: {
      allowedTools: ['*'],
      deniedTools: [],
      parameterLimits: {},
    },
    allowedEnvVars: ['*'],
    allowFork: true,
  },
};

// ============ 沙盒配置 ============

/**
 * 沙盒配置
 */
export interface SandboxConfig {
  /** 沙盒 ID */
  sandboxId: string;
  
  /** 沙盒名称 */
  name: string;
  
  /** 隔离级别 */
  level: SandboxLevel;
  
  /** 资源限制 */
  resourceLimits: ResourceLimits;
  
  /** 权限配置 */
  permissions: PermissionConfig;
  
  /** 镜像/模板（用于容器/虚拟机） */
  image?: string;
  
  /** 环境变量 */
  env?: Record<string, string>;
  
  /** 挂载点 */
  mounts?: Array<{
    source: string;
    target: string;
    readOnly: boolean;
  }>;
  
  /** 自动销毁 */
  autoDestroy: boolean;
  
  /** 生命周期（毫秒） */
  lifecycle: number;
}

/**
 * 沙盒管理器配置
 */
export interface SandboxManagerConfig {
  /** 工作目录 */
  workspaceRoot: string;
  
  /** 默认隔离级别 */
  defaultLevel: SandboxLevel;
  
  /** 最大沙盒数量 */
  maxSandboxes: number;
  
  /** 是否启用资源监控 */
  enableMonitoring: boolean;
  
  /** 监控间隔（毫秒） */
  monitoringInterval: number;
  
  /** 是否启用审计 */
  enableAudit: boolean;
}

/**
 * 默认沙盒管理器配置
 */
export const DEFAULT_SANDBOX_MANAGER_CONFIG: SandboxManagerConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  defaultLevel: SandboxLevel.PROCESS,
  maxSandboxes: 100,
  enableMonitoring: true,
  monitoringInterval: 5000,
  enableAudit: true,
};

// ============ 沙盒实例 ============

/**
 * 沙盒实例
 */
export interface Sandbox {
  /** 沙盒 ID */
  sandboxId: string;
  
  /** 配置 */
  config: SandboxConfig;
  
  /** 状态 */
  status: SandboxStatus;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 最后活动时间 */
  lastActivityAt: number;
  
  /** 资源使用 */
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  
  /** 执行统计 */
  stats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalDuration: number;
  };
  
  /** 审计日志 */
  auditLog: Array<{
    timestamp: number;
    action: string;
    result: string;
    details?: Record<string, unknown>;
  }>;
}

// ============ 执行结果 ============

/**
 * 沙盒执行结果
 */
export interface SandboxExecutionResult {
  /** 沙盒 ID */
  sandboxId: string;
  
  /** 执行 ID */
  executionId: string;
  
  /** 是否成功 */
  success: boolean;
  
  /** 输出 */
  output?: unknown;
  
  /** 错误信息 */
  error?: string;
  
  /** 退出码 */
  exitCode?: number;
  
  /** 执行时间 */
  duration: number;
  
  /** 资源使用 */
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  
  /** 安全事件 */
  securityEvents: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

// ============ 风险评估 ============

/**
 * 操作风险级别
 */
export enum RiskLevel {
  /** 低风险 */
  LOW = 'low',
  
  /** 中风险 */
  MEDIUM = 'medium',
  
  /** 高风险 */
  HIGH = 'high',
  
  /** 极高风险 */
  CRITICAL = 'critical',
}

/**
 * 风险评估结果
 */
export interface RiskAssessment {
  /** 操作描述 */
  operation: string;
  
  /** 风险级别 */
  level: RiskLevel;
  
  /** 推荐的沙盒级别 */
  recommendedLevel: SandboxLevel;
  
  /** 风险因素 */
  riskFactors: Array<{
    factor: string;
    weight: number;
    description: string;
  }>;
  
  /** 缓解措施 */
  mitigations: string[];
}
