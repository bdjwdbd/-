/**
 * HNSW (Hierarchical Navigable Small World) 索引 - 纯 TypeScript 实现
 * 
 * 功能：
 * 1. 高效近似最近邻搜索
 * 2. 支持大规模向量
 * 3. 支持增量添加
 * 
 * 性能：
 * - 搜索复杂度: O(log N)
 * - 内存占用: O(N * M) where M = 平均连接数
 */

// ============================================================
// 类型定义
// ============================================================

export interface HNSWConfig {
  dimensions: number;
  maxConnections?: number;        // M: 每层最大连接数
  efConstruction?: number;        // 构建时的搜索宽度
  efSearch?: number;              // 搜索时的搜索宽度
  maxLevel?: number;              // 最大层数
  distanceFunction?: "cosine" | "euclidean" | "dot";
}

export interface HNSWNode {
  id: string;
  vector: number[];
  level: number;
  connections: Map<number, Set<string>>;  // level -> neighbor ids
}

export interface SearchResult {
  id: string;
  score: number;
}

// ============================================================
// HNSWIndex 类
// ============================================================

export class HNSWIndex {
  private config: Required<HNSWConfig>;
  private nodes: Map<string, HNSWNode> = new Map();
  private entryPoint: string | null = null;
  private maxLevel: number = 0;
  
  constructor(config: HNSWConfig) {
    this.config = {
      dimensions: config.dimensions,
      maxConnections: config.maxConnections || 16,
      efConstruction: config.efConstruction || 200,
      efSearch: config.efSearch || 50,
      maxLevel: config.maxLevel || 16,
      distanceFunction: config.distanceFunction || "cosine",
    };
  }
  
  // ============================================================
  // 距离计算
  // ============================================================
  
  private distance(a: number[], b: number[]): number {
    switch (this.config.distanceFunction) {
      case "cosine":
        return this.cosineDistance(a, b);
      case "euclidean":
        return this.euclideanDistance(a, b);
      case "dot":
        return 1 - this.dotProduct(a, b);
      default:
        return this.cosineDistance(a, b);
    }
  }
  
  private cosineDistance(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    return 1 - similarity;
  }
  
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }
  
  private dotProduct(a: number[], b: number[]): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }
  
  // ============================================================
  // 层级计算
  // ============================================================
  
  private randomLevel(): number {
    // 使用指数分布生成层级
    const level = -Math.log(Math.random()) * (1 / Math.log(this.config.maxConnections));
    return Math.min(Math.floor(level), this.config.maxLevel);
  }
  
  // ============================================================
  // 添加向量
  // ============================================================
  
  add(id: string, vector: number[]): void {
    if (vector.length !== this.config.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.config.dimensions}, got ${vector.length}`);
    }
    
    const level = this.randomLevel();
    
    const node: HNSWNode = {
      id,
      vector,
      level,
      connections: new Map(),
    };
    
    // 初始化每层的连接
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, new Set());
    }
    
    this.nodes.set(id, node);
    
    // 如果是第一个节点，设为入口点
    if (!this.entryPoint) {
      this.entryPoint = id;
      this.maxLevel = level;
      return;
    }
    
    // 从最高层开始搜索
    let current = this.entryPoint;
    
    for (let l = this.maxLevel; l > level; l--) {
      current = this.greedySearch(current, vector, l);
    }
    
    // 在每层添加连接
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const neighbors = this.searchLayer(current, vector, this.config.efConstruction, l);
      
      // 选择最近的 M 个邻居
      const selectedNeighbors = neighbors.slice(0, this.config.maxConnections);
      
      // 添加双向连接
      for (const neighbor of selectedNeighbors) {
        node.connections.get(l)!.add(neighbor.id);
        
        const neighborNode = this.nodes.get(neighbor.id);
        if (neighborNode) {
          neighborNode.connections.get(l)?.add(id);
          
          // 如果邻居连接数超过 M，需要修剪
          if (neighborNode.connections.get(l)!.size > this.config.maxConnections) {
            this.pruneConnections(neighborNode, l);
          }
        }
      }
      
      // 更新当前节点为最近的邻居
      if (neighbors.length > 0) {
        current = neighbors[0].id;
      }
    }
    
    // 更新入口点
    if (level > this.maxLevel) {
      this.entryPoint = id;
      this.maxLevel = level;
    }
  }
  
  private greedySearch(entryId: string, query: number[], level: number): string {
    let current = entryId;
    let currentDist = this.distance(this.nodes.get(current)!.vector, query);
    
    let changed = true;
    while (changed) {
      changed = false;
      
      const currentNode = this.nodes.get(current);
      const neighbors = currentNode?.connections.get(level);
      
      if (neighbors) {
        for (const neighborId of neighbors) {
          const neighborNode = this.nodes.get(neighborId);
          if (neighborNode) {
            const dist = this.distance(neighborNode.vector, query);
            if (dist < currentDist) {
              current = neighborId;
              currentDist = dist;
              changed = true;
            }
          }
        }
      }
    }
    
    return current;
  }
  
  private searchLayer(
    entryId: string,
    query: number[],
    ef: number,
    level: number
  ): SearchResult[] {
    const visited = new Set<string>([entryId]);
    const candidates: SearchResult[] = [];
    const results: SearchResult[] = [];
    
    const entryNode = this.nodes.get(entryId);
    if (!entryNode) return [];
    
    const entryDist = this.distance(entryNode.vector, query);
    candidates.push({ id: entryId, score: entryDist });
    results.push({ id: entryId, score: entryDist });
    
    while (candidates.length > 0) {
      // 取出最近的候选
      candidates.sort((a, b) => a.score - b.score);
      const current = candidates.shift()!;
      
      // 取出最远的结果
      results.sort((a, b) => b.score - a.score);
      const furthest = results[0];
      
      // 如果当前候选比最远的结果还远，停止
      if (current.score > furthest.score) {
        break;
      }
      
      // 检查当前节点的邻居
      const currentNode = this.nodes.get(current.id);
      const neighbors = currentNode?.connections.get(level);
      
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            
            const neighborNode = this.nodes.get(neighborId);
            if (neighborNode) {
              const dist = this.distance(neighborNode.vector, query);
              
              // 如果比最远的结果近，或者结果未满
              if (dist < furthest.score || results.length < ef) {
                candidates.push({ id: neighborId, score: dist });
                results.push({ id: neighborId, score: dist });
                
                // 如果结果超过 ef，移除最远的
                if (results.length > ef) {
                  results.sort((a, b) => b.score - a.score);
                  results.shift();
                }
              }
            }
          }
        }
      }
    }
    
    results.sort((a, b) => a.score - b.score);
    return results;
  }
  
  private pruneConnections(node: HNSWNode, level: number): void {
    const connections = node.connections.get(level);
    if (!connections || connections.size <= this.config.maxConnections) {
      return;
    }
    
    // 计算所有邻居的距离
    const neighbors: SearchResult[] = [];
    for (const neighborId of connections) {
      const neighborNode = this.nodes.get(neighborId);
      if (neighborNode) {
        const dist = this.distance(node.vector, neighborNode.vector);
        neighbors.push({ id: neighborId, score: dist });
      }
    }
    
    // 保留最近的 M 个
    neighbors.sort((a, b) => a.score - b.score);
    const selected = neighbors.slice(0, this.config.maxConnections);
    
    // 更新连接
    const newConnections = new Set(selected.map((n) => n.id));
    node.connections.set(level, newConnections);
  }
  
  // ============================================================
  // 搜索
  // ============================================================
  
  search(query: number[], k: number = 10): SearchResult[] {
    if (!this.entryPoint || this.nodes.size === 0) {
      return [];
    }
    
    if (query.length !== this.config.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.config.dimensions}, got ${query.length}`);
    }
    
    // 从最高层开始贪婪搜索
    let current = this.entryPoint;
    
    for (let l = this.maxLevel; l > 0; l--) {
      current = this.greedySearch(current, query, l);
    }
    
    // 在第 0 层进行详细搜索
    const results = this.searchLayer(current, query, this.config.efSearch, 0);
    
    // 返回最近的 k 个
    return results.slice(0, k).map((r) => ({
      id: r.id,
      score: 1 - r.score,  // 转换为相似度
    }));
  }
  
  // ============================================================
  // 批量操作
  // ============================================================
  
  addBatch(items: Array<{ id: string; vector: number[] }>): void {
    for (const item of items) {
      this.add(item.id, item.vector);
    }
  }
  
  searchBatch(queries: number[][], k: number = 10): SearchResult[][] {
    return queries.map((q) => this.search(q, k));
  }
  
  // ============================================================
  // 持久化
  // ============================================================
  
  toJSON(): object {
    const nodesArray = Array.from(this.nodes.entries()).map(([id, node]) => ({
      id,
      vector: node.vector,
      level: node.level,
      connections: Array.from(node.connections.entries()).map(([l, neighbors]) => ({
        level: l,
        neighbors: Array.from(neighbors),
      })),
    }));
    
    return {
      config: this.config,
      nodes: nodesArray,
      entryPoint: this.entryPoint,
      maxLevel: this.maxLevel,
    };
  }
  
  static fromJSON(data: any): HNSWIndex {
    const index = new HNSWIndex(data.config);
    
    // 恢复节点
    for (const nodeData of data.nodes) {
      const node: HNSWNode = {
        id: nodeData.id,
        vector: nodeData.vector,
        level: nodeData.level,
        connections: new Map(),
      };
      
      for (const conn of nodeData.connections) {
        node.connections.set(conn.level, new Set(conn.neighbors));
      }
      
      index.nodes.set(nodeData.id, node);
    }
    
    index.entryPoint = data.entryPoint;
    index.maxLevel = data.maxLevel;
    
    return index;
  }
  
  // ============================================================
  // 统计
  // ============================================================
  
  size(): number {
    return this.nodes.size;
  }
  
  getStats(): {
    nodeCount: number;
    maxLevel: number;
    avgConnections: number;
    memoryUsage: number;
  } {
    let totalConnections = 0;
    
    for (const node of this.nodes.values()) {
      for (const neighbors of node.connections.values()) {
        totalConnections += neighbors.size;
      }
    }
    
    const avgConnections = this.nodes.size > 0 ? totalConnections / this.nodes.size : 0;
    
    // 估算内存使用
    const vectorSize = this.config.dimensions * 8; // 8 bytes per float
    const nodeSize = vectorSize + 100; // overhead
    const memoryUsage = this.nodes.size * nodeSize + totalConnections * 20;
    
    return {
      nodeCount: this.nodes.size,
      maxLevel: this.maxLevel,
      avgConnections,
      memoryUsage,
    };
  }
}

// ============================================================
// 导出
// ============================================================

export default HNSWIndex;
