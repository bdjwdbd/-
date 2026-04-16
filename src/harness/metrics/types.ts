/**
 * Harness Engineering - 度量演进系统类型定义
 * 
 * 四类指标体系：
 * - 效能指标（Efficiency）
 * - 质量指标（Quality）
 * - 资源指标（Resource）
 * - 安全指标（Security）
 * 
 * @module harness/metrics/types
 */

// ============ 指标类别 ============

/**
 * 指标类别
 */
export enum MetricCategory {
  /** 效能指标 */
  EFFICIENCY = 'efficiency',
  
  /** 质量指标 */
  QUALITY = 'quality',
  
  /** 资源指标 */
  RESOURCE = 'resource',
  
  /** 安全指标 */
  SECURITY = 'security',
}

/**
 * 指标类型
 */
export enum MetricType {
  /** 计数器 */
  COUNTER = 'counter',
  
  /** 仪表盘 */
  GAUGE = 'gauge',
  
  /** 直方图 */
  HISTOGRAM = 'histogram',
  
  /** 摘要 */
  SUMMARY = 'summary',
}

// ============ 指标定义 ============

/**
 * 指标定义
 */
export interface MetricDefinition {
  /** 指标名称 */
  name: string;
  
  /** 指标描述 */
  description: string;
  
  /** 指标类别 */
  category: MetricCategory;
  
  /** 指标类型 */
  type: MetricType;
  
  /** 单位 */
  unit: string;
  
  /** 标签 */
  labels: string[];
  
  /** 基线值 */
  baseline: number;
  
  /** 目标值 */
  target: number;
  
  /** 权重（用于综合评分） */
  weight: number;
  
  /** 是否关键指标 */
  critical: boolean;
}

/**
 * 指标值
 */
export interface MetricValue {
  /** 指标名称 */
  name: string;
  
  /** 值 */
  value: number;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 标签值 */
  labels: Record<string, string>;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

// ============ 效能指标 ============

/**
 * 效能指标
 */
export interface EfficiencyMetrics {
  /** 任务完成率 */
  taskCompletionRate: number;
  
  /** 平均响应时间（毫秒） */
  avgResponseTime: number;
  
  /** P95 响应时间 */
  p95ResponseTime: number;
  
  /** P99 响应时间 */
  p99ResponseTime: number;
  
  /** 吞吐量（请求/秒） */
  throughput: number;
  
  /** Token 利用率 */
  tokenEfficiency: number;
  
  /** 缓存命中率 */
  cacheHitRate: number;
  
  /** 并发度 */
  concurrency: number;
}

/**
 * 默认效能指标定义
 */
export const EFFICIENCY_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    name: 'task_completion_rate',
    description: '任务完成率',
    category: MetricCategory.EFFICIENCY,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['task_type'],
    baseline: 70,
    target: 95,
    weight: 0.2,
    critical: true,
  },
  {
    name: 'avg_response_time',
    description: '平均响应时间',
    category: MetricCategory.EFFICIENCY,
    type: MetricType.HISTOGRAM,
    unit: 'ms',
    labels: ['operation'],
    baseline: 5000,
    target: 1000,
    weight: 0.15,
    critical: true,
  },
  {
    name: 'throughput',
    description: '吞吐量',
    category: MetricCategory.EFFICIENCY,
    type: MetricType.GAUGE,
    unit: 'req/s',
    labels: ['endpoint'],
    baseline: 10,
    target: 100,
    weight: 0.1,
    critical: false,
  },
  {
    name: 'token_efficiency',
    description: 'Token 利用率',
    category: MetricCategory.EFFICIENCY,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['model'],
    baseline: 50,
    target: 85,
    weight: 0.1,
    critical: false,
  },
  {
    name: 'cache_hit_rate',
    description: '缓存命中率',
    category: MetricCategory.EFFICIENCY,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['cache_type'],
    baseline: 30,
    target: 80,
    weight: 0.05,
    critical: false,
  },
];

// ============ 质量指标 ============

/**
 * 质量指标
 */
export interface QualityMetrics {
  /** 准确率 */
  accuracy: number;
  
  /** 一致性 */
  consistency: number;
  
  /** 用户满意度 */
  userSatisfaction: number;
  
  /** 错误率 */
  errorRate: number;
  
  /** 重试率 */
  retryRate: number;
  
  /** 降级率 */
  fallbackRate: number;
  
  /** 首次正确率 */
  firstTimeRight: number;
}

/**
 * 默认质量指标定义
 */
export const QUALITY_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    name: 'accuracy',
    description: '准确率',
    category: MetricCategory.QUALITY,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['task_type'],
    baseline: 60,
    target: 90,
    weight: 0.2,
    critical: true,
  },
  {
    name: 'consistency',
    description: '一致性',
    category: MetricCategory.QUALITY,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['operation'],
    baseline: 50,
    target: 95,
    weight: 0.15,
    critical: true,
  },
  {
    name: 'error_rate',
    description: '错误率',
    category: MetricCategory.QUALITY,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['error_type'],
    baseline: 20,
    target: 2,
    weight: 0.15,
    critical: true,
  },
  {
    name: 'first_time_right',
    description: '首次正确率',
    category: MetricCategory.QUALITY,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['task_type'],
    baseline: 40,
    target: 85,
    weight: 0.1,
    critical: false,
  },
];

// ============ 资源指标 ============

/**
 * 资源指标
 */
export interface ResourceMetrics {
  /** CPU 使用率 */
  cpuUsage: number;
  
  /** 内存使用率 */
  memoryUsage: number;
  
  /** 磁盘使用率 */
  diskUsage: number;
  
  /** 网络带宽使用 */
  networkBandwidth: number;
  
  /** API 调用次数 */
  apiCallCount: number;
  
  /** Token 总使用量 */
  totalTokenUsage: number;
  
  /** 单任务成本 */
  costPerTask: number;
  
  /** 资源利用率 */
  resourceUtilization: number;
}

/**
 * 默认资源指标定义
 */
export const RESOURCE_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    name: 'cpu_usage',
    description: 'CPU 使用率',
    category: MetricCategory.RESOURCE,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['host'],
    baseline: 80,
    target: 50,
    weight: 0.1,
    critical: false,
  },
  {
    name: 'memory_usage',
    description: '内存使用率',
    category: MetricCategory.RESOURCE,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['host'],
    baseline: 80,
    target: 60,
    weight: 0.1,
    critical: false,
  },
  {
    name: 'api_call_count',
    description: 'API 调用次数',
    category: MetricCategory.RESOURCE,
    type: MetricType.COUNTER,
    unit: 'count',
    labels: ['api', 'status'],
    baseline: 10000,
    target: 5000,
    weight: 0.05,
    critical: false,
  },
  {
    name: 'cost_per_task',
    description: '单任务成本',
    category: MetricCategory.RESOURCE,
    type: MetricType.GAUGE,
    unit: 'USD',
    labels: ['task_type'],
    baseline: 0.1,
    target: 0.01,
    weight: 0.05,
    critical: false,
  },
];

// ============ 安全指标 ============

/**
 * 安全指标
 */
export interface SecurityMetrics {
  /** 权限违规次数 */
  permissionViolations: number;
  
  /** 数据泄露事件 */
  dataLeakageEvents: number;
  
  /** 攻击尝试次数 */
  attackAttempts: number;
  
  /** 审计合规率 */
  auditComplianceRate: number;
  
  /** 沙盒逃逸次数 */
  sandboxEscapes: number;
  
  /** 敏感数据访问次数 */
  sensitiveDataAccess: number;
  
  /** 安全事件总数 */
  totalSecurityEvents: number;
}

/**
 * 默认安全指标定义
 */
export const SECURITY_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    name: 'permission_violations',
    description: '权限违规次数',
    category: MetricCategory.SECURITY,
    type: MetricType.COUNTER,
    unit: 'count',
    labels: ['violation_type'],
    baseline: 100,
    target: 0,
    weight: 0.15,
    critical: true,
  },
  {
    name: 'data_leakage_events',
    description: '数据泄露事件',
    category: MetricCategory.SECURITY,
    type: MetricType.COUNTER,
    unit: 'count',
    labels: ['severity'],
    baseline: 10,
    target: 0,
    weight: 0.2,
    critical: true,
  },
  {
    name: 'audit_compliance_rate',
    description: '审计合规率',
    category: MetricCategory.SECURITY,
    type: MetricType.GAUGE,
    unit: '%',
    labels: ['compliance_type'],
    baseline: 70,
    target: 100,
    weight: 0.1,
    critical: true,
  },
  {
    name: 'sandbox_escapes',
    description: '沙盒逃逸次数',
    category: MetricCategory.SECURITY,
    type: MetricType.COUNTER,
    unit: 'count',
    labels: ['sandbox_level'],
    baseline: 5,
    target: 0,
    weight: 0.15,
    critical: true,
  },
];

// ============ 综合评分 ============

/**
 * 综合评分
 */
export interface OverallScore {
  /** 总分 */
  total: number;
  
  /** 各类别评分 */
  byCategory: Record<MetricCategory, number>;
  
  /** 关键指标评分 */
  criticalScore: number;
  
  /** 趋势 */
  trend: 'improving' | 'stable' | 'declining';
  
  /** 与基线对比 */
  vsBaseline: number;
  
  /** 与目标对比 */
  vsTarget: number;
}

// ============ 演进配置 ============

/**
 * 演进配置
 */
export interface EvolutionConfig {
  /** 工作目录 */
  workspaceRoot: string;
  
  /** 数据收集间隔（毫秒） */
  collectionInterval: number;
  
  /** 分析间隔（毫秒） */
  analysisInterval: number;
  
  /** 是否启用自动优化 */
  enableAutoOptimization: boolean;
  
  /** 优化阈值 */
  optimizationThreshold: number;
  
  /** 是否启用 A/B 测试 */
  enableABTesting: boolean;
  
  /** A/B 测试样本比例 */
  abTestRatio: number;
  
  /** 是否启用灰度发布 */
  enableCanaryRelease: boolean;
  
  /** 灰度发布比例 */
  canaryRatio: number;
  
  /** 历史数据保留天数 */
  historyRetentionDays: number;
}

/**
 * 默认演进配置
 */
export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  collectionInterval: 60000, // 1 分钟
  analysisInterval: 300000, // 5 分钟
  enableAutoOptimization: true,
  optimizationThreshold: 0.1, // 10% 改进阈值
  enableABTesting: true,
  abTestRatio: 0.1, // 10% 流量
  enableCanaryRelease: true,
  canaryRatio: 0.05, // 5% 流量
  historyRetentionDays: 30,
};

// ============ 优化建议 ============

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  /** 建议 ID */
  suggestionId: string;
  
  /** 目标指标 */
  targetMetric: string;
  
  /** 当前值 */
  currentValue: number;
  
  /** 目标值 */
  targetValue: number;
  
  /** 预期改进 */
  expectedImprovement: number;
  
  /** 优先级 */
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  /** 建议类型 */
  type: 'config' | 'code' | 'resource' | 'process';
  
  /** 建议描述 */
  description: string;
  
  /** 实施步骤 */
  steps: string[];
  
  /** 风险评估 */
  risks: Array<{
    risk: string;
    probability: number;
    mitigation: string;
  }>;
  
  /** 创建时间 */
  createdAt: number;
}

// ============ A/B 测试 ============

/**
 * A/B 测试配置
 */
export interface ABTestConfig {
  /** 测试 ID */
  testId: string;
  
  /** 测试名称 */
  name: string;
  
  /** 对照组配置 */
  controlConfig: Record<string, unknown>;
  
  /** 实验组配置 */
  experimentConfig: Record<string, unknown>;
  
  /** 流量分配 */
  trafficSplit: number; // 0-1
  
  /** 目标指标 */
  targetMetrics: string[];
  
  /** 最小样本量 */
  minSampleSize: number;
  
  /** 统计显著性水平 */
  significanceLevel: number;
  
  /** 开始时间 */
  startTime: number;
  
  /** 结束时间 */
  endTime?: number;
  
  /** 状态 */
  status: 'running' | 'completed' | 'stopped';
}

/**
 * A/B 测试结果
 */
export interface ABTestResult {
  /** 测试 ID */
  testId: string;
  
  /** 对照组指标 */
  controlMetrics: Record<string, number>;
  
  /** 实验组指标 */
  experimentMetrics: Record<string, number>;
  
  /** 改进百分比 */
  improvement: Record<string, number>;
  
  /** 统计显著性 */
  statisticalSignificance: number;
  
  /** 是否显著 */
  isSignificant: boolean;
  
  /** 推荐方案 */
  recommendation: 'control' | 'experiment' | 'inconclusive';
  
  /** 置信度 */
  confidence: number;
}

// ============ 灰度发布 ============

/**
 * 灰度发布配置
 */
export interface CanaryReleaseConfig {
  /** 发布 ID */
  releaseId: string;
  
  /** 发布名称 */
  name: string;
  
  /** 新配置 */
  newConfig: Record<string, unknown>;
  
  /** 当前流量比例 */
  currentRatio: number;
  
  /** 目标流量比例 */
  targetRatio: number;
  
  /** 增量步长 */
  incrementStep: number;
  
  /** 回滚阈值 */
  rollbackThreshold: number;
  
  /** 监控指标 */
  monitorMetrics: string[];
  
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'rolled_back';
  
  /** 开始时间 */
  startTime: number;
  
  /** 完成时间 */
  endTime?: number;
}

/**
 * 灰度发布状态
 */
export interface CanaryReleaseStatus {
  /** 发布 ID */
  releaseId: string;
  
  /** 当前比例 */
  currentRatio: number;
  
  /** 当前指标 */
  currentMetrics: Record<string, number>;
  
  /** 基线指标 */
  baselineMetrics: Record<string, number>;
  
  /** 是否健康 */
  isHealthy: boolean;
  
  /** 是否需要回滚 */
  needsRollback: boolean;
  
  /** 警告信息 */
  warnings: string[];
}
