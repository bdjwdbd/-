/**
 * 知识图谱集成模块
 * 
 * 功能：
 * 1. 实体管理
 * 2. 关系管理
 * 3. 图谱查询
 * 4. 推理支持
 */

// ============================================================
// 类型定义
// ============================================================

interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface Relation {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, unknown>;
  weight: number;
  createdAt: number;
}

interface GraphQuery {
  entityType?: string;
  relationType?: string;
  entityId?: string;
  properties?: Record<string, unknown>;
  depth?: number;
  limit?: number;
}

interface GraphPath {
  nodes: Entity[];
  edges: Relation[];
  length: number;
}

// ============================================================
// 知识图谱存储
// ============================================================

export class KnowledgeGraphStore {
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation> = new Map();
  private entityIndex: Map<string, Set<string>> = new Map(); // type -> ids
  private relationIndex: Map<string, Set<string>> = new Map(); // type -> ids
  private outgoingIndex: Map<string, Set<string>> = new Map(); // sourceId -> relationIds
  private incomingIndex: Map<string, Set<string>> = new Map(); // targetId -> relationIds

  /**
   * 添加实体
   */
  addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Entity {
    const id = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const newEntity: Entity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.entities.set(id, newEntity);

    // 更新索引
    if (!this.entityIndex.has(entity.type)) {
      this.entityIndex.set(entity.type, new Set());
    }
    this.entityIndex.get(entity.type)!.add(id);

    return newEntity;
  }

  /**
   * 获取实体
   */
  getEntity(id: string): Entity | null {
    return this.entities.get(id) || null;
  }

  /**
   * 更新实体
   */
  updateEntity(id: string, properties: Record<string, unknown>): Entity | null {
    const entity = this.entities.get(id);
    if (!entity) return null;

    entity.properties = { ...entity.properties, ...properties };
    entity.updatedAt = Date.now();

    return entity;
  }

  /**
   * 删除实体
   */
  deleteEntity(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // 删除相关关系
    const outgoing = this.outgoingIndex.get(id) || new Set();
    const incoming = this.incomingIndex.get(id) || new Set();

    for (const relId of [...outgoing, ...incoming]) {
      this.deleteRelation(relId);
    }

    // 删除实体
    this.entities.delete(id);
    this.entityIndex.get(entity.type)?.delete(id);
    this.outgoingIndex.delete(id);
    this.incomingIndex.delete(id);

    return true;
  }

  /**
   * 添加关系
   */
  addRelation(relation: Omit<Relation, 'id' | 'createdAt'>): Relation {
    const id = `relation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newRelation: Relation = {
      ...relation,
      id,
      createdAt: Date.now(),
    };

    this.relations.set(id, newRelation);

    // 更新索引
    if (!this.relationIndex.has(relation.type)) {
      this.relationIndex.set(relation.type, new Set());
    }
    this.relationIndex.get(relation.type)!.add(id);

    if (!this.outgoingIndex.has(relation.sourceId)) {
      this.outgoingIndex.set(relation.sourceId, new Set());
    }
    this.outgoingIndex.get(relation.sourceId)!.add(id);

    if (!this.incomingIndex.has(relation.targetId)) {
      this.incomingIndex.set(relation.targetId, new Set());
    }
    this.incomingIndex.get(relation.targetId)!.add(id);

    return newRelation;
  }

  /**
   * 获取关系
   */
  getRelation(id: string): Relation | null {
    return this.relations.get(id) || null;
  }

  /**
   * 删除关系
   */
  deleteRelation(id: string): boolean {
    const relation = this.relations.get(id);
    if (!relation) return false;

    this.relations.delete(id);
    this.relationIndex.get(relation.type)?.delete(id);
    this.outgoingIndex.get(relation.sourceId)?.delete(id);
    this.incomingIndex.get(relation.targetId)?.delete(id);

    return true;
  }

  /**
   * 查询实体
   */
  queryEntities(query: GraphQuery): Entity[] {
    let results: Entity[] = [];

    if (query.entityType) {
      const ids = this.entityIndex.get(query.entityType) || new Set();
      results = Array.from(ids).map(id => this.entities.get(id)!).filter(Boolean);
    } else {
      results = Array.from(this.entities.values());
    }

    // 属性过滤
    if (query.properties) {
      results = results.filter(e => {
        for (const [key, value] of Object.entries(query.properties!)) {
          if (e.properties[key] !== value) return false;
        }
        return true;
      });
    }

    return results.slice(0, query.limit || 100);
  }

  /**
   * 获取出边
   */
  getOutgoingRelations(entityId: string, relationType?: string): Relation[] {
    const ids = this.outgoingIndex.get(entityId) || new Set();
    let relations = Array.from(ids).map(id => this.relations.get(id)!).filter(Boolean);

    if (relationType) {
      relations = relations.filter(r => r.type === relationType);
    }

    return relations;
  }

  /**
   * 获取入边
   */
  getIncomingRelations(entityId: string, relationType?: string): Relation[] {
    const ids = this.incomingIndex.get(entityId) || new Set();
    let relations = Array.from(ids).map(id => this.relations.get(id)!).filter(Boolean);

    if (relationType) {
      relations = relations.filter(r => r.type === relationType);
    }

    return relations;
  }

  /**
   * 获取统计
   */
  getStats(): { entities: number; relations: number; entityTypes: number; relationTypes: number } {
    return {
      entities: this.entities.size,
      relations: this.relations.size,
      entityTypes: this.entityIndex.size,
      relationTypes: this.relationIndex.size,
    };
  }
}

// ============================================================
// 知识图谱查询器
// ============================================================

export class KnowledgeGraphQuery {
  private store: KnowledgeGraphStore;

  constructor(store: KnowledgeGraphStore) {
    this.store = store;
  }

  /**
   * 查找路径
   */
  findPath(sourceId: string, targetId: string, maxDepth: number = 5): GraphPath | null {
    if (sourceId === targetId) {
      const entity = this.store.getEntity(sourceId);
      return entity ? { nodes: [entity], edges: [], length: 0 } : null;
    }

    // BFS 搜索
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: GraphPath }> = [];

    const sourceEntity = this.store.getEntity(sourceId);
    if (!sourceEntity) return null;

    queue.push({ id: sourceId, path: { nodes: [sourceEntity], edges: [], length: 0 } });
    visited.add(sourceId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.path.length >= maxDepth) continue;

      const outgoing = this.store.getOutgoingRelations(current.id);
      
      for (const rel of outgoing) {
        if (visited.has(rel.targetId)) continue;
        visited.add(rel.targetId);

        const targetEntity = this.store.getEntity(rel.targetId);
        if (!targetEntity) continue;

        const newPath: GraphPath = {
          nodes: [...current.path.nodes, targetEntity],
          edges: [...current.path.edges, rel],
          length: current.path.length + 1,
        };

        if (rel.targetId === targetId) {
          return newPath;
        }

        queue.push({ id: rel.targetId, path: newPath });
      }
    }

    return null;
  }

  /**
   * 查找邻居
   */
  findNeighbors(entityId: string, depth: number = 1): { entities: Entity[]; relations: Relation[] } {
    const entities: Entity[] = [];
    const relations: Relation[] = [];
    const visited = new Set<string>();

    const collect = (id: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const outgoing = this.store.getOutgoingRelations(id);
      const incoming = this.store.getIncomingRelations(id);

      for (const rel of [...outgoing, ...incoming]) {
        relations.push(rel);

        const neighborId = rel.sourceId === id ? rel.targetId : rel.sourceId;
        const neighbor = this.store.getEntity(neighborId);
        if (neighbor && !visited.has(neighborId)) {
          entities.push(neighbor);
          collect(neighborId, currentDepth + 1);
        }
      }
    };

    collect(entityId, 1);

    return { entities, relations };
  }

  /**
   * 推理查询
   */
  infer(startId: string, rules: Array<{ relationType: string; direction: 'out' | 'in' }>): Entity[] {
    let currentIds = [startId];

    for (const rule of rules) {
      const nextIds: string[] = [];

      for (const id of currentIds) {
        const relations = rule.direction === 'out'
          ? this.store.getOutgoingRelations(id, rule.relationType)
          : this.store.getIncomingRelations(id, rule.relationType);

        for (const rel of relations) {
          const nextId = rule.direction === 'out' ? rel.targetId : rel.sourceId;
          if (!nextIds.includes(nextId)) {
            nextIds.push(nextId);
          }
        }
      }

      currentIds = nextIds;
    }

    return currentIds.map(id => this.store.getEntity(id)!).filter(Boolean);
  }
}

// ============================================================
// 知识图谱管理器
// ============================================================

export class KnowledgeGraphManager {
  private store: KnowledgeGraphStore;
  private query: KnowledgeGraphQuery;

  constructor() {
    this.store = new KnowledgeGraphStore();
    this.query = new KnowledgeGraphQuery(this.store);
  }

  /**
   * 添加实体
   */
  addEntity(type: string, name: string, properties?: Record<string, unknown>): Entity {
    return this.store.addEntity({ type, name, properties: properties || {} });
  }

  /**
   * 添加关系
   */
  addRelation(type: string, sourceId: string, targetId: string, weight: number = 1): Relation {
    return this.store.addRelation({ type, sourceId, targetId, properties: {}, weight });
  }

  /**
   * 查询实体
   */
  queryEntities(query: GraphQuery): Entity[] {
    return this.store.queryEntities(query);
  }

  /**
   * 查找路径
   */
  findPath(sourceId: string, targetId: string, maxDepth?: number): GraphPath | null {
    return this.query.findPath(sourceId, targetId, maxDepth);
  }

  /**
   * 查找邻居
   */
  findNeighbors(entityId: string, depth?: number): { entities: Entity[]; relations: Relation[] } {
    return this.query.findNeighbors(entityId, depth);
  }

  /**
   * 推理
   */
  infer(startId: string, rules: Array<{ relationType: string; direction: 'out' | 'in' }>): Entity[] {
    return this.query.infer(startId, rules);
  }

  /**
   * 获取统计
   */
  getStats(): { entities: number; relations: number; entityTypes: number; relationTypes: number } {
    return this.store.getStats();
  }

  /**
   * 获取存储
   */
  getStore(): KnowledgeGraphStore {
    return this.store;
  }

  /**
   * 获取查询器
   */
  getQuery(): KnowledgeGraphQuery {
    return this.query;
  }
}

// ============================================================
// 单例
// ============================================================

let knowledgeGraphInstance: KnowledgeGraphManager | null = null;

export function getKnowledgeGraphManager(): KnowledgeGraphManager {
  if (!knowledgeGraphInstance) {
    knowledgeGraphInstance = new KnowledgeGraphManager();
  }
  return knowledgeGraphInstance;
}
