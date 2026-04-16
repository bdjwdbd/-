/**
 * Harness Engineering - PPAF 闭环系统类型定义
 * 
 * PPAF: Perception → Planning → Action → Feedback
 * 
 * @module harness/ppaf/types
 */

// ============ Perception（感知） ============

/**
 * 感知数据类型
 */
export enum PerceptionType {
  /** 文本 */
  TEXT = 'text',
  
  /** 图像 */
  IMAGE = 'image',
  
  /** 音频 */
  AUDIO = 'audio',
  
  /** 上下文 */
  CONTEXT = 'context',
  
  /** 系统状态 */
  SYSTEM = 'system',
  
  /** 用户状态 */
  USER = 'user',
}

/**
 * 感知输入
 */
export interface PerceptionInput {
  /** 感知类型 */
  type: PerceptionType;
  
  /** 原始数据 */
  data: unknown;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 感知结果
 */
export interface PerceptionResult {
  /** 感知 ID */
  perceptionId: string;
  
  /** 处理后的数据 */
  processed: unknown;
  
  /** 提取的特征 */
  features: Record<string, unknown>;
  
  /** 置信度 */
  confidence: number;
  
  /** 异常标记 */
  anomalies: string[];
  
  /** 处理耗时 */
  latency: number;
}

// ============ Planning（规划） ============

/**
 * 规划层级
 */
export enum PlanningLevel {
  /** 战略规划（长期目标） */
  STRATEGIC = 'strategic',
  
  /** 战术规划（中期计划） */
  TACTICAL = 'tactical',
  
  /** 执行规划（短期动作） */
  OPERATIONAL = 'operational',
}

/**
 * 规划步骤
 */
export interface PlanningStep {
  /** 步骤 ID */
  stepId: string;
  
  /** 步骤名称 */
  name: string;
  
  /** 步骤描述 */
  description: string;
  
  /** 依赖的步骤 */
  dependencies: string[];
  
  /** 预期输出 */
  expectedOutput: string;
  
  /** 预计耗时 */
  estimatedDuration: number;
  
  /** 优先级 */
  priority: number;
  
  /** 是否可并行 */
  parallelizable: boolean;
}

/**
 * 规划结果
 */
export interface PlanningResult {
  /** 规划 ID */
  planId: string;
  
  /** 规划层级 */
  level: PlanningLevel;
  
  /** 步骤列表 */
  steps: PlanningStep[];
  
  /** 执行顺序 */
  executionOrder: string[];
  
  /** 并行组 */
  parallelGroups: string[][];
  
  /** 总预计耗时 */
  totalEstimatedDuration: number;
  
  /** 风险评估 */
  risks: Array<{
    description: string;
    probability: number;
    impact: number;
    mitigation: string;
  }>;
  
  /** 备选方案 */
  alternatives: Array<{
    description: string;
    conditions: string[];
  }>;
}

// ============ Action（行动） ============

/**
 * 动作类型
 */
export enum ActionType {
  /** 工具调用 */
  TOOL_CALL = 'tool_call',
  
  /** API 请求 */
  API_REQUEST = 'api_request',
  
  /** 数据处理 */
  DATA_PROCESSING = 'data_processing',
  
  /** 状态更新 */
  STATE_UPDATE = 'state_update',
  
  /** 消息发送 */
  MESSAGE_SEND = 'message_send',
}

/**
 * 动作状态
 */
export enum ActionStatus {
  /** 待执行 */
  PENDING = 'pending',
  
  /** 执行中 */
  RUNNING = 'running',
  
  /** 已完成 */
  COMPLETED = 'completed',
  
  /** 已失败 */
  FAILED = 'failed',
  
  /** 已取消 */
  CANCELLED = 'cancelled',
  
  /** 已重试 */
  RETRYING = 'retrying',
}

/**
 * 动作定义
 */
export interface ActionDefinition {
  /** 动作 ID */
  actionId: string;
  
  /** 动作类型 */
  type: ActionType;
  
  /** 动作名称 */
  name: string;
  
  /** 输入参数 */
  input: Record<string, unknown>;
  
  /** 前置条件 */
  preconditions: Array<{
    condition: string;
    required: boolean;
  }>;
  
  /** 后置条件 */
  postconditions: Array<{
    condition: string;
    expected: boolean;
  }>;
  
  /** 超时时间 */
  timeout: number;
  
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 降级策略 */
  fallback?: {
    action: string;
    conditions: string[];
  };
}

/**
 * 动作执行结果
 */
export interface ActionResult {
  /** 动作 ID */
  actionId: string;
  
  /** 执行状态 */
  status: ActionStatus;
  
  /** 输出结果 */
  output?: unknown;
  
  /** 错误信息 */
  error?: string;
  
  /** 执行耗时 */
  duration: number;
  
  /** 重试次数 */
  retryCount: number;
  
  /** 是否使用了降级 */
  usedFallback: boolean;
  
  /** 资源使用 */
  resourceUsage: {
    cpu: number;
    memory: number;
    network: number;
    tokens?: number;
  };
}

// ============ Feedback（反馈） ============

/**
 * 反馈类型
 */
export enum FeedbackType {
  /** 即时反馈 */
  IMMEDIATE = 'immediate',
  
  /** 短期反馈 */
  SHORT_TERM = 'short_term',
  
  /** 长期反馈 */
  LONG_TERM = 'long_term',
}

/**
 * 反馈来源
 */
export enum FeedbackSource {
  /** 系统自检 */
  SYSTEM = 'system',
  
  /** 用户反馈 */
  USER = 'user',
  
  /** 性能监控 */
  PERFORMANCE = 'performance',
  
  /** 质量评估 */
  QUALITY = 'quality',
  
  /** 安全审计 */
  SECURITY = 'security',
}

/**
 * 反馈数据
 */
export interface FeedbackData {
  /** 反馈 ID */
  feedbackId: string;
  
  /** 反馈类型 */
  type: FeedbackType;
  
  /** 反馈来源 */
  source: FeedbackSource;
  
  /** 关联的动作 ID */
  actionId?: string;
  
  /** 关联的规划 ID */
  planId?: string;
  
  /** 评分 */
  score: number;
  
  /** 问题描述 */
  issues: string[];
  
  /** 改进建议 */
  suggestions: string[];
  
  /** 是否需要学习 */
  shouldLearn: boolean;
  
  /** 学习优先级 */
  learningPriority?: number;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 反馈处理结果
 */
export interface FeedbackResult {
  /** 是否已处理 */
  processed: boolean;
  
  /** 采取的行动 */
  actions: Array<{
    type: string;
    description: string;
    result: string;
  }>;
  
  /** 学习记录 */
  learning?: {
    knowledge: string;
    category: string;
    importance: number;
  };
  
  /** 系统调整 */
  adjustments?: Array<{
    component: string;
    parameter: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

// ============ PPAF 闭环 ============

/**
 * PPAF 上下文
 */
export interface PPAFContext {
  /** 闭环 ID */
  loopId: string;
  
  /** 感知结果 */
  perception?: PerceptionResult;
  
  /** 规划结果 */
  planning?: PlanningResult;
  
  /** 动作结果列表 */
  actions: ActionResult[];
  
  /** 反馈数据列表 */
  feedbacks: FeedbackData[];
  
  /** 当前阶段 */
  currentPhase: 'perception' | 'planning' | 'action' | 'feedback';
  
  /** 迭代次数 */
  iteration: number;
  
  /** 最大迭代次数 */
  maxIterations: number;
  
  /** 是否完成 */
  completed: boolean;
  
  /** 完成原因 */
  completionReason?: string;
}

/**
 * PPAF 配置
 */
export interface PPAFConfig {
  /** 工作目录 */
  workspaceRoot: string;
  
  /** 最大迭代次数 */
  maxIterations: number;
  
  /** 是否启用自动重规划 */
  enableAutoReplanning: boolean;
  
  /** 是否启用学习 */
  enableLearning: boolean;
  
  /** 反馈阈值 */
  feedbackThreshold: number;
  
  /** 超时时间 */
  timeout: number;
}

/**
 * 默认配置
 */
export const DEFAULT_PPAF_CONFIG: PPAFConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  maxIterations: 10,
  enableAutoReplanning: true,
  enableLearning: true,
  feedbackThreshold: 0.7,
  timeout: 300000, // 5 分钟
};
