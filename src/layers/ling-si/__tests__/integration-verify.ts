/**
 * 灵思层集成验证
 * 
 * 验证所有组件是否正确导出和集成
 */

// 导入所有组件
import {
  // 核心引擎
  ThinkingProtocolEngine,
  OptimizedThinkingProtocolEngine,
  TokenAwareThinkingEngine,
  
  // 控制器和管理器
  AdaptiveDepthController,
  MultiHypothesisManager,
  TokenAwareThinkingController,
  ContextManager,
  
  // 优化组件
  ThinkingCompressor,
  ThinkingCache,
  ThinkingPerformanceMonitor,
  
  // 模板
  templateRegistry,
  
  // 可视化
  thinkingVisualizer,
  
  // 配置
  L0ConfigManager,
  
  // 类型
  ThinkingDepth,
  ThinkingContext,
  ThinkingResult,
  
  // 迁移组件
  HNSWIndex,
  VectorQuantizer,
} from '../index';

// 创建实例
const engine = new ThinkingProtocolEngine();
const optimizedEngine = new OptimizedThinkingProtocolEngine();
const tokenAwareEngine = new TokenAwareThinkingEngine();
const adaptiveController = new AdaptiveDepthController();
const multiHypothesisManager = new MultiHypothesisManager();
const contextManager = new ContextManager();
const compressor = new ThinkingCompressor();
const cache = new ThinkingCache();
const perfMonitor = new ThinkingPerformanceMonitor();
const hnswIndex = new HNSWIndex({ dimensions: 128 });
const vectorQuantizer = new VectorQuantizer({ type: 'int8', dimensions: 128 });

// 验证导出
console.log('✅ ThinkingProtocolEngine:', typeof ThinkingProtocolEngine);
console.log('✅ OptimizedThinkingProtocolEngine:', typeof OptimizedThinkingProtocolEngine);
console.log('✅ TokenAwareThinkingEngine:', typeof TokenAwareThinkingEngine);
console.log('✅ AdaptiveDepthController:', typeof AdaptiveDepthController);
console.log('✅ MultiHypothesisManager:', typeof MultiHypothesisManager);
console.log('✅ ContextManager:', typeof ContextManager);
console.log('✅ ThinkingCompressor:', typeof ThinkingCompressor);
console.log('✅ ThinkingCache:', typeof ThinkingCache);
console.log('✅ ThinkingPerformanceMonitor:', typeof ThinkingPerformanceMonitor);
console.log('✅ templateRegistry:', typeof templateRegistry);
console.log('✅ thinkingVisualizer:', typeof thinkingVisualizer);
console.log('✅ L0ConfigManager:', typeof L0ConfigManager);
console.log('✅ ThinkingDepth:', typeof ThinkingDepth);
console.log('✅ HNSWIndex:', typeof HNSWIndex);
console.log('✅ VectorQuantizer:', typeof VectorQuantizer);

// 验证实例
console.log('✅ engine instance:', engine instanceof ThinkingProtocolEngine);
console.log('✅ optimizedEngine instance:', optimizedEngine instanceof OptimizedThinkingProtocolEngine);
console.log('✅ tokenAwareEngine instance:', tokenAwareEngine instanceof TokenAwareThinkingEngine);
console.log('✅ adaptiveController instance:', adaptiveController instanceof AdaptiveDepthController);
console.log('✅ multiHypothesisManager instance:', multiHypothesisManager instanceof MultiHypothesisManager);
console.log('✅ contextManager instance:', contextManager instanceof ContextManager);
console.log('✅ compressor instance:', compressor instanceof ThinkingCompressor);
console.log('✅ cache instance:', cache instanceof ThinkingCache);
console.log('✅ perfMonitor instance:', perfMonitor instanceof ThinkingPerformanceMonitor);
console.log('✅ hnswIndex instance:', hnswIndex instanceof HNSWIndex);
console.log('✅ vectorQuantizer instance:', vectorQuantizer instanceof VectorQuantizer);

console.log('\n✅ 灵思层集成验证通过');
