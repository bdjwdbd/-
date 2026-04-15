/**
 * 上下文压缩器测试
 */

import { ContextCompressor, getContextCompressor } from '../monitoring/context-compressor';

async function runTest() {
  // console.log('=== 上下文压缩器测试 ===\n');

  const compressor = new ContextCompressor();

  // 测试 1: 基本压缩
  // console.log('测试 1: 基本压缩');
  const text1 = '这是  一段    包含多余空格的文本。这是  一段    包含多余空格的文本。';
  const result1 = compressor.compress(text1);
  // console.log(`  原始长度: ${result1.original.length}`);
  // console.log(`  压缩后长度: ${result1.compressed.length}`);
  // console.log(`  压缩比: ${(result1.ratio * 100).toFixed(1)}%`);
  // console.log('  ✅ 通过\n');

  // 测试 2: 保留关键内容
  // console.log('测试 2: 保留关键内容');
  const text2 = '这是一段普通文本。重要：这是关键信息。这是另一段普通文本。';
  const result2 = compressor.compress(text2);
  // console.log(`  保留内容: ${result2.preserved.length} 项`);
  // console.log(`  压缩后: ${result2.compressed.substring(0, 50)}...`);
  // console.log('  ✅ 通过\n');

  // 测试 3: 保留模式匹配
  // console.log('测试 3: 保留模式匹配');
  const text3 = '访问 https://example.com 查看详情。日期：2026-04-14。邮箱：test@example.com';
  const result3 = compressor.compress(text3);
  // console.log(`  保留内容: ${result3.preserved.length} 项`);
  for (const p of result3.preserved) {
    // console.log(`    - ${p}`);
  }
  // console.log('  ✅ 通过\n');

  // 测试 4: 消息摘要
  // console.log('测试 4: 消息摘要');
  const message = {
    role: 'user',
    content: '我想了解 Python。重要：我需要知道如何处理文件。另外，错误处理也很关键。还有什么需要注意的吗？',
  };
  const summary = compressor.summarizeMessage(message);
  // console.log(`  摘要: ${summary.summary}`);
  // console.log(`  关键点: ${summary.keyPoints.length} 个`);
  for (const p of summary.keyPoints) {
    // console.log(`    - ${p}`);
  }
  // console.log('  ✅ 通过\n');

  // 测试 5: 历史压缩
  // console.log('测试 5: 历史压缩');
  const history = [
    { role: 'user', content: '你好，我想了解 Python 编程语言的基础知识。' },
    { role: 'assistant', content: 'Python 是一种高级编程语言，以简洁易读著称。它支持多种编程范式...' },
    { role: 'user', content: '能详细说说文件操作吗？重要：我需要处理大文件。' },
    { role: 'assistant', content: 'Python 文件操作非常简单。使用 open() 函数可以打开文件...' },
    { role: 'user', content: '错误处理呢？关键：如何避免程序崩溃？' },
  ];
  
  const compressedHistory = compressor.compressHistory(history, 200);
  // console.log(`  原始消息数: ${history.length}`);
  // console.log(`  压缩后数量: ${compressedHistory.length}`);
  for (const msg of compressedHistory) {
    if ('summary' in msg) {
      // console.log(`    - [${msg.role}] 摘要: ${msg.summary.substring(0, 30)}...`);
    } else {
      // console.log(`    - [${msg.role}] 原文: ${msg.content.substring(0, 30)}...`);
    }
  }
  // console.log('  ✅ 通过\n');

  // 测试 6: 交接单生成
  // console.log('测试 6: 交接单生成');
  const handover = compressor.generateHandover({
    goal: '实现用户认证系统',
    completed: ['设计数据库结构', '实现登录功能'],
    pending: ['添加密码重置', '实现双因素认证'],
    findings: ['用户密码需要加密存储', 'Session 管理需要优化'],
  });
  // console.log('  交接单:');
  // console.log(handover.split('\n').slice(0, 10).join('\n'));
  // console.log('  ...');
  // console.log('  ✅ 通过\n');

  // 测试 7: 压缩效果统计
  // console.log('测试 7: 压缩效果统计');
  const longText = '这是一段很长的文本。'.repeat(100);
  const result7 = compressor.compress(longText);
  // console.log(`  原始长度: ${result7.original.length}`);
  // console.log(`  压缩后长度: ${result7.compressed.length}`);
  // console.log(`  压缩比: ${(result7.ratio * 100).toFixed(1)}%`);
  // console.log(`  节省: ${((1 - result7.ratio) * 100).toFixed(1)}%`);
  // console.log('  ✅ 通过\n');

  // 测试 8: 全局实例
  // console.log('测试 8: 全局实例');
  const globalComp = getContextCompressor();
  // console.log(`  全局实例: ${globalComp ? '✅' : '❌'}`);
  // console.log('  ✅ 通过\n');

  // console.log('=== 所有测试通过 ===');
}

runTest().catch(console.error);
