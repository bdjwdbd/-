/**
 * 因果推理模块
 * 
 * 功能：
 * 1. 因果发现
 * 2. 反事实推理
 * 3. 干预分析
 * 4. 因果图构建
 */

import { StructuredLogger } from './index';
import { KnowledgeGraph } from './knowledge-graph';

// ============ 类型定义 ============

export interface CausalNode {
  id: string;
  name: string;
  type: 'cause' | 'effect' | 'mediator' | 'confounder';
  observed: boolean;
  value?: any;
}

export interface CausalEdge {
  from: string;
  to: string;
  type: 'direct' | 'indirect' | 'spurious';
  strength: number;
  confidence: number;
}

export interface CausalGraph {
  id: string;
  nodes: Map<string, CausalNode>;
  edges: CausalEdge[];
  createdAt: number;
}

export interface CausalDiscoveryResult {
  causes: Array<{ node: CausalNode; strength: number; evidence: string[] }>;
  effects: Array<{ node: CausalNode; strength: number; evidence: string[] }>;
  mediators: CausalNode[];
  confounders: CausalNode[];
  confidence: number;
}

export interface CounterfactualResult {
  premise: string;
  actualOutcome: string;
  counterfactualOutcome: string;
  difference: string;
  confidence: number;
}

export interface InterventionResult {
  intervention: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  causalEffect: number;
  confidence: number;
}

// ============ 因果推理器 ============

export class CausalReasoner {
  private logger: StructuredLogger;
  private knowledgeGraph: KnowledgeGraph;
  
  // 因果图缓存
  private causalGraphs: Map<string, CausalGraph> = new Map();
  
  constructor(logger: StructuredLogger, knowledgeGraph: KnowledgeGraph) {
    this.logger = logger;
    this.knowledgeGraph = knowledgeGraph;
  }
  
  /**
   * 因果发现
   */
  discoverCauses(effectName: string): CausalDiscoveryResult {
    const startTime = Date.now();
    
    // 查找效果实体
    const effectEntities = this.knowledgeGraph.queryEntities({ entityName: effectName });
    
    if (effectEntities.length === 0) {
      return this.emptyDiscoveryResult();
    }
    
    const effectEntity = effectEntities[0];
    
    // 查找因果关系
    const causes: CausalDiscoveryResult['causes'] = [];
    const effects: CausalDiscoveryResult['effects'] = [];
    const mediators: CausalNode[] = [];
    const confounders: CausalNode[] = [];
    
    // 从知识图谱中提取因果关系
    const { incoming, outgoing } = this.knowledgeGraph.getEntityRelations(effectEntity.id);
    
    // 分析入边（潜在原因）
    for (const rel of incoming) {
      if (rel.type === 'causes') {
        const causeEntity = this.knowledgeGraph.queryEntities({})[0];
        if (causeEntity) {
          causes.push({
            node: {
              id: rel.fromId,
              name: rel.fromId,
              type: 'cause',
              observed: true,
            },
            strength: rel.confidence,
            evidence: [`知识图谱关系: ${rel.type}`],
          });
        }
      }
    }
    
    // 分析出边（潜在效果）
    for (const rel of outgoing) {
      if (rel.type === 'causes') {
        effects.push({
          node: {
            id: rel.toId,
            name: rel.toId,
            type: 'effect',
            observed: true,
          },
          strength: rel.confidence,
          evidence: [`知识图谱关系: ${rel.type}`],
        });
      }
    }
    
    // 检测中介变量（既是原因也是效果）
    for (const cause of causes) {
      for (const effect of effects) {
        if (cause.node.id === effect.node.id) {
          mediators.push({
            ...cause.node,
            type: 'mediator',
          });
        }
      }
    }
    
    // 检测混淆变量（同时影响原因和效果）
    // 简化实现：查找共同的前驱
    for (const cause of causes) {
      const causeRelations = this.knowledgeGraph.getEntityRelations(cause.node.id);
      for (const rel of causeRelations.incoming) {
        const isConfounder = effects.some(e => {
          const effectRelations = this.knowledgeGraph.getEntityRelations(e.node.id);
          return effectRelations.incoming.some(r => r.fromId === rel.fromId);
        });
        
        if (isConfounder) {
          confounders.push({
            id: rel.fromId,
            name: rel.fromId,
            type: 'confounder',
            observed: true,
          });
        }
      }
    }
    
    // 计算总体置信度
    const confidence = causes.length > 0
      ? causes.reduce((sum, c) => sum + c.strength, 0) / causes.length
      : 0;
    
    this.logger.info('CausalReasoner', 
      `因果发现完成: ${causes.length} 个原因, ${effects.length} 个效果, 耗时 ${Date.now() - startTime}ms`
    );
    
    return {
      causes,
      effects,
      mediators,
      confounders,
      confidence,
    };
  }
  
  /**
   * 反事实推理
   */
  counterfactual(
    fact: string,
    counterfactualPremise: string
  ): CounterfactualResult {
    const startTime = Date.now();
    
    // 解析事实
    const factParts = this.parseCausalStatement(fact);
    const cfParts = this.parseCausalStatement(counterfactualPremise);
    
    // 模拟反事实推理
    const actualOutcome = factParts.effect;
    const counterfactualOutcome = this.simulateCounterfactual(
      factParts,
      cfParts
    );
    
    // 计算差异
    const difference = this.calculateDifference(actualOutcome, counterfactualOutcome);
    
    // 计算置信度
    const confidence = this.estimateCounterfactualConfidence(factParts, cfParts);
    
    this.logger.info('CausalReasoner', 
      `反事实推理完成: ${counterfactualPremise}, 耗时 ${Date.now() - startTime}ms`
    );
    
    return {
      premise: counterfactualPremise,
      actualOutcome,
      counterfactualOutcome,
      difference,
      confidence,
    };
  }
  
  /**
   * 干预分析
   */
  intervene(
    intervention: string,
    targetVariable: string
  ): InterventionResult {
    const startTime = Date.now();
    
    // 解析干预
    const interventionParts = this.parseIntervention(intervention);
    
    // 获取干预前状态
    const beforeState = this.getCurrentState(targetVariable);
    
    // 模拟干预效果
    const afterState = this.simulateIntervention(
      interventionParts,
      targetVariable,
      beforeState
    );
    
    // 计算因果效应
    const causalEffect = this.calculateCausalEffect(beforeState, afterState);
    
    // 计算置信度
    const confidence = this.estimateInterventionConfidence(interventionParts);
    
    this.logger.info('CausalReasoner', 
      `干预分析完成: ${intervention}, 因果效应: ${causalEffect.toFixed(2)}, 耗时 ${Date.now() - startTime}ms`
    );
    
    return {
      intervention,
      beforeState,
      afterState,
      causalEffect,
      confidence,
    };
  }
  
  /**
   * 构建因果图
   */
  buildCausalGraph(variables: string[]): CausalGraph {
    const startTime = Date.now();
    
    const nodes = new Map<string, CausalNode>();
    const edges: CausalEdge[] = [];
    
    // 创建节点
    for (const variable of variables) {
      nodes.set(variable, {
        id: variable,
        name: variable,
        type: 'cause',
        observed: true,
      });
    }
    
    // 发现因果关系
    for (const from of variables) {
      for (const to of variables) {
        if (from === to) continue;
        
        // 检查是否存在因果关系
        const discovery = this.discoverCauses(to);
        const cause = discovery.causes.find(c => c.node.name === from);
        
        if (cause) {
          edges.push({
            from,
            to,
            type: 'direct',
            strength: cause.strength,
            confidence: cause.strength,
          });
        }
      }
    }
    
    const graph: CausalGraph = {
      id: `cg-${Date.now()}`,
      nodes,
      edges,
      createdAt: Date.now(),
    };
    
    // 缓存因果图
    this.causalGraphs.set(graph.id, graph);
    
    this.logger.info('CausalReasoner', 
      `因果图构建完成: ${nodes.size} 个节点, ${edges.length} 条边, 耗时 ${Date.now() - startTime}ms`
    );
    
    return graph;
  }
  
  /**
   * 获取因果路径
   */
  getCausalPaths(
    graph: CausalGraph,
    from: string,
    to: string
  ): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();
    
    const dfs = (current: string, path: string[]) => {
      if (current === to) {
        paths.push([...path]);
        return;
      }
      
      if (visited.has(current)) return;
      visited.add(current);
      
      // 找到所有出边
      const outgoingEdges = graph.edges.filter(e => e.from === current);
      
      for (const edge of outgoingEdges) {
        dfs(edge.to, [...path, edge.to]);
      }
      
      visited.delete(current);
    };
    
    dfs(from, [from]);
    
    return paths;
  }
  
  // ============ 辅助方法 ============
  
  private emptyDiscoveryResult(): CausalDiscoveryResult {
    return {
      causes: [],
      effects: [],
      mediators: [],
      confounders: [],
      confidence: 0,
    };
  }
  
  private parseCausalStatement(statement: string): { cause: string; effect: string } {
    // 简化实现：假设格式为 "A 导致 B" 或 "A causes B"
    const parts = statement.split(/导致|causes|引起|使得/);
    return {
      cause: parts[0]?.trim() || '',
      effect: parts[1]?.trim() || '',
    };
  }
  
  private parseIntervention(statement: string): { variable: string; value: any } {
    // 简化实现：假设格式为 "设置 X 为 Y"
    const parts = statement.split(/设置|为|set|to/);
    return {
      variable: parts[1]?.trim() || '',
      value: parts[2]?.trim() || '',
    };
  }
  
  private simulateCounterfactual(
    fact: { cause: string; effect: string },
    cf: { cause: string; effect: string }
  ): string {
    // 简化实现：基于因果链推断
    if (cf.cause !== fact.cause) {
      return `如果 ${cf.cause}，则可能 ${cf.effect || '结果不同'}`;
    }
    return fact.effect;
  }
  
  private calculateDifference(actual: string, counterfactual: string): string {
    if (actual === counterfactual) {
      return '无差异';
    }
    return `实际: ${actual} vs 反事实: ${counterfactual}`;
  }
  
  private estimateCounterfactualConfidence(
    fact: any,
    cf: any
  ): number {
    // 基于因果关系的强度估计置信度
    const discovery = this.discoverCauses(fact.effect);
    const cause = discovery.causes.find(c => c.node.name === fact.cause);
    return cause?.strength || 0.5;
  }
  
  private getCurrentState(variable: string): Record<string, unknown> {
    // 从知识图谱获取当前状态
    const entities = this.knowledgeGraph.queryEntities({ entityName: variable });
    return entities.length > 0 ? { value: entities[0].properties } : {};
  }
  
  private simulateIntervention(
    intervention: { variable: string; value: any },
    target: string,
    beforeState: Record<string, unknown>
  ): Record<string, unknown> {
    // 简化实现：模拟干预效果
    return {
      ...beforeState,
      [intervention.variable]: intervention.value,
      [target]: `受 ${intervention.variable} 影响`,
    };
  }
  
  private calculateCausalEffect(
    before: Record<string, unknown>,
    after: Record<string, unknown>
  ): number {
    // 简化实现：计算状态变化程度
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    let changes = 0;
    
    for (const key of keys) {
      if (before[key] !== after[key]) {
        changes++;
      }
    }
    
    return keys.size > 0 ? changes / keys.size : 0;
  }
  
  private estimateInterventionConfidence(intervention: any): number {
    // 基于干预变量的因果强度估计置信度
    return 0.7;
  }
}
