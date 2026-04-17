/**
 * 五层记忆架构
 * 
 * 借鉴：Hermes Agent
 * 
 * 架构：
 * Layer 1: 短期推理记忆（Session Memory）- 当前会话对话历史
 * Layer 2: 程序性技能文档（Skill Memory）- 可复用任务执行方案
 * Layer 3: 上下文持久化（Vector Memory）- 技能文档向量索引
 * Layer 4: 用户建模（User Memory）- 用户偏好、工作风格
 * Layer 5: 对话日志（Log Memory）- 完整会话历史
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 记忆层级
 */
export enum MemoryLayer {
  /** L0: 短期推理记忆 */
  SESSION = 'L0',
  /** L1: 程序性技能文档 */
  SKILL = 'L1',
  /** L2: 上下文持久化 */
  VECTOR = 'L2',
  /** L3: 用户建模 */
  USER = 'L3',
  /** L4: 对话日志 */
  LOG = 'L4'
}

/**
 * 记忆条目基础接口
 */
export interface MemoryEntry {
  /** 条目 ID */
  id: string;
  /** 层级 */
  layer: MemoryLayer;
  /** 内容 */
  content: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 过期时间 */
  expiresAt?: number;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
}

/**
 * 会话记忆条目
 */
export interface SessionMemoryEntry extends MemoryEntry {
  layer: MemoryLayer.SESSION;
  /** 角色 */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** 对话轮次 */
  turn: number;
  /** 关联的工具调用 */
  toolCalls?: Array<{
    toolName: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  }>;
}

/**
 * 技能记忆条目
 */
export interface SkillMemoryEntry extends MemoryEntry {
  layer: MemoryLayer.SKILL;
  /** 技能名称 */
  skillName: string;
  /** 技能描述 */
  description: string;
  /** 触发条件 */
  triggers: string[];
  /** 执行步骤 */
  steps: Array<{
    order: number;
    action: string;
    tool?: string;
    parameters?: Record<string, unknown>;
  }>;
  /** 成功率 */
  successRate: number;
  /** 使用次数 */
  usageCount: number;
}

/**
 * 向量记忆条目
 */
export interface VectorMemoryEntry extends MemoryEntry {
  layer: MemoryLayer.VECTOR;
  /** 向量嵌入 */
  embedding?: number[];
  /** 来源文档 ID */
  sourceId: string;
  /** 相似度分数 */
  similarity?: number;
}

/**
 * 用户记忆条目
 */
export interface UserMemoryEntry extends MemoryEntry {
  layer: MemoryLayer.USER;
  /** 用户 ID */
  userId: string;
  /** 偏好类型 */
  preferenceType: 'communication' | 'technical' | 'workflow' | 'personal';
  /** 偏好键 */
  key: string;
  /** 偏好值 */
  value: unknown;
  /** 置信度 */
  confidence: number;
}

/**
 * 日志记忆条目
 */
export interface LogMemoryEntry extends MemoryEntry {
  layer: MemoryLayer.LOG;
  /** Session ID */
  sessionId: string;
  /** 事件类型 */
  eventType: 'message' | 'tool_call' | 'error' | 'decision' | 'checkpoint';
  /** 事件数据 */
  eventData: unknown;
}

/**
 * 记忆查询条件
 */
export interface MemoryQuery {
  /** 层级过滤 */
  layers?: MemoryLayer[];
  /** 关键词搜索 */
  keyword?: string;
  /** 向量相似度搜索 */
  vector?: number[];
  /** 相似度阈值 */
  similarityThreshold?: number;
  /** 时间范围 */
  timeRange?: {
    start: number;
    end: number;
  };
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 排序方式 */
  orderBy?: 'createdAt' | 'updatedAt' | 'accessCount' | 'relevance';
  /** 排序方向 */
  orderDirection?: 'asc' | 'desc';
}

/**
 * 记忆操作结果
 */
export interface MemoryOperationResult {
  /** 是否成功 */
  success: boolean;
  /** 操作的条目 */
  entry?: MemoryEntry;
  /** 错误信息 */
  error?: string;
}

// ============================================================================
// 记忆存储接口
// ============================================================================

/**
 * 记忆存储接口
 */
export interface MemoryStorage {
  /** 添加记忆 */
  add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>): Promise<MemoryEntry>;
  /** 获取记忆 */
  get(id: string): Promise<MemoryEntry | undefined>;
  /** 更新记忆 */
  update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | undefined>;
  /** 删除记忆 */
  delete(id: string): Promise<boolean>;
  /** 查询记忆 */
  query(query: MemoryQuery): Promise<MemoryEntry[]>;
  /** 清空记忆 */
  clear(): Promise<void>;
  /** 获取统计信息 */
  stats(): Promise<{
    total: number;
    byLayer: Record<MemoryLayer, number>;
    oldestEntry?: number;
    newestEntry?: number;
  }>;
}

// ============================================================================
// L0: 会话记忆存储
// ============================================================================

/**
 * 会话记忆存储
 * 
 * 特点：
 * - 存储在内存中
 * - 会话结束后清空
 * - 支持快速访问
 */
export class SessionMemoryStorage implements MemoryStorage {
  private entries: Map<string, SessionMemoryEntry> = new Map();
  private turnCounter: number = 0;

  async add(entry: Omit<SessionMemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>): Promise<SessionMemoryEntry> {
    const now = Date.now();
    const fullEntry: SessionMemoryEntry = {
      ...entry,
      id: `sess_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now,
      turn: entry.turn ?? ++this.turnCounter
    };

    this.entries.set(fullEntry.id, fullEntry);
    return fullEntry;
  }

  async get(id: string): Promise<SessionMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
    }
    return entry;
  }

  async update(id: string, updates: Partial<SessionMemoryEntry>): Promise<SessionMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      Object.assign(entry, updates, { updatedAt: Date.now() });
      return entry;
    }
    return undefined;
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async query(query: MemoryQuery): Promise<SessionMemoryEntry[]> {
    let results = Array.from(this.entries.values());

    // 按关键词过滤
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(e => 
        e.content.toLowerCase().includes(keyword)
      );
    }

    // 按时间范围过滤
    if (query.timeRange) {
      results = results.filter(e => 
        e.createdAt >= query.timeRange!.start && 
        e.createdAt <= query.timeRange!.end
      );
    }

    // 排序
    if (query.orderBy) {
      results.sort((a, b) => {
        const aVal = a[query.orderBy as keyof MemoryEntry] as number;
        const bVal = b[query.orderBy as keyof MemoryEntry] as number;
        return query.orderDirection === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.turnCounter = 0;
  }

  async stats(): Promise<{
    total: number;
    byLayer: Record<MemoryLayer, number>;
    oldestEntry?: number;
    newestEntry?: number;
  }> {
    const entries = Array.from(this.entries.values());
    return {
      total: entries.length,
      byLayer: {
        [MemoryLayer.SESSION]: entries.length,
        [MemoryLayer.SKILL]: 0,
        [MemoryLayer.VECTOR]: 0,
        [MemoryLayer.USER]: 0,
        [MemoryLayer.LOG]: 0
      },
      oldestEntry: entries[0]?.createdAt,
      newestEntry: entries[entries.length - 1]?.createdAt
    };
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(limit?: number): SessionMemoryEntry[] {
    const entries = Array.from(this.entries.values())
      .filter(e => e.role === 'user' || e.role === 'assistant')
      .sort((a, b) => a.turn - b.turn);
    
    return limit ? entries.slice(-limit) : entries;
  }

  /**
   * 获取最后 N 轮对话
   */
  getLastNTurns(n: number): SessionMemoryEntry[] {
    return this.getConversationHistory(n * 2);
  }
}

// ============================================================================
// L1: 技能记忆存储
// ============================================================================

/**
 * 技能记忆存储
 * 
 * 特点：
 * - 永久存储
 * - Markdown 格式
 * - 支持触发条件匹配
 */
export class SkillMemoryStorage implements MemoryStorage {
  private entries: Map<string, SkillMemoryEntry> = new Map();
  private triggerIndex: Map<string, Set<string>> = new Map();

  async add(entry: Omit<SkillMemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>): Promise<SkillMemoryEntry> {
    const now = Date.now();
    const triggers = entry.triggers || [];
    const fullEntry: SkillMemoryEntry = {
      ...entry,
      triggers,
      id: `skill_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now
    };

    this.entries.set(fullEntry.id, fullEntry);

    // 建立触发条件索引
    for (const trigger of triggers) {
      if (!this.triggerIndex.has(trigger)) {
        this.triggerIndex.set(trigger, new Set());
      }
      this.triggerIndex.get(trigger)!.add(fullEntry.id);
    }

    return fullEntry;
  }

  async get(id: string): Promise<SkillMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
    }
    return entry;
  }

  async update(id: string, updates: Partial<SkillMemoryEntry>): Promise<SkillMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      // 更新触发条件索引
      if (updates.triggers) {
        // 移除旧索引
        for (const trigger of entry.triggers) {
          this.triggerIndex.get(trigger)?.delete(id);
        }
        // 添加新索引
        for (const trigger of updates.triggers) {
          if (!this.triggerIndex.has(trigger)) {
            this.triggerIndex.set(trigger, new Set());
          }
          this.triggerIndex.get(trigger)!.add(id);
        }
      }

      Object.assign(entry, updates, { updatedAt: Date.now() });
      return entry;
    }
    return undefined;
  }

  async delete(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (entry) {
      // 移除触发条件索引
      for (const trigger of entry.triggers) {
        this.triggerIndex.get(trigger)?.delete(id);
      }
      return this.entries.delete(id);
    }
    return false;
  }

  async query(query: MemoryQuery): Promise<SkillMemoryEntry[]> {
    let results = Array.from(this.entries.values());

    // 按关键词过滤
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(e => 
        e.content.toLowerCase().includes(keyword) ||
        e.skillName.toLowerCase().includes(keyword) ||
        e.description.toLowerCase().includes(keyword)
      );
    }

    // 排序
    if (query.orderBy) {
      results.sort((a, b) => {
        const aVal = a[query.orderBy as keyof MemoryEntry] as number;
        const bVal = b[query.orderBy as keyof MemoryEntry] as number;
        return query.orderDirection === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.triggerIndex.clear();
  }

  async stats(): Promise<{
    total: number;
    byLayer: Record<MemoryLayer, number>;
    oldestEntry?: number;
    newestEntry?: number;
  }> {
    const entries = Array.from(this.entries.values());
    return {
      total: entries.length,
      byLayer: {
        [MemoryLayer.SESSION]: 0,
        [MemoryLayer.SKILL]: entries.length,
        [MemoryLayer.VECTOR]: 0,
        [MemoryLayer.USER]: 0,
        [MemoryLayer.LOG]: 0
      },
      oldestEntry: entries[0]?.createdAt,
      newestEntry: entries[entries.length - 1]?.createdAt
    };
  }

  /**
   * 根据触发条件查找技能
   */
  findByTrigger(trigger: string): SkillMemoryEntry[] {
    const ids = this.triggerIndex.get(trigger);
    if (!ids) return [];

    return Array.from(ids)
      .map(id => this.entries.get(id))
      .filter((e): e is SkillMemoryEntry => e !== undefined);
  }

  /**
   * 获取最常用的技能
   */
  getTopSkills(limit: number = 10): SkillMemoryEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * 获取成功率最高的技能
   */
  getMostSuccessfulSkills(limit: number = 10): SkillMemoryEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }
}

// ============================================================================
// L2: 向量记忆存储
// ============================================================================

/**
 * 向量记忆存储
 * 
 * 特点：
 * - 支持向量相似度搜索
 * - 永久存储
 * - 支持增量更新
 */
export class VectorMemoryStorage implements MemoryStorage {
  private entries: Map<string, VectorMemoryEntry> = new Map();
  private embeddingFn?: (text: string) => Promise<number[]>;

  setEmbeddingFunction(fn: (text: string) => Promise<number[]>): void {
    this.embeddingFn = fn;
  }

  async add(entry: Omit<VectorMemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>): Promise<VectorMemoryEntry> {
    const now = Date.now();
    
    // 如果没有提供嵌入，使用嵌入函数生成
    let embedding = entry.embedding;
    if (!embedding && this.embeddingFn) {
      embedding = await this.embeddingFn(entry.content);
    }

    const fullEntry: VectorMemoryEntry = {
      ...entry,
      embedding,
      id: `vec_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now
    };

    this.entries.set(fullEntry.id, fullEntry);
    return fullEntry;
  }

  async get(id: string): Promise<VectorMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
    }
    return entry;
  }

  async update(id: string, updates: Partial<VectorMemoryEntry>): Promise<VectorMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      // 如果内容更新，重新生成嵌入
      if (updates.content && this.embeddingFn && !updates.embedding) {
        updates.embedding = await this.embeddingFn(updates.content);
      }

      Object.assign(entry, updates, { updatedAt: Date.now() });
      return entry;
    }
    return undefined;
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async query(query: MemoryQuery): Promise<VectorMemoryEntry[]> {
    let results = Array.from(this.entries.values());

    // 向量相似度搜索
    if (query.vector) {
      const threshold = query.similarityThreshold || 0.7;
      results = results
        .filter(e => e.embedding)
        .map(e => ({
          entry: e,
          similarity: this.cosineSimilarity(query.vector!, e.embedding!)
        }))
        .filter(({ similarity }) => similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .map(({ entry, similarity }) => {
          entry.similarity = similarity;
          return entry;
        });
    }

    // 按关键词过滤
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(e => 
        e.content.toLowerCase().includes(keyword)
      );
    }

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  async stats(): Promise<{
    total: number;
    byLayer: Record<MemoryLayer, number>;
    oldestEntry?: number;
    newestEntry?: number;
  }> {
    const entries = Array.from(this.entries.values());
    return {
      total: entries.length,
      byLayer: {
        [MemoryLayer.SESSION]: 0,
        [MemoryLayer.SKILL]: 0,
        [MemoryLayer.VECTOR]: entries.length,
        [MemoryLayer.USER]: 0,
        [MemoryLayer.LOG]: 0
      },
      oldestEntry: entries[0]?.createdAt,
      newestEntry: entries[entries.length - 1]?.createdAt
    };
  }

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
}

// ============================================================================
// L3: 用户记忆存储
// ============================================================================

/**
 * 用户记忆存储
 * 
 * 特点：
 * - 按用户 ID 组织
 * - 支持偏好类型分类
 * - 支持置信度排序
 */
export class UserMemoryStorage implements MemoryStorage {
  private entries: Map<string, UserMemoryEntry> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();

  async add(entry: Omit<UserMemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>): Promise<UserMemoryEntry> {
    const now = Date.now();
    const fullEntry: UserMemoryEntry = {
      ...entry,
      id: `user_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now
    };

    this.entries.set(fullEntry.id, fullEntry);

    // 建立用户索引
    if (!this.userIndex.has(entry.userId)) {
      this.userIndex.set(entry.userId, new Set());
    }
    this.userIndex.get(entry.userId)!.add(fullEntry.id);

    return fullEntry;
  }

  async get(id: string): Promise<UserMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
    }
    return entry;
  }

  async update(id: string, updates: Partial<UserMemoryEntry>): Promise<UserMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      Object.assign(entry, updates, { updatedAt: Date.now() });
      return entry;
    }
    return undefined;
  }

  async delete(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (entry) {
      this.userIndex.get(entry.userId)?.delete(id);
      return this.entries.delete(id);
    }
    return false;
  }

  async query(query: MemoryQuery): Promise<UserMemoryEntry[]> {
    let results = Array.from(this.entries.values());

    // 按关键词过滤
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(e => 
        e.content.toLowerCase().includes(keyword) ||
        e.key.toLowerCase().includes(keyword)
      );
    }

    // 排序
    if (query.orderBy) {
      results.sort((a, b) => {
        const aVal = a[query.orderBy as keyof MemoryEntry] as number;
        const bVal = b[query.orderBy as keyof MemoryEntry] as number;
        return query.orderDirection === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.userIndex.clear();
  }

  async stats(): Promise<{
    total: number;
    byLayer: Record<MemoryLayer, number>;
    oldestEntry?: number;
    newestEntry?: number;
  }> {
    const entries = Array.from(this.entries.values());
    return {
      total: entries.length,
      byLayer: {
        [MemoryLayer.SESSION]: 0,
        [MemoryLayer.SKILL]: 0,
        [MemoryLayer.VECTOR]: 0,
        [MemoryLayer.USER]: entries.length,
        [MemoryLayer.LOG]: 0
      },
      oldestEntry: entries[0]?.createdAt,
      newestEntry: entries[entries.length - 1]?.createdAt
    };
  }

  /**
   * 获取用户的所有偏好
   */
  getUserPreferences(userId: string, preferenceType?: UserMemoryEntry['preferenceType']): UserMemoryEntry[] {
    const ids = this.userIndex.get(userId);
    if (!ids) return [];

    let entries = Array.from(ids)
      .map(id => this.entries.get(id))
      .filter((e): e is UserMemoryEntry => e !== undefined);

    if (preferenceType) {
      entries = entries.filter(e => e.preferenceType === preferenceType);
    }

    return entries.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取用户偏好值
   */
  getUserPreference(userId: string, key: string): unknown | undefined {
    const ids = this.userIndex.get(userId);
    if (!ids) return undefined;

    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry && entry.key === key) {
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        return entry.value;
      }
    }

    return undefined;
  }

  /**
   * 设置用户偏好
   */
  async setUserPreference(
    userId: string,
    preferenceType: UserMemoryEntry['preferenceType'],
    key: string,
    value: unknown,
    confidence: number = 1.0
  ): Promise<UserMemoryEntry> {
    // 检查是否已存在
    const ids = this.userIndex.get(userId);
    if (ids) {
      for (const id of ids) {
        const entry = this.entries.get(id);
        if (entry && entry.key === key) {
          // 更新现有条目
          entry.value = value;
          entry.confidence = Math.max(entry.confidence, confidence);
          entry.updatedAt = Date.now();
          return entry;
        }
      }
    }

    // 创建新条目
    return this.add({
      layer: MemoryLayer.USER,
      content: `${key}: ${JSON.stringify(value)}`,
      userId,
      preferenceType,
      key,
      value,
      confidence
    });
  }
}

// ============================================================================
// L4: 日志记忆存储
// ============================================================================

/**
 * 日志记忆存储
 * 
 * 特点：
 * - 完整会话历史
 * - 支持全文检索
 * - 支持事件类型过滤
 */
export class LogMemoryStorage implements MemoryStorage {
  private entries: Map<string, LogMemoryEntry> = new Map();
  private sessionIndex: Map<string, Set<string>> = new Map();

  async add(entry: Omit<LogMemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>): Promise<LogMemoryEntry> {
    const now = Date.now();
    const fullEntry: LogMemoryEntry = {
      ...entry,
      id: `log_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now
    };

    this.entries.set(fullEntry.id, fullEntry);

    // 建立 Session 索引
    if (!this.sessionIndex.has(entry.sessionId)) {
      this.sessionIndex.set(entry.sessionId, new Set());
    }
    this.sessionIndex.get(entry.sessionId)!.add(fullEntry.id);

    return fullEntry;
  }

  async get(id: string): Promise<LogMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
    }
    return entry;
  }

  async update(id: string, updates: Partial<LogMemoryEntry>): Promise<LogMemoryEntry | undefined> {
    const entry = this.entries.get(id);
    if (entry) {
      Object.assign(entry, updates, { updatedAt: Date.now() });
      return entry;
    }
    return undefined;
  }

  async delete(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (entry) {
      this.sessionIndex.get(entry.sessionId)?.delete(id);
      return this.entries.delete(id);
    }
    return false;
  }

  async query(query: MemoryQuery): Promise<LogMemoryEntry[]> {
    let results = Array.from(this.entries.values());

    // 按关键词过滤
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(e => 
        e.content.toLowerCase().includes(keyword)
      );
    }

    // 按时间范围过滤
    if (query.timeRange) {
      results = results.filter(e => 
        e.createdAt >= query.timeRange!.start && 
        e.createdAt <= query.timeRange!.end
      );
    }

    // 排序
    if (query.orderBy) {
      results.sort((a, b) => {
        const aVal = a[query.orderBy as keyof MemoryEntry] as number;
        const bVal = b[query.orderBy as keyof MemoryEntry] as number;
        return query.orderDirection === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.sessionIndex.clear();
  }

  async stats(): Promise<{
    total: number;
    byLayer: Record<MemoryLayer, number>;
    oldestEntry?: number;
    newestEntry?: number;
  }> {
    const entries = Array.from(this.entries.values());
    return {
      total: entries.length,
      byLayer: {
        [MemoryLayer.SESSION]: 0,
        [MemoryLayer.SKILL]: 0,
        [MemoryLayer.VECTOR]: 0,
        [MemoryLayer.USER]: 0,
        [MemoryLayer.LOG]: entries.length
      },
      oldestEntry: entries[0]?.createdAt,
      newestEntry: entries[entries.length - 1]?.createdAt
    };
  }

  /**
   * 获取 Session 的所有日志
   */
  getSessionLogs(sessionId: string, eventType?: LogMemoryEntry['eventType']): LogMemoryEntry[] {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids) return [];

    let entries = Array.from(ids)
      .map(id => this.entries.get(id))
      .filter((e): e is LogMemoryEntry => e !== undefined);

    if (eventType) {
      entries = entries.filter(e => e.eventType === eventType);
    }

    return entries.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * 获取 Session 的错误日志
   */
  getSessionErrors(sessionId: string): LogMemoryEntry[] {
    return this.getSessionLogs(sessionId, 'error');
  }
}

// ============================================================================
// 五层记忆管理器
// ============================================================================

/**
 * 五层记忆管理器配置
 */
export interface FiveLayerMemoryConfig {
  /** 是否启用各层 */
  enabledLayers?: MemoryLayer[];
  /** 向量嵌入函数 */
  embeddingFn?: (text: string) => Promise<number[]>;
}

/**
 * 五层记忆管理器
 * 
 * 统一管理五层记忆的读写操作
 */
export class FiveLayerMemoryManager {
  private readonly storages: Map<MemoryLayer, MemoryStorage>;
  private readonly config: FiveLayerMemoryConfig;

  constructor(config: FiveLayerMemoryConfig = {}) {
    this.config = config;
    this.storages = new Map();
    
    this.storages.set(MemoryLayer.SESSION, new SessionMemoryStorage());
    this.storages.set(MemoryLayer.SKILL, new SkillMemoryStorage());
    this.storages.set(MemoryLayer.VECTOR, new VectorMemoryStorage());
    this.storages.set(MemoryLayer.USER, new UserMemoryStorage());
    this.storages.set(MemoryLayer.LOG, new LogMemoryStorage());

    // 设置向量嵌入函数
    if (config.embeddingFn) {
      (this.storages.get(MemoryLayer.VECTOR) as VectorMemoryStorage)
        .setEmbeddingFunction(config.embeddingFn);
    }
  }

  /**
   * 获取指定层的存储
   */
  getStorage(layer: MemoryLayer): MemoryStorage {
    return this.storages.get(layer)!;
  }

  /**
   * 添加记忆到指定层
   */
  async add(layer: MemoryLayer, entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt' | 'layer'>): Promise<MemoryEntry> {
    const storage = this.storages.get(layer)!;
    return storage.add({ ...entry, layer } as any);
  }

  /**
   * 从指定层获取记忆
   */
  async get(layer: MemoryLayer, id: string): Promise<MemoryEntry | undefined> {
    return this.storages.get(layer)!.get(id);
  }

  /**
   * 更新指定层的记忆
   */
  async update(layer: MemoryLayer, id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | undefined> {
    return this.storages.get(layer)!.update(id, updates);
  }

  /**
   * 删除指定层的记忆
   */
  async delete(layer: MemoryLayer, id: string): Promise<boolean> {
    return this.storages.get(layer)!.delete(id);
  }

  /**
   * 跨层查询
   */
  async queryAll(query: MemoryQuery): Promise<Map<MemoryLayer, MemoryEntry[]>> {
    const results = new Map<MemoryLayer, MemoryEntry[]>();
    const layers = query.layers || Array.from(this.storages.keys());

    for (const layer of layers) {
      const storage = this.storages.get(layer)!;
      const entries = await storage.query(query);
      results.set(layer, entries);
    }

    return results;
  }

  /**
   * 获取所有层的统计信息
   */
  async getAllStats(): Promise<Map<MemoryLayer, {
    total: number;
    byLayer: Record<MemoryLayer, number>;
    oldestEntry?: number;
    newestEntry?: number;
  }>> {
    const stats = new Map<MemoryLayer, any>();

    for (const [layer, storage] of this.storages) {
      stats.set(layer, await storage.stats());
    }

    return stats;
  }

  /**
   * 搜索记忆（简化版）
   */
  async search(query: string, limit: number = 10): Promise<any[]> {
    const results: any[] = [];
    
    // 从所有层搜索
    for (const [layer, storage] of this.storages) {
      try {
        const entries = await storage.query({ limit });
        // 简单文本匹配
        const filtered = entries.filter((e: any) => 
          e.content && e.content.toLowerCase().includes(query.toLowerCase())
        );
        results.push(...filtered.map((e: any) => ({ ...e, layer, score: 0.5 })));
      } catch (e) {
        // 忽略错误
      }
    }
    
    return results.slice(0, limit);
  }

  /**
   * 获取统计信息（简化版）
   */
  getStats(): Record<string, { count: number }> {
    const stats: Record<string, { count: number }> = {};
    const layerNames = ['l0', 'l1', 'l2', 'l3', 'l4'];
    
    for (let i = 0; i < layerNames.length; i++) {
      stats[layerNames[i]] = { count: 0 };
    }
    
    return stats;
  }

  /**
   * 清空所有记忆
   */
  async clearAll(): Promise<void> {
    for (const storage of this.storages.values()) {
      await storage.clear();
    }
  }

  /**
   * 记忆晋升：从 L0 晋升到 L1
   */
  async promoteToSkill(sessionEntry: SessionMemoryEntry): Promise<SkillMemoryEntry> {
    const skillStorage = this.storages.get(MemoryLayer.SKILL) as SkillMemoryStorage;
    
    return skillStorage.add({
      layer: MemoryLayer.SKILL,
      content: sessionEntry.content,
      skillName: `skill_from_session_${sessionEntry.id}`,
      description: 'Auto-promoted from session memory',
      triggers: [],
      steps: [],
      successRate: 1.0,
      usageCount: 1
    });
  }

  /**
   * 记忆晋升：从 L1 晋升到 L2
   */
  async promoteToVector(skillEntry: SkillMemoryEntry): Promise<VectorMemoryEntry> {
    const vectorStorage = this.storages.get(MemoryLayer.VECTOR) as VectorMemoryStorage;
    
    return vectorStorage.add({
      layer: MemoryLayer.VECTOR,
      content: skillEntry.content,
      sourceId: skillEntry.id
    });
  }
}

// ============================================================================
// 导出
// ============================================================================

export default FiveLayerMemoryManager;
