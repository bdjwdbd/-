/**
 * 元灵系统 v4.9.6 - 统一入口
 * 
 * 这是系统的主入口点。
 * 
 * 架构原则：
 * - YuanLingSystem 是唯一主入口（PRIMARY_ENTRY）
 * - OpenClawBridge 是薄适配器，委托给 YuanLingSystem
 * 
 * 主要特性：
 * - 六层架构：L0灵思 → L1灵枢 → L2灵脉 → L3灵躯 → L4灵盾 → L5灵韵
 * - 智能系统：意图识别、工具匹配、Skill发现、智能路由
 * - 健壮性：超时控制、重试机制、熔断保护、限流控制
 * - 性能优化：并行执行、智能缓存、请求去重、性能采样
 * - Harness Engineering：状态管理、追踪系统、沙盒隔离、度量演进
 */

// ============ 主入口（PRIMARY_ENTRY）============

export { 
  YuanLingSystem, 
  getYuanLingSystem, 
  startup,
  quickIntrospect,
  VERSION,
  BUILD_DATE,
} from './yuanling-system';

export type { 
  YuanLingSystemConfig,
  Message,
  Tool,
  ToolCall,
  ToolResult,
  Context,
  Failure,
  LLMConfig,
  EmbeddingConfig,
  EmbeddingResult,
  VectorEntry,
  VectorSearchResult,
  VectorStoreConfig,
  ThinkingResult,
  DecisionResult,
  ValidationResult,
  FeedbackResult,
  ProcessingContext,
  ExternalExecutor,
} from './yuanling-system';

// ============ OpenClaw 桥接层（薄适配器）============

export { 
  OpenClawBridge, 
  getOpenClawBridge, 
  processWithYuanLing 
} from './openclaw-bridge';

export type { 
  OpenClawMessage, 
  OpenClawToolCall, 
  OpenClawResult, 
  YuanLingContext 
} from './openclaw-bridge';

// ============ 自动启用 ============

export { 
  autoEnable, 
  quickCheck, 
  getState, 
  resetState 
} from './auto-enable';

export type { 
  AutoEnableState, 
  AutoEnableConfig 
} from './auto-enable';

// ============ L0 灵思层集成 ============

export { 
  L0Manager, 
  getL0Manager, 
  quickThink 
} from './l0-integration';

export type { L0Config } from './l0-integration';

// ============ L0 灵思层 ============

export * from './layers/ling-si';

// ============ L1 灵枢层 ============

export * from './layers/ling-shu';

// ============ L2 灵脉层 ============

export * from './layers/ling-mai';

// ============ L5 灵韵层 ============

// 使用别名避免与 Harness 冲突
export {
  FeedbackRegulationSystem,
  RatchetManager,
  IndependentEvaluator,
  ResultCardGenerator,
  TestPromptFramework,
  MetricsCollector as LayerMetricsCollector,
  EvolutionEngine as LayerEvolutionEngine,
  FederatedEngine as LayerFederatedEngine,
  SmartMemoryUpgrader as LayerSmartMemoryUpgrader,
} from './layers/ling-yun';

// ============ 输出层 ============

export * from './output';

// ============ 元灵自省系统 ============

export * from './introspection';

// ============ 简化版自省 ============

export { SimpleIntrospection } from './introspection/simple-tracker';

// ============ 基础设施组件 ============

export { 
  TokenEstimator, 
  CacheSystem,
  PerformanceMonitor,
  StructuredLogger,
  ContextReset,
  SprintContractManager,
} from './infrastructure';

export { MemoryCompressor } from './infrastructure/memory-compressor';
export { MultiModelRouter } from './infrastructure/multi-model-router';
export { DistributedTracing } from './infrastructure/distributed-tracing';
export { CompensationTracker } from './infrastructure/compensation-tracker';
export { AutoTuner } from './infrastructure/auto-tuner';
export { HybridSearchEngine as InfraHybridSearchEngine } from './infrastructure/hybrid-search';
export { QueryUnderstander } from './infrastructure/query-understander';
export { FeedbackLearner } from './infrastructure/feedback-learner';
export { ResultExplainer } from './infrastructure/result-explainer';
export { ResultSummarizer } from './infrastructure/result-summarizer';
export { MemoryUpgrader } from './infrastructure/memory-upgrader';
export { VectorCoverageMonitor } from './infrastructure/vector-coverage-monitor';
export { ExtensionManager } from './infrastructure/extension-manager';
export { SetupWizard } from './infrastructure/setup-wizard';
export { IntegrityValidator } from './infrastructure/integrity-validator';
export { KnowledgeGraph } from './infrastructure/knowledge-graph';
export { MetaCognition } from './infrastructure/meta-cognition';
export { InferenceEngine } from './infrastructure/inference-engine';
export { OnlineLearner } from './infrastructure/online-learner';
export { MultimodalFusion } from './infrastructure/multimodal-fusion';
export { CausalReasoner } from './infrastructure/causal-reasoner';
export { AutonomousLearner } from './infrastructure/autonomous-learner';
export { KnowledgeTransfer } from './infrastructure/knowledge-transfer';

// ============ 向量索引和量化 ============

export { HNSWIndex } from './core/hnsw-index';
export { VectorQuantizer } from './core/vector-quantizer';

// ============ 健康监控 ============

export { HealthMonitor } from './core/health-monitor';

// ============ 智能记忆和用户画像 ============

export { SmartMemoryUpgrader } from './core/smart-memory-upgrader';
export { PersonaManager } from './core/persona-manager';

// ============ 混合搜索引擎 ============

export { HybridSearchEngine } from './core/hybrid-search-engine';

// ============ 扩展模块 ============

export { Plugin, PluginManager, getPluginManager } from './extensions';

// ============ 监控模块 ============

export * from './monitoring';

// ============ Skills 发现 ============

export { SkillsDiscoveryEngine, skillsDiscoveryEngine } from './infrastructure/SkillsDiscovery';

// ============ Harness Engineering ============

export {
  // State Manager
  StateManager,
  StateCategory,
  StateLifecycle,
  StateStore,
  MemoryStateStore,
  FileStateStore,
  TieredStateStore,
  // Trace System
  TraceCollector,
  Span,
  Trace,
  SpanStatus,
  Layer,
  // PPAF
  PPAFEngine,
  PerceptionResult,
  PlanningResult,
  ActionResult,
  FeedbackResult as HarnessFeedbackResult,
  // Sandbox
  SandboxManager,
  SandboxLevel,
  SandboxConfig,
  RiskAssessor,
  RiskLevel,
  RiskAssessment,
  // Metrics
  MetricsCollector as HarnessMetricsCollector,
  MetricsAnalyzer,
  MetricCategory,
  // Evolution
  EvolutionEngine,
  ABTestConfig,
  // Harness System
  HarnessSystem,
} from './harness';

// ============ Dashboard ============

export * from './dashboard';

// ============ Multi-Agent ============

export {
  // Types
  AgentCapability,
  AgentDefinition,
  AgentInstance,
  AgentStatus,
  TaskPriority,
  TaskStatus,
  TaskDefinition,
  TaskInstance,
  MessageType,
  Message as MultiAgentMessage,
  SchedulingStrategy,
  CoordinatorConfig,
  DEFAULT_COORDINATOR_CONFIG,
  AggregationStrategy as MultiAgentAggregationStrategy,
  ConflictResolutionStrategy,
  AggregationResult as MultiAgentAggregationResult,
  WorkflowStep as MultiAgentWorkflowStep,
  WorkflowDefinition as MultiAgentWorkflowDefinition,
  WorkflowInstance,
  // Coordinator
  Coordinator,
  createCoordinator,
} from './multi-agent';

// ============ 自然语言编程 ============

export * from './nl-programming';

// ============ 边缘计算 ============

export * from './edge';

// ============ 联邦学习 ============

export {
  // Types
  FederatedRole,
  AggregationStrategy as FederatedAggregationStrategy,
  PrivacyStrategy,
  FederatedConfig,
  ModelParameters,
  GradientUpdate,
  AggregationResult as FederatedAggregationResult,
  TrainingRound,
  FederatedStatus,
  DEFAULT_FEDERATED_CONFIG,
  // Engine
  FederatedEngine,
  createFederatedEngine,
} from './federated';
