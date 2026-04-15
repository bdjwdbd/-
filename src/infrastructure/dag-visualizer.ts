/**
 * DAG 可视化工具
 * 
 * 功能：
 * 1. 解析任务依赖关系
 * 2. 生成 Mermaid 图表
 * 3. 支持执行状态可视化
 * 4. 输出 HTML 报告
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

interface TaskNode {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "blocked";
  dependencies: string[];
  estimatedDuration?: number;
  actualDuration?: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

interface DAGGraph {
  nodes: TaskNode[];
  edges: Array<{ from: string; to: string }>;
}

interface ExecutionPlan {
  id: string;
  name: string;
  tasks: TaskNode[];
  createdAt: number;
  status: "planning" | "executing" | "completed" | "failed";
}

// ============================================================
// DAG 解析器
// ============================================================

export class DAGParser {
  /**
   * 从任务列表解析 DAG
   */
  static parse(tasks: TaskNode[]): DAGGraph {
    const edges: Array<{ from: string; to: string }> = [];
    
    for (const task of tasks) {
      for (const dep of task.dependencies) {
        edges.push({ from: dep, to: task.id });
      }
    }
    
    return { nodes: tasks, edges };
  }
  
  /**
   * 检测循环依赖
   */
  static detectCycles(graph: DAGGraph): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycle: string[] = [];
    
    function dfs(nodeId: string): boolean {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const node = graph.nodes.find(n => n.id === nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            if (dfs(depId)) {
              cycle.push(nodeId);
              return true;
            }
          } else if (recursionStack.has(depId)) {
            cycle.push(nodeId);
            return true;
          }
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    }
    
    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) {
          return cycle.reverse();
        }
      }
    }
    
    return null;
  }
  
  /**
   * 拓扑排序
   */
  static topologicalSort(graph: DAGGraph): string[] {
    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];
    
    // 初始化入度
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
    }
    
    // 计算入度
    for (const edge of graph.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
    
    // 入度为 0 的节点入队
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    // BFS
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);
      
      // 减少依赖节点的入度
      for (const edge of graph.edges) {
        if (edge.from === nodeId) {
          const newDegree = (inDegree.get(edge.to) || 0) - 1;
          inDegree.set(edge.to, newDegree);
          if (newDegree === 0) {
            queue.push(edge.to);
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * 获取可并行执行的任务层级
   */
  static getParallelLevels(graph: DAGGraph): string[][] {
    const levels: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(graph.nodes.map(n => n.id));
    
    while (remaining.size > 0) {
      const level: string[] = [];
      
      for (const nodeId of remaining) {
        const node = graph.nodes.find(n => n.id === nodeId);
        if (node && node.dependencies.every(dep => completed.has(dep))) {
          level.push(nodeId);
        }
      }
      
      if (level.length === 0) {
        // 存在循环依赖
        break;
      }
      
      levels.push(level);
      level.forEach(id => {
        completed.add(id);
        remaining.delete(id);
      });
    }
    
    return levels;
  }
}

// ============================================================
// Mermaid 生成器
// ============================================================

export class MermaidGenerator {
  /**
   * 生成 Mermaid 流程图
   */
  static generateFlowchart(graph: DAGGraph, title?: string): string {
    const lines: string[] = [];
    
    lines.push("```mermaid");
    lines.push("flowchart TD");
    
    if (title) {
      lines.push(`    %% ${title}`);
    }
    
    // 定义节点样式
    lines.push("    %% 节点样式");
    lines.push("    classDef pending fill:#f9f,stroke:#333,stroke-width:1px");
    lines.push("    classDef running fill:#ff9,stroke:#333,stroke-width:2px");
    lines.push("    classDef completed fill:#9f9,stroke:#333,stroke-width:1px");
    lines.push("    classDef failed fill:#f99,stroke:#333,stroke-width:2px");
    lines.push("    classDef blocked fill:#ccc,stroke:#333,stroke-width:1px");
    lines.push("");
    
    // 添加节点
    for (const node of graph.nodes) {
      const label = node.name || node.id;
      const statusClass = node.status;
      lines.push(`    ${node.id}["${label}"]:::${statusClass}`);
    }
    
    lines.push("");
    
    // 添加边
    for (const edge of graph.edges) {
      lines.push(`    ${edge.from} --> ${edge.to}`);
    }
    
    lines.push("```");
    
    return lines.join("\n");
  }
  
  /**
   * 生成带执行状态的流程图
   */
  static generateExecutionFlowchart(graph: DAGGraph): string {
    const lines: string[] = [];
    
    lines.push("```mermaid");
    lines.push("flowchart TD");
    lines.push("    %% 执行状态图");
    lines.push("");
    
    // 添加节点（带状态信息）
    for (const node of graph.nodes) {
      const label = this.getNodeLabel(node);
      const statusClass = node.status;
      lines.push(`    ${node.id}["${label}"]:::${statusClass}`);
    }
    
    lines.push("");
    
    // 添加边
    for (const edge of graph.edges) {
      const fromNode = graph.nodes.find(n => n.id === edge.from);
      const toNode = graph.nodes.find(n => n.id === edge.to);
      
      // 根据状态决定边的样式
      if (fromNode?.status === "completed" && toNode?.status !== "pending") {
        lines.push(`    ${edge.from} ==> ${edge.to}`);
      } else {
        lines.push(`    ${edge.from} --> ${edge.to}`);
      }
    }
    
    lines.push("");
    lines.push("    %% 样式定义");
    lines.push("    classDef pending fill:#f9f,stroke:#333");
    lines.push("    classDef running fill:#ff9,stroke:#f00,stroke-width:3px,stroke-dasharray: 5 5");
    lines.push("    classDef completed fill:#9f9,stroke:#333");
    lines.push("    classDef failed fill:#f99,stroke:#f00,stroke-width:2px");
    lines.push("    classDef blocked fill:#ccc,stroke:#333");
    lines.push("```");
    
    return lines.join("\n");
  }
  
  /**
   * 生成甘特图
   */
  static generateGantt(graph: DAGGraph, startTime: number = Date.now()): string {
    const lines: string[] = [];
    
    lines.push("```mermaid");
    lines.push("gantt");
    lines.push("    title 任务执行时间线");
    lines.push("    dateFormat  HH:mm:ss");
    lines.push("    axisFormat  %H:%M:%S");
    lines.push("");
    
    let currentTime = new Date(startTime);
    
    for (const node of graph.nodes) {
      const duration = node.estimatedDuration || node.actualDuration || 1000;
      const start = currentTime.toISOString().substr(11, 8);
      currentTime = new Date(currentTime.getTime() + duration);
      const end = currentTime.toISOString().substr(11, 8);
      
      const status = node.status === "completed" ? "done" : 
                     node.status === "running" ? "active" : 
                     node.status === "failed" ? "crit" : "";
      
      lines.push(`    ${status} ${node.name || node.id} :${node.id}, ${start}, ${duration}ms`);
    }
    
    lines.push("```");
    
    return lines.join("\n");
  }
  
  private static getNodeLabel(node: TaskNode): string {
    const parts = [node.name || node.id];
    
    if (node.status === "completed" && node.actualDuration) {
      parts.push(`(${node.actualDuration}ms)`);
    } else if (node.estimatedDuration) {
      parts.push(`(~${node.estimatedDuration}ms)`);
    }
    
    if (node.status === "failed" && node.error) {
      parts.push(`❌ ${node.error.substring(0, 20)}`);
    }
    
    return parts.join(" ");
  }
}

// ============================================================
// HTML 报告生成器
// ============================================================

export class HTMLReportGenerator {
  /**
   * 生成完整的 HTML 报告
   */
  static generate(graph: DAGGraph, plan?: ExecutionPlan): string {
    const mermaidFlowchart = MermaidGenerator.generateExecutionFlowchart(graph);
    const parallelLevels = DAGParser.getParallelLevels(graph);
    const cycles = DAGParser.detectCycles(graph);
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DAG 可视化报告</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 20px; }
    h2 { color: #666; margin: 20px 0 10px; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .stat { text-align: center; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .stat-value { font-size: 2em; font-weight: bold; color: #333; }
    .stat-label { color: #666; font-size: 0.9em; }
    .mermaid { background: white; padding: 20px; border-radius: 8px; }
    .levels { display: flex; flex-direction: column; gap: 10px; }
    .level { display: flex; align-items: center; gap: 10px; }
    .level-num { 
      background: #333; color: white; 
      width: 30px; height: 30px; 
      border-radius: 50%; 
      display: flex; align-items: center; justify-content: center;
      font-weight: bold;
    }
    .level-tasks { display: flex; gap: 10px; flex-wrap: wrap; }
    .task-badge {
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 0.9em;
    }
    .task-badge.pending { background: #f9f; }
    .task-badge.running { background: #ff9; }
    .task-badge.completed { background: #9f9; }
    .task-badge.failed { background: #f99; }
    .task-badge.blocked { background: #ccc; }
    .cycle-warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .cycle-warning h3 { color: #856404; margin-bottom: 10px; }
    .cycle-path { font-family: monospace; background: #fff; padding: 10px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:hover { background: #f9f9f9; }
    .status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 500;
    }
    .status-badge.pending { background: #f9f; color: #333; }
    .status-badge.running { background: #ff9; color: #333; }
    .status-badge.completed { background: #9f9; color: #333; }
    .status-badge.failed { background: #f99; color: #333; }
    .status-badge.blocked { background: #ccc; color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 DAG 可视化报告</h1>
    
    ${cycles ? `
    <div class="cycle-warning">
      <h3>⚠️ 检测到循环依赖</h3>
      <div class="cycle-path">${cycles.join(' → ')}</div>
    </div>
    ` : ''}
    
    <div class="card">
      <h2>统计概览</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${graph.nodes.length}</div>
          <div class="stat-label">总任务数</div>
        </div>
        <div class="stat">
          <div class="stat-value">${graph.edges.length}</div>
          <div class="stat-label">依赖关系</div>
        </div>
        <div class="stat">
          <div class="stat-value">${parallelLevels.length}</div>
          <div class="stat-label">执行层级</div>
        </div>
        <div class="stat">
          <div class="stat-value">${graph.nodes.filter(n => n.status === 'completed').length}</div>
          <div class="stat-label">已完成</div>
        </div>
        <div class="stat">
          <div class="stat-value">${graph.nodes.filter(n => n.status === 'running').length}</div>
          <div class="stat-label">执行中</div>
        </div>
        <div class="stat">
          <div class="stat-value">${graph.nodes.filter(n => n.status === 'failed').length}</div>
          <div class="stat-label">失败</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>执行流程图</h2>
      <div class="mermaid">
${mermaidFlowchart}
      </div>
    </div>
    
    <div class="card">
      <h2>并行执行层级</h2>
      <div class="levels">
        ${parallelLevels.map((level, i) => `
        <div class="level">
          <div class="level-num">${i + 1}</div>
          <div class="level-tasks">
            ${level.map(taskId => {
              const node = graph.nodes.find(n => n.id === taskId);
              return `<span class="task-badge ${node?.status || 'pending'}">${node?.name || taskId}</span>`;
            }).join('')}
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    
    <div class="card">
      <h2>任务详情</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>状态</th>
            <th>依赖</th>
            <th>预估时间</th>
            <th>实际时间</th>
          </tr>
        </thead>
        <tbody>
          ${graph.nodes.map(node => `
          <tr>
            <td><code>${node.id}</code></td>
            <td>${node.name}</td>
            <td><span class="status-badge ${node.status}">${node.status}</span></td>
            <td>${node.dependencies.length > 0 ? node.dependencies.join(', ') : '-'}</td>
            <td>${node.estimatedDuration ? node.estimatedDuration + 'ms' : '-'}</td>
            <td>${node.actualDuration ? node.actualDuration + 'ms' : '-'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</body>
</html>`;
  }
  
  /**
   * 保存报告到文件
   */
  static saveToFile(html: string, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, html);
  }
}

// ============================================================
// 示例和测试
// ============================================================

function demo() {
  console.log("=".repeat(60));
  console.log("DAG 可视化工具演示");
  console.log("=".repeat(60));
  
  // 创建示例任务
  const tasks: TaskNode[] = [
    { id: "task1", name: "读取配置", status: "completed", dependencies: [], actualDuration: 150 },
    { id: "task2", name: "验证输入", status: "completed", dependencies: ["task1"], actualDuration: 80 },
    { id: "task3", name: "初始化数据库", status: "running", dependencies: ["task1"], estimatedDuration: 500 },
    { id: "task4", name: "加载模型", status: "pending", dependencies: ["task2"], estimatedDuration: 2000 },
    { id: "task5", name: "预处理数据", status: "pending", dependencies: ["task2", "task3"], estimatedDuration: 800 },
    { id: "task6", name: "执行推理", status: "pending", dependencies: ["task4", "task5"], estimatedDuration: 1500 },
    { id: "task7", name: "后处理结果", status: "pending", dependencies: ["task6"], estimatedDuration: 200 },
    { id: "task8", name: "保存输出", status: "pending", dependencies: ["task7"], estimatedDuration: 100 },
  ];
  
  // 解析 DAG
  const graph = DAGParser.parse(tasks);
  
  // 检测循环
  const cycles = DAGParser.detectCycles(graph);
  console.log("\n循环检测:", cycles ? `发现循环: ${cycles.join(' → ')}` : "无循环依赖");
  
  // 拓扑排序
  const sorted = DAGParser.topologicalSort(graph);
  console.log("\n拓扑排序:", sorted.join(' → '));
  
  // 并行层级
  const levels = DAGParser.getParallelLevels(graph);
  console.log("\n并行执行层级:");
  levels.forEach((level, i) => {
    console.log(`  Level ${i + 1}: ${level.join(', ')}`);
  });
  
  // 生成 Mermaid 图
  console.log("\n" + MermaidGenerator.generateFlowchart(graph, "任务执行流程"));
  
  // 生成 HTML 报告
  const html = HTMLReportGenerator.generate(graph);
  const outputPath = "./experiment-results/dag-report.html";
  HTMLReportGenerator.saveToFile(html, outputPath);
  console.log(`\nHTML 报告已保存: ${outputPath}`);
  
  console.log("\n" + "=".repeat(60));
}

// 运行演示
if (require.main === module) {
  demo();
}
