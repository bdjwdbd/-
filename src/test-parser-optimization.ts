/**
 * 自然语言解析器优化测试
 */

import { createParser, ParsedIntentType } from './nl-programming';

function testParserOptimization() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       自然语言解析器优化测试                            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const parser = createParser();

  // 测试用例
  const testCases = [
    { text: '当任务失败时发送通知', expected: ParsedIntentType.DEFINE_RULE },
    { text: '如果状态变更就记录日志', expected: ParsedIntentType.DEFINE_RULE },
    { text: '每当有错误发生时，发送告警通知，优先级为高', expected: ParsedIntentType.DEFINE_RULE },
    { text: '定义一个规则，名为"健康检查"，每5分钟执行一次健康检查', expected: ParsedIntentType.DEFINE_RULE },
    { text: '定义一个轮询调度策略', expected: ParsedIntentType.DEFINE_POLICY },
    { text: '创建一个安全审计策略', expected: ParsedIntentType.DEFINE_POLICY },
    { text: '当系统出现错误时发送告警', expected: ParsedIntentType.DEFINE_RULE },
    { text: '如果任务执行失败就通知管理员', expected: ParsedIntentType.DEFINE_RULE },
    { text: '每当状态发生变化时记录日志', expected: ParsedIntentType.DEFINE_RULE },
    { text: '当检测到异常时发送警告', expected: ParsedIntentType.DEFINE_RULE },
  ];

  console.log('━━━━━━ 意图识别测试 ━━━━━━\n');

  let passed = 0;
  let failed = 0;

  for (const { text, expected } of testCases) {
    const intent = parser.parse(text);
    const success = intent.type === expected;
    
    if (success) {
      passed++;
      console.log(`✅ "${text}"`);
      console.log(`   意图: ${intent.type}, 置信度: ${intent.confidence.toFixed(2)}`);
    } else {
      failed++;
      console.log(`❌ "${text}"`);
      console.log(`   期望: ${expected}, 实际: ${intent.type}, 置信度: ${intent.confidence.toFixed(2)}`);
    }
  }

  console.log('\n━━━━━━ 规则解析测试 ━━━━━━\n');

  const ruleTests = [
    '当任务失败时发送通知',
    '如果状态变更就记录日志',
    '每当有错误发生时，发送告警通知，优先级为高',
    '当系统出现错误时发送告警',
  ];

  for (const text of ruleTests) {
    const rule = parser.parseRule(text);
    if (rule) {
      console.log(`✅ "${text}"`);
      console.log(`   规则ID: ${rule.ruleId.slice(0, 20)}...`);
      console.log(`   触发: ${JSON.stringify(rule.trigger)}`);
      console.log(`   动作: ${JSON.stringify(rule.action)}`);
      console.log(`   优先级: ${rule.priority}`);
    } else {
      console.log(`❌ "${text}" - 无法解析为规则`);
    }
  }

  console.log('\n━━━━━━ 策略解析测试 ━━━━━━\n');

  const policyTests = [
    '定义一个轮询调度策略',
    '创建一个安全审计策略',
    '定义一个最少任务优先策略',
  ];

  for (const text of policyTests) {
    const policy = parser.parsePolicy(text);
    if (policy) {
      console.log(`✅ "${text}"`);
      console.log(`   策略ID: ${policy.policyId.slice(0, 20)}...`);
      console.log(`   类型: ${policy.type}`);
      console.log(`   规则数: ${policy.rules.length}`);
    } else {
      console.log(`❌ "${text}" - 无法解析为策略`);
    }
  }

  // 统计
  console.log('\n━━━━━━ 测试统计 ━━━━━━\n');
  console.log(`  意图识别: ${passed}/${testCases.length} 通过`);
  console.log(`  成功率: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n✅ 自然语言解析器优化测试通过\n');
  } else {
    console.log(`\n⚠️ 有 ${failed} 个测试失败\n`);
  }
}

// 运行测试
testParserOptimization();
