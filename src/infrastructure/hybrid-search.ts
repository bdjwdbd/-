/**
 * 混合检索引擎
 * 
 * 融合自 llm-memory-integration v5.2.17
 * 
 * 功能：
 * 1. 向量搜索（语义相似度）
 * 2. FTS 搜索（关键词匹配）
 * 3. RRF 融合排序
 * 4. 智能路由
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  source: 'vector' | 'fts' | 'hybrid';
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  topK?: number;
  maxDistance?: number;
  useFts?: boolean;
  useVector?: boolean;
  useRrf?: boolean;
  rrfK?: number;
}

export type SearchMode = 'fast' | 'balanced' | 'full';

export interface QueryAnalysis {
  intent: 'search' | 'config' | 'explain' | 'compare';
  entities: string[];
  complexity: 'simple' | 'medium' | 'complex';
  suggestedMode: SearchMode;
}

// ============ 混合检索引擎 ============

export class HybridSearchEngine {
  private logger: StructuredLogger;
  
  // 默认配置
  private static DEFAULT_OPTIONS: Required<SearchOptions> = {
    topK: 20,
    maxDistance: 0.8,
    useFts: true,
    useVector: true,
    useRrf: true,
    rrfK: 60,
  };
  
  // 向量数据库（模拟）
  private vectorStore: Map<string, { vector: number[]; content: string; metadata: any }> = new Map();
  
  // FTS 索引（模拟）
  private ftsIndex: Map<string, string[]> = new Map();
  
  // 查询缓存
  private queryCache: Map<string, { results: SearchResult[]; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 分钟
  
  constructor(logger: StructuredLogger) {
    this.logger = logger;
  }
  
  /**
   * 混合搜索
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const opts = { ...HybridSearchEngine.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    
    // 1. 检查缓存
    const cacheKey = `${query}:${JSON.stringify(opts)}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.logger.info('HybridSearchEngine', `缓存命中: ${query}`);
      return cached.results;
    }
    
    // 2. 分析查询
    const analysis = this.analyzeQuery(query);
    this.logger.info('HybridSearchEngine', 
      `查询分析: intent=${analysis.intent}, complexity=${analysis.complexity}, mode=${analysis.suggestedMode}`
    );
    
    // 3. 根据模式选择搜索策略
    let results: SearchResult[] = [];
    
    switch (analysis.suggestedMode) {
      case 'fast':
        results = await this.fastSearch(query, opts);
        break;
      case 'balanced':
        results = await this.balancedSearch(query, opts);
        break;
      case 'full':
        results = await this.fullSearch(query, opts);
        break;
    }
    
    // 4. 缓存结果
    this.queryCache.set(cacheKey, { results, timestamp: Date.now() });
    
    this.logger.info('HybridSearchEngine', 
      `搜索完成: ${results.length} 条结果, 耗时 ${Date.now() - startTime}ms`
    );
    
    return results;
  }
  
  /**
   * 快速搜索（仅 FTS）
   */
  private async fastSearch(query: string, opts: Required<SearchOptions>): Promise<SearchResult[]> {
    if (!opts.useFts) return [];
    
    const ftsResults = this.ftsSearch(query, opts.topK);
    return ftsResults;
  }
  
  /**
   * 平衡搜索（向量 + FTS + RRF）
   */
  private async balancedSearch(query: string, opts: Required<SearchOptions>): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // 并行执行向量搜索和 FTS
    const [vectorResults, ftsResults] = await Promise.all([
      opts.useVector ? this.vectorSearch(query, opts.topK, opts.maxDistance) : [],
      opts.useFts ? this.ftsSearch(query, opts.topK) : [],
    ]);
    
    // RRF 融合
    if (opts.useRrf && vectorResults.length > 0 && ftsResults.length > 0) {
      return this.rrfFusion(vectorResults, ftsResults, opts.rrfK);
    }
    
    // 否则合并去重
    return this.mergeAndDedup(vectorResults, ftsResults);
  }
  
  /**
   * 完整搜索（向量 + FTS + RRF + 重排序）
   */
  private async fullSearch(query: string, opts: Required<SearchOptions>): Promise<SearchResult[]> {
    // 先执行平衡搜索
    let results = await this.balancedSearch(query, opts);
    
    // 重排序（基于查询相关性）
    results = this.rerank(query, results);
    
    return results.slice(0, opts.topK);
  }
  
  /**
   * 向量搜索
   */
  private async vectorSearch(
    query: string,
    topK: number,
    maxDistance: number
  ): Promise<SearchResult[]> {
    // 模拟向量搜索
    const results: SearchResult[] = [];
    
    for (const [id, data] of this.vectorStore) {
      // 计算相似度（模拟）
      const distance = Math.random(); // 实际应使用向量距离计算
      if (distance <= maxDistance) {
        results.push({
          id,
          content: data.content,
          score: 1 - distance,
          source: 'vector',
          metadata: data.metadata,
        });
      }
    }
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK);
  }
  
  /**
   * FTS 搜索
   */
  private ftsSearch(query: string, topK: number): SearchResult[] {
    const results: SearchResult[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    for (const [id, terms] of this.ftsIndex) {
      // 计算 BM25 分数（简化版）
      let score = 0;
      for (const term of queryTerms) {
        if (terms.some(t => t.includes(term))) {
          score += 1;
        }
      }
      
      if (score > 0) {
        const data = this.vectorStore.get(id);
        if (data) {
          results.push({
            id,
            content: data.content,
            score: score / queryTerms.length,
            source: 'fts',
            metadata: data.metadata,
          });
        }
      }
    }
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK);
  }
  
  /**
   * RRF 融合排序
   */
  private rrfFusion(
    vectorResults: SearchResult[],
    ftsResults: SearchResult[],
    k: number
  ): SearchResult[] {
    const scores: Map<string, { result: SearchResult; rrfScore: number }> = new Map();
    
    // 向量结果
    vectorResults.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      scores.set(result.id, { result, rrfScore });
    });
    
    // FTS 结果
    ftsResults.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = scores.get(result.id);
      if (existing) {
        existing.rrfScore += rrfScore;
        existing.result.source = 'hybrid';
      } else {
        scores.set(result.id, { result, rrfScore });
      }
    });
    
    // 排序
    const results = Array.from(scores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(item => ({
        ...item.result,
        score: item.rrfScore,
      }));
    
    return results;
  }
  
  /**
   * 合并去重
   */
  private mergeAndDedup(
    vectorResults: SearchResult[],
    ftsResults: SearchResult[]
  ): SearchResult[] {
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    
    for (const result of [...vectorResults, ...ftsResults]) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        results.push(result);
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }
  
  /**
   * 重排序
   */
  private rerank(query: string, results: SearchResult[]): SearchResult[] {
    // 简化重排序：基于查询词匹配度
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return results.map(result => {
      const content = result.content.toLowerCase();
      let matchCount = 0;
      
      for (const term of queryTerms) {
        if (content.includes(term)) {
          matchCount++;
        }
      }
      
      const rerankScore = (result.score + matchCount / queryTerms.length) / 2;
      
      return {
        ...result,
        score: rerankScore,
      };
    }).sort((a, b) => b.score - a.score);
  }
  
  /**
   * 分析查询
   */
  analyzeQuery(query: string): QueryAnalysis {
    const lowerQuery = query.toLowerCase();
    
    // 意图识别
    let intent: QueryAnalysis['intent'] = 'search';
    if (lowerQuery.includes('如何') || lowerQuery.includes('怎么')) {
      intent = 'explain';
    } else if (lowerQuery.includes('配置') || lowerQuery.includes('设置')) {
      intent = 'config';
    } else if (lowerQuery.includes('对比') || lowerQuery.includes('比较')) {
      intent = 'compare';
    }
    
    // 实体提取（简化）
    const entities = this.extractEntities(query);
    
    // 复杂度分析
    const complexity = this.analyzeComplexity(query, entities);
    
    // 建议模式
    const suggestedMode: SearchMode = complexity === 'simple' ? 'fast' 
      : complexity === 'medium' ? 'balanced' 
      : 'full';
    
    return {
      intent,
      entities,
      complexity,
      suggestedMode,
    };
  }
  
  /**
   * 提取实体
   */
  private extractEntities(query: string): string[] {
    // 简化实现：提取中文词汇
    const entities: string[] = [];
    const pattern = /[\u4e00-\u9fa5]{2,}/g;
    let match;
    
    while ((match = pattern.exec(query)) !== null) {
      entities.push(match[0]);
    }
    
    return entities;
  }
  
  /**
   * 分析复杂度
   */
  private analyzeComplexity(query: string, entities: string[]): 'simple' | 'medium' | 'complex' {
    const wordCount = query.split(/\s+/).length;
    const entityCount = entities.length;
    
    if (wordCount <= 3 && entityCount <= 1) {
      return 'simple';
    } else if (wordCount <= 10 && entityCount <= 3) {
      return 'medium';
    } else {
      return 'complex';
    }
  }
  
  /**
   * 添加文档
   */
  addDocument(id: string, content: string, metadata?: any): void {
    // 添加到向量存储
    this.vectorStore.set(id, {
      vector: [], // 实际应计算向量
      content,
      metadata,
    });
    
    // 添加到 FTS 索引
    const terms = content.toLowerCase().split(/\s+/);
    this.ftsIndex.set(id, terms);
    
    this.logger.debug('HybridSearchEngine', `添加文档: ${id}`);
  }
  
  /**
   * 删除文档
   */
  removeDocument(id: string): void {
    this.vectorStore.delete(id);
    this.ftsIndex.delete(id);
    this.logger.debug('HybridSearchEngine', `删除文档: ${id}`);
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    this.queryCache.clear();
    this.logger.info('HybridSearchEngine', '缓存已清空');
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    documentCount: number;
    cacheSize: number;
  } {
    return {
      documentCount: this.vectorStore.size,
      cacheSize: this.queryCache.size,
    };
  }
}
