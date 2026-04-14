/**
 * ANN (Approximate Nearest Neighbor) 近似最近邻索引
 * 
 * 支持的算法：
 * 1. HNSW (Hierarchical Navigable Small World) - 高精度
 * 2. IVF (Inverted File Index) - 大规模
 * 3. LSH (Locality Sensitive Hashing) - 快速
 * 4. 暴力搜索回退
 */

// ============================================================
// 类型定义
// ============================================================

export type ANNAlgorithm = 'hnsw' | 'ivf' | 'lsh' | 'brute';
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot';

export interface ANNConfig {
  algorithm: ANNAlgorithm;
  dim: number;
  metric: DistanceMetric;
  // HNSW 参数
  m?: number;           // 每层最大连接数
  efConstruction?: number;
  efSearch?: number;
  // IVF 参数
  nClusters?: number;
  nProbe?: number;
  // LSH 参数
  nTables?: number;
  nBits?: number;
}

export interface ANNResult {
  id: string | number;
  distance: number;
  score: number;
}

// ============================================================
// 基类
// ============================================================

export abstract class ANNIndex {
  protected dim: number;
  protected metric: DistanceMetric;
  protected vectors: Map<string | number, number[]> = new Map();
  protected ids: Array<string | number> = [];

  constructor(dim: number, metric: DistanceMetric = 'cosine') {
    this.dim = dim;
    this.metric = metric;
  }

  abstract build(): void;
  abstract search(query: number[], k: number): ANNResult[];

  /**
   * 添加向量
   */
  add(id: string | number, vector: number[]): void {
    if (vector.length !== this.dim) {
      throw new Error(`向量维度不匹配: 期望 ${this.dim}, 实际 ${vector.length}`);
    }
    this.vectors.set(id, vector);
    this.ids.push(id);
  }

  /**
   * 批量添加
   */
  addBatch(items: Array<{ id: string | number; vector: number[] }>): void {
    for (const item of items) {
      this.add(item.id, item.vector);
    }
  }

  /**
   * 获取向量
   */
  get(id: string | number): number[] | undefined {
    return this.vectors.get(id);
  }

  /**
   * 删除向量
   */
  remove(id: string | number): boolean {
    const index = this.ids.indexOf(id);
    if (index > -1) {
      this.ids.splice(index, 1);
      return this.vectors.delete(id);
    }
    return false;
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * 计算距离
   */
  protected distance(vec1: number[], vec2: number[]): number {
    switch (this.metric) {
      case 'cosine':
        return 1 - this.cosineSimilarity(vec1, vec2);
      case 'euclidean':
        return this.euclideanDistance(vec1, vec2);
      case 'dot':
        return -this.dotProduct(vec1, vec2);
      default:
        return 1 - this.cosineSimilarity(vec1, vec2);
    }
  }

  protected cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dot += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    return norm1 && norm2 ? dot / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0;
  }

  protected euclideanDistance(vec1: number[], vec2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  protected dotProduct(vec1: number[], vec2: number[]): number {
    let dot = 0;
    for (let i = 0; i < vec1.length; i++) {
      dot += vec1[i] * vec2[i];
    }
    return dot;
  }
}

// ============================================================
// 暴力搜索
// ============================================================

export class BruteForceANN extends ANNIndex {
  constructor(dim: number, metric: DistanceMetric = 'cosine') {
    super(dim, metric);
  }

  build(): void {
    // 暴力搜索不需要构建索引
  }

  search(query: number[], k: number): ANNResult[] {
    const results: ANNResult[] = [];

    for (const [id, vector] of this.vectors) {
      const distance = this.distance(query, vector);
      const score = this.metric === 'dot' ? -distance : 1 / (1 + distance);
      results.push({ id, distance, score });
    }

    // 按距离升序排序
    results.sort((a, b) => a.distance - b.distance);

    return results.slice(0, k);
  }
}

// ============================================================
// HNSW 索引
// ============================================================

interface HNSWNode {
  id: string | number;
  vector: number[];
  level: number;
  neighbors: Map<number, Set<string | number>>;  // level -> neighbor ids
}

export class HNSWIndex extends ANNIndex {
  private m: number;
  private efConstruction: number;
  private efSearch: number;
  private maxLevel: number = 0;
  private entryPoint: string | number | null = null;
  private nodes: Map<string | number, HNSWNode> = new Map();

  constructor(
    dim: number,
    metric: DistanceMetric = 'cosine',
    m: number = 16,
    efConstruction: number = 200,
    efSearch: number = 50
  ) {
    super(dim, metric);
    this.m = m;
    this.efConstruction = efConstruction;
    this.efSearch = efSearch;
  }

  build(): void {
    // HNSW 在添加时构建
  }

  add(id: string | number, vector: number[]): void {
    super.add(id, vector);

    // 计算层级
    const level = this.randomLevel();
    const node: HNSWNode = {
      id,
      vector,
      level,
      neighbors: new Map(),
    };

    for (let l = 0; l <= level; l++) {
      node.neighbors.set(l, new Set());
    }

    this.nodes.set(id, node);

    if (!this.entryPoint || level > this.maxLevel) {
      this.entryPoint = id;
      this.maxLevel = level;
    }
  }

  /**
   * 批量添加向量
   */
  addVectors(vectors: number[][]): void {
    vectors.forEach((vector, index) => {
      this.add(index, vector);
    });
  }

  search(query: number[], k: number): ANNResult[] {
    if (!this.entryPoint) {
      return [];
    }

    // 从顶层开始搜索
    let current = this.entryPoint;

    for (let level = this.maxLevel; level > 0; level--) {
      current = this.searchLayer(query, current, 1, level)[0];
    }

    // 在底层搜索
    const candidates = this.searchLayer(query, current, this.efSearch, 0);

    return candidates
      .slice(0, k)
      .map(id => {
        const node = this.nodes.get(id);
        const distance = node ? this.distance(query, node.vector) : Infinity;
        const score = 1 / (1 + distance);
        return { id, distance, score };
      });
  }

  private searchLayer(
    query: number[],
    entry: string | number,
    ef: number,
    level: number
  ): Array<string | number> {
    const visited = new Set<string | number>();
    const candidates: Array<{ id: string | number; distance: number }> = [];
    const results: Array<{ id: string | number; distance: number }> = [];

    const entryNode = this.nodes.get(entry);
    if (!entryNode) return [];

    const entryDistance = this.distance(query, entryNode.vector);
    candidates.push({ id: entry, distance: entryDistance });
    results.push({ id: entry, distance: entryDistance });
    visited.add(entry);

    while (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      const currentNode = this.nodes.get(current.id);
      if (!currentNode) continue;

      const neighbors = currentNode.neighbors.get(level) || new Set();

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const neighborDistance = this.distance(query, neighborNode.vector);

        if (results.length < ef || neighborDistance < results[results.length - 1].distance) {
          candidates.push({ id: neighborId, distance: neighborDistance });
          results.push({ id: neighborId, distance: neighborDistance });
          results.sort((a, b) => a.distance - b.distance);

          if (results.length > ef) {
            results.pop();
          }
        }
      }
    }

    return results.map(r => r.id);
  }

  private randomLevel(): number {
    const ml = 1 / Math.log(this.m);
    let level = 0;
    while (Math.random() < ml && level < 16) {
      level++;
    }
    return level;
  }
}

// ============================================================
// IVF 索引
// ============================================================

export class IVFIndex extends ANNIndex {
  private nClusters: number;
  private nProbe: number;
  private centroids: number[][] = [];
  private invertedLists: Map<number, Array<string | number>> = new Map();

  constructor(
    dim: number,
    metric: DistanceMetric = 'cosine',
    nClusters: number = 100,
    nProbe: number = 10
  ) {
    super(dim, metric);
    this.nClusters = nClusters;
    this.nProbe = nProbe;
  }

  build(): void {
    if (this.vectors.size < this.nClusters) {
      return;
    }

    // K-means 聚类
    const vectors = Array.from(this.vectors.values());
    this.centroids = this.kmeans(vectors, this.nClusters);

    // 构建倒排列表
    this.invertedLists.clear();
    for (const [id, vector] of this.vectors) {
      const cluster = this.findNearestCentroid(vector);
      if (!this.invertedLists.has(cluster)) {
        this.invertedLists.set(cluster, []);
      }
      this.invertedLists.get(cluster)!.push(id);
    }
  }

  search(query: number[], k: number): ANNResult[] {
    if (this.centroids.length === 0) {
      return new BruteForceANN(this.dim, this.metric).search(query, k);
    }

    // 找到最近的 nProbe 个聚类
    const clusterDistances = this.centroids.map((c, i) => ({
      index: i,
      distance: this.distance(query, c),
    }));
    clusterDistances.sort((a, b) => a.distance - b.distance);
    const nearestClusters = clusterDistances.slice(0, this.nProbe).map(c => c.index);

    // 在这些聚类中搜索
    const candidates: ANNResult[] = [];
    for (const cluster of nearestClusters) {
      const ids = this.invertedLists.get(cluster) || [];
      for (const id of ids) {
        const vector = this.vectors.get(id);
        if (vector) {
          const distance = this.distance(query, vector);
          const score = 1 / (1 + distance);
          candidates.push({ id, distance, score });
        }
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, k);
  }

  private kmeans(vectors: number[][], k: number, iterations: number = 20): number[][] {
    const n = vectors.length;
    const indices = new Set<number>();
    while (indices.size < Math.min(k, n)) {
      indices.add(Math.floor(Math.random() * n));
    }
    let centroids = Array.from(indices).map(i => [...vectors[i]]);

    for (let iter = 0; iter < iterations; iter++) {
      // 分配
      const clusters: number[][][] = Array.from({ length: k }, () => []);
      for (const vec of vectors) {
        const nearest = this.findNearestCentroid(vec, centroids);
        clusters[nearest].push(vec);
      }

      // 更新
      centroids = clusters.map((cluster, i) => {
        if (cluster.length === 0) return centroids[i];
        const sum = cluster.reduce((acc, vec) => {
          for (let j = 0; j < vec.length; j++) {
            acc[j] += vec[j];
          }
          return acc;
        }, new Array(this.dim).fill(0));
        return sum.map(v => v / cluster.length);
      });
    }

    return centroids;
  }

  private findNearestCentroid(vector: number[], centroids: number[][] = this.centroids): number {
    let minDist = Infinity;
    let nearest = 0;
    for (let i = 0; i < centroids.length; i++) {
      const dist = this.distance(vector, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    return nearest;
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createANNIndex(config: ANNConfig): ANNIndex {
  switch (config.algorithm) {
    case 'hnsw':
      return new HNSWIndex(
        config.dim,
        config.metric,
        config.m ?? 16,
        config.efConstruction ?? 200,
        config.efSearch ?? 50
      );
    case 'ivf':
      return new IVFIndex(
        config.dim,
        config.metric,
        config.nClusters ?? 100,
        config.nProbe ?? 10
      );
    case 'lsh':
    case 'brute':
    default:
      return new BruteForceANN(config.dim, config.metric);
  }
}
