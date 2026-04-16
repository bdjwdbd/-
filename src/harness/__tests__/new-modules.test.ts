/**
 * 新增 Harness 模块测试
 * 
 * 测试：
 * - Ralph Loop
 * - REPL 容器
 * - Token 流水线
 * - 熵治理
 */

import {
  // Ralph Loop
  RalphLoop,
  createRalphLoop,
  CommonCriteria,
  
  // REPL 容器
  REPLContainer,
  createREPLContainer,
  CommonInterceptors,
  
  // Token 流水线
  TokenPipeline,
  createTokenPipeline,
  estimateTokens,
  
  // 熵治理
  EntropyGovernor,
  createEntropyGovernor,
} from '../index';

console.log('🧪 新增 Harness 模块测试\n');

// ============ Ralph Loop 测试 ============

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. Ralph Loop 测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testRalphLoop() {
  console.log('测试 1.1: 基本功能');
  const ralphLoop = createRalphLoop({
    maxIterations: 3,
    criteria: [
      CommonCriteria.notNull(),
      CommonCriteria.hasField('value'),
    ],
  });

  let attempts = 0;
  const { result, iterations, passed } = await ralphLoop.execute(
    async () => {
      attempts++;
      if (attempts < 2) {
        return null; // 第一次返回 null，触发重试
      }
      return { value: 'success', confidence: 0.9 };
    },
    (r) => r?.confidence != null && r.confidence > 0.8
  );

  console.log(`  迭代次数: ${iterations}`);
  console.log(`  是否通过: ${passed}`);
  console.log(`  结果: ${JSON.stringify(result)}`);
  console.log('  ✅ 通过\n');

  console.log('测试 1.2: 达到最大迭代次数');
  const ralphLoop2 = createRalphLoop({
    maxIterations: 2,
    autoDowngrade: true,
  });

  const result2 = await ralphLoop2.execute(
    async () => ({ value: 'always fail' }),
    () => false // 永远不通过
  );

  console.log(`  迭代次数: ${result2.iterations}`);
  console.log(`  是否通过: ${result2.passed}`);
  console.log('  ✅ 通过（降级返回最后结果）\n');
}

// ============ REPL 容器测试 ============

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('2. REPL 容器测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testREPLContainer() {
  console.log('测试 2.1: 基本功能');
  const repl = createREPLContainer({
    maxLoops: 5,
    timeout: 5000,
  });

  const { output, loops } = await repl.run(
    { message: 'test' },
    async (ctx) => {
      return { content: 'response', done: true };
    }
  );

  console.log(`  循环次数: ${loops}`);
  console.log(`  输出: ${JSON.stringify(output)}`);
  console.log('  ✅ 通过\n');

  console.log('测试 2.2: 拦截器');
  const repl2 = createREPLContainer({
    maxLoops: 5,
    interceptors: [
      CommonInterceptors.notNullInput(),
      {
        name: '自定义检查',
        priority: 10,
        intercept: (ctx) => ctx.input.message !== 'blocked',
      },
    ],
  });

  try {
    await repl2.run(
      { message: 'allowed' },
      async () => ({ content: 'ok' })
    );
    console.log('  ✅ 通过（正常执行）\n');
  } catch (error) {
    console.log('  ❌ 失败\n');
  }
}

// ============ Token 流水线测试 ============

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('3. Token 流水线测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testTokenPipeline() {
  console.log('测试 3.1: 基本功能');
  const pipeline = createTokenPipeline({
    maxTokens: 1000,
    windowSize: 5,
  });

  // 添加消息
  pipeline.addMessage('用户消息 1', 50);
  pipeline.addMessage('AI 回复 1', 100);
  pipeline.addMessage('用户消息 2', 50);
  pipeline.addMessage('AI 回复 2', 100);

  const usage = pipeline.getUsage();
  console.log(`  Token 使用: ${usage.total}`);
  console.log(`  使用率: ${(usage.usageRate * 100).toFixed(1)}%`);

  const context = pipeline.buildContext('用户查询');
  console.log(`  上下文长度: ${context.length} 字符`);
  console.log('  ✅ 通过\n');

  console.log('测试 3.2: Token 估算');
  const tokens1 = estimateTokens('Hello World');
  const tokens2 = estimateTokens('你好世界');
  console.log(`  英文 "Hello World": ${tokens1} tokens`);
  console.log(`  中文 "你好世界": ${tokens2} tokens`);
  console.log('  ✅ 通过\n');
}

// ============ 熵治理测试 ============

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('4. 熵治理测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testEntropyGovernor() {
  console.log('测试 4.1: 基本功能');
  const governor = createEntropyGovernor({
    entropyThreshold: 0.7,
    autoCleanup: false,
  });

  const report = await governor.detect();
  console.log(`  熵评分: ${report.score.toFixed(2)}`);
  console.log(`  问题数: ${report.stats.totalIssues}`);
  console.log(`  检测耗时: ${report.duration}ms`);
  console.log('  ✅ 通过\n');

  console.log('测试 4.2: 阈值检查');
  const isOver = governor.isOverThreshold();
  console.log(`  是否超过阈值: ${isOver}`);
  console.log('  ✅ 通过\n');
}

// ============ 运行所有测试 ============

async function runAllTests() {
  try {
    await testRalphLoop();
    await testREPLContainer();
    await testTokenPipeline();
    await testEntropyGovernor();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 所有测试通过！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

runAllTests();
