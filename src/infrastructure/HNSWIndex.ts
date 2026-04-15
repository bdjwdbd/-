/**
 * HNSW 向量索引
 * 
 * 职责：
 * - 高效近似搜索：对数时间复杂度
 * - 可扩展性：支持百万级向量
 * - 可配置精度：平衡速度与准确率
 */

// ============================================================
// 类型定义
// ============================================================

export interface HNSWConfig {
  maxConnections: number;      // 每层最大连接数 (M)
  efConstruction: number;      // 构建时的候选数
  efSearch: number;            // 搜索时的候选数
  maxLevel: number;            // 最大层数
  levelMultiplier: number;     // 层级乘数
}

export interface VectorNode {
  id: string;
  vector: Float32Array;
  level: number;
  connections: Map<number, Set<string>>; // 层级 -> 连接节点ID
}

export interface SearchResult {
  id: string;
  score: number;
}

export interface IndexStats {
  nodeCount: number;
  maxLevel: number;
  avgConnections: number;
  memoryUsage: number;
}

// ============================================================
// HNSW 索引
// ============================================================

export class HNSWIndex {
  private nodes: Map<string, VectorNode> = new Map();
  private entryPoint: string | null = null;
  private maxLevel: number = 0;
  private config: HNSWConfig;
  private distanceCache: Map<string, number> = new Map();

  constructor(config: Partial<HNSWConfig> = {}) {
    this.config = {
      maxConnections: config.maxConnections ?? 16,
      efConstruction: config.efConstruction ?? 200,
      efSearch: config.efSearch ?? 50,
      maxLevel: config.maxLevel ?? 16,
      levelMultiplier: config.levelMultiplier ?? 1 / Math.log(2),
    };
  }

  /**
   * 添加向量
   */
  add(id: string, vector: Float32Array | number[]): void {
    const vec = vector instanceof Float32Array ? vector : new Float32Array(vector);
    const level = this.randomLevel();

    const node: VectorNode = {
      id,
      vector: vec,
      level,
      connections: new Map(),
    };

    // 初始化每层的连接
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, new Set());
    }

    // 如果是第一个节点，设为入口点
    if (this.entryPoint === null) {
      this.entryPoint = id;
      this.maxLevel = level;
      this.nodes.set(id, node);
      return;
    }

    // 从入口点开始搜索插入位置
    let currentNode = this.nodes.get(this.entryPoint)!;

    // 从最高层向下搜索
    for (let l = this.maxLevel; l > level; l--) {
      const nearest = this.searchLayer(node.vector, currentNode.id, 1, l)[0];
      if (nearest) {
        currentNode = this.nodes.get(nearest.id)!;
      }
    }

    // 在每层插入并建立连接
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const candidates = this.searchLayer(node.vector, currentNode.id, this.config.efConstruction, l);
      
      // 选择最近的 M 个节点作为连接
      const maxConn = this.config.maxConnections;
      const neighbors = candidates.slice(0, maxConn);

      for (const neighbor of neighbors) {
        // 双向连接
        node.connections.get(l)!.add(neighbor.id);
        const neighborNode = this.nodes.get(neighbor.id);
        if (neighborNode) {
          neighborNode.connections.get(l)!.add(id);
          
          // 如果连接数超过限制，修剪
          if (neighborNode.connections.get(l)!.size > maxConn) {
            this.pruneConnections(neighborNode, l, maxConn);
          }
        }
      }

      // 下一层的起点
      if (candidates.length > 0) {
        currentNode = this.nodes.get(candidates[0].id)!;
      }
    }

    // 如果新节点层级更高，更新入口点
    if (level > this.maxLevel) {
      this.entryPoint = id;
      this.maxLevel = level;
    }

    this.nodes.set(id, node);
  }

  /**
   * 搜索最相似的 K 个向量
   */
  search(query: Float32Array | number[], k: number): SearchResult[] {
    if (this.entryPoint === null || this.nodes.size === 0) {
      return [];
    }

    const queryVec = query instanceof Float32Array ? query : new Float32Array(query);
    let currentNode = this.nodes.get(this.entryPoint)!;

    // 从最高层向下搜索
    for (let l = this.maxLevel; l > 0; l--) {
      const nearest = this.searchLayer(queryVec, currentNode.id, 1, l)[0];
      if (nearest) {
        currentNode = this.nodes.get(nearest.id)!;
      }
    }

    // 在第 0 层搜索
    const candidates = this.searchLayer(queryVec, currentNode.id, this.config.efSearch, 0);

    // 返回前 K 个
    return candidates.slice(0, k);
  }

  /**
   * 在指定层搜索
   */
  private searchLayer(
    query: Float32Array,
    entryId: string,
    ef: number,
    level: number
  ): SearchResult[] {
    const visited = new Set<string>();
    const candidates: SearchResult[] = [];
    const results: SearchResult[] = [];

    const entryNode = this.nodes.get(entryId);
    if (!entryNode) return [];

    const entryDistance = this.distance(query, entryNode.vector);
    candidates.push({ id: entryId, score: entryDistance });
    results.push({ id: entryId, score: entryDistance });
    visited.add(entryId);

    while (candidates.length > 0) {
      // 取出最近的候选
      candidates.sort((a, b) => a.score - b.score);
      const current = candidates.shift()!;
      const currentNode = this.nodes.get(current.id);
      if (!currentNode) continue;

      // 取出最远的结果
      results.sort((a, b) => a.score - b.score);
      const furthest = results[results.length - 1];

      // 如果当前候选比最远的结果还远，停止
      if (current.score > furthest.score) {
        break;
      }

      // 遍历邻居
      const connections = currentNode.connections.get(level);
      if (connections) {
        for (const neighborId of connections) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            const neighborNode = this.nodes.get(neighborId);
            if (!neighborNode) continue;

            const distance = this.distance(query, neighborNode.vector);

            // 如果比最远的结果近，加入候选
            if (distance < furthest.score || results.length < ef) {
              candidates.push({ id: neighborId, score: distance });
              results.push({ id: neighborId, score: distance });

              // 保持结果数量
              if (results.length > ef) {
                results.sort((a, b) => a.score - b.score);
                results.pop();
              }
            }
          }
        }
      }
    }

    // 按距离排序
    results.sort((a, b) => a.score - b.score);
    return results;
  }

  /**
   * 修剪连接
   */
  private pruneConnections(node: VectorNode, level: number, maxConn: number): void {
    const connections = node.connections.get(level);
    if (!connections || connections.size <= maxConn) return;

    // 计算到所有邻居的距离
    const neighbors: Array<{ id: string; score: number }> = [];
    for (const neighborId of connections) {
      const neighborNode = this.nodes.get(neighborId);
      if (neighborNode) {
        const dist = this.distance(node.vector, neighborNode.vector);
        neighbors.push({ id: neighborId, score: dist });
      }
    }

    // 保留最近的 M 个
    neighbors.sort((a, b) => a.score - b.score);
    const keepIds = new Set(neighbors.slice(0, maxConn).map(n => n.id));

    // 移除其他连接
    for (const neighborId of connections) {
      if (!keepIds.has(neighborId)) {
        connections.delete(neighborId);
        // 同时移除反向连接
        const neighborNode = this.nodes.get(neighborId);
        neighborNode?.connections.get(level)?.delete(node.id);
      }
    }
  }

  /**
   * 计算距离（欧几里得距离）
   */
  private distance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * 随机生成层级
   */
  private randomLevel(): number {
    let level = 0;
    while (Math.random() < this.config.levelMultiplier && level < this.config.maxLevel) {
      level++;
    }
    return level;
  }

  /**
   * 删除向量
   */
  delete(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // 移除所有连接
    for (const [level, connections] of node.connections) {
      for (const neighborId of connections) {
        const neighborNode = this.nodes.get(neighborId);
        neighborNode?.connections.get(level)?.delete(id);
      }
    }

    this.nodes.delete(id);

    // 如果删除的是入口点，选择新的入口点
    if (this.entryPoint === id) {
      this.entryPoint = this.nodes.keys().next().value || null;
      if (this.entryPoint) {
        this.maxLevel = this.nodes.get(this.entryPoint)?.level || 0;
      } else {
        this.maxLevel = 0;
      }
    }

    return true;
  }

  /**
   * 获取向量
   */
  get(id: string): Float32Array | undefined {
    return this.nodes.get(id)?.vector;
  }

  /**
   * 检查是否存在
   */
  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * 获取统计信息
   */
  getStats(): IndexStats {
    let totalConnections = 0;
    for (const node of this.nodes.values()) {
      for (const connections of node.connections.values()) {
        totalConnections += connections.size;
      }
    }

    const avgConnections = this.nodes.size > 0 ? totalConnections / this.nodes.size : 0;

    // 估算内存使用
    let memoryUsage = 0;
    for (const node of this.nodes.values()) {
      memoryUsage += node.vector.byteLength;
      memoryUsage += node.connections.size * 100; // 估算连接开销
    }

    return {
      nodeCount: this.nodes.size,
      maxLevel: this.maxLevel,
      avgConnections,
      memoryUsage,
    };
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.nodes.clear();
    this.entryPoint = null;
    this.maxLevel = 0;
    this.distanceCache.clear();
  }

  /**
   * 获取节点数量
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * 获取配置
   */
  getConfig(): HNSWConfig {
    return { ...this.config };
  }

  /**
   * 设置搜索参数
   */
  setSearchEf(ef: number): void {
    this.config.efSearch = ef;
  }
}

// ============================================================
// 单例导出
// ============================================================

let hnswIndexInstance: HNSWIndex | null = null;

export function getHNSWIndex(config?: Partial<HNSWConfig>): HNSWIndex {
  if (!hnswIndexInstance) {
    hnswIndexInstance = new HNSWIndex(config);
  }
  return hnswIndexInstance;
}

export function createHNSWIndex(config?: Partial<HNSWConfig>): HNSWIndex {
  return new HNSWIndex(config);
}
