/**
 * Harness Engineering - 追踪系统类型定义
 * 
 * 全链路追踪，支持：
 * - 调用链追踪
 * - 性能分析
 * - 决策审计
 * - 异常检测
 * 
 * @module harness/trace-system/types
 */

// ============ 追踪标识 ============

/**
 * 追踪上下文
 * 
 * 在整个调用链中传递
 */
export interface TraceContext {
  /** 全局追踪 ID */
  traceId: string;
  
  /** 当前跨度 ID */
  spanId: string;
  
  /** 父跨度 ID */
  parentSpanId?: string;
  
  /** 采样标志 */
  sampled: boolean;
  
  /** Baggage（跨服务传递的元数据） */
  baggage?: Record<string, string>;
}

// ============ 跨度定义 ============

/**
 * 元灵系统层级
 */
export enum Layer {
  L0 = 'L0',  // 灵思层 - 思考协议
  L1 = 'L1',  // 灵枢层 - 决策中心
  L2 = 'L2',  // 灵脉层 - 执行引擎
  L3 = 'L3',  // 灵躯层 - 工具执行
  L4 = 'L4',  // 灵盾层 - 安全验证
  L5 = 'L5',  // 灵韵层 - 反馈调节
  L6 = 'L6',  // 灵识层 - 环境感知
}

/**
 * 跨度状态
 */
export enum SpanStatus {
  /** 未开始 */
  PENDING = 'pending',
  
  /** 进行中 */
  RUNNING = 'running',
  
  /** 已完成 */
  COMPLETED = 'completed',
  
  /** 已失败 */
  FAILED = 'failed',
  
  /** 已取消 */
  CANCELLED = 'cancelled',
}

/**
 * 跨度类型
 */
export enum SpanKind {
  /** 内部操作 */
  INTERNAL = 'internal',
  
  /** 服务端接收 */
  SERVER = 'server',
  
  /** 客户端发送 */
  CLIENT = 'client',
  
  /** 生产者 */
  PRODUCER = 'producer',
  
  /** 消费者 */
  CONSUMER = 'consumer',
}

/**
 * 日志条目
 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: number;
  
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  
  /** 日志消息 */
  message: string;
  
  /** 附加数据 */
  attributes?: Record<string, unknown>;
}

/**
 * 事件
 */
export interface Event {
  /** 时间戳 */
  timestamp: number;
  
  /** 事件名称 */
  name: string;
  
  /** 事件属性 */
  attributes?: Record<string, unknown>;
}

/**
 * 跨度
 */
export interface Span {
  /** 跨度 ID */
  spanId: string;
  
  /** 父跨度 ID */
  parentSpanId?: string;
  
  /** 追踪 ID */
  traceId: string;
  
  /** 操作名称 */
  operationName: string;
  
  /** 跨度类型 */
  kind: SpanKind;
  
  /** 所属层级 */
  layer: Layer;
  
  /** 开始时间 */
  startTime: number;
  
  /** 结束时间 */
  endTime?: number;
  
  /** 状态 */
  status: SpanStatus;
  
  /** 状态描述 */
  statusMessage?: string;
  
  /** 标签 */
  tags: Record<string, string | number | boolean>;
  
  /** 属性 */
  attributes: Record<string, unknown>;
  
  /** 日志 */
  logs: LogEntry[];
  
  /** 事件 */
  events: Event[];
  
  /** 子跨度 ID 列表 */
  childSpanIds: string[];
}

// ============ 追踪定义 ============

/**
 * 追踪
 */
export interface Trace {
  /** 追踪 ID */
  traceId: string;
  
  /** 根跨度 ID */
  rootSpanId: string;
  
  /** 所有跨度 */
  spans: Map<string, Span>;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 完成时间 */
  completedAt?: number;
  
  /** 追踪名称 */
  name: string;
  
  /** 追踪状态 */
  status: SpanStatus;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

// ============ 决策审计 ============

/**
 * 备选方案
 */
export interface Alternative {
  /** 方案描述 */
  description: string;
  
  /** 选择概率 */
  probability: number;
  
  /** 未选择原因 */
  reason: string;
}

/**
 * 决策审计记录
 */
export interface DecisionAudit {
  /** 决策 ID */
  decisionId: string;
  
  /** 关联的跨度 ID */
  spanId: string;
  
  /** 输入 */
  input: unknown;
  
  /** 推理过程 */
  reasoning: string;
  
  /** 输出 */
  output: unknown;
  
  /** 置信度 */
  confidence: number;
  
  /** 备选方案 */
  alternatives: Alternative[];
  
  /** 决策时间 */
  timestamp: number;
  
  /** 决策模型 */
  model?: string;
  
  /** Token 使用 */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

// ============ 性能指标 ============

/**
 * 跨度性能指标
 */
export interface SpanMetrics {
  /** 跨度 ID */
  spanId: string;
  
  /** 执行时间（毫秒） */
  duration: number;
  
  /** CPU 时间（毫秒） */
  cpuTime?: number;
  
  /** 内存使用（字节） */
  memoryUsage?: number;
  
  /** Token 使用 */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  
  /** 网络延迟（毫秒） */
  networkLatency?: number;
  
  /** 数据库查询次数 */
  dbQueryCount?: number;
  
  /** 缓存命中次数 */
  cacheHitCount?: number;
  
  /** 缓存未命中次数 */
  cacheMissCount?: number;
}

/**
 * 追踪性能指标
 */
export interface TraceMetrics {
  /** 追踪 ID */
  traceId: string;
  
  /** 总执行时间（毫秒） */
  totalDuration: number;
  
  /** 各层级耗时 */
  layerDurations: Record<Layer, number>;
  
  /** 关键路径 */
  criticalPath: string[];
  
  /** 并行度 */
  parallelism: number;
  
  /** 等待时间 */
  waitTime: number;
  
  /** 实际执行时间 */
  executionTime: number;
  
  /** Token 总使用 */
  totalTokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  
  /** 错误率 */
  errorRate: number;
  
  /** 重试次数 */
  retryCount: number;
}

// ============ 异常检测 ============

/**
 * 异常类型
 */
export enum AnomalyType {
  /** 性能异常 */
  PERFORMANCE = 'performance',
  
  /** 行为异常 */
  BEHAVIOR = 'behavior',
  
  /** 安全异常 */
  SECURITY = 'security',
  
  /** 资源异常 */
  RESOURCE = 'resource',
}

/**
 * 异常严重程度
 */
export enum AnomalySeverity {
  /** 低 */
  LOW = 'low',
  
  /** 中 */
  MEDIUM = 'medium',
  
  /** 高 */
  HIGH = 'high',
  
  /** 严重 */
  CRITICAL = 'critical',
}

/**
 * 异常记录
 */
export interface Anomaly {
  /** 异常 ID */
  id: string;
  
  /** 关联的追踪 ID */
  traceId: string;
  
  /** 关联的跨度 ID */
  spanId?: string;
  
  /** 异常类型 */
  type: AnomalyType;
  
  /** 严重程度 */
  severity: AnomalySeverity;
  
  /** 异常描述 */
  description: string;
  
  /** 检测时间 */
  detectedAt: number;
  
  /** 异常指标 */
  metrics: Record<string, number>;
  
  /** 基线值 */
  baseline?: Record<string, number>;
  
  /** 建议操作 */
  suggestions?: string[];
}

// ============ 追踪配置 ============

/**
 * 追踪系统配置
 */
export interface TraceSystemConfig {
  /** 工作目录 */
  workspaceRoot: string;
  
  /** 是否启用追踪 */
  enabled: boolean;
  
  /** 采样率（0-1） */
  sampleRate: number;
  
  /** 最大跨度数 */
  maxSpansPerTrace: number;
  
  /** 最大追踪数 */
  maxTraces: number;
  
  /** 是否记录决策审计 */
  enableDecisionAudit: boolean;
  
  /** 是否启用异常检测 */
  enableAnomalyDetection: boolean;
  
  /** 性能阈值（毫秒） */
  performanceThresholds: {
    [key: string]: number;
  };
  
  /** 是否持久化 */
  enablePersistence: boolean;
  
  /** 持久化路径 */
  persistencePath?: string;
}

/**
 * 默认配置
 */
export const DEFAULT_TRACE_CONFIG: TraceSystemConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  enabled: true,
  sampleRate: 1.0,  // 100% 采样
  maxSpansPerTrace: 1000,
  maxTraces: 10000,
  enableDecisionAudit: true,
  enableAnomalyDetection: true,
  performanceThresholds: {
    'L0': 5000,   // L0 思考层：5 秒
    'L1': 1000,   // L1 决策层：1 秒
    'L2': 10000,  // L2 执行层：10 秒
    'L3': 30000,  // L3 工具层：30 秒
    'L4': 500,    // L4 验证层：0.5 秒
    'L5': 1000,   // L5 反馈层：1 秒
    'L6': 100,    // L6 感知层：0.1 秒
  },
  enablePersistence: true,
};

// ============ 追踪查询 ============

/**
 * 追踪查询条件
 */
export interface TraceQuery {
  /** 追踪 ID */
  traceId?: string;
  
  /** 操作名称（支持通配符） */
  operationName?: string;
  
  /** 层级 */
  layer?: Layer;
  
  /** 状态 */
  status?: SpanStatus;
  
  /** 时间范围 */
  timeRange?: {
    start: number;
    end: number;
  };
  
  /** 最小持续时间 */
  minDuration?: number;
  
  /** 最大持续时间 */
  maxDuration?: number;
  
  /** 标签过滤 */
  tags?: Record<string, string | number | boolean>;
  
  /** 分页 */
  pagination?: {
    offset: number;
    limit: number;
  };
}

/**
 * 追踪查询结果
 */
export interface TraceQueryResult {
  /** 追踪列表 */
  traces: Trace[];
  
  /** 总数 */
  total: number;
  
  /** 查询耗时 */
  latency: number;
}
