/**
 * 索引持久化
 * 
 * 功能：
 * 1. 索引序列化保存
 * 2. 增量更新
 * 3. 版本管理
 */

// ============================================================
// 类型定义
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

export interface IndexMetadata {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  vectorCount: number;
  vectorDim: number;
  checksum: string;
  config: Record<string, unknown>;
}

export interface PersistenceConfig {
  indexDir: string;
  version: string;
  autoSave: boolean;
  saveInterval: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: PersistenceConfig = {
  indexDir: path.join(process.env.HOME || '', '.openclaw', 'memory-tdai', 'indices'),
  version: '4.3.0',
  autoSave: false,
  saveInterval: 60000,
};

// ============================================================
// 索引持久化管理器
// ============================================================

export class IndexPersistence {
  private config: PersistenceConfig;
  private metadata: Map<string, IndexMetadata> = new Map();
  private metadataFile: string;

  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metadataFile = path.join(this.config.indexDir, 'metadata.json');
    this.ensureDir();
    this.loadMetadata();
  }

  /**
   * 确保目录存在
   */
  private ensureDir(): void {
    if (!fs.existsSync(this.config.indexDir)) {
      fs.mkdirSync(this.config.indexDir, { recursive: true });
    }
  }

  /**
   * 加载元数据
   */
  private loadMetadata(): void {
    if (fs.existsSync(this.metadataFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.metadataFile, 'utf-8'));
        for (const [id, meta] of Object.entries(data.indices || {})) {
          this.metadata.set(id, meta as IndexMetadata);
        }
      } catch {
        // 忽略错误
      }
    }
  }

  /**
   * 保存元数据
   */
  private saveMetadataFile(): void {
    const data = {
      version: this.config.version,
      indices: Object.fromEntries(this.metadata),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(this.metadataFile, JSON.stringify(data, null, 2));
  }

  /**
   * 计算校验和
   */
  private computeChecksum(data: string): string {
    // 简单哈希
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * 保存索引
   */
  saveIndex(
    name: string,
    index: unknown,
    vectors: number[][],
    config: Record<string, unknown> = {}
  ): string {
    const id = `${name}_${Date.now()}`;
    const indexFile = path.join(this.config.indexDir, `${id}.json`);
    
    // 序列化索引
    const indexData = {
      id,
      name,
      version: this.config.version,
      vectors,
      index,
      config,
      savedAt: new Date().toISOString(),
    };
    
    const jsonStr = JSON.stringify(indexData);
    const checksum = this.computeChecksum(jsonStr);
    
    // 保存文件
    fs.writeFileSync(indexFile, jsonStr);
    
    // 更新元数据
    const meta: IndexMetadata = {
      id,
      name,
      version: this.config.version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      vectorCount: vectors.length,
      vectorDim: vectors[0]?.length || 0,
      checksum,
      config,
    };
    
    this.metadata.set(id, meta);
    this.saveMetadataFile();
    
    return id;
  }

  /**
   * 加载索引
   */
  loadIndex(id: string): {
    index: unknown;
    vectors: number[][];
    config: Record<string, unknown>;
  } | null {
    const indexFile = path.join(this.config.indexDir, `${id}.json`);
    
    if (!fs.existsSync(indexFile)) {
      return null;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      return {
        index: data.index,
        vectors: data.vectors,
        config: data.config || {},
      };
    } catch {
      return null;
    }
  }

  /**
   * 删除索引
   */
  deleteIndex(id: string): boolean {
    const indexFile = path.join(this.config.indexDir, `${id}.json`);
    
    if (fs.existsSync(indexFile)) {
      fs.unlinkSync(indexFile);
    }
    
    const removed = this.metadata.delete(id);
    if (removed) {
      this.saveMetadataFile();
    }
    return removed;
  }

  /**
   * 列出所有索引
   */
  listIndices(): IndexMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * 获取索引元数据
   */
  getMetadata(id: string): IndexMetadata | undefined {
    return this.metadata.get(id);
  }

  /**
   * 检查索引是否存在
   */
  hasIndex(id: string): boolean {
    return this.metadata.has(id);
  }
}

// ============================================================
// 增量索引更新器
// ============================================================

export class IncrementalIndexUpdater {
  private persistence: IndexPersistence;
  private pendingUpdates: Map<string, { vectors: number[][]; operation: 'add' | 'remove' }> = new Map();

  constructor(persistence: IndexPersistence) {
    this.persistence = persistence;
  }

  /**
   * 添加向量到待更新队列
   */
  addToUpdate(indexId: string, vectors: number[][]): void {
    const existing = this.pendingUpdates.get(indexId);
    if (existing && existing.operation === 'add') {
      existing.vectors.push(...vectors);
    } else {
      this.pendingUpdates.set(indexId, { vectors, operation: 'add' });
    }
  }

  /**
   * 标记删除
   */
  markForRemoval(indexId: string, vectorIds: string[]): void {
    this.pendingUpdates.set(indexId, { vectors: [], operation: 'remove' });
  }

  /**
   * 应用更新
   */
  applyUpdates(): Map<string, boolean> {
    const results = new Map<string, boolean>();
    
    for (const [indexId, update] of this.pendingUpdates) {
      try {
        const loaded = this.persistence.loadIndex(indexId);
        if (loaded) {
          if (update.operation === 'add') {
            loaded.vectors.push(...update.vectors);
          }
          this.persistence.saveIndex(
            this.persistence.getMetadata(indexId)?.name || indexId,
            loaded.index,
            loaded.vectors,
            loaded.config
          );
          results.set(indexId, true);
        } else {
          results.set(indexId, false);
        }
      } catch {
        results.set(indexId, false);
      }
    }
    
    this.pendingUpdates.clear();
    return results;
  }

  /**
   * 清空待更新队列
   */
  clear(): void {
    this.pendingUpdates.clear();
  }

  /**
   * 获取待更新数量
   */
  getPendingCount(): number {
    return this.pendingUpdates.size;
  }
}
