/**
 * 联邦学习测试
 */

import { createFederatedEngine, FederatedRole, AggregationStrategy, PrivacyStrategy } from './index';

async function testFederatedLearning() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       联邦学习集成测试                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 创建联邦学习引擎
  const engine = createFederatedEngine({
    nodeId: 'federated_server_001',
    role: FederatedRole.SERVER,
    aggregationStrategy: AggregationStrategy.FEDERATED_AVERAGING,
    privacyStrategy: PrivacyStrategy.DIFFERENTIAL_PRIVACY,
    training: {
      localEpochs: 5,
      batchSize: 32,
      learningRate: 0.01,
      optimizer: 'adam',
    },
    communication: {
      minClients: 3,
      maxClients: 10,
      clientFraction: 0.5,
      timeoutMs: 60000,
      maxRetries: 3,
    },
    privacy: {
      epsilon: 1.0,
      delta: 1e-5,
      clipNorm: 1.0,
      noiseScale: 0.1,
    },
  });

  // 初始化引擎
  await engine.initialize();

  // 注册客户端
  console.log('\n━━━━━━ 注册客户端 ━━━━━━');
  
  const clients = ['client_001', 'client_002', 'client_003', 'client_004', 'client_005'];
  for (const clientId of clients) {
    engine.registerClient(clientId);
  }

  // 运行训练轮次
  console.log('\n━━━━━━ 训练轮次 ━━━━━━');
  
  for (let i = 0; i < 3; i++) {
    console.log(`\n--- 轮次 ${i + 1} ---`);
    await engine.startRound();
    await engine.aggregate();
  }

  // 查看状态
  console.log('\n━━━━━━ 系统状态 ━━━━━━');
  
  const status = engine.getStatus();
  console.log(`  节点: ${status.node.id} (${status.node.role})`);
  console.log(`  当前轮次: ${status.currentRound}/${status.totalRounds}`);
  console.log(`  客户端:`);
  console.log(`    - 总数: ${status.clients.total}`);
  console.log(`    - 活跃: ${status.clients.active}`);
  console.log(`    - 参与: ${status.clients.participating}`);
  console.log(`  模型:`);
  console.log(`    - 版本: ${status.model.version}`);
  console.log(`    - 准确率: ${status.model.accuracy ? (status.model.accuracy * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`    - 损失: ${status.model.loss?.toFixed(4) || 'N/A'}`);
  console.log(`  通信:`);
  console.log(`    - 发送: ${status.communication.messagesSent} 消息, ${(status.communication.bytesSent / 1024).toFixed(2)} KB`);
  console.log(`    - 接收: ${status.communication.messagesReceived} 消息, ${(status.communication.bytesReceived / 1024).toFixed(2)} KB`);

  // 查看轮次历史
  console.log('\n━━━━━━ 轮次历史 ━━━━━━');
  
  const history = engine.getRoundHistory();
  console.log(`  总轮次: ${history.length}`);
  for (const round of history) {
    const duration = round.endTime && round.startTime 
      ? ((round.endTime - round.startTime) / 1000).toFixed(2) 
      : 'N/A';
    console.log(`  轮次 ${round.roundNumber}:`);
    console.log(`    - 状态: ${round.status}`);
    console.log(`    - 参与者: ${round.clientUpdates.size}`);
    console.log(`    - 耗时: ${duration}s`);
    console.log(`    - 准确率: ${round.metrics.accuracy ? (round.metrics.accuracy * 100).toFixed(1) + '%' : 'N/A'}`);
  }

  // 获取全局模型
  console.log('\n━━━━━━ 全局模型 ━━━━━━');
  
  const model = engine.getGlobalModel();
  if (model) {
    console.log(`  版本: ${model.version}`);
    console.log(`  哈希: ${model.hash.slice(0, 16)}...`);
    console.log(`  参数层:`);
    for (const [key, weights] of Object.entries(model.weights)) {
      console.log(`    - ${key}: ${weights.length} 参数`);
    }
  }

  // 关闭引擎
  await engine.shutdown();

  console.log('\n✅ 联邦学习集成测试通过\n');
}

// 运行测试
testFederatedLearning().catch(console.error);
