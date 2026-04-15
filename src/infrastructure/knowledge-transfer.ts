/**
 * 知识迁移模块
 * 
 * 功能：
 * 1. 跨领域知识迁移
 * 2. 类比推理
 * 3. 迁移学习策略
 * 4. 迁移效果评估
 */

import { StructuredLogger } from './index';
import { KnowledgeGraph } from './knowledge-graph';

// ============ 类型定义 ============

export interface ConceptProperties {
    [key: string]: string | number | boolean | string[] | number[];
}

export interface SourceDomain {
  id: string;
  name: string;
  concepts: Concept[];
  relations: DomainRelation[];
  abstraction: number; // 抽象程度 0-1
}

export interface TargetDomain {
  id: string;
  name: string;
  concepts: Concept[];
  relations: DomainRelation[];
  similarity: number; // 与源领域的相似度
}

export interface Concept {
  id: string;
  name: string;
  properties: ConceptProperties;
  abstraction: number;
  embedding?: number[];
}

export interface DomainRelation {
  from: string;
  to: string;
  type: string;
  strength: number;
}

export interface Mapping {
  sourceConcept: string;
  targetConcept: string;
  similarity: number;
  type: 'identical' | 'analogical' | 'abstract';
  confidence: number;
}

export interface TransferResult {
  id: string;
  sourceDomain: string;
  targetDomain: string;
  mappings: Mapping[];
  transferredKnowledge: TransferredKnowledge[];
  confidence: number;
  applicability: number;
}

export interface TransferredKnowledge {
  type: 'concept' | 'relation' | 'property' | 'rule';
  source: string;
  target: string;
  content: string | ConceptProperties | DomainRelation;
  confidence: number;
}

export interface AnalogyResult {
  source: string;
  target: string;
  sharedStructure: string[];
  differences: string[];
  inferences: string[];
  confidence: number;
}

export interface TransferStrategy {
  type: 'direct' | 'analogical' | 'abstract' | 'compositional';
  conditions: string[];
  steps: string[];
  expectedEffectiveness: number;
}

// ============ 知识迁移器 ============

export class KnowledgeTransfer {
  private logger: StructuredLogger;
  private knowledgeGraph: KnowledgeGraph;
  
  // 领域缓存
  private domains: Map<string, SourceDomain> = new Map();
  
  // 迁移历史
  private transferHistory: TransferResult[] = [];
  
  constructor(logger: StructuredLogger, knowledgeGraph: KnowledgeGraph) {
    this.logger = logger;
    this.knowledgeGraph = knowledgeGraph;
  }
  
  /**
   * 注册领域
   */
  registerDomain(domain: Omit<SourceDomain, 'id'>): SourceDomain {
    const id = `domain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newDomain: SourceDomain = {
      ...domain,
      id,
    };
    
    this.domains.set(id, newDomain);
    
    this.logger.info('KnowledgeTransfer', 
      `注册领域: ${domain.name}, ${domain.concepts.length} 个概念`
    );
    
    return newDomain;
  }
  
  /**
   * 发现可迁移领域
   */
  discoverTransferableDomains(
    targetDomain: string,
    threshold: number = 0.5
  ): Array<{ domain: SourceDomain; similarity: number }> {
    const results: Array<{ domain: SourceDomain; similarity: number }> = [];
    
    for (const domain of this.domains.values()) {
      if (domain.name === targetDomain) continue;
      
      const similarity = this.calculateDomainSimilarity(domain.name, targetDomain);
      
      if (similarity >= threshold) {
        results.push({ domain, similarity });
      }
    }
    
    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);
    
    this.logger.info('KnowledgeTransfer', 
      `发现 ${results.length} 个可迁移领域`
    );
    
    return results;
  }
  
  /**
   * 执行知识迁移
   */
  transfer(
    sourceDomainId: string,
    targetDomainName: string,
    strategy: TransferStrategy['type'] = 'analogical'
  ): TransferResult {
    const startTime = Date.now();
    
    const sourceDomain = this.domains.get(sourceDomainId);
    
    if (!sourceDomain) {
      throw new Error(`源领域不存在: ${sourceDomainId}`);
    }
    
    // 1. 计算领域相似度
    const similarity = this.calculateDomainSimilarity(
      sourceDomain.name,
      targetDomainName
    );
    
    // 2. 创建目标领域
    const targetDomain: TargetDomain = {
      id: `target-${Date.now()}`,
      name: targetDomainName,
      concepts: [],
      relations: [],
      similarity,
    };
    
    // 3. 根据策略执行迁移
    let mappings: Mapping[] = [];
    let transferredKnowledge: TransferredKnowledge[] = [];
    
    switch (strategy) {
      case 'direct':
        ({ mappings, transferredKnowledge } = this.directTransfer(
          sourceDomain,
          targetDomain
        ));
        break;
      case 'analogical':
        ({ mappings, transferredKnowledge } = this.analogicalTransfer(
          sourceDomain,
          targetDomain
        ));
        break;
      case 'abstract':
        ({ mappings, transferredKnowledge } = this.abstractTransfer(
          sourceDomain,
          targetDomain
        ));
        break;
      case 'compositional':
        ({ mappings, transferredKnowledge } = this.compositionalTransfer(
          sourceDomain,
          targetDomain
        ));
        break;
    }
    
    // 4. 计算置信度和适用性
    const confidence = this.calculateTransferConfidence(mappings, similarity);
    const applicability = this.calculateApplicability(transferredKnowledge);
    
    const result: TransferResult = {
      id: `transfer-${Date.now()}`,
      sourceDomain: sourceDomain.name,
      targetDomain: targetDomainName,
      mappings,
      transferredKnowledge,
      confidence,
      applicability,
    };
    
    this.transferHistory.push(result);
    
    this.logger.info('KnowledgeTransfer', 
      `知识迁移完成: ${sourceDomain.name} → ${targetDomainName}, ` +
      `${mappings.length} 个映射, 置信度 ${(confidence * 100).toFixed(1)}%, ` +
      `耗时 ${Date.now() - startTime}ms`
    );
    
    return result;
  }
  
  /**
   * 类比推理
   */
  analogize(
    sourceConcept: string,
    targetConcept: string
  ): AnalogyResult {
    const startTime = Date.now();
    
    // 1. 获取概念信息
    const sourceInfo = this.getConceptInfo(sourceConcept);
    const targetInfo = this.getConceptInfo(targetConcept);
    
    // 2. 找出共享结构
    const sharedStructure = this.findSharedStructure(sourceInfo, targetInfo);
    
    // 3. 识别差异
    const differences = this.findDifferences(sourceInfo, targetInfo);
    
    // 4. 生成推断
    const inferences = this.generateInferences(
      sourceInfo,
      targetInfo,
      sharedStructure
    );
    
    // 5. 计算置信度
    const confidence = sharedStructure.length / (sharedStructure.length + differences.length);
    
    this.logger.info('KnowledgeTransfer', 
      `类比推理完成: ${sourceConcept} ≈ ${targetConcept}, ` +
      `${sharedStructure.length} 个共享结构, 耗时 ${Date.now() - startTime}ms`
    );
    
    return {
      source: sourceConcept,
      target: targetConcept,
      sharedStructure,
      differences,
      inferences,
      confidence,
    };
  }
  
  /**
   * 选择迁移策略
   */
  selectStrategy(
    sourceDomain: SourceDomain,
    targetDomain: TargetDomain
  ): TransferStrategy {
    const similarity = targetDomain.similarity;
    
    // 高相似度：直接迁移
    if (similarity > 0.8) {
      return {
        type: 'direct',
        conditions: ['领域高度相似', '概念可直接映射'],
        steps: ['直接复制概念', '调整属性值', '验证一致性'],
        expectedEffectiveness: 0.9,
      };
    }
    
    // 中等相似度：类比迁移
    if (similarity > 0.5) {
      return {
        type: 'analogical',
        conditions: ['领域部分相似', '存在结构对应'],
        steps: ['识别对应关系', '映射概念结构', '调整差异部分'],
        expectedEffectiveness: 0.7,
      };
    }
    
    // 低相似度但高抽象：抽象迁移
    if (sourceDomain.abstraction > 0.7) {
      return {
        type: 'abstract',
        conditions: ['源领域高度抽象', '存在通用原理'],
        steps: ['提取抽象原理', '具体化到目标领域', '验证适用性'],
        expectedEffectiveness: 0.6,
      };
    }
    
    // 默认：组合迁移
    return {
      type: 'compositional',
      conditions: ['需要组合多个源领域', '目标领域复杂'],
      steps: ['分解目标问题', '从多个源领域迁移', '组合迁移结果'],
      expectedEffectiveness: 0.5,
    };
  }
  
  /**
   * 评估迁移效果
   */
  evaluateTransfer(transferId: string): {
    effectiveness: number;
    issues: string[];
    suggestions: string[];
  } {
    const transfer = this.transferHistory.find(t => t.id === transferId);
    
    if (!transfer) {
      throw new Error(`迁移记录不存在: ${transferId}`);
    }
    
    // 计算效果
    const effectiveness = transfer.confidence * transfer.applicability;
    
    // 识别问题
    const issues: string[] = [];
    
    if (transfer.confidence < 0.5) {
      issues.push('迁移置信度较低，可能存在映射错误');
    }
    
    if (transfer.applicability < 0.5) {
      issues.push('迁移知识适用性较低，可能需要调整');
    }
    
    if (transfer.mappings.length < 3) {
      issues.push('映射数量较少，迁移可能不完整');
    }
    
    // 生成建议
    const suggestions: string[] = [];
    
    if (issues.length > 0) {
      suggestions.push('考虑使用不同的迁移策略');
      suggestions.push('增加源领域和目标领域的概念对齐');
      suggestions.push('验证迁移后的知识一致性');
    } else {
      suggestions.push('迁移效果良好，可以继续深化');
    }
    
    return {
      effectiveness,
      issues,
      suggestions,
    };
  }
  
  // ============ 私有方法 ============
  
  private calculateDomainSimilarity(
    source: string,
    target: string
  ): number {
    // 基于知识图谱计算领域相似度
    const sourceEntities = this.knowledgeGraph.queryEntities({ entityType: source as any });
    const targetEntities = this.knowledgeGraph.queryEntities({ entityType: target as any });
    
    if (sourceEntities.length === 0 || targetEntities.length === 0) {
      // 使用名称相似度
      return this.calculateNameSimilarity(source, target);
    }
    
    // 计算概念重叠
    const sourceNames = new Set(sourceEntities.map(e => e.name));
    const targetNames = new Set(targetEntities.map(e => e.name));
    
    const intersection = new Set(
      [...sourceNames].filter(n => targetNames.has(n))
    );
    
    const union = new Set([...sourceNames, ...targetNames]);
    
    return intersection.size / union.size;
  }
  
  private calculateNameSimilarity(a: string, b: string): number {
    // 简化的名称相似度计算
    const aWords = a.toLowerCase().split(/[\s_-]+/);
    const bWords = b.toLowerCase().split(/[\s_-]+/);
    
    const intersection = aWords.filter(w => bWords.includes(w));
    const union = [...new Set([...aWords, ...bWords])];
    
    return intersection.length / union.length;
  }
  
  private directTransfer(
    source: SourceDomain,
    target: TargetDomain
  ): { mappings: Mapping[]; transferredKnowledge: TransferredKnowledge[] } {
    const mappings: Mapping[] = [];
    const transferredKnowledge: TransferredKnowledge[] = [];
    
    // 直接映射概念
    for (const concept of source.concepts) {
      mappings.push({
        sourceConcept: concept.name,
        targetConcept: concept.name, // 直接使用相同名称
        similarity: 1.0,
        type: 'identical',
        confidence: 0.9,
      });
      
      transferredKnowledge.push({
        type: 'concept',
        source: concept.name,
        target: concept.name,
        content: concept.properties,
        confidence: 0.9,
      });
    }
    
    // 直接迁移关系
    for (const relation of source.relations) {
      transferredKnowledge.push({
        type: 'relation',
        source: `${relation.from}-${relation.type}-${relation.to}`,
        target: `${relation.from}-${relation.type}-${relation.to}`,
        content: relation,
        confidence: 0.85,
      });
    }
    
    return { mappings, transferredKnowledge };
  }
  
  private analogicalTransfer(
    source: SourceDomain,
    target: TargetDomain
  ): { mappings: Mapping[]; transferredKnowledge: TransferredKnowledge[] } {
    const mappings: Mapping[] = [];
    const transferredKnowledge: TransferredKnowledge[] = [];
    
    // 类比映射概念
    for (const concept of source.concepts) {
      // 寻找最相似的目标概念
      const analogy = this.analogize(concept.name, target.name);
      
      if (analogy.confidence > 0.3) {
        mappings.push({
          sourceConcept: concept.name,
          targetConcept: `${target.name}:${concept.name}`,
          similarity: analogy.confidence,
          type: 'analogical',
          confidence: analogy.confidence * 0.8,
        });
        
        // 迁移共享结构
        for (const structure of analogy.sharedStructure) {
          transferredKnowledge.push({
            type: 'property',
            source: `${concept.name}.${structure}`,
            target: `${target.name}:${concept.name}.${structure}`,
            content: structure,
            confidence: analogy.confidence * 0.7,
          });
        }
      }
    }
    
    return { mappings, transferredKnowledge };
  }
  
  private abstractTransfer(
    source: SourceDomain,
    target: TargetDomain
  ): { mappings: Mapping[]; transferredKnowledge: TransferredKnowledge[] } {
    const mappings: Mapping[] = [];
    const transferredKnowledge: TransferredKnowledge[] = [];
    
    // 提取抽象概念
    const abstractConcepts = source.concepts.filter(c => c.abstraction > 0.5);
    
    for (const concept of abstractConcepts) {
      mappings.push({
        sourceConcept: concept.name,
        targetConcept: `${target.name}:${concept.name}`,
        similarity: source.abstraction,
        type: 'abstract',
        confidence: source.abstraction * 0.7,
      });
      
      transferredKnowledge.push({
        type: 'rule',
        source: concept.name,
        target: `${target.name}:${concept.name}`,
        content: concept.properties,
        confidence: source.abstraction * 0.6,
      });
    }
    
    return { mappings, transferredKnowledge };
  }
  
  private compositionalTransfer(
    source: SourceDomain,
    target: TargetDomain
  ): { mappings: Mapping[]; transferredKnowledge: TransferredKnowledge[] } {
    // 组合多个迁移策略
    const direct = this.directTransfer(source, target);
    const analogical = this.analogicalTransfer(source, target);
    
    return {
      mappings: [...direct.mappings, ...analogical.mappings],
      transferredKnowledge: [
        ...direct.transferredKnowledge,
        ...analogical.transferredKnowledge,
      ],
    };
  }
  
  private getConceptInfo(conceptName: string): any {
    const entities = this.knowledgeGraph.queryEntities({ entityName: conceptName });
    
    if (entities.length > 0) {
      const entity = entities[0];
      const { incoming, outgoing } = this.knowledgeGraph.getEntityRelations(entity.id);
      
      return {
        name: entity.name,
        type: entity.type,
        properties: entity.properties,
        relations: [...incoming, ...outgoing],
      };
    }
    
    return {
      name: conceptName,
      type: 'unknown',
      properties: {},
      relations: [],
    };
  }
  
  private findSharedStructure(source: any, target: any): string[] {
    const shared: string[] = [];
    
    // 共享类型
    if (source.type === target.type) {
      shared.push(`类型: ${source.type}`);
    }
    
    // 共享属性
    const sourceProps = Object.keys(source.properties || {});
    const targetProps = Object.keys(target.properties || {});
    
    for (const prop of sourceProps) {
      if (targetProps.includes(prop)) {
        shared.push(`属性: ${prop}`);
      }
    }
    
    // 共享关系类型
    const sourceRelTypes = new Set((source.relations || []).map((r: any) => r.type));
    const targetRelTypes = new Set((target.relations || []).map((r: any) => r.type));
    
    for (const type of sourceRelTypes) {
      if (targetRelTypes.has(type)) {
        shared.push(`关系: ${type}`);
      }
    }
    
    return shared;
  }
  
  private findDifferences(source: any, target: any): string[] {
    const differences: string[] = [];
    
    // 类型差异
    if (source.type !== target.type) {
      differences.push(`类型不同: ${source.type} vs ${target.type}`);
    }
    
    // 属性差异
    const sourceProps = new Set(Object.keys(source.properties || {}));
    const targetProps = new Set(Object.keys(target.properties || {}));
    
    for (const prop of sourceProps) {
      if (!targetProps.has(prop)) {
        differences.push(`源独有属性: ${prop}`);
      }
    }
    
    for (const prop of targetProps) {
      if (!sourceProps.has(prop)) {
        differences.push(`目标独有属性: ${prop}`);
      }
    }
    
    return differences;
  }
  
  private generateInferences(
    source: any,
    target: any,
    sharedStructure: string[]
  ): string[] {
    const inferences: string[] = [];
    
    // 基于共享结构推断
    for (const structure of sharedStructure) {
      if (structure.startsWith('属性:')) {
        const prop = structure.replace('属性: ', '');
        inferences.push(`目标可能具有属性值: ${source.properties[prop]}`);
      }
      
      if (structure.startsWith('关系:')) {
        const relType = structure.replace('关系: ', '');
        inferences.push(`目标可能存在 ${relType} 关系`);
      }
    }
    
    return inferences;
  }
  
  private calculateTransferConfidence(
    mappings: Mapping[],
    domainSimilarity: number
  ): number {
    if (mappings.length === 0) return 0;
    
    const avgMappingConfidence = mappings.reduce(
      (sum, m) => sum + m.confidence,
      0
    ) / mappings.length;
    
    return (avgMappingConfidence + domainSimilarity) / 2;
  }
  
  private calculateApplicability(
    transferredKnowledge: TransferredKnowledge[]
  ): number {
    if (transferredKnowledge.length === 0) return 0;
    
    return transferredKnowledge.reduce(
      (sum, k) => sum + k.confidence,
      0
    ) / transferredKnowledge.length;
  }
  
  // ============ 公共访问器 ============
  
  getDomains(): SourceDomain[] {
    return Array.from(this.domains.values());
  }
  
  getTransferHistory(): TransferResult[] {
    return this.transferHistory;
  }
}
