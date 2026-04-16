/**
 * Dashboard + Multi-Agent 集成
 * 
 * 将 Multi-Agent 系统的状态展示到 Dashboard
 * 
 * @module integration/dashboard-multi-agent
 */

import { Coordinator, AgentInstance, TaskInstance, TaskStatus, AgentStatus } from '../multi-agent';
import { DashboardServer, DashboardStats } from '../dashboard/server';

// ============ 扩展 Dashboard 统计 ============

interface MultiAgentDashboardStats extends DashboardStats {
  /** Multi-Agent 统计 */
  multiAgent: {
    agents: {
      total: number;
      idle: number;
      busy: number;
      offline: number;
      byCapability: Record<string, number>;
    };
    tasks: {
      pending: number;
      running: number;
      completed: number;
      failed: number;
      avgWaitTime: number;
      avgExecutionTime: number;
    };
    performance: {
      throughput: number;
      successRate: number;
      avgLatency: number;
    };
  };
}

// ============ 集成管理器 ============

/**
 * Dashboard + Multi-Agent 集成管理器
 */
export class DashboardMultiAgentIntegration {
  private coordinator: Coordinator;
  private dashboard: DashboardServer;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(coordinator: Coordinator, dashboard: DashboardServer) {
    this.coordinator = coordinator;
    this.dashboard = dashboard;
  }

  /**
   * 启动集成
   */
  start(): void {
    // 定期更新 Dashboard 数据
    this.updateInterval = setInterval(() => {
      this.updateDashboard();
    }, 1000);

    console.log('🔗 Dashboard + Multi-Agent 集成已启动');
  }

  /**
   * 停止集成
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('🔗 Dashboard + Multi-Agent 集成已停止');
  }

  /**
   * 更新 Dashboard 数据
   */
  private updateDashboard(): void {
    const stats = this.collectMultiAgentStats();
    // Dashboard 会自动从 API 获取数据
  }

  /**
   * 收集 Multi-Agent 统计数据
   */
  collectMultiAgentStats(): MultiAgentDashboardStats['multiAgent'] {
    const status = this.coordinator.getStatus();
    const agents = this.coordinator.getAgents();

    // Agent 统计
    const agentStats = {
      total: agents.length,
      idle: agents.filter(a => a.status === AgentStatus.IDLE).length,
      busy: agents.filter(a => a.status === AgentStatus.BUSY).length,
      offline: agents.filter(a => a.status === AgentStatus.OFFLINE).length,
      byCapability: this.countCapabilities(agents),
    };

    // 任务统计
    const taskStats = {
      pending: status.tasks.pending,
      running: status.tasks.running,
      completed: status.tasks.completed,
      failed: 0, // 简化
      avgWaitTime: 0, // 简化
      avgExecutionTime: this.calculateAvgExecutionTime(agents),
    };

    // 性能统计
    const performanceStats = {
      throughput: this.calculateThroughput(agents),
      successRate: this.calculateSuccessRate(agents),
      avgLatency: this.calculateAvgLatency(agents),
    };

    return {
      agents: agentStats,
      tasks: taskStats,
      performance: performanceStats,
    };
  }

  /**
   * 统计能力分布
   */
  private countCapabilities(agents: AgentInstance[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const agent of agents) {
      for (const cap of agent.definition.capabilities) {
        counts[cap.id] = (counts[cap.id] || 0) + 1;
      }
    }
    return counts;
  }

  /**
   * 计算平均执行时间
   */
  private calculateAvgExecutionTime(agents: AgentInstance[]): number {
    const times = agents
      .filter(a => a.stats.avgResponseTime > 0)
      .map(a => a.stats.avgResponseTime);
    if (times.length === 0) return 0;
    return times.reduce((sum, t) => sum + t, 0) / times.length;
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(agents: AgentInstance[]): number {
    const totalCompleted = agents.reduce((sum, a) => sum + a.completedTasks, 0);
    // 简化：假设运行了 60 秒
    return totalCompleted / 60;
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(agents: AgentInstance[]): number {
    const totalCompleted = agents.reduce((sum, a) => sum + a.completedTasks, 0);
    const totalFailed = agents.reduce((sum, a) => sum + a.failedTasks, 0);
    const total = totalCompleted + totalFailed;
    if (total === 0) return 1.0;
    return totalCompleted / total;
  }

  /**
   * 计算平均延迟
   */
  private calculateAvgLatency(agents: AgentInstance[]): number {
    const latencies = agents
      .filter(a => a.stats.avgResponseTime > 0)
      .map(a => a.stats.avgResponseTime);
    if (latencies.length === 0) return 0;
    return latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  }

  /**
   * 获取 Agent 详情
   */
  getAgentDetails(): Array<{
    id: string;
    name: string;
    status: string;
    capabilities: string[];
    currentTasks: number;
    completedTasks: number;
    failedTasks: number;
    successRate: number;
    avgResponseTime: number;
  }> {
    const agents = this.coordinator.getAgents();
    return agents.map(agent => ({
      id: agent.definition.agentId,
      name: agent.definition.name,
      status: agent.status,
      capabilities: agent.definition.capabilities.map(c => c.name),
      currentTasks: agent.currentTasks,
      completedTasks: agent.completedTasks,
      failedTasks: agent.failedTasks,
      successRate: agent.stats.successRate,
      avgResponseTime: agent.stats.avgResponseTime,
    }));
  }
}

// ============ 扩展 Dashboard HTML ============

/**
 * 生成 Multi-Agent 面板 HTML
 */
export function generateMultiAgentPanelHTML(): string {
  return `
<div class="card">
  <div class="card-header">
    <span class="card-title">Multi-Agent 系统</span>
    <span id="ma-agent-total">0</span>
  </div>
  <div class="metric-grid">
    <div class="metric-item">
      <div class="metric-label">空闲</div>
      <div class="metric-value" id="ma-agent-idle" style="color: #22c55e;">0</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">忙碌</div>
      <div class="metric-value" id="ma-agent-busy" style="color: #f59e0b;">0</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">离线</div>
      <div class="metric-value" id="ma-agent-offline" style="color: #ef4444;">0</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">成功率</div>
      <div class="metric-value" id="ma-success-rate">0%</div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header">
    <span class="card-title">任务队列</span>
    <span id="ma-task-total">0</span>
  </div>
  <div class="metric-grid">
    <div class="metric-item">
      <div class="metric-label">待处理</div>
      <div class="metric-value" id="ma-task-pending" style="color: #3b82f6;">0</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">执行中</div>
      <div class="metric-value" id="ma-task-running" style="color: #f59e0b;">0</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">已完成</div>
      <div class="metric-value" id="ma-task-completed" style="color: #22c55e;">0</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">吞吐量</div>
      <div class="metric-value" id="ma-throughput">0/s</div>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header">
    <span class="card-title">Agent 列表</span>
  </div>
  <div class="agent-list" id="ma-agent-list">
    <div class="agent-item">加载中...</div>
  </div>
</div>
`;
}

// ============ 工厂函数 ============

/**
 * 创建集成管理器
 */
export function createDashboardMultiAgentIntegration(
  coordinator: Coordinator,
  dashboard: DashboardServer
): DashboardMultiAgentIntegration {
  return new DashboardMultiAgentIntegration(coordinator, dashboard);
}
