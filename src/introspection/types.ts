/**
 * 元灵自省系统 - 类型定义
 * 
 * 用于追踪系统变更、能力评估和优化建议
 */

// ============ 核心类型 ============

/**
 * 能力维度
 */
export type CapabilityDimension =
  | 'response_speed'        // 响应速度
  | 'understanding_accuracy' // 理解准确率
  | 'task_completion'       // 任务完成率
  | 'memory_recall'         // 记忆召回率
  | 'code_quality'          // 代码质量
  | 'error_recovery'        // 错误恢复率
  | 'security'              // 安全防护
  | 'resource_efficiency'   // 资源效率
  | 'extensibility'         // 可扩展性
  | 'maintainability'       // 可维护性
  | 'documentation'         // 文档完善度
  | 'test_coverage';        // 测试覆盖率

/**
 * 维度配置
 */
export interface DimensionConfig {
  name: string;
  description: string;
  weight: number;           // 权重 0-1
  target: number;           // 目标值 0-100
  unit: string;             // 单位
  testCases?: TestCase[];   // 测试用例
}

/**
 * 测试用例
 */
export interface TestCase {
  id: string;
  input: string;
  expectedIntent?: string;
  expectedOutput?: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 维度评分
 */
export interface DimensionScore {
  dimension: CapabilityDimension;
  score: number;            // 0-100
  previousScore?: number;   // 上次评分
  change?: number;          // 变化百分比
  details: string;          // 详细说明
  timestamp: string;
}

/**
 * 系统快照
 */
export interface SystemSnapshot {
  id: string;
  timestamp: string;
  gitCommit?: string;
  gitBranch?: string;
  configHash: string;       // 配置文件 hash
  scores: DimensionScore[];
  overallScore: number;     // 综合评分
  version: string;          // 系统版本
}

/**
 * 变更记录
 */
export interface ChangeRecord {
  id: string;
  timestamp: string;
  type: 'code' | 'config' | 'dependency' | 'documentation';
  description: string;
  files: string[];
  impact: CapabilityDimension[]; // 影响的维度
}

/**
 * 自省报告
 */
export interface IntrospectionReport {
  id: string;
  timestamp: string;
  trigger: 'startup' | 'manual' | 'scheduled';
  
  // 变更信息
  changes: ChangeRecord[];
  hasChanges: boolean;
  
  // 评分对比
  currentSnapshot: SystemSnapshot;
  previousSnapshot?: SystemSnapshot;
  
  // 提升分析
  improvements: DimensionScore[];  // 提升的维度
  regressions: DimensionScore[];   // 退步的维度
  unchanged: DimensionScore[];     // 无变化的维度
  
  // 短板识别
  shortfalls: Shortfall[];
  
  // 综合评估
  overallChange: number;           // 综合变化
  ranking?: number;                // 排名（可选）
  
  // 建议
  recommendations: Recommendation[];
}

/**
 * 短板
 */
export interface Shortfall {
  dimension: CapabilityDimension;
  currentScore: number;
  targetScore: number;
  gap: number;                     // 差距
  priority: 'critical' | 'high' | 'medium' | 'low';
  suggestion: string;
}

/**
 * 优化建议
 */
export interface Recommendation {
  id: string;
  dimension: CapabilityDimension;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  effort: 'small' | 'medium' | 'large';
  impact: number;                  // 预期提升
}

/**
 * 历史趋势
 */
export interface TrendData {
  dimension: CapabilityDimension;
  data: {
    timestamp: string;
    score: number;
  }[];
  trend: 'improving' | 'declining' | 'stable';
  changeRate: number;              // 变化率
}

// ============ 配置常量 ============

/**
 * 维度默认配置
 */
export const DIMENSION_CONFIGS: Record<CapabilityDimension, DimensionConfig> = {
  response_speed: {
    name: '响应速度',
    description: '平均响应时间，越低越好',
    weight: 0.10,
    target: 95,
    unit: 'ms',
  },
  understanding_accuracy: {
    name: '理解准确率',
    description: '意图识别准确率',
    weight: 0.15,
    target: 90,
    unit: '%',
  },
  task_completion: {
    name: '任务完成率',
    description: '成功完成任务的比例',
    weight: 0.15,
    target: 85,
    unit: '%',
  },
  memory_recall: {
    name: '记忆召回率',
    description: '语义搜索命中率',
    weight: 0.10,
    target: 80,
    unit: '%',
  },
  code_quality: {
    name: '代码质量',
    description: '静态分析评分',
    weight: 0.10,
    target: 85,
    unit: '分',
  },
  error_recovery: {
    name: '错误恢复率',
    description: '自动恢复成功的比例',
    weight: 0.08,
    target: 75,
    unit: '%',
  },
  security: {
    name: '安全防护',
    description: '安全检查通过率',
    weight: 0.08,
    target: 95,
    unit: '%',
  },
  resource_efficiency: {
    name: '资源效率',
    description: '内存/CPU 使用效率',
    weight: 0.06,
    target: 80,
    unit: '%',
  },
  extensibility: {
    name: '可扩展性',
    description: '新功能集成难度评分',
    weight: 0.05,
    target: 75,
    unit: '分',
  },
  maintainability: {
    name: '可维护性',
    description: '代码复杂度评分',
    weight: 0.05,
    target: 80,
    unit: '分',
  },
  documentation: {
    name: '文档完善度',
    description: '文档覆盖率',
    weight: 0.04,
    target: 85,
    unit: '%',
  },
  test_coverage: {
    name: '测试覆盖率',
    description: '测试通过率',
    weight: 0.04,
    target: 80,
    unit: '%',
  },
};

/**
 * 自省系统配置
 */
export interface IntrospectionConfig {
  enabled: boolean;
  triggerOnStartup: boolean;
  triggerOnConfigChange: boolean;
  scheduledInterval: number;       // 小时
  baselinePath: string;
  historyPath: string;
  reportsPath: string;
  significantChangeThreshold: number; // 显著变化阈值 %
}

export const DEFAULT_INTROSPECTION_CONFIG: IntrospectionConfig = {
  enabled: true,
  triggerOnStartup: true,
  triggerOnConfigChange: true,
  scheduledInterval: 168,          // 每周
  baselinePath: 'memory/introspection/baseline.json',
  historyPath: 'memory/introspection/history',
  reportsPath: 'memory/introspection/reports',
  significantChangeThreshold: 5,
};
