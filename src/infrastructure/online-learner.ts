/**
 * 实时学习模块
 * 
 * 功能：
 * 1. 在线学习算法
 * 2. 增量知识更新
 * 3. 遗忘机制
 * 4. 学习进度追踪
 */

import { StructuredLogger } from './index';
import { KnowledgeGraph } from './knowledge-graph';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface LearningEvent {
  id: string;
  type: LearningEventType;
  content: string;
  source: string;
  confidence: number;
  timestamp: number;
  processed: boolean;
}

export type LearningEventType = 
  | 'user_feedback'    // 用户反馈
  | 'new_knowledge'    // 新知识
  | 'correction'       // 纠正
  | 'reinforcement'    // 强化
  | 'forgetting';      // 遗忘

export interface KnowledgeUpdate {
  entityId?: string;
  relationId?: string;
  operation: 'add' | 'update' | 'delete';
  data: any;
  reason: string;
  timestamp: number;
}

export interface ForgettingRule {
  type: 'time_based' | 'usage_based' | 'importance_based';
  threshold: number;
  decayRate: number;
}

export interface LearningProgress {
  totalEvents: number;
  processedEvents: number;
  knowledgeAdded: number;
  knowledgeUpdated: number;
  knowledgeForgotten: number;
  avgConfidence: number;
  lastUpdated: number;
}

export interface OnlineLearningConfig {
  learningRate: number;
  forgettingRate: number;
  reinforcementRate: number;
  maxMemorySize: number;
  batchSize: number;
}

// ============ 实时学习器 ============

export class OnlineLearner {
  private logger: StructuredLogger;
  private knowledgeGraph: KnowledgeGraph;
  private config: OnlineLearningConfig;
  private dataDir: string;
  
  // 学习事件队列
  private eventQueue: LearningEvent[] = [];
  
  // 知识更新历史
  private updateHistory: KnowledgeUpdate[] = [];
  
  // 遗忘规则
  private forgettingRules: ForgettingRule[] = [
    { type: 'time_based', threshold: 30 * 24 * 60 * 60 * 1000, decayRate: 0.1 }, // 30 天
    { type: 'usage_based', threshold: 0, decayRate: 0.05 }, // 未使用
    { type: 'importance_based', threshold: 0.3, decayRate: 0.15 }, // 低重要性
  ];
  
  // 学习进度
  private progress: LearningProgress = {
    totalEvents: 0,
    processedEvents: 0,
    knowledgeAdded: 0,
    knowledgeUpdated: 0,
    knowledgeForgotten: 0,
    avgConfidence: 0,
    lastUpdated: Date.now(),
  };
  
  constructor(
    logger: StructuredLogger,
    knowledgeGraph: KnowledgeGraph,
    config?: Partial<OnlineLearningConfig>,
    dataDir: string = './data/learning'
  ) {
    this.logger = logger;
    this.knowledgeGraph = knowledgeGraph;
    this.dataDir = dataDir;
    
    this.config = {
      learningRate: 0.1,
      forgettingRate: 0.05,
      reinforcementRate: 0.15,
      maxMemorySize: 10000,
      batchSize: 100,
      ...config,
    };
    
    this.ensureDir(dataDir);
    this.loadData();
  }
  
  /**
   * 添加学习事件
   */
  addEvent(event: Omit<LearningEvent, 'id' | 'timestamp' | 'processed'>): LearningEvent {
    const newEvent: LearningEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      processed: false,
    };
    
    this.eventQueue.push(newEvent);
    this.progress.totalEvents++;
    
    this.logger.debug('OnlineLearner', `添加学习事件: ${event.type}`);
    
    // 批量处理
    if (this.eventQueue.length >= this.config.batchSize) {
      this.processBatch();
    }
    
    return newEvent;
  }
  
  /**
   * 处理批量事件
   */
  processBatch(): KnowledgeUpdate[] {
    const updates: KnowledgeUpdate[] = [];
    const batch = this.eventQueue.splice(0, this.config.batchSize);
    
    for (const event of batch) {
      const update = this.processEvent(event);
      if (update) {
        updates.push(update);
        this.updateHistory.push(update);
      }
      event.processed = true;
      this.progress.processedEvents++;
    }
    
    // 更新进度
    this.updateProgress();
    
    // 保存数据
    this.saveData();
    
    this.logger.info('OnlineLearner', 
      `处理批量事件: ${batch.length} 条, 更新: ${updates.length} 条`
    );
    
    return updates;
  }
  
  /**
   * 处理单个事件
   */
  private processEvent(event: LearningEvent): KnowledgeUpdate | null {
    switch (event.type) {
      case 'user_feedback':
        return this.processUserFeedback(event);
      case 'new_knowledge':
        return this.processNewKnowledge(event);
      case 'correction':
        return this.processCorrection(event);
      case 'reinforcement':
        return this.processReinforcement(event);
      case 'forgetting':
        return this.processForgetting(event);
      default:
        return null;
    }
  }
  
  /**
   * 处理用户反馈
   */
  private processUserFeedback(event: LearningEvent): KnowledgeUpdate | null {
    // 解析反馈内容
    const feedback = this.parseFeedback(event.content);
    
    if (!feedback) return null;
    
    // 查找相关实体
    const entities = this.knowledgeGraph.queryEntities({ entityName: feedback.topic });
    
    if (entities.length > 0) {
      const entity = entities[0];
      
      // 更新置信度
      const confidenceDelta = feedback.positive 
        ? this.config.learningRate 
        : -this.config.learningRate;
      
      const newConfidence = Math.max(0, Math.min(1, entity.confidence + confidenceDelta));
      
      return {
        entityId: entity.id,
        operation: 'update',
        data: { confidence: newConfidence },
        reason: `用户反馈: ${feedback.positive ? '正面' : '负面'}`,
        timestamp: Date.now(),
      };
    }
    
    return null;
  }
  
  /**
   * 处理新知识
   */
  private processNewKnowledge(event: LearningEvent): KnowledgeUpdate | null {
    // 解析新知识
    const knowledge = this.parseKnowledge(event.content);
    
    if (!knowledge) return null;
    
    // 添加到知识图谱
    const entity = this.knowledgeGraph.addEntity({
      name: knowledge.name,
      type: knowledge.type,
      properties: knowledge.properties || {},
      confidence: event.confidence,
      source: event.source,
    });
    
    this.progress.knowledgeAdded++;
    
    return {
      entityId: entity.id,
      operation: 'add',
      data: entity,
      reason: '新知识学习',
      timestamp: Date.now(),
    };
  }
  
  /**
   * 处理纠正
   */
  private processCorrection(event: LearningEvent): KnowledgeUpdate | null {
    const correction = this.parseCorrection(event.content);
    
    if (!correction) return null;
    
    const entities = this.knowledgeGraph.queryEntities({ entityName: correction.topic });
    
    if (entities.length > 0) {
      const entity = entities[0];
      
      // 更新属性
      return {
        entityId: entity.id,
        operation: 'update',
        data: { properties: { ...entity.properties, ...correction.updates } },
        reason: `纠正: ${correction.reason}`,
        timestamp: Date.now(),
      };
    }
    
    return null;
  }
  
  /**
   * 处理强化
   */
  private processReinforcement(event: LearningEvent): KnowledgeUpdate | null {
    const entities = this.knowledgeGraph.queryEntities({ entityName: event.content });
    
    if (entities.length > 0) {
      const entity = entities[0];
      
      // 强化置信度
      const newConfidence = Math.min(1, entity.confidence + this.config.reinforcementRate);
      
      this.progress.knowledgeUpdated++;
      
      return {
        entityId: entity.id,
        operation: 'update',
        data: { confidence: newConfidence },
        reason: '知识强化',
        timestamp: Date.now(),
      };
    }
    
    return null;
  }
  
  /**
   * 处理遗忘
   */
  private processForgetting(event: LearningEvent): KnowledgeUpdate | null {
    const entities = this.knowledgeGraph.queryEntities({ entityName: event.content });
    
    if (entities.length > 0) {
      const entity = entities[0];
      
      // 降低置信度
      const newConfidence = Math.max(0, entity.confidence - this.config.forgettingRate);
      
      this.progress.knowledgeForgotten++;
      
      return {
        entityId: entity.id,
        operation: 'update',
        data: { confidence: newConfidence },
        reason: '知识遗忘',
        timestamp: Date.now(),
      };
    }
    
    return null;
  }
  
  /**
   * 应用遗忘规则
   */
  applyForgettingRules(): KnowledgeUpdate[] {
    const updates: KnowledgeUpdate[] = [];
    const stats = this.knowledgeGraph.getStats();
    
    // 获取所有实体
    const allEntities = this.knowledgeGraph.queryEntities({ limit: 10000 });
    
    for (const entity of allEntities) {
      let shouldForget = false;
      let reason = '';
      
      for (const rule of this.forgettingRules) {
        switch (rule.type) {
          case 'time_based':
            const age = Date.now() - entity.updatedAt;
            if (age > rule.threshold) {
              shouldForget = true;
              reason = `超过 ${rule.threshold / (24 * 60 * 60 * 1000)} 天未更新`;
            }
            break;
            
          case 'importance_based':
            if (entity.confidence < rule.threshold) {
              shouldForget = true;
              reason = `置信度低于 ${rule.threshold}`;
            }
            break;
        }
        
        if (shouldForget) break;
      }
      
      if (shouldForget) {
        const newConfidence = Math.max(0, entity.confidence - 0.1);
        
        updates.push({
          entityId: entity.id,
          operation: 'update',
          data: { confidence: newConfidence },
          reason: `遗忘规则: ${reason}`,
          timestamp: Date.now(),
        });
      }
    }
    
    this.logger.info('OnlineLearner', `应用遗忘规则: ${updates.length} 条更新`);
    
    return updates;
  }
  
  /**
   * 获取学习进度
   */
  getProgress(): LearningProgress {
    return { ...this.progress };
  }
  
  /**
   * 获取更新历史
   */
  getUpdateHistory(limit: number = 100): KnowledgeUpdate[] {
    return this.updateHistory.slice(-limit);
  }
  
  /**
   * 更新进度
   */
  private updateProgress(): void {
    const stats = this.knowledgeGraph.getStats();
    this.progress.avgConfidence = stats.avgConfidence;
    this.progress.lastUpdated = Date.now();
  }
  
  // ============ 解析方法 ============
  
  private parseFeedback(content: string): { topic: string; positive: boolean } | null {
    // 简化实现
    const positive = content.includes('好') || content.includes('对') || content.includes('正确');
    const topic = content.replace(/好|对|错|误|不|正确|错误/g, '').trim();
    
    return topic ? { topic, positive } : null;
  }
  
  private parseKnowledge(content: string): { name: string; type: any; properties?: any } | null {
    // 简化实现：假设格式为 "name:type"
    const parts = content.split(':');
    
    if (parts.length >= 2) {
      return {
        name: parts[0].trim(),
        type: parts[1].trim() as any,
        properties: parts[2] ? JSON.parse(parts[2]) : {},
      };
    }
    
    return { name: content, type: 'concept' };
  }
  
  private parseCorrection(content: string): { topic: string; updates: any; reason: string } | null {
    // 简化实现
    return {
      topic: content.split(' ')[0],
      updates: { corrected: true },
      reason: '用户纠正',
    };
  }
  
  // ============ 数据持久化 ============
  
  private loadData(): void {
    try {
      const progressFile = path.join(this.dataDir, 'progress.json');
      if (fs.existsSync(progressFile)) {
        this.progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      }
      
      const historyFile = path.join(this.dataDir, 'history.json');
      if (fs.existsSync(historyFile)) {
        this.updateHistory = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      }
      
      this.logger.info('OnlineLearner', '数据加载完成');
    } catch (error) {
      this.logger.warn('OnlineLearner', `数据加载失败: ${error}`);
    }
  }
  
  private saveData(): void {
    try {
      const progressFile = path.join(this.dataDir, 'progress.json');
      fs.writeFileSync(progressFile, JSON.stringify(this.progress, null, 2));
      
      const historyFile = path.join(this.dataDir, 'history.json');
      fs.writeFileSync(historyFile, JSON.stringify(this.updateHistory.slice(-1000), null, 2));
    } catch (error) {
      this.logger.warn('OnlineLearner', `数据保存失败: ${error}`);
    }
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
