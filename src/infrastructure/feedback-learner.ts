/**
 * 反馈学习系统
 * 
 * 融合自 llm-memory-integration v5.2.17
 * 
 * 功能：
 * 1. 点击记录
 * 2. 权重优化
 * 3. 历史学习
 * 4. 个性化排序
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface FeedbackRecord {
  id: string;
  query: string;
  resultId: string;
  position: number;
  clicked: boolean;
  timestamp: number;
  sessionId?: string;
}

export interface QueryHistory {
  query: string;
  count: number;
  lastUsed: number;
  avgClickPosition: number;
}

export interface ResultStats {
  resultId: string;
  impressions: number;
  clicks: number;
  ctr: number; // Click-Through Rate
  avgPosition: number;
}

export interface LearningWeights {
  vectorWeight: number;
  ftsWeight: number;
  recencyWeight: number;
  popularityWeight: number;
}

// ============ 反馈学习器 ============

export class FeedbackLearner {
  private logger: StructuredLogger;
  private dataDir: string;
  
  // 反馈记录
  private feedbacks: FeedbackRecord[] = [];
  
  // 查询历史
  private queryHistory: Map<string, QueryHistory> = new Map();
  
  // 结果统计
  private resultStats: Map<string, ResultStats> = new Map();
  
  // 学习权重
  private weights: LearningWeights = {
    vectorWeight: 0.4,
    ftsWeight: 0.3,
    recencyWeight: 0.15,
    popularityWeight: 0.15,
  };
  
  // 配置
  private static MAX_FEEDBACKS = 10000;
  private static LEARNING_RATE = 0.01;
  private static MIN_SAMPLES = 10;
  
  constructor(logger: StructuredLogger, dataDir: string = './data/feedback') {
    this.logger = logger;
    this.dataDir = dataDir;
    this.ensureDir(dataDir);
    this.loadData();
  }
  
  /**
   * 记录反馈
   */
  recordFeedback(
    query: string,
    resultId: string,
    position: number,
    clicked: boolean,
    sessionId?: string
  ): void {
    const feedback: FeedbackRecord = {
      id: this.generateId(),
      query,
      resultId,
      position,
      clicked,
      timestamp: Date.now(),
      sessionId,
    };
    
    this.feedbacks.push(feedback);
    
    // 更新查询历史
    this.updateQueryHistory(query, position, clicked);
    
    // 更新结果统计
    this.updateResultStats(resultId, position, clicked);
    
    // 限制记录数
    if (this.feedbacks.length > FeedbackLearner.MAX_FEEDBACKS) {
      this.feedbacks = this.feedbacks.slice(-FeedbackLearner.MAX_FEEDBACKS);
    }
    
    // 定期学习
    if (this.feedbacks.length % 100 === 0) {
      this.learn();
    }
    
    this.logger.debug('FeedbackLearner', 
      `记录反馈: query=${query}, result=${resultId}, clicked=${clicked}`
    );
  }
  
  /**
   * 更新查询历史
   */
  private updateQueryHistory(query: string, position: number, clicked: boolean): void {
    const history = this.queryHistory.get(query) || {
      query,
      count: 0,
      lastUsed: 0,
      avgClickPosition: 0,
    };
    
    history.count++;
    history.lastUsed = Date.now();
    
    if (clicked) {
      // 更新平均点击位置
      history.avgClickPosition = 
        (history.avgClickPosition * (history.count - 1) + position) / history.count;
    }
    
    this.queryHistory.set(query, history);
  }
  
  /**
   * 更新结果统计
   */
  private updateResultStats(resultId: string, position: number, clicked: boolean): void {
    const stats = this.resultStats.get(resultId) || {
      resultId,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      avgPosition: 0,
    };
    
    stats.impressions++;
    if (clicked) stats.clicks++;
    stats.ctr = stats.clicks / stats.impressions;
    stats.avgPosition = 
      (stats.avgPosition * (stats.impressions - 1) + position) / stats.impressions;
    
    this.resultStats.set(resultId, stats);
  }
  
  /**
   * 学习优化权重
   */
  learn(): LearningWeights {
    if (this.feedbacks.length < FeedbackLearner.MIN_SAMPLES) {
      return this.weights;
    }
    
    // 计算点击率趋势
    const recentFeedbacks = this.feedbacks.slice(-1000);
    const clickedCount = recentFeedbacks.filter(f => f.clicked).length;
    const ctr = clickedCount / recentFeedbacks.length;
    
    // 根据点击位置调整权重
    const clickedFeedbacks = recentFeedbacks.filter(f => f.clicked);
    const avgClickPosition = clickedFeedbacks.length > 0
      ? clickedFeedbacks.reduce((sum, f) => sum + f.position, 0) / clickedFeedbacks.length
      : 5;
    
    // 如果平均点击位置靠后，说明排序需要优化
    if (avgClickPosition > 3) {
      // 增加向量权重，减少 FTS 权重
      this.weights.vectorWeight = Math.min(0.6, this.weights.vectorWeight + FeedbackLearner.LEARNING_RATE);
      this.weights.ftsWeight = Math.max(0.1, this.weights.ftsWeight - FeedbackLearner.LEARNING_RATE);
    }
    
    // 根据点击率调整流行度权重
    if (ctr > 0.3) {
      this.weights.popularityWeight = Math.min(0.3, this.weights.popularityWeight + FeedbackLearner.LEARNING_RATE);
    } else if (ctr < 0.1) {
      this.weights.popularityWeight = Math.max(0.05, this.weights.popularityWeight - FeedbackLearner.LEARNING_RATE);
    }
    
    // 归一化权重
    this.normalizeWeights();
    
    this.logger.info('FeedbackLearner', 
      `学习完成: CTR=${(ctr * 100).toFixed(1)}%, avgPos=${avgClickPosition.toFixed(1)}`
    );
    
    // 保存数据
    this.saveData();
    
    return this.weights;
  }
  
  /**
   * 归一化权重
   */
  private normalizeWeights(): void {
    const total = this.weights.vectorWeight + this.weights.ftsWeight 
      + this.weights.recencyWeight + this.weights.popularityWeight;
    
    if (total > 0) {
      this.weights.vectorWeight /= total;
      this.weights.ftsWeight /= total;
      this.weights.recencyWeight /= total;
      this.weights.popularityWeight /= total;
    }
  }
  
  /**
   * 应用学习结果重排序
   */
  rerank(
    results: Array<{ id: string; score: number; source: string }>,
    query: string
  ): Array<{ id: string; score: number; source: string }> {
    const history = this.queryHistory.get(query);
    
    return results.map(result => {
      let adjustedScore = result.score;
      
      // 应用权重
      if (result.source === 'vector') {
        adjustedScore *= this.weights.vectorWeight;
      } else if (result.source === 'fts') {
        adjustedScore *= this.weights.ftsWeight;
      }
      
      // 应用流行度
      const stats = this.resultStats.get(result.id);
      if (stats) {
        adjustedScore += stats.ctr * this.weights.popularityWeight;
      }
      
      // 应用历史
      if (history && history.avgClickPosition < 3) {
        adjustedScore *= 1.1; // 高频查询加成
      }
      
      return {
        ...result,
        score: adjustedScore,
      };
    }).sort((a, b) => b.score - a.score);
  }
  
  /**
   * 获取热门查询
   */
  getPopularQueries(limit: number = 10): QueryHistory[] {
    return Array.from(this.queryHistory.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
  
  /**
   * 获取高点击率结果
   */
  getPopularResults(limit: number = 10): ResultStats[] {
    return Array.from(this.resultStats.values())
      .filter(s => s.impressions >= 5)
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, limit);
  }
  
  /**
   * 获取当前权重
   */
  getWeights(): LearningWeights {
    return { ...this.weights };
  }
  
  /**
   * 手动设置权重
   */
  setWeights(weights: Partial<LearningWeights>): void {
    this.weights = { ...this.weights, ...weights };
    this.normalizeWeights();
    this.logger.info('FeedbackLearner', '权重已更新');
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalFeedbacks: number;
    totalQueries: number;
    totalResults: number;
    avgCtr: number;
  } {
    const totalClicks = this.feedbacks.filter(f => f.clicked).length;
    
    return {
      totalFeedbacks: this.feedbacks.length,
      totalQueries: this.queryHistory.size,
      totalResults: this.resultStats.size,
      avgCtr: this.feedbacks.length > 0 ? totalClicks / this.feedbacks.length : 0,
    };
  }
  
  // ============ 数据持久化 ============
  
  private loadData(): void {
    try {
      const feedbackPath = path.join(this.dataDir, 'feedbacks.json');
      if (fs.existsSync(feedbackPath)) {
        this.feedbacks = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8'));
      }
      
      const historyPath = path.join(this.dataDir, 'query_history.json');
      if (fs.existsSync(historyPath)) {
        const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        this.queryHistory = new Map(Object.entries(historyData));
      }
      
      const statsPath = path.join(this.dataDir, 'result_stats.json');
      if (fs.existsSync(statsPath)) {
        const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
        this.resultStats = new Map(Object.entries(statsData));
      }
      
      const weightsPath = path.join(this.dataDir, 'weights.json');
      if (fs.existsSync(weightsPath)) {
        this.weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
      }
      
      this.logger.info('FeedbackLearner', `数据加载完成: ${this.feedbacks.length} 条反馈`);
    } catch (error) {
      this.logger.warn('FeedbackLearner', `数据加载失败: ${error}`);
    }
  }
  
  private saveData(): void {
    try {
      fs.writeFileSync(
        path.join(this.dataDir, 'feedbacks.json'),
        JSON.stringify(this.feedbacks.slice(-1000)) // 只保存最近 1000 条
      );
      
      fs.writeFileSync(
        path.join(this.dataDir, 'query_history.json'),
        JSON.stringify(Object.fromEntries(this.queryHistory))
      );
      
      fs.writeFileSync(
        path.join(this.dataDir, 'result_stats.json'),
        JSON.stringify(Object.fromEntries(this.resultStats))
      );
      
      fs.writeFileSync(
        path.join(this.dataDir, 'weights.json'),
        JSON.stringify(this.weights)
      );
    } catch (error) {
      this.logger.warn('FeedbackLearner', `数据保存失败: ${error}`);
    }
  }
  
  // ============ 辅助方法 ============
  
  private generateId(): string {
    return `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
