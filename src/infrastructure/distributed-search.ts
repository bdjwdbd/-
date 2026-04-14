/**
 * 分布式向量搜索
 * 
 * 功能：
 * 1. 向量分片
 * 2. 多节点并行搜索
 * 3. 结果聚合
 */

// ============================================================
// 类型定义
// ============================================================

export interface ShardConfig {
  nShards: number;
  hashFunc: 'murmur' | 'simple';
}

export interface DistributedSearchResult {
  id: string | number;
  score: number;
  shard: number;
}

export interface NodeConfig {
  id: string;
  endpoint: string;
  weight: number;
}

// ============================================================
// 向量分片器
// ============================================================

export class VectorSharder {
  private nShards: number;
  private hashFunc: 'murmur' | 'simple';
  private shards: Map<string | number, number[]>[];
  private shardMetadata: Record<string, unknown>[];

  constructor(config: Partial<ShardConfig> = {}) {
    this.nShards = config.nShards ?? 4;
    this.hashFunc = config.hashFunc ?? 'murmur';
    this.shards = Array.from({ length: this.nShards }, () => new Map());
    this.shardMetadata = Array.from({ length: this.nShards }, () => ({}));
  }

  /**
   * 添加向量到分片
   */
  add(id: string | number, vector: number[]): number {
    const shardIndex = this.hash(id);
    this.shards[shardIndex].set(id, vector);
    return shardIndex;
  }

  /**
   * 批量添加
   */
  addBatch(items: Array<{ id: string | number; vector: number[] }>): Map<string | number, number> {
    const mapping = new Map<string | number, number>();
    for (const item of items) {
      const shardIndex = this.add(item.id, item.vector);
      mapping.set(item.id, shardIndex);
    }
    return mapping;
  }

  /**
   * 获取向量
   */
  get(id: string | number): number[] | undefined {
    const shardIndex = this.hash(id);
    return this.shards[shardIndex].get(id);
  }

  /**
   * 获取分片
   */
  getShard(index: number): Map<string | number, number[]> {
    return this.shards[index];
  }

  /**
   * 获取所有分片
   */
  getAllShards(): Map<string | number, number[]>[] {
    return this.shards;
  }

  /**
   * 计算哈希
   */
  private hash(id: string | number): number {
    const idStr = String(id);
    
    if (this.hashFunc === 'murmur') {
      // 简化的 MurmurHash
      let h = 0;
      for (let i = 0; i < idStr.length; i++) {
        h = ((h << 5) - h + idStr.charCodeAt(i)) | 0;
      }
      return Math.abs(h) % this.nShards;
    } else {
      return Math.abs(hashCode(idStr)) % this.nShards;
    }
  }

  /**
   * 获取分片统计
   */
  getStats(): Array<{ index: number; size: number; metadata: Record<string, unknown> }> {
    return this.shards.map((shard, index) => ({
      index,
      size: shard.size,
      metadata: this.shardMetadata[index],
    }));
  }

  /**
   * 清空
   */
  clear(): void {
    this.shards = Array.from({ length: this.nShards }, () => new Map());
  }
}

// ============================================================
// 分布式搜索器
// ============================================================

export class DistributedSearcher {
  private sharder: VectorSharder;
  private nodes: NodeConfig[] = [];

  constructor(sharder: VectorSharder) {
    this.sharder = sharder;
  }

  /**
   * 添加节点
   */
  addNode(node: NodeConfig): void {
    this.nodes.push(node);
  }

  /**
   * 并行搜索所有分片
   */
  async search(
    query: number[],
    topK: number = 10,
    searchFunc: (shard: Map<string | number, number[]>, query: number[], k: number) => Promise<Array<{ id: string | number; score: number }>>
  ): Promise<DistributedSearchResult[]> {
    const shards = this.sharder.getAllShards();
    
    // 并行搜索所有分片
    const searchPromises = shards.map(async (shard, index) => {
      const results = await searchFunc(shard, query, topK);
      return results.map(r => ({
        id: r.id,
        score: r.score,
        shard: index,
      }));
    });

    const allResults = await Promise.all(searchPromises);
    
    // 合并结果
    const merged: DistributedSearchResult[] = [];
    for (const results of allResults) {
      merged.push(...results);
    }

    // 排序并返回 top-k
    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, topK);
  }

  /**
   * 获取节点
   */
  getNodes(): NodeConfig[] {
    return [...this.nodes];
  }
}

// ============================================================
// 辅助函数
// ============================================================

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}
