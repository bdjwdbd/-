/**
 * 基础设施层统一导出
 * 
 * 跨层基础设施
 * 
 * 注意：为避免重复导出，使用显式导出而非 export *
 */

// 从 core/infrastructure.ts 导出基础组件
export {
  TokenEstimator,
  CacheSystem,
  PerformanceMonitor,
  StructuredLogger,
  ContextReset,
  SprintContractManager,
} from '../core/infrastructure';

// 新增基础设施模块
export * from './dashboard';
export * from './config';
export * from './error-handling';

// 补充导出 - 内存相关
export { MemoryStore } from './memory-store';
export { ForgetDetector } from './forget-detector';
export { ConversationSummarizer } from './conversation-summarizer';
export { SmartTagger } from './smart-tagger';
export { VectorStore } from './vector-store';
export { PredictiveMaintenance } from './predictive-maintenance';
export { RBACManager } from './rbac';
export { ContextGuard } from './context-guard';
export { HealthChecker } from './health-checker';
export { CloudSync } from './cloud-sync';

// 补充导出 - 知识相关
export { KnowledgeGraph } from './knowledge-graph';
export { MetaCognition } from './meta-cognition';
export { InferenceEngine } from './inference-engine';
export { OnlineLearner } from './online-learner';
export { CausalReasoner } from './causal-reasoner';
export { AutonomousLearner } from './autonomous-learner';
export { KnowledgeTransfer } from './knowledge-transfer';

// 核心模块 - 使用显式导出避免冲突
// HNSWIndex
export { HNSWIndex, HNSWConfig, VectorNode, SearchResult, IndexStats } from './HNSWIndex';

// SelfDiagnostic
export { HealthStatus, HealthCheck, SystemHealth, PerformanceMetrics, DiagnosticResult } from './SelfDiagnostic';

// auto-tuner
export { AutoTuner } from './auto-tuner';

// logger
export { LoggerManager, LogLevel, getLogger, initLogger } from './logger';

// monitor
export { Monitor } from './monitor';

// 其他模块 - 使用命名空间导出避免冲突
export * as AdaptiveSearch from './adaptive-search';
export * as Api from './api';
export * as AsyncOps from './async-ops';
export * as CacheManager from './cache-manager';
export * as CacheOptimizer from './cache-optimizer';
export * as CheckpointSystem from './checkpoint-system';
export * as CodeValidator from './code-validator';
export * as CodeValidatorV2 from './code-validator-v2';
export * as CompensationTracker from './compensation-tracker';
export * as ContextQualityMonitor from './context-quality-monitor';
export * as CpuOptimizer from './cpu-optimizer';
export * as CriteriaInferenceEngine from './criteria-inference-engine';
export * as CrossLingual from './cross-lingual';
export * as DagVisualizer from './dag-visualizer';
export * as DiskHnsw from './disk-hnsw';
export * as DiskPersistence from './disk-persistence';
export * as DistributedSearch from './distributed-search';
export * as DistributedSearchEngine from './distributed-search-engine';
export * as DistributedTracing from './distributed-tracing';
export * as DynamicWeights from './dynamic-weights';
export * as EmbeddingConfig from './embedding-config';
export * as ExtensionManager from './extension-manager';
export * as Failover from './failover';
export * as FeedbackLearner from './feedback-learner';
export * as FeedbackLearning from './feedback-learning';
export * as GpuAccelerator from './gpu-accelerator';
export * as GpuOps from './gpu-ops';
export * as HardwareOptimize from './hardware-optimize';
export * as HighPerfVectorEngineV3 from './high-perf-vector-engine-v3';
export * as HnswAutoTuner from './hnsw-auto-tuner';
export * as HnswOptimized from './hnsw-optimized';
export * as HugepageManager from './hugepage-manager';
export * as HybridSearch from './hybrid-search';
export * as IndexPersistence from './index-persistence';
export * as Int8Quantizer from './int8-quantizer';
export * as IntegrityValidator from './integrity-validator';
export * as IrqIsolation from './IrqIsolation';
export * as JitAccel from './jit-accel';
export * as KnowledgeFusion from './knowledge-fusion';
export * as LlmStreaming from './llm-streaming';
export * as Matryoshka from './matryoshka';
export * as MemoryCompressor from './memory-compressor';
export * as MemoryUpgrader from './memory-upgrader';
export * as MklBridge from './mkl-bridge';
export * as MklDirect from './mkl-direct';
export * as MlForgetDetector from './ml-forget-detector';
export * as ModelRouter from './model-router';
export * as MultiDimensionalRouter from './multi-dimensional-router';
export * as MultiModelRouter from './multi-model-router';
export * as MultimodalEmbedding from './multimodal-embedding';
export * as MultimodalFusion from './multimodal-fusion';
export * as MultimodalSearch from './multimodal-search';
export * as NativeAccelerator from './native-accelerator';
export * as NativeDownloader from './native-downloader';
export * as NativeHnsw from './native-hnsw';
export * as NativeLoader from './native-loader';
export * as NativeVector from './native-vector';
export * as OpqQuantization from './opq-quantization';
export * as ProductQuantizer from './product-quantizer';
export * as ProductQuantizerOptimized from './product-quantizer-optimized';
export * as Quantization from './quantization';
export * as QueryCache from './query-cache';
export * as QueryHistory from './query-history';
export * as QueryResultCache from './query-result-cache';
export * as QueryRewriter from './query-rewriter';
export * as QueryRouter from './query-router';
export * as QueryUnderstand from './query-understand';
export * as QueryUnderstander from './query-understander';
export * as ResidualQuantizer from './residual-quantizer';
export * as ResultExplainer from './result-explainer';
export * as ResultSummarizer from './result-summarizer';
export * as RrfFusion from './rrf-fusion';
export * as SemanticCompressor from './semantic-compressor';
export * as SemanticDedup from './semantic-dedup';
export * as SetupWizard from './setup-wizard';
export * as SkillsDiscovery from './SkillsDiscovery';
export * as SqliteMemoryStore from './sqlite-memory-store';
export * as SystemOptimizer from './system-optimizer';
export * as ThreadPool from './thread-pool';
export * as Tier3Optimizer from './tier3-optimizer';
export * as TieredStorage from './TieredStorage';
export * as VectorCache from './vector-cache';
export * as VectorCoverageMonitor from './vector-coverage-monitor';
export * as VectorOps from './vector-ops';
export * as VectorWorker from './vector-worker';
export * as WalOptimizer from './wal-optimizer';
export * as WasmVectorEngine from './WasmVectorEngine';
export * as WebgpuAccelerator from './webgpu-accelerator';
export * as WebgpuEngine from './webgpu-engine';
export * as WorkerPool from './worker-pool';
