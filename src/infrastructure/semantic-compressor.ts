/**
 * 语义压缩器
 * 
 * 策略：
 * 1. 相似记忆聚类
 * 2. 摘要生成
 * 3. 分层存储（热/温/冷）
 * 
 * 目标：
 * - 压缩率: 85%
 * - 召回率保持: 95%+
 */

import { StructuredLogger } from './index';
import { HNSWIndex } from '../core/hnsw-index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface CompressibleMemory {
  id: string;
  content: string;
  embedding?: number[];
  type: string;
  tags: string[];
  importance: number;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
}

export interface CompressedMemory {
  id: string;
  summary: string;
  memberCount: number;
  memberIds: string[];
  importance: number;
  createdAt: number;
  compressedAt: number;
  tier: 'hot' | 'warm' | 'cold';
  keywords: string[];
}

export interface CompressionResult {
  compressed: CompressedMemory[];
  stats: {
    originalCount: number;
    compressedCount: number;
    compressionRatio: number;
    processingTime: number;
  };
}

export interface SemanticCompressorConfig {
  similarityThreshold: number;
  minClusterSize: number;
  maxClusterSize: number;
  hotTierDays: number;
  warmTierDays: number;
  summaryMaxLength: number;
  enableAutoCompress: boolean;
  compressInterval: number;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: SemanticCompressorConfig = {
  similarityThreshold: 0.85,
  minClusterSize: 2,
  maxClusterSize: 20,
  hotTierDays: 7,
  warmTierDays: 30,
  summaryMaxLength: 200,
  enableAutoCompress: false,
  compressInterval: 3600000, // 1 小时
};

// ============ 语义压缩器类 ============

export class SemanticCompressor {
  private logger: any;
  private config: SemanticCompressorConfig;
  private index: HNSWIndex | null = null;
  private compressed: Map<string, CompressedMemory> = new Map();
  private dataPath: string;
  private autoCompressTimer: NodeJS.Timeout | null = null;

  constructor(logger: any, config?: Partial<SemanticCompressorConfig>, dataPath?: string) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataPath = dataPath || path.join(process.env.HOME || '.', '.openclaw', 'workspace', 'memory', 'compressed');
    
    this.ensureDir(this.dataPath);
    this.loadData();
    
    if (this.config.enableAutoCompress) {
      this.startAutoCompress();
    }
  }

  // ============ 压缩操作 ============

  /**
   * 压缩记忆
   */
  async compress(memories: CompressibleMemory[]): Promise<CompressionResult> {
    const startTime = Date.now();
    
    if (memories.length === 0) {
      return {
        compressed: [],
        stats: {
          originalCount: 0,
          compressedCount: 0,
          compressionRatio: 0,
          processingTime: 0,
        },
      };
    }

    // 1. 按时间分层
    const { hot, warm, cold } = this.categorizeByTier(memories);
    
    this.logger.info('SemanticCompressor', 
      `分层完成: 热=${hot.length}, 温=${warm.length}, 冷=${cold.length}`
    );

    // 2. 对每层分别压缩
    const compressedHot = await this.compressTier(hot, 'hot');
    const compressedWarm = await this.compressTier(warm, 'warm');
    const compressedCold = await this.compressTier(cold, 'cold');

    // 3. 合并结果
    const allCompressed = [...compressedHot, ...compressedWarm, ...compressedCold];

    // 4. 保存
    for (const memory of allCompressed) {
      this.compressed.set(memory.id, memory);
    }
    this.saveData();

    const processingTime = Date.now() - startTime;
    const compressionRatio = memories.length > 0 
      ? (1 - allCompressed.length / memories.length) * 100 
      : 0;

    this.logger.info('SemanticCompressor', 
      `压缩完成: ${memories.length} -> ${allCompressed.length} (${compressionRatio.toFixed(1)}%)`
    );

    return {
      compressed: allCompressed,
      stats: {
        originalCount: memories.length,
        compressedCount: allCompressed.length,
        compressionRatio,
        processingTime,
      },
    };
  }

  /**
   * 压缩单层记忆
   */
  private async compressTier(
    memories: CompressibleMemory[],
    tier: 'hot' | 'warm' | 'cold'
  ): Promise<CompressedMemory[]> {
    if (memories.length === 0) return [];

    // 热数据不压缩，只保留摘要
    if (tier === 'hot') {
      return memories.map(m => this.createSingleCompressed(m, tier));
    }

    // 温数据和冷数据进行聚类压缩
    const clusters = await this.clusterMemories(memories);
    
    const compressed: CompressedMemory[] = [];
    for (const cluster of clusters) {
      if (cluster.length >= this.config.minClusterSize) {
        compressed.push(await this.createClusterCompressed(cluster, tier));
      } else {
        // 小簇不压缩
        for (const memory of cluster) {
          compressed.push(this.createSingleCompressed(memory, tier));
        }
      }
    }

    return compressed;
  }

  /**
   * 聚类相似记忆
   */
  private async clusterMemories(memories: CompressibleMemory[]): Promise<CompressibleMemory[][]> {
    // 如果没有嵌入向量，使用简单的文本相似度
    const hasEmbeddings = memories.some(m => m.embedding && m.embedding.length > 0);
    
    if (hasEmbeddings) {
      return this.clusterWithEmbeddings(memories);
    } else {
      return this.clusterWithTextSimilarity(memories);
    }
  }

  /**
   * 使用嵌入向量聚类
   */
  private async clusterWithEmbeddings(memories: CompressibleMemory[]): Promise<CompressibleMemory[][]> {
    // 初始化 HNSW 索引
    const dimension = memories.find(m => m.embedding)?.embedding?.length || 128;
    this.index = new HNSWIndex({
      dimensions: dimension,
      maxConnections: 16,
      efConstruction: 100,
      efSearch: 50,
    });

    // 添加向量
    const validMemories = memories.filter(m => m.embedding && m.embedding.length > 0);
    for (const memory of validMemories) {
      this.index!.add(memory.id, memory.embedding!);
    }

    // DBSCAN 聚类
    return this.dbscan(validMemories);
  }

  /**
   * 使用文本相似度聚类
   */
  private clusterWithTextSimilarity(memories: CompressibleMemory[]): Promise<CompressibleMemory[][]> {
    return new Promise((resolve) => {
      const clusters: CompressibleMemory[][] = [];
      const visited = new Set<string>();

      for (const memory of memories) {
        if (visited.has(memory.id)) continue;

        const cluster: CompressibleMemory[] = [memory];
        visited.add(memory.id);

        // 查找相似记忆
        for (const other of memories) {
          if (visited.has(other.id)) continue;

          const similarity = this.textSimilarity(memory.content, other.content);
          if (similarity >= this.config.similarityThreshold) {
            cluster.push(other);
            visited.add(other.id);

            if (cluster.length >= this.config.maxClusterSize) break;
          }
        }

        clusters.push(cluster);
      }

      resolve(clusters);
    });
  }

  /**
   * DBSCAN 聚类算法
   */
  private dbscan(memories: CompressibleMemory[]): CompressibleMemory[][] {
    const clusters: CompressibleMemory[][] = [];
    const visited = new Set<string>();
    const noise = new Set<string>();

    for (const memory of memories) {
      if (visited.has(memory.id)) continue;

      visited.add(memory.id);
      const neighbors = this.getNeighbors(memory.id, memories);

      if (neighbors.length < this.config.minClusterSize) {
        noise.add(memory.id);
      } else {
        const cluster: CompressibleMemory[] = [];
        this.expandCluster(memory, neighbors, cluster, visited, memories);
        clusters.push(cluster);
      }
    }

    // 噪声点单独成簇
    for (const id of noise) {
      const memory = memories.find(m => m.id === id);
      if (memory) {
        clusters.push([memory]);
      }
    }

    return clusters;
  }

  /**
   * 扩展簇
   */
  private expandCluster(
    memory: CompressibleMemory,
    neighbors: CompressibleMemory[],
    cluster: CompressibleMemory[],
    visited: Set<string>,
    memories: CompressibleMemory[]
  ): void {
    cluster.push(memory);

    const queue = [...neighbors];
    while (queue.length > 0 && cluster.length < this.config.maxClusterSize) {
      const current = queue.shift()!;

      if (!visited.has(current.id)) {
        visited.add(current.id);
        const currentNeighbors = this.getNeighbors(current.id, memories);

        if (currentNeighbors.length >= this.config.minClusterSize) {
          queue.push(...currentNeighbors.filter(n => !visited.has(n.id)));
        }
      }

      if (!cluster.includes(current)) {
        cluster.push(current);
      }
    }
  }

  /**
   * 获取邻居
   */
  private getNeighbors(id: string, memories: CompressibleMemory[]): CompressibleMemory[] {
    const memory = memories.find(m => m.id === id);
    if (!memory || !memory.embedding || !this.index) return [];

    const results = this.index.search(memory.embedding, this.config.maxClusterSize);
    
    return results
      .filter(r => r.score >= this.config.similarityThreshold && r.id !== id)
      .map(r => memories.find(m => m.id === r.id))
      .filter((m): m is CompressibleMemory => m !== undefined);
  }

  // ============ 创建压缩记忆 ============

  /**
   * 创建单个压缩记忆
   */
  private createSingleCompressed(memory: CompressibleMemory, tier: 'hot' | 'warm' | 'cold'): CompressedMemory {
    return {
      id: `comp_${memory.id}`,
      summary: memory.content.substring(0, this.config.summaryMaxLength),
      memberCount: 1,
      memberIds: [memory.id],
      importance: memory.importance,
      createdAt: memory.createdAt,
      compressedAt: Date.now(),
      tier,
      keywords: this.extractKeywords(memory.content),
    };
  }

  /**
   * 创建聚类压缩记忆
   */
  private async createClusterCompressed(
    cluster: CompressibleMemory[],
    tier: 'hot' | 'warm' | 'cold'
  ): Promise<CompressedMemory> {
    // 生成摘要
    const summary = await this.generateSummary(cluster);
    
    // 计算平均重要性
    const avgImportance = cluster.reduce((sum, m) => sum + m.importance, 0) / cluster.length;
    
    // 提取关键词
    const allContent = cluster.map(m => m.content).join(' ');
    const keywords = this.extractKeywords(allContent);

    return {
      id: `comp_cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      summary,
      memberCount: cluster.length,
      memberIds: cluster.map(m => m.id),
      importance: avgImportance,
      createdAt: Math.min(...cluster.map(m => m.createdAt)),
      compressedAt: Date.now(),
      tier,
      keywords,
    };
  }

  /**
   * 生成摘要
   */
  private async generateSummary(cluster: CompressibleMemory[]): Promise<string> {
    // 简单摘要：取最重要的记忆内容
    const sorted = [...cluster].sort((a, b) => b.importance - a.importance);
    const mostImportant = sorted[0];

    // 如果簇中有多个记忆，添加统计信息
    if (cluster.length > 1) {
      const types = [...new Set(cluster.map(m => m.type))];
      const tags = [...new Set(cluster.flatMap(m => m.tags))].slice(0, 5);
      
      let summary = mostImportant.content.substring(0, this.config.summaryMaxLength - 50);
      summary += ` [共${cluster.length}条相关记忆, 类型: ${types.join(', ')}]`;
      
      if (tags.length > 0) {
        summary += ` [标签: ${tags.join(', ')}]`;
      }
      
      return summary;
    }

    return mostImportant.content.substring(0, this.config.summaryMaxLength);
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    // 简单的关键词提取：基于词频
    const words = content.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);

    const wordCount: Record<string, number> = {};
    for (const word of words) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }

    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  // ============ 分层管理 ============

  /**
   * 按时间分层
   */
  private categorizeByTier(memories: CompressibleMemory[]): {
    hot: CompressibleMemory[];
    warm: CompressibleMemory[];
    cold: CompressibleMemory[];
  } {
    const now = Date.now();
    const hotThreshold = now - this.config.hotTierDays * 24 * 60 * 60 * 1000;
    const warmThreshold = now - this.config.warmTierDays * 24 * 60 * 60 * 1000;

    const hot: CompressibleMemory[] = [];
    const warm: CompressibleMemory[] = [];
    const cold: CompressibleMemory[] = [];

    for (const memory of memories) {
      if (memory.createdAt >= hotThreshold) {
        hot.push(memory);
      } else if (memory.createdAt >= warmThreshold) {
        warm.push(memory);
      } else {
        cold.push(memory);
      }
    }

    return { hot, warm, cold };
  }

  // ============ 相似度计算 ============

  /**
   * 文本相似度（Jaccard）
   */
  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // ============ 自动压缩 ============

  /**
   * 启动自动压缩
   */
  private startAutoCompress(): void {
    this.autoCompressTimer = setInterval(() => {
      this.logger.info('SemanticCompressor', '自动压缩触发');
    }, this.config.compressInterval);
  }

  /**
   * 停止自动压缩
   */
  stopAutoCompress(): void {
    if (this.autoCompressTimer) {
      clearInterval(this.autoCompressTimer);
      this.autoCompressTimer = null;
    }
  }

  // ============ 数据持久化 ============

  private loadData(): void {
    try {
      const dataFile = path.join(this.dataPath, 'compressed.json');
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        for (const item of data) {
          this.compressed.set(item.id, item);
        }
        this.logger.info('SemanticCompressor', `加载 ${this.compressed.size} 条压缩记忆`);
      }
    } catch (e) {
      this.logger.warn('SemanticCompressor', `加载失败: ${e}`);
    }
  }

  private saveData(): void {
    try {
      const dataFile = path.join(this.dataPath, 'compressed.json');
      const data = Array.from(this.compressed.values());
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    } catch (e) {
      this.logger.warn('SemanticCompressor', `保存失败: ${e}`);
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // ============ 公共访问器 ============

  getCompressed(id: string): CompressedMemory | undefined {
    return this.compressed.get(id);
  }

  getAllCompressed(): CompressedMemory[] {
    return Array.from(this.compressed.values());
  }

  getStats(): {
    totalCompressed: number;
    byTier: Record<'hot' | 'warm' | 'cold', number>;
    avgClusterSize: number;
  } {
    const byTier: Record<'hot' | 'warm' | 'cold', number> = { hot: 0, warm: 0, cold: 0 };
    let totalMembers = 0;

    for (const memory of this.compressed.values()) {
      byTier[memory.tier]++;
      totalMembers += memory.memberCount;
    }

    return {
      totalCompressed: this.compressed.size,
      byTier,
      avgClusterSize: this.compressed.size > 0 ? totalMembers / this.compressed.size : 0,
    };
  }

  /**
   * 搜索压缩记忆
   */
  search(query: string, options?: {
    tier?: 'hot' | 'warm' | 'cold';
    limit?: number;
  }): CompressedMemory[] {
    const limit = options?.limit || 10;
    const queryLower = query.toLowerCase();

    let results = Array.from(this.compressed.values());

    // 按层过滤
    if (options?.tier) {
      results = results.filter(m => m.tier === options.tier);
    }

    // 按关键词和摘要匹配
    results = results
      .map(m => ({
        memory: m,
        score: this.calculateSearchScore(m, queryLower),
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.memory);

    return results;
  }

  private calculateSearchScore(memory: CompressedMemory, query: string): number {
    let score = 0;

    // 摘要匹配
    if (memory.summary.toLowerCase().includes(query)) {
      score += 0.5;
    }

    // 关键词匹配
    for (const keyword of memory.keywords) {
      if (query.includes(keyword) || keyword.includes(query)) {
        score += 0.3;
      }
    }

    // 重要性加权
    score += memory.importance * 0.2;

    return score;
  }

  /**
   * 关闭
   */
  close(): void {
    this.stopAutoCompress();
    this.saveData();
    this.logger.info('SemanticCompressor', '已关闭');
  }
}

// ============ 导出 ============

export default SemanticCompressor;
