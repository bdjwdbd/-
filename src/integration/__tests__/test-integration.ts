/**
 * 集成测试
 */

import {
  ThinkingProtocolEngine,
  ThinkingResult,
  ThinkingContext,
  ThinkingDepth,
  MultiHypothesisManager,
  AdaptiveDepthController,
} from '../index';

console.log('🧪 集成测试\n');

// 测试 1: ThinkingProtocolEngine
console.log('测试 1: ThinkingProtocolEngine');
const engine = new ThinkingProtocolEngine();
console.log('✅ 创建成功\n');

// 测试 2: MultiHypothesisManager
console.log('测试 2: MultiHypothesisManager');
const manager = new MultiHypothesisManager();
console.log('✅ 创建成功\n');

// 测试 3: AdaptiveDepthController
console.log('测试 3: AdaptiveDepthController');
const controller = new AdaptiveDepthController();
console.log('✅ 创建成功\n');

console.log('✅ 所有集成测试通过');
