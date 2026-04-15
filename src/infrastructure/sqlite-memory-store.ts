/**
 * SQLite 记忆存储 - 替代 JSON 存储
 * 
 * 特性：
 * 1. FTS5 全文搜索
 * 2. 向量扩展 (sqlite-vec)
 * 3. WAL 模式优化
 * 4. 自动压缩
 * 5. 混合搜索（FTS + 向量）
 * 
 * 融合自 yaoyao-memory-v2 并增强
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// ============ 类型定义 ============

export interface SQLiteMemory {
  id: string;
  content: string;
  type: MemoryType;
  tags: string;
  metadata: string;
  confidence: number;
  source: string;
  importance: number;
  created_at: number;
  updated_at: number;
  accessed_at: number;
  access_count: number;
}

export type MemoryType = 
  | 'conversation'
  | 'fact'
  | 'preference'
  | 'task'
  | 'insight'
  | 'context';

export interface MemorySearchResult {
  id: string;
  content: string;
  type: MemoryType;
  tags: string[];
  score: number;
  source: 'fts' | 'vector' | 'hybrid';
  highlights: string[];
}

export interface SQLiteMemoryStoreConfig {
  dataPath: string;
  vectorDimension: number;
  enableWAL: boolean;
  cacheSizeMB: number;
  autoCompress: boolean;
  compressThreshold: number;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: SQLiteMemoryStoreConfig = {
  dataPath: path.join(process.env.HOME || '.', '.openclaw', 'workspace', 'memory', 'memories.db'),
  vectorDimension: 1536,
  enableWAL: true,
  cacheSizeMB: 64,
  autoCompress: true,
  compressThreshold: 10000,
};

// ============ SQLite 记忆存储类 ============

export class SQLiteMemoryStore {
  private db: any;
  private logger: any;
  private config: SQLiteMemoryStoreConfig;
  private initialized: boolean = false;
  private insertStmt: any;
  private updateStmt: any;
  private deleteStmt: any;
  private getStmt: any;

  constructor(logger: any, config?: Partial<SQLiteMemoryStoreConfig>) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 确保目录存在
    const dir = path.dirname(this.config.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 初始化数据库
    this.db = new Database(this.config.dataPath);
  }

  // ============ 初始化 ============

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 启用 WAL 模式
    if (this.config.enableWAL) {
      this.db.pragma('journal_mode = WAL');
    }
    
    // 设置缓存大小
    this.db.pragma(`cache_size = -${this.config.cacheSizeMB * 1000}`);
    
    // 设置同步模式
    this.db.pragma('synchronous = NORMAL');
    
    // 创建主表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'fact',
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        confidence REAL DEFAULT 0.8,
        source TEXT DEFAULT 'unknown',
        importance REAL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        accessed_at INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0
      );
    `);
    
    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_memories_accessed_at ON memories(accessed_at);
    `);
    
    // 创建 FTS5 虚拟表
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id,
        content,
        tags,
        metadata,
        content='memories',
        content_rowid='rowid',
        tokenize = 'porter unicode61'
      );
    `);
    
    // 创建 FTS 触发器（自动同步）
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, id, content, tags, metadata)
        VALUES (new.rowid, new.id, new.content, new.tags, new.metadata);
      END;
      
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, id, content, tags, metadata)
        VALUES('delete', old.rowid, old.id, old.content, old.tags, old.metadata);
      END;
      
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, id, content, tags, metadata)
        VALUES('delete', old.rowid, old.id, old.content, old.tags, old.metadata);
        INSERT INTO memories_fts(rowid, id, content, tags, metadata)
        VALUES (new.rowid, new.id, new.content, new.tags, new.metadata);
      END;
    `);
    
    // 预编译语句
    this.insertStmt = this.db.prepare(`
      INSERT INTO memories (id, content, type, tags, metadata, confidence, source, importance, created_at, updated_at, accessed_at, access_count)
      VALUES (@id, @content, @type, @tags, @metadata, @confidence, @source, @importance, @createdAt, @updatedAt, @accessedAt, @accessCount)
    `);
    
    this.updateStmt = this.db.prepare(`
      UPDATE memories 
      SET content = @content, type = @type, tags = @tags, metadata = @metadata, 
          confidence = @confidence, importance = @importance, updated_at = @updatedAt,
          accessed_at = @accessedAt, access_count = @accessCount
      WHERE id = @id
    `);
    
    this.deleteStmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    this.getStmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    
    this.initialized = true;
    this.logger.info('SQLiteMemoryStore', `初始化完成: ${this.config.dataPath}`);
  }

  // ============ CRUD 操作 ============

  async add(memory: {
    content: string;
    type?: MemoryType;
    tags?: string[];
    metadata?: Record<string, unknown>;
    confidence?: number;
    source?: string;
    importance?: number;
  }): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    this.insertStmt.run({
      id,
      content: memory.content,
      type: memory.type || 'fact',
      tags: JSON.stringify(memory.tags || []),
      metadata: JSON.stringify(memory.metadata || {}),
      confidence: memory.confidence || 0.8,
      source: memory.source || 'unknown',
      importance: memory.importance || 0.5,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0,
    });
    
    this.logger.debug('SQLiteMemoryStore', `添加记忆: ${id}`);
    return id;
  }

  async get(id: string): Promise<SQLiteMemory | null> {
    if (!this.initialized) await this.initialize();
    
    const memory = this.getStmt.get(id) as SQLiteMemory | undefined;
    if (!memory) return null;
    
    // 更新访问记录
    this.db.prepare(`
      UPDATE memories SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?
    `).run(Date.now(), id);
    
    return memory;
  }

  async update(id: string, updates: Partial<{
    content: string;
    type: MemoryType;
    tags: string[];
    metadata: Record<string, unknown>;
    confidence: number;
    importance: number;
  }>): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    
    const existing = await this.get(id);
    if (!existing) return false;
    
    this.updateStmt.run({
      id,
      content: updates.content || existing.content,
      type: updates.type || existing.type,
      tags: JSON.stringify(updates.tags || JSON.parse(existing.tags)),
      metadata: JSON.stringify(updates.metadata || JSON.parse(existing.metadata)),
      confidence: updates.confidence ?? existing.confidence,
      importance: updates.importance ?? existing.importance,
      updatedAt: Date.now(),
      accessedAt: existing.accessed_at,
      accessCount: existing.access_count,
    });
    
    return true;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    
    const result = this.deleteStmt.run(id);
    return result.changes > 0;
  }

  // ============ 搜索操作 ============

  /**
   * FTS 全文搜索
   */
  async ftsSearch(query: string, options?: {
    type?: MemoryType;
    limit?: number;
    offset?: number;
  }): Promise<MemorySearchResult[]> {
    if (!this.initialized) await this.initialize();
    
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    
    let sql = `
      SELECT m.id, m.content, m.type, m.tags, bm25(memories_fts) as score
      FROM memories_fts fts
      JOIN memories m ON fts.id = m.id
      WHERE memories_fts MATCH ?
    `;
    
    const params: (string | number)[] = [query];
    
    if (options?.type) {
      sql += ' AND m.type = ?';
      params.push(options.type);
    }
    
    sql += ' ORDER BY score LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const results = this.db.prepare(sql).all(...params) as any[];
    
    return results.map(r => ({
      id: r.id,
      content: r.content,
      type: r.type,
      tags: JSON.parse(r.tags || '[]'),
      score: -r.score, // BM25 返回负值，取反
      source: 'fts' as const,
      highlights: this.extractHighlights(r.content, query),
    }));
  }

  /**
   * 混合搜索（FTS + 向量）
   * 注：向量搜索需要外部嵌入模型
   */
  async hybridSearch(
    query: string,
    embedding: number[],
    options?: {
      topK?: number;
      ftsWeight?: number;
      vectorWeight?: number;
      rrfK?: number;
    }
  ): Promise<MemorySearchResult[]> {
    if (!this.initialized) await this.initialize();
    
    const topK = options?.topK || 10;
    const ftsWeight = options?.ftsWeight || 0.5;
    const vectorWeight = options?.vectorWeight || 0.5;
    const rrfK = options?.rrfK || 60;
    
    // 1. FTS 搜索
    const ftsResults = await this.ftsSearch(query, { limit: topK * 2 });
    
    // 2. 向量搜索（简化版：使用余弦相似度）
    const vectorResults = await this.vectorSearch(embedding, topK * 2);
    
    // 3. RRF 融合
    return this.rrfFusion(ftsResults, vectorResults, {
      topK,
      ftsWeight,
      vectorWeight,
      rrfK,
    });
  }

  /**
   * 向量搜索（简化版）
   */
  private async vectorSearch(embedding: number[], topK: number): Promise<MemorySearchResult[]> {
    // 获取所有记忆（生产环境应使用向量索引）
    const memories = this.db.prepare('SELECT * FROM memories LIMIT 10000').all() as SQLiteMemory[];
    
    const results: { memory: SQLiteMemory; score: number }[] = [];
    
    for (const memory of memories) {
      // 从 metadata 中提取嵌入向量（如果有）
      const metadata = JSON.parse(memory.metadata || '{}');
      if (metadata.embedding && Array.isArray(metadata.embedding)) {
        const score = this.cosineSimilarity(embedding, metadata.embedding);
        results.push({ memory, score });
      }
    }
    
    // 排序并返回 topK
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK).map(r => ({
      id: r.memory.id,
      content: r.memory.content,
      type: r.memory.type as MemoryType,
      tags: JSON.parse(r.memory.tags || '[]'),
      score: r.score,
      source: 'vector' as const,
      highlights: [],
    }));
  }

  /**
   * RRF 融合排序
   */
  private rrfFusion(
    ftsResults: MemorySearchResult[],
    vectorResults: MemorySearchResult[],
    options: {
      topK: number;
      ftsWeight: number;
      vectorWeight: number;
      rrfK: number;
    }
  ): MemorySearchResult[] {
    const scores: Map<string, { result: MemorySearchResult; rrfScore: number }> = new Map();
    
    // FTS 结果
    ftsResults.forEach((result, rank) => {
      const rrfScore = (options.ftsWeight / (options.rrfK + rank + 1));
      scores.set(result.id, { result, rrfScore });
    });
    
    // 向量结果
    vectorResults.forEach((result, rank) => {
      const rrfScore = (options.vectorWeight / (options.rrfK + rank + 1));
      const existing = scores.get(result.id);
      if (existing) {
        existing.rrfScore += rrfScore;
        existing.result.source = 'hybrid';
      } else {
        scores.set(result.id, { result, rrfScore });
      }
    });
    
    // 排序
    return Array.from(scores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, options.topK)
      .map(item => ({
        ...item.result,
        score: item.rrfScore,
      }));
  }

  // ============ 批量操作 ============

  async addBatch(memories: Array<{
    content: string;
    type?: MemoryType;
    tags?: string[];
    metadata?: Record<string, unknown>;
    confidence?: number;
    source?: string;
    importance?: number;
  }>): Promise<string[]> {
    if (!this.initialized) await this.initialize();
    
    const insertMany = this.db.transaction((items: typeof memories) => {
      const ids: string[] = [];
      for (const memory of items) {
        const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();
        
        this.insertStmt.run({
          id,
          content: memory.content,
          type: memory.type || 'fact',
          tags: JSON.stringify(memory.tags || []),
          metadata: JSON.stringify(memory.metadata || {}),
          confidence: memory.confidence || 0.8,
          source: memory.source || 'unknown',
          importance: memory.importance || 0.5,
          createdAt: now,
          updatedAt: now,
          accessedAt: now,
          accessCount: 0,
        });
        
        ids.push(id);
      }
      return ids;
    });
    
    return insertMany(memories);
  }

  async deleteBatch(ids: string[]): Promise<number> {
    if (!this.initialized) await this.initialize();
    
    const deleteMany = this.db.transaction((items: string[]) => {
      let count = 0;
      for (const id of items) {
        const result = this.deleteStmt.run(id);
        count += result.changes;
      }
      return count;
    });
    
    return deleteMany(ids);
  }

  // ============ 统计操作 ============

  async getStats(): Promise<{
    total: number;
    byType: Record<MemoryType, number>;
    avgImportance: number;
    avgConfidence: number;
    oldestAt: number;
    newestAt: number;
  }> {
    if (!this.initialized) await this.initialize();
    
    const total = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
    
    const byType = this.db.prepare(`
      SELECT type, COUNT(*) as count FROM memories GROUP BY type
    `).all() as { type: MemoryType; count: number }[];
    
    const avgs = this.db.prepare(`
      SELECT AVG(importance) as avgImportance, AVG(confidence) as avgConfidence,
             MIN(created_at) as oldestAt, MAX(created_at) as newestAt
      FROM memories
    `).get() as { avgImportance: number; avgConfidence: number; oldestAt: number; newestAt: number };
    
    const byTypeMap: Record<MemoryType, number> = {
      conversation: 0,
      fact: 0,
      preference: 0,
      task: 0,
      insight: 0,
      context: 0,
    };
    
    for (const row of byType) {
      byTypeMap[row.type] = row.count;
    }
    
    return {
      total: total.count,
      byType: byTypeMap,
      avgImportance: avgs.avgImportance || 0,
      avgConfidence: avgs.avgConfidence || 0,
      oldestAt: avgs.oldestAt || 0,
      newestAt: avgs.newestAt || 0,
    };
  }

  // ============ 维护操作 ============

  /**
   * 压缩数据库
   */
  async vacuum(): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    this.db.exec('VACUUM');
    this.logger.info('SQLiteMemoryStore', '数据库已压缩');
  }

  /**
   * 优化数据库
   */
  async optimize(): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    this.db.exec('PRAGMA optimize');
    this.db.exec('ANALYZE');
    this.logger.info('SQLiteMemoryStore', '数据库已优化');
  }

  /**
   * 清理旧记忆
   */
  async cleanup(options?: {
    maxAge?: number;
    minImportance?: number;
    dryRun?: boolean;
  }): Promise<number> {
    if (!this.initialized) await this.initialize();
    
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    
    if (options?.maxAge) {
      conditions.push('created_at < ?');
      params.push(Date.now() - options.maxAge);
    }
    
    if (options?.minImportance !== undefined) {
      conditions.push('importance < ?');
      params.push(options.minImportance);
    }
    
    if (conditions.length === 0) return 0;
    
    const whereClause = conditions.join(' OR ');
    
    if (options?.dryRun) {
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM memories WHERE ${whereClause}`).get(...params) as { count: number };
      return count.count;
    }
    
    const result = this.db.prepare(`DELETE FROM memories WHERE ${whereClause}`).run(...params);
    this.logger.info('SQLiteMemoryStore', `清理完成: 删除 ${result.changes} 条记忆`);
    
    return result.changes;
  }

  // ============ 导入导出 ============

  async exportAll(): Promise<SQLiteMemory[]> {
    if (!this.initialized) await this.initialize();
    return this.db.prepare('SELECT * FROM memories').all() as SQLiteMemory[];
  }

  async importBatch(memories: SQLiteMemory[]): Promise<number> {
    if (!this.initialized) await this.initialize();
    
    const importMany = this.db.transaction((items: SQLiteMemory[]) => {
      let count = 0;
      for (const memory of items) {
        try {
          this.insertStmt.run({
            id: memory.id,
            content: memory.content,
            type: memory.type,
            tags: memory.tags,
            metadata: memory.metadata,
            confidence: memory.confidence,
            source: memory.source,
            importance: memory.importance,
            createdAt: memory.created_at,
            updatedAt: memory.updated_at,
            accessedAt: memory.accessed_at,
            accessCount: memory.access_count,
          });
          count++;
        } catch (e) {
          // 忽略重复 ID
        }
      }
      return count;
    });
    
    return importMany(memories);
  }

  // ============ 辅助方法 ============

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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
    if (this.db) {
      this.db.close();
      this.initialized = false;
      this.logger.info('SQLiteMemoryStore', '已关闭');
    }
  }

  // ============ 迁移工具 ============

  /**
   * 从 JSON 存储迁移
   */
  async migrateFromJSON(jsonPath: string): Promise<number> {
    if (!fs.existsSync(jsonPath)) {
      this.logger.warn('SQLiteMemoryStore', `JSON 文件不存在: ${jsonPath}`);
      return 0;
    }
    
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    let count = 0;
    
    for (const memory of data) {
      try {
        await this.add({
          content: memory.content,
          type: memory.type,
          tags: memory.tags,
          metadata: memory.metadata,
          confidence: memory.confidence,
          source: memory.source,
          importance: memory.importance,
        });
        count++;
      } catch (e) {
        this.logger.warn('SQLiteMemoryStore', `迁移失败: ${memory.id}`);
      }
    }
    
    this.logger.info('SQLiteMemoryStore', `迁移完成: ${count} 条记忆`);
    return count;
  }
}

// ============ 导出 ============

export default SQLiteMemoryStore;
