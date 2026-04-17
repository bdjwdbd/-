/**
 * 双存储架构
 * 
 * 借鉴来源：Mem0
 * 
 * 核心功能：
 * - 向量存储：语义检索
 * - 图存储：实体关系管理
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata: {
    content: string;
    createdAt: number;
    updatedAt: number;
    source: string;
    tags: string[];
  };
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorRecord['metadata'];
}

export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  embedding?: number[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
  weight: number;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
}

// ============================================================================
// 向量存储
// ============================================================================

export class VectorStore {
  private records: Map<string, VectorRecord> = new Map();
  private dimension: number = 1536; // OpenAI embedding 维度

  /**
   * 存储向量
   */
  store(id: string, vector: number[], metadata: VectorRecord['metadata']): VectorRecord {
    const record: VectorRecord = {
      id,
      vector,
      metadata: {
        ...metadata,
        createdAt: metadata.createdAt || Date.now(),
        updatedAt: Date.now()
      }
    };

    this.records.set(id, record);
    return record;
  }

  /**
   * 获取向量
   */
  get(id: string): VectorRecord | undefined {
    return this.records.get(id);
  }

  /**
   * 语义搜索
   */
  search(queryVector: number[], topK: number = 10): VectorSearchResult[] {
    const results: VectorSearchResult[] = [];

    for (const record of this.records.values()) {
      const score = this.cosineSimilarity(queryVector, record.vector);
      results.push({
        id: record.id,
        score,
        metadata: record.metadata
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 删除向量
   */
  delete(id: string): boolean {
    return this.records.delete(id);
  }

  /**
   * 获取统计
   */
  getStats(): { count: number; dimension: number } {
    return {
      count: this.records.size,
      dimension: this.dimension
    };
  }
}

// ============================================================================
// 图存储
// ============================================================================

export class GraphStore {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // 邻接表
  private reverseAdjacencyList: Map<string, Set<string>> = new Map(); // 反向邻接表

  /**
   * 添加节点
   */
  addNode(node: GraphNode): GraphNode {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(node.id)) {
      this.reverseAdjacencyList.set(node.id, new Set());
    }
    return node;
  }

  /**
   * 获取节点
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * 添加边
   */
  addEdge(edge: GraphEdge): GraphEdge {
    this.edges.set(edge.id, edge);

    // 更新邻接表
    if (!this.adjacencyList.has(edge.source)) {
      this.adjacencyList.set(edge.source, new Set());
    }
    this.adjacencyList.get(edge.source)!.add(edge.target);

    // 更新反向邻接表
    if (!this.reverseAdjacencyList.has(edge.target)) {
      this.reverseAdjacencyList.set(edge.target, new Set());
    }
    this.reverseAdjacencyList.get(edge.target)!.add(edge.source);

    return edge;
  }

  /**
   * 获取边
   */
  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  /**
   * 获取出边
   */
  getOutEdges(nodeId: string): GraphEdge[] {
    const result: GraphEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId) {
        result.push(edge);
      }
    }
    return result;
  }

  /**
   * 获取入边
   */
  getInEdges(nodeId: string): GraphEdge[] {
    const result: GraphEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.target === nodeId) {
        result.push(edge);
      }
    }
    return result;
  }

  /**
   * 获取邻居
   */
  getNeighbors(nodeId: string, direction: 'out' | 'in' | 'both' = 'out'): GraphNode[] {
    const neighborIds = new Set<string>();

    if (direction === 'out' || direction === 'both') {
      const outNeighbors = this.adjacencyList.get(nodeId);
      if (outNeighbors) {
        for (const id of outNeighbors) {
          neighborIds.add(id);
        }
      }
    }

    if (direction === 'in' || direction === 'both') {
      const inNeighbors = this.reverseAdjacencyList.get(nodeId);
      if (inNeighbors) {
        for (const id of inNeighbors) {
          neighborIds.add(id);
        }
      }
    }

    return Array.from(neighborIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined);
  }

  /**
   * 图遍历（BFS）
   */
  traverse(startId: string, maxDepth: number = 3): GraphPath[] {
    const paths: GraphPath[] = [];
    const visited = new Set<string>();
    const queue: { nodeId: string; path: GraphPath }[] = [];

    const startNode = this.nodes.get(startId);
    if (!startNode) return paths;

    queue.push({
      nodeId: startId,
      path: { nodes: [startNode], edges: [], length: 0 }
    });
    visited.add(startId);

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (path.length >= maxDepth) continue;

      const outEdges = this.getOutEdges(nodeId);
      for (const edge of outEdges) {
        if (visited.has(edge.target)) continue;

        const targetNode = this.nodes.get(edge.target);
        if (!targetNode) continue;

        visited.add(edge.target);
        const newPath: GraphPath = {
          nodes: [...path.nodes, targetNode],
          edges: [...path.edges, edge],
          length: path.length + 1
        };

        paths.push(newPath);
        queue.push({ nodeId: edge.target, path: newPath });
      }
    }

    return paths;
  }

  /**
   * 查找路径（Dijkstra）
   */
  findPath(startId: string, endId: string): GraphPath | null {
    const distances = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; edge: GraphEdge }>();
    const visited = new Set<string>();

    // 初始化
    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
    }
    distances.set(startId, 0);

    while (visited.size < this.nodes.size) {
      // 找最小距离节点
      let minNode: string | null = null;
      let minDist = Infinity;
      for (const [nodeId, dist] of distances) {
        if (!visited.has(nodeId) && dist < minDist) {
          minDist = dist;
          minNode = nodeId;
        }
      }

      if (minNode === null || minNode === endId) break;
      visited.add(minNode);

      // 更新邻居距离
      const outEdges = this.getOutEdges(minNode);
      for (const edge of outEdges) {
        const newDist = distances.get(minNode)! + (1 / edge.weight);
        if (newDist < distances.get(edge.target)!) {
          distances.set(edge.target, newDist);
          previous.set(edge.target, { nodeId: minNode, edge });
        }
      }
    }

    // 重建路径
    if (distances.get(endId) === Infinity) return null;

    const path: GraphPath = { nodes: [], edges: [], length: 0 };
    let current = endId;

    while (current !== startId) {
      const prev = previous.get(current);
      if (!prev) return null;

      const node = this.nodes.get(current);
      if (node) path.nodes.unshift(node);
      path.edges.unshift(prev.edge);
      current = prev.nodeId;
    }

    const startNode = this.nodes.get(startId);
    if (startNode) path.nodes.unshift(startNode);
    path.length = path.edges.length;

    return path;
  }

  /**
   * 删除节点
   */
  deleteNode(id: string): boolean {
    if (!this.nodes.has(id)) return false;

    // 删除相关边
    const outEdges = this.getOutEdges(id);
    const inEdges = this.getInEdges(id);
    for (const edge of [...outEdges, ...inEdges]) {
      this.edges.delete(edge.id);
    }

    // 删除邻接表条目
    this.adjacencyList.delete(id);
    this.reverseAdjacencyList.delete(id);

    // 删除节点
    this.nodes.delete(id);
    return true;
  }

  /**
   * 获取统计
   */
  getStats(): { nodeCount: number; edgeCount: number } {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size
    };
  }
}

// ============================================================================
// 双存储架构主类
// ============================================================================

export class DualStorage {
  private vectorStore: VectorStore;
  private graphStore: GraphStore;

  constructor() {
    this.vectorStore = new VectorStore();
    this.graphStore = new GraphStore();
  }

  /**
   * 存储记忆
   */
  storeMemory(
    id: string,
    content: string,
    embedding: number[],
    entities?: { name: string; type: string }[],
    relations?: { source: string; target: string; type: string }[]
  ): void {
    // 存储到向量库
    this.vectorStore.store(id, embedding, {
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'memory',
      tags: []
    });

    // 存储实体到图
    if (entities) {
      for (const entity of entities) {
        this.graphStore.addNode({
          id: `entity-${entity.name}`,
          type: entity.type,
          properties: { name: entity.name }
        });
      }
    }

    // 存储关系到图
    if (relations) {
      for (const relation of relations) {
        this.graphStore.addEdge({
          id: `relation-${relation.source}-${relation.type}-${relation.target}`,
          source: `entity-${relation.source}`,
          target: `entity-${relation.target}`,
          type: relation.type,
          properties: {},
          weight: 1
        });
      }
    }
  }

  /**
   * 语义搜索
   */
  semanticSearch(queryVector: number[], topK: number = 10): VectorSearchResult[] {
    return this.vectorStore.search(queryVector, topK);
  }

  /**
   * 图遍历
   */
  graphTraverse(startEntity: string, maxDepth: number = 3): GraphPath[] {
    return this.graphStore.traverse(`entity-${startEntity}`, maxDepth);
  }

  /**
   * 查找关系路径
   */
  findRelationPath(startEntity: string, endEntity: string): GraphPath | null {
    return this.graphStore.findPath(`entity-${startEntity}`, `entity-${endEntity}`);
  }

  /**
   * 获取向量存储
   */
  getVectorStore(): VectorStore {
    return this.vectorStore;
  }

  /**
   * 获取图存储
   */
  getGraphStore(): GraphStore {
    return this.graphStore;
  }

  /**
   * 获取统计
   */
  getStats(): {
    vector: { count: number; dimension: number };
    graph: { nodeCount: number; edgeCount: number };
  } {
    return {
      vector: this.vectorStore.getStats(),
      graph: this.graphStore.getStats()
    };
  }
}

// 默认导出
export default DualStorage;
