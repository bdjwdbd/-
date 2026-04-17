/**
 * 测试真实工具执行
 */

import YuanLingSystem from './index';
import { executeTool } from './tools/real-executors';

async function testTools() {
  console.log('='.repeat(60));
  console.log('  测试真实工具执行');
  console.log('='.repeat(60));
  console.log('');

  // 测试 1: 列出目录
  console.log('测试 1: 列出目录');
  const listResult = await executeTool('list', { path: '.' });
  console.log('结果:', listResult.success ? '✅ 成功' : '❌ 失败');
  console.log('输出:', listResult.output?.substring(0, 200));
  console.log('');

  // 测试 2: 读取文件
  console.log('测试 2: 读取文件');
  const readResult = await executeTool('read', { 
    path: './package.json',
    limit: 10
  });
  console.log('结果:', readResult.success ? '✅ 成功' : '❌ 失败');
  console.log('输出:', readResult.output?.substring(0, 200));
  console.log('');

  // 测试 3: 执行命令
  console.log('测试 3: 执行命令');
  const bashResult = await executeTool('bash', { 
    command: 'echo "Hello from YuanLing System!" && date'
  });
  console.log('结果:', bashResult.success ? '✅ 成功' : '❌ 失败');
  console.log('输出:', bashResult.output);
  console.log('');

  // 测试 4: Git 状态
  console.log('测试 4: Git 状态');
  const gitResult = await executeTool('git_status', {});
  console.log('结果:', gitResult.success ? '✅ 成功' : '❌ 失败');
  console.log('输出:', gitResult.output?.substring(0, 200));
  console.log('');

  console.log('='.repeat(60));
  console.log('  测试完成');
  console.log('='.repeat(60));
}

testTools().catch(console.error);
