/**
 * 记忆存储模块
 * 
 * 基于内存的持久化记忆存储（简化版）
 * 融合自 yaoyao-memory-v2
 * 
 * 注：生产环境可替换为 SQLite 版本
 */

import { StructuredLogger } from './index';
import * as path from 'path';
import * as fs from 'fs';

// ============ 类型定义 ============

export interface Memory {
  id: string;
  content: string;
  type: any;
  tags: string[];
  metadata: Record<string, unknown>;
  confidence: number;
  source: string;
  createdAt: number;
  updatedAt: number;
  accessedAt: number;
  accessCount: number;
  importance: number;
}

export type MemoryType = 
  | 'conversation'   // 对话记忆
  | 'fact'          // 事实知识
  | 'preference'    // 用户偏好
  | 'task'          // 任务记忆
  | 'insight'       // 洞察
  | 'context';      // 上下文

export interface MemorySearchResult {
  memory: Memory;
  score: number;
  highlights: string[];
}

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  byTag: Record<string, number>;
  avgImportance: number;
  avgConfidence: number;
  oldestAt: number;
  newestAt: number;
}

// ============ 记忆存储类 ============

export class MemoryStore {
  private logger: StructuredLogger;
  private memories: Map<string, Memory> = new Map();
  private dataPath: string;
  private initialized: boolean = false;

  constructor(logger: StructuredLogger, dataPath?: string) {
    this.logger = logger;
    this.dataPath = dataPath || path.join(process.env.HOME || '.', '.openclaw', 'workspace', 'memory', 'memories.json');
  }

  // ============ 初始化 ============

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 确保目录存在
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 加载已有数据
    await this.load();
    
    this.initialized = true;
    this.logger.info('MemoryStore', `初始化完成: ${this.memories.size} 条记忆`);
  }

  private async load(): Promise<void> {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf-8');
        const memories: Memory[] = JSON.parse(data);
        for (const memory of memories) {
          this.memories.set(memory.id, memory);
        }
      }
    } catch (e) {
      this.logger.warn('MemoryStore', `加载失败: ${e}`);
    }
  }

  private async save(): Promise<void> {
    try {
      const data = JSON.stringify(Array.from(this.memories.values()), null, 2);
      fs.writeFileSync(this.dataPath, data, 'utf-8');
    } catch (e) {
      this.logger.warn('MemoryStore', `保存失败: ${e}`);
    }
  }

  // ============ CRUD 操作 ============

  async add(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'accessedAt' | 'accessCount'>): Promise<string> {
    if (!this.initialized) await this.initialize();

    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const fullMemory: Memory = {
      ...memory,
      id,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0
    };

    this.memories.set(id, fullMemory);
    await this.save();

    this.logger.debug('MemoryStore', `添加记忆: ${id}`);
    return id;
  }

  async get(id: string): Promise<Memory | null> {
    if (!this.initialized) await this.initialize();

    const memory = this.memories.get(id);
    if (!memory) return null;

    // 更新访问记录
    memory.accessedAt = Date.now();
    memory.accessCount++;
    await this.save();

    return memory;
  }

  async update(id: string, updates: Partial<Memory>): Promise<boolean> {
    if (!this.initialized) await this.initialize();

    const memory = this.memories.get(id);
    if (!memory) return false;

    Object.assign(memory, updates, { updatedAt: Date.now() });
    await this.save();

    return true;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.initialized) await this.initialize();

    const result = this.memories.delete(id);
    if (result) {
      await this.save();
    }
    return result;
  }

  // ============ 搜索操作 ============

  async search(query: string, options?: {
    type?: MemoryType;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<MemorySearchResult[]> {
    if (!this.initialized) await this.initialize();

    const limit = options?.limit || 10;
    const lowerQuery = query.toLowerCase();

    const results: MemorySearchResult[] = [];

    for (const memory of this.memories.values()) {
      // 类型过滤
      if (options?.type && memory.type !== options.type) continue;

      // 标签过滤
      if (options?.tags && !options.tags.some(t => memory.tags.includes(t))) continue;

      // 内容匹配
      const contentLower = memory.content.toLowerCase();
      if (contentLower.includes(lowerQuery)) {
        const score = this.calculateRelevance(memory, query);
        results.push({
          memory,
          score,
          highlights: this.extractHighlights(memory.content, query)
        });
      }
    }

    // 按相关性排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(options?.offset || 0, (options?.offset || 0) + limit);
  }

  async searchByTags(tags: string[], options?: {
    limit?: number;
    offset?: number;
  }): Promise<Memory[]> {
    if (!this.initialized) await this.initialize();

    const limit = options?.limit || 10;
    const results: Memory[] = [];

    for (const memory of this.memories.values()) {
      if (tags.some(t => memory.tags.includes(t))) {
        results.push(memory);
      }
    }

    // 按重要性排序
    results.sort((a, b) => b.importance - a.importance);

    return results.slice(options?.offset || 0, (options?.offset || 0) + limit);
  }

  // ============ 统计操作 ============

  async getStats(): Promise<MemoryStats> {
    if (!this.initialized) await this.initialize();

    const memories = Array.from(this.memories.values());

    const byType: Record<string, number> = {
      conversation: 0,
      fact: 0,
      preference: 0,
      task: 0,
      insight: 0,
      context: 0
    };

    const byTag: Record<string, number> = {};

    let totalImportance = 0;
    let totalConfidence = 0;
    let oldestAt = Date.now();
    let newestAt = 0;

    for (const memory of memories) {
      byType[memory.type as string]++;
      
      for (const tag of memory.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }

      totalImportance += memory.importance;
      totalConfidence += memory.confidence;
      
      if (memory.createdAt < oldestAt) oldestAt = memory.createdAt;
      if (memory.createdAt > newestAt) newestAt = memory.createdAt;
    }

    return {
      total: memories.length,
      byType,
      byTag,
      avgImportance: memories.length > 0 ? totalImportance / memories.length : 0,
      avgConfidence: memories.length > 0 ? totalConfidence / memories.length : 0,
      oldestAt: memories.length > 0 ? oldestAt : 0,
      newestAt: memories.length > 0 ? newestAt : 0
    };
  }

  // ============ 批量操作 ============

  async addBatch(memories: Array<Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'accessedAt' | 'accessCount'>>): Promise<string[]> {
    const ids: string[] = [];
    for (const memory of memories) {
      const id = await this.add(memory);
      ids.push(id);
    }
    return ids;
  }

  async deleteBatch(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      if (await this.delete(id)) {
        count++;
      }
    }
    return count;
  }

  async exportAll(): Promise<Memory[]> {
    if (!this.initialized) await this.initialize();
    return Array.from(this.memories.values());
  }

  async importBatch(memories: Memory[]): Promise<number> {
    if (!this.initialized) await this.initialize();

    let count = 0;
    for (const memory of memories) {
      this.memories.set(memory.id, memory);
      count++;
    }
    await this.save();
    return count;
  }

  // ============ 维护操作 ============

  async cleanup(options?: {
    maxAge?: number;
    minImportance?: number;
    dryRun?: boolean;
  }): Promise<number> {
    if (!this.initialized) await this.initialize();

    const toDelete: string[] = [];
    const now = Date.now();

    for (const [id, memory] of this.memories) {
      let shouldDelete = false;

      if (options?.maxAge && now - memory.createdAt > options.maxAge) {
        shouldDelete = true;
      }

      if (options?.minImportance !== undefined && memory.importance < options.minImportance) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        toDelete.push(id);
      }
    }

    if (options?.dryRun) {
      return toDelete.length;
    }

    return this.deleteBatch(toDelete);
  }

  // ============ 辅助方法 ============

  private calculateRelevance(memory: Memory, query: string): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    const lowerContent = memory.content.toLowerCase();

    // 精确匹配加分
    if (lowerContent.includes(lowerQuery)) {
      score += 0.5;
    }

    // 重要性加分
    score += memory.importance * 0.3;

    // 置信度加分
    score += memory.confidence * 0.2;

    // 访问次数加分
    score += Math.min(0.1, memory.accessCount * 0.01);

    return score;
  }

  private extractHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let index = lowerContent.indexOf(lowerQuery);
    while (index !== -1 && highlights.length < 3) {
      const start = Math.max(0, index - 20);
      const end = Math.min(content.length, index + query.length + 20);
      highlights.push(content.substring(start, end));
      index = lowerContent.indexOf(lowerQuery, index + 1);
    }

    return highlights;
  }

  // ============ 关闭 ============

  async close(): Promise<void> {
    await this.save();
    this.memories.clear();
    this.initialized = false;
    this.logger.info('MemoryStore', '已关闭');
  }
}
