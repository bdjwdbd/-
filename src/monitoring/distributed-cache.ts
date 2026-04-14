/**
 * 分布式缓存管理器
 * 
 * 功能：
 * 1. 多节点缓存同步
 * 2. 一致性哈希分布
 * 3. 缓存失效广播
 */

// ============================================================
// 类型定义
// ============================================================

interface CacheNode {
  id: string;
  url: string;
  weight: number;
  healthy: boolean;
  lastCheck: number;
}

interface DistributedCacheEntry {
  key: string;
  value: any;
  version: number;
  nodeId: string;
  timestamp: number;
  ttl: number;
}

interface SyncMessage {
  type: 'set' | 'delete' | 'invalidate';
  key: string;
  value?: any;
  version: number;
  sourceNode: string;
}

interface DistributedCacheStats {
  totalNodes: number;
  healthyNodes: number;
  localCacheSize: number;
  hitRate: number;
  syncMessages: number;
  avgLatency: number;
}

// ============================================================
// 分布式缓存管理器
// ============================================================

export class DistributedCacheManager {
  private nodes: Map<string, CacheNode> = new Map();
  private localCache: Map<string, DistributedCacheEntry> = new Map();
  private versionCounter: number = 0;
  private nodeId: string;
  private stats: DistributedCacheStats = {
    totalNodes: 0,
    healthyNodes: 0,
    localCacheSize: 0,
    hitRate: 0,
    syncMessages: 0,
    avgLatency: 0,
  };

  private config: {
    syncEnabled: boolean;
    replicationFactor: number;
    healthCheckInterval: number;
    maxLocalCacheSize: number;
  };

  private hits: number = 0;
  private misses: number = 0;

  constructor(nodeId: string, config?: Partial<typeof DistributedCacheManager.prototype.config>) {
    this.nodeId = nodeId;
    this.config = {
      syncEnabled: true,
      replicationFactor: 2,
      healthCheckInterval: 30000,
      maxLocalCacheSize: 10000,
      ...config,
    };

    // 添加本地节点
    this.addNode({
      id: nodeId,
      url: 'local',
      weight: 1,
      healthy: true,
      lastCheck: Date.now(),
    });
  }

  /**
   * 添加节点
   */
  addNode(node: CacheNode): void {
    this.nodes.set(node.id, node);
    this.stats.totalNodes = this.nodes.size;
    this.stats.healthyNodes = Array.from(this.nodes.values()).filter(n => n.healthy).length;
  }

  /**
   * 移除节点
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.stats.totalNodes = this.nodes.size;
    this.stats.healthyNodes = Array.from(this.nodes.values()).filter(n => n.healthy).length;
  }

  /**
   * 一致性哈希：计算键应该存储在哪个节点
   */
  hashKey(key: string): string[] {
    const healthyNodes = Array.from(this.nodes.values()).filter(n => n.healthy);
    if (healthyNodes.length === 0) return [this.nodeId];

    // 简单哈希
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash;
    }

    // 选择节点（考虑权重）
    const totalWeight = healthyNodes.reduce((sum, n) => sum + n.weight, 0);
    let target = Math.abs(hash) % totalWeight;

    for (const node of healthyNodes) {
      target -= node.weight;
      if (target <= 0) {
        // 返回主节点和副本节点
        const primaryNode = node.id;
        const replicaNodes = healthyNodes
          .filter(n => n.id !== primaryNode)
          .slice(0, this.config.replicationFactor - 1)
          .map(n => n.id);
        
        return [primaryNode, ...replicaNodes];
      }
    }

    return [healthyNodes[0].id];
  }

  /**
   * 设置缓存
   */
  set(key: string, value: any, ttl: number = 3600000): void {
    const targetNodes = this.hashKey(key);
    const version = ++this.versionCounter;

    const entry: DistributedCacheEntry = {
      key,
      value,
      version,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      ttl,
    };

    // 本地存储
    if (targetNodes.includes(this.nodeId)) {
      this.localCache.set(key, entry);
      this.stats.localCacheSize = this.localCache.size;
    }

    // 同步到其他节点
    if (this.config.syncEnabled) {
      this.broadcastSync({
        type: 'set',
        key,
        value,
        version,
        sourceNode: this.nodeId,
      });
    }
  }

  /**
   * 获取缓存
   */
  get(key: string): any | null {
    const entry = this.localCache.get(key);

    if (!entry) {
      this.misses++;
      this.updateHitRate();
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.localCache.delete(key);
      this.misses++;
      this.updateHitRate();
      return null;
    }

    this.hits++;
    this.updateHitRate();
    return entry.value;
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    const version = ++this.versionCounter;
    this.localCache.delete(key);
    this.stats.localCacheSize = this.localCache.size;

    if (this.config.syncEnabled) {
      this.broadcastSync({
        type: 'delete',
        key,
        version,
        sourceNode: this.nodeId,
      });
    }
  }

  /**
   * 失效缓存
   */
  invalidate(key: string): void {
    const version = ++this.versionCounter;

    if (this.config.syncEnabled) {
      this.broadcastSync({
        type: 'invalidate',
        key,
        version,
        sourceNode: this.nodeId,
      });
    }
  }

  /**
   * 处理同步消息
   */
  handleSyncMessage(message: SyncMessage): void {
    this.stats.syncMessages++;

    // 忽略来自自己的消息
    if (message.sourceNode === this.nodeId) return;

    switch (message.type) {
      case 'set':
        const existing = this.localCache.get(message.key);
        // 只有版本更新时才更新
        if (!existing || message.version > existing.version) {
          this.localCache.set(message.key, {
            key: message.key,
            value: message.value,
            version: message.version,
            nodeId: message.sourceNode,
            timestamp: Date.now(),
            ttl: 3600000,
          });
        }
        break;

      case 'delete':
      case 'invalidate':
        this.localCache.delete(message.key);
        break;
    }

    this.stats.localCacheSize = this.localCache.size;
  }

  /**
   * 广播同步消息
   */
  private broadcastSync(message: SyncMessage): void {
    // 模拟广播（实际实现需要消息队列或 RPC）
    this.stats.syncMessages++;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.hits + this.misses;
    this.stats.hitRate = total > 0 ? this.hits / total : 0;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<void> {
    for (const [id, node] of this.nodes) {
      if (id === this.nodeId) continue;

      try {
        // 模拟健康检查
        node.healthy = true;
        node.lastCheck = Date.now();
      } catch {
        node.healthy = false;
        node.lastCheck = Date.now();
      }
    }

    this.stats.healthyNodes = Array.from(this.nodes.values()).filter(n => n.healthy).length;
  }

  /**
   * 获取统计信息
   */
  getStats(): DistributedCacheStats {
    return { ...this.stats };
  }

  /**
   * 获取节点列表
   */
  getNodes(): CacheNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 清理本地缓存
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.localCache) {
      if (now - entry.timestamp > entry.ttl) {
        this.localCache.delete(key);
      }
    }
    this.stats.localCacheSize = this.localCache.size;
  }

  /**
   * 重置
   */
  reset(): void {
    this.localCache.clear();
    this.hits = 0;
    this.misses = 0;
    this.versionCounter = 0;
    this.stats = {
      totalNodes: this.nodes.size,
      healthyNodes: Array.from(this.nodes.values()).filter(n => n.healthy).length,
      localCacheSize: 0,
      hitRate: 0,
      syncMessages: 0,
      avgLatency: 0,
    };
  }
}

// ============================================================
// 单例
// ============================================================

let instance: DistributedCacheManager | null = null;

export function getDistributedCacheManager(nodeId?: string): DistributedCacheManager {
  if (!instance) {
    instance = new DistributedCacheManager(nodeId || 'default-node');
  }
  return instance;
}
