#!/usr/bin/env node
/**
 * 元灵系统 v6.0 命令行入口
 * 
 * 用法：
 *   npx ts-node src/cli-v6.ts "你的问题"
 *   npx ts-node src/cli-v6.ts --interactive
 *   npx ts-node src/cli-v6.ts --server
 */

import YuanLingRuntime, { quickStart, defaultConfig } from './runtime';

// 解析命令行参数
const args = process.argv.slice(2);

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║              元灵系统 v6.0 - 独立运行模式                     ║');
  console.log('║                                                               ║');
  console.log('║  架构: 元灵系统（主系统）                                     ║');
  console.log('║                                                               ║');
  console.log('║  七层架构:                                                    ║');
  console.log('║    L0 灵思层 - 强制思考协议                                   ║');
  console.log('║    L1 灵枢层 - 查询分析、策略选择                             ║');
  console.log('║    L2 灵脉层 - 14 层 Middleware                               ║');
  console.log('║    L3 灵躯层 - 42 个工具                                      ║');
  console.log('║    L4 灵盾层 - fail-closed 安全                              ║');
  console.log('║    L5 灵韵层 - 记忆晋升、学习进化                             ║');
  console.log('║    L6 灵识层 - 五层记忆加载                                   ║');
  console.log('║    L7 沙箱层 - 四级隔离                                       ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // 检查参数
  if (args.length === 0) {
    console.log('用法:');
    console.log('  npx ts-node src/cli-v6.ts "你的问题"     # 单次问答');
    console.log('  npx ts-node src/cli-v6.ts --interactive  # 交互模式');
    console.log('  npx ts-node src/cli-v6.ts --server       # 启动服务');
    console.log('');
    return;
  }

  // 单次问答模式
  if (args[0] !== '--interactive' && args[0] !== '--server') {
    const message = args.join(' ');
    await quickStart(message);
    return;
  }

  // 交互模式
  if (args[0] === '--interactive') {
    console.log('启动交互模式（输入 exit 退出）');
    console.log('');

    const runtime = new YuanLingRuntime(defaultConfig);
    
    // 简单的交互循环
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const ask = () => {
      rl.question('元灵> ', async (input: string) => {
        if (input.trim().toLowerCase() === 'exit') {
          await runtime.shutdown();
          rl.close();
          return;
        }

        if (input.trim()) {
          await runtime.process(input);
        }

        ask();
      });
    };

    ask();
    return;
  }

  // 服务模式
  if (args[0] === '--server') {
    console.log('启动服务模式...');
    console.log('');
    
    const runtime = new YuanLingRuntime({
      ...defaultConfig,
      server: {
        port: 3000,
        host: 'localhost'
      }
    });

    await runtime.startServer();
    
    console.log('服务已启动，按 Ctrl+C 停止');
    console.log('');
  }
}

main().catch(console.error);
