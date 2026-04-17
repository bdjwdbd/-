/**
 * 元灵系统集成层
 * 
 * 将基础设施模块集成到主系统
 * - MemoryStore：记忆存储
 * - ForgetDetector：遗忘检测
 * - VectorStore：向量搜索
 * - 学习系统：知识图谱、推理引擎等
 */

import { 
  MemoryStore, 
  ForgetDetector,
  ConversationSummarizer,
  SmartTagger,
  VectorStore,
  PredictiveMaintenance,
  HealthChecker,
  RBACManager,
  ContextGuard,
  CloudSync,
  StructuredLogger
} from './infrastructure';

import {
  KnowledgeGraph,
  MetaCognition,
  InferenceEngine,
  OnlineLearner,
  CausalReasoner,
  AutonomousLearner,
  KnowledgeTransfer
} from './infrastructure';

// ============ 类型定义 ============

export interface IntegratedSystemConfig {
  memoryDir?: string;
  vectorDimension?: number;
  enableHealthCheck?: boolean;
  enableCloudSync?: boolean;
  enableLearning?: boolean;
}

export interface SystemHealth {
  memory: {
    total: number;
    avgImportance: number;
    avgConfidence: number;
  };
  vector: {
    total: number;
    dimension: number;
  };
  learning: {
    knowledgeNodes: number;
    inferences: number;
  };
  overall: number;
}

// ============ 集成系统类 ============

export class IntegratedSystem {
  private logger: StructuredLogger;
  private config: Required<IntegratedSystemConfig>;
  private performanceMonitor: any = null;
  
  // 记忆系统
  private memoryStore: MemoryStore;
  private forgetDetector: ForgetDetector;
  private conversationSummarizer: ConversationSummarizer;
  private smartTagger: SmartTagger;
  private vectorStore: VectorStore;
  private vectorizer: any;
  
  // 维护系统
  private predictiveMaintenance: PredictiveMaintenance;
  private healthChecker: HealthChecker;
  
  // 安全系统
  private rbacManager: RBACManager;
  private contextGuard: ContextGuard;
  
  // 同步系统
  private cloudSync: CloudSync;
  
  // 学习系统
  private knowledgeGraph: KnowledgeGraph;
  private metaCognition: MetaCognition;
  private inferenceEngine: InferenceEngine;
  private _onlineLearner: OnlineLearner;
  private causalReasoner: CausalReasoner;
  private autonomousLearner: AutonomousLearner;
  private knowledgeTransfer: KnowledgeTransfer;
  
  // 缓存系统
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();
  
  /** 设置 PerformanceMonitor */
  setPerformanceMonitor(monitor: any): void {
    this.performanceMonitor = monitor;
  }
  
  /** 获取 PerformanceMonitor */
  getPerformanceMonitor(): any {
    return this.performanceMonitor;
  }
  
  /** 记录缓存命中 */
  recordCacheHit(): void {
    if (this.performanceMonitor && typeof this.performanceMonitor.record === 'function') {
      this.performanceMonitor.record('cache_hit', 1);
    }
  }
  
  /** 记录缓存未命中 */
  recordCacheMiss(): void {
    if (this.performanceMonitor && typeof this.performanceMonitor.record === 'function') {
      this.performanceMonitor.record('cache_miss', 1);
    }
  }
  
  /** 获取在线学习器实例 */
  get onlineLearner(): OnlineLearner {
    return this._onlineLearner;
  }
  
  private initialized: boolean = false;

  constructor(config: IntegratedSystemConfig = {}) {
    this.config = {
      memoryDir: config.memoryDir || './memory',
      vectorDimension: config.vectorDimension || 128,
      enableHealthCheck: config.enableHealthCheck ?? true,
      enableCloudSync: config.enableCloudSync ?? false,
      enableLearning: config.enableLearning ?? true,
    };
    
    this.logger = new StructuredLogger({ minLevel: 'info' });
    
    // 初始化记忆系统
    this.memoryStore = new MemoryStore(this.logger);
    this.forgetDetector = new ForgetDetector(this.logger, this.memoryStore);
    this.conversationSummarizer = new ConversationSummarizer(this.logger);
    this.smartTagger = new SmartTagger(this.logger);
    this.vectorStore = new VectorStore(this.logger, { 
      dimension: this.config.vectorDimension 
    });
    this.vectorizer = { vectorize: (text: string) => [] };
    
    // 初始化维护系统
    this.predictiveMaintenance = new PredictiveMaintenance(this.logger, this.memoryStore);
    this.healthChecker = new HealthChecker(this.logger, this.memoryStore);
    
    // 初始化安全系统
    this.rbacManager = new RBACManager(this.logger);
    this.contextGuard = new ContextGuard(this.logger);
    
    // 初始化同步系统
    this.cloudSync = new CloudSync(this.logger, { 
      enabled: this.config.enableCloudSync 
    });
    
    // 初始化学习系统
    this.knowledgeGraph = new KnowledgeGraph(this.logger, this.config.memoryDir);
    this.metaCognition = new MetaCognition(this.logger, this.knowledgeGraph);
    this.inferenceEngine = new InferenceEngine(this.logger, this.knowledgeGraph);
    this._onlineLearner = new OnlineLearner(this.logger, this.knowledgeGraph);
    this.causalReasoner = new CausalReasoner(this.logger, this.knowledgeGraph);
    this.autonomousLearner = new AutonomousLearner(this.logger, this.knowledgeGraph, this.metaCognition, this.config.memoryDir);
    this.knowledgeTransfer = new KnowledgeTransfer(this.logger, this.knowledgeGraph);
  }

  // ============ 初始化 ============

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.info('IntegratedSystem', '初始化集成系统...');

    // 初始化记忆存储
    await this.memoryStore.initialize();
    
    // 添加默认用户
    this.rbacManager.addUser('default', '默认用户', 'admin');
    
    this.initialized = true;
    this.logger.info('IntegratedSystem', '集成系统初始化完成');
  }

  // ============ 记忆操作 ============

  /**
   * 添加记忆
   */
  async addMemory(
    content: string, 
    type: 'fact' | 'event' | 'preference' | 'skill' | 'conversation' | 'insight' | 'task' = 'fact',
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    await this.ensureInitialized();
    
    // 安全检查
    const guardResult = this.contextGuard.check(content);
    if (!guardResult.safe) {
      this.logger.warn('IntegratedSystem', `内容安全检查未通过: ${guardResult.reason}`);
    }
    
    // 自动标签
    const tags = this.smartTagger.autoTag(content);
    
    // 添加记忆
    const id = await this.memoryStore.add({
      content: guardResult.sanitizedContent || content,
      type,
      tags,
      metadata,
      confidence: 0.8,
      source: 'user',
      importance: this.calculateImportance(content, type)
    });
    
    // 添加向量
    const vector = this.vectorizer.vectorize(content);
    this.vectorStore.add(id, vector, { type, tags });
    
    // 添加到知识图谱
    if (this.config.enableLearning) {
      this.knowledgeGraph.addEntity({
        name: content.substring(0, 50),
        type: type as any,
        properties: { tags, ...metadata },
        confidence: 0.8,
        source: 'user'
      });
    }
    
    return id;
  }

  /**
   * 搜索记忆
   */
  async searchMemory(query: string, options?: {
    type?: 'fact' | 'event' | 'preference' | 'skill' | 'conversation' | 'insight' | 'task';
    tags?: string[];
    limit?: number;
  }): Promise<Array<{ memory: any; score: number }>> {
    await this.ensureInitialized();
    
    // 检查缓存
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.recordCacheHit();
      return cached;
    }
    this.recordCacheMiss();
    
    // 文本搜索
    const textResults = await this.memoryStore.search(query, options as any);
    
    // 向量搜索
    const queryVector = this.vectorizer.vectorize(query);
    const vectorResults = this.vectorStore.search(queryVector, { 
      topK: options?.limit || 10 
    });
    
    // 合并结果
    const mergedResults = new Map<string, { memory: any; score: number }>();
    
    for (const result of textResults) {
      mergedResults.set(result.memory.id, {
        memory: result.memory,
        score: result.score
      });
    }
    
    for (const result of vectorResults) {
      const memory = await this.memoryStore.get(result.id);
      if (memory && !mergedResults.has(result.id)) {
        mergedResults.set(result.id, {
          memory,
          score: result.score
        });
      }
    }
    
    const results = Array.from(mergedResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.limit || 10);
    
    // 存入缓存
    this.setCache(cacheKey, results, 60000); // 1分钟缓存
    
    return results;
  }
  
  /**
   * 从缓存获取
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
  
  /**
   * 存入缓存
   */
  private setCache(key: string, value: any, ttlMs: number): void {
    // LRU 淘汰
    if (this.cache.size >= 100) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  /**
   * 获取记忆
   */
  async getMemory(id: string): Promise<any | null> {
    await this.ensureInitialized();
    return this.memoryStore.get(id);
  }

  /**
   * 删除记忆
   */
  async deleteMemory(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const result = await this.memoryStore.delete(id);
    if (result) {
      this.vectorStore.delete(id);
    }
    return result;
  }

  // ============ 对话处理 ============

  /**
   * 处理对话
   */
  async processConversation(
    messages: Array<{ role: string; content: string; timestamp?: number }>
  ): Promise<{
    summary: string;
    keyPoints: string[];
    entities: string[];
    memories: string[];
  }> {
    await this.ensureInitialized();
    
    // 生成摘要
    const summary = await this.conversationSummarizer.summarize(
      messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp || Date.now()
      }))
    );
    
    // 添加对话记忆
    const memoryId = await this.addMemory(
      summary.summary,
      'conversation',
      { keyPoints: summary.keyPoints }
    );
    
    return {
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      entities: summary.entities.map(e => e.name),
      memories: [memoryId]
    };
  }

  // ============ 学习系统 ============

  /**
   * 推理
   */
  async infer(premises: string[]): Promise<{
    conclusions: string[];
    confidence: number;
  }> {
    await this.ensureInitialized();
    
    const conclusions: string[] = [];
    let totalConfidence = 0;
    
    for (const premise of premises) {
      const chain = this.inferenceEngine.infer(premise);
      for (const step of chain.steps) {
        conclusions.push(step.conclusion);
        totalConfidence += step.confidence;
      }
    }
    
    const avgConfidence = conclusions.length > 0
      ? totalConfidence / conclusions.length
      : 0;
    
    return { conclusions, confidence: avgConfidence };
  }

  /**
   * 元认知检查
   */
  async metaCheck(query: string): Promise<{
    known: boolean;
    confidence: number;
    gaps: string[];
  }> {
    await this.ensureInitialized();
    
    const assessment = this.metaCognition.assessConfidence(query);
    
    return {
      known: assessment.confidence > 0.5,
      confidence: assessment.confidence,
      gaps: assessment.gaps
    };
  }

  /**
   * 自主学习
   */
  async learn(goal: string): Promise<{
    progress: number;
    learned: string[];
  }> {
    await this.ensureInitialized();
    
    const session = this.autonomousLearner.startSession(goal);
    
    return {
      progress: 0.5,
      learned: session.insights
    };
  }

  // ============ 维护操作 ============

  /**
   * 健康检查
   */
  async checkHealth(): Promise<SystemHealth> {
    await this.ensureInitialized();
    
    const report = await this.healthChecker.check();
    const memoryStats = await this.memoryStore.getStats();
    const vectorStats = this.vectorStore.getStats();
    const graphStats = this.knowledgeGraph.getStats();
    
    return {
      memory: {
        total: memoryStats.total,
        avgImportance: memoryStats.avgImportance,
        avgConfidence: memoryStats.avgConfidence
      },
      vector: {
        total: vectorStats.total,
        dimension: vectorStats.dimension
      },
      learning: {
        knowledgeNodes: graphStats.totalEntities,
        inferences: 0
      },
      overall: report.overall === 'healthy' ? 1 : 
               report.overall === 'warning' ? 0.7 : 0.3
    };
  }

  /**
   * 遗忘检测
   */
  async detectForgettable(): Promise<{
    count: number;
    memories: string[];
  }> {
    await this.ensureInitialized();
    
    const results = await this.forgetDetector.detect();
    return {
      count: results.length,
      memories: results.map(r => r.memoryId)
    };
  }

  /**
   * 因果分析
   */
  async analyzeCausality(effect: string): Promise<{
    causes: string[];
    confidence: number;
  }> {
    await this.ensureInitialized();
    
    const result = this.causalReasoner.discoverCauses(effect);
    return {
      causes: result.causes.map((c: any) => c.node?.name || 'unknown'),
      confidence: result.confidence
    };
  }

  /**
   * 知识迁移
   */
  async transferKnowledge(
    sourceDomain: string,
    targetDomain: string
  ): Promise<{
    transferred: number;
    analogies: string[];
  }> {
    await this.ensureInitialized();
    
    const result = this.knowledgeTransfer.transfer(sourceDomain, targetDomain);
    return {
      transferred: result.transferredKnowledge?.length || 0,
      analogies: []
    };
  }

  /**
   * 运行维护
   */
  async runMaintenance(): Promise<{
    cleaned: number;
    archived: number;
    synced: number;
  }> {
    await this.ensureInitialized();
    
    const plans = await this.predictiveMaintenance.generatePlan();
    let cleaned = 0;
    let archived = 0;
    let synced = 0;
    
    for (const plan of plans) {
      if (plan.type === 'cleanup') {
        await this.predictiveMaintenance.executePlan(plan);
        cleaned++;
      } else if (plan.type === 'archive') {
        await this.predictiveMaintenance.executePlan(plan);
        archived++;
      } else if (plan.type === 'backup') {
        const memories = await this.memoryStore.exportAll();
        await this.cloudSync.sync(memories);
        synced++;
      }
    }
    
    return { cleaned, archived, synced };
  }

  // ============ 权限操作 ============

  /**
   * 检查权限
   */
  checkPermission(userId: string, action: string, resource: string): boolean {
    return this.rbacManager.checkAccess({
      userId,
      action: action as any,
      resource
    }).allowed;
  }

  // ============ 辅助方法 ============

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private calculateImportance(content: string, type: 'fact' | 'event' | 'preference' | 'skill' | 'conversation' | 'insight' | 'task'): number {
    let importance = 0.5;
    
    // 根据类型调整
    switch (type) {
      case 'preference':
        importance = 0.8;
        break;
      case 'fact':
        importance = 0.7;
        break;
      case 'insight':
        importance = 0.9;
        break;
      case 'task':
        importance = 0.6;
        break;
    }
    
    // 根据内容长度调整
    if (content.length > 100) {
      importance += 0.1;
    }
    
    return Math.min(1, importance);
  }

  // ============ 关闭 ============

  async shutdown(): Promise<void> {
    this.logger.info('IntegratedSystem', '关闭集成系统...');
    
    // 同步数据
    if (this.config.enableCloudSync) {
      const memories = await this.memoryStore.exportAll();
      await this.cloudSync.sync(memories);
    }
    
    // 关闭记忆存储
    await this.memoryStore.close();
    
    this.initialized = false;
    this.logger.info('IntegratedSystem', '集成系统已关闭');
  }
}
