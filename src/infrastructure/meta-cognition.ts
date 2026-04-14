/**
 * 元认知模块
 * 
 * 功能：
 * 1. 知识边界检测
 * 2. 置信度评估
 * 3. 不确定性量化
 * 4. 自我反思
 */

import { StructuredLogger } from './index';
import { KnowledgeGraph } from './knowledge-graph';

// ============ 类型定义 ============

export interface KnowledgeBoundary {
  domain: string;
  knownTopics: string[];
  unknownTopics: string[];
  confidence: number;
  lastAssessed: number;
}

export interface ConfidenceAssessment {
  topic: string;
  confidence: number;
  evidence: string[];
  gaps: string[];
  recommendation: string;
}

export interface UncertaintyQuantification {
  type: UncertaintyType;
  level: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export type UncertaintyType = 
  | 'knowledge_gap'      // 知识缺口
  | 'ambiguity'          // 歧义
  | 'conflict'           // 冲突
  | 'outdated'           // 过时
  | 'insufficient_data'; // 数据不足

export interface SelfReflection {
  timestamp: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  actionItems: string[];
}

export interface MetaCognitionReport {
  generatedAt: number;
  boundaries: KnowledgeBoundary[];
  assessments: ConfidenceAssessment[];
  uncertainties: UncertaintyQuantification[];
  reflection: SelfReflection;
  overallScore: number;
}

// ============ 元认知模块 ============

export class MetaCognition {
  private logger: StructuredLogger;
  private knowledgeGraph: KnowledgeGraph;
  
  // 知识边界
  private boundaries: Map<string, KnowledgeBoundary> = new Map();
  
  // 已知领域
  private knownDomains: Set<string> = new Set([
    'programming',
    'architecture',
    'memory_management',
    'search',
    'optimization',
    'security',
    'testing',
  ]);
  
  // 不确定领域
  private uncertainDomains: Set<string> = new Set([
    'real_time_learning',
    'causal_reasoning',
    'creative_thinking',
    'emotional_intelligence',
  ]);
  
  constructor(logger: StructuredLogger, knowledgeGraph: KnowledgeGraph) {
    this.logger = logger;
    this.knowledgeGraph = knowledgeGraph;
    this.initializeBoundaries();
  }
  
  /**
   * 初始化知识边界
   */
  private initializeBoundaries(): void {
    // 编程领域
    this.boundaries.set('programming', {
      domain: 'programming',
      knownTopics: ['typescript', 'python', 'architecture', 'patterns'],
      unknownTopics: ['rust', 'go', 'assembly'],
      confidence: 0.85,
      lastAssessed: Date.now(),
    });
    
    // 记忆管理领域
    this.boundaries.set('memory_management', {
      domain: 'memory_management',
      knownTopics: ['vector_search', 'caching', 'compression', 'indexing'],
      unknownTopics: ['neuromorphic_memory', 'quantum_memory'],
      confidence: 0.75,
      lastAssessed: Date.now(),
    });
    
    // 搜索领域
    this.boundaries.set('search', {
      domain: 'search',
      knownTopics: ['hybrid_search', 'rrf', 'query_understanding', 'feedback_learning'],
      unknownTopics: ['quantum_search', 'semantic_web'],
      confidence: 0.80,
      lastAssessed: Date.now(),
    });
  }
  
  /**
   * 评估置信度
   */
  assessConfidence(topic: string): ConfidenceAssessment {
    const evidence: string[] = [];
    const gaps: string[] = [];
    let confidence = 0.5;
    
    // 检查知识图谱
    const entities = this.knowledgeGraph.queryEntities({ entityName: topic });
    if (entities.length > 0) {
      evidence.push(`知识图谱中有 ${entities.length} 个相关实体`);
      confidence += 0.2;
    }
    
    // 检查已知领域
    for (const [domain, boundary] of this.boundaries) {
      if (boundary.knownTopics.some(t => topic.toLowerCase().includes(t.toLowerCase()))) {
        evidence.push(`属于已知领域: ${domain}`);
        confidence += 0.15;
      }
      if (boundary.unknownTopics.some(t => topic.toLowerCase().includes(t.toLowerCase()))) {
        gaps.push(`属于未知领域: ${domain}`);
        confidence -= 0.2;
      }
    }
    
    // 检查不确定领域
    if (this.uncertainDomains.has(topic.toLowerCase())) {
      gaps.push('属于不确定领域');
      confidence -= 0.1;
    }
    
    // 限制置信度范围
    confidence = Math.max(0, Math.min(1, confidence));
    
    // 生成建议
    let recommendation = '';
    if (confidence < 0.3) {
      recommendation = '建议明确告知用户此领域知识不足';
    } else if (confidence < 0.6) {
      recommendation = '建议谨慎回答，并说明不确定性';
    } else if (confidence < 0.8) {
      recommendation = '可以回答，但建议验证关键信息';
    } else {
      recommendation = '可以自信回答';
    }
    
    return {
      topic,
      confidence,
      evidence,
      gaps,
      recommendation,
    };
  }
  
  /**
   * 检测知识边界
   */
  detectBoundary(domain: string): KnowledgeBoundary {
    // 检查现有边界
    const existing = this.boundaries.get(domain);
    if (existing) {
      return existing;
    }
    
    // 分析知识图谱
    const stats = this.knowledgeGraph.getStats();
    const domainEntities = this.knowledgeGraph.queryEntities({ 
      entityName: domain,
      limit: 100,
    });
    
    const knownTopics: string[] = [];
    const unknownTopics: string[] = [];
    
    // 根据实体数量判断
    if (domainEntities.length > 10) {
      knownTopics.push(...domainEntities.slice(0, 10).map(e => e.name));
    } else if (domainEntities.length > 0) {
      knownTopics.push(...domainEntities.map(e => e.name));
      unknownTopics.push('更多深入知识');
    } else {
      unknownTopics.push('此领域知识');
    }
    
    const boundary: KnowledgeBoundary = {
      domain,
      knownTopics,
      unknownTopics,
      confidence: domainEntities.length > 0 ? Math.min(0.9, domainEntities.length * 0.1) : 0.1,
      lastAssessed: Date.now(),
    };
    
    this.boundaries.set(domain, boundary);
    
    return boundary;
  }
  
  /**
   * 量化不确定性
   */
  quantifyUncertainty(topic: string): UncertaintyQuantification[] {
    const uncertainties: UncertaintyQuantification[] = [];
    
    // 检查知识缺口
    const assessment = this.assessConfidence(topic);
    if (assessment.gaps.length > 0) {
      uncertainties.push({
        type: 'knowledge_gap',
        level: assessment.confidence < 0.3 ? 'high' : assessment.confidence < 0.6 ? 'medium' : 'low',
        description: `存在 ${assessment.gaps.length} 个知识缺口`,
        mitigation: '建议学习相关领域知识',
      });
    }
    
    // 检查数据不足
    const entities = this.knowledgeGraph.queryEntities({ entityName: topic });
    if (entities.length < 3) {
      uncertainties.push({
        type: 'insufficient_data',
        level: 'medium',
        description: `仅有 ${entities.length} 个相关实体`,
        mitigation: '建议收集更多数据',
      });
    }
    
    // 检查冲突
    const relations = this.knowledgeGraph.queryRelations({ fromId: entities[0]?.id });
    const relationTypes = new Set(relations.map(r => r.type));
    if (relationTypes.has('causes') && relationTypes.has('causes')) {
      // 简化冲突检测
      uncertainties.push({
        type: 'conflict',
        level: 'low',
        description: '可能存在因果关系冲突',
        mitigation: '建议验证因果关系',
      });
    }
    
    return uncertainties;
  }
  
  /**
   * 自我反思
   */
  reflect(): SelfReflection {
    const stats = this.knowledgeGraph.getStats();
    
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];
    const actionItems: string[] = [];
    
    // 分析优势
    if (stats.totalEntities > 100) {
      strengths.push('知识库规模较大');
    }
    if (stats.avgConfidence > 0.7) {
      strengths.push('知识置信度较高');
    }
    
    // 分析劣势
    if (stats.totalEntities < 50) {
      weaknesses.push('知识库规模较小');
      actionItems.push('扩充知识库');
    }
    if (stats.avgConfidence < 0.5) {
      weaknesses.push('知识置信度较低');
      actionItems.push('提高知识质量');
    }
    
    // 分析机会
    for (const domain of this.uncertainDomains) {
      opportunities.push(`可以学习: ${domain}`);
    }
    
    // 分析威胁
    for (const [domain, boundary] of this.boundaries) {
      if (boundary.unknownTopics.length > boundary.knownTopics.length) {
        threats.push(`${domain} 领域知识不足`);
      }
    }
    
    return {
      timestamp: Date.now(),
      strengths,
      weaknesses,
      opportunities,
      threats,
      actionItems,
    };
  }
  
  /**
   * 生成元认知报告
   */
  generateReport(): MetaCognitionReport {
    const boundaries = Array.from(this.boundaries.values());
    const assessments = Array.from(this.boundaries.keys())
      .slice(0, 5)
      .map(domain => this.assessConfidence(domain));
    const uncertainties = this.quantifyUncertainty('system');
    const reflection = this.reflect();
    
    // 计算总体评分
    const avgConfidence = assessments.reduce((sum, a) => sum + a.confidence, 0) / assessments.length;
    const overallScore = Math.round(avgConfidence * 100);
    
    return {
      generatedAt: Date.now(),
      boundaries,
      assessments,
      uncertainties,
      reflection,
      overallScore,
    };
  }
  
  /**
   * 检查是否知道
   */
  knows(topic: string): boolean {
    const assessment = this.assessConfidence(topic);
    return assessment.confidence >= 0.5;
  }
  
  /**
   * 获取知识状态
   */
  getKnowledgeStatus(topic: string): 'known' | 'partial' | 'unknown' {
    const assessment = this.assessConfidence(topic);
    
    if (assessment.confidence >= 0.7) return 'known';
    if (assessment.confidence >= 0.4) return 'partial';
    return 'unknown';
  }
  
  /**
   * 更新知识边界
   */
  updateBoundary(domain: string, updates: Partial<KnowledgeBoundary>): void {
    const existing = this.boundaries.get(domain);
    if (existing) {
      this.boundaries.set(domain, {
        ...existing,
        ...updates,
        lastAssessed: Date.now(),
      });
    }
  }
  
  /**
   * 添加已知领域
   */
  addKnownDomain(domain: string): void {
    this.knownDomains.add(domain);
    this.logger.info('MetaCognition', `添加已知领域: ${domain}`);
  }
  
  /**
   * 添加不确定领域
   */
  addUncertainDomain(domain: string): void {
    this.uncertainDomains.add(domain);
    this.logger.info('MetaCognition', `添加不确定领域: ${domain}`);
  }
}
