/**
 * 知识图谱系统
 * 
 * 借鉴来源：GraphRAG + LightRAG
 * 
 * 核心功能：
 * - 实体提取：从文本中提取实体
 * - 关系建立：建立实体间的关系
 * - 社区检测：检测实体社区
 * - 社区摘要：生成社区摘要
 */

// ============================================================================
// 类型定义
// ============================================================================

export enum EntityType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  EVENT = 'event',
  CONCEPT = 'concept',
  LOCATION = 'location',
  TECHNOLOGY = 'technology',
  OTHER = 'other'
}

export enum RelationType {
  WORKS_FOR = 'works_for',
  MANAGES = 'manages',
  USES = 'uses',
  CREATES = 'creates',
  PARTICIPATES_IN = 'participates_in',
  LOCATED_IN = 'located_in',
  RELATED_TO = 'related_to',
  DEPENDS_ON = 'depends_on'
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  sourceIds: string[];
  embedding?: number[];
  properties: Record<string, any>;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: RelationType | string;
  description: string;
  sourceIds: string[];
  weight: number;
  properties: Record<string, any>;
}

export interface Community {
  id: string;
  level: number;
  entityIds: string[];
  summary: string;
  keywords: string[];
}

export interface KnowledgeGraphStats {
  entityCount: number;
  relationCount: number;
  communityCount: number;
  avgConnections: number;
}

// ============================================================================
// 实体提取器
// ============================================================================

export class EntityExtractor {
  private patterns = {
    [EntityType.PERSON]: [
      /([A-Z][a-z]+ [A-Z][a-z]+)/g,  // 英文名
      /([\u4e00-\u9fa5]{2,4})/g      // 中文名
    ],
    [EntityType.ORGANIZATION]: [
      /([A-Z][a-z]+ (?:Inc|Corp|LLC|Ltd|Company|Team|Group))/g,
      /([\u4e00-\u9fa5]+(?:公司|团队|组织|部门|小组))/g
    ],
    [EntityType.TECHNOLOGY]: [
      /([A-Z][a-zA-Z0-9]*(?:JS|API|SDK|DB|SQL|ML|AI|LLM)?)/g,
      /([\u4e00-\u9fa5]+(?:框架|系统|平台|引擎|模型))/g
    ]
  };

  /**
   * 从文本提取实体
   */
  extract(text: string, sourceId: string): Entity[] {
    const entities: Entity[] = [];
    const seen = new Set<string>();

    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const matches = text.match(pattern) || [];
        for (const match of matches) {
          if (seen.has(match)) continue;
          seen.add(match);

          entities.push({
            id: `entity-${match}-${Date.now()}`,
            name: match,
            type: type as EntityType,
            description: `从文本中提取的${type}`,
            sourceIds: [sourceId],
            properties: {}
          });
        }
      }
    }

    return entities;
  }

  /**
   * 合并实体
   */
  merge(existing: Entity[], newEntities: Entity[]): Entity[] {
    const merged = new Map<string, Entity>();

    // 添加现有实体
    for (const entity of existing) {
      merged.set(entity.name, entity);
    }

    // 合并新实体
    for (const entity of newEntities) {
      const existing = merged.get(entity.name);
      if (existing) {
        // 合并来源
        existing.sourceIds = [...new Set([...existing.sourceIds, ...entity.sourceIds])];
      } else {
        merged.set(entity.name, entity);
      }
    }

    return Array.from(merged.values());
  }
}

// ============================================================================
// 关系提取器
// ============================================================================

export class RelationExtractor {
  private patterns = [
    { pattern: /(\w+) (?:是|为|担任) (\w+) (?:的|之) (?:CEO|CTO|负责人|经理|总监)/, type: RelationType.MANAGES },
    { pattern: /(\w+) (?:在|于) (\w+) (?:工作|任职)/, type: RelationType.WORKS_FOR },
    { pattern: /(\w+) (?:使用|采用|基于) (\w+)/, type: RelationType.USES },
    { pattern: /(\w+) (?:创建|开发|设计|实现) (?:了|了) (\w+)/, type: RelationType.CREATES },
    { pattern: /(\w+) (?:参与|参加) (?:了|了) (\w+)/, type: RelationType.PARTICIPATES_IN },
    { pattern: /(\w+) (?:位于|在) (\w+)/, type: RelationType.LOCATED_IN },
    { pattern: /(\w+) (?:依赖|基于|需要) (\w+)/, type: RelationType.DEPENDS_ON }
  ];

  /**
   * 从文本提取关系
   */
  extract(text: string, entities: Entity[], sourceId: string): Relation[] {
    const relations: Relation[] = [];
    const entityNames = new Map(entities.map(e => [e.name, e.id]));

    for (const { pattern, type } of this.patterns) {
      const matches = text.matchAll(new RegExp(pattern, 'g'));
      for (const match of matches) {
        const sourceName = match[1];
        const targetName = match[2];

        const sourceId = entityNames.get(sourceName);
        const targetId = entityNames.get(targetName);

        if (sourceId && targetId) {
          relations.push({
            id: `relation-${sourceId}-${type}-${targetId}`,
            source: sourceId,
            target: targetId,
            type,
            description: `${sourceName} ${this.getRelationDescription(type)} ${targetName}`,
            sourceIds: [sourceId],
            weight: 1,
            properties: {}
          });
        }
      }
    }

    return relations;
  }

  /**
   * 获取关系描述
   */
  private getRelationDescription(type: RelationType): string {
    const descriptions: Record<RelationType, string> = {
      [RelationType.WORKS_FOR]: '工作于',
      [RelationType.MANAGES]: '管理',
      [RelationType.USES]: '使用',
      [RelationType.CREATES]: '创建',
      [RelationType.PARTICIPATES_IN]: '参与',
      [RelationType.LOCATED_IN]: '位于',
      [RelationType.RELATED_TO]: '相关于',
      [RelationType.DEPENDS_ON]: '依赖于'
    };
    return descriptions[type] || '关联';
  }
}

// ============================================================================
// 社区检测器
// ============================================================================

export class CommunityDetector {
  /**
   * 检测社区（简化版 Louvain 算法）
   */
  detect(entities: Entity[], relations: Relation[]): Community[] {
    const communities: Community[] = [];
    const adjacency = this.buildAdjacency(entities, relations);
    const visited = new Set<string>();

    // 简单的连通分量检测
    for (const entity of entities) {
      if (visited.has(entity.id)) continue;

      const component = this.findConnectedComponent(entity.id, adjacency, visited);
      if (component.length > 1) {
        communities.push({
          id: `community-${communities.length}`,
          level: 0,
          entityIds: component,
          summary: '',
          keywords: []
        });
      }
    }

    return communities;
  }

  /**
   * 构建邻接表
   */
  private buildAdjacency(entities: Entity[], relations: Relation[]): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();

    for (const entity of entities) {
      adjacency.set(entity.id, new Set());
    }

    for (const relation of relations) {
      adjacency.get(relation.source)?.add(relation.target);
      adjacency.get(relation.target)?.add(relation.source);
    }

    return adjacency;
  }

  /**
   * 查找连通分量
   */
  private findConnectedComponent(
    startId: string,
    adjacency: Map<string, Set<string>>,
    visited: Set<string>
  ): string[] {
    const component: string[] = [];
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      component.push(current);

      const neighbors = adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return component;
  }
}

// ============================================================================
// 社区摘要生成器
// ============================================================================

export class CommunitySummarizer {
  /**
   * 生成社区摘要
   */
  summarize(community: Community, entities: Entity[], relations: Relation[]): string {
    const communityEntities = entities.filter(e => community.entityIds.includes(e.id));
    const communityRelations = relations.filter(r => 
      community.entityIds.includes(r.source) && community.entityIds.includes(r.target)
    );

    // 统计实体类型
    const typeCounts = new Map<EntityType, number>();
    for (const entity of communityEntities) {
      typeCounts.set(entity.type, (typeCounts.get(entity.type) || 0) + 1);
    }

    // 统计关系类型
    const relationCounts = new Map<string, number>();
    for (const relation of communityRelations) {
      relationCounts.set(relation.type, (relationCounts.get(relation.type) || 0) + 1);
    }

    // 生成摘要
    const parts: string[] = [];
    parts.push(`社区包含 ${communityEntities.length} 个实体`);

    const typeSummary = Array.from(typeCounts.entries())
      .map(([type, count]) => `${count} 个${type}`)
      .join('、');
    if (typeSummary) parts.push(typeSummary);

    parts.push(`${communityRelations.length} 个关系`);

    const relationSummary = Array.from(relationCounts.entries())
      .map(([type, count]) => `${count} 个${type}关系`)
      .join('、');
    if (relationSummary) parts.push(relationSummary);

    return parts.join('，') + '。';
  }

  /**
   * 提取关键词
   */
  extractKeywords(community: Community, entities: Entity[]): string[] {
    const communityEntities = entities.filter(e => community.entityIds.includes(e.id));
    
    // 按类型分组
    const byType = new Map<EntityType, Entity[]>();
    for (const entity of communityEntities) {
      if (!byType.has(entity.type)) {
        byType.set(entity.type, []);
      }
      byType.get(entity.type)!.push(entity);
    }

    // 提取每个类型的代表性实体
    const keywords: string[] = [];
    for (const [type, entities] of byType) {
      // 取前 3 个作为关键词
      keywords.push(...entities.slice(0, 3).map(e => e.name));
    }

    return keywords.slice(0, 10);
  }
}

// ============================================================================
// 知识图谱主类
// ============================================================================

export class KnowledgeGraph {
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation> = new Map();
  private communities: Map<string, Community> = new Map();

  private entityExtractor: EntityExtractor;
  private relationExtractor: RelationExtractor;
  private communityDetector: CommunityDetector;
  private communitySummarizer: CommunitySummarizer;

  constructor() {
    this.entityExtractor = new EntityExtractor();
    this.relationExtractor = new RelationExtractor();
    this.communityDetector = new CommunityDetector();
    this.communitySummarizer = new CommunitySummarizer();
  }

  /**
   * 索引文档
   */
  indexDocument(text: string, sourceId: string): void {
    // 1. 提取实体
    const newEntities = this.entityExtractor.extract(text, sourceId);
    const existingEntities = Array.from(this.entities.values());
    const mergedEntities = this.entityExtractor.merge(existingEntities, newEntities);

    // 更新实体
    for (const entity of mergedEntities) {
      this.entities.set(entity.id, entity);
    }

    // 2. 提取关系
    const newRelations = this.relationExtractor.extract(text, mergedEntities, sourceId);
    for (const relation of newRelations) {
      this.relations.set(relation.id, relation);
    }

    // 3. 检测社区
    this.updateCommunities();
  }

  /**
   * 更新社区
   */
  private updateCommunities(): void {
    const entities = Array.from(this.entities.values());
    const relations = Array.from(this.relations.values());

    const newCommunities = this.communityDetector.detect(entities, relations);

    this.communities.clear();
    for (const community of newCommunities) {
      // 生成摘要
      community.summary = this.communitySummarizer.summarize(community, entities, relations);
      community.keywords = this.communitySummarizer.extractKeywords(community, entities);
      this.communities.set(community.id, community);
    }
  }

  /**
   * 查询实体
   */
  queryEntity(name: string): Entity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.name === name) {
        return entity;
      }
    }
    return undefined;
  }

  /**
   * 查询关系
   */
  queryRelations(entityId: string): Relation[] {
    return Array.from(this.relations.values())
      .filter(r => r.source === entityId || r.target === entityId);
  }

  /**
   * 查询社区
   */
  queryCommunity(entityId: string): Community | undefined {
    for (const community of this.communities.values()) {
      if (community.entityIds.includes(entityId)) {
        return community;
      }
    }
    return undefined;
  }

  /**
   * 获取统计
   */
  getStats(): KnowledgeGraphStats {
    const entities = Array.from(this.entities.values());
    const relations = Array.from(this.relations.values());
    const communities = Array.from(this.communities.values());

    // 计算平均连接数
    const connectionCounts = new Map<string, number>();
    for (const entity of entities) {
      connectionCounts.set(entity.id, 0);
    }
    for (const relation of relations) {
      connectionCounts.set(relation.source, (connectionCounts.get(relation.source) || 0) + 1);
      connectionCounts.set(relation.target, (connectionCounts.get(relation.target) || 0) + 1);
    }

    const totalConnections = Array.from(connectionCounts.values()).reduce((a, b) => a + b, 0);
    const avgConnections = entities.length > 0 ? totalConnections / entities.length : 0;

    return {
      entityCount: entities.length,
      relationCount: relations.length,
      communityCount: communities.length,
      avgConnections
    };
  }

  /**
   * 导出图谱
   */
  export(): { entities: Entity[]; relations: Relation[]; communities: Community[] } {
    return {
      entities: Array.from(this.entities.values()),
      relations: Array.from(this.relations.values()),
      communities: Array.from(this.communities.values())
    };
  }
}

// 默认导出
export default KnowledgeGraph;
