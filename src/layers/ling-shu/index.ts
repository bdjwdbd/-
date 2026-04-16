/**
 * L1 灵枢层 - 决策与协调
 * 
 * 负责意图分析、决策制定、多 Agent 协调
 */

// 原有组件
export { ContractValidator, IntentEngine, DecisionReasoningEngine, TaskQueueManager } from './DecisionCenter';

// 迁移组件
export { Coordinator } from './multi-agent-coordinator';
export { PersonaManager } from './persona-manager';

// 别名
export { IntentEngine as DecisionCenter } from './DecisionCenter';

export * from './ContradictionAnalyzer';
export * from './KnowledgeEnhancedDecisionCenter';
export * from './ProtractedStrategy';
