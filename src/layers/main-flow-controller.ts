/**
 * 元灵系统 v5.0 主流程控制器
 * 
 * 核心功能：
 * - Session 生命周期管理
 * - 层级执行编排
 * - 三层记忆集成
 * - 沙箱隔离执行
 */

import {
  SessionController,
  SessionState,
  EventType,
  type Session,
  type Event
} from './session-log';

import {
  ThreeLayerMemory,
  MemoryLevel,
  type Memory,
  type MemorySearchResult
} from './ling-mai/three-layer-memory';

import {
  SandboxLayer,
  IsolationLevel,
  type Sandbox,
  type ExecutionResult
} from './ling-sha-7/sandbox-layer';

import {
  ThinkingLayer,
  ThinkingDepth,
  type ThinkingResult
} from './ling-si-0/thinking-layer';

import {
  KnowledgeGraph,
  EntityType,
  RelationType,
  type Entity,
  type Relation
} from './ling-mai/knowledge-graph';

import {
  SemanticChunker,
  HybridSearch,
  type Chunk
} from './ling-mai/semantic-chunker';

import {
  LayerManager,
  type LayerContext,
  type LayerResult,
  type LayerId
} from './unified-interface';

// ============================================================================
// 类型定义
// ============================================================================

export interface MainFlowConfig {
  /** 是否启用 Session 管理 */
  enableSession: boolean;
  /** 是否启用三层记忆 */
  enableThreeLayerMemory: boolean;
  /** 是否启用沙箱隔离 */
  enableSandbox: boolean;
  /** 是否启用知识图谱 */
  enableKnowledgeGraph: boolean;
  /** 是否启用思考协议 */
  enableThinking: boolean;
  /** 是否启用语义缓存 */
  enableSemanticCache: boolean;
  /** 最大 Token 预算 */
  maxTokenBudget: number;
}

export interface MainFlowResult {
  success: boolean;
  data?: any;
  error?: string;
  sessionId: string;
  executionTimeMs: number;
  layerResults: Map<LayerId, LayerResult>;
  memoryStats?: {
    l0: number;
    l1: number;
    l2: number;
  };
  thinkingResult?: ThinkingResult;
}

export interface QueryAnalysis {
  type: QueryType;
  complexity: number;
  entities: string[];
  keywords: string[];
}

export enum QueryType {
  SIMPLE_FACT = 'simple_fact',
  COMPLEX_REASONING = 'complex_reasoning',
  GLOBAL_QUESTION = 'global_question',
  MULTI_HOP = 'multi_hop',
  ACTION = 'action',
  CREATION = 'creation',
  CONVERSATION = 'conversation'
}

export enum RetrievalStrategy {
  VECTOR = 'vector',
  GRAPH = 'graph',
  HYBRID = 'hybrid',
  MULTI_STEP = 'multi_step',
  GLOBAL = 'global',
  DRIFT = 'drift'
}

// ============================================================================
// 查询分析器
// ============================================================================

export class QueryAnalyzer {
  /**
   * 分析查询类型
   */
  analyze(query: string): QueryAnalysis {
    const type = this.detectQueryType(query);
    const complexity = this.calculateComplexity(query);
    const entities = this.extractEntities(query);
    const keywords = this.extractKeywords(query);

    return { type, complexity, entities, keywords };
  }

  /**
   * 检测查询类型
   */
  private detectQueryType(query: string): QueryType {
    const lower = query.toLowerCase();

    // 动作类
    if (this.hasActionVerbs(lower)) {
      return QueryType.ACTION;
    }

    // 创建类
    if (this.hasCreationVerbs(lower)) {
      return QueryType.CREATION;
    }

    // 全局问题
    if (this.hasGlobalKeywords(lower)) {
      return QueryType.GLOBAL_QUESTION;
    }

    // 多跳推理
    if (this.hasMultiHopKeywords(lower)) {
      return QueryType.MULTI_HOP;
    }

    // 复杂推理
    if (this.hasComplexReasoningKeywords(lower)) {
      return QueryType.COMPLEX_REASONING;
    }

    // 简单事实
    if (this.hasSimpleFactKeywords(lower)) {
      return QueryType.SIMPLE_FACT;
    }

    return QueryType.CONVERSATION;
  }

  private hasActionVerbs(query: string): boolean {
    const verbs = ['执行', '运行', '调用', '发送', '创建', '删除', '修改', 'execute', 'run', 'call', 'send', 'create', 'delete', 'modify'];
    return verbs.some(v => query.includes(v));
  }

  private hasCreationVerbs(query: string): boolean {
    const verbs = ['写', '生成', '创建', '设计', '实现', 'write', 'generate', 'create', 'design', 'implement'];
    return verbs.some(v => query.includes(v));
  }

  private hasGlobalKeywords(query: string): boolean {
    const keywords = ['所有', '全部', '整体', '总结', '概览', 'all', 'total', 'overall', 'summary', 'overview'];
    return keywords.some(k => query.includes(k));
  }

  private hasMultiHopKeywords(query: string): boolean {
    const keywords = ['的', '相关', '关联', '影响', '导致', 'of', 'related', 'associated', 'affect', 'cause'];
    const count = keywords.filter(k => query.includes(k)).length;
    return count >= 2;
  }

  private hasComplexReasoningKeywords(query: string): boolean {
    const keywords = ['为什么', '如何', '分析', '比较', '对比', 'why', 'how', 'analyze', 'compare', 'contrast'];
    return keywords.some(k => query.includes(k));
  }

  private hasSimpleFactKeywords(query: string): boolean {
    const keywords = ['是什么', '什么是', '多少', '哪里', 'when', 'what', 'how many', 'where'];
    return keywords.some(k => query.includes(k));
  }

  /**
   * 计算复杂度
   */
  private calculateComplexity(query: string): number {
    let score = 0;

    // 长度
    score += Math.min(query.length / 200, 0.3);

    // 问题数量
    const questions = (query.match(/[？?]/g) || []).length;
    score += Math.min(questions * 0.1, 0.3);

    // 连接词
    const connectors = ['并且', '或者', '但是', '以及', 'and', 'or', 'but', 'as well as'];
    score += Math.min(connectors.filter(c => query.includes(c)).length * 0.1, 0.4);

    return Math.min(score, 1);
  }

  /**
   * 提取实体
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];

    // 英文实体
    const englishEntities = query.match(/[A-Z][a-zA-Z0-9]+/g) || [];
    entities.push(...englishEntities);

    // 中文实体（简化）
    const chineseEntities = query.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    entities.push(...chineseEntities.slice(0, 5));

    return [...new Set(entities)];
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string[] {
    // 简化实现：分词后过滤停用词
    const stopWords = new Set(['的', '是', '在', '有', '和', '了', 'the', 'is', 'in', 'has', 'and']);
    
    return query
      .split(/[\s,，。！？.!?]+/)
      .filter(w => w.length > 1 && !stopWords.has(w.toLowerCase()))
      .slice(0, 10);
  }
}

// ============================================================================
// 检索策略选择器
// ============================================================================

export class RetrievalStrategySelector {
  /**
   * 选择检索策略
   */
  select(queryType: QueryType, complexity: number): RetrievalStrategy {
    switch (queryType) {
      case QueryType.SIMPLE_FACT:
        return RetrievalStrategy.VECTOR;

      case QueryType.COMPLEX_REASONING:
        return complexity > 0.7 ? RetrievalStrategy.MULTI_STEP : RetrievalStrategy.HYBRID;

      case QueryType.GLOBAL_QUESTION:
        return RetrievalStrategy.GLOBAL;

      case QueryType.MULTI_HOP:
        return RetrievalStrategy.DRIFT;

      case QueryType.ACTION:
      case QueryType.CREATION:
        return RetrievalStrategy.HYBRID;

      default:
        return RetrievalStrategy.HYBRID;
    }
  }
}

// ============================================================================
// CRAG 纠错器
// ============================================================================

export class CRAGEvaluator {
  /**
   * 评估检索结果
   */
  evaluate(query: string, results: any[]): 'CORRECT' | 'INCORRECT' | 'AMBIGUOUS' {
    if (results.length === 0) {
      return 'INCORRECT';
    }

    // 计算平均相关性
    const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;

    if (avgScore >= 0.7) {
      return 'CORRECT';
    } else if (avgScore >= 0.4) {
      return 'AMBIGUOUS';
    } else {
      return 'INCORRECT';
    }
  }

  /**
   * 知识提炼
   */
  refine(results: any[]): any[] {
    // 过滤低分结果
    return results.filter(r => (r.score || 0) >= 0.5);
  }

  /**
   * 合并结果
   */
  combine(internal: any[], external: any[]): any[] {
    const combined = [...internal, ...external];
    return combined.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
  }
}

// ============================================================================
// 语义缓存
// ============================================================================

export class SemanticCache {
  private cache: Map<string, { result: any; embedding: number[]; timestamp: number }> = new Map();
  private ttl: number = 3600000; // 1 小时

  /**
   * 检查缓存
   */
  check(query: string, queryEmbedding: number[], threshold: number = 0.95): any | null {
    for (const [cachedQuery, entry] of this.cache) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= threshold && Date.now() - entry.timestamp < this.ttl) {
        return entry.result;
      }
    }
    return null;
  }

  /**
   * 存储缓存
   */
  store(query: string, result: any, embedding: number[]): void {
    this.cache.set(query, {
      result,
      embedding,
      timestamp: Date.now()
    });

    // 清理过期缓存
    this.cleanup();
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
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
}

// ============================================================================
// 主流程控制器
// ============================================================================

export class MainFlowController {
  private config: MainFlowConfig;
  private sessionController: SessionController;
  private threeLayerMemory: ThreeLayerMemory;
  private sandboxLayer: SandboxLayer;
  private thinkingLayer: ThinkingLayer;
  private knowledgeGraph: KnowledgeGraph;
  private hybridSearch: HybridSearch;
  private queryAnalyzer: QueryAnalyzer;
  private strategySelector: RetrievalStrategySelector;
  private cragEvaluator: CRAGEvaluator;
  private semanticCache: SemanticCache;
  private layerManager: LayerManager;

  constructor(config: Partial<MainFlowConfig> = {}) {
    this.config = {
      enableSession: config.enableSession ?? true,
      enableThreeLayerMemory: config.enableThreeLayerMemory ?? true,
      enableSandbox: config.enableSandbox ?? true,
      enableKnowledgeGraph: config.enableKnowledgeGraph ?? true,
      enableThinking: config.enableThinking ?? true,
      enableSemanticCache: config.enableSemanticCache ?? true,
      maxTokenBudget: config.maxTokenBudget ?? 4000
    };

    // 初始化组件
    this.sessionController = new SessionController();
    this.threeLayerMemory = new ThreeLayerMemory();
    this.sandboxLayer = new SandboxLayer();
    this.thinkingLayer = new ThinkingLayer();
    this.knowledgeGraph = new KnowledgeGraph();
    this.hybridSearch = new HybridSearch();
    this.queryAnalyzer = new QueryAnalyzer();
    this.strategySelector = new RetrievalStrategySelector();
    this.cragEvaluator = new CRAGEvaluator();
    this.semanticCache = new SemanticCache();
    this.layerManager = new LayerManager();
  }

  /**
   * 处理用户消息（主入口）
   */
  async processMessage(userMessage: string, metadata: Record<string, any> = {}): Promise<MainFlowResult> {
    const startTime = Date.now();
    const layerResults = new Map<LayerId, LayerResult>();

    // 1. 创建 Session
    const session = this.config.enableSession
      ? this.sessionController.startSession({ userMessage, ...metadata })
      : null;

    const sessionId = session?.id || `temp-${Date.now()}`;

    try {
      // 2. 构建上下文
      let context: LayerContext = {
        sessionId,
        messageId: `msg-${Date.now()}`,
        userMessage,
        metadata: {}
      };

      // 3. L6 灵识层：环境感知 + 三层记忆加载
      const l6Result = await this.executeL6(context);
      layerResults.set('L6', l6Result);
      context = this.updateContext(context, l6Result);

      // 4. L0 灵思层：思考协议
      const l0Result = await this.executeL0(context);
      layerResults.set('L0', l0Result);
      context = this.updateContext(context, l0Result);

      // 5. L1 灵枢层：决策中心 + 查询分析
      const l1Result = await this.executeL1(context);
      layerResults.set('L1', l1Result);
      context = this.updateContext(context, l1Result);

      // 6. L2 灵脉层：执行引擎 + 混合检索 + CRAG 纠错
      const l2Result = await this.executeL2(context);
      layerResults.set('L2', l2Result);
      context = this.updateContext(context, l2Result);

      // 7. L7 沙箱层：隔离执行
      const l7Result = await this.executeL7(context);
      layerResults.set('L7', l7Result);
      context = this.updateContext(context, l7Result);

      // 8. L3 灵躯层：工具执行
      const l3Result = await this.executeL3(context);
      layerResults.set('L3', l3Result);
      context = this.updateContext(context, l3Result);

      // 9. L4 灵盾层：安全验证
      const l4Result = await this.executeL4(context);
      layerResults.set('L4', l4Result);
      context = this.updateContext(context, l4Result);

      // 10. L5 灵韵层：反馈调节 + 记忆晋升
      const l5Result = await this.executeL5(context);
      layerResults.set('L5', l5Result);

      // 11. 完成 Session
      if (session) {
        this.sessionController.completeSession(sessionId);
      }

      // 12. 构建结果
      const memoryStats = this.threeLayerMemory.getStats();

      return {
        success: true,
        data: l5Result.data,
        sessionId,
        executionTimeMs: Date.now() - startTime,
        layerResults,
        memoryStats: {
          l0: memoryStats.l0.count,
          l1: memoryStats.l1.count,
          l2: memoryStats.l2.count
        },
        thinkingResult: (l0Result.data as any)?.thinkingResult
      };

    } catch (error) {
      // 失败处理
      if (session) {
        this.sessionController.failSession(sessionId, String(error));
      }

      return {
        success: false,
        error: String(error),
        sessionId,
        executionTimeMs: Date.now() - startTime,
        layerResults
      };
    }
  }

  /**
   * L6 灵识层：环境感知 + 三层记忆加载
   */
  private async executeL6(context: LayerContext): Promise<LayerResult> {
    const startTime = Date.now();

    // 加载三层记忆
    const residentMemory = this.config.enableThreeLayerMemory
      ? this.threeLayerMemory.getResidentMemory()
      : [];

    // 搜索相关记忆
    const relevantMemories = this.config.enableThreeLayerMemory
      ? this.threeLayerMemory.search(context.userMessage, 5)
      : [];

    return {
      success: true,
      layerId: 'L6',
      data: {
        residentMemory,
        relevantMemories,
        memoryCount: residentMemory.length
      },
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * L0 灵思层：思考协议
   */
  private async executeL0(context: LayerContext): Promise<LayerResult> {
    const startTime = Date.now();

    if (!this.config.enableThinking) {
      return {
        success: true,
        layerId: 'L0',
        data: { thinkingResult: null } as any,
        executionTimeMs: Date.now() - startTime
      };
    }

    // 执行思考
    const thinkingResult = await this.thinkingLayer.think(context.userMessage);

    return {
      success: true,
      layerId: 'L0',
      data: { thinkingResult } as any,
      confidence: thinkingResult.confidence,
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * L1 灵枢层：决策中心 + 查询分析
   */
  private async executeL1(context: LayerContext): Promise<LayerResult> {
    const startTime = Date.now();

    // 分析查询
    const queryAnalysis = this.queryAnalyzer.analyze(context.userMessage);

    // 选择检索策略
    const strategy = this.strategySelector.select(queryAnalysis.type, queryAnalysis.complexity);

    return {
      success: true,
      layerId: 'L1',
      data: {
        queryAnalysis,
        strategy,
        entities: queryAnalysis.entities,
        keywords: queryAnalysis.keywords
      } as any,
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * L2 灵脉层：执行引擎 + 混合检索 + CRAG 纠错
   */
  private async executeL2(context: LayerContext): Promise<LayerResult> {
    const startTime = Date.now();

    const l1Data = context.metadata?.L1 as any;
    const strategy = l1Data?.strategy || RetrievalStrategy.HYBRID;
    const query = context.userMessage;

    // 1. 初始检索
    let searchResults: any[] = [];

    // 根据策略执行检索
    switch (strategy) {
      case RetrievalStrategy.VECTOR:
        // 向量检索
        break;

      case RetrievalStrategy.GRAPH:
        // 图检索
        if (this.config.enableKnowledgeGraph) {
          const l1Data = context.metadata?.L1 as any;
          const entities = l1Data?.entities || [];
          for (const entity of entities) {
            const graphEntity = this.knowledgeGraph.queryEntity(entity);
            if (graphEntity) {
              const relations = this.knowledgeGraph.queryRelations(graphEntity.id);
              searchResults.push({ entity: graphEntity, relations, score: 0.8 });
            }
          }
        }
        break;

      case RetrievalStrategy.HYBRID:
      default:
        // 混合检索
        const memories = this.config.enableThreeLayerMemory
          ? this.threeLayerMemory.search(query, 10)
          : [];
        searchResults = memories.map(m => ({ chunk: m.memory, score: m.score }));
        break;
    }

    // 2. CRAG 纠错
    const evaluation = this.cragEvaluator.evaluate(query, searchResults);

    let refinedResults = searchResults;
    let cragAction = 'none';

    switch (evaluation) {
      case 'CORRECT':
        refinedResults = this.cragEvaluator.refine(searchResults);
        cragAction = 'refine';
        break;

      case 'INCORRECT':
        // 触发外部搜索（模拟）
        cragAction = 'web_search';
        break;

      case 'AMBIGUOUS':
        cragAction = 'combine';
        break;
    }

    return {
      success: true,
      layerId: 'L2',
      data: {
        searchResults: refinedResults,
        strategy,
        evaluation,
        cragAction,
        resultCount: refinedResults.length
      },
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * L7 沙箱层：隔离执行
   */
  private async executeL7(context: LayerContext): Promise<LayerResult> {
    const startTime = Date.now();

    if (!this.config.enableSandbox) {
      return {
        success: true,
        layerId: 'L7' as any,
        data: { sandbox: null } as any,
        executionTimeMs: Date.now() - startTime
      };
    }

    // 根据查询类型选择隔离级别
    const l1Data = context.metadata?.L1 as any;
    const queryType = l1Data?.queryAnalysis?.type;
    let isolationLevel = IsolationLevel.PROCESS;

    if (queryType === QueryType.ACTION) {
      isolationLevel = IsolationLevel.CONTAINER;
    }

    // 创建沙箱
    const sandbox = this.sandboxLayer.createSandbox(isolationLevel);

    return {
      success: true,
      layerId: 'L7' as any,
      data: {
        sandbox: {
          id: sandbox.id,
          level: sandbox.level,
          status: sandbox.status
        }
      } as any,
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * L3 灵躯层：工具执行
   */
  private async executeL3(context: LayerContext): Promise<LayerResult> {
    const startTime = Date.now();

    // 模拟工具执行
    const tools = this.detectRequiredTools(context.userMessage);

    return {
      success: true,
      layerId: 'L3',
      data: {
        tools,
        executed: false,
        reason: 'Simulation mode'
      },
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * L4 灵盾层：安全验证
   */
  private async executeL4(context: LayerContext): Promise<LayerResult> {
    const startTime = Date.now();

    // 安全检查
    const riskLevel = this.assessRisk(context.userMessage);

    return {
      success: true,
      layerId: 'L4',
      data: {
        riskLevel,
        passed: riskLevel !== 'high'
      },
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * L5 灵韵层：反馈调节 + 记忆晋升
   */
  private async executeL5(context: LayerContext): Promise<LayerResult> {
    const startTime = Date.now();

    // 1. 添加新记忆
    if (this.config.enableThreeLayerMemory) {
      this.threeLayerMemory.add(
        JSON.stringify({
          query: context.userMessage,
          timestamp: Date.now()
        }),
        MemoryLevel.L0_SESSION
      );

      // 2. 检查晋升
      const stats = this.threeLayerMemory.getStats();
      if (stats.l0.count > 50) {
        // 触发晋升逻辑
      }
    }

    // 3. 构建最终结果
    const l0Data = context.metadata?.L0 as any;
    const result = {
      response: this.generateResponse(context),
      confidence: l0Data?.thinkingResult?.confidence || 0.8
    };

    return {
      success: true,
      layerId: 'L5',
      data: result,
      confidence: result.confidence,
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * 更新上下文
   */
  private updateContext(context: LayerContext, result: LayerResult): LayerContext {
    return {
      ...context,
      previousResult: result,
      metadata: {
        ...context.metadata,
        [result.layerId]: result.data
      }
    };
  }

  /**
   * 检测所需工具
   */
  private detectRequiredTools(query: string): string[] {
    const tools: string[] = [];
    const lower = query.toLowerCase();

    if (lower.includes('搜索') || lower.includes('search')) {
      tools.push('web_search');
    }
    if (lower.includes('文件') || lower.includes('file')) {
      tools.push('file_manager');
    }
    if (lower.includes('代码') || lower.includes('code')) {
      tools.push('code_executor');
    }

    return tools;
  }

  /**
   * 评估风险
   */
  private assessRisk(query: string): 'low' | 'medium' | 'high' {
    const highRiskKeywords = ['删除', '格式化', 'rm', 'delete', 'format'];
    const mediumRiskKeywords = ['修改', '更新', 'modify', 'update'];

    const lower = query.toLowerCase();

    if (highRiskKeywords.some(k => lower.includes(k))) {
      return 'high';
    }
    if (mediumRiskKeywords.some(k => lower.includes(k))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 生成响应
   */
  private generateResponse(context: LayerContext): string {
    const l2Data = context.metadata?.L2 as any;
    const l0Data = context.metadata?.L0 as any;
    const searchResults = l2Data?.searchResults || [];
    const thinkingResult = l0Data?.thinkingResult;

    if (searchResults.length > 0) {
      return `基于检索到的 ${searchResults.length} 条相关信息，我为您找到了相关答案。`;
    }

    return '我已理解您的问题，正在为您处理。';
  }

  /**
   * 暂停 Session
   */
  pauseSession(sessionId: string): void {
    this.sessionController.pauseSession(sessionId);
  }

  /**
   * 恢复 Session
   */
  resumeSession(sessionId: string): Session | undefined {
    return this.sessionController.resumeSession(sessionId);
  }

  /**
   * 获取统计
   */
  getStats(): {
    sessions: any;
    memory: any;
    cache: any;
  } {
    return {
      sessions: this.sessionController.getStats(),
      memory: this.threeLayerMemory.getStats(),
      cache: { enabled: this.config.enableSemanticCache }
    };
  }
}

// 默认导出
export default MainFlowController;
