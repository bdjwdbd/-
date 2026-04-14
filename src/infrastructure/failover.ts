/**
 * 故障转移模块
 * 
 * 功能：
 * 1. 节点健康检查
 * 2. 自动故障转移
 * 3. 负载均衡
 */

// ============================================================
// 类型定义
// ============================================================

export enum NodeStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline',
}

export interface Node {
  id: string;
  endpoint: string;
  weight: number;
  status: NodeStatus;
  lastCheck: number;
  failureCount: number;
  successCount: number;
  latency: number;
}

export interface HealthCheckConfig {
  interval: number;       // 检查间隔（毫秒）
  timeout: number;        // 超时时间（毫秒）
  failureThreshold: number;  // 失败阈值
  successThreshold: number;  // 成功阈值
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: HealthCheckConfig = {
  interval: 30000,
  timeout: 5000,
  failureThreshold: 3,
  successThreshold: 2,
};

// ============================================================
// 健康检查器
// ============================================================

export class HealthChecker {
  private config: HealthCheckConfig;
  private nodes: Map<string, Node> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 添加节点
   */
  addNode(id: string, endpoint: string, weight: number = 1.0): void {
    this.nodes.set(id, {
      id,
      endpoint,
      weight,
      status: NodeStatus.HEALTHY,
      lastCheck: Date.now(),
      failureCount: 0,
      successCount: 0,
      latency: 0,
    });
  }

  /**
   * 移除节点
   */
  removeNode(id: string): boolean {
    return this.nodes.delete(id);
  }

  /**
   * 检查单个节点
   */
  async checkNode(id: string): Promise<boolean> {
    const node = this.nodes.get(id);
    if (!node) return false;

    const start = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${node.endpoint}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      node.latency = Date.now() - start;
      node.lastCheck = Date.now();

      if (response.ok) {
        this.recordSuccess(node);
        return true;
      } else {
        this.recordFailure(node);
        return false;
      }
    } catch (error) {
      this.recordFailure(node);
      return false;
    }
  }

  /**
   * 记录成功
   */
  private recordSuccess(node: Node): void {
    node.successCount++;
    node.failureCount = 0;

    if (node.status === NodeStatus.UNHEALTHY && node.successCount >= this.config.successThreshold) {
      node.status = NodeStatus.HEALTHY;
    } else if (node.status === NodeStatus.DEGRADED && node.successCount >= this.config.successThreshold) {
      node.status = NodeStatus.HEALTHY;
    }
  }

  /**
   * 记录失败
   */
  private recordFailure(node: Node): void {
    node.failureCount++;
    node.successCount = 0;

    if (node.failureCount >= this.config.failureThreshold) {
      node.status = NodeStatus.UNHEALTHY;
    } else if (node.failureCount >= 1) {
      node.status = NodeStatus.DEGRADED;
    }
  }

  /**
   * 检查所有节点
   */
  async checkAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const checks = Array.from(this.nodes.keys()).map(async id => {
      const result = await this.checkNode(id);
      results.set(id, result);
    });

    await Promise.all(checks);
    return results;
  }

  /**
   * 启动定期检查
   */
  startPeriodicCheck(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkAll();
    }, this.config.interval);
  }

  /**
   * 停止定期检查
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 获取健康节点
   */
  getHealthyNodes(): Node[] {
    return Array.from(this.nodes.values())
      .filter(n => n.status === NodeStatus.HEALTHY);
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取节点状态
   */
  getNodeStatus(id: string): NodeStatus | undefined {
    return this.nodes.get(id)?.status;
  }
}

// ============================================================
// 故障转移管理器
// ============================================================

export class FailoverManager {
  private healthChecker: HealthChecker;
  private nodes: Map<string, Node> = new Map();

  constructor(healthChecker: HealthChecker) {
    this.healthChecker = healthChecker;
  }

  /**
   * 选择最佳节点
   */
  selectNode(): Node | null {
    const healthyNodes = this.healthChecker.getHealthyNodes();
    
    if (healthyNodes.length === 0) {
      return null;
    }

    // 加权随机选择
    const totalWeight = healthyNodes.reduce((sum, n) => sum + n.weight, 0);
    let random = Math.random() * totalWeight;

    for (const node of healthyNodes) {
      random -= node.weight;
      if (random <= 0) {
        return node;
      }
    }

    return healthyNodes[0];
  }

  /**
   * 执行请求（带故障转移）
   */
  async executeWithFailover<T>(
    request: (node: Node) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      const node = this.selectNode();
      
      if (!node) {
        throw new Error('没有可用的健康节点');
      }

      try {
        return await request(node);
      } catch (error) {
        lastError = error as Error;
        // 标记节点为不健康
        node.status = NodeStatus.DEGRADED;
        node.failureCount++;
      }
    }

    throw lastError || new Error('所有节点都失败');
  }

  /**
   * 获取健康检查器
   */
  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }
}
