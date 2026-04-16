/**
 * 基础设施层统一导出
 * 
 * 跨层基础设施
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

export * from './HNSWIndex';
export * from './IrqIsolation';
export * from './SelfDiagnostic';
export * from './SkillsDiscovery';
export * from './TieredStorage';
export * from './WasmVectorEngine';
export * from './adaptive-search';
export * from './api';
export * from './async-ops';
export * from './auto-tuner';
export * from './cache-manager';
export * from './cache-optimizer';
export * from './checkpoint-system';
export * from './code-validator-v2';
export * from './code-validator';
export * from './compensation-tracker';
export * from './context-quality-monitor';
export * from './cpu-optimizer';
export * from './criteria-inference-engine';
export * from './cross-lingual';
export * from './dag-visualizer';
export * from './disk-hnsw';
export * from './disk-persistence';
export * from './distributed-search-engine';
export * from './distributed-search';
export * from './distributed-tracing';
export * from './dynamic-weights';
export * from './embedding-config';
export * from './extension-manager';
export * from './failover';
export * from './feedback-learner';
export * from './feedback-learning';
export * from './gpu-accelerator';
export * from './gpu-ops';
export * from './hardware-optimize';
export * from './high-perf-vector-engine-v3';
export * from './hnsw-auto-tuner';
export * from './hnsw-optimized';
export * from './hugepage-manager';
export * from './hybrid-search';
export * from './index-persistence';
export * from './int8-quantizer';
export * from './integrity-validator';
export * from './jit-accel';
export * from './knowledge-fusion';
export * from './llm-streaming';
export * from './logger';
export * from './matryoshka';
export * from './memory-compressor';
export * from './memory-upgrader';
export * from './mkl-bridge';
export * from './mkl-direct';
export * from './ml-forget-detector';
export * from './model-router';
export * from './monitor';
export * from './multi-dimensional-router';
export * from './multi-model-router';
export * from './multimodal-embedding';
export * from './multimodal-fusion';
export * from './multimodal-search';
export * from './native-accelerator';
export * from './native-downloader';
export * from './native-hnsw';
export * from './native-loader';
export * from './native-vector';
export * from './opq-quantization';
export * from './product-quantizer-optimized';
export * from './product-quantizer';
export * from './quantization';
export * from './query-cache';
export * from './query-history';
export * from './query-result-cache';
export * from './query-rewriter';
export * from './query-router';
export * from './query-understand';
export * from './query-understander';
export * from './residual-quantizer';
export * from './result-explainer';
export * from './result-summarizer';
export * from './rrf-fusion';
export * from './semantic-compressor';
export * from './semantic-dedup';
export * from './setup-wizard';
export * from './sqlite-memory-store';
export * from './system-optimizer';
export * from './thread-pool';
export * from './tier3-optimizer';
export * from './vector-cache';
export * from './vector-coverage-monitor';
export * from './vector-ops';
export * from './vector-worker';
export * from './wal-optimizer';
export * from './webgpu-accelerator';
export * from './webgpu-engine';
export * from './worker-pool';
