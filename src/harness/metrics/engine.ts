/**
 * Harness Engineering - 度量演进引擎
 * 
 * 实现：
 * - 数据收集
 * - 分析诊断
 * - 优化建议
 * - A/B 测试
 * - 灰度发布
 * 
 * @module harness/metrics/engine
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  EvolutionConfig,
  DEFAULT_EVOLUTION_CONFIG,
  MetricCategory,
  MetricType,
  MetricDefinition,
  MetricValue,
  EfficiencyMetrics,
  QualityMetrics,
  ResourceMetrics,
  SecurityMetrics,
  OverallScore,
  OptimizationSuggestion,
  ABTestConfig,
  ABTestResult,
  CanaryReleaseConfig,
  CanaryReleaseStatus,
  EFFICIENCY_METRIC_DEFINITIONS,
  QUALITY_METRIC_DEFINITIONS,
  RESOURCE_METRIC_DEFINITIONS,
  SECURITY_METRIC_DEFINITIONS,
} from './types';

// ============ 数据收集器 ============

/**
 * 数据收集器
 * 
 * 收集四类指标数据
 */
export class MetricsCollector {
  private config: EvolutionConfig;
  private metrics: Map<string, MetricValue[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  constructor(config: EvolutionConfig) {
    this.config = config;
  }

  /**
   * 记录计数器
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    this.recordMetric(name, current + value, labels);
  }

  /**
   * 设置仪表盘值
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    
    this.recordMetric(name, value, labels);
  }

  /**
   * 记录直方图值
   */
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    
    this.recordMetric(name, value, labels);
  }

  /**
   * 获取计数器值
   */
  getCounter(name: string, labels: Record<string, string> = {}): number {
    const key = this.getMetricKey(name, labels);
    return this.counters.get(key) || 0;
  }

  /**
   * 获取仪表盘值
   */
  getGauge(name: string, labels: Record<string, string> = {}): number {
    const key = this.getMetricKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  /**
   * 获取直方图统计
   */
  getHistogramStats(name: string, labels: Record<string, string> = {}): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(values.length * 0.5)],
      p95: sorted[Math.floor(values.length * 0.95)],
      p99: sorted[Math.floor(values.length * 0.99)],
    };
  }

  /**
   * 收集效能指标
   */
  collectEfficiencyMetrics(): EfficiencyMetrics {
    return {
      taskCompletionRate: this.getGauge('task_completion_rate'),
      avgResponseTime: this.getHistogramStats('response_time').avg,
      p95ResponseTime: this.getHistogramStats('response_time').p95,
      p99ResponseTime: this.getHistogramStats('response_time').p99,
      throughput: this.getGauge('throughput'),
      tokenEfficiency: this.getGauge('token_efficiency'),
      cacheHitRate: this.getGauge('cache_hit_rate'),
      concurrency: this.getGauge('concurrency'),
    };
  }

  /**
   * 收集质量指标
   */
  collectQualityMetrics(): QualityMetrics {
    return {
      accuracy: this.getGauge('accuracy'),
      consistency: this.getGauge('consistency'),
      userSatisfaction: this.getGauge('user_satisfaction'),
      errorRate: this.getGauge('error_rate'),
      retryRate: this.getGauge('retry_rate'),
      fallbackRate: this.getGauge('fallback_rate'),
      firstTimeRight: this.getGauge('first_time_right'),
    };
  }

  /**
   * 收集资源指标
   */
  collectResourceMetrics(): ResourceMetrics {
    const memory = process.memoryUsage();
    
    return {
      cpuUsage: this.getGauge('cpu_usage'),
      memoryUsage: (memory.heapUsed / memory.heapTotal) * 100,
      diskUsage: this.getGauge('disk_usage'),
      networkBandwidth: this.getGauge('network_bandwidth'),
      apiCallCount: this.getCounter('api_call_count'),
      totalTokenUsage: this.getCounter('total_token_usage'),
      costPerTask: this.getGauge('cost_per_task'),
      resourceUtilization: this.getGauge('resource_utilization'),
    };
  }

  /**
   * 收集安全指标
   */
  collectSecurityMetrics(): SecurityMetrics {
    return {
      permissionViolations: this.getCounter('permission_violations'),
      dataLeakageEvents: this.getCounter('data_leakage_events'),
      attackAttempts: this.getCounter('attack_attempts'),
      auditComplianceRate: this.getGauge('audit_compliance_rate'),
      sandboxEscapes: this.getCounter('sandbox_escapes'),
      sensitiveDataAccess: this.getCounter('sensitive_data_access'),
      totalSecurityEvents: this.getCounter('total_security_events'),
    };
  }

  /**
   * 记录指标
   */
  private recordMetric(
    name: string,
    value: number,
    labels: Record<string, string>
  ): void {
    const metricValue: MetricValue = {
      name,
      value,
      timestamp: Date.now(),
      labels,
    };

    const values = this.metrics.get(name) || [];
    values.push(metricValue);
    this.metrics.set(name, values);

    // 限制历史数据量
    if (values.length > 10000) {
      this.metrics.set(name, values.slice(-5000));
    }
  }

  /**
   * 获取指标键
   */
  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * 获取所有指标
   */
  getAllMetrics(): Map<string, MetricValue[]> {
    return this.metrics;
  }

  /**
   * 清理历史数据
   */
  cleanup(retentionDays: number): void {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    for (const [name, values] of this.metrics) {
      const filtered = values.filter(v => v.timestamp >= cutoff);
      this.metrics.set(name, filtered);
    }
  }
}

// ============ 分析器 ============

/**
 * 分析器
 * 
 * 分析指标数据，生成诊断报告
 */
export class MetricsAnalyzer {
  private config: EvolutionConfig;
  private definitions: MetricDefinition[];

  constructor(config: EvolutionConfig) {
    this.config = config;
    this.definitions = [
      ...EFFICIENCY_METRIC_DEFINITIONS,
      ...QUALITY_METRIC_DEFINITIONS,
      ...RESOURCE_METRIC_DEFINITIONS,
      ...SECURITY_METRIC_DEFINITIONS,
    ];
  }

  /**
   * 计算综合评分
   */
  calculateOverallScore(collector: MetricsCollector): OverallScore {
    const efficiencyMetrics = collector.collectEfficiencyMetrics();
    const qualityMetrics = collector.collectQualityMetrics();
    const resourceMetrics = collector.collectResourceMetrics();
    const securityMetrics = collector.collectSecurityMetrics();

    // 计算各类别评分
    const efficiencyScore = this.calculateCategoryScore(
      MetricCategory.EFFICIENCY,
      efficiencyMetrics
    );
    const qualityScore = this.calculateCategoryScore(
      MetricCategory.QUALITY,
      qualityMetrics
    );
    const resourceScore = this.calculateCategoryScore(
      MetricCategory.RESOURCE,
      resourceMetrics
    );
    const securityScore = this.calculateCategoryScore(
      MetricCategory.SECURITY,
      securityMetrics
    );

    // 计算总分（加权平均）
    const weights = {
      [MetricCategory.EFFICIENCY]: 0.3,
      [MetricCategory.QUALITY]: 0.35,
      [MetricCategory.RESOURCE]: 0.15,
      [MetricCategory.SECURITY]: 0.2,
    };

    const total =
      efficiencyScore * weights[MetricCategory.EFFICIENCY] +
      qualityScore * weights[MetricCategory.QUALITY] +
      resourceScore * weights[MetricCategory.RESOURCE] +
      securityScore * weights[MetricCategory.SECURITY];

    // 计算关键指标评分
    const criticalScore = this.calculateCriticalScore(collector);

    return {
      total: Math.round(total * 100) / 100,
      byCategory: {
        [MetricCategory.EFFICIENCY]: efficiencyScore,
        [MetricCategory.QUALITY]: qualityScore,
        [MetricCategory.RESOURCE]: resourceScore,
        [MetricCategory.SECURITY]: securityScore,
      },
      criticalScore,
      trend: 'stable', // 简化
      vsBaseline: total - 50, // 假设基线是 50
      vsTarget: total - 85, // 假设目标是 85
    };
  }

  /**
   * 计算类别评分
   */
  private calculateCategoryScore(
    category: MetricCategory,
    metrics: Record<string, number> | EfficiencyMetrics | QualityMetrics | ResourceMetrics | SecurityMetrics
  ): number {
    const categoryDefs = this.definitions.filter(d => d.category === category);
    let totalScore = 0;
    let totalWeight = 0;

    for (const def of categoryDefs) {
      const value = (metrics as Record<string, number>)[def.name] || 0;
      const score = this.normalizeValue(value, def);
      totalScore += score * def.weight;
      totalWeight += def.weight;
    }

    return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
  }

  /**
   * 归一化值
   */
  private normalizeValue(value: number, def: MetricDefinition): number {
    // 对于需要降低的指标（如错误率），反转计算
    const isLowerBetter = def.target < def.baseline;
    
    if (isLowerBetter) {
      if (value <= def.target) return 1;
      if (value >= def.baseline) return 0;
      return 1 - (value - def.target) / (def.baseline - def.target);
    } else {
      if (value >= def.target) return 1;
      if (value <= def.baseline) return 0;
      return (value - def.baseline) / (def.target - def.baseline);
    }
  }

  /**
   * 计算关键指标评分
   */
  private calculateCriticalScore(collector: MetricsCollector): number {
    const criticalDefs = this.definitions.filter(d => d.critical);
    let totalScore = 0;

    for (const def of criticalDefs) {
      const value = collector.getGauge(def.name);
      const score = this.normalizeValue(value, def);
      totalScore += score;
    }

    return criticalDefs.length > 0
      ? Math.round((totalScore / criticalDefs.length) * 100)
      : 0;
  }

  /**
   * 生成优化建议
   */
  generateOptimizationSuggestions(
    collector: MetricsCollector
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const score = this.calculateOverallScore(collector);

    // 检查每个指标
    for (const def of this.definitions) {
      const value = collector.getGauge(def.name);
      const normalized = this.normalizeValue(value, def);

      // 如果指标低于阈值，生成建议
      if (normalized < 0.7) {
        const suggestion = this.createSuggestion(def, value, normalized);
        suggestions.push(suggestion);
      }
    }

    // 按优先级排序
    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 创建优化建议
   */
  private createSuggestion(
    def: MetricDefinition,
    currentValue: number,
    normalized: number
  ): OptimizationSuggestion {
    const gap = def.target - currentValue;
    const isLowerBetter = def.target < def.baseline;
    const expectedImprovement = isLowerBetter
      ? ((currentValue - def.target) / currentValue) * 100
      : ((def.target - currentValue) / currentValue) * 100;

    let priority: OptimizationSuggestion['priority'];
    if (normalized < 0.3) {
      priority = 'critical';
    } else if (normalized < 0.5) {
      priority = 'high';
    } else if (normalized < 0.7) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    return {
      suggestionId: `suggestion_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      targetMetric: def.name,
      currentValue,
      targetValue: def.target,
      expectedImprovement: Math.abs(expectedImprovement),
      priority,
      type: this.inferSuggestionType(def),
      description: `优化 ${def.description}，当前值 ${currentValue.toFixed(2)}${def.unit}，目标值 ${def.target}${def.unit}`,
      steps: this.generateSteps(def),
      risks: this.assessRisks(def),
      createdAt: Date.now(),
    };
  }

  /**
   * 推断建议类型
   */
  private inferSuggestionType(def: MetricDefinition): OptimizationSuggestion['type'] {
    if (def.category === MetricCategory.RESOURCE) return 'resource';
    if (def.category === MetricCategory.SECURITY) return 'process';
    if (def.name.includes('rate') || def.name.includes('time')) return 'config';
    return 'code';
  }

  /**
   * 生成优化步骤
   */
  private generateSteps(def: MetricDefinition): string[] {
    const steps: string[] = [];

    switch (def.category) {
      case MetricCategory.EFFICIENCY:
        steps.push('分析性能瓶颈');
        steps.push('优化算法复杂度');
        steps.push('增加缓存机制');
        steps.push('并行化处理');
        break;

      case MetricCategory.QUALITY:
        steps.push('分析错误原因');
        steps.push('增加测试覆盖');
        steps.push('改进错误处理');
        steps.push('增加验证机制');
        break;

      case MetricCategory.RESOURCE:
        steps.push('分析资源使用');
        steps.push('优化内存管理');
        steps.push('减少不必要的计算');
        steps.push('使用更高效的算法');
        break;

      case MetricCategory.SECURITY:
        steps.push('审计安全策略');
        steps.push('加强权限控制');
        steps.push('增加安全检查');
        steps.push('更新安全配置');
        break;
    }

    return steps;
  }

  /**
   * 评估风险
   */
  private assessRisks(def: MetricDefinition): Array<{
    risk: string;
    probability: number;
    mitigation: string;
  }> {
    return [
      {
        risk: '优化可能引入新问题',
        probability: 0.3,
        mitigation: '充分测试后再部署',
      },
      {
        risk: '性能优化可能影响可读性',
        probability: 0.2,
        mitigation: '保持代码注释和文档',
      },
    ];
  }
}

// ============ 演进引擎 ============

/**
 * 演进引擎
 * 
 * 协调数据收集、分析、优化、测试、发布
 */
export class EvolutionEngine {
  private config: EvolutionConfig;
  private collector: MetricsCollector;
  private analyzer: MetricsAnalyzer;
  private abTests: Map<string, ABTestConfig> = new Map();
  private canaryReleases: Map<string, CanaryReleaseConfig> = new Map();
  private collectionTimer?: NodeJS.Timeout;
  private analysisTimer?: NodeJS.Timeout;

  constructor(config: Partial<EvolutionConfig> = {}) {
    this.config = { ...DEFAULT_EVOLUTION_CONFIG, ...config };
    this.collector = new MetricsCollector(this.config);
    this.analyzer = new MetricsAnalyzer(this.config);
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    // 创建数据目录
    const dataDir = path.join(this.config.workspaceRoot, '.metrics');
    await fs.promises.mkdir(dataDir, { recursive: true });

    // 启动定时收集
    if (this.config.collectionInterval > 0) {
      this.collectionTimer = setInterval(() => {
        this.collect();
      }, this.config.collectionInterval);
    }

    // 启动定时分析
    if (this.config.analysisInterval > 0) {
      this.analysisTimer = setInterval(() => {
        this.analyze();
      }, this.config.analysisInterval);
    }
  }

  // ============ 数据收集 ============

  /**
   * 收集指标
   */
  collect(): void {
    // 收集系统指标
    const memory = process.memoryUsage();
    this.collector.setGauge('memory_usage', (memory.heapUsed / memory.heapTotal) * 100);
    this.collector.setGauge('cpu_usage', 0); // 简化
  }

  /**
   * 记录指标
   */
  recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    this.collector.setGauge(name, value, labels);
  }

  /**
   * 记录响应时间
   */
  recordResponseTime(duration: number, operation: string): void {
    this.collector.observeHistogram('response_time', duration, { operation });
  }

  /**
   * 记录任务完成
   */
  recordTaskCompletion(success: boolean, taskType: string): void {
    this.collector.incrementCounter('task_total', { task_type: taskType });
    if (success) {
      this.collector.incrementCounter('task_success', { task_type: taskType });
    } else {
      this.collector.incrementCounter('task_failure', { task_type: taskType });
    }
  }

  // ============ 分析诊断 ============

  /**
   * 分析指标
   */
  analyze(): {
    score: OverallScore;
    suggestions: OptimizationSuggestion[];
  } {
    const score = this.analyzer.calculateOverallScore(this.collector);
    const suggestions = this.analyzer.generateOptimizationSuggestions(this.collector);

    return { score, suggestions };
  }

  /**
   * 获取当前评分
   */
  getScore(): OverallScore {
    return this.analyzer.calculateOverallScore(this.collector);
  }

  /**
   * 获取优化建议
   */
  getSuggestions(): OptimizationSuggestion[] {
    return this.analyzer.generateOptimizationSuggestions(this.collector);
  }

  // ============ A/B 测试 ============

  /**
   * 创建 A/B 测试
   */
  createABTest(config: Omit<ABTestConfig, 'testId' | 'status' | 'startTime'>): ABTestConfig {
    const testId = `ab_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const test: ABTestConfig = {
      ...config,
      testId,
      status: 'running',
      startTime: Date.now(),
    };

    this.abTests.set(testId, test);
    return test;
  }

  /**
   * 获取 A/B 测试结果
   */
  getABTestResult(testId: string): ABTestResult | null {
    const test = this.abTests.get(testId);
    if (!test) return null;

    // 简化：返回模拟结果
    return {
      testId,
      controlMetrics: { accuracy: 0.75, response_time: 2000 },
      experimentMetrics: { accuracy: 0.82, response_time: 1800 },
      improvement: { accuracy: 9.3, response_time: 10 },
      statisticalSignificance: 0.95,
      isSignificant: true,
      recommendation: 'experiment',
      confidence: 0.92,
    };
  }

  /**
   * 停止 A/B 测试
   */
  stopABTest(testId: string): boolean {
    const test = this.abTests.get(testId);
    if (!test) return false;

    test.status = 'stopped';
    test.endTime = Date.now();
    return true;
  }

  // ============ 灰度发布 ============

  /**
   * 创建灰度发布
   */
  createCanaryRelease(
    config: Omit<CanaryReleaseConfig, 'releaseId' | 'status' | 'startTime'>
  ): CanaryReleaseConfig {
    const releaseId = `canary_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const release: CanaryReleaseConfig = {
      ...config,
      releaseId,
      status: 'running',
      startTime: Date.now(),
    };

    this.canaryReleases.set(releaseId, release);
    return release;
  }

  /**
   * 获取灰度发布状态
   */
  getCanaryStatus(releaseId: string): CanaryReleaseStatus | null {
    const release = this.canaryReleases.get(releaseId);
    if (!release) return null;

    const score = this.getScore();

    return {
      releaseId,
      currentRatio: release.currentRatio,
      currentMetrics: {
        accuracy: score.byCategory[MetricCategory.QUALITY],
        error_rate: 100 - score.byCategory[MetricCategory.QUALITY],
      },
      baselineMetrics: {
        accuracy: 75,
        error_rate: 25,
      },
      isHealthy: score.criticalScore > 70,
      needsRollback: score.criticalScore < 50,
      warnings: score.criticalScore < 70 ? ['关键指标下降'] : [],
    };
  }

  /**
   * 推进灰度发布
   */
  advanceCanary(releaseId: string): boolean {
    const release = this.canaryReleases.get(releaseId);
    if (!release || release.status !== 'running') return false;

    const status = this.getCanaryStatus(releaseId);
    if (!status) return false;

    // 检查是否需要回滚
    if (status.needsRollback) {
      release.status = 'rolled_back';
      release.currentRatio = 0;
      return false;
    }

    // 推进流量
    release.currentRatio = Math.min(
      release.currentRatio + release.incrementStep,
      release.targetRatio
    );

    // 检查是否完成
    if (release.currentRatio >= release.targetRatio) {
      release.status = 'completed';
      release.endTime = Date.now();
    }

    return true;
  }

  /**
   * 回滚灰度发布
   */
  rollbackCanary(releaseId: string): boolean {
    const release = this.canaryReleases.get(releaseId);
    if (!release) return false;

    release.status = 'rolled_back';
    release.currentRatio = 0;
    release.endTime = Date.now();

    return true;
  }

  // ============ 状态查询 ============

  /**
   * 获取收集器
   */
  getCollector(): MetricsCollector {
    return this.collector;
  }

  /**
   * 获取分析器
   */
  getAnalyzer(): MetricsAnalyzer {
    return this.analyzer;
  }

  /**
   * 获取所有指标
   */
  getAllMetrics(): {
    efficiency: EfficiencyMetrics;
    quality: QualityMetrics;
    resource: ResourceMetrics;
    security: SecurityMetrics;
  } {
    return {
      efficiency: this.collector.collectEfficiencyMetrics(),
      quality: this.collector.collectQualityMetrics(),
      resource: this.collector.collectResourceMetrics(),
      security: this.collector.collectSecurityMetrics(),
    };
  }

  /**
   * 关闭引擎
   */
  async close(): Promise<void> {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }

    // 清理历史数据
    this.collector.cleanup(this.config.historyRetentionDays);
  }
}
