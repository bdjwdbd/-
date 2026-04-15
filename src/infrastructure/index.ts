/**
 * 基础设施层
 * 
 * 导出所有基础设施组件。
 */

// 基础设施组件（简化实现）
export class TokenEstimator {
  estimate(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export class CacheSystem {
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  
  set(key: string, value: unknown, ttlMs: number = 60000): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }
  
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
  
  getStats(): { size: number; hitRate: number; hits: number; misses: number } {
    return { 
      size: this.cache.size, 
      hitRate: this.getHitRate(),
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export class PerformanceMonitor {
  private startTime: number = Date.now();
  private metrics: Map<string, number[]> = new Map();
  private logger: StructuredLogger;
  
  // 告警阈值配置
  private alertThresholds = {
    health: { warning: 0.8, critical: 0.7 },
    avgLatency: { warning: 2000, critical: 5000 },
    successRate: { warning: 0.95, critical: 0.8 },
    cacheHitRate: { warning: 0.3, critical: 0.1 },
  };
  
  // 告警历史
  private alertHistory: Array<{
    timestamp: Date;
    type: string;
    level: 'warning' | 'critical';
    message: string;
    value: number;
    threshold: number;
  }> = [];
  
  // 系统级指标
  private systemMetrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalLatency: number;
    cacheHits: number;
    cacheMisses: number;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };
  
  constructor(logger?: StructuredLogger) {
    this.logger = logger || new StructuredLogger();
  }
  
  recordLayerLatency(layer: string, latency: number): void {
    const latencies = this.metrics.get(layer) || [];
    latencies.push(latency);
    this.metrics.set(layer, latencies);
  }
  
  recordRequest(success: boolean, latency: number): void {
    this.systemMetrics.totalRequests++;
    this.systemMetrics.totalLatency += latency;
    if (success) {
      this.systemMetrics.successfulRequests++;
    } else {
      this.systemMetrics.failedRequests++;
    }
    
    // 检查告警
    this.checkAlerts();
  }
  
  recordCacheHit(): void {
    this.systemMetrics.cacheHits++;
  }
  
  recordCacheMiss(): void {
    this.systemMetrics.cacheMisses++;
  }
  
  getUptime(): number {
    return Date.now() - this.startTime;
  }
  
  /**
   * 检查告警
   */
  private checkAlerts(): void {
    const metrics = this.getSystemMetrics();
    
    // 健康度告警
    if (metrics.health < this.alertThresholds.health.critical) {
      this.triggerAlert('health', 'critical', metrics.health, this.alertThresholds.health.critical);
    } else if (metrics.health < this.alertThresholds.health.warning) {
      this.triggerAlert('health', 'warning', metrics.health, this.alertThresholds.health.warning);
    }
    
    // 延迟告警
    if (metrics.avgLatency > this.alertThresholds.avgLatency.critical) {
      this.triggerAlert('avgLatency', 'critical', metrics.avgLatency, this.alertThresholds.avgLatency.critical);
    } else if (metrics.avgLatency > this.alertThresholds.avgLatency.warning) {
      this.triggerAlert('avgLatency', 'warning', metrics.avgLatency, this.alertThresholds.avgLatency.warning);
    }
    
    // 成功率告警
    if (metrics.successRate < this.alertThresholds.successRate.critical) {
      this.triggerAlert('successRate', 'critical', metrics.successRate, this.alertThresholds.successRate.critical);
    } else if (metrics.successRate < this.alertThresholds.successRate.warning) {
      this.triggerAlert('successRate', 'warning', metrics.successRate, this.alertThresholds.successRate.warning);
    }
  }
  
  /**
   * 触发告警
   */
  private triggerAlert(
    type: string,
    level: 'warning' | 'critical',
    value: number,
    threshold: number
  ): void {
    // 避免重复告警（5分钟内同类型告警只触发一次）
    const recentAlert = this.alertHistory.find(
      a => a.type === type && 
           a.level === level && 
           Date.now() - a.timestamp.getTime() < 5 * 60 * 1000
    );
    
    if (recentAlert) return;
    
    const message = this.getAlertMessage(type, level, value, threshold);
    
    const alert = {
      timestamp: new Date(),
      type,
      level,
      message,
      value,
      threshold,
    };
    
    this.alertHistory.push(alert);
    
    // 记录日志
    if (level === 'critical') {
      this.logger.error('PerformanceAlert', message);
    } else {
      this.logger.warn('PerformanceAlert', message);
    }
  }
  
  /**
   * 生成告警消息
   */
  private getAlertMessage(
    type: string,
    level: 'warning' | 'critical',
    value: number,
    threshold: number
  ): string {
    const typeNames: Record<string, string> = {
      health: '健康度',
      avgLatency: '平均延迟',
      successRate: '成功率',
      cacheHitRate: '缓存命中率',
    };
    
    const units: Record<string, string> = {
      health: '%',
      avgLatency: 'ms',
      successRate: '%',
      cacheHitRate: '%',
    };
    
    const valueStr = type === 'avgLatency' ? `${value}` : `${(value * 100).toFixed(1)}`;
    const thresholdStr = type === 'avgLatency' ? `${threshold}` : `${(threshold * 100).toFixed(1)}`;
    
    return `${typeNames[type]} ${level === 'critical' ? '严重' : '警告'}: 当前 ${valueStr}${units[type]}, 阈值 ${thresholdStr}${units[type]}`;
  }
  
  /**
   * 获取告警历史
   */
  getAlertHistory(limit: number = 20): typeof this.alertHistory {
    return this.alertHistory.slice(-limit);
  }
  
  /**
   * 清除告警历史
   */
  clearAlertHistory(): void {
    this.alertHistory = [];
  }
  
  /**
   * 设置告警阈值
   */
  setAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }
  
  /**
   * 获取告警阈值
   */
  getAlertThresholds(): typeof this.alertThresholds {
    return { ...this.alertThresholds };
  }
  
  getSystemMetrics(): {
    health: number;
    avgLatency: number;
    cacheHitRate: number;
    successRate: number;
    totalRequests: number;
  } {
    const { totalRequests, successfulRequests, totalLatency, cacheHits, cacheMisses } = this.systemMetrics;
    
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 1;
    const avgLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
    const cacheHitRate = (cacheHits + cacheMisses) > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;
    
    const health = Math.min(1, Math.max(0,
      successRate * 0.5 +
      cacheHitRate * 0.3 +
      Math.max(0, 1 - avgLatency / 5000) * 0.2
    ));
    
    return {
      health: Math.round(health * 100) / 100,
      avgLatency: Math.round(avgLatency),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      totalRequests,
    };
  }
  
  getFullReport(): string {
    let report = '# 性能报告\n\n';
    
    const sysMetrics = this.getSystemMetrics();
    report += '## 系统级指标\n';
    report += `- 健康度: ${(sysMetrics.health * 100).toFixed(1)}%\n`;
    report += `- 平均延迟: ${sysMetrics.avgLatency}ms\n`;
    report += `- 缓存命中率: ${(sysMetrics.cacheHitRate * 100).toFixed(1)}%\n`;
    report += `- 成功率: ${(sysMetrics.successRate * 100).toFixed(1)}%\n`;
    report += `- 总请求数: ${sysMetrics.totalRequests}\n\n`;
    
    // 告警状态
    const recentAlerts = this.getAlertHistory(5);
    if (recentAlerts.length > 0) {
      report += '## 最近告警\n';
      for (const alert of recentAlerts) {
        const icon = alert.level === 'critical' ? '🔴' : '🟡';
        report += `- ${icon} ${alert.message} (${alert.timestamp.toLocaleString()})\n`;
      }
      report += '\n';
    }
    
    report += '## 层级延迟\n';
    for (const [layer, latencies] of this.metrics) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      report += `- ${layer}: ${avg.toFixed(2)}ms (${latencies.length} 次)\n`;
    }
    return report;
  }
}

export class StructuredLogger {
  private _minLevel: 'debug' | 'info' | 'warn' | 'error';
  
  constructor(options?: { minLevel?: 'debug' | 'info' | 'warn' | 'error' }) {
    this._minLevel = options?.minLevel || 'info';
  }
  
  get minLevel(): 'debug' | 'info' | 'warn' | 'error' {
    return this._minLevel;
  }
  
  private log(level: string, layer: string, message: string, data?: unknown): void {
    console.log(`[${level}] [${layer}] ${message}`, data || '');
  }
  
  debug(layer: string, message: string, data?: unknown): void {
    this.log('DEBUG', layer, message, data);
  }
  
  info(layer: string, message: string, data?: unknown): void {
    this.log('INFO', layer, message, data);
  }
  
  warn(layer: string, message: string, data?: unknown): void {
    this.log('WARN', layer, message, data);
  }
  
  error(layer: string, message: string, data?: unknown): void {
    this.log('ERROR', layer, message, data);
  }
}

export interface LogMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ContextReset {
  private logger: StructuredLogger;
  // 阈值从 0.8 (80%) 调整为 0.55 (55%)
  // 实验验证：60% 上下文使用率才显著下降，55% 提供安全边际
  private threshold: number = 0.55;
  
  constructor(logger: StructuredLogger, threshold?: number) {
    this.logger = logger;
    if (threshold !== undefined) {
      this.threshold = threshold;
    }
  }
  
  shouldReset(tokenCount: number, maxTokens: number): boolean {
    return tokenCount > maxTokens * this.threshold;
  }
  
  reset(messages: LogMessage[]): LogMessage[] {
    this.logger.info('ContextReset', `执行上下文重置 (阈值: ${this.threshold * 100}%)`);
    return messages.slice(-10);
  }
  
  getThreshold(): number {
    return this.threshold;
  }
  
  setThreshold(threshold: number): void {
    this.threshold = Math.max(0.3, Math.min(0.9, threshold));
    this.logger.info('ContextReset', `阈值已更新为: ${this.threshold * 100}%`);
  }
}

export class LearningValidator {
  private logger: StructuredLogger;
  private strategy: 'simple' | 'adversarial' | 'none' = 'simple';
  
  constructor(logger: StructuredLogger, strategy?: 'simple' | 'adversarial' | 'none') {
    this.logger = logger;
    if (strategy) {
      this.strategy = strategy;
    }
  }
  
  async validate(
    result: unknown,
    validator: () => boolean,
    taskImportance: 'critical' | 'normal' | 'low' = 'normal'
  ): Promise<{ passed: boolean; feedback: string; strategy: string }> {
    const actualStrategy = this.selectStrategy(taskImportance);
    
    switch (actualStrategy) {
      case 'adversarial':
        return this.adversarialValidate(result, validator);
      case 'simple':
        return this.simpleValidate(result, validator);
      case 'none':
      default:
        return { passed: true, feedback: '跳过验证', strategy: 'none' };
    }
  }
  
  private selectStrategy(importance: 'critical' | 'normal' | 'low'): string {
    if (importance === 'critical') {
      return 'adversarial';
    } else if (importance === 'normal') {
      return 'simple';
    } else {
      return this.strategy === 'none' ? 'none' : 'simple';
    }
  }
  
  private async simpleValidate(result: unknown, validator: () => boolean): Promise<{ passed: boolean; feedback: string; strategy: string }> {
    try {
      const passed = validator();
      void result; // 参数保留用于类型检查
      return {
        passed,
        feedback: passed ? '简单验证通过' : '简单验证失败',
        strategy: 'simple',
      };
    } catch (error: any) {
      return {
        passed: false,
        feedback: `验证异常: ${error.message}`,
        strategy: 'simple',
      };
    }
  }
  
  private async adversarialValidate(result: unknown, validator: () => boolean): Promise<{ passed: boolean; feedback: string; strategy: string }> {
    void result; // 参数保留用于类型检查
    const iterations = 3;
    const results: boolean[] = [];
    
    for (let i = 0; i < iterations; i++) {
      try {
        results.push(validator());
      } catch {
        results.push(false);
      }
    }
    
    const passed = results.every(r => r);
    const passCount = results.filter(r => r).length;
    
    return {
      passed,
      feedback: `对抗验证: ${passCount}/${iterations} 通过`,
      strategy: 'adversarial',
    };
  }
  
  setStrategy(strategy: 'simple' | 'adversarial' | 'none'): void {
    this.strategy = strategy;
    this.logger.info('LearningValidator', `验证策略已设置为: ${strategy}`);
  }
  
  getStrategy(): string {
    return this.strategy;
  }
}

export class SprintContractManager {
  private logger: StructuredLogger;
  private contracts: Map<string, any> = new Map();
  
  // 默认验收标准模板
  private static DEFAULT_TEMPLATES: Record<string, any[]> = {
    'code-review': [
      { name: '代码可编译', description: '代码能够成功编译', required: true },
      { name: '无安全漏洞', description: '通过安全检查', required: true },
      { name: '测试通过', description: '单元测试全部通过', required: true },
    ],
    'document': [
      { name: '格式正确', description: '文档格式符合要求', required: true },
      { name: '内容完整', description: '包含所有必要章节', required: true },
    ],
    'task': [
      { name: '目标达成', description: '完成预定目标', required: true },
      { name: '无错误', description: '执行过程无错误', required: true },
    ],
  };
  
  constructor(logger: StructuredLogger) {
    this.logger = logger;
  }
  
  createFromTemplate(templateName: string, goal: string): any {
    const template = SprintContractManager.DEFAULT_TEMPLATES[templateName];
    if (!template) {
      this.logger.warn('SprintContract', `模板 "${templateName}" 不存在，使用空标准`);
      return this.create(goal, []);
    }
    return this.create(goal, template);
  }
  
  quickCreate(goal: string): any {
    return this.createFromTemplate('task', goal);
  }
  
  create(goal: string, criteria: any[]): any {
    const id = `contract-${Date.now()}`;
    const contract = { id, goal, criteria, status: 'draft', createdAt: new Date() };
    this.contracts.set(id, contract);
    this.logger.info('SprintContract', `创建 Contract: ${goal}`);
    return contract;
  }
  
  get(id: string): any {
    return this.contracts.get(id);
  }
  
  startExecution(id: string): void {
    const contract = this.contracts.get(id);
    if (contract) {
      contract.status = 'executing';
      contract.startedAt = new Date();
      this.logger.info('SprintContract', `开始执行: ${contract.goal}`);
    }
  }
  
  /**
   * 验证单个标准
   */
  validateCriterion(id: string, criterionName: string, passed: boolean, evidence?: string): {
    success: boolean;
    criterion: any;
    passed: boolean;
    evidence?: string;
  } {
    const contract = this.contracts.get(id);
    if (!contract) {
      return { success: false, criterion: null, passed: false };
    }

    const criterion = contract.criteria.find((c: any) => c.name === criterionName);
    if (!criterion) {
      return { success: false, criterion: null, passed: false };
    }

    // 记录验证结果
    if (!contract.validationResults) {
      contract.validationResults = {};
    }
    contract.validationResults[criterionName] = {
      passed,
      evidence,
      validatedAt: new Date(),
    };

    this.logger.info('SprintContract', `验证标准 [${criterionName}]: ${passed ? '✅ 通过' : '❌ 未通过'}`);

    return { success: true, criterion, passed, evidence };
  }

  /**
   * 获取验证进度
   */
  getValidationProgress(id: string): {
    total: number;
    validated: number;
    passed: number;
    failed: number;
    pending: number;
    progress: number;
    criteria: Array<{
      name: string;
      required: boolean;
      status: 'pending' | 'passed' | 'failed';
      evidence?: string;
    }>;
  } {
    const contract = this.contracts.get(id);
    if (!contract) {
      return { total: 0, validated: 0, passed: 0, failed: 0, pending: 0, progress: 0, criteria: [] };
    }

    const results = contract.validationResults || {};
    const criteria = contract.criteria.map((c: any) => {
      const result = results[c.name];
      return {
        name: c.name,
        required: c.required,
        status: result ? (result.passed ? 'passed' : 'failed') : 'pending',
        evidence: result?.evidence,
      };
    });

    const total = criteria.length;
    const validated = criteria.filter(c => c.status !== 'pending').length;
    const passed = criteria.filter(c => c.status === 'passed').length;
    const failed = criteria.filter(c => c.status === 'failed').length;
    const pending = criteria.filter(c => c.status === 'pending').length;

    return {
      total,
      validated,
      passed,
      failed,
      pending,
      progress: total > 0 ? (validated / total) * 100 : 0,
      criteria,
    };
  }

  /**
   * 完成验证并生成报告
   */
  completeWithValidation(id: string): {
    success: boolean;
    report: string;
    summary: {
      total: number;
      passed: number;
      failed: number;
      passRate: number;
    };
  } {
    const contract = this.contracts.get(id);
    if (!contract) {
      return {
        success: false,
        report: 'Contract not found',
        summary: { total: 0, passed: 0, failed: 0, passRate: 0 },
      };
    }

    const progress = this.getValidationProgress(id);
    const allPassed = progress.failed === 0 && progress.pending === 0;
    
    contract.status = allPassed ? 'completed' : 'failed';
    contract.completedAt = new Date();

    // 生成报告
    const report = this.generateValidationReport(contract, progress);
    
    this.logger.info('SprintContract', `验证完成: ${contract.goal} (${allPassed ? '✅ 成功' : '❌ 失败'})`);

    return {
      success: allPassed,
      report,
      summary: {
        total: progress.total,
        passed: progress.passed,
        failed: progress.failed,
        passRate: progress.total > 0 ? (progress.passed / progress.total) * 100 : 0,
      },
    };
  }

  /**
   * 生成验证报告
   */
  private generateValidationReport(contract: any, progress: any): string {
    const lines: string[] = [];
    
    lines.push(`# Sprint Contract 验收报告`);
    lines.push('');
    lines.push(`**任务**: ${contract.goal}`);
    lines.push(`**状态**: ${contract.status === 'completed' ? '✅ 完成' : '❌ 失败'}`);
    lines.push('');
    lines.push(`## 验收结果`);
    lines.push('');
    lines.push(`| 序号 | 验收标准 | 必填 | 状态 | 证据 |`);
    lines.push(`|------|----------|------|------|------|`);

    progress.criteria.forEach((c: any, i: number) => {
      const required = c.required ? '✅' : '⚠️';
      const status = c.status === 'passed' ? '✅ 通过' : 
                     c.status === 'failed' ? '❌ 未通过' : '⏳ 待验证';
      const evidence = c.evidence || '-';
      lines.push(`| ${i + 1} | ${c.name} | ${required} | ${status} | ${evidence} |`);
    });

    lines.push('');
    lines.push(`## 统计`);
    lines.push('');
    lines.push(`- 总标准数: ${progress.total}`);
    lines.push(`- 通过: ${progress.passed}`);
    lines.push(`- 未通过: ${progress.failed}`);
    lines.push(`- 待验证: ${progress.pending}`);
    lines.push(`- 通过率: ${progress.total > 0 ? ((progress.passed / progress.total) * 100).toFixed(1) : 0}%`);

    return lines.join('\n');
  }
  
  complete(id: string, results: Record<string, boolean>): boolean {
    const contract = this.contracts.get(id);
    if (!contract) return false;
    
    const allPassed = contract.criteria.every((c: any) => results[c.name] !== false);
    contract.status = allPassed ? 'completed' : 'failed';
    this.logger.info('SprintContract', `执行完成: ${contract.goal} (${allPassed ? '成功' : '失败'})`);
    return allPassed;
  }
  
  listAll(): any[] {
    return Array.from(this.contracts.values());
  }
  
  static getAvailableTemplates(): string[] {
    return Object.keys(SprintContractManager.DEFAULT_TEMPLATES);
  }
}

// ============ yaoyao-memory 融合模块 ============

export { MemoryStore, Memory, MemoryType, MemorySearchResult, MemoryStats } from './memory-store';
export { ForgetDetector, ForgetConfig, ForgetResult, ForgetReason, ContradictionPair } from './forget-detector';
export { ConversationSummarizer, ConversationMessage, ConversationSummary, ExtractedEntity, SentimentScore } from './conversation-summarizer';
export { SmartTagger, TagRule, TagStats, TagSuggestion } from './smart-tagger';
export { RBACManager, User, Role, Permission, AccessRequest, AccessResult } from './rbac';
export { ContextGuard, GuardResult, GuardConfig } from './context-guard';
export { HealthChecker as SystemHealthChecker, HealthCheckResult, HealthReport, HealthConfig } from './health-checker';
export { VectorStore, Vector, VectorSearchResult, VectorStoreConfig, SimpleTextVectorizer } from './vector-store';
export { PredictiveMaintenance, GrowthPrediction, MaintenancePlan, MaintenanceType, MaintenanceStats } from './predictive-maintenance';
export { CloudSync, SyncConfig, SyncResult, SyncStatus } from './cloud-sync';

// ============ 验收标准推断引擎 ============

export { 
  CriteriaInferenceEngine, 
  InferredCriteria, 
  InferenceResult as CriteriaInferenceResult, 
  DomainKnowledge,
  inferCriteria,
  inferAndCreateContract,
  inferCriteriaAsTable,
  inferCriteriaForTable,
} from './criteria-inference-engine';

// ============ 学习系统模块 ============

export { KnowledgeGraph, Entity, Relation, KnowledgeGraphStats } from './knowledge-graph';
export type { EntityType, RelationType, KnowledgeQuery } from './knowledge-graph';
export { MetaCognition, KnowledgeBoundary, ConfidenceAssessment, SelfReflection, MetaCognitionReport } from './meta-cognition';
export type { UncertaintyType, UncertaintyQuantification } from './meta-cognition';
export { InferenceEngine, InferenceRule, InferenceResult, InferenceChain } from './inference-engine';
export type { RuleCondition, RuleConclusion, InferenceStrategy } from './inference-engine';
export { OnlineLearner, LearningEvent, KnowledgeUpdate, LearningProgress, OnlineLearningConfig } from './online-learner';
export type { LearningEventType, ForgettingRule } from './online-learner';
export { MultimodalFusion, MultimodalContent, MultimodalResult, CrossModalRelation } from './multimodal-fusion';
export type { ModalityType, ImageAnalysis, AudioAnalysis, VideoAnalysis } from './multimodal-fusion';
export { CausalReasoner, CausalNode, CausalEdge, CausalGraph, CausalDiscoveryResult, CounterfactualResult, InterventionResult } from './causal-reasoner';
export { AutonomousLearner, LearningGoal, LearningPath, LearningStep, SelfAssessment, LearningSession } from './autonomous-learner';
export { KnowledgeTransfer, SourceDomain, TargetDomain, Concept, Mapping, TransferResult, AnalogyResult } from './knowledge-transfer';

// ============ 高级功能模块 ============

export { AutoTuner } from './auto-tuner';
export { CompensationTracker, CompensationReport } from './compensation-tracker';
export { DistributedTracing } from './distributed-tracing';
export { ExtensionManager } from './extension-manager';
export { FeedbackLearner, FeedbackRecord } from './feedback-learner';
export { HybridSearchEngine, SearchResult } from './hybrid-search';
// IntegrityValidator 在后面导出（完整版）
export { MemoryCompressor } from './memory-compressor';
export { MemoryUpgrader } from './memory-upgrader';
export { MultiModelRouter } from './multi-model-router';

// ============ 搜索系统模块（LLM Memory Integration 融合）============

export { QueryRouter, type SearchMode, type QueryAnalysis, type RoutingDecision, type RouterConfig } from './query-router';
export { DynamicWeights, type SearchWeights, type WeightAdjustment, type WeightConfig, type FeedbackRecord as WeightFeedbackRecord } from './dynamic-weights';
export { RRFFusion, type SearchResult as RRFSearchResult, type RRFConfig, type FusionResult } from './rrf-fusion';
export { SemanticDedup, type DedupConfig, type DedupResult } from './semantic-dedup';
export { QueryUnderstand, type QueryIntent, type QueryUnderstanding, type UnderstandConfig } from './query-understand';
export { QueryRewriter, type RewriteResult, type RewriterConfig } from './query-rewriter';
export { QueryHistory, type QueryRecord, type QueryStats, type HistoryConfig } from './query-history';
export { ResultExplainer, type ExplanationResult, type ExplainerConfig } from './result-explainer';
export { ResultSummarizer, type SummaryResult, type SummarizerConfig } from './result-summarizer';

// ============ 性能优化模块（LLM Memory Integration 融合）============

export { VectorOps, getVectorOps, cosineSimilarity, euclideanDistance, topKSearch, detectSIMDSupport, type SIMDSupport, type VectorOpsConfig } from './vector-ops';
export { ANNIndex, BruteForceANN, HNSWIndex, IVFIndex, createANNIndex, type ANNAlgorithm, type DistanceMetric, type ANNConfig, type ANNResult } from './ann-index';
export { OPQQuantizer, createOPQQuantizer, type OPQConfig, type OPQIndex } from './opq-quantization';
export { WALOptimizer, createWALOptimizer, type WALConfig, type WALEntry, type Checkpoint } from './wal-optimizer';
export { AdaptiveVectorSearch, createAdaptiveSearch, type AdaptiveSearchConfig } from './adaptive-search';
export { GPUAccelerator, createGPUAccelerator, type GPUConfig, type GPUSearchResult } from './gpu-accelerator';
export { LoggerManager, getLogger, initLogger, startTimer, PerformanceTimer, type LoggerConfig, type LogLevel } from './logger';
export { CacheManager, getCacheManager, type CacheConfig as AdvancedCacheConfig, type CacheStats } from './cache-manager';
export { Quantizer, FP16Quantizer, INT8Quantizer, ScalarQuantizer, ProductQuantizer as SimpleProductQuantizer, BinaryQuantizer, createQuantizer, type QuantizationType, type QuantizerConfig } from './quantization';
export { LRUCache, VectorQueryCache, CachedSearchEngine, type CacheOptions, type CacheEntry } from './query-cache';
export { AsyncVectorSearch, AsyncLLMClient, AsyncEmbeddingClient, AsyncMemoryPipeline, type AsyncSearchResult, type AsyncSearchConfig, type LLMConfig, type LLMResponse } from './async-ops';
export { DistributedSearchEngine, LocalShard, ShardManager, type DistributedSearchResult, type ShardConfig } from './distributed-search';
export { HealthChecker, FailoverManager, NodeStatus, type Node, type HealthCheckConfig } from './failover';
export { ModelRouter, TaskType, ModelCapability, type Model, type RoutingDecision as ModelRoutingDecision, type ModelRouterConfig } from './model-router';
export { CPUOptimizer, getOptimizer, optimizeForIntelXeon, type CPUInfo, type CPUOptimizerConfig } from './cpu-optimizer';
export { CacheOptimizer, MemoryPool, getCacheOptimizer, getMemoryPool, type CacheConfig, type CacheBlockSizes } from './cache-optimizer';
export { IndexPersistence, IncrementalIndexUpdater, type IndexMetadata, type PersistenceConfig } from './index-persistence';
export { MultimodalEncoder, MultimodalSearcher, type ModalityType as MMModalityType, type MultimodalContent as MMMultimodalContent, type MultimodalEmbedding, type MultimodalSearchResult, type MultimodalEncoderConfig } from './multimodal-search';
export { GPUVectorOps, getGPUOps, isGPUAvailable, detectGPU, type GPUInfo, type GPUOpsConfig } from './gpu-ops';
export { ParallelCompute, INT8AcceleratedSearch, getParallelCompute, getNumThreads, type JITConfig } from './jit-accel';
export { 
  SIMDVectorOps, 
  createSIMDVectorOps, 
  isSIMDSupported,
  type SIMDConfig, 
  type SIMDInfo 
} from '../wasm';
export { 
  WorkerPool, 
  createWorkerPool,
  type WorkerPoolConfig,
  type WorkerTask,
  type VectorSearchTask,
  type VectorSearchResult as WorkerVectorSearchResult
} from './worker-pool';
export {
  VectorSearchCache,
  createVectorCache,
  type VectorCacheConfig,
  type CacheEntry as VectorCacheEntry,
  type CacheStats as VectorCacheStats
} from './vector-cache';
export {
  UnifiedVectorOps,
  getVectorOps as getNativeVectorOps,
  isNativeModuleAvailable,
  getNativeModuleInfo,
  type NativeVectorOps,
  type NativeModuleInfo
} from './native-vector';
export {
  MKLBridge,
  getMKLBridge,
  isMKLAvailable,
  type MKLConfig,
  type MKLInfo
} from './mkl-bridge';
export {
  MKLDirect,
  getMKLDirect,
  initMKL,
  isMKLDirectAvailable,
  getMKLDirectInfo,
  // Level 1
  mklDotProduct,
  mklNorm,
  mklAsum,
  mklAxpy,
  mklScal,
  mklCopy,
  mklRot,
  mklSwap,
  mklIdamax,
  mklIdamin,
  // 相似度
  mklCosineSimilarity,
  mklEuclideanDistance,
  mklBatchCosineSimilarity,
  // Level 2
  mklGemv,
  mklSymv,
  mklTrmv,
  mklGer,
  // Level 3
  mklGemm,
  mklSymm,
  mklSyrk,
  mklTrmm,
  mklTrsm,
  // 控制
  mklSetThreads,
  mklGetThreads,
  mklFreeBuffers,
  type MKLDirectConfig,
  type MKLDirectInfo
} from './mkl-direct';
export { HugePageManager, HighPerformanceMemoryPool, VectorMemoryManager, getHugePageManager, type HugePageInfo, type MemoryPoolConfig } from './hugepage-manager';
export { HardwareOptimizer, AMXAccelerator, NeuralEngineAccelerator, NEONAccelerator, getHardwareOptimizer, type HardwareInfo, type Optimizations } from './hardware-optimize';
export { LanguageDetector, CrossLingualEncoder, CrossLingualSearcher, type LanguageCode, type CrossLingualConfig } from './cross-lingual';
export { LLMStreamer, SSEServer, WebSocketHandler, StreamChunkImpl, type StreamChunk, type StreamerConfig } from './llm-streaming';
export { NativeLoader as NativeAcceleratorLoader, Accelerator, getAccelerator, type SIMDCapabilities, type MemoryInfo, type SearchResult as NativeSearchResult, type NativeModules } from './native-accelerator';
export { SkillsDiscoveryEngine, skillsDiscoveryEngine, type SkillInfo } from './SkillsDiscovery';
export {
  HealthChecker as SelfHealthChecker,
  PerformanceMonitor as SelfPerformanceMonitor,
  DiagnosticEngine,
  getDiagnosticEngine,
} from './SelfDiagnostic';
export type {
  HealthStatus,
  HealthCheck,
  SystemHealth,
  PerformanceMetrics as SelfPerformanceMetrics,
  DiagnosticResult,
} from './SelfDiagnostic';
export {
  WasmVectorEngine,
  getWasmVectorEngine,
} from './WasmVectorEngine';
export type {
  VectorEngineConfig,
  VectorMetrics,
} from './WasmVectorEngine';

// 产品量化
export {
  ProductQuantizer,
  createProductQuantizer,
  quickQuantize,
  type PQConfig,
  type PQCode,
  type PQIndex,
  type PQSearchResult,
  type PQStats,
} from './product-quantizer';

// 查询结果缓存
export {
  QueryCache,
  VectorSearchCache as QueryVectorSearchCache,
  CachedSearchEngine as QueryCachedSearchEngine,
  getQueryCache,
  getVectorSearchCache,
  type CacheEntry as QueryCacheEntry,
  type CacheConfig as QueryCacheConfig,
  type CacheStats as QueryCacheStats,
  type QueryCacheOptions,
  type VectorSearchResult as QueryVectorSearchResult,
  type SearchEngine,
} from './query-result-cache';

// 线程池
export {
  ThreadPool,
  createVectorThreadPool,
  getThreadPool,
  executeInPool,
  type ThreadPoolConfig,
  type Task,
  type WorkerInfo,
  type ThreadPoolStats,
} from './thread-pool';

// 磁盘持久化 HNSW
export {
  DiskHNSWIndex,
  createDiskHNSWIndex,
  type DiskHNSWConfig,
  type IndexMetadata as DiskIndexMetadata,
  type DiskNode,
} from './disk-hnsw';

// WebGPU 引擎
export {
  WebGPUEngine,
  getWebGPUEngine,
  initWebGPU,
  type WebGPUConfig,
  type WebGPUCapabilities,
  type WebGPUBuffer,
} from './webgpu-engine';

// 分布式搜索
export {
  DistributedSearchEngine as P3DistributedSearchEngine,
  ShardManager as P3ShardManager,
  LocalShard as P3LocalShard,
  createDistributedSearchEngine,
  type ShardConfig as P3ShardConfig,
  type DistributedSearchConfig as P3DistributedSearchConfig,
  type DistributedSearchResult as P3DistributedSearchResult,
  type SearchRequest as P3SearchRequest,
  type SearchResponse as P3SearchResponse,
} from './distributed-search-engine';

// HNSW 自动调参
export {
  HNSWAutoTuner,
  createHNSWAutoTuner,
  type HNSWTuningParams,
  type TuningConfig,
  type TuningResult,
  type BenchmarkResult,
} from './hnsw-auto-tuner';

// 高性能向量搜索引擎 v3（INT8 + 批量搜索）- 最佳性能
export {
  HighPerfVectorEngineV3,
  getHighPerfVectorEngineV3,
  initHighPerfVectorEngineV3,
  type HighPerfV3Config,
  type Int8Index,
} from './high-perf-vector-engine-v3';

// 完整性验证和原生模块加载
export {
  IntegrityValidator,
  getIntegrityValidator,
  quickValidate,
  validateFile,
  type IntegrityCheckResult,
  type BinaryInfo,
  type IntegrityReport,
} from './integrity-validator';

export {
  NativeDownloader,
  getNativeDownloader,
  downloadNative,
  type DownloadOptions,
  type DownloadResult,
  type PlatformInfo,
  type ReleaseInfo,
} from './native-downloader';

export {
  NativeLoader,
  getNativeLoader,
  loadNativeModule,
  getNativeModule,
  isNativeAvailable,
  type NativeModule,
  type NativeCapabilities,
  type LoadResult,
} from './native-loader';
export {
  CpuAffinityManager,
  IrqIsolationManager,
  RealtimePriorityManager,
  PerformanceIsolationSystem,
  getPerformanceIsolationSystem,
} from './IrqIsolation';
export type {
  IsolationLevel,
  CpuSet,
  IrqConfig,
  IsolationStatus,
} from './IrqIsolation';
export {
  TieredStorage,
  getTieredStorage,
} from './TieredStorage';
export type {
  StorageTier,
  StorageItem,
  StorageConfig,
  StorageStats,
} from './TieredStorage';

// 记忆系统优化模块
export { SQLiteMemoryStore } from './sqlite-memory-store';
export type { SQLiteMemory, SQLiteMemoryStoreConfig, MemorySearchResult as SQLiteMemorySearchResult } from './sqlite-memory-store';
export { NativeHNSWIndex, WasmHNSWIndex, createNativeHNSW } from './native-hnsw';
export type { NativeHNSWConfig, HNSWStats } from './native-hnsw';
export { SemanticCompressor } from './semantic-compressor';
export type { CompressibleMemory, CompressedMemory, CompressionResult, SemanticCompressorConfig } from './semantic-compressor';
export { MLForgetDetector } from './ml-forget-detector';
export type { ForgetFeatures, ForgetLabel, ForgetModel, MLPrediction, MLForgetDetectorConfig } from './ml-forget-detector';
export { KnowledgeFusionEngine } from './knowledge-fusion';
export type { EntityAlignment, RelationInference, ConfidenceFusion, ConflictDetection, KnowledgeFusionResult, KnowledgeFusionConfig } from './knowledge-fusion';
