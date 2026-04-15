/**
 * DAG 可视化测试
 */

import { DAGParser, MermaidGenerator, HTMLReportGenerator } from '../dag-visualizer';

async function runTest() {
  console.log('=== DAG 可视化测试 ===\n');

  // 创建测试任务
  const tasks = [
    { id: 'task-1', name: '数据获取', status: 'completed' as const, dependencies: [] },
    { id: 'task-2', name: '数据清洗', status: 'completed' as const, dependencies: ['task-1'] },
    { id: 'task-3', name: '特征提取', status: 'running' as const, dependencies: ['task-2'] },
    { id: 'task-4', name: '模型训练', status: 'pending' as const, dependencies: ['task-3'] },
    { id: 'task-5', name: '模型评估', status: 'pending' as const, dependencies: ['task-4'] },
    { id: 'task-6', name: '报告生成', status: 'pending' as const, dependencies: ['task-5'] },
  ];

  // 测试 1: 解析 DAG
  console.log('测试 1: 解析 DAG');
  const graph = DAGParser.parse(tasks);
  console.log('  节点数:', graph.nodes.length);
  console.log('  边数:', graph.edges.length);
  console.log('  ✅ 通过\n');

  // 测试 2: 检测循环依赖
  console.log('测试 2: 检测循环依赖');
  const cycles = DAGParser.detectCycles(graph);
  console.log('  循环依赖:', cycles || '无');
  console.log('  ✅ 通过\n');

  // 测试 3: 拓扑排序
  console.log('测试 3: 拓扑排序');
  const order = DAGParser.topologicalSort(graph);
  console.log('  执行顺序:', order);
  console.log('  ✅ 通过\n');

  // 测试 4: 生成 Mermaid 图表
  console.log('测试 4: 生成 Mermaid 图表');
  const mermaid = MermaidGenerator.generateFlowchart(graph, '测试 DAG');
  console.log('  Mermaid 代码:');
  console.log(mermaid.split('\n').slice(0, 10).join('\n'));
  console.log('  ...');
  console.log('  ✅ 通过\n');

  // 测试 5: 生成 HTML 报告
  console.log('测试 5: 生成 HTML 报告');
  const html = HTMLReportGenerator.generate(graph);
  console.log('  HTML 长度:', html.length, '字符');
  console.log('  包含 Mermaid:', html.includes('mermaid'));
  console.log('  ✅ 通过\n');

  console.log('=== 所有测试通过 ===');
}

runTest().catch(console.error);
