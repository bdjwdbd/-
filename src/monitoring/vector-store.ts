/**
 * 向量数据库集成模块
 * 
 * 功能：
 * 1. 向量存储与检索
 * 2. FAISS 索引管理
 * 3. 语义相似度搜索
 * 4. 记忆持久化
 */

// ============================================================
// 类型定义
// ============================================================

interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  timestamp: number;
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface VectorStoreConfig {
  dimensions: number;
  maxDocuments: number;
  similarityThreshold: number;
  indexType: 'flat' | 'ivf' | 'hnsw';
}

// ============================================================
// 向量存储
// ============================================================

export class VectorStore {
  private documents: Map<string, VectorDocument> = new Map();
  private index: number[][] = [];
  private config: VectorStoreConfig;
  private idCounter: number = 0;

  constructor(config?: Partial<VectorStoreConfig>) {
    this.config = {
      dimensions: 1536,
      maxDocuments: 10000,
      similarityThreshold: 0.7,
      indexType: 'flat',
      ...config,
    };
  }

  /**
   * 添加文档
   */
  addDocument(id: string, content: string, embedding: number[], metadata?: Record<string, unknown>): void {
    if (embedding.length !== this.config.dimensions) {
      throw new Error(`Embedding dimension mismatch: expected ${this.config.dimensions}, got ${embedding.length}`);
    }

    const doc: VectorDocument = {
      id,
      content,
      embedding,
      metadata: metadata || {},
      timestamp: Date.now(),
    };

    this.documents.set(id, doc);
    this.index.push(embedding);
    this.idCounter++;

    // 检查容量
    if (this.documents.size > this.config.maxDocuments) {
      this.evictOldest();
    }
  }

  /**
   * 批量添加文档
   */
  addBatch(documents: Array<{ id: string; content: string; embedding: number[]; metadata?: Record<string, unknown> }>): void {
    for (const doc of documents) {
      this.addDocument(doc.id, doc.content, doc.embedding, doc.metadata);
    }
  }

  /**
   * 搜索相似文档
   */
  search(queryEmbedding: number[], topK: number = 10): SearchResult[] {
    if (queryEmbedding.length !== this.config.dimensions) {
      throw new Error(`Query embedding dimension mismatch`);
    }

    const results: SearchResult[] = [];

    for (const [id, doc] of this.documents) {
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      
      if (score >= this.config.similarityThreshold) {
        results.push({
          id,
          content: doc.content,
          score,
          metadata: doc.metadata,
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * 余弦相似度计算
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
   * 欧几里得距离
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * 淘汰最旧文档
   */
  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [id, doc] of this.documents) {
      if (doc.timestamp < oldestTime) {
        oldestTime = doc.timestamp;
        oldest = id;
      }
    }

    if (oldest) {
      this.documents.delete(oldest);
      this.index = this.index.filter((_, i) => i !== parseInt(oldest!));
    }
  }

  /**
   * 获取文档
   */
  getDocument(id: string): VectorDocument | null {
    return this.documents.get(id) || null;
  }

  /**
   * 删除文档
   */
  deleteDocument(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.documents.clear();
    this.index = [];
    this.idCounter = 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): { totalDocuments: number; dimensions: number; indexSize: number } {
    return {
      totalDocuments: this.documents.size,
      dimensions: this.config.dimensions,
      indexSize: this.index.length,
    };
  }
}

// ============================================================
// FAISS 风格索引（简化实现）
// ============================================================

export class FAISSIndex {
  private vectors: number[][] = [];
  private ids: string[] = [];
  private dimensions: number;
  private nlist: number; // 聚类中心数量
  private centroids: number[][] = [];

  constructor(dimensions: number = 1536, nlist: number = 100) {
    this.dimensions = dimensions;
    this.nlist = nlist;
  }

  /**
   * 添加向量
   */
  add(id: string, vector: number[]): void {
    if (vector.length !== this.dimensions) {
      throw new Error(`Vector dimension mismatch`);
    }
    this.vectors.push(vector);
    this.ids.push(id);
  }

  /**
   * 批量添加
   */
  addBatch(items: Array<{ id: string; vector: number[] }>): void {
    for (const item of items) {
      this.add(item.id, item.vector);
    }
  }

  /**
   * 训练索引（K-means 聚类）
   */
  train(): void {
    if (this.vectors.length < this.nlist) {
      // 向量太少，不进行聚类
      this.centroids = [...this.vectors];
      return;
    }

    // 简化的 K-means
    // 随机选择初始中心
    const shuffled = [...this.vectors].sort(() => Math.random() - 0.5);
    this.centroids = shuffled.slice(0, this.nlist);

    // 迭代优化（简化版，只迭代 10 次）
    for (let iter = 0; iter < 10; iter++) {
      const clusters: number[][][] = Array(this.nlist).fill(null).map(() => []);
      
      // 分配向量到最近的中心
      for (const vec of this.vectors) {
        let minDist = Infinity;
        let minIdx = 0;
        
        for (let i = 0; i < this.centroids.length; i++) {
          const dist = this.euclideanDistance(vec, this.centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            minIdx = i;
          }
        }
        
        clusters[minIdx].push(vec);
      }

      // 更新中心
      for (let i = 0; i < this.nlist; i++) {
        if (clusters[i].length > 0) {
          this.centroids[i] = this.averageVector(clusters[i]);
        }
      }
    }
  }

  /**
   * 搜索
   */
  search(query: number[], k: number): Array<{ id: string; score: number }> {
    const results: Array<{ id: string; score: number }> = [];

    for (let i = 0; i < this.vectors.length; i++) {
      const score = this.cosineSimilarity(query, this.vectors[i]);
      results.push({ id: this.ids[i], score });
    }

    // 排序并返回 top-k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * 辅助函数
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private averageVector(vectors: number[][]): number[] {
    const result = new Array(this.dimensions).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < this.dimensions; i++) {
        result[i] += vec[i];
      }
    }
    for (let i = 0; i < this.dimensions; i++) {
      result[i] /= vectors.length;
    }
    return result;
  }

  /**
   * 获取统计
   */
  getStats(): { totalVectors: number; dimensions: number; nlist: number } {
    return {
      totalVectors: this.vectors.length,
      dimensions: this.dimensions,
      nlist: this.nlist,
    };
  }
}

// ============================================================
// 记忆向量存储
// ============================================================

export class MemoryVectorStore {
  private store: VectorStore;
  private index: FAISSIndex;

  constructor(dimensions: number = 1536) {
    this.store = new VectorStore({ dimensions });
    this.index = new FAISSIndex(dimensions);
  }

  /**
   * 添加文档（简化接口）
   */
  add(doc: { id: string; embedding: number[]; metadata?: Record<string, unknown> }): void {
    this.store.addDocument(doc.id, doc.metadata?.content || '', doc.embedding, doc.metadata);
    this.index.add(doc.id, doc.embedding);
  }

  /**
   * 获取文档数量
   */
  size(): number {
    return this.store.getStats().totalDocuments;
  }

  /**
   * 存储记忆
   */
  storeMemory(id: string, content: string, embedding: number[], metadata?: Record<string, unknown>): void {
    this.store.addDocument(id, content, embedding, metadata);
    this.index.add(id, embedding);
  }

  /**
   * 检索记忆
   */
  retrieveMemories(queryEmbedding: number[], topK: number = 5): SearchResult[] {
    return this.store.search(queryEmbedding, topK);
  }

  /**
   * 快速检索（使用 FAISS 索引）
   */
  fastRetrieve(queryEmbedding: number[], k: number = 5): Array<{ id: string; score: number }> {
    return this.index.search(queryEmbedding, k);
  }

  /**
   * 训练索引
   */
  trainIndex(): void {
    this.index.train();
  }

  /**
   * 获取统计
   */
  getStats(): { store: any; index: any } {
    return {
      store: this.store.getStats(),
      index: this.index.getStats(),
    };
  }
}

// ============================================================
// 单例
// ============================================================

let vectorStoreInstance: VectorStore | null = null;
let memoryStoreInstance: MemoryVectorStore | null = null;

export function getVectorStore(config?: Partial<VectorStoreConfig>): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore(config);
  }
  return vectorStoreInstance;
}

export function getMemoryVectorStore(dimensions?: number): MemoryVectorStore {
  if (!memoryStoreInstance) {
    memoryStoreInstance = new MemoryVectorStore(dimensions);
  }
  return memoryStoreInstance;
}
