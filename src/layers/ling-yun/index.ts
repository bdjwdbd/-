/**
 * L5 灵韵层 - 反馈与调节
 * 
 * 负责反馈收集、度量分析、演进优化、联邦学习
 */

// 原有组件（文件名大小写修正）
export { FeedbackRegulationSystem } from './FeedbackRegulation';
export { RatchetManager } from './RatchetManager';
export { IndependentEvaluator } from './IndependentEvaluator';
export { ResultCardGenerator } from './ResultCardGenerator';
export { TestPromptFramework } from './TestPromptFramework';

// 从 IndependentEvaluator 导出类型
export type { EvaluationResult } from './IndependentEvaluator';

// 从 ResultCardGenerator 导出类型
export type { CardTheme } from './ResultCardGenerator';

// 迁移组件 - 度量收集
export { MetricsCollector } from './engine';

// 迁移组件 - 演进优化
export { EvolutionEngine } from './engine';

// 迁移组件 - 联邦学习
export { FederatedEngine } from './federated-engine/engine';

// 迁移组件 - 记忆升级
export { SmartMemoryUpgrader } from './smart-memory-upgrader';

// 其他模块 - 使用命名空间避免冲突
export * as MemoryEnhancedSelfImprovement from './MemoryEnhancedSelfImprovement';
export * as PracticeCognition from './PracticeCognition';
export * as SelfImprovement from './SelfImprovement';
