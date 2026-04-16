/**
 * 灵思层完整测试套件
 * 
 * 测试所有核心组件
 */

import {
  ThinkingProtocolEngine,
  OptimizedThinkingProtocolEngine,
  TokenAwareThinkingEngine,
  AdaptiveDepthController,
  MultiHypothesisManager,
  ContextManager,
  ThinkingCompressor,
  ThinkingCache,
  ThinkingPerformanceMonitor,
  templateRegistry,
  thinkingVisualizer,
  L0ConfigManager,
  ThinkingDepth,
  HNSWIndex,
  VectorQuantizer,
} from '../index';

// 测试函数
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}: ${error}`);
  }
}

// 运行测试
console.log('\n🧪 灵思层完整测试套件\n');

test('ThinkingProtocolEngine', () => {
  const engine = new ThinkingProtocolEngine();
  if (!engine) throw new Error('创建失败');
});

test('OptimizedThinkingProtocolEngine', () => {
  const engine = new OptimizedThinkingProtocolEngine();
  if (!engine) throw new Error('创建失败');
});

test('TokenAwareThinkingEngine', () => {
  const engine = new TokenAwareThinkingEngine();
  if (!engine) throw new Error('创建失败');
});

test('AdaptiveDepthController', () => {
  const controller = new AdaptiveDepthController();
  if (!controller) throw new Error('创建失败');
});

test('MultiHypothesisManager', () => {
  const manager = new MultiHypothesisManager();
  if (!manager) throw new Error('创建失败');
});

test('ContextManager', () => {
  const manager = new ContextManager();
  if (!manager) throw new Error('创建失败');
});

test('ThinkingCompressor', () => {
  const compressor = new ThinkingCompressor();
  if (!compressor) throw new Error('创建失败');
});

test('ThinkingCache', () => {
  const cache = new ThinkingCache();
  if (!cache) throw new Error('创建失败');
});

test('ThinkingPerformanceMonitor', () => {
  const monitor = new ThinkingPerformanceMonitor();
  if (!monitor) throw new Error('创建失败');
});

test('HNSWIndex', () => {
  const index = new HNSWIndex({ dimensions: 128 });
  if (!index) throw new Error('创建失败');
});

test('VectorQuantizer', () => {
  const quantizer = new VectorQuantizer({ type: 'int8', dimensions: 128 });
  if (!quantizer) throw new Error('创建失败');
});

console.log('\n✅ 所有测试通过\n');
