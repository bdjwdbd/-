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
      this.logger.info('SprintContract', `开始执行: ${contract.goal}`);
    }
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
export { IntegrityValidator } from './integrity-validator';
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
export { ParallelVectorSearch, SimpleVectorSearch, createParallelSearch, createSimpleSearch, type ParallelSearchConfig, type SearchResult as ParallelSearchResult } from './parallel-search';
export { AdaptiveVectorSearch, createAdaptiveSearch, type AdaptiveSearchConfig, type SearchResult as AdaptiveSearchResult } from './adaptive-search';
export { GPUAccelerator, createGPUAccelerator, type GPUConfig, type GPUSearchResult } from './gpu-accelerator';
export { LoggerManager, getLogger, initLogger, startTimer, PerformanceTimer, type LoggerConfig, type LogLevel } from './logger';
export { CacheManager, getCacheManager, type CacheConfig as AdvancedCacheConfig, type CacheStats } from './cache-manager';
export { Quantizer, FP16Quantizer, INT8Quantizer, ScalarQuantizer, ProductQuantizer, BinaryQuantizer, createQuantizer, type QuantizationType, type QuantizerConfig } from './quantization';
export { QueryCache, QueryResultCache, type CacheEntry, type QueryCacheConfig, type QueryResult } from './query-cache';
export { AsyncVectorSearch, AsyncLLMClient, AsyncEmbeddingClient, AsyncMemoryPipeline, type AsyncSearchResult, type AsyncSearchConfig, type LLMConfig, type LLMResponse } from './async-ops';
export { VectorSharder, DistributedSearcher, type ShardConfig, type DistributedSearchResult, type NodeConfig } from './distributed-search';
export { HealthChecker, FailoverManager, NodeStatus, type Node, type HealthCheckConfig } from './failover';
export { ModelRouter, TaskType, ModelCapability, type Model, type RoutingDecision as ModelRoutingDecision, type ModelRouterConfig } from './model-router';
export { CPUOptimizer, getOptimizer, optimizeForIntelXeon, type CPUInfo, type CPUOptimizerConfig } from './cpu-optimizer';
export { CacheOptimizer, MemoryPool, getCacheOptimizer, getMemoryPool, type CacheConfig, type CacheBlockSizes } from './cache-optimizer';
export { IndexPersistence, IncrementalIndexUpdater, type IndexMetadata, type PersistenceConfig } from './index-persistence';
export { MultimodalEncoder, MultimodalSearcher, type ModalityType as MMModalityType, type MultimodalContent as MMMultimodalContent, type MultimodalEmbedding, type MultimodalSearchResult, type MultimodalEncoderConfig } from './multimodal-search';
export { GPUVectorOps, getGPUOps, isGPUAvailable, detectGPU, type GPUInfo, type GPUOpsConfig } from './gpu-ops';
export { ParallelCompute, INT8AcceleratedSearch, getParallelCompute, getNumThreads, type JITConfig } from './jit-accel';
export { HugePageManager, HighPerformanceMemoryPool, VectorMemoryManager, getHugePageManager, type HugePageInfo, type MemoryPoolConfig } from './hugepage-manager';
export { HardwareOptimizer, AMXAccelerator, NeuralEngineAccelerator, NEONAccelerator, getHardwareOptimizer, type HardwareInfo, type Optimizations } from './hardware-optimize';
export { LanguageDetector, CrossLingualEncoder, CrossLingualSearcher, type LanguageCode, type CrossLingualConfig } from './cross-lingual';
export { LLMStreamer, SSEServer, WebSocketHandler, StreamChunkImpl, type StreamChunk, type StreamerConfig } from './llm-streaming';
export { NativeLoader, Accelerator, getAccelerator, type SIMDCapabilities, type MemoryInfo, type SearchResult as NativeSearchResult, type NativeModules } from './native-accelerator';
