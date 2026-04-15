/**
 * 推理引擎
 * 
 * 功能：
 * 1. 逻辑推理（演绎/归纳/溯因）
 * 2. 规则引擎
 * 3. 约束满足
 * 4. 推理链追踪
 */

import { StructuredLogger } from './index';
import { KnowledgeGraph, Entity, Relation } from './knowledge-graph';

// ============ 类型定义 ============

export interface InferenceRule {
  id: string;
  name: string;
  type: 'deductive' | 'inductive' | 'abductive';
  premises: RuleCondition[];
  conclusion: RuleConclusion;
  confidence: number;
  priority: number;
  enabled: boolean;
}

export interface RuleCondition {
  type: 'entity' | 'relation' | 'property';
  field: string;
  operator: 'equals' | 'contains' | 'exists' | 'gt' | 'lt';
  value: any;
}

export interface RuleConclusion {
  type: 'entity' | 'relation' | 'property';
  data: Record<string, unknown>;
  confidenceModifier: number;
}

export interface InferenceResult {
  id: string;
  ruleId: string;
  type: 'deductive' | 'inductive' | 'abductive';
  premises: unknown[];
  conclusion: any;
  confidence: number;
  reasoning: string[];
  timestamp: number;
}

export interface InferenceChain {
  id: string;
  query: string;
  steps: InferenceResult[];
  finalConclusion: any;
  totalConfidence: number;
  duration: number;
}

export type InferenceStrategy = 'breadth_first' | 'depth_first' | 'best_first';

// ============ 推理引擎 ============

export class InferenceEngine {
  private logger: StructuredLogger;
  private knowledgeGraph: KnowledgeGraph;
  
  // 规则库
  private rules: Map<string, InferenceRule> = new Map();
  
  // 推理历史
  private inferenceHistory: InferenceResult[] = [];
  
  // 最大推理深度
  private static MAX_DEPTH = 5;
  
  constructor(logger: StructuredLogger, knowledgeGraph: KnowledgeGraph) {
    this.logger = logger;
    this.knowledgeGraph = knowledgeGraph;
    this.initializeDefaultRules();
  }
  
  /**
   * 初始化默认规则
   */
  private initializeDefaultRules(): void {
    // 演绎规则：如果 A is_a B，B has_property C，则 A has_property C
    this.addRule({
      name: 'property_inheritance',
      type: 'deductive',
      premises: [
        { type: 'relation', field: 'type', operator: 'equals', value: 'is_a' },
        { type: 'relation', field: 'type', operator: 'equals', value: 'has_a' },
      ],
      conclusion: {
        type: 'relation',
        data: { type: 'has_a' },
        confidenceModifier: 0.9,
      },
      confidence: 0.85,
      priority: 1,
      enabled: true,
    });
    
    // 归纳规则：如果多个 A has_property B，则 A 类 has_property B
    this.addRule({
      name: 'generalization',
      type: 'inductive',
      premises: [
        { type: 'entity', field: 'type', operator: 'equals', value: 'same_type' },
        { type: 'relation', field: 'type', operator: 'equals', value: 'has_a' },
      ],
      conclusion: {
        type: 'property',
        data: { generalized: true },
        confidenceModifier: 0.7,
      },
      confidence: 0.7,
      priority: 2,
      enabled: true,
    });
    
    // 溯因规则：如果 B 发生，A causes B，则可能 A 发生
    this.addRule({
      name: 'abduction',
      type: 'abductive',
      premises: [
        { type: 'relation', field: 'type', operator: 'equals', value: 'causes' },
      ],
      conclusion: {
        type: 'entity',
        data: { inferred_cause: true },
        confidenceModifier: 0.6,
      },
      confidence: 0.6,
      priority: 3,
      enabled: true,
    });
  }
  
  /**
   * 添加规则
   */
  addRule(rule: Omit<InferenceRule, 'id'>): InferenceRule {
    const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRule: InferenceRule = { ...rule, id };
    this.rules.set(id, newRule);
    this.logger.debug('InferenceEngine', `添加规则: ${rule.name} (${rule.type})`);
    return newRule;
  }
  
  /**
   * 演绎推理
   */
  deductive(entityId: string): InferenceResult[] {
    const results: InferenceResult[] = [];
    const entity = this.knowledgeGraph.queryEntities({ entityName: entityId })[0];
    
    if (!entity) return results;
    
    // 获取实体的所有关系
    const { outgoing, incoming } = this.knowledgeGraph.getEntityRelations(entity.id);
    
    // 应用演绎规则
    for (const rule of this.rules.values()) {
      if (rule.type !== 'deductive' || !rule.enabled) continue;
      
      // 检查前提条件
      const premises: unknown[] = [];
      let premisesMet = true;
      
      for (const condition of rule.premises) {
        if (condition.type === 'relation') {
          const matchingRelations = [...outgoing, ...incoming].filter(r => 
            r.type === condition.value
          );
          
          if (matchingRelations.length > 0) {
            premises.push(matchingRelations);
          } else {
            premisesMet = false;
            break;
          }
        }
      }
      
      if (premisesMet) {
        // 生成结论
        const conclusion = this.applyConclusion(rule.conclusion, entity, premises);
        const confidence = rule.confidence * rule.conclusion.confidenceModifier;
        
        const result: InferenceResult = {
          id: `inf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          type: 'deductive',
          premises,
          conclusion,
          confidence,
          reasoning: [
            `实体 ${entity.name} 满足规则 ${rule.name} 的前提条件`,
            `应用演绎推理得出结论`,
          ],
          timestamp: Date.now(),
        };
        
        results.push(result);
        this.inferenceHistory.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * 归纳推理
   */
  inductive(entityType: string): InferenceResult[] {
    const results: InferenceResult[] = [];
    
    // 获取同类型的所有实体
    const entities = this.knowledgeGraph.queryEntities({ entityType: entityType as any });
    
    if (entities.length < 2) return results;
    
    // 统计共同属性
    const propertyCounts: Record<string, number> = {};
    
    for (const entity of entities) {
      const { outgoing } = this.knowledgeGraph.getEntityRelations(entity.id);
      
      for (const rel of outgoing) {
        if (rel.type === 'has_a' || rel.type === 'is_a') {
          const key = `${rel.type}:${rel.toId}`;
          propertyCounts[key] = (propertyCounts[key] || 0) + 1;
        }
      }
    }
    
    // 找出共同属性（超过 50% 的实体拥有）
    const threshold = entities.length * 0.5;
    
    for (const [property, count] of Object.entries(propertyCounts)) {
      if (count >= threshold) {
        const confidence = count / entities.length;
        
        const result: InferenceResult = {
          id: `inf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: 'inductive-generalization',
          type: 'inductive',
          premises: entities,
          conclusion: {
            property,
            coverage: confidence,
          },
          confidence,
          reasoning: [
            `观察到 ${count}/${entities.length} 个 ${entityType} 实体具有属性 ${property}`,
            `归纳得出 ${entityType} 类型通常具有该属性`,
          ],
          timestamp: Date.now(),
        };
        
        results.push(result);
        this.inferenceHistory.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * 溯因推理
   */
  abductive(effectId: string): InferenceResult[] {
    const results: InferenceResult[] = [];
    
    // 查找可能导致该效果的原因
    const causes = this.knowledgeGraph.queryRelations({
      toId: effectId,
      relationType: 'causes',
    });
    
    for (const cause of causes) {
      const causeEntity = this.knowledgeGraph.queryEntities({ entityName: cause.fromId })[0];
      
      if (causeEntity) {
        const result: InferenceResult = {
          id: `inf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: 'abductive-causation',
          type: 'abductive',
          premises: [cause],
          conclusion: {
            possibleCause: causeEntity,
            probability: cause.confidence,
          },
          confidence: cause.confidence * 0.6, // 溯因推理置信度较低
          reasoning: [
            `观察到效果 ${effectId}`,
            `已知 ${causeEntity.name} 可能导致该效果`,
            `推测 ${causeEntity.name} 可能是原因`,
          ],
          timestamp: Date.now(),
        };
        
        results.push(result);
        this.inferenceHistory.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * 推理链
   */
  infer(query: string, strategy: InferenceStrategy = 'best_first'): InferenceChain {
    const startTime = Date.now();
    const steps: InferenceResult[] = [];
    
    // 解析查询
    const entities = this.knowledgeGraph.queryEntities({ entityName: query });
    
    if (entities.length === 0) {
      return {
        id: `chain-${Date.now()}`,
        query,
        steps: [],
        finalConclusion: null,
        totalConfidence: 0,
        duration: Date.now() - startTime,
      };
    }
    
    const entity = entities[0];
    
    // 根据策略执行推理
    let currentEntity = entity;
    let depth = 0;
    
    while (depth < InferenceEngine.MAX_DEPTH) {
      // 执行三种推理
      const deductiveResults = this.deductive(currentEntity.id);
      const inductiveResults = this.inductive(currentEntity.type);
      const abductiveResults = this.abductive(currentEntity.id);
      
      // 合并结果
      const allResults = [...deductiveResults, ...inductiveResults, ...abductiveResults];
      
      if (allResults.length === 0) break;
      
      // 根据策略选择结果
      let selectedResult: InferenceResult;
      
      switch (strategy) {
        case 'breadth_first':
          selectedResult = allResults[0];
          break;
        case 'depth_first':
          selectedResult = allResults[allResults.length - 1];
          break;
        case 'best_first':
        default:
          selectedResult = allResults.sort((a, b) => b.confidence - a.confidence)[0];
      }
      
      steps.push(selectedResult);
      
      // 更新当前实体（如果有新实体）
      if (selectedResult.conclusion.possibleCause) {
        currentEntity = selectedResult.conclusion.possibleCause;
      } else {
        break;
      }
      
      depth++;
    }
    
    // 计算总置信度
    const totalConfidence = steps.length > 0
      ? steps.reduce((prod, step) => prod * step.confidence, 1)
      : 0;
    
    // 最终结论
    const finalConclusion = steps.length > 0 ? steps[steps.length - 1].conclusion : null;
    
    return {
      id: `chain-${Date.now()}`,
      query,
      steps,
      finalConclusion,
      totalConfidence,
      duration: Date.now() - startTime,
    };
  }
  
  /**
   * 应用结论
   */
  private applyConclusion(
    conclusion: RuleConclusion,
    entity: Entity,
    premises: unknown[]
  ): any {
    switch (conclusion.type) {
      case 'entity':
        return {
          ...conclusion.data,
          derivedFrom: entity.id,
        };
      case 'relation':
        return {
          ...conclusion.data,
          fromId: entity.id,
          toId: premises[0]?.[0]?.toId,
        };
      case 'property':
        return {
          ...conclusion.data,
          entityId: entity.id,
        };
      default:
        return conclusion.data;
    }
  }
  
  /**
   * 获取规则
   */
  getRules(): InferenceRule[] {
    return Array.from(this.rules.values());
  }
  
  /**
   * 获取推理历史
   */
  getHistory(limit: number = 100): InferenceResult[] {
    return this.inferenceHistory.slice(-limit);
  }
  
  /**
   * 清空历史
   */
  clearHistory(): void {
    this.inferenceHistory = [];
  }
}
