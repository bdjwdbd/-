/**
 * Dashboard 测试脚本
 * 
 * 启动 Dashboard 服务器并测试
 */

import { HarnessSystem } from '../../harness';
import { createDashboard } from './server';

async function main() {
  console.log('🚀 启动 Harness Dashboard...\n');

  // 创建 Harness 系统
  const harness = new HarnessSystem({
    workspaceRoot: '/tmp/harness-dashboard-test',
    enableStateManager: true,
    enableTracing: true,
  });

  await harness.initialize();
  console.log('✅ Harness 系统已初始化');

  // 创建 Dashboard
  const dashboard = await createDashboard(harness, { port: 3000 });
  console.log('✅ Dashboard 已启动');

  // 模拟一些操作
  console.log('\n📊 模拟操作...');
  
  for (let i = 0; i < 5; i++) {
    // 创建追踪
    const trace = harness.startTrace(`operation_${i}`);
    
    // 设置状态
    await harness.setState(`key_${i}`, { value: i });
    
    // 结束追踪
    if (trace) {
      harness.endTrace(trace.traceId, 'completed' as any);
    }
  }

  console.log('✅ 模拟操作完成');
  console.log('\n🌐 请访问: http://localhost:3000');
  console.log('按 Ctrl+C 停止服务器\n');

  // 保持运行
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 正在停止...');
    await dashboard.stop();
    await harness.close();
    process.exit(0);
  });
}

main().catch(console.error);
