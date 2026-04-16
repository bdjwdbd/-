/**
 * Harness Engineering - 状态管理器
 * 
 * 核心原则：LLM 无状态，外部托管所有复杂状态
 * 
 * @module harness/state-manager/manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  StateManagerConfig,
  DEFAULT_STATE_MANAGER_CONFIG,
  StateEntry,
  StateLifecycle,
  StateCategory,
  Checkpoint,
  StateStats,
  StateOperationResult,
  DEFAULT_LIFECYCLE,
} from './state-types';
import { MemoryStateStore, FileStateStore, TieredStateStore, StateStore } from './store';

// ============ 审计日志 ============

interface AuditLogEntry {
  timestamp: number;
  operation: 'get' | 'set' | 'delete' | 'checkpoint' | 'restore';
  key: string;
  category: StateCategory;
  success: boolean;
  latency: number;
  metadata?: Record<string, unknown>;
}

// ============ 状态管理器 ============

/**
 * 状态管理器
 * 
 * 统一管理所有状态，提供：
 * - 分类存储
 * - 生命周期管理
 * - 检查点与恢复
 * - 审计日志
 */
export class StateManager {
  private config: StateManagerConfig;
  private stores: Map<StateCategory, StateStore> = new Map();
  private checkpoints: Map<string, Checkpoint> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private cleanupTimer?: NodeJS.Timeout;
  private stats = {
    hits: 0,
    misses: 0,
    totalAccessTime: 0,
    accessCount: 0,
  };

  constructor(config: Partial<StateManagerConfig> = {}) {
    this.config = { ...DEFAULT_STATE_MANAGER_CONFIG, ...config };
  }

  /**
   * 初始化状态管理器
   */
  async initialize(): Promise<void> {
    // 创建存储目录
    const stateDir = path.join(this.config.workspaceRoot, '.state');
    await fs.promises.mkdir(stateDir, { recursive: true });

    // 为每个类别创建存储
    for (const category of Object.values(StateCategory)) {
      const lifecycle = DEFAULT_LIFECYCLE[category as StateCategory];
      
      if (lifecycle.persist) {
        // 持久化状态使用分层存储
        const categoryDir = path.join(stateDir, category);
        const store = new TieredStateStore(
          categoryDir,
          this.config.enableEncryption,
          this.config.encryptionKey
        );
        await store.initialize();
        this.stores.set(category as StateCategory, store);
      } else {
        // 临时状态使用内存存储
        const store = new MemoryStateStore();
        await store.initialize();
        this.stores.set(category as StateCategory, store);
      }
    }

    // 启动定时清理
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.config.cleanupInterval
      );
    }

    // 加载检查点索引
    await this.loadCheckpointIndex();
  }

  // ============ 核心操作 ============

  /**
   * 获取状态
   */
  async get<T = unknown>(key: string): Promise<StateOperationResult<T>> {
    const startTime = Date.now();
    
    try {
      // 尝试从所有存储中查找
      for (const [category, store] of this.stores) {
        const entry = await store.get<T>(key);
        if (entry) {
          this.stats.hits++;
          this.stats.accessCount++;
          this.stats.totalAccessTime += Date.now() - startTime;
          
          // 记录审计日志
          if (this.config.enableAudit) {
            this.logAudit('get', key, category, true, Date.now() - startTime);
          }
          
          return {
            success: true,
            data: entry.value,
            latency: Date.now() - startTime,
          };
        }
      }

      this.stats.misses++;
      
      return {
        success: false,
        error: 'State not found',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * 设置状态（幂等）
   */
  async set<T = unknown>(
    key: string,
    value: T,
    category: StateCategory = StateCategory.SESSION,
    customLifecycle?: Partial<StateLifecycle>
  ): Promise<StateOperationResult<StateEntry<T>>> {
    const startTime = Date.now();
    
    try {
      const lifecycle = {
        ...DEFAULT_LIFECYCLE[category],
        ...customLifecycle,
      };

      const store = this.stores.get(category);
      if (!store) {
        throw new Error(`No store for category: ${category}`);
      }

      const entry = await store.set(key, value, lifecycle);
      
      // 记录审计日志
      if (this.config.enableAudit && lifecycle.audit) {
        this.logAudit('set', key, category, true, Date.now() - startTime, {
          version: entry.version,
          ttl: lifecycle.ttl,
        });
      }

      return {
        success: true,
        data: entry,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * 删除状态
   */
  async delete(key: string): Promise<StateOperationResult<boolean>> {
    const startTime = Date.now();
    
    try {
      let deleted = false;
      let deletedCategory: StateCategory | null = null;

      for (const [category, store] of this.stores) {
        if (await store.delete(key)) {
          deleted = true;
          deletedCategory = category;
        }
      }

      if (deleted && deletedCategory && this.config.enableAudit) {
        this.logAudit('delete', key, deletedCategory, true, Date.now() - startTime);
      }

      return {
        success: deleted,
        data: deleted,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查状态是否存在
   */
  async exists(key: string): Promise<boolean> {
    for (const store of this.stores.values()) {
      if (await store.exists(key)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取所有键
   */
  async keys(category?: StateCategory, pattern?: string): Promise<string[]> {
    if (category) {
      const store = this.stores.get(category);
      return store ? store.keys(pattern) : [];
    }

    const allKeys: string[] = [];
    for (const store of this.stores.values()) {
      allKeys.push(...await store.keys(pattern));
    }
    return [...new Set(allKeys)];
  }

  // ============ 检查点与恢复 ============

  /**
   * 创建检查点
   */
  async checkpoint(
    keys: string[],
    description?: string
  ): Promise<StateOperationResult<string>> {
    const startTime = Date.now();
    
    try {
      const checkpointId = `cp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const checkpointData: Record<string, StateEntry> = {};

      // 收集所有状态
      for (const key of keys) {
        for (const [category, store] of this.stores) {
          const entry = await store.get(key);
          if (entry) {
            checkpointData[key] = entry;
            break;
          }
        }
      }

      // 压缩数据
      const data = JSON.stringify(checkpointData);
      const compressed = Buffer.from(data).toString('base64');
      const checksum = crypto
        .createHash('sha256')
        .update(compressed)
        .digest('hex')
        .substring(0, 16);

      const checkpoint: Checkpoint = {
        id: checkpointId,
        keys,
        createdAt: Date.now(),
        description,
        data: compressed,
        checksum,
      };

      // 保存检查点
      this.checkpoints.set(checkpointId, checkpoint);
      await this.saveCheckpoint(checkpoint);

      // 记录审计日志
      if (this.config.enableAudit) {
        this.logAudit('checkpoint', checkpointId, StateCategory.SYSTEM, true, Date.now() - startTime, {
          keyCount: keys.length,
        });
      }

      return {
        success: true,
        data: checkpointId,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * 从检查点恢复
   */
  async restore(checkpointId: string): Promise<StateOperationResult<number>> {
    const startTime = Date.now();
    
    try {
      const checkpoint = this.checkpoints.get(checkpointId);
      if (!checkpoint) {
        throw new Error(`Checkpoint not found: ${checkpointId}`);
      }

      // 解压数据
      const data = Buffer.from(checkpoint.data, 'base64').toString('utf-8');
      const checkpointData: Record<string, StateEntry> = JSON.parse(data);

      // 验证校验和
      const checksum = crypto
        .createHash('sha256')
        .update(checkpoint.data)
        .digest('hex')
        .substring(0, 16);
      
      if (checksum !== checkpoint.checksum) {
        throw new Error('Checkpoint checksum mismatch');
      }

      // 恢复状态
      let restoredCount = 0;
      for (const [key, entry] of Object.entries(checkpointData)) {
        const store = this.stores.get(entry.category);
        if (store) {
          await store.set(key, entry.value, DEFAULT_LIFECYCLE[entry.category]);
          restoredCount++;
        }
      }

      // 记录审计日志
      if (this.config.enableAudit) {
        this.logAudit('restore', checkpointId, StateCategory.SYSTEM, true, Date.now() - startTime, {
          restoredCount,
        });
      }

      return {
        success: true,
        data: restoredCount,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * 列出所有检查点
   */
  listCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values());
  }

  /**
   * 删除检查点
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return false;

    this.checkpoints.delete(checkpointId);
    
    // 删除文件
    const checkpointPath = this.getCheckpointPath(checkpointId);
    try {
      await fs.promises.unlink(checkpointPath);
    } catch (error) {
      // 忽略文件不存在错误
    }

    return true;
  }

  // ============ 维护操作 ============

  /**
   * 清理过期状态
   */
  async cleanup(): Promise<number> {
    let totalCleaned = 0;
    
    for (const store of this.stores.values()) {
      totalCleaned += await store.cleanup();
    }

    return totalCleaned;
  }

  /**
   * 获取统计信息
   */
  getStats(): StateStats {
    const byCategory: Record<StateCategory, number> = {} as any;
    let totalEntries = 0;
    let totalMemoryUsage = 0;

    for (const [category, store] of this.stores) {
      const keys = store.keys();
      // 简化：使用 Promise 的同步版本
      keys.then((k: string[]) => {
        byCategory[category] = k.length;
        totalEntries += k.length;
      });
    }

    return {
      totalEntries,
      byCategory,
      totalMemoryUsage,
      checkpointCount: this.checkpoints.size,
      hitRate: this.stats.accessCount > 0 
        ? this.stats.hits / this.stats.accessCount 
        : 0,
      avgAccessTime: this.stats.accessCount > 0
        ? this.stats.totalAccessTime / this.stats.accessCount
        : 0,
    };
  }

  /**
   * 获取审计日志
   */
  getAuditLog(limit: number = 100): AuditLogEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * 关闭状态管理器
   */
  async close(): Promise<void> {
    // 停止清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // 关闭所有存储
    for (const store of this.stores.values()) {
      await store.close();
    }

    // 保存审计日志
    if (this.config.enableAudit && this.config.auditLogPath) {
      await this.saveAuditLog();
    }
  }

  // ============ 私有方法 ============

  private logAudit(
    operation: AuditLogEntry['operation'],
    key: string,
    category: StateCategory,
    success: boolean,
    latency: number,
    metadata?: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: Date.now(),
      operation,
      key,
      category,
      success,
      latency,
      metadata,
    });

    // 限制日志大小
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  private getCheckpointPath(checkpointId: string): string {
    return path.join(
      this.config.workspaceRoot,
      '.state',
      'checkpoints',
      `${checkpointId}.json`
    );
  }

  private async loadCheckpointIndex(): Promise<void> {
    const checkpointDir = path.join(
      this.config.workspaceRoot,
      '.state',
      'checkpoints'
    );

    try {
      const files = await fs.promises.readdir(checkpointDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.promises.readFile(
            path.join(checkpointDir, file),
            'utf-8'
          );
          const checkpoint: Checkpoint = JSON.parse(content);
          this.checkpoints.set(checkpoint.id, checkpoint);
        }
      }
    } catch (error) {
      // 目录不存在，忽略
    }
  }

  private async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const checkpointDir = path.join(
      this.config.workspaceRoot,
      '.state',
      'checkpoints'
    );
    await fs.promises.mkdir(checkpointDir, { recursive: true });
    
    const checkpointPath = this.getCheckpointPath(checkpoint.id);
    await fs.promises.writeFile(
      checkpointPath,
      JSON.stringify(checkpoint, null, 2),
      'utf-8'
    );
  }

  private async saveAuditLog(): Promise<void> {
    if (!this.config.auditLogPath) return;
    
    await fs.promises.writeFile(
      this.config.auditLogPath,
      JSON.stringify(this.auditLog, null, 2),
      'utf-8'
    );
  }
}

// ============ 导出 ============

export { StateCategory, StateEntry, StateLifecycle, Checkpoint, StateStats };
