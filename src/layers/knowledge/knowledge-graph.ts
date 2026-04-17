/**
 * 知识图谱系统
 * 
 * 借鉴：GraphRAG + LightRAG
 * 
 * 核心功能：
 * 1. 实体提取 - 从文本中识别实体
 * 2. 关系提取 - 识别实体间关系
 * 3. 社区检测 - Leiden 算法
 * 4. 社区摘要 - 层次化社区结构
 * 5. 三种查询模式 - Local/Global/Hybrid
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 实体类型
 */
export enum EntityType {
  /** 人物 */
  PERSON = 'person',
  /** 组织 */
  ORGANIZATION = 'organization',
  /** 地点 */
  LOCATION = 'location',
  /** 事件 */
  EVENT = 'event',
  /** 概念 */
  CONCEPT = 'concept',
  /** 产品 */
  PRODUCT = 'product',
  /** 技术 */
  TECHNOLOGY = 'technology',
  /** 文档 */
  DOCUMENT = 'document',
  /** 代码 */
  CODE = 'code',
  /** 其他 */
  OTHER = 'other'
}

/**
 * 关系类型
 */
export enum RelationType {
  /** 属于 */
  BELONGS_TO = 'belongs_to',
  /** 包含 */
  CONTAINS = 'contains',
  /** 相关 */
  RELATED_TO = 'related_to',
  /** 依赖 */
  DEPENDS_ON = 'depends_on',
  /** 实现 */
  IMPLEMENTS = 'implements',
  /** 使用 */
  USES = 'uses',
  /** 创建 */
  CREATES = 'creates',
  /** 修改 */
  MODIFIES = 'modifies',
  /** 引用 */
  REFERENCES = 'references',
  /** 其他 */
  OTHER = 'other'
}

/**
 * 实体定义
 */
export interface Entity {
  /** 实体 ID */
  id: string;
  /** 实体名称 */
  name: string;
  /** 实体类型 */
  type: EntityType;
  /** 描述 */
  description: string;
  /** 来源文档 ID */
  sourceIds: string[];
  /** 属性 */
  properties: Record<string, unknown>;
  /** 嵌入向量 */
  embedding?: number[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 重要性分数 */
  importance: number;
}

/**
 * 关系定义
 */
export interface Relation {
  /** 关系 ID */
  id: string;
  /** 源实体 ID */
  sourceId: string;
  /** 目标实体 ID */
  targetId: string;
  /** 关系类型 */
  type: RelationType;
  /** 描述 */
  description: string;
  /** 来源文档 ID */
  sourceIds: string[];
  /** 属性 */
  properties: Record<string, unknown>;
  /** 权重 */
  weight: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 社区定义
 */
export interface Community {
  /** 社区 ID */
  id: string;
  /** 社区名称 */
  name: string;
  /** 层级 */
  level: number;
  /** 实体 ID 列表 */
  entityIds: string[];
  /** 子社区 ID 列表 */
  childCommunityIds: string[];
  /** 父社区 ID */
  parentCommunityId?: string;
  /** 摘要 */
  summary: string;
  /** 关键实体 */
  keyEntities: string[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 文档定义
 */
export interface Document {
  /** 文档 ID */
  id: string;
  /** 文档内容 */
  content: string;
  /** 文档标题 */
  title?: string;
  /** 元数据 */
  metadata: Record<string, unknown>;
  /** 分块列表 */
  chunks: DocumentChunk[];
  /** 创建时间 */
  createdAt: number;
}

/**
 * 文档分块
 */
export interface DocumentChunk {
  /** 分块 ID */
  id: string;
  /** 文档 ID */
  documentId: string;
  /** 内容 */
  content: string;
  /** 起始位置 */
  startIndex: number;
  /** 结束位置 */
  endIndex: number;
  /** 嵌入向量 */
  embedding?: number[];
}

/**
 * 查询模式
 */
export enum QueryMode {
  /** 本地搜索 - 实体定位 + 子图提取 */
  LOCAL = 'local',
  /** 全局搜索 - 社区筛选 + Map-Reduce */
  GLOBAL = 'global',
  /** 混合搜索 - 多路召回 + Rerank */
  HYBRID = 'hybrid'
}

/**
 * 查询请求
 */
export interface GraphQuery {
  /** 查询文本 */
  query: string;
  /** 查询模式 */
  mode: QueryMode;
  /** 查询嵌入 */
  queryEmbedding?: number[];
  /** 返回数量限制 */
  limit?: number;
  /** 相似度阈值 */
  similarityThreshold?: number;
  /** 社区层级 */
  communityLevel?: number;
}

/**
 * 查询结果
 */
export interface GraphQueryResult {
  /** 查询文本 */
  query: string;
  /** 查询模式 */
  mode: QueryMode;
  /** 相关实体 */
  entities: Entity[];
  /** 相关关系 */
  relations: Relation[];
  /** 相关社区 */
  communities: Community[];
  /** 答案 */
  answer: string;
  /** 证据 */
  evidence: Array<{
    type: 'entity' | 'relation' | 'community' | 'chunk';
    id: string;
    content: string;
    relevance: number;
  }>;
  /** 执行时间 */
  duration: number;
}

// ============================================================================
// 实体提取器
// ============================================================================

/**
 * 实体提取器配置
 */
export interface EntityExtractorConfig {
  /** 实体类型列表 */
  entityTypes?: EntityType[];
  /** 最小实体长度 */
  minLength?: number;
  /** 最大实体长度 */
  maxLength?: number;
  /** 自定义提取函数 */
  extractFn?: (text: string) => Promise<Array<{
    name: string;
    type: EntityType;
    description: string;
  }>>;
}

/**
 * 实体提取器
 */
export class EntityExtractor {
  private readonly config: Required<EntityExtractorConfig>;

  constructor(config: EntityExtractorConfig = {}) {
    this.config = {
      entityTypes: config.entityTypes || Object.values(EntityType),
      minLength: config.minLength || 2,
      maxLength: config.maxLength || 100,
      extractFn: config.extractFn || this.defaultExtract.bind(this)
    };
  }

  /**
   * 从文本中提取实体
   */
  async extract(text: string, sourceId: string): Promise<Entity[]> {
    const extracted = await this.config.extractFn(text);
    const now = Date.now();

    return extracted.map((e, index) => ({
      id: `entity_${sourceId}_${index}_${now}`,
      name: e.name,
      type: e.type,
      description: e.description,
      sourceIds: [sourceId],
      properties: {},
      createdAt: now,
      updatedAt: now,
      importance: 1.0
    }));
  }

  /**
   * 默认提取函数（基于规则）
   */
  private async defaultExtract(text: string): Promise<Array<{
    name: string;
    type: EntityType;
    description: string;
  }>> {
    const entities: Array<{
      name: string;
      type: EntityType;
      description: string;
    }> = [];

    // 简单的规则匹配
    // 匹配大写开头的词（可能是人名、组织名）
    const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    let match;
    while ((match = capitalizedPattern.exec(text)) !== null) {
      const name = match[0];
      if (name.length >= this.config.minLength && name.length <= this.config.maxLength) {
        entities.push({
          name,
          type: EntityType.OTHER,
          description: `Extracted entity: ${name}`
        });
      }
    }

    // 匹配引号中的内容
    const quotedPattern = /["「『]([^"」』]+)["」』]/g;
    while ((match = quotedPattern.exec(text)) !== null) {
      const name = match[1];
      if (name.length >= this.config.minLength && name.length <= this.config.maxLength) {
        entities.push({
          name,
          type: EntityType.CONCEPT,
          description: `Quoted concept: ${name}`
        });
      }
    }

    // 匹配代码标识符
    const codePattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    while ((match = codePattern.exec(text)) !== null) {
      const name = match[0];
      // 过滤常见关键词
      const keywords = ['the', 'and', 'for', 'this', 'that', 'with', 'from', 'have', 'has', 'are', 'was', 'were', 'been'];
      if (!keywords.includes(name.toLowerCase()) && 
          name.length >= this.config.minLength && 
          name.length <= this.config.maxLength) {
        entities.push({
          name,
          type: EntityType.CODE,
          description: `Code identifier: ${name}`
        });
      }
    }

    return entities;
  }
}

// ============================================================================
// 关系提取器
// ============================================================================

/**
 * 关系提取器配置
 */
export interface RelationExtractorConfig {
  /** 关系类型列表 */
  relationTypes?: RelationType[];
  /** 自定义提取函数 */
  extractFn?: (
    text: string,
    entities: Entity[]
  ) => Promise<Array<{
    sourceName: string;
    targetName: string;
    type: RelationType;
    description: string;
  }>>;
}

/**
 * 关系提取器
 */
export class RelationExtractor {
  private readonly config: Required<RelationExtractorConfig>;

  constructor(config: RelationExtractorConfig = {}) {
    this.config = {
      relationTypes: config.relationTypes || Object.values(RelationType),
      extractFn: config.extractFn || this.defaultExtract.bind(this)
    };
  }

  /**
   * 从文本中提取关系
   */
  async extract(
    text: string,
    entities: Entity[],
    sourceId: string
  ): Promise<Relation[]> {
    const extracted = await this.config.extractFn(text, entities);
    const now = Date.now();
    const entityMap = new Map(entities.map(e => [e.name, e]));

    return extracted
      .filter(r => entityMap.has(r.sourceName) && entityMap.has(r.targetName))
      .map((r, index) => ({
        id: `rel_${sourceId}_${index}_${now}`,
        sourceId: entityMap.get(r.sourceName)!.id,
        targetId: entityMap.get(r.targetName)!.id,
        type: r.type,
        description: r.description,
        sourceIds: [sourceId],
        properties: {},
        weight: 1.0,
        createdAt: now,
        updatedAt: now
      }));
  }

  /**
   * 默认提取函数（基于规则）
   */
  private async defaultExtract(
    text: string,
    entities: Entity[]
  ): Promise<Array<{
    sourceName: string;
    targetName: string;
    type: RelationType;
    description: string;
  }>> {
    const relations: Array<{
      sourceName: string;
      targetName: string;
      type: RelationType;
      description: string;
    }> = [];

    // 关系模式
    const relationPatterns = [
      { pattern: /(\w+)\s+uses?\s+(\w+)/i, type: RelationType.USES },
      { pattern: /(\w+)\s+depends?\s+on\s+(\w+)/i, type: RelationType.DEPENDS_ON },
      { pattern: /(\w+)\s+implements?\s+(\w+)/i, type: RelationType.IMPLEMENTS },
      { pattern: /(\w+)\s+creates?\s+(\w+)/i, type: RelationType.CREATES },
      { pattern: /(\w+)\s+contains?\s+(\w+)/i, type: RelationType.CONTAINS },
      { pattern: /(\w+)\s+belongs?\s+to\s+(\w+)/i, type: RelationType.BELONGS_TO },
      { pattern: /(\w+)\s+references?\s+(\w+)/i, type: RelationType.REFERENCES }
    ];

    for (const { pattern, type } of relationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const sourceName = match[1];
        const targetName = match[2];
        
        // 检查是否在实体列表中
        const sourceExists = entities.some(e => 
          e.name.toLowerCase() === sourceName.toLowerCase()
        );
        const targetExists = entities.some(e => 
          e.name.toLowerCase() === targetName.toLowerCase()
        );

        if (sourceExists && targetExists) {
          relations.push({
            sourceName,
            targetName,
            type,
            description: `${sourceName} ${type.replace('_', ' ')} ${targetName}`
          });
        }
      }
    }

    // 共现关系
    const entityNames = entities.map(e => e.name);
    for (let i = 0; i < entityNames.length; i++) {
      for (let j = i + 1; j < entityNames.length; j++) {
        const name1 = entityNames[i];
        const name2 = entityNames[j];
        
        // 检查是否在同一句子中
        const sentencePattern = new RegExp(`[^.!?]*${this.escapeRegex(name1)}[^.!?]*${this.escapeRegex(name2)}[^.!?]*`, 'i');
        if (sentencePattern.test(text)) {
          relations.push({
            sourceName: name1,
            targetName: name2,
            type: RelationType.RELATED_TO,
            description: `${name1} and ${name2} appear together`
          });
        }
      }
    }

    return relations;
  }

  /**
   * 转义正则特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================================================
// 社区检测器（Leiden 算法简化版）
// ============================================================================

/**
 * 社区检测器配置
 */
export interface CommunityDetectorConfig {
  /** 最大层级 */
  maxLevels?: number;
  /** 最小社区大小 */
  minCommunitySize?: number;
  /** 分辨率参数 */
  resolution?: number;
}

/**
 * 社区检测器
 */
export class CommunityDetector {
  private readonly config: Required<CommunityDetectorConfig>;

  constructor(config: CommunityDetectorConfig = {}) {
    this.config = {
      maxLevels: config.maxLevels || 3,
      minCommunitySize: config.minCommunitySize || 3,
      resolution: config.resolution || 1.0
    };
  }

  /**
   * 检测社区
   */
  async detect(
    entities: Entity[],
    relations: Relation[]
  ): Promise<Community[]> {
    const communities: Community[] = [];
    const now = Date.now();

    // 构建邻接表
    const adjacency = this.buildAdjacency(entities, relations);

    // 层次化社区检测
    let currentLevel = 0;
    let currentEntities = [...entities];
    let currentRelations = [...relations];

    while (currentLevel < this.config.maxLevels) {
      // 使用简化的标签传播算法
      const labels = await this.labelPropagation(currentEntities, currentRelations, adjacency);

      // 按标签分组
      const groups = this.groupByLabel(currentEntities, labels);

      // 创建社区
      for (const [label, groupEntities] of groups) {
        if (groupEntities.length >= this.config.minCommunitySize) {
          const community: Community = {
            id: `community_${currentLevel}_${label}_${now}`,
            name: `Community ${label} (Level ${currentLevel})`,
            level: currentLevel,
            entityIds: groupEntities.map(e => e.id),
            childCommunityIds: [],
            summary: `Community with ${groupEntities.length} entities`,
            keyEntities: this.selectKeyEntities(groupEntities, relations).map(e => e.id),
            createdAt: now,
            updatedAt: now
          };

          communities.push(community);
        }
      }

      // 准备下一层
      currentLevel++;
      
      // 如果社区数量太少，停止
      if (communities.filter(c => c.level === currentLevel - 1).length <= 1) {
        break;
      }

      // 将社区作为新的实体
      currentEntities = communities
        .filter(c => c.level === currentLevel - 1)
        .map(c => ({
          id: c.id,
          name: c.name,
          type: EntityType.OTHER,
          description: c.summary,
          sourceIds: [],
          properties: {},
          createdAt: now,
          updatedAt: now,
          importance: c.entityIds.length
        }));

      // 构建社区间关系
      currentRelations = this.buildCommunityRelations(
        communities.filter(c => c.level === currentLevel - 1),
        relations
      );
    }

    // 建立父子关系
    this.buildParentChildRelations(communities);

    return communities;
  }

  /**
   * 构建邻接表
   */
  private buildAdjacency(
    entities: Entity[],
    relations: Relation[]
  ): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();

    // 初始化
    for (const entity of entities) {
      adjacency.set(entity.id, new Set());
    }

    // 添加边
    for (const relation of relations) {
      adjacency.get(relation.sourceId)?.add(relation.targetId);
      adjacency.get(relation.targetId)?.add(relation.sourceId);
    }

    return adjacency;
  }

  /**
   * 标签传播算法
   */
  private async labelPropagation(
    entities: Entity[],
    relations: Relation[],
    adjacency: Map<string, Set<string>>
  ): Promise<Map<string, string>> {
    const labels = new Map<string, string>();

    // 初始化：每个节点的标签是自己
    for (const entity of entities) {
      labels.set(entity.id, entity.id);
    }

    // 迭代传播
    const maxIterations = 100;
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;

      for (const entity of entities) {
        const neighbors = adjacency.get(entity.id) || new Set();
        if (neighbors.size === 0) continue;

        // 统计邻居标签
        const labelCounts = new Map<string, number>();
        for (const neighborId of neighbors) {
          const label = labels.get(neighborId);
          if (label) {
            labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
          }
        }

        // 选择最常见的标签
        let maxCount = 0;
        let newLabel = labels.get(entity.id)!;
        for (const [label, count] of labelCounts) {
          if (count > maxCount || (count === maxCount && label < newLabel)) {
            maxCount = count;
            newLabel = label;
          }
        }

        if (labels.get(entity.id) !== newLabel) {
          labels.set(entity.id, newLabel);
          changed = true;
        }
      }

      if (!changed) break;
    }

    return labels;
  }

  /**
   * 按标签分组
   */
  private groupByLabel(
    entities: Entity[],
    labels: Map<string, string>
  ): Map<string, Entity[]> {
    const groups = new Map<string, Entity[]>();

    for (const entity of entities) {
      const label = labels.get(entity.id) || 'unknown';
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(entity);
    }

    return groups;
  }

  /**
   * 选择关键实体
   */
  private selectKeyEntities(
    entities: Entity[],
    relations: Relation[]
  ): Entity[] {
    // 计算度中心性
    const degrees = new Map<string, number>();
    for (const entity of entities) {
      degrees.set(entity.id, 0);
    }

    for (const relation of relations) {
      if (degrees.has(relation.sourceId)) {
        degrees.set(relation.sourceId, degrees.get(relation.sourceId)! + 1);
      }
      if (degrees.has(relation.targetId)) {
        degrees.set(relation.targetId, degrees.get(relation.targetId)! + 1);
      }
    }

    // 按度排序
    return entities
      .sort((a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0))
      .slice(0, 5);
  }

  /**
   * 构建社区间关系
   */
  private buildCommunityRelations(
    communities: Community[],
    originalRelations: Relation[]
  ): Relation[] {
    const now = Date.now();
    const relations: Relation[] = [];
    const entityToCommunity = new Map<string, string>();

    // 建立实体到社区的映射
    for (const community of communities) {
      for (const entityId of community.entityIds) {
        entityToCommunity.set(entityId, community.id);
      }
    }

    // 统计社区间连接
    const connectionCounts = new Map<string, number>();
    for (const relation of originalRelations) {
      const sourceCommunity = entityToCommunity.get(relation.sourceId);
      const targetCommunity = entityToCommunity.get(relation.targetId);

      if (sourceCommunity && targetCommunity && sourceCommunity !== targetCommunity) {
        const key = `${sourceCommunity}-${targetCommunity}`;
        connectionCounts.set(key, (connectionCounts.get(key) || 0) + 1);
      }
    }

    // 创建社区间关系
    for (const [key, count] of connectionCounts) {
      const [sourceId, targetId] = key.split('-');
      relations.push({
        id: `comm_rel_${now}_${relations.length}`,
        sourceId,
        targetId,
        type: RelationType.RELATED_TO,
        description: `Communities connected by ${count} relations`,
        sourceIds: [],
        properties: { connectionCount: count },
        weight: count,
        createdAt: now,
        updatedAt: now
      });
    }

    return relations;
  }

  /**
   * 建立父子关系
   */
  private buildParentChildRelations(communities: Community[]): void {
    for (let level = 1; level < this.config.maxLevels; level++) {
      const childCommunities = communities.filter(c => c.level === level - 1);
      const parentCommunities = communities.filter(c => c.level === level);

      for (const child of childCommunities) {
        // 找到包含最多子实体的父社区
        let bestParent: Community | undefined;
        let maxOverlap = 0;

        for (const parent of parentCommunities) {
          const overlap = child.entityIds.filter(id => 
            parent.entityIds.includes(id)
          ).length;

          if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestParent = parent;
          }
        }

        if (bestParent) {
          child.parentCommunityId = bestParent.id;
          bestParent.childCommunityIds.push(child.id);
        }
      }
    }
  }
}

// ============================================================================
// 知识图谱
// ============================================================================

/**
 * 知识图谱配置
 */
export interface KnowledgeGraphConfig {
  /** 实体提取器配置 */
  entityExtractor?: EntityExtractorConfig;
  /** 关系提取器配置 */
  relationExtractor?: RelationExtractorConfig;
  /** 社区检测器配置 */
  communityDetector?: CommunityDetectorConfig;
  /** 嵌入函数 */
  embeddingFn?: (text: string) => Promise<number[]>;
}

/**
 * 知识图谱
 */
export class KnowledgeGraph {
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation> = new Map();
  private communities: Map<string, Community> = new Map();
  private documents: Map<string, Document> = new Map();

  private entityExtractor: EntityExtractor;
  private relationExtractor: RelationExtractor;
  private communityDetector: CommunityDetector;
  private embeddingFn?: (text: string) => Promise<number[]>;

  constructor(config: KnowledgeGraphConfig = {}) {
    this.entityExtractor = new EntityExtractor(config.entityExtractor);
    this.relationExtractor = new RelationExtractor(config.relationExtractor);
    this.communityDetector = new CommunityDetector(config.communityDetector);
    this.embeddingFn = config.embeddingFn;
  }

  // ==========================================================================
  // 文档管理
  // ==========================================================================

  /**
   * 添加文档
   */
  async addDocument(
    content: string,
    title?: string,
    metadata?: Record<string, unknown>
  ): Promise<Document> {
    const now = Date.now();
    const document: Document = {
      id: `doc_${now}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      title,
      metadata: metadata || {},
      chunks: [],
      createdAt: now
    };

    // 分块
    document.chunks = this.chunkDocument(document);

    // 生成嵌入
    if (this.embeddingFn) {
      for (const chunk of document.chunks) {
        chunk.embedding = await this.embeddingFn(chunk.content);
      }
    }

    this.documents.set(document.id, document);

    // 提取实体和关系
    await this.extractFromDocument(document);

    return document;
  }

  /**
   * 分块文档
   */
  private chunkDocument(document: Document): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const chunkSize = 1000;
    const overlap = 200;

    let start = 0;
    let index = 0;

    while (start < document.content.length) {
      const end = Math.min(start + chunkSize, document.content.length);
      const content = document.content.slice(start, end);

      chunks.push({
        id: `chunk_${document.id}_${index}`,
        documentId: document.id,
        content,
        startIndex: start,
        endIndex: end
      });

      start += chunkSize - overlap;
      index++;
    }

    return chunks;
  }

  /**
   * 从文档提取实体和关系
   */
  private async extractFromDocument(document: Document): Promise<void> {
    for (const chunk of document.chunks) {
      // 提取实体
      const entities = await this.entityExtractor.extract(chunk.content, chunk.id);

      // 合并或添加实体
      for (const entity of entities) {
        const existing = Array.from(this.entities.values()).find(
          e => e.name === entity.name && e.type === entity.type
        );

        if (existing) {
          existing.sourceIds.push(chunk.id);
          existing.importance += 0.1;
          existing.updatedAt = Date.now();
        } else {
          this.entities.set(entity.id, entity);
        }
      }

      // 提取关系
      const chunkEntities = Array.from(this.entities.values()).filter(
        e => e.sourceIds.includes(chunk.id)
      );
      const relations = await this.relationExtractor.extract(
        chunk.content,
        chunkEntities,
        chunk.id
      );

      // 添加关系
      for (const relation of relations) {
        this.relations.set(relation.id, relation);
      }
    }
  }

  // ==========================================================================
  // 社区管理
  // ==========================================================================

  /**
   * 构建社区
   */
  async buildCommunities(): Promise<Community[]> {
    const entities = Array.from(this.entities.values());
    const relations = Array.from(this.relations.values());

    const communities = await this.communityDetector.detect(entities, relations);

    for (const community of communities) {
      this.communities.set(community.id, community);
    }

    return communities;
  }

  // ==========================================================================
  // 查询
  // ==========================================================================

  /**
   * 本地搜索
   */
  async localSearch(query: GraphQuery): Promise<GraphQueryResult> {
    const startTime = Date.now();
    const entities = Array.from(this.entities.values());
    const relations = Array.from(this.relations.values());

    // 1. 找到最相关的实体
    let relevantEntities: Entity[] = [];

    if (query.queryEmbedding && this.embeddingFn) {
      // 向量相似度搜索
      const entitiesWithEmbedding = entities.filter(e => e.embedding);
      relevantEntities = entitiesWithEmbedding
        .map(e => ({
          entity: e,
          similarity: this.cosineSimilarity(query.queryEmbedding!, e.embedding!)
        }))
        .filter(({ similarity }) => similarity >= (query.similarityThreshold || 0.5))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, query.limit || 10)
        .map(({ entity }) => entity);
    } else {
      // 关键词搜索
      const keywords = query.query.toLowerCase().split(/\s+/);
      relevantEntities = entities
        .filter(e => 
          keywords.some(k => 
            e.name.toLowerCase().includes(k) ||
            e.description.toLowerCase().includes(k)
          )
        )
        .slice(0, query.limit || 10);
    }

    // 2. 提取相关子图
    const entityIds = new Set(relevantEntities.map(e => e.id));
    const relevantRelations = relations.filter(
      r => entityIds.has(r.sourceId) || entityIds.has(r.targetId)
    );

    // 3. 生成答案
    const answer = this.generateLocalAnswer(relevantEntities, relevantRelations, query.query);

    return {
      query: query.query,
      mode: QueryMode.LOCAL,
      entities: relevantEntities,
      relations: relevantRelations,
      communities: [],
      answer,
      evidence: relevantEntities.map(e => ({
        type: 'entity' as const,
        id: e.id,
        content: `${e.name}: ${e.description}`,
        relevance: 1.0
      })),
      duration: Date.now() - startTime
    };
  }

  /**
   * 全局搜索
   */
  async globalSearch(query: GraphQuery): Promise<GraphQueryResult> {
    const startTime = Date.now();
    const communities = Array.from(this.communities.values());
    const level = query.communityLevel || 0;

    // 1. 筛选相关社区
    const levelCommunities = communities.filter(c => c.level === level);

    let relevantCommunities: Community[] = [];
    if (query.queryEmbedding) {
      // 基于关键实体相似度
      relevantCommunities = levelCommunities
        .map(c => ({
          community: c,
          relevance: this.calculateCommunityRelevance(c, query.queryEmbedding!)
        }))
        .filter(({ relevance }) => relevance >= (query.similarityThreshold || 0.3))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, query.limit || 5)
        .map(({ community }) => community);
    } else {
      // 关键词匹配
      const keywords = query.query.toLowerCase().split(/\s+/);
      relevantCommunities = levelCommunities
        .filter(c => 
          keywords.some(k => 
            c.name.toLowerCase().includes(k) ||
            c.summary.toLowerCase().includes(k)
          )
        )
        .slice(0, query.limit || 5);
    }

    // 2. 收集社区中的实体
    const entityIds = new Set(
      relevantCommunities.flatMap(c => c.entityIds)
    );
    const relevantEntities = Array.from(this.entities.values())
      .filter(e => entityIds.has(e.id));

    // 3. 生成答案
    const answer = this.generateGlobalAnswer(relevantCommunities, query.query);

    return {
      query: query.query,
      mode: QueryMode.GLOBAL,
      entities: relevantEntities,
      relations: [],
      communities: relevantCommunities,
      answer,
      evidence: relevantCommunities.map(c => ({
        type: 'community' as const,
        id: c.id,
        content: c.summary,
        relevance: 1.0
      })),
      duration: Date.now() - startTime
    };
  }

  /**
   * 混合搜索
   */
  async hybridSearch(query: GraphQuery): Promise<GraphQueryResult> {
    const startTime = Date.now();

    // 并行执行本地和全局搜索
    const [localResult, globalResult] = await Promise.all([
      this.localSearch({ ...query, limit: (query.limit || 10) / 2 }),
      this.globalSearch({ ...query, limit: 2 })
    ]);

    // 合并结果
    const entities = [...localResult.entities];
    const entityIds = new Set(entities.map(e => e.id));

    for (const e of globalResult.entities) {
      if (!entityIds.has(e.id)) {
        entities.push(e);
        entityIds.add(e.id);
      }
    }

    const relations = localResult.relations;
    const communities = globalResult.communities;

    // 生成综合答案
    const answer = this.generateHybridAnswer(
      localResult,
      globalResult,
      query.query
    );

    return {
      query: query.query,
      mode: QueryMode.HYBRID,
      entities,
      relations,
      communities,
      answer,
      evidence: [
        ...localResult.evidence,
        ...globalResult.evidence
      ],
      duration: Date.now() - startTime
    };
  }

  /**
   * 查询入口
   */
  async query(query: GraphQuery): Promise<GraphQueryResult> {
    // 生成查询嵌入
    if (!query.queryEmbedding && this.embeddingFn) {
      query.queryEmbedding = await this.embeddingFn(query.query);
    }

    switch (query.mode) {
      case QueryMode.LOCAL:
        return this.localSearch(query);
      case QueryMode.GLOBAL:
        return this.globalSearch(query);
      case QueryMode.HYBRID:
      default:
        return this.hybridSearch(query);
    }
  }

  // ==========================================================================
  // 统计
  // ==========================================================================

  /**
   * 获取统计信息
   */
  getStats(): {
    entityCount: number;
    relationCount: number;
    communityCount: number;
    documentCount: number;
    entityTypeDistribution: Record<EntityType, number>;
    relationTypeDistribution: Record<RelationType, number>;
  } {
    const entities = Array.from(this.entities.values());
    const relations = Array.from(this.relations.values());

    const entityTypeDistribution: Record<EntityType, number> = {
      [EntityType.PERSON]: 0,
      [EntityType.ORGANIZATION]: 0,
      [EntityType.LOCATION]: 0,
      [EntityType.EVENT]: 0,
      [EntityType.CONCEPT]: 0,
      [EntityType.PRODUCT]: 0,
      [EntityType.TECHNOLOGY]: 0,
      [EntityType.DOCUMENT]: 0,
      [EntityType.CODE]: 0,
      [EntityType.OTHER]: 0
    };

    for (const entity of entities) {
      entityTypeDistribution[entity.type]++;
    }

    const relationTypeDistribution: Record<RelationType, number> = {
      [RelationType.BELONGS_TO]: 0,
      [RelationType.CONTAINS]: 0,
      [RelationType.RELATED_TO]: 0,
      [RelationType.DEPENDS_ON]: 0,
      [RelationType.IMPLEMENTS]: 0,
      [RelationType.USES]: 0,
      [RelationType.CREATES]: 0,
      [RelationType.MODIFIES]: 0,
      [RelationType.REFERENCES]: 0,
      [RelationType.OTHER]: 0
    };

    for (const relation of relations) {
      relationTypeDistribution[relation.type]++;
    }

    return {
      entityCount: entities.length,
      relationCount: relations.length,
      communityCount: this.communities.size,
      documentCount: this.documents.size,
      entityTypeDistribution,
      relationTypeDistribution
    };
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 计算余弦相似度
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

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 计算社区相关性
   */
  private calculateCommunityRelevance(
    community: Community,
    queryEmbedding: number[]
  ): number {
    const entities = Array.from(this.entities.values())
      .filter(e => community.entityIds.includes(e.id) && e.embedding);

    if (entities.length === 0) return 0;

    const similarities = entities.map(e => 
      this.cosineSimilarity(queryEmbedding, e.embedding!)
    );

    return Math.max(...similarities);
  }

  /**
   * 生成本地搜索答案
   */
  private generateLocalAnswer(
    entities: Entity[],
    relations: Relation[],
    query: string
  ): string {
    if (entities.length === 0) {
      return `No relevant entities found for query: "${query}"`;
    }

    const entityDescriptions = entities
      .slice(0, 5)
      .map(e => `- ${e.name} (${e.type}): ${e.description}`)
      .join('\n');

    const relationDescriptions = relations
      .slice(0, 5)
      .map(r => {
        const source = this.entities.get(r.sourceId)?.name || 'Unknown';
        const target = this.entities.get(r.targetId)?.name || 'Unknown';
        return `- ${source} ${r.type.replace('_', ' ')} ${target}`;
      })
      .join('\n');

    return `Found ${entities.length} relevant entities and ${relations.length} relations:\n\nEntities:\n${entityDescriptions}\n\nRelations:\n${relationDescriptions}`;
  }

  /**
   * 生成全局搜索答案
   */
  private generateGlobalAnswer(
    communities: Community[],
    query: string
  ): string {
    if (communities.length === 0) {
      return `No relevant communities found for query: "${query}"`;
    }

    const communityDescriptions = communities
      .map(c => `- ${c.name}: ${c.summary} (${c.entityIds.length} entities)`)
      .join('\n');

    return `Found ${communities.length} relevant communities:\n\n${communityDescriptions}`;
  }

  /**
   * 生成混合搜索答案
   */
  private generateHybridAnswer(
    localResult: GraphQueryResult,
    globalResult: GraphQueryResult,
    query: string
  ): string {
    return `Hybrid search results for "${query}":\n\n` +
      `Local entities: ${localResult.entities.length}\n` +
      `Global communities: ${globalResult.communities.length}\n\n` +
      `${localResult.answer}\n\n${globalResult.answer}`;
  }
}

// ============================================================================
// 导出
// ============================================================================

export default KnowledgeGraph;
