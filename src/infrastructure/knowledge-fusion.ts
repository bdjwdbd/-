/**
 * 知识融合引擎
 * 
 * 功能：
 * 1. 实体对齐（跨源去重）
 * 2. 关系推理（传递闭包）
 * 3. 置信度融合（Dempster-Shafer）
 * 4. 冲突检测与消解
 * 
 * 目标：
 * - 实体去重率: 90%
 * - 知识一致性: 95%
 */

import { StructuredLogger } from './index';
import { KnowledgeGraph, Entity, Relation } from './knowledge-graph';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface EntityAlignment {
  entity1: Entity;
  entity2: Entity;
  similarity: number;
  action: 'merge' | 'keep_both' | 'conflict';
  mergedEntity?: Partial<Entity>;
}

export interface RelationInference {
  fromId: string;
  toId: string;
  relationType: string;
  inferredFrom: string[];
  confidence: number;
}

export interface ConfidenceFusion {
  entityId: string;
  sources: string[];
  originalConfidences: number[];
  fusedConfidence: number;
  method: 'dempster_shafer' | 'average' | 'max' | 'weighted';
}

export interface ConflictDetection {
  type: 'entity' | 'relation' | 'attribute';
  entities: Entity[];
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}

export interface KnowledgeFusionResult {
  alignments: EntityAlignment[];
  inferences: RelationInference[];
  fusions: ConfidenceFusion[];
  conflicts: ConflictDetection[];
  stats: {
    entitiesProcessed: number;
    entitiesMerged: number;
    relationsInferred: number;
    conflictsDetected: number;
    processingTime: number;
  };
}

export interface KnowledgeFusionConfig {
  // 实体对齐参数
  entitySimilarityThreshold: number;
  entityMatchFields: string[];
  
  // 关系推理参数
  enableTransitiveInference: boolean;
  maxInferenceDepth: number;
  
  // 置信度融合参数
  fusionMethod: 'dempster_shafer' | 'average' | 'max' | 'weighted';
  sourceWeights: Record<string, number>;
  
  // 冲突检测参数
  conflictThreshold: number;
  autoResolve: boolean;
  
  // 持久化
  dataPath?: string;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: KnowledgeFusionConfig = {
  entitySimilarityThreshold: 0.85,
  entityMatchFields: ['name', 'type'],
  
  enableTransitiveInference: true,
  maxInferenceDepth: 3,
  
  fusionMethod: 'dempster_shafer',
  sourceWeights: {
    'user': 1.0,
    'system': 0.8,
    'external': 0.6,
  },
  
  conflictThreshold: 0.5,
  autoResolve: false,
};

// ============ 知识融合引擎类 ============

export class KnowledgeFusionEngine {
  private logger: any;
  private config: KnowledgeFusionConfig;
  private knowledgeGraph: KnowledgeGraph;
  private dataPath: string;

  constructor(
    logger: any,
    knowledgeGraph: KnowledgeGraph,
    config?: Partial<KnowledgeFusionConfig>,
    dataPath?: string
  ) {
    this.logger = logger;
    this.knowledgeGraph = knowledgeGraph;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataPath = dataPath || path.join(process.env.HOME || '.', '.openclaw', 'workspace', 'memory', 'fusion');
    
    this.ensureDir(this.dataPath);
  }

  // ============ 实体对齐 ============

  /**
   * 对齐实体
   */
  async alignEntities(sources: Entity[][]): Promise<EntityAlignment[]> {
    const startTime = Date.now();
    const alignments: EntityAlignment[] = [];
    
    // 展平所有实体
    const allEntities = sources.flat();
    const processed = new Set<string>();

    for (let i = 0; i < allEntities.length; i++) {
      for (let j = i + 1; j < allEntities.length; j++) {
        const e1 = allEntities[i];
        const e2 = allEntities[j];

        if (processed.has(e1.id) || processed.has(e2.id)) continue;

        const similarity = await this.computeEntitySimilarity(e1, e2);
        
        if (similarity >= this.config.entitySimilarityThreshold) {
          const alignment = this.createAlignment(e1, e2, similarity);
          alignments.push(alignment);
          
          if (alignment.action === 'merge') {
            processed.add(e2.id);
          }
        }
      }
    }

    this.logger.info('KnowledgeFusionEngine', 
      `实体对齐完成: ${alignments.length} 对, 耗时 ${Date.now() - startTime}ms`
    );

    return alignments;
  }

  /**
   * 计算实体相似度
   */
  private async computeEntitySimilarity(e1: Entity, e2: Entity): Promise<number> {
    let totalScore = 0;
    let totalWeight = 0;

    // 名称相似度
    const nameSimilarity = this.stringSimilarity(e1.name, e2.name);
    totalScore += nameSimilarity * 0.5;
    totalWeight += 0.5;

    // 类型匹配
    if (e1.type === e2.type) {
      totalScore += 0.3;
    }
    totalWeight += 0.3;

    // 属性相似度
    const props1 = Object.entries(e1.properties);
    const props2 = Object.entries(e2.properties);
    const commonProps = props1.filter(([k, v]) => 
      props2.some(([k2, v2]) => k2 === k && v === v2)
    );
    const propSimilarity = props1.length > 0 ? commonProps.length / props1.length : 0;
    totalScore += propSimilarity * 0.2;
    totalWeight += 0.2;

    return totalScore / totalWeight;
  }

  /**
   * 字符串相似度（Levenshtein）
   */
  private stringSimilarity(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0 || len2 === 0) return 0;
    if (s1 === s2) return 1;

    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }

  /**
   * 创建对齐结果
   */
  private createAlignment(e1: Entity, e2: Entity, similarity: number): EntityAlignment {
    // 检查是否有冲突
    const hasConflict = this.checkEntityConflict(e1, e2);
    
    if (hasConflict) {
      return {
        entity1: e1,
        entity2: e2,
        similarity,
        action: 'conflict',
      };
    }

    // 合并实体
    const mergedEntity = this.mergeEntities(e1, e2);
    
    return {
      entity1: e1,
      entity2: e2,
      similarity,
      action: 'merge',
      mergedEntity,
    };
  }

  /**
   * 检查实体冲突
   */
  private checkEntityConflict(e1: Entity, e2: Entity): boolean {
    // 检查类型冲突
    if (e1.type !== e2.type) return true;

    // 检查关键属性冲突
    const keyProps = ['id', 'name', 'type'];
    for (const prop of keyProps) {
      if (e1.properties[prop] && e2.properties[prop] && 
          e1.properties[prop] !== e2.properties[prop]) {
        return true;
      }
    }

    return false;
  }

  /**
   * 合并实体
   */
  private mergeEntities(e1: Entity, e2: Entity): Partial<Entity> {
    // 选择置信度更高的作为主实体
    const primary = e1.confidence >= e2.confidence ? e1 : e2;
    const secondary = e1.confidence >= e2.confidence ? e2 : e1;

    // 合并属性
    const mergedProperties = {
      ...secondary.properties,
      ...primary.properties,
    };

    // 合并标签
    const mergedTags = new Set([
      ...(primary.properties['tags'] as string[] || []),
      ...(secondary.properties['tags'] as string[] || []),
    ]);
    mergedProperties['tags'] = Array.from(mergedTags);

    return {
      name: primary.name,
      type: primary.type,
      properties: mergedProperties,
      confidence: Math.max(e1.confidence, e2.confidence),
      source: `${e1.source},${e2.source}`,
    };
  }

  // ============ 关系推理 ============

  /**
   * 推理传递关系
   */
  async inferRelations(): Promise<RelationInference[]> {
    if (!this.config.enableTransitiveInference) return [];

    const startTime = Date.now();
    const inferences: RelationInference[] = [];
    
    // 获取所有关系
    const allRelations = this.knowledgeGraph.queryRelations({});
    
    // 构建关系图
    const relationGraph = this.buildRelationGraph(allRelations);
    
    // 推理传递关系
    const transitiveTypes = ['is_a', 'part_of', 'depends_on'];
    
    for (const type of transitiveTypes) {
      const typeRelations = relationGraph.get(type) || new Map();
      
      for (const [fromId, targets] of typeRelations) {
        const visited = new Set<string>();
        const queue: Array<{ id: string; path: string[]; depth: number }> = [
          { id: fromId, path: [], depth: 0 }
        ];

        while (queue.length > 0) {
          const current = queue.shift()!;
          
          if (current.depth >= this.config.maxInferenceDepth) continue;
          if (visited.has(current.id)) continue;
          visited.add(current.id);

          const nextTargets = typeRelations.get(current.id) || new Set();
          
          for (const nextId of nextTargets) {
            if (nextId === fromId) continue;

            // 检查是否已存在直接关系
            const existingRelation = allRelations.find(
              r => r.fromId === fromId && r.toId === nextId && r.type === type
            );

            if (!existingRelation && current.path.length > 0) {
              inferences.push({
                fromId,
                toId: nextId,
                relationType: type,
                inferredFrom: [...current.path, current.id, nextId],
                confidence: 0.8 * Math.pow(0.9, current.depth),
              });
            }

            queue.push({
              id: nextId,
              path: [...current.path, current.id],
              depth: current.depth + 1,
            });
          }
        }
      }
    }

    this.logger.info('KnowledgeFusionEngine', 
      `关系推理完成: ${inferences.length} 条推理, 耗时 ${Date.now() - startTime}ms`
    );

    return inferences;
  }

  /**
   * 构建关系图
   */
  private buildRelationGraph(relations: Relation[]): Map<string, Map<string, Set<string>>> {
    const graph = new Map<string, Map<string, Set<string>>>();

    for (const relation of relations) {
      if (!graph.has(relation.type)) {
        graph.set(relation.type, new Map());
      }

      const typeGraph = graph.get(relation.type)!;
      
      if (!typeGraph.has(relation.fromId)) {
        typeGraph.set(relation.fromId, new Set());
      }
      
      typeGraph.get(relation.fromId)!.add(relation.toId);
    }

    return graph;
  }

  // ============ 置信度融合 ============

  /**
   * 融合置信度
   */
  async fuseConfidence(entities: Entity[]): Promise<ConfidenceFusion[]> {
    const fusions: ConfidenceFusion[] = [];

    // 按实体名称分组
    const entityGroups = new Map<string, Entity[]>();
    for (const entity of entities) {
      const key = `${entity.type}:${entity.name}`;
      if (!entityGroups.has(key)) {
        entityGroups.set(key, []);
      }
      entityGroups.get(key)!.push(entity);
    }

    // 对每组进行融合
    for (const [key, group] of entityGroups) {
      if (group.length < 2) continue;

      const sources = group.map(e => e.source);
      const confidences = group.map(e => e.confidence);
      
      let fusedConfidence: number;
      
      switch (this.config.fusionMethod) {
        case 'dempster_shafer':
          fusedConfidence = this.dempsterShaferFusion(confidences);
          break;
        case 'average':
          fusedConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
          break;
        case 'max':
          fusedConfidence = Math.max(...confidences);
          break;
        case 'weighted':
          fusedConfidence = this.weightedFusion(sources, confidences);
          break;
        default:
          fusedConfidence = Math.max(...confidences);
      }

      fusions.push({
        entityId: group[0].id,
        sources,
        originalConfidences: confidences,
        fusedConfidence,
        method: this.config.fusionMethod,
      });
    }

    return fusions;
  }

  /**
   * Dempster-Shafer 融合
   */
  private dempsterShaferFusion(confidences: number[]): number {
    if (confidences.length === 0) return 0;
    if (confidences.length === 1) return confidences[0];

    // 使用简化的 DS 融合：取加权平均
    // 避免数值溢出
    let combined = confidences[0];
    
    for (let i = 1; i < confidences.length; i++) {
      // 简化公式：combined = (combined * confidence) / (combined * confidence + (1-combined) * (1-confidence))
      const product = combined * confidences[i];
      const complement = (1 - combined) * (1 - confidences[i]);
      const denominator = product + complement;
      
      if (denominator === 0) {
        combined = 0.5;
      } else {
        combined = product / denominator;
      }
    }

    // 确保结果在 [0, 1] 范围内
    return Math.max(0, Math.min(1, combined));
  }

  /**
   * 加权融合
   */
  private weightedFusion(sources: string[], confidences: number[]): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (let i = 0; i < sources.length; i++) {
      const weight = this.config.sourceWeights[sources[i]] || 0.5;
      weightedSum += confidences[i] * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // ============ 冲突检测 ============

  /**
   * 检测冲突
   */
  async detectConflicts(entities: Entity[]): Promise<ConflictDetection[]> {
    const conflicts: ConflictDetection[] = [];

    // 检测同名实体冲突
    const nameGroups = new Map<string, Entity[]>();
    for (const entity of entities) {
      const key = entity.name.toLowerCase();
      if (!nameGroups.has(key)) {
        nameGroups.set(key, []);
      }
      nameGroups.get(key)!.push(entity);
    }

    for (const [name, group] of nameGroups) {
      if (group.length < 2) continue;

      // 检查类型冲突
      const types = new Set(group.map(e => e.type));
      if (types.size > 1) {
        conflicts.push({
          type: 'entity',
          entities: group,
          description: `同名实体 "${name}" 有多种类型: ${Array.from(types).join(', ')}`,
          severity: 'high',
        });
      }

      // 检查属性冲突
      const allProps = group.flatMap(e => Object.entries(e.properties));
      const propConflicts = this.findPropertyConflicts(allProps);
      
      for (const [prop, values] of propConflicts) {
        if (values.size > 1) {
          conflicts.push({
            type: 'attribute',
            entities: group,
            description: `属性 "${prop}" 有冲突值: ${Array.from(values).join(', ')}`,
            severity: 'medium',
          });
        }
      }
    }

    // 检测关系冲突
    const relations = this.knowledgeGraph.queryRelations({});
    const relationConflicts = this.detectRelationConflicts(relations);
    conflicts.push(...relationConflicts);

    return conflicts;
  }

  /**
   * 查找属性冲突
   */
  private findPropertyConflicts(props: [string, unknown][]): Map<string, Set<string>> {
    const propValues = new Map<string, Set<string>>();

    for (const [key, value] of props) {
      if (!propValues.has(key)) {
        propValues.set(key, new Set());
      }
      propValues.get(key)!.add(String(value));
    }

    return propValues;
  }

  /**
   * 检测关系冲突
   */
  private detectRelationConflicts(relations: Relation[]): ConflictDetection[] {
    const conflicts: ConflictDetection[] = [];

    // 检测矛盾关系
    const contradictionPairs = [
      ['is_a', 'is_not_a'],
      ['causes', 'prevents'],
      ['depends_on', 'independent_of'],
    ];

    for (const [type1, type2] of contradictionPairs) {
      const rels1 = relations.filter(r => r.type === type1);
      const rels2 = relations.filter(r => r.type === type2);

      for (const r1 of rels1) {
        for (const r2 of rels2) {
          if (r1.fromId === r2.fromId && r1.toId === r2.toId) {
            const e1 = this.knowledgeGraph.queryEntities({})[0];
            const e2 = this.knowledgeGraph.queryEntities({})[0];
            
            conflicts.push({
              type: 'relation',
              entities: [e1, e2].filter(Boolean),
              description: `矛盾关系: ${r1.fromId} ${type1} ${r1.toId} vs ${type2}`,
              severity: 'high',
            });
          }
        }
      }
    }

    return conflicts;
  }

  // ============ 综合融合 ============

  /**
   * 执行完整融合流程
   */
  async fuse(sources: Entity[][]): Promise<KnowledgeFusionResult> {
    const startTime = Date.now();
    
    // 1. 实体对齐
    const alignments = await this.alignEntities(sources);
    
    // 2. 关系推理
    const inferences = await this.inferRelations();
    
    // 3. 置信度融合
    const allEntities = sources.flat();
    const fusions = await this.fuseConfidence(allEntities);
    
    // 4. 冲突检测
    const conflicts = await this.detectConflicts(allEntities);

    const processingTime = Date.now() - startTime;
    
    const stats = {
      entitiesProcessed: allEntities.length,
      entitiesMerged: alignments.filter(a => a.action === 'merge').length,
      relationsInferred: inferences.length,
      conflictsDetected: conflicts.length,
      processingTime,
    };

    this.logger.info('KnowledgeFusionEngine', 
      `融合完成: ${stats.entitiesMerged} 合并, ${stats.relationsInferred} 推理, ${stats.conflictsDetected} 冲突, 耗时 ${processingTime}ms`
    );

    return {
      alignments,
      inferences,
      fusions,
      conflicts,
      stats,
    };
  }

  // ============ 辅助方法 ============

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ============ 导出 ============

export default KnowledgeFusionEngine;
