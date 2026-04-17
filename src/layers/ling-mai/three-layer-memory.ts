/**
 * 三层记忆系统
 * 
 * 借鉴来源：Hermes Agent + Letta (MemGPT)
 * 
 * 核心功能：
 * - L0 会话记忆：当前对话上下文
 * - L1 工作记忆：最近使用的记忆，常驻加载
 * - L2 长期记忆：持久化记忆，全局深度搜索
 */

// ============================================================================
// 类型定义
// ============================================================================

export enum MemoryLevel {
  L0_SESSION = 'l0_session',     // 会话记忆
  L1_WORKING = 'l1_working',     // 工作记忆
  L2_LONGTERM = 'l2_longterm'    // 长期记忆
}

export interface Memory {
  id: string;
  level: MemoryLevel;
  content: string;
  embedding?: number[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    accessCount: number;
    lastAccessedAt: number;
    importance: number;
    source: string;
    tags: string[];
  };
  ttl?: number; // 生存时间（毫秒）
}

export interface MemoryQuery {
  query: string;
  level?: MemoryLevel;
  topK?: number;
  minImportance?: number;
  tags?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface MemorySearchResult {
  memory: Memory;
  score: number;
  level: MemoryLevel;
}

// ============================================================================
// L0 会话记忆
// ============================================================================

export class SessionMemory {
  private memories: Map<string, Memory> = new Map();
  private maxMemories = 100;
  private defaultTTL = 3600000; // 1 小时

  /**
   * 添加记忆
   */
  add(content: string, metadata: Partial<Memory['metadata']> = {}): Memory {
    const id = `l0-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const memory: Memory = {
      id,
      level: MemoryLevel.L0_SESSION,
      content,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
        lastAccessedAt: Date.now(),
        importance: metadata.importance || 0.5,
        source: metadata.source || 'session',
        tags: metadata.tags || []
      },
      ttl: this.defaultTTL
    };

    this.memories.set(id, memory);
    this.cleanup();
    return memory;
  }

  /**
   * 获取记忆
   */
  get(id: string): Memory | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      memory.metadata.accessCount++;
      memory.metadata.lastAccessedAt = Date.now();
    }
    return memory;
  }

  /**
   * 搜索记忆
   */
  search(query: string, topK: number = 10): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const memory of this.memories.values()) {
      // 简单的关键词匹配
      const contentLower = memory.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        results.push({
          memory,
          score: this.calculateRelevance(memory, query),
          level: MemoryLevel.L0_SESSION
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 计算相关性
   */
  private calculateRelevance(memory: Memory, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = memory.content.toLowerCase();

    // 关键词匹配
    const queryWords = queryLower.split(/\s+/);
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        score += 0.2;
      }
    }

    // 重要性加权
    score += memory.metadata.importance * 0.3;

    // 访问次数加权
    score += Math.min(memory.metadata.accessCount * 0.05, 0.2);

    // 时间衰减
    const age = Date.now() - memory.metadata.lastAccessedAt;
    const decay = Math.exp(-age / 3600000); // 1 小时衰减
    score *= decay;

    return Math.min(score, 1);
  }

  /**
   * 清理过期记忆
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, memory] of this.memories) {
      if (memory.ttl && now - memory.metadata.createdAt > memory.ttl) {
        this.memories.delete(id);
      }
    }

    // 限制数量
    if (this.memories.size > this.maxMemories) {
      const entries = Array.from(this.memories.entries())
        .sort((a, b) => a[1].metadata.lastAccessedAt - b[1].metadata.lastAccessedAt);
      
      const toDelete = entries.slice(0, this.memories.size - this.maxMemories);
      for (const [id] of toDelete) {
        this.memories.delete(id);
      }
    }
  }

  /**
   * 获取所有记忆
   */
  getAll(): Memory[] {
    return Array.from(this.memories.values());
  }

  /**
   * 清空
   */
  clear(): void {
    this.memories.clear();
  }

  /**
   * 获取统计
   */
  getStats(): { count: number; maxCapacity: number } {
    return {
      count: this.memories.size,
      maxCapacity: this.maxMemories
    };
  }
}

// ============================================================================
// L1 工作记忆
// ============================================================================

export class WorkingMemory {
  private memories: Map<string, Memory> = new Map();
  private maxMemories = 50;
  private promotionThreshold = 3; // 访问次数阈值，晋升到 L1

  /**
   * 添加记忆
   */
  add(content: string, metadata: Partial<Memory['metadata']> = {}): Memory {
    const id = `l1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const memory: Memory = {
      id,
      level: MemoryLevel.L1_WORKING,
      content,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
        lastAccessedAt: Date.now(),
        importance: metadata.importance || 0.7,
        source: metadata.source || 'working',
        tags: metadata.tags || []
      }
    };

    this.memories.set(id, memory);
    this.evictIfNeeded();
    return memory;
  }

  /**
   * 从 L0 晋升
   */
  promote(memory: Memory): Memory {
    if (memory.metadata.accessCount < this.promotionThreshold) {
      throw new Error('Memory does not meet promotion threshold');
    }

    const promotedMemory: Memory = {
      ...memory,
      id: `l1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level: MemoryLevel.L1_WORKING,
      metadata: {
        ...memory.metadata,
        importance: Math.min(memory.metadata.importance + 0.2, 1),
        updatedAt: Date.now()
      }
    };

    this.memories.set(promotedMemory.id, promotedMemory);
    this.evictIfNeeded();
    return promotedMemory;
  }

  /**
   * 获取记忆
   */
  get(id: string): Memory | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      memory.metadata.accessCount++;
      memory.metadata.lastAccessedAt = Date.now();
    }
    return memory;
  }

  /**
   * 搜索记忆
   */
  search(query: string, topK: number = 10): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const memory of this.memories.values()) {
      const contentLower = memory.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        results.push({
          memory,
          score: this.calculateRelevance(memory, query),
          level: MemoryLevel.L1_WORKING
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 计算相关性
   */
  private calculateRelevance(memory: Memory, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = memory.content.toLowerCase();

    const queryWords = queryLower.split(/\s+/);
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        score += 0.2;
      }
    }

    score += memory.metadata.importance * 0.3;
    score += Math.min(memory.metadata.accessCount * 0.03, 0.2);

    return Math.min(score, 1);
  }

  /**
   * 驱逐低优先级记忆
   */
  private evictIfNeeded(): void {
    if (this.memories.size <= this.maxMemories) return;

    const entries = Array.from(this.memories.entries())
      .sort((a, b) => {
        // 按重要性和访问次数排序
        const scoreA = a[1].metadata.importance + a[1].metadata.accessCount * 0.1;
        const scoreB = b[1].metadata.importance + b[1].metadata.accessCount * 0.1;
        return scoreA - scoreB;
      });

    const toEvict = entries.slice(0, this.memories.size - this.maxMemories);
    for (const [id] of toEvict) {
      this.memories.delete(id);
    }
  }

  /**
   * 获取所有记忆
   */
  getAll(): Memory[] {
    return Array.from(this.memories.values());
  }

  /**
   * 获取统计
   */
  getStats(): { count: number; maxCapacity: number; promotionThreshold: number } {
    return {
      count: this.memories.size,
      maxCapacity: this.maxMemories,
      promotionThreshold: this.promotionThreshold
    };
  }
}

// ============================================================================
// L2 长期记忆
// ============================================================================

export class LongTermMemory {
  private memories: Map<string, Memory> = new Map();
  private index: Map<string, Set<string>> = new Map(); // 标签索引

  /**
   * 添加记忆
   */
  add(content: string, metadata: Partial<Memory['metadata']> = {}): Memory {
    const id = `l2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const memory: Memory = {
      id,
      level: MemoryLevel.L2_LONGTERM,
      content,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
        lastAccessedAt: Date.now(),
        importance: metadata.importance || 0.9,
        source: metadata.source || 'longterm',
        tags: metadata.tags || []
      }
    };

    this.memories.set(id, memory);
    this.updateIndex(memory);
    return memory;
  }

  /**
   * 从 L1 晋升
   */
  promote(memory: Memory): Memory {
    const promotedMemory: Memory = {
      ...memory,
      id: `l2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level: MemoryLevel.L2_LONGTERM,
      metadata: {
        ...memory.metadata,
        importance: Math.min(memory.metadata.importance + 0.1, 1),
        updatedAt: Date.now()
      }
    };

    this.memories.set(promotedMemory.id, promotedMemory);
    this.updateIndex(promotedMemory);
    return promotedMemory;
  }

  /**
   * 更新索引
   */
  private updateIndex(memory: Memory): void {
    for (const tag of memory.metadata.tags) {
      if (!this.index.has(tag)) {
        this.index.set(tag, new Set());
      }
      this.index.get(tag)!.add(memory.id);
    }
  }

  /**
   * 获取记忆
   */
  get(id: string): Memory | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      memory.metadata.accessCount++;
      memory.metadata.lastAccessedAt = Date.now();
    }
    return memory;
  }

  /**
   * 搜索记忆
   */
  search(query: MemoryQuery): MemorySearchResult[] {
    let candidates = Array.from(this.memories.values());

    // 按标签过滤
    if (query.tags && query.tags.length > 0) {
      const tagMatches = new Set<string>();
      for (const tag of query.tags) {
        const ids = this.index.get(tag);
        if (ids) {
          for (const id of ids) {
            tagMatches.add(id);
          }
        }
      }
      candidates = candidates.filter(m => tagMatches.has(m.id));
    }

    // 按重要性过滤
    if (query.minImportance !== undefined && query.minImportance > 0) {
      candidates = candidates.filter(m => m.metadata.importance >= query.minImportance!);
    }

    // 按时间范围过滤
    if (query.timeRange) {
      candidates = candidates.filter(m => 
        m.metadata.createdAt >= query.timeRange!.start &&
        m.metadata.createdAt <= query.timeRange!.end
      );
    }

    // 计算相关性
    const results: MemorySearchResult[] = candidates.map(memory => ({
      memory,
      score: this.calculateRelevance(memory, query.query),
      level: MemoryLevel.L2_LONGTERM
    }));

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, query.topK || 10);
  }

  /**
   * 计算相关性
   */
  private calculateRelevance(memory: Memory, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = memory.content.toLowerCase();

    const queryWords = queryLower.split(/\s+/);
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        score += 0.15;
      }
    }

    score += memory.metadata.importance * 0.4;
    score += Math.min(memory.metadata.accessCount * 0.02, 0.15);

    return Math.min(score, 1);
  }

  /**
   * 获取所有记忆
   */
  getAll(): Memory[] {
    return Array.from(this.memories.values());
  }

  /**
   * 获取统计
   */
  getStats(): { count: number; tagCount: number } {
    return {
      count: this.memories.size,
      tagCount: this.index.size
    };
  }
}

// ============================================================================
// 三层记忆系统主类
// ============================================================================

export class ThreeLayerMemory {
  private l0: SessionMemory;
  private l1: WorkingMemory;
  private l2: LongTermMemory;
  private autoPromotion: boolean;

  constructor(autoPromotion: boolean = true) {
    this.l0 = new SessionMemory();
    this.l1 = new WorkingMemory();
    this.l2 = new LongTermMemory();
    this.autoPromotion = autoPromotion;
  }

  /**
   * 添加记忆
   */
  add(content: string, level: MemoryLevel = MemoryLevel.L0_SESSION, metadata: Partial<Memory['metadata']> = {}): Memory {
    switch (level) {
      case MemoryLevel.L0_SESSION:
        return this.l0.add(content, metadata);
      case MemoryLevel.L1_WORKING:
        return this.l1.add(content, metadata);
      case MemoryLevel.L2_LONGTERM:
        return this.l2.add(content, metadata);
    }
  }

  /**
   * 获取记忆
   */
  get(id: string): Memory | undefined {
    // 先检查 L0
    let memory = this.l0.get(id);
    if (memory) return memory;

    // 再检查 L1
    memory = this.l1.get(id);
    if (memory) {
      if (this.autoPromotion && memory.metadata.accessCount >= 3) {
        // 自动晋升到 L2
        this.l2.promote(memory);
      }
      return memory;
    }

    // 最后检查 L2
    memory = this.l2.get(id);
    return memory;
  }

  /**
   * 搜索记忆（跨层）
   */
  search(query: string, topK: number = 10): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];

    // 搜索 L0
    results.push(...this.l0.search(query, topK));

    // 搜索 L1
    results.push(...this.l1.search(query, topK));

    // 搜索 L2
    results.push(...this.l2.search({ query, topK }));

    // 合并并排序
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 晋升记忆
   */
  promote(id: string, fromLevel: MemoryLevel, toLevel: MemoryLevel): Memory | undefined {
    let memory: Memory | undefined;

    // 获取源记忆
    switch (fromLevel) {
      case MemoryLevel.L0_SESSION:
        memory = this.l0.get(id);
        break;
      case MemoryLevel.L1_WORKING:
        memory = this.l1.get(id);
        break;
      case MemoryLevel.L2_LONGTERM:
        memory = this.l2.get(id);
        break;
    }

    if (!memory) return undefined;

    // 晋升到目标层级
    switch (toLevel) {
      case MemoryLevel.L1_WORKING:
        return this.l1.promote(memory);
      case MemoryLevel.L2_LONGTERM:
        return this.l2.promote(memory);
      default:
        return undefined;
    }
  }

  /**
   * 获取常驻记忆（L0 + L1）
   */
  getResidentMemory(): Memory[] {
    return [...this.l0.getAll(), ...this.l1.getAll()];
  }

  /**
   * 获取统计
   */
  getStats(): {
    l0: { count: number; maxCapacity: number };
    l1: { count: number; maxCapacity: number; promotionThreshold: number };
    l2: { count: number; tagCount: number };
    total: number;
  } {
    return {
      l0: this.l0.getStats(),
      l1: this.l1.getStats(),
      l2: this.l2.getStats(),
      total: this.l0.getStats().count + this.l1.getStats().count + this.l2.getStats().count
    };
  }

  /**
   * 清空所有记忆
   */
  clear(): void {
    this.l0.clear();
  }
}

// 默认导出
export default ThreeLayerMemory;
