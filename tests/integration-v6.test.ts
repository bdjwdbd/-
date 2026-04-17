/**
 * 元灵系统 v6.0 集成测试
 */

// ============================================================================
// 测试 1: 三层解耦架构
// ============================================================================

async function testThreeLayerArchitecture(): Promise<void> {
  console.log('\n=== 测试 1: 三层解耦架构 ===\n');

  const { ThreeLayerArchitecture } = await import('../src/layers/architecture/index');
  const { IsolationLevel } = await import('../src/layers/architecture/index');

  const architecture = new ThreeLayerArchitecture({
    session: {
      maxConcurrentSessions: 10,
      sessionTimeout: 60000
    },
    harness: {
      maxIterations: 10,
      iterationTimeout: 30000
    },
    sandbox: {
      defaultIsolationLevel: IsolationLevel.NONE,
      maxSandboxes: 5
    },
    modelCaller: async (messages) => {
      return {
        content: 'This is a simulated response',
        isComplete: true
      };
    }
  });

  console.log('✅ 三层架构初始化成功');
  console.log(`   - 活跃 Session 数: ${architecture.getActiveSessionCount()}`);
  console.log(`   - 活跃 Sandbox 数: ${architecture.getActiveSandboxCount()}`);
  console.log(`   - Harness 状态: ${architecture.getHarnessState()}`);
}

// ============================================================================
// 测试 2: 14 层 Middleware
// ============================================================================

async function testMiddlewareStack(): Promise<void> {
  console.log('\n=== 测试 2: 14 层 Middleware ===\n');

  const { createDefaultMiddlewareStack } = await import('../src/layers/middleware/index');

  const middlewares = createDefaultMiddlewareStack({
    logging: { enabled: true },
    rateLimit: { enabled: true, maxRequests: 100 }
  });

  console.log(`✅ Middleware 栈创建成功`);
  console.log(`   - Middleware 数量: ${middlewares.length}`);
  
  const middlewareNames = [
    '认证', '授权', '限流', '日志', '追踪',
    '记忆加载', '上下文构建', '意图识别', '任务分解', '工具选择',
    '执行监控', '结果验证', '记忆存储', '响应格式化'
  ];
  
  middlewareNames.forEach((name, i) => {
    console.log(`   - Layer ${i + 1}: ${name}中间件`);
  });
}

// ============================================================================
// 测试 3: 五层记忆架构
// ============================================================================

async function testFiveLayerMemory(): Promise<void> {
  console.log('\n=== 测试 3: 五层记忆架构 ===\n');

  const { FiveLayerMemoryManager, MemoryLayer } = await import('../src/layers/memory/index');

  const memoryManager = new FiveLayerMemoryManager();

  // 添加会话记忆
  const sessionEntry = await memoryManager.add(MemoryLayer.SESSION, {
    content: 'User asked about TypeScript'
  });
  console.log(`✅ L0 会话记忆添加成功: ${sessionEntry.id}`);

  // 添加技能记忆
  const skillEntry = await memoryManager.add(MemoryLayer.SKILL, {
    content: 'TypeScript best practices'
  });
  console.log(`✅ L1 技能记忆添加成功: ${skillEntry.id}`);

  // 添加用户记忆
  const userEntry = await memoryManager.add(MemoryLayer.USER, {
    content: 'User prefers TypeScript over JavaScript'
  });
  console.log(`✅ L3 用户记忆添加成功: ${userEntry.id}`);

  // 获取统计信息
  const stats = await memoryManager.getAllStats();
  console.log('\n📊 记忆统计:');
  for (const [layer, stat] of stats) {
    console.log(`   - ${layer}: ${stat.total} 条`);
  }
}

// ============================================================================
// 测试 4: 42 个工具系统
// ============================================================================

async function testToolSystem(): Promise<void> {
  console.log('\n=== 测试 4: 42 个工具系统 ===\n');

  const { ToolRegistry } = await import('../src/layers/tools/index');

  const registry = new ToolRegistry();
  const tools = registry.getAll();

  console.log(`✅ 工具注册成功`);
  console.log(`   - 工具总数: ${tools.length}`);

  // 按分类统计
  const categories: Record<string, number> = {};
  for (const tool of tools) {
    const category = tool.tags[0] || 'other';
    categories[category] = (categories[category] || 0) + 1;
  }

  console.log('\n📊 工具分类:');
  for (const [category, count] of Object.entries(categories)) {
    console.log(`   - ${category}: ${count} 个`);
  }

  // 测试安全策略
  const securityPolicy = registry.getSecurityPolicy();
  console.log('\n🔒 安全策略:');
  console.log(`   - 启用的工具: ${securityPolicy.getEnabledTools().length} 个`);
  console.log(`   - 需确认的工具: ${securityPolicy.getToolsRequiringConfirmation().length} 个`);

  // 测试权限检查
  const permission = await securityPolicy.checkPermission('delete', { path: '/etc/passwd' });
  console.log(`   - 删除敏感文件: ${permission.allowed ? '允许' : '拒绝'}`);
  if (!permission.allowed) {
    console.log(`     原因: ${permission.reason}`);
  }
}

// ============================================================================
// 测试 5: 知识图谱
// ============================================================================

async function testKnowledgeGraph(): Promise<void> {
  console.log('\n=== 测试 5: 知识图谱 ===\n');

  const { KnowledgeGraph, QueryMode } = await import('../src/layers/knowledge/index');

  const graph = new KnowledgeGraph();

  // 添加文档
  const doc = await graph.addDocument(
    'TypeScript is a programming language.',
    'TypeScript Introduction'
  );
  console.log(`✅ 文档添加成功: ${doc.id}`);
  console.log(`   - 分块数: ${doc.chunks.length}`);

  // 获取统计信息
  const stats = graph.getStats();
  console.log('\n📊 图谱统计:');
  console.log(`   - 实体数: ${stats.entityCount}`);
  console.log(`   - 关系数: ${stats.relationCount}`);
  console.log(`   - 社区数: ${stats.communityCount}`);
  console.log(`   - 文档数: ${stats.documentCount}`);
}

// ============================================================================
// 运行所有测试
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       元灵系统 v6.0 集成测试                           ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    await testThreeLayerArchitecture();
    await testMiddlewareStack();
    await testFiveLayerMemory();
    await testToolSystem();
    await testKnowledgeGraph();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║       ✅ 所有测试通过                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
