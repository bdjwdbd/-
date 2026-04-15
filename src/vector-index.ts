/**
 * 向量索引优化 - HNSW (Hierarchical Navigable Small World)
 * 
 * 功能：
 * 1. 高效近似最近邻搜索
 * 2. 支持大规模向量检索
 * 3. 增量构建索引
 * 4. 持久化存储
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface VectorEntry {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

interface SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface HNSWConfig {
  dimensions: number;
  maxConnections: number;      // M: 每层最大连接数
  maxLevelConnections: number; // M0: 第0层最大连接数
  efConstruction: number;      // 构建时的候选列表大小
  efSearch: number;            // 搜索时的候选列表大小
  maxLevel: number;            // 最大层数
  levelMultiplier: number;     // 层级乘数（通常 1/ln(M)）
}

interface HNSWNode {
  id: string;
  vector: number[];
  level: number;
  connections: Map<number, Set<string>>; // level -> neighbor ids
  metadata?: Record<string, unknown>;
}

interface IndexStats {
  totalNodes: number;
  maxLevel: number;
  avgConnections: number;
  memoryUsage: number;
}

// ============================================================
// 向量工具函数
// ============================================================

class VectorUtils {
  /**
   * 计算余弦相似度
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("向量维度不匹配");
    }
    
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
   * 计算欧氏距离
   */
  static euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("向量维度不匹配");
    }
    
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    
    return Math.sqrt(sum);
  }
  
  /**
   * 归一化向量
   */
  static normalize(vector: number[]): number[] {
    let norm = 0;
    for (const v of vector) {
      norm += v * v;
    }
    norm = Math.sqrt(norm);
    
    if (norm === 0) return vector;
    
    return vector.map(v => v / norm);
  }
  
  /**
   * 随机生成层级
   */
  static randomLevel(multiplier: number, maxLevel: number): number {
    const r = Math.random();
    let level = 0;
    while (r < Math.pow(multiplier, level + 1) && level < maxLevel) {
      level++;
    }
    return level;
  }
}

// ============================================================
// HNSW 索引
// ============================================================

export class HNSWIndex {
  private config: HNSWConfig;
  private nodes: Map<string, HNSWNode> = new Map();
  private entryPoint: string | null = null;
  private maxLevel: number = 0;
  
  constructor(config?: Partial<HNSWConfig>) {
    this.config = {
      dimensions: 4096,
      maxConnections: 16,
      maxLevelConnections: 32,
      efConstruction: 200,
      efSearch: 50,
      maxLevel: 16,
      levelMultiplier: 1 / Math.log(16),
      ...config,
    };
  }
  
  /**
   * 添加向量到索引
   */
  add(id: string, vector: number[], metadata?: Record<string, unknown>): void {
    // 检查是否已存在
    if (this.nodes.has(id)) {
      this.nodes.get(id)!.vector = vector;
      this.nodes.get(id)!.metadata = metadata;
      return;
    }
    
    // 计算节点层级
    const level = VectorUtils.randomLevel(
      this.config.levelMultiplier,
      this.config.maxLevel
    );
    
    // 创建节点
    const node: HNSWNode = {
      id,
      vector,
      level,
      connections: new Map(),
      metadata,
    };
    
    // 初始化连接
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, new Set());
    }
    
    this.nodes.set(id, node);
    
    // 如果是第一个节点，设为入口点
    if (this.entryPoint === null) {
      this.entryPoint = id;
      this.maxLevel = level;
      return;
    }
    
    // 插入到索引中
    this.insertNode(node);
    
    // 更新入口点（如果新节点层级更高）
    if (level > this.maxLevel) {
      this.entryPoint = id;
      this.maxLevel = level;
    }
  }
  
  /**
   * 批量添加
   */
  addBatch(items: Array<{ id: string; vector: number[]; metadata?: any }>): void {
    for (const item of items) {
      this.add(item.id, item.vector, item.metadata);
    }
  }
  
  /**
   * 搜索最相似的向量
   */
  search(query: number[], topK: number = 10): SearchResult[] {
    if (this.entryPoint === null || this.nodes.size === 0) {
      return [];
    }
    
    const ef = Math.max(topK, this.config.efSearch);
    const visited = new Set<string>();
    const candidates: Array<{ id: string; distance: number }> = [];
    const results: Array<{ id: string; distance: number }> = [];
    
    // 从入口点开始
    let currentId = this.entryPoint;
    let currentDistance = -VectorUtils.cosineSimilarity(
      query,
      this.nodes.get(currentId)!.vector
    );
    
    // 从最高层向下搜索
    for (let level = this.maxLevel; level > 0; level--) {
      let changed = true;
      
      while (changed) {
        changed = false;
        const node = this.nodes.get(currentId);
        if (!node) break;
        
        const neighbors = node.connections.get(level) || new Set();
        
        for (const neighborId of neighbors) {
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);
          
          const neighbor = this.nodes.get(neighborId);
          if (!neighbor) continue;
          
          const distance = -VectorUtils.cosineSimilarity(query, neighbor.vector);
          
          if (distance < currentDistance) {
            currentId = neighborId;
            currentDistance = distance;
            changed = true;
          }
        }
      }
    }
    
    // 在第0层进行详细搜索
    const ep = this.nodes.get(currentId);
    if (ep) {
      candidates.push({ id: currentId, distance: currentDistance });
      visited.add(currentId);
    }
    
    while (candidates.length > 0 && results.length < ef) {
      // 取出距离最小的候选
      candidates.sort((a, b) => a.distance - b.distance);
      const nearest = candidates.shift()!;
      
      results.push(nearest);
      
      // 扩展邻居
      const node = this.nodes.get(nearest.id);
      if (!node) continue;
      
      const neighbors = node.connections.get(0) || new Set();
      
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;
        
        const distance = -VectorUtils.cosineSimilarity(query, neighbor.vector);
        
        if (results.length < ef || distance < results[results.length - 1].distance) {
          candidates.push({ id: neighborId, distance });
        }
      }
    }
    
    // 返回 topK 结果
    return results
      .slice(0, topK)
      .map(r => ({
        id: r.id,
        score: -r.distance,
        metadata: this.nodes.get(r.id)?.metadata,
      }));
  }
  
  /**
   * 删除向量
   */
  delete(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;
    
    // 从其他节点的连接中移除
    for (const [level, neighbors] of node.connections) {
      for (const neighborId of neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (neighbor) {
          neighbor.connections.get(level)?.delete(id);
        }
      }
    }
    
    this.nodes.delete(id);
    
    // 如果删除的是入口点，选择新的入口点
    if (this.entryPoint === id) {
      this.entryPoint = this.nodes.keys().next().value || null;
      this.maxLevel = this.entryPoint 
        ? this.nodes.get(this.entryPoint)!.level 
        : 0;
    }
    
    return true;
  }
  
  /**
   * 获取向量
   */
  get(id: string): VectorEntry | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;
    
    return {
      id: node.id,
      vector: node.vector,
      metadata: node.metadata,
      createdAt: new Date(),
    };
  }
  
  /**
   * 获取统计信息
   */
  getStats(): IndexStats {
    let totalConnections = 0;
    
    for (const node of this.nodes.values()) {
      for (const neighbors of node.connections.values()) {
        totalConnections += neighbors.size;
      }
    }
    
    const avgConnections = this.nodes.size > 0 
      ? totalConnections / this.nodes.size 
      : 0;
    
    // 估算内存使用
    const vectorSize = this.config.dimensions * 8; // 8 bytes per float64
    const memoryUsage = this.nodes.size * (vectorSize + 100); // 100 bytes overhead
    
    return {
      totalNodes: this.nodes.size,
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
  }
  
  /**
   * 保存到文件
   */
  save(filePath: string): void {
    const data = {
      config: this.config,
      entryPoint: this.entryPoint,
      maxLevel: this.maxLevel,
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        vector: node.vector,
        level: node.level,
        connections: Array.from(node.connections.entries()).map(([l, neighbors]) => ({
          level: l,
          neighbors: Array.from(neighbors),
        })),
        metadata: node.metadata,
      })),
    };
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data));
  }
  
  /**
   * 从文件加载
   */
  load(filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    this.config = data.config;
    this.entryPoint = data.entryPoint;
    this.maxLevel = data.maxLevel;
    
    this.nodes.clear();
    
    for (const nodeData of data.nodes) {
      const node: HNSWNode = {
        id: nodeData.id,
        vector: nodeData.vector,
        level: nodeData.level,
        connections: new Map(),
        metadata: nodeData.metadata,
      };
      
      for (const conn of nodeData.connections) {
        node.connections.set(conn.level, new Set(conn.neighbors));
      }
      
      this.nodes.set(node.id, node);
    }
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private insertNode(node: HNSWNode): void {
    if (this.entryPoint === null) return;
    
    const query = node.vector;
    let entryId = this.entryPoint;
    
    // 从最高层向下搜索插入点
    for (let level = this.maxLevel; level > node.level; level--) {
      const nearest = this.searchLayer(query, entryId, level, 1);
      if (nearest.length > 0) {
        entryId = nearest[0].id;
      }
    }
    
    // 在每一层插入连接
    for (let level = Math.min(node.level, this.maxLevel); level >= 0; level--) {
      const nearest = this.searchLayer(query, entryId, level, this.config.efConstruction);
      
      // 选择最近的邻居
      const maxConn = level === 0 
        ? this.config.maxLevelConnections 
        : this.config.maxConnections;
      
      const neighbors = nearest.slice(0, maxConn);
      
      // 建立双向连接
      for (const neighbor of neighbors) {
        node.connections.get(level)?.add(neighbor.id);
        
        const neighborNode = this.nodes.get(neighbor.id);
        if (neighborNode) {
          neighborNode.connections.get(level)?.add(node.id);
          
          // 如果邻居连接数超限，进行剪枝
          const connCount = neighborNode.connections.get(level)?.size || 0;
          if (connCount > maxConn) {
            this.pruneConnections(neighborNode, level, maxConn);
          }
        }
      }
      
      if (nearest.length > 0) {
        entryId = nearest[0].id;
      }
    }
  }
  
  private searchLayer(
    query: number[],
    entryId: string,
    level: number,
    ef: number
  ): Array<{ id: string; distance: number }> {
    const visited = new Set<string>([entryId]);
    const candidates: Array<{ id: string; distance: number }> = [];
    const results: Array<{ id: string; distance: number }> = [];
    
    const entryNode = this.nodes.get(entryId);
    if (!entryNode) return [];
    
    const entryDistance = -VectorUtils.cosineSimilarity(query, entryNode.vector);
    candidates.push({ id: entryId, distance: entryDistance });
    results.push({ id: entryId, distance: entryDistance });
    
    while (candidates.length > 0) {
      // 取出距离最小的候选
      candidates.sort((a, b) => a.distance - b.distance);
      const nearest = candidates.shift()!;
      
      // 取出结果中距离最大的
      results.sort((a, b) => b.distance - a.distance);
      const furthest = results[results.length - 1];
      
      if (nearest.distance > furthest.distance) {
        break;
      }
      
      // 扩展邻居
      const node = this.nodes.get(nearest.id);
      if (!node) continue;
      
      const neighbors = node.connections.get(level) || new Set();
      
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;
        
        const distance = -VectorUtils.cosineSimilarity(query, neighbor.vector);
        
        if (distance < furthest.distance || results.length < ef) {
          candidates.push({ id: neighborId, distance });
          results.push({ id: neighborId, distance });
          
          if (results.length > ef) {
            results.sort((a, b) => a.distance - b.distance);
            results.pop();
          }
        }
      }
    }
    
    results.sort((a, b) => a.distance - b.distance);
    return results;
  }
  
  private pruneConnections(node: HNSWNode, level: number, maxConn: number): void {
    const neighbors = node.connections.get(level);
    if (!neighbors || neighbors.size <= maxConn) return;
    
    // 简单策略：保留最近的邻居
    const neighborList = Array.from(neighbors);
    const distances: Array<{ id: string; distance: number }> = [];
    
    for (const neighborId of neighborList) {
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        const distance = -VectorUtils.cosineSimilarity(node.vector, neighbor.vector);
        distances.push({ id: neighborId, distance });
      }
    }
    
    distances.sort((a, b) => a.distance - b.distance);
    
    // 保留最近的 maxConn 个
    const toKeep = new Set(distances.slice(0, maxConn).map(d => d.id));
    
    for (const neighborId of neighborList) {
      if (!toKeep.has(neighborId)) {
        neighbors.delete(neighborId);
        
        // 同时从对方的连接中移除
        const neighbor = this.nodes.get(neighborId);
        neighbor?.connections.get(level)?.delete(node.id);
      }
    }
  }
}

// ============================================================
// 混合索引（HNSW + 线性搜索）
// ============================================================

export class HybridVectorIndex {
  private hnsw: HNSWIndex;
  private linearIndex: Map<string, VectorEntry> = new Map();
  private useHNSW: boolean = true;
  private threshold: number = 1000; // 超过此数量使用 HNSW
  
  constructor(config?: Partial<HNSWConfig>) {
    this.hnsw = new HNSWIndex(config);
  }
  
  add(id: string, vector: number[], metadata?: any): void {
    this.linearIndex.set(id, { id, vector, metadata, createdAt: new Date() });
    
    if (this.useHNSW) {
      this.hnsw.add(id, vector, metadata);
    } else if (this.linearIndex.size > this.threshold) {
      // 达到阈值，切换到 HNSW
      this.switchToHNSW();
    }
  }
  
  search(query: number[], topK: number = 10): SearchResult[] {
    if (this.useHNSW && this.linearIndex.size > this.threshold) {
      return this.hnsw.search(query, topK);
    }
    
    // 线性搜索
    const results: SearchResult[] = [];
    
    for (const [id, entry] of this.linearIndex) {
      const score = VectorUtils.cosineSimilarity(query, entry.vector);
      results.push({ id, score, metadata: entry.metadata });
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
  
  delete(id: string): boolean {
    if (this.useHNSW) {
      this.hnsw.delete(id);
    }
    return this.linearIndex.delete(id);
  }
  
  get(id: string): VectorEntry | undefined {
    return this.linearIndex.get(id);
  }
  
  size(): number {
    return this.linearIndex.size;
  }
  
  clear(): void {
    this.hnsw.clear();
    this.linearIndex.clear();
  }
  
  private switchToHNSW(): void {
    console.log(`切换到 HNSW 索引 (${this.linearIndex.size} 条目)`);
    
    for (const [id, entry] of this.linearIndex) {
      this.hnsw.add(id, entry.vector, entry.metadata);
    }
    
    this.useHNSW = true;
  }
  
  getStats(): IndexStats & { indexType: string } {
    const hnswStats = this.hnsw.getStats();
    return {
      ...hnswStats,
      indexType: this.useHNSW ? "HNSW" : "Linear",
    };
  }
}

// ============================================================
// 性能测试
// ============================================================

function benchmark() {
  console.log("=".repeat(60));
  console.log("向量索引性能测试");
  console.log("=".repeat(60));
  
  const dimensions = 128;
  const numVectors = 5000;
  const topK = 10;
  
  // 生成测试数据
  const vectors: Array<{ id: string; vector: number[] }> = [];
  for (let i = 0; i < numVectors; i++) {
    vectors.push({
      id: `vec-${i}`,
      vector: Array.from({ length: dimensions }, () => Math.random() * 2 - 1),
    });
  }
  
  const query = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
  
  // 测试线性搜索
  console.log("\n--- 线性搜索 ---");
  const linearStart = Date.now();
  const linearIndex = new Map<string, number[]>();
  
  for (const v of vectors) {
    linearIndex.set(v.id, v.vector);
  }
  
  const linearSearchStart = Date.now();
  const linearResults: Array<{ id: string; score: number }> = [];
  
  for (const [id, vec] of linearIndex) {
    const score = VectorUtils.cosineSimilarity(query, vec);
    linearResults.push({ id, score });
  }
  linearResults.sort((a, b) => b.score - a.score);
  const linearTopK = linearResults.slice(0, topK);
  
  const linearEnd = Date.now();
  
  console.log(`构建时间: ${linearSearchStart - linearStart}ms`);
  console.log(`搜索时间: ${linearEnd - linearSearchStart}ms`);
  console.log(`总时间: ${linearEnd - linearStart}ms`);
  
  // 测试 HNSW
  console.log("\n--- HNSW 索引 ---");
  const hnsw = new HNSWIndex({ dimensions, maxConnections: 16, efSearch: 50 });
  
  const hnswBuildStart = Date.now();
  for (const v of vectors) {
    hnsw.add(v.id, v.vector);
  }
  const hnswBuildEnd = Date.now();
  
  const hnswSearchStart = Date.now();
  const hnswResults = hnsw.search(query, topK);
  const hnswSearchEnd = Date.now();
  
  console.log(`构建时间: ${hnswBuildEnd - hnswBuildStart}ms`);
  console.log(`搜索时间: ${hnswSearchEnd - hnswSearchStart}ms`);
  console.log(`总时间: ${hnswSearchEnd - hnswBuildStart}ms`);
  
  // 统计信息
  const stats = hnsw.getStats();
  console.log(`\n--- HNSW 统计 ---`);
  console.log(`节点数: ${stats.totalNodes}`);
  console.log(`最大层级: ${stats.maxLevel}`);
  console.log(`平均连接数: ${stats.avgConnections.toFixed(2)}`);
  console.log(`内存使用: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
  
  // 结果对比
  console.log(`\n--- 结果对比 ---`);
  console.log(`线性搜索 Top-1: ${linearTopK[0]?.id} (${linearTopK[0]?.score.toFixed(4)})`);
  console.log(`HNSW 搜索 Top-1: ${hnswResults[0]?.id} (${hnswResults[0]?.score.toFixed(4)})`);
  
  // 计算召回率
  const linearIds = new Set(linearTopK.map(r => r.id));
  const hnswIds = new Set(hnswResults.map(r => r.id));
  const overlap = [...linearIds].filter(id => hnswIds.has(id)).length;
  const recall = overlap / topK;
  
  console.log(`召回率: ${(recall * 100).toFixed(1)}%`);
  
  // 加速比
  const speedup = (linearEnd - linearSearchStart) / (hnswSearchEnd - hnswSearchStart);
  console.log(`搜索加速: ${speedup.toFixed(1)}x`);
  
  console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  benchmark();
}
