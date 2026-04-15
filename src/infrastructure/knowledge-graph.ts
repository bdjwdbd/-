/**
 * 知识图谱模块
 * 
 * 功能：
 * 1. 实体抽取与关系建模
 * 2. 图数据库存储
 * 3. 知识推理与查询
 * 4. 知识融合与去重
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  confidence: number;
  source: string;
  createdAt: number;
  updatedAt: number;
}

export type EntityType = 
  | 'person'      // 人物
  | 'organization' // 组织
  | 'location'    // 地点
  | 'event'       // 事件
  | 'concept'     // 概念
  | 'tool'        // 工具
  | 'skill'       // 技能
  | 'project'     // 项目
  | 'document'    // 文档
  | 'unknown';    // 未知

export interface Relation {
  id: string;
  type: RelationType;
  fromId: string;
  toId: string;
  properties: Record<string, unknown>;
  confidence: number;
  source: string;
  createdAt: number;
}

export type RelationType = 
  | 'is_a'        // 是一种
  | 'has_a'       // 拥有
  | 'part_of'     // 部分
  | 'related_to'  // 相关
  | 'causes'      // 导致
  | 'uses'        // 使用
  | 'created_by'  // 创建者
  | 'located_at'  // 位于
  | 'occurs_at'   // 发生于
  | 'depends_on'  // 依赖
  | 'implements'  // 实现
  | 'knows';      // 知道

export interface KnowledgeQuery {
  entityType?: EntityType;
  entityName?: string;
  relationType?: RelationType;
  fromId?: string;
  toId?: string;
  properties?: Record<string, unknown>;
  minConfidence?: number;
  limit?: number;
}

export interface KnowledgeGraphStats {
  totalEntities: number;
  totalRelations: number;
  entitiesByType: Record<EntityType, number>;
  relationsByType: Record<RelationType, number>;
  avgConfidence: number;
}

// ============ 知识图谱 ============

export class KnowledgeGraph {
  private logger: StructuredLogger;
  private dataDir: string;
  
  // 存储
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation> = new Map();
  
  // 索引
  private entityNameIndex: Map<string, Set<string>> = new Map();
  private entityTypeIndex: Map<EntityType, Set<string>> = new Map();
  private relationFromIndex: Map<string, Set<string>> = new Map();
  private relationToIndex: Map<string, Set<string>> = new Map();
  
  constructor(logger: StructuredLogger, dataDir: string = './data/knowledge') {
    this.logger = logger;
    this.dataDir = dataDir;
    this.ensureDir(dataDir);
    this.loadData();
  }
  
  /**
   * 添加实体
   */
  addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Entity {
    const id = this.generateId('entity');
    const now = Date.now();
    
    const newEntity: Entity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    // 存储
    this.entities.set(id, newEntity);
    
    // 更新索引
    this.addToIndex(this.entityNameIndex, entity.name.toLowerCase(), id);
    this.addToIndex(this.entityTypeIndex, entity.type, id);
    
    this.logger.debug('KnowledgeGraph', `添加实体: ${entity.name} (${entity.type})`);
    
    // 定期保存
    if (this.entities.size % 100 === 0) {
      this.saveData();
    }
    
    return newEntity;
  }
  
  /**
   * 添加关系
   */
  addRelation(relation: Omit<Relation, 'id' | 'createdAt'>): Relation {
    const id = this.generateId('relation');
    
    // 验证实体存在
    if (!this.entities.has(relation.fromId)) {
      this.logger.warn('KnowledgeGraph', `源实体不存在: ${relation.fromId}`);
    }
    if (!this.entities.has(relation.toId)) {
      this.logger.warn('KnowledgeGraph', `目标实体不存在: ${relation.toId}`);
    }
    
    const newRelation: Relation = {
      ...relation,
      id,
      createdAt: Date.now(),
    };
    
    // 存储
    this.relations.set(id, newRelation);
    
    // 更新索引
    this.addToIndex(this.relationFromIndex, relation.fromId, id);
    this.addToIndex(this.relationToIndex, relation.toId, id);
    
    this.logger.debug('KnowledgeGraph', 
      `添加关系: ${relation.fromId} --${relation.type}--> ${relation.toId}`
    );
    
    return newRelation;
  }
  
  /**
   * 查询实体
   */
  queryEntities(query: KnowledgeQuery): Entity[] {
    let results: Entity[] = [];
    
    // 按类型筛选
    if (query.entityType) {
      const ids = this.entityTypeIndex.get(query.entityType) || new Set();
      results = Array.from(ids).map(id => this.entities.get(id)!).filter(Boolean);
    } else {
      results = Array.from(this.entities.values());
    }
    
    // 按名称筛选
    if (query.entityName) {
      const searchName = query.entityName.toLowerCase();
      results = results.filter(e => 
        e.name.toLowerCase().includes(searchName)
      );
    }
    
    // 按置信度筛选
    if (query.minConfidence !== undefined) {
      results = results.filter(e => e.confidence >= query.minConfidence!);
    }
    
    // 按属性筛选
    if (query.properties) {
      results = results.filter(e => {
        for (const [key, value] of Object.entries(query.properties!)) {
          if (e.properties[key] !== value) return false;
        }
        return true;
      });
    }
    
    // 限制数量
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }
  
  /**
   * 查询关系
   */
  queryRelations(query: KnowledgeQuery): Relation[] {
    let results: Relation[] = [];
    
    // 按源实体筛选
    if (query.fromId) {
      const ids = this.relationFromIndex.get(query.fromId) || new Set();
      results = Array.from(ids).map(id => this.relations.get(id)!).filter(Boolean);
    } else if (query.toId) {
      const ids = this.relationToIndex.get(query.toId) || new Set();
      results = Array.from(ids).map(id => this.relations.get(id)!).filter(Boolean);
    } else {
      results = Array.from(this.relations.values());
    }
    
    // 按关系类型筛选
    if (query.relationType) {
      results = results.filter(r => r.type === query.relationType);
    }
    
    // 按置信度筛选
    if (query.minConfidence !== undefined) {
      results = results.filter(r => r.confidence >= query.minConfidence!);
    }
    
    // 限制数量
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }
  
  /**
   * 获取实体的所有关系
   */
  getEntityRelations(entityId: string): {
    outgoing: Relation[];
    incoming: Relation[];
  } {
    const outgoingIds = this.relationFromIndex.get(entityId) || new Set();
    const incomingIds = this.relationToIndex.get(entityId) || new Set();
    
    return {
      outgoing: Array.from(outgoingIds).map(id => this.relations.get(id)!).filter(Boolean),
      incoming: Array.from(incomingIds).map(id => this.relations.get(id)!).filter(Boolean),
    };
  }
  
  /**
   * 推理：获取相关实体
   */
  inferRelatedEntities(entityId: string, maxDepth: number = 2): Entity[] {
    const visited = new Set<string>();
    const related: Entity[] = [];
    
    const traverse = (id: string, depth: number) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);
      
      const entity = this.entities.get(id);
      if (entity && id !== entityId) {
        related.push(entity);
      }
      
      const { outgoing, incoming } = this.getEntityRelations(id);
      
      for (const rel of outgoing) {
        traverse(rel.toId, depth + 1);
      }
      
      for (const rel of incoming) {
        traverse(rel.fromId, depth + 1);
      }
    };
    
    traverse(entityId, 0);
    
    return related;
  }
  
  /**
   * 推理：路径查找
   */
  findPath(fromId: string, toId: string, maxDepth: number = 5): string[] | null {
    const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      
      if (id === toId) {
        return path;
      }
      
      if (path.length > maxDepth) continue;
      if (visited.has(id)) continue;
      visited.add(id);
      
      const { outgoing } = this.getEntityRelations(id);
      
      for (const rel of outgoing) {
        if (!visited.has(rel.toId)) {
          queue.push({ id: rel.toId, path: [...path, rel.toId] });
        }
      }
    }
    
    return null;
  }
  
  /**
   * 获取或创建实体
   */
  getOrCreateEntity(
    name: string,
    type: EntityType,
    properties: Record<string, unknown> = {},
    confidence: number = 0.8,
    source: string = 'unknown'
  ): Entity {
    // 查找现有实体
    const existing = this.queryEntities({ entityName: name, entityType: type });
    if (existing.length > 0) {
      // 更新置信度
      const entity = existing[0];
      entity.confidence = Math.min(1, entity.confidence + 0.1);
      entity.updatedAt = Date.now();
      return entity;
    }
    
    // 创建新实体
    return this.addEntity({ name, type, properties, confidence, source });
  }
  
  /**
   * 获取统计信息
   */
  getStats(): KnowledgeGraphStats {
    const entitiesByType: Record<EntityType, number> = {} as any;
    const relationsByType: Record<RelationType, number> = {} as any;
    
    for (const [type, ids] of this.entityTypeIndex) {
      entitiesByType[type] = ids.size;
    }
    
    for (const relation of this.relations.values()) {
      relationsByType[relation.type] = (relationsByType[relation.type] || 0) + 1;
    }
    
    const totalConfidence = Array.from(this.entities.values())
      .reduce((sum, e) => sum + e.confidence, 0);
    
    return {
      totalEntities: this.entities.size,
      totalRelations: this.relations.size,
      entitiesByType,
      relationsByType,
      avgConfidence: this.entities.size > 0 ? totalConfidence / this.entities.size : 0,
    };
  }
  
  // ============ 数据持久化 ============
  
  private loadData(): void {
    try {
      const entitiesFile = path.join(this.dataDir, 'entities.json');
      if (fs.existsSync(entitiesFile)) {
        const data = JSON.parse(fs.readFileSync(entitiesFile, 'utf-8'));
        for (const entity of data) {
          this.entities.set(entity.id, entity);
          this.addToIndex(this.entityNameIndex, entity.name.toLowerCase(), entity.id);
          this.addToIndex(this.entityTypeIndex, entity.type, entity.id);
        }
      }
      
      const relationsFile = path.join(this.dataDir, 'relations.json');
      if (fs.existsSync(relationsFile)) {
        const data = JSON.parse(fs.readFileSync(relationsFile, 'utf-8'));
        for (const relation of data) {
          this.relations.set(relation.id, relation);
          this.addToIndex(this.relationFromIndex, relation.fromId, relation.id);
          this.addToIndex(this.relationToIndex, relation.toId, relation.id);
        }
      }
      
      this.logger.info('KnowledgeGraph', 
        `加载完成: ${this.entities.size} 实体, ${this.relations.size} 关系`
      );
    } catch (error) {
      this.logger.warn('KnowledgeGraph', `加载失败: ${error}`);
    }
  }
  
  saveData(): void {
    try {
      const entitiesFile = path.join(this.dataDir, 'entities.json');
      fs.writeFileSync(entitiesFile, JSON.stringify(Array.from(this.entities.values()), null, 2));
      
      const relationsFile = path.join(this.dataDir, 'relations.json');
      fs.writeFileSync(relationsFile, JSON.stringify(Array.from(this.relations.values()), null, 2));
      
      this.logger.debug('KnowledgeGraph', '数据已保存');
    } catch (error) {
      this.logger.warn('KnowledgeGraph', `保存失败: ${error}`);
    }
  }
  
  // ============ 辅助方法 ============
  
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private addToIndex(map: Map<string, Set<string>>, key: string, value: string): void {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key)!.add(value);
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
