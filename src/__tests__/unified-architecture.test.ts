/**
 * 统一六层架构测试
 */

import {
  ILayer,
  BaseLayer,
  LayerManager,
  LayerFactory,
  LayerId,
  LayerContext,
  LayerResult,
  LayerConfig,
} from '../layers/unified-interface';

// ============ 测试层级实现 ============

interface TestLayerConfig extends LayerConfig {
  testValue?: number;
}

class TestLayer extends BaseLayer<TestLayerConfig, string> {
  readonly layerId: LayerId;
  readonly layerName: any;
  readonly description: string;
  
  constructor(layerId: LayerId, layerName: string, config: TestLayerConfig = {}) {
    super({ enabled: true, ...config });
    this.layerId = layerId;
    this.layerName = layerName as any;
    this.description = `测试层级 ${layerId}`;
  }
  
  protected async onExecute(context: LayerContext): Promise<LayerResult<string>> {
    return {
      success: true,
      layerId: this.layerId,
      data: `${this.layerId} 处理完成: ${context.userMessage}`,
      executionTimeMs: 0,
      confidence: 0.9,
    };
  }
}

// ============ 测试函数 ============

async function testUnifiedInterface() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       统一六层架构测试                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 测试层级创建
  console.log('━━━━━━ 层级创建测试 ━━━━━━\n');
  
  const l0 = new TestLayer('L0', 'ling-si', { testValue: 100 });
  const l1 = new TestLayer('L1', 'ling-shu');
  const l2 = new TestLayer('L2', 'ling-mai');
  const l3 = new TestLayer('L3', 'ling-qu');
  const l4 = new TestLayer('L4', 'ling-dun');
  const l5 = new TestLayer('L5', 'ling-yun');
  const l6 = new TestLayer('L6', 'ling-shi');
  
  console.log(`✅ L0 灵思层: ${l0.description}`);
  console.log(`✅ L1 灵枢层: ${l1.description}`);
  console.log(`✅ L2 灵脉层: ${l2.description}`);
  console.log(`✅ L3 灵躯层: ${l3.description}`);
  console.log(`✅ L4 灵盾层: ${l4.description}`);
  console.log(`✅ L5 灵韵层: ${l5.description}`);
  console.log(`✅ L6 灵识层: ${l6.description}`);

  // 测试层级状态
  console.log('\n━━━━━━ 层级状态测试 ━━━━━━\n');
  
  const state = l0.getState();
  console.log(`✅ L0 状态:`);
  console.log(`   - 已初始化: ${state.initialized}`);
  console.log(`   - 已启用: ${state.enabled}`);
  console.log(`   - 执行次数: ${state.executionCount}`);
  console.log(`   - 错误次数: ${state.errorCount}`);

  // 测试层级管理器
  console.log('\n━━━━━━ 层级管理器测试 ━━━━━━\n');
  
  const manager = new LayerManager({
    sequential: true,
    errorStrategy: 'continue',
  });
  
  manager.registerLayer(l0);
  manager.registerLayer(l1);
  manager.registerLayer(l2);
  manager.registerLayer(l3);
  manager.registerLayer(l4);
  manager.registerLayer(l5);
  manager.registerLayer(l6);
  
  console.log(`✅ 已注册 7 个层级`);

  // 初始化所有层级
  console.log('\n━━━━━━ 初始化测试 ━━━━━━\n');
  
  await manager.initializeAll();
  console.log('✅ 所有层级初始化完成');

  // 获取所有状态
  const allStates = manager.getAllStates();
  console.log(`✅ 获取所有层级状态: ${allStates.size} 个`);
  
  for (const [id, state] of allStates) {
    console.log(`   - ${id}: initialized=${state.initialized}`);
  }

  // 顺序执行测试
  console.log('\n━━━━━━ 顺序执行测试 ━━━━━━\n');
  
  const context: LayerContext = {
    sessionId: 'test-session',
    messageId: 'test-message',
    userMessage: '测试消息',
  };
  
  const results = await manager.executeSequential(context);
  console.log(`✅ 顺序执行完成: ${results.size} 个结果`);
  
  for (const [id, result] of results) {
    console.log(`   - ${id}: success=${result.success}, time=${result.executionTimeMs}ms`);
    if (result.data) {
      console.log(`     数据: ${result.data}`);
    }
  }

  // 并行执行测试
  console.log('\n━━━━━━ 并行执行测试 ━━━━━━\n');
  
  const parallelResults = await manager.executeParallel(context);
  console.log(`✅ 并行执行完成: ${parallelResults.size} 个结果`);

  // 层级工厂测试
  console.log('\n━━━━━━ 层级工厂测试 ━━━━━━\n');
  
  const factory = LayerFactory.getInstance();
  
  factory.registerCreator('L0', () => new TestLayer('L0', 'ling-si'));
  factory.registerCreator('L1', () => new TestLayer('L1', 'ling-shu'));
  factory.registerCreator('L2', () => new TestLayer('L2', 'ling-mai'));
  
  console.log('✅ 已注册 3 个层级创建器');
  
  const createdL0 = factory.createLayer('L0');
  console.log(`✅ 创建 L0 层级: ${createdL0?.description}`);
  
  const allLayers = factory.createAllLayers();
  console.log(`✅ 创建所有层级: ${allLayers.length} 个`);

  // 关闭所有层级
  console.log('\n━━━━━━ 关闭测试 ━━━━━━\n');
  
  await manager.shutdownAll();
  console.log('✅ 所有层级已关闭');

  // 验证关闭状态
  const finalStates = manager.getAllStates();
  let allClosed = true;
  for (const [id, state] of finalStates) {
    if (state.initialized) {
      allClosed = false;
      console.log(`   ⚠️ ${id} 未正确关闭`);
    }
  }
  
  if (allClosed) {
    console.log('✅ 所有层级已正确关闭');
  }

  console.log('\n✅ 统一六层架构测试通过\n');
}

// 运行测试
testUnifiedInterface();
