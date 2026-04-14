/**
 * 灵盾层测试
 */

import { LoopDetector } from './LoopDetector';
import { OutputTruncator } from './OutputTruncator';
import { ToolExecutionGuard } from './ToolExecutionGuard';

console.log('=== 灵盾层测试 ===\n');

// 测试 1: 循环检测
console.log('1. 循环检测测试');
const detector = new LoopDetector({
  interruptThreshold: 3,
  warningThreshold: 2,
  maxConsecutiveCalls: 5,
});

const args = { command: 'ls /home/sandbox/openclaw/node_modules/openclaw/dist' };

for (let i = 1; i <= 5; i++) {
  const result = detector.recordCall('exec', args, `msg-${i}`);
  console.log(`  第 ${i} 次调用: isLoop=${result.isLoop}, shouldInterrupt=${result.shouldInterrupt}`);
  if (result.reason) {
    console.log(`    原因: ${result.reason}`);
  }
}

console.log('');

// 测试 2: 输出截断
console.log('2. 输出截断测试');
const truncator = new OutputTruncator({
  maxOutputLines: 10,
  maxFileListItems: 5,
  strategy: 'smart',
});

// 模拟文件列表输出
const fileList = Array.from({ length: 100 }, (_, i) => `file-${i}.js`).join('\n');
const result1 = truncator.process(fileList);
console.log(`  文件列表: ${fileList.split('\n').length} 行 → ${result1.content.split('\n').length} 行`);
console.log(`  截断类型: ${result1.truncationType}`);
console.log(`  截断提示: ${result1.wasTruncated ? '是' : '否'}`);

// 模拟长文本输出
const longText = '这是一行文本\n'.repeat(100);
const result2 = truncator.process(longText);
console.log(`  长文本: ${longText.split('\n').length} 行 → ${result2.content.split('\n').length} 行`);

console.log('');

// 测试 3: 完整守卫
console.log('3. 完整守卫测试');
const guard = new ToolExecutionGuard({
  enableLoopDetection: true,
  enableOutputTruncation: true,
  loopDetector: {
    maxHistorySize: 100,
    interruptThreshold: 2,
    warningThreshold: 1,
    timeWindowMs: 60000,
    maxConsecutiveCalls: 5,
  },
  outputTruncator: {
    maxOutputChars: 50000,
    maxOutputLines: 500,
    maxFileListItems: 10,
    strategy: 'smart',
  },
});

// 模拟执行
const context = {
  toolName: 'exec',
  args: { command: 'ls' },
  messageId: 'test-msg',
  sessionId: 'test-session',
};

// 第一次调用
const check1 = guard.preCheck(context);
console.log(`  第 1 次调用: allowed=${check1.allowed}`);

// 第二次调用（相同参数）
const check2 = guard.preCheck(context);
console.log(`  第 2 次调用: allowed=${check2.allowed}`);

// 第三次调用（应该被中断）
const check3 = guard.preCheck(context);
console.log(`  第 3 次调用: allowed=${check3.allowed}, reason=${check3.reason || '无'}`);

// 测试输出处理
const processResult = guard.postProcess(context, fileList);
console.log(`  输出处理: wasGuarded=${processResult.wasGuarded}`);

console.log('');

// 测试 4: 统计信息
console.log('4. 统计信息');
const stats = guard.getStats();
console.log(`  会话数: ${stats.sessionCount}`);
console.log(`  总调用: ${stats.totalCalls}`);
console.log(`  活跃会话: ${stats.activeSessions}`);

console.log('\n=== 测试完成 ===');
