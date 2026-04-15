/**
 * 元灵系统 v4.3.0 - 统一入口
 * 
 * 这是系统的主入口点。
 * 
 * 架构原则：
 * - YuanLingSystem 是唯一主入口（PRIMARY_ENTRY）
 * - OpenClawBridge 是薄适配器，委托给 YuanLingSystem
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

export * from './layers/ling-yun';

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
  LearningValidator,
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
