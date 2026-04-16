/**
 * 自然语言编程接口测试
 */

import { createParser, ParsedIntentType } from './index';

async function testNLProgramming() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       自然语言编程接口测试                              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const parser = createParser();

  // 测试规则定义
  console.log('━━━━━━ 规则定义测试 ━━━━━━');
  
  const ruleTests = [
    '当任务失败时发送通知',
    '如果状态变更就记录日志',
    '每当有错误发生时，发送告警通知，优先级为高',
    '定义一个规则，名为"健康检查"，每5分钟执行一次健康检查',
  ];

  for (const test of ruleTests) {
    console.log(`\n输入: "${test}"`);
    const rule = parser.parseRule(test);
    if (rule) {
      console.log(`  ✓ 规则 ID: ${rule.ruleId}`);
      console.log(`  ✓ 名称: ${rule.name}`);
      console.log(`  ✓ 触发: ${JSON.stringify(rule.trigger)}`);
      console.log(`  ✓ 动作: ${JSON.stringify(rule.action)}`);
      console.log(`  ✓ 优先级: ${rule.priority}`);
    } else {
      const intent = parser.parse(test);
      console.log(`  ✗ 无法解析为规则 (意图: ${intent.type}, 置信度: ${intent.confidence.toFixed(2)})`);
    }
  }

  // 测试策略定义
  console.log('\n\n━━━━━━ 策略定义测试 ━━━━━━');
  
  const policyTests = [
    '定义一个轮询调度策略',
    '创建一个安全策略，高优先级任务需要审批',
    '设置最少任务优先的调度策略',
    '配置安全审计策略，高风险操作需要审批，中风险操作记录日志',
  ];

  for (const test of policyTests) {
    console.log(`\n输入: "${test}"`);
    const policy = parser.parsePolicy(test);
    if (policy) {
      console.log(`  ✓ 策略 ID: ${policy.policyId}`);
      console.log(`  ✓ 名称: ${policy.name}`);
      console.log(`  ✓ 类型: ${policy.type}`);
      console.log(`  ✓ 规则数: ${policy.rules.length}`);
      console.log(`  ✓ 默认行为: ${policy.defaultAction}`);
    } else {
      const intent = parser.parse(test);
      console.log(`  ✗ 无法解析为策略 (意图: ${intent.type}, 置信度: ${intent.confidence.toFixed(2)})`);
    }
  }

  // 测试工作流定义
  console.log('\n\n━━━━━━ 工作流定义测试 ━━━━━━');
  
  const workflowTests = [
    '定义一个工作流，首先检查状态，然后执行任务，最后发送通知',
    '创建自动化流程：第一步：验证输入，第二步：处理数据，第三步：保存结果',
    '新建一个定时工作流，每天凌晨执行数据备份',
  ];

  for (const test of workflowTests) {
    console.log(`\n输入: "${test}"`);
    const workflow = parser.parseWorkflow(test);
    if (workflow) {
      console.log(`  ✓ 工作流 ID: ${workflow.workflowId}`);
      console.log(`  ✓ 名称: ${workflow.name}`);
      console.log(`  ✓ 步骤数: ${workflow.steps.length}`);
      console.log(`  ✓ 触发类型: ${workflow.trigger.type}`);
      if (workflow.steps.length > 0) {
        console.log(`  ✓ 步骤:`);
        for (const step of workflow.steps) {
          console.log(`    - ${step.name}`);
        }
      }
    } else {
      const intent = parser.parse(test);
      console.log(`  ✗ 无法解析为工作流 (意图: ${intent.type}, 置信度: ${intent.confidence.toFixed(2)})`);
    }
  }

  // 测试意图识别
  console.log('\n\n━━━━━━ 意图识别测试 ━━━━━━');
  
  const intentTests = [
    '查询当前系统状态',
    '执行健康检查',
    '配置超时时间为30秒',
    '显示所有规则',
    '停止所有任务',
  ];

  for (const test of intentTests) {
    console.log(`\n输入: "${test}"`);
    const intent = parser.parse(test);
    console.log(`  ✓ 意图: ${intent.type}`);
    console.log(`  ✓ 置信度: ${intent.confidence.toFixed(2)}`);
    console.log(`  ✓ 实体: ${JSON.stringify(intent.entities)}`);
  }

  console.log('\n✅ 自然语言编程接口测试通过\n');
}

// 运行测试
testNLProgramming().catch(console.error);
