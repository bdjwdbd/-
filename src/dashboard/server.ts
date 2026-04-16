/**
 * Harness Dashboard - 可视化监控面板
 * 
 * 功能：
 * - 实时追踪可视化
 * - 性能指标仪表盘
 * - 沙盒状态监控
 * - 告警与通知
 * 
 * @module dashboard/server
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  HarnessSystem,
  StateCategory,
  SpanStatus,
  Layer,
} from '../harness';

// ============ 类型定义 ============

interface DashboardConfig {
  /** 端口 */
  port: number;
  
  /** 工作目录 */
  workspaceRoot: string;
  
  /** Harness 系统 */
  harness: HarnessSystem;
  
  /** 刷新间隔（毫秒） */
  refreshInterval: number;
}

export interface DashboardStats {
  /** 追踪统计 */
  traces: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  
  /** 状态统计 */
  states: {
    total: number;
    byCategory: Record<string, number>;
    checkpoints: number;
  };
  
  /** 沙盒统计 */
  sandboxes: {
    total: number;
    active: number;
    byLevel: Record<string, number>;
  };
  
  /** 度量统计 */
  metrics: {
    score: number;
    byCategory: Record<string, number>;
    suggestions: number;
  };
  
  /** 系统信息 */
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

interface TraceVisualization {
  traceId: string;
  name: string;
  status: string;
  startTime: number;
  duration: number;
  spans: SpanVisualization[];
}

interface SpanVisualization {
  spanId: string;
  name: string;
  layer: string;
  status: string;
  startTime: number;
  duration: number;
  children: SpanVisualization[];
}

// ============ Dashboard 服务器 ============

/**
 * Dashboard 服务器
 * 
 * 提供 HTTP API 和 WebSocket 实时推送
 */
export class DashboardServer {
  private config: DashboardConfig;
  private server: http.Server | null = null;
  private clients: Set<http.ServerResponse> = new Set();
  private startTime: number = Date.now();
  private refreshTimer?: NodeJS.Timeout;

  constructor(config: Partial<DashboardConfig> & { harness: HarnessSystem }) {
    this.config = {
      port: 3000,
      workspaceRoot: '/tmp/harness-dashboard',
      refreshInterval: 1000,
      ...config,
    };
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', reject);

      this.server.listen(this.config.port, () => {
        console.log(`📊 Dashboard 已启动: http://localhost:${this.config.port}`);
        this.startRefreshTimer();
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('📊 Dashboard 已停止');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // ============ 请求处理 ============

  /**
   * 处理 HTTP 请求
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';

    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 路由
    if (url === '/' || url === '/index.html') {
      this.serveDashboard(res);
    } else if (url === '/api/stats') {
      this.serveStats(res);
    } else if (url === '/api/traces') {
      this.serveTraces(res);
    } else if (url === '/api/sandboxes') {
      this.serveSandboxes(res);
    } else if (url === '/api/metrics') {
      this.serveMetrics(res);
    } else if (url.startsWith('/api/trace/')) {
      const traceId = url.split('/')[3];
      this.serveTraceDetail(res, traceId);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  /**
   * 提供 Dashboard 页面
   */
  private serveDashboard(res: http.ServerResponse): void {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  /**
   * 提供统计数据
   */
  private serveStats(res: http.ServerResponse): void {
    const stats = this.collectStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats, null, 2));
  }

  /**
   * 提供追踪列表
   */
  private serveTraces(res: http.ServerResponse): void {
    // 简化：返回模拟数据
    const traces: TraceVisualization[] = [
      {
        traceId: 'trace_001',
        name: 'process_message',
        status: 'completed',
        startTime: Date.now() - 5000,
        duration: 150,
        spans: [
          {
            spanId: 'span_001',
            name: 'L6_perception',
            layer: 'L6',
            status: 'completed',
            startTime: Date.now() - 5000,
            duration: 20,
            children: [],
          },
          {
            spanId: 'span_002',
            name: 'L0_thinking',
            layer: 'L0',
            status: 'completed',
            startTime: Date.now() - 4980,
            duration: 50,
            children: [],
          },
        ],
      },
    ];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(traces, null, 2));
  }

  /**
   * 提供沙盒列表
   */
  private serveSandboxes(res: http.ServerResponse): void {
    const sandboxes = [
      {
        sandboxId: 'sandbox_001',
        name: 'process_sandbox',
        level: 'L1',
        status: 'active',
        createdAt: Date.now() - 10000,
        executions: 5,
      },
    ];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sandboxes, null, 2));
  }

  /**
   * 提供度量数据
   */
  private serveMetrics(res: http.ServerResponse): void {
    const metrics = {
      score: 75.5,
      byCategory: {
        efficiency: 80,
        quality: 72,
        resource: 85,
        security: 65,
      },
      suggestions: [
        {
          priority: 'high',
          target: 'security',
          description: '安全评分偏低，建议加强权限控制',
        },
      ],
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics, null, 2));
  }

  /**
   * 提供追踪详情
   */
  private serveTraceDetail(res: http.ServerResponse, traceId: string): void {
    const trace: TraceVisualization = {
      traceId,
      name: 'process_message',
      status: 'completed',
      startTime: Date.now() - 5000,
      duration: 150,
      spans: [
        {
          spanId: 'span_001',
          name: 'L6_perception',
          layer: 'L6',
          status: 'completed',
          startTime: Date.now() - 5000,
          duration: 20,
          children: [],
        },
        {
          spanId: 'span_002',
          name: 'L0_thinking',
          layer: 'L0',
          status: 'completed',
          startTime: Date.now() - 4980,
          duration: 50,
          children: [],
        },
        {
          spanId: 'span_003',
          name: 'L1_decision',
          layer: 'L1',
          status: 'completed',
          startTime: Date.now() - 4930,
          duration: 30,
          children: [],
        },
        {
          spanId: 'span_004',
          name: 'L2_execution',
          layer: 'L2',
          status: 'completed',
          startTime: Date.now() - 4900,
          duration: 40,
          children: [],
        },
      ],
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(trace, null, 2));
  }

  // ============ 数据收集 ============

  /**
   * 收集统计数据
   */
  private collectStats(): DashboardStats {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      traces: {
        total: 100,
        active: 5,
        completed: 90,
        failed: 5,
        avgDuration: 120,
      },
      states: {
        total: 50,
        byCategory: {
          session: 20,
          task: 15,
          user: 5,
          memory: 10,
        },
        checkpoints: 3,
      },
      sandboxes: {
        total: 10,
        active: 2,
        byLevel: {
          L1: 5,
          L2: 3,
          L3: 1,
          L4: 1,
        },
      },
      metrics: {
        score: 75.5,
        byCategory: {
          efficiency: 80,
          quality: 72,
          resource: 85,
          security: 65,
        },
        suggestions: 3,
      },
      system: {
        uptime: Date.now() - this.startTime,
        memoryUsage,
        cpuUsage,
      },
    };
  }

  // ============ 实时刷新 ============

  /**
   * 启动刷新定时器
   */
  private startRefreshTimer(): void {
    this.refreshTimer = setInterval(() => {
      this.broadcastUpdate();
    }, this.config.refreshInterval);
  }

  /**
   * 广播更新
   */
  private broadcastUpdate(): void {
    const stats = this.collectStats();
    const data = JSON.stringify({ type: 'stats', data: stats });

    for (const client of this.clients) {
      try {
        client.write(`data: ${data}\n\n`);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  // ============ HTML 生成 ============

  /**
   * 生成 Dashboard HTML
   */
  private generateDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Harness Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #334155;
    }
    h1 { font-size: 24px; color: #f8fafc; }
    .status { display: flex; align-items: center; gap: 10px; }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .card {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #334155;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .card-title { font-size: 14px; color: #94a3b8; text-transform: uppercase; }
    .card-value { font-size: 32px; font-weight: bold; color: #f8fafc; }
    
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    .metric-item {
      text-align: center;
      padding: 10px;
      background: #0f172a;
      border-radius: 8px;
    }
    .metric-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
    .metric-value { font-size: 20px; font-weight: bold; }
    
    .progress-bar {
      height: 8px;
      background: #334155;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    
    .trace-list { max-height: 400px; overflow-y: auto; }
    .trace-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #0f172a;
      border-radius: 8px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .trace-item:hover { background: #1e293b; }
    .trace-name { font-weight: 500; }
    .trace-status {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .status-completed { background: #166534; color: #bbf7d0; }
    .status-running { background: #1d4ed8; color: #bfdbfe; }
    .status-failed { background: #991b1b; color: #fecaca; }
    
    .score-circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: conic-gradient(#22c55e 0deg, #22c55e calc(var(--score) * 3.6deg), #334155 calc(var(--score) * 3.6deg));
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .score-inner {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
    }
    
    .suggestion-list { margin-top: 15px; }
    .suggestion-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: #0f172a;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .suggestion-priority {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
    }
    .priority-critical { background: #dc2626; }
    .priority-high { background: #ea580c; }
    .priority-medium { background: #ca8a04; }
    .priority-low { background: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 Harness Dashboard</h1>
      <div class="status">
        <div class="status-dot"></div>
        <span>运行中</span>
      </div>
    </header>
    
    <div class="grid">
      <!-- 追踪统计 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">追踪统计</span>
          <span id="trace-total">0</span>
        </div>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">活跃</div>
            <div class="metric-value" id="trace-active" style="color: #3b82f6;">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">完成</div>
            <div class="metric-value" id="trace-completed" style="color: #22c55e;">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">失败</div>
            <div class="metric-value" id="trace-failed" style="color: #ef4444;">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">平均耗时</div>
            <div class="metric-value" id="trace-avg">0ms</div>
          </div>
        </div>
      </div>
      
      <!-- 状态统计 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">状态管理</span>
          <span id="state-total">0</span>
        </div>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">会话</div>
            <div class="metric-value" id="state-session">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">任务</div>
            <div class="metric-value" id="state-task">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">用户</div>
            <div class="metric-value" id="state-user">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">检查点</div>
            <div class="metric-value" id="state-checkpoints">0</div>
          </div>
        </div>
      </div>
      
      <!-- 沙盒统计 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">沙盒隔离</span>
          <span id="sandbox-total">0</span>
        </div>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">L1 进程级</div>
            <div class="metric-value" id="sandbox-l1">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">L2 容器级</div>
            <div class="metric-value" id="sandbox-l2">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">L3 虚拟机级</div>
            <div class="metric-value" id="sandbox-l3">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">L4 物理级</div>
            <div class="metric-value" id="sandbox-l4">0</div>
          </div>
        </div>
      </div>
      
      <!-- 综合评分 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">综合评分</span>
        </div>
        <div class="score-circle" id="score-circle" style="--score: 0">
          <div class="score-inner">
            <span id="score-value">0</span>
          </div>
        </div>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">效能</div>
            <div class="metric-value" id="score-efficiency">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">质量</div>
            <div class="metric-value" id="score-quality">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">资源</div>
            <div class="metric-value" id="score-resource">0</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">安全</div>
            <div class="metric-value" id="score-security">0</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 最近追踪 -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">最近追踪</span>
      </div>
      <div class="trace-list" id="trace-list">
        <div class="trace-item">
          <span class="trace-name">加载中...</span>
        </div>
      </div>
    </div>
    
    <!-- 优化建议 -->
    <div class="card" style="margin-top: 20px;">
      <div class="card-header">
        <span class="card-title">优化建议</span>
        <span id="suggestions-count">0</span>
      </div>
      <div class="suggestion-list" id="suggestion-list">
        <div class="suggestion-item">加载中...</div>
      </div>
    </div>
  </div>
  
  <script>
    // 获取统计数据
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        updateDashboard(stats);
      } catch (error) {
        console.error('获取统计数据失败:', error);
      }
    }
    
    // 更新 Dashboard
    function updateDashboard(stats) {
      // 追踪统计
      document.getElementById('trace-total').textContent = stats.traces.total;
      document.getElementById('trace-active').textContent = stats.traces.active;
      document.getElementById('trace-completed').textContent = stats.traces.completed;
      document.getElementById('trace-failed').textContent = stats.traces.failed;
      document.getElementById('trace-avg').textContent = stats.traces.avgDuration + 'ms';
      
      // 状态统计
      document.getElementById('state-total').textContent = stats.states.total;
      document.getElementById('state-session').textContent = stats.states.byCategory.session || 0;
      document.getElementById('state-task').textContent = stats.states.byCategory.task || 0;
      document.getElementById('state-user').textContent = stats.states.byCategory.user || 0;
      document.getElementById('state-checkpoints').textContent = stats.states.checkpoints;
      
      // 沙盒统计
      document.getElementById('sandbox-total').textContent = stats.sandboxes.total;
      document.getElementById('sandbox-l1').textContent = stats.sandboxes.byLevel.L1 || 0;
      document.getElementById('sandbox-l2').textContent = stats.sandboxes.byLevel.L2 || 0;
      document.getElementById('sandbox-l3').textContent = stats.sandboxes.byLevel.L3 || 0;
      document.getElementById('sandbox-l4').textContent = stats.sandboxes.byLevel.L4 || 0;
      
      // 综合评分
      const score = stats.metrics.score;
      document.getElementById('score-circle').style.setProperty('--score', score);
      document.getElementById('score-value').textContent = score.toFixed(1);
      document.getElementById('score-efficiency').textContent = stats.metrics.byCategory.efficiency || 0;
      document.getElementById('score-quality').textContent = stats.metrics.byCategory.quality || 0;
      document.getElementById('score-resource').textContent = stats.metrics.byCategory.resource || 0;
      document.getElementById('score-security').textContent = stats.metrics.byCategory.security || 0;
    }
    
    // 获取追踪列表
    async function fetchTraces() {
      try {
        const response = await fetch('/api/traces');
        const traces = await response.json();
        updateTraceList(traces);
      } catch (error) {
        console.error('获取追踪列表失败:', error);
      }
    }
    
    // 更新追踪列表
    function updateTraceList(traces) {
      const list = document.getElementById('trace-list');
      list.innerHTML = traces.map(trace => \`
        <div class="trace-item" onclick="showTraceDetail('\${trace.traceId}')">
          <span class="trace-name">\${trace.name}</span>
          <span class="trace-status status-\${trace.status}">\${trace.status}</span>
        </div>
      \`).join('');
    }
    
    // 显示追踪详情
    function showTraceDetail(traceId) {
      window.open('/api/trace/' + traceId, '_blank');
    }
    
    // 获取优化建议
    async function fetchSuggestions() {
      try {
        const response = await fetch('/api/metrics');
        const metrics = await response.json();
        updateSuggestions(metrics.suggestions);
      } catch (error) {
        console.error('获取优化建议失败:', error);
      }
    }
    
    // 更新优化建议
    function updateSuggestions(suggestions) {
      const list = document.getElementById('suggestion-list');
      document.getElementById('suggestions-count').textContent = suggestions.length;
      
      list.innerHTML = suggestions.map(s => \`
        <div class="suggestion-item">
          <span class="suggestion-priority priority-\${s.priority}">\${s.priority}</span>
          <span>\${s.description}</span>
        </div>
      \`).join('');
    }
    
    // 初始化
    fetchStats();
    fetchTraces();
    fetchSuggestions();
    
    // 定时刷新
    setInterval(fetchStats, 1000);
    setInterval(fetchTraces, 5000);
    setInterval(fetchSuggestions, 10000);
  </script>
</body>
</html>`;
  }
}

// ============ 工厂函数 ============

/**
 * 创建 Dashboard 服务器
 */
export async function createDashboard(
  harness: HarnessSystem,
  options: { port?: number } = {}
): Promise<DashboardServer> {
  const dashboard = new DashboardServer({
    harness,
    port: options.port || 3000,
  });
  await dashboard.start();
  return dashboard;
}
