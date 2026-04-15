/**
 * 分布式搜索引擎
 * 
 * 职责：
 * - 向量分片存储
 * - 并行搜索
 * - 结果合并
 * - 支持亿级向量
 */

// ============================================================
// 类型定义
// ============================================================

export interface ShardConfig {
  /** 分片 ID */
  id: string;
  /** 分片地址 */
  endpoint: string;
  /** 向量数量 */
  vectorCount: number;
  /** 状态 */
  status: 'active' | 'inactive' | 'syncing';
}

export interface DistributedSearchConfig {
  /** 分片列表 */
  shards: ShardConfig[];
  /** 并行查询数 */
  parallelQueries: number;
  /** 超时时间 */
  timeout: number;
  /** 重试次数 */
  retries: number;
}

export interface DistributedSearchResult {
  id: string;
  score: number;
  shardId: string;
  metadata?: Record<string, unknown>;
}

export interface SearchRequest {
  query: Float32Array;
  k: number;
  filters?: Record<string, unknown>;
}

export interface SearchResponse {
  results: DistributedSearchResult[];
  totalTime: number;
  shardTimes: Record<string, number>;
}

// ============================================================
// 分片管理器
// ============================================================

export class ShardManager {
  private shards: Map<string, ShardConfig> = new Map();
  private healthyShards: Set<string> = new Set();

  constructor(shards: ShardConfig[] = []) {
    for (const shard of shards) {
      this.addShard(shard);
    }
  }

  /**
   * 添加分片
   */
  addShard(shard: ShardConfig): void {
    this.shards.set(shard.id, shard);
    if (shard.status === 'active') {
      this.healthyShards.add(shard.id);
    }
  }

  /**
   * 移除分片
   */
  removeShard(shardId: string): void {
    this.shards.delete(shardId);
    this.healthyShards.delete(shardId);
  }

  /**
   * 获取健康分片
   */
  getHealthyShards(): ShardConfig[] {
    return Array.from(this.healthyShards)
      .map(id => this.shards.get(id)!)
      .filter(Boolean);
  }

  /**
   * 更新分片状态
   */
  updateShardStatus(shardId: string, status: ShardConfig['status']): void {
    const shard = this.shards.get(shardId);
    if (shard) {
      shard.status = status;
      if (status === 'active') {
        this.healthyShards.add(shardId);
      } else {
        this.healthyShards.delete(shardId);
      }
    }
  }

  /**
   * 获取分片统计
   */
  getStats(): {
    totalShards: number;
    healthyShards: number;
    totalVectors: number;
  } {
    let totalVectors = 0;
    for (const shard of this.shards.values()) {
      totalVectors += shard.vectorCount;
    }

    return {
      totalShards: this.shards.size,
      healthyShards: this.healthyShards.size,
      totalVectors,
    };
  }
}

// ============================================================
// 分布式搜索引擎
// ============================================================

export class DistributedSearchEngine {
  private shardManager: ShardManager;
  private config: Required<DistributedSearchConfig>;
  private localShards: Map<string, LocalShard> = new Map();

  constructor(config: Partial<DistributedSearchConfig> = {}) {
    this.config = {
      shards: config.shards ?? [],
      parallelQueries: config.parallelQueries ?? 4,
      timeout: config.timeout ?? 5000,
      retries: config.retries ?? 2,
    };

    this.shardManager = new ShardManager(this.config.shards);
  }

  /**
   * 添加本地分片
   */
  addLocalShard(shardId: string, shard: LocalShard): void {
    this.localShards.set(shardId, shard);
    this.shardManager.addShard({
      id: shardId,
      endpoint: 'local',
      vectorCount: shard.getVectorCount(),
      status: 'active',
    });
  }

  /**
   * 分布式搜索
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();
    const shardTimes: Record<string, number> = {};

    // 获取健康分片
    const healthyShards = this.shardManager.getHealthyShards();

    if (healthyShards.length === 0) {
      throw new Error('没有可用的健康分片');
    }

    // 并行搜索所有分片
    const searchPromises = healthyShards.map(async (shard) => {
      const shardStart = Date.now();

      try {
        const results = await this.searchShard(shard, request);
        shardTimes[shard.id] = Date.now() - shardStart;
        return results;
      } catch (error) {
        console.error(`[DistributedSearch] 分片 ${shard.id} 搜索失败:`, error);
        shardTimes[shard.id] = -1;
        return [];
      }
    });

    // 等待所有分片返回
    const shardResults = await Promise.all(searchPromises);

    // 合并结果
    const mergedResults = this.mergeResults(shardResults, request.k);

    return {
      results: mergedResults,
      totalTime: Date.now() - startTime,
      shardTimes,
    };
  }

  /**
   * 搜索单个分片
   */
  private async searchShard(
    shard: ShardConfig,
    request: SearchRequest
  ): Promise<DistributedSearchResult[]> {
    // 本地分片
    if (shard.endpoint === 'local') {
      const localShard = this.localShards.get(shard.id);
      if (!localShard) {
        throw new Error(`本地分片 ${shard.id} 不存在`);
      }

      const results = localShard.search(request.query, request.k);
      return results.map(r => ({
        ...r,
        shardId: shard.id,
      }));
    }

    // 远程分片（模拟）
    // 实际实现需要 HTTP/gRPC 调用
    console.log(`[DistributedSearch] 搜索远程分片: ${shard.id}`);
    return [];
  }

  /**
   * 合并结果
   */
  private mergeResults(
    shardResults: DistributedSearchResult[][],
    k: number
  ): DistributedSearchResult[] {
    // 收集所有结果
    const allResults: DistributedSearchResult[] = [];
    for (const results of shardResults) {
      allResults.push(...results);
    }

    // 按分数排序
    allResults.sort((a, b) => b.score - a.score);

    // 返回 Top-K
    return allResults.slice(0, k);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    shards: ReturnType<ShardManager['getStats']>;
    localShards: number;
  } {
    return {
      shards: this.shardManager.getStats(),
      localShards: this.localShards.size,
    };
  }
}

// ============================================================
// 本地分片
// ============================================================

export class LocalShard {
  private vectors: Map<string, Float32Array> = new Map();
  private metadata: Map<string, Record<string, unknown>> = new Map();

  /**
   * 添加向量
   */
  add(id: string, vector: Float32Array, metadata?: Record<string, unknown>): void {
    this.vectors.set(id, vector);
    if (metadata) {
      this.metadata.set(id, metadata);
    }
  }

  /**
   * 批量添加
   */
  addBatch(items: Array<{ id: string; vector: Float32Array; metadata?: Record<string, unknown> }>): void {
    for (const item of items) {
      this.add(item.id, item.vector, item.metadata);
    }
  }

  /**
   * 搜索
   */
  search(query: Float32Array, k: number): Array<{ id: string; score: number; metadata?: Record<string, unknown> }> {
    const results: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> = [];

    for (const [id, vector] of this.vectors) {
      const score = this.cosineSimilarity(query, vector);
      results.push({
        id,
        score,
        metadata: this.metadata.get(id),
      });
    }

    // 排序并返回 Top-K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * 获取向量数量
   */
  getVectorCount(): number {
    return this.vectors.size;
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createDistributedSearchEngine(
  config?: Partial<DistributedSearchConfig>
): DistributedSearchEngine {
  return new DistributedSearchEngine(config);
}
