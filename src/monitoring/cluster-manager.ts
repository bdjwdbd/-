/**
 * 分布式部署管理器
 * 
 * 功能：
 * 1. 节点管理
 * 2. 负载均衡
 * 3. 故障转移
 * 4. 集群状态监控
 */

// ============================================================
// 类型定义
// ============================================================

interface ClusterNode {
  id: string;
  host: string;
  port: number;
  status: 'online' | 'offline' | 'busy' | 'error';
  load: number; // 0-100
  lastHeartbeat: number;
  metadata?: Record<string, unknown>;
}

interface LoadBalancerConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'random';
  healthCheckInterval: number;
  heartbeatTimeout: number;
  maxRetries: number;
}

interface ClusterStats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  avgLoad: number;
  totalRequests: number;
  failedRequests: number;
}

// ============================================================
// 负载均衡器
// ============================================================

export class LoadBalancer {
  private nodes: Map<string, ClusterNode> = new Map();
  private currentIndex: number = 0;
  private config: LoadBalancerConfig;
  private stats: ClusterStats = {
    totalNodes: 0,
    onlineNodes: 0,
    offlineNodes: 0,
    avgLoad: 0,
    totalRequests: 0,
    failedRequests: 0,
  };

  constructor(config?: Partial<LoadBalancerConfig>) {
    this.config = {
      strategy: 'round-robin',
      healthCheckInterval: 30000,
      heartbeatTimeout: 60000,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * 添加节点
   */
  addNode(node: ClusterNode): void {
    this.nodes.set(node.id, node);
    this.updateStats();
  }

  /**
   * 移除节点
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.updateStats();
  }

  /**
   * 获取下一个可用节点
   */
  getNextNode(): ClusterNode | null {
    const onlineNodes = Array.from(this.nodes.values())
      .filter(n => n.status === 'online');

    if (onlineNodes.length === 0) return null;

    switch (this.config.strategy) {
      case 'round-robin':
        return this.roundRobin(onlineNodes);

      case 'least-connections':
        return this.leastConnections(onlineNodes);

      case 'weighted':
        return this.weighted(onlineNodes);

      case 'random':
        return this.random(onlineNodes);

      default:
        return this.roundRobin(onlineNodes);
    }
  }

  /**
   * 轮询策略
   */
  private roundRobin(nodes: ClusterNode[]): ClusterNode {
    const node = nodes[this.currentIndex % nodes.length];
    this.currentIndex++;
    return node;
  }

  /**
   * 最少连接策略
   */
  private leastConnections(nodes: ClusterNode[]): ClusterNode {
    return nodes.reduce((min, node) => 
      node.load < min.load ? node : min
    );
  }

  /**
   * 加权策略
   */
  private weighted(nodes: ClusterNode[]): ClusterNode {
    // 负载越低权重越高
    const totalWeight = nodes.reduce((sum, n) => sum + (100 - n.load), 0);
    let random = Math.random() * totalWeight;

    for (const node of nodes) {
      random -= (100 - node.load);
      if (random <= 0) return node;
    }

    return nodes[0];
  }

  /**
   * 随机策略
   */
  private random(nodes: ClusterNode[]): ClusterNode {
    return nodes[Math.floor(Math.random() * nodes.length)];
  }

  /**
   * 更新节点负载
   */
  updateLoad(nodeId: string, load: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.load = Math.max(0, Math.min(100, load));
    }
  }

  /**
   * 更新节点状态
   */
  updateStatus(nodeId: string, status: ClusterNode['status']): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = status;
      node.lastHeartbeat = Date.now();
      this.updateStats();
    }
  }

  /**
   * 更新统计
   */
  private updateStats(): void {
    const nodes = Array.from(this.nodes.values());
    this.stats.totalNodes = nodes.length;
    this.stats.onlineNodes = nodes.filter(n => n.status === 'online').length;
    this.stats.offlineNodes = nodes.filter(n => n.status === 'offline').length;
    this.stats.avgLoad = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + n.load, 0) / nodes.length
      : 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): ClusterStats {
    return { ...this.stats };
  }

  /**
   * 获取所有节点
   */
  getNodes(): ClusterNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<void> {
    const now = Date.now();

    for (const [id, node] of this.nodes) {
      // 检查心跳超时
      if (now - node.lastHeartbeat > this.config.heartbeatTimeout) {
        node.status = 'offline';
      }
    }

    this.updateStats();
  }
}

// ============================================================
// 故障转移管理器
// ============================================================

export class FailoverManager {
  private loadBalancer: LoadBalancer;
  private retryCount: Map<string, number> = new Map();

  constructor(loadBalancer: LoadBalancer) {
    this.loadBalancer = loadBalancer;
  }

  /**
   * 执行请求（带故障转移）
   */
  async executeWithFailover<T>(
    requestFn: (node: ClusterNode) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts < maxRetries) {
      const node = this.loadBalancer.getNextNode();
      
      if (!node) {
        throw new Error('No available nodes');
      }

      try {
        const result = await requestFn(node);
        this.retryCount.delete(node.id);
        return result;
      } catch (error) {
        lastError = error as Error;
        attempts++;

        // 标记节点为错误状态
        this.loadBalancer.updateStatus(node.id, 'error');

        // 记录重试次数
        const retries = (this.retryCount.get(node.id) || 0) + 1;
        this.retryCount.set(node.id, retries);

        // 如果节点连续失败多次，标记为离线
        if (retries >= maxRetries) {
          this.loadBalancer.updateStatus(node.id, 'offline');
        }
      }
    }

    throw lastError || new Error('All retries failed');
  }

  /**
   * 获取节点重试次数
   */
  getRetryCount(nodeId: string): number {
    return this.retryCount.get(nodeId) || 0;
  }

  /**
   * 重置重试计数
   */
  resetRetryCount(nodeId: string): void {
    this.retryCount.delete(nodeId);
  }
}

// ============================================================
// 集群管理器
// ============================================================

export class ClusterManager {
  private loadBalancer: LoadBalancer;
  private failoverManager: FailoverManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<LoadBalancerConfig>) {
    this.loadBalancer = new LoadBalancer(config);
    this.failoverManager = new FailoverManager(this.loadBalancer);
  }

  /**
   * 启动集群
   */
  start(): void {
    // 启动健康检查
    this.healthCheckInterval = setInterval(() => {
      this.loadBalancer.healthCheck();
    }, 30000);

    console.log('Cluster manager started');
  }

  /**
   * 停止集群
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    console.log('Cluster manager stopped');
  }

  /**
   * 添加节点
   */
  addNode(node: ClusterNode): void {
    this.loadBalancer.addNode(node);
  }

  /**
   * 移除节点
   */
  removeNode(nodeId: string): void {
    this.loadBalancer.removeNode(nodeId);
  }

  /**
   * 执行请求
   */
  async execute<T>(requestFn: (node: ClusterNode) => Promise<T>): Promise<T> {
    return this.failoverManager.executeWithFailover(requestFn);
  }

  /**
   * 获取集群状态
   */
  getStatus(): {
    stats: ClusterStats;
    nodes: ClusterNode[];
  } {
    return {
      stats: this.loadBalancer.getStats(),
      nodes: this.loadBalancer.getNodes(),
    };
  }

  /**
   * 获取负载均衡器
   */
  getLoadBalancer(): LoadBalancer {
    return this.loadBalancer;
  }

  /**
   * 获取故障转移管理器
   */
  getFailoverManager(): FailoverManager {
    return this.failoverManager;
  }
}

// ============================================================
// 单例
// ============================================================

let instance: ClusterManager | null = null;

export function getClusterManager(config?: Partial<LoadBalancerConfig>): ClusterManager {
  if (!instance) {
    instance = new ClusterManager(config);
  }
  return instance;
}
