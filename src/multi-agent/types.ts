/**
 * 多 Agent 协作系统
 * 
 * 功能：
 * - Agent 通信协议
 * - 任务分配与调度
 * - 结果聚合与冲突解决
 * - 分布式追踪
 * 
 * @module multi-agent/types
 */

// ============ Agent 定义 ============

/**
 * Agent 能力
 */
export interface AgentCapability {
  /** 能力 ID */
  id: string;
  
  /** 能力名称 */
  name: string;
  
  /** 能力描述 */
  description: string;
  
  /** 输入类型 */
  inputType: string;
  
  /** 输出类型 */
  outputType: string;
  
  /** 性能指标 */
  performance: {
    avgLatency: number;
    successRate: number;
    costPerCall: number;
  };
}

/**
 * Agent 定义
 */
export interface AgentDefinition {
  /** Agent ID */
  agentId: string;
  
  /** Agent 名称 */
  name: string;
  
  /** Agent 描述 */
  description: string;
  
  /** 能力列表 */
  capabilities: AgentCapability[];
  
  /** 资源限制 */
  resourceLimits: {
    maxConcurrentTasks: number;
    maxMemoryMB: number;
    timeoutMs: number;
  };
  
  /** 优先级 */
  priority: number;
  
  /** 标签 */
  tags: string[];
}

/**
 * Agent 状态
 */
export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  OFFLINE = 'offline',
  ERROR = 'error',
}

/**
 * Agent 实例
 */
export interface AgentInstance {
  /** Agent 定义 */
  definition: AgentDefinition;
  
  /** 当前状态 */
  status: AgentStatus;
  
  /** 当前任务数 */
  currentTasks: number;
  
  /** 总完成任务数 */
  completedTasks: number;
  
  /** 失败任务数 */
  failedTasks: number;
  
  /** 最后心跳时间 */
  lastHeartbeat: number;
  
  /** 性能统计 */
  stats: {
    avgResponseTime: number;
    successRate: number;
    totalCost: number;
  };
}

// ============ 任务定义 ============

/**
 * 任务优先级
 */
export enum TaskPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20,
}

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 任务定义
 */
export interface TaskDefinition {
  /** 任务 ID */
  taskId: string;
  
  /** 任务名称 */
  name: string;
  
  /** 任务描述 */
  description: string;
  
  /** 输入数据 */
  input: any;
  
  /** 期望输出类型 */
  expectedOutputType: string;
  
  /** 优先级 */
  priority: TaskPriority;
  
  /** 依赖任务 */
  dependencies: string[];
  
  /** 约束条件 */
  constraints: {
    timeoutMs: number;
    maxRetries: number;
    requiredCapabilities: string[];
    preferredAgents?: string[];
    excludedAgents?: string[];
  };
  
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 任务实例
 */
export interface TaskInstance {
  /** 任务定义 */
  definition: TaskDefinition;
  
  /** 当前状态 */
  status: TaskStatus;
  
  /** 分配的 Agent */
  assignedAgent?: string;
  
  /** 开始时间 */
  startTime?: number;
  
  /** 结束时间 */
  endTime?: number;
  
  /** 输出结果 */
  output?: any;
  
  /** 错误信息 */
  error?: string;
  
  /** 重试次数 */
  retryCount: number;
  
  /** 执行历史 */
  history: Array<{
    timestamp: number;
    status: TaskStatus;
    agent?: string;
    message?: string;
  }>;
}

// ============ 通信协议 ============

/**
 * 消息类型
 */
export enum MessageType {
  TASK_ASSIGN = 'task_assign',
  TASK_ACCEPT = 'task_accept',
  TASK_REJECT = 'task_reject',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETE = 'task_complete',
  TASK_FAIL = 'task_fail',
  HEARTBEAT = 'heartbeat',
  STATUS_QUERY = 'status_query',
  STATUS_RESPONSE = 'status_response',
  BROADCAST = 'broadcast',
}

/**
 * 消息定义
 */
export interface Message {
  /** 消息 ID */
  messageId: string;
  
  /** 消息类型 */
  type: MessageType;
  
  /** 发送者 ID */
  from: string;
  
  /** 接收者 ID（广播时为空） */
  to?: string;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 消息体 */
  payload: any;
  
  /** 关联的任务 ID */
  taskId?: string;
  
  /** 关联的追踪 ID */
  traceId?: string;
}

// ============ 协调器 ============

/**
 * 调度策略
 */
export enum SchedulingStrategy {
  /** 轮询 */
  ROUND_ROBIN = 'round_robin',
  
  /** 最少任务 */
  LEAST_TASKS = 'least_tasks',
  
  /** 最高性能 */
  BEST_PERFORMANCE = 'best_performance',
  
  /** 最低成本 */
  LOWEST_COST = 'lowest_cost',
  
  /** 随机 */
  RANDOM = 'random',
  
  /** 自定义 */
  CUSTOM = 'custom',
}

/**
 * 协调器配置
 */
export interface CoordinatorConfig {
  /** 调度策略 */
  schedulingStrategy: SchedulingStrategy;
  
  /** 心跳间隔（毫秒） */
  heartbeatInterval: number;
  
  /** 心跳超时（毫秒） */
  heartbeatTimeout: number;
  
  /** 任务超时（毫秒） */
  taskTimeout: number;
  
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 启用负载均衡 */
  enableLoadBalancing: boolean;
  
  /** 启用故障转移 */
  enableFailover: boolean;
}

/**
 * 默认协调器配置
 */
export const DEFAULT_COORDINATOR_CONFIG: CoordinatorConfig = {
  schedulingStrategy: SchedulingStrategy.LEAST_TASKS,
  heartbeatInterval: 5000,
  heartbeatTimeout: 15000,
  taskTimeout: 60000,
  maxRetries: 3,
  enableLoadBalancing: true,
  enableFailover: true,
};

// ============ 结果聚合 ============

/**
 * 聚合策略
 */
export enum AggregationStrategy {
  /** 取第一个结果 */
  FIRST = 'first',
  
  /** 取最后一个结果 */
  LAST = 'last',
  
  /** 多数投票 */
  MAJORITY_VOTE = 'majority_vote',
  
  /** 加权平均 */
  WEIGHTED_AVERAGE = 'weighted_average',
  
  /** 取最佳 */
  BEST = 'best',
  
  /** 全部收集 */
  ALL = 'all',
  
  /** 自定义 */
  CUSTOM = 'custom',
}

/**
 * 冲突解决策略
 */
export enum ConflictResolutionStrategy {
  /** 优先级高的胜出 */
  PRIORITY = 'priority',
  
  /** 最新结果胜出 */
  LATEST = 'latest',
  
  /** 性能最好的胜出 */
  BEST_PERFORMANCE = 'best_performance',
  
  /** 人工决策 */
  MANUAL = 'manual',
}

/**
 * 聚合结果
 */
export interface AggregationResult {
  /** 最终结果 */
  result: any;
  
  /** 使用的策略 */
  strategy: AggregationStrategy;
  
  /** 参与的 Agent 数量 */
  participantCount: number;
  
  /** 一致性分数 */
  consistencyScore: number;
  
  /** 冲突信息 */
  conflicts: Array<{
    agents: string[];
    difference: string;
    resolution: string;
  }>;
}

// ============ 工作流 ============

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  /** 步骤 ID */
  stepId: string;
  
  /** 步骤名称 */
  name: string;
  
  /** 任务定义 */
  task: TaskDefinition;
  
  /** 条件表达式 */
  condition?: string;
  
  /** 并行组 */
  parallelGroup?: string;
  
  /** 失败处理 */
  onFailure: 'continue' | 'stop' | 'retry';
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  /** 工作流 ID */
  workflowId: string;
  
  /** 工作流名称 */
  name: string;
  
  /** 工作流描述 */
  description: string;
  
  /** 步骤列表 */
  steps: WorkflowStep[];
  
  /** 变量定义 */
  variables: Record<string, any>;
  
  /** 超时时间 */
  timeoutMs: number;
}

/**
 * 工作流实例
 */
export interface WorkflowInstance {
  /** 工作流定义 */
  definition: WorkflowDefinition;
  
  /** 当前状态 */
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  
  /** 当前步骤 */
  currentStep: number;
  
  /** 步骤结果 */
  stepResults: Map<string, TaskInstance>;
  
  /** 开始时间 */
  startTime: number;
  
  /** 结束时间 */
  endTime?: number;
  
  /** 最终结果 */
  result?: any;
  
  /** 错误信息 */
  error?: string;
}
