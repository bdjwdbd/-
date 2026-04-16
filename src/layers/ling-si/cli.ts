/**
 * 灵思层 CLI
 * 
 * 命令行工具
 */

import {
  ThinkingProtocolEngine,
  OptimizedThinkingProtocolEngine,
  TokenAwareThinkingEngine,
  AdaptiveDepthController,
  MultiHypothesisManager,
  ContextManager,
  ThinkingDepth,
  L0ConfigManager,
} from '../index';

// 创建实例
const engine = new ThinkingProtocolEngine();
const optimizedEngine = new OptimizedThinkingProtocolEngine();
const tokenEngine = new TokenAwareThinkingEngine();
const depthController = new AdaptiveDepthController();
const hypothesisManager = new MultiHypothesisManager();
const contextManager = new ContextManager();

console.log('✅ 灵思层 CLI 初始化完成');
console.log('可用命令: think, depth, hypothesis, context, config');
