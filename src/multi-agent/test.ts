/**
 * 多 Agent 协作系统测试
 */

import { Coordinator, createCoordinator, AgentStatus, TaskPriority } from './index';

async function testMultiAgent() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       多 Agent 协作系统测试                              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 创建协调器
  const coordinator = createCoordinator();
  await coordinator.start();

  // 注册 Agent
  console.log('━━━━━━ 注册 Agent ━━━━━━');
  
  const agent1 = coordinator.registerAgent({
    agentId: 'agent_001',
    name: '搜索专家',
    description: '擅长信息搜索和检索',
    capabilities: [
      {
        id: 'search',
        name: '搜索',
        description: '执行搜索任务',
        inputType: 'string',
        outputType: 'SearchResult',
        performance: { avgLatency: 500, successRate: 0.95, costPerCall: 0.01 },
      },
    ],
    resourceLimits: {
      maxConcurrentTasks: 3,
      maxMemoryMB: 512,
      timeoutMs: 30000,
    },
    priority: 1,
    tags: ['search', 'retrieval'],
  });
  console.log(`  ✓ Agent: ${agent1.definition.name}`);

  const agent2 = coordinator.registerAgent({
    agentId: 'agent_002',
    name: '分析专家',
    description: '擅长数据分析和推理',
    capabilities: [
      {
        id: 'analyze',
        name: '分析',
        description: '执行分析任务',
        inputType: 'any',
        outputType: 'AnalysisResult',
        performance: { avgLatency: 1000, successRate: 0.9, costPerCall: 0.02 },
      },
    ],
    resourceLimits: {
      maxConcurrentTasks: 2,
      maxMemoryMB: 1024,
      timeoutMs: 60000,
    },
    priority: 2,
    tags: ['analysis', 'reasoning'],
  });
  console.log(`  ✓ Agent: ${agent2.definition.name}`);

  const agent3 = coordinator.registerAgent({
    agentId: 'agent_003',
    name: '写作专家',
    description: '擅长内容创作和编辑',
    capabilities: [
      {
        id: 'write',
        name: '写作',
        description: '执行写作任务',
        inputType: 'string',
        outputType: 'string',
        performance: { avgLatency: 2000, successRate: 0.92, costPerCall: 0.015 },
      },
    ],
    resourceLimits: {
      maxConcurrentTasks: 2,
      maxMemoryMB: 256,
      timeoutMs: 45000,
    },
    priority: 1,
    tags: ['writing', 'content'],
  });
  console.log(`  ✓ Agent: ${agent3.definition.name}`);

  // 提交任务
  console.log('\n━━━━━━ 提交任务 ━━━━━━');
  
  const task1 = coordinator.submitTask({
    taskId: 'task_001',
    name: '搜索天气信息',
    description: '搜索北京今天的天气',
    input: { query: '北京天气' },
    expectedOutputType: 'SearchResult',
    priority: TaskPriority.HIGH,
    dependencies: [],
    constraints: {
      timeoutMs: 10000,
      maxRetries: 2,
      requiredCapabilities: ['search'],
    },
    metadata: {},
  });
  console.log(`  ✓ 任务: ${task1.definition.name}`);

  const task2 = coordinator.submitTask({
    taskId: 'task_002',
    name: '分析市场数据',
    description: '分析最近的市场趋势',
    input: { data: 'market_data.csv' },
    expectedOutputType: 'AnalysisResult',
    priority: TaskPriority.NORMAL,
    dependencies: [],
    constraints: {
      timeoutMs: 30000,
      maxRetries: 3,
      requiredCapabilities: ['analyze'],
    },
    metadata: {},
  });
  console.log(`  ✓ 任务: ${task2.definition.name}`);

  const task3 = coordinator.submitTask({
    taskId: 'task_003',
    name: '撰写报告',
    description: '根据分析结果撰写报告',
    input: { topic: '市场分析报告' },
    expectedOutputType: 'string',
    priority: TaskPriority.LOW,
    dependencies: ['task_002'],
    constraints: {
      timeoutMs: 20000,
      maxRetries: 2,
      requiredCapabilities: ['write'],
    },
    metadata: {},
  });
  console.log(`  ✓ 任务: ${task3.definition.name}`);

  // 查看状态
  console.log('\n━━━━━━ 系统状态 ━━━━━━');
  const status = coordinator.getStatus();
  console.log(`  Agent 总数: ${status.agents.total}`);
  console.log(`  空闲 Agent: ${status.agents.idle}`);
  console.log(`  待处理任务: ${status.tasks.pending}`);
  console.log(`  执行中任务: ${status.tasks.running}`);
  console.log(`  已完成任务: ${status.tasks.completed}`);

  // 模拟消息处理
  console.log('\n━━━━━━ 模拟任务执行 ━━━━━━');
  
  // 模拟任务完成
  coordinator.handleIncomingMessage({
    messageId: 'msg_001',
    type: 'task_complete' as any,
    from: 'agent_001',
    to: 'coordinator',
    timestamp: Date.now(),
    payload: {
      taskId: 'task_001',
      output: { result: '北京今天晴，25°C' },
    },
    taskId: 'task_001',
  });

  coordinator.handleIncomingMessage({
    messageId: 'msg_002',
    type: 'task_complete' as any,
    from: 'agent_002',
    to: 'coordinator',
    timestamp: Date.now(),
    payload: {
      taskId: 'task_002',
      output: { result: '市场呈上升趋势' },
    },
    taskId: 'task_002',
  });

  // 最终状态
  console.log('\n━━━━━━ 最终状态 ━━━━━━');
  const finalStatus = coordinator.getStatus();
  console.log(`  Agent 总数: ${finalStatus.agents.total}`);
  console.log(`  空闲 Agent: ${finalStatus.agents.idle}`);
  console.log(`  待处理任务: ${finalStatus.tasks.pending}`);
  console.log(`  执行中任务: ${finalStatus.tasks.running}`);
  console.log(`  已完成任务: ${finalStatus.tasks.completed}`);

  // 查看所有 Agent
  console.log('\n━━━━━━ Agent 列表 ━━━━━━');
  const agents = coordinator.getAgents();
  for (const agent of agents) {
    console.log(`  ${agent.definition.name}:`);
    console.log(`    状态: ${agent.status}`);
    console.log(`    当前任务: ${agent.currentTasks}`);
    console.log(`    完成任务: ${agent.completedTasks}`);
    console.log(`    失败任务: ${agent.failedTasks}`);
  }

  await coordinator.stop();
  console.log('\n✅ 多 Agent 协作系统测试通过\n');
}

// 运行测试
testMultiAgent().catch(console.error);
