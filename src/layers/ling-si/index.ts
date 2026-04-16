/**
 * L0 灵思层 - 思考协议
 * 
 * 负责深度思考、假设生成、向量检索
 */

// 原有组件
export { ThinkingProtocolEngine } from './ThinkingProtocolEngine';
export { EnhancedThinkingEngine } from './EnhancedThinkingEngine';
export { OptimizedThinkingProtocolEngine } from './OptimizedThinkingEngine';
export { TokenAwareThinkingEngine, TokenAwareThinkingController } from './TokenAwareThinking';
export { MultiHypothesisManager } from './MultiHypothesisManager';
export { DomainIntegrator } from './DomainIntegrator';
export { NaturalLanguageInjector } from './NaturalLanguageInjector';
export { AuthenticThoughtFlowSimulator } from './AuthenticThoughtFlow';
export { ProgressiveUnderstandingTracker } from './ProgressiveUnderstandingTracker';
export { AdvancedThinkingTechniquesEngine } from './AdvancedThinkingTechniques';
export { ConfigManager as L0ConfigManager } from './ConfigManager';
export { AdaptiveDepthController } from './AdaptiveDepthController';
export { ContextManager } from './ContextManager';
export { ThinkingCompressor, ThinkingCache, ThinkingPerformanceMonitor } from './ThinkingOptimization';
export { templateRegistry } from './ThinkingTemplates';
export { thinkingVisualizer } from './ThinkingVisualization';

// 类型导出
export { ThinkingDepth, ThinkingContext, ThinkingResult } from './types';

// 迁移组件
export { HNSWIndex } from './hnsw-index';
export { VectorQuantizer } from './vector-quantizer';

export * from './EmotionEngine';
export * from './EnhancedThinkingSteps';
export * from './MemoryEnhancedThinkingEngine';
export * from './ThinkingSteps';
export * from './ThoughtFlowSynthesizer';
