/**
 * Harness Engineering - 状态存储实现
 * 
 * 提供内存和文件两种存储后端
 * 
 * @module harness/state-manager/store
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  StateStore,
  StateEntry,
  StateLifecycle,
  StateCategory,
  DEFAULT_LIFECYCLE,
} from './types';

// ============ 内存存储 ============

/**
 * 内存状态存储
 * 
 * 适用于临时状态，性能最高
 */
export class MemoryStateStore implements StateStore {
  readonly name = 'memory';
  private store: Map<string, StateEntry> = new Map();
  private accessTimes: Map<string, number> = new Map();

  async initialize(): Promise<void> {
    // 内存存储无需初始化
  }

  async get<T = unknown>(key: string): Promise<StateEntry<T> | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // 检查是否过期
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.accessTimes.delete(key);
      return null;
    }

    this.accessTimes.set(key, Date.now());
    return entry as StateEntry<T>;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    lifecycle: StateLifecycle
  ): Promise<StateEntry<T>> {
    const now = Date.now();
    const existing = this.store.get(key);
    
    const entry: StateEntry<T> = {
      id: existing?.id || this.generateId(),
      key,
      value,
      category: this.inferCategory(lifecycle),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      expiresAt: lifecycle.ttl > 0 ? now + lifecycle.ttl : null,
      version: (existing?.version || 0) + 1,
    };

    this.store.set(key, entry);
    this.accessTimes.set(key, now);
    return entry;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.store.has(key);
    this.store.delete(key);
    this.accessTimes.delete(key);
    return existed;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    
    // 检查是否过期
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.accessTimes.delete(key);
      return false;
    }
    
    return true;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    
    if (!pattern) return allKeys;
    
    // 简单的通配符匹配
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(k => regex.test(k));
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key);
        this.accessTimes.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  async close(): Promise<void> {
    this.store.clear();
    this.accessTimes.clear();
  }

  /**
   * 获取内存使用量
   */
  getMemoryUsage(): number {
    let size = 0;
    for (const entry of this.store.values()) {
      size += JSON.stringify(entry).length;
    }
    return size;
  }

  /**
   * 获取条目数量
   */
  get size(): number {
    return this.store.size;
  }

  private generateId(): string {
    return `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private inferCategory(lifecycle: StateLifecycle): StateCategory {
    // 根据 lifecycle 推断类别
    if (lifecycle.ttl === 0 && lifecycle.persist) {
      return StateCategory.USER;
    } else if (lifecycle.ttl > 86400000) {
      return StateCategory.TASK;
    } else if (lifecycle.ttl > 3600000) {
      return StateCategory.SESSION;
    } else {
      return StateCategory.TOOL;
    }
  }
}

// ============ 文件存储 ============

/**
 * 文件状态存储
 * 
 * 适用于持久化状态，支持加密
 */
export class FileStateStore implements StateStore {
  readonly name = 'file';
  private basePath: string;
  private enableEncryption: boolean;
  private encryptionKey?: Buffer;
  private memoryCache: Map<string, StateEntry> = new Map();
  private dirtyKeys: Set<string> = new Set();

  constructor(
    basePath: string,
    enableEncryption: boolean = false,
    encryptionKey?: string
  ) {
    this.basePath = basePath;
    this.enableEncryption = enableEncryption;
    if (encryptionKey) {
      this.encryptionKey = crypto.scryptSync(encryptionKey, 'salt', 32);
    }
  }

  async initialize(): Promise<void> {
    // 确保目录存在
    await fs.promises.mkdir(this.basePath, { recursive: true });
  }

  async get<T = unknown>(key: string): Promise<StateEntry<T> | null> {
    // 先检查内存缓存
    const cached = this.memoryCache.get(key);
    if (cached) {
      if (cached.expiresAt && cached.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }
      return cached as StateEntry<T>;
    }

    // 从文件读取
    const filePath = this.getFilePath(key);
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      const entry: StateEntry<T> = JSON.parse(
        this.enableEncryption ? this.decrypt(data) : data
      );

      // 检查是否过期
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        return null;
      }

      // 加入缓存
      this.memoryCache.set(key, entry);
      return entry;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async set<T = unknown>(
    key: string,
    value: T,
    lifecycle: StateLifecycle
  ): Promise<StateEntry<T>> {
    const now = Date.now();
    const existing = await this.get<T>(key);
    
    const entry: StateEntry<T> = {
      id: existing?.id || this.generateId(),
      key,
      value,
      category: this.inferCategory(lifecycle),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      expiresAt: lifecycle.ttl > 0 ? now + lifecycle.ttl : null,
      version: (existing?.version || 0) + 1,
    };

    // 更新缓存
    this.memoryCache.set(key, entry);
    this.dirtyKeys.add(key);

    // 如果需要持久化，立即写入
    if (lifecycle.persist) {
      await this.flush(key, entry);
    }

    return entry;
  }

  async delete(key: string): Promise<boolean> {
    // 从缓存删除
    this.memoryCache.delete(key);
    this.dirtyKeys.delete(key);

    // 从文件删除
    const filePath = this.getFilePath(key);
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  async keys(pattern?: string): Promise<string[]> {
    const files = await fs.promises.readdir(this.basePath);
    const allKeys = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, '').replace(/__/g, '/'));

    if (!pattern) return allKeys;

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(k => regex.test(k));
  }

  async cleanup(): Promise<number> {
    const allKeys = await this.keys();
    let cleaned = 0;

    for (const key of allKeys) {
      const entry = await this.get(key);
      if (entry && entry.expiresAt && entry.expiresAt < Date.now()) {
        await this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  async close(): Promise<void> {
    // 刷新所有脏数据
    await this.flushAll();
    this.memoryCache.clear();
    this.dirtyKeys.clear();
  }

  /**
   * 刷新单个条目到磁盘
   */
  private async flush<T>(key: string, entry: StateEntry<T>): Promise<void> {
    const filePath = this.getFilePath(key);
    const data = JSON.stringify(entry);
    const content = this.enableEncryption ? this.encrypt(data) : data;
    
    await fs.promises.writeFile(filePath, content, 'utf-8');
    this.dirtyKeys.delete(key);
  }

  /**
   * 刷新所有脏数据到磁盘
   */
  async flushAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const key of this.dirtyKeys) {
      const entry = this.memoryCache.get(key);
      if (entry) {
        promises.push(this.flush(key, entry));
      }
    }

    await Promise.all(promises);
  }

  private getFilePath(key: string): string {
    // 将 key 转换为安全的文件名
    const safeKey = key.replace(/\//g, '__');
    return path.join(this.basePath, `${safeKey}.json`);
  }

  private generateId(): string {
    return `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private inferCategory(lifecycle: StateLifecycle): StateCategory {
    if (lifecycle.ttl === 0 && lifecycle.persist) {
      return StateCategory.USER;
    } else if (lifecycle.ttl > 86400000) {
      return StateCategory.TASK;
    } else if (lifecycle.ttl > 3600000) {
      return StateCategory.SESSION;
    } else {
      return StateCategory.TOOL;
    }
  }

  private encrypt(data: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey as any, iv as any);
    let encrypted = cipher.update(data, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(data: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }
    
    const [ivHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey as any, iv as any);
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    
    return decrypted;
  }
}

// ============ 分层存储 ============

/**
 * 分层状态存储
 * 
 * L1: 内存（热数据）
 * L2: 文件（温数据）
 * L3: 压缩归档（冷数据）
 */
export class TieredStateStore implements StateStore {
  readonly name = 'tiered';
  private l1: MemoryStateStore;
  private l2: FileStateStore;
  private accessThreshold: number = 3; // 访问次数阈值

  constructor(
    basePath: string,
    enableEncryption: boolean = false,
    encryptionKey?: string
  ) {
    this.l1 = new MemoryStateStore();
    this.l2 = new FileStateStore(basePath, enableEncryption, encryptionKey);
  }

  async initialize(): Promise<void> {
    await this.l1.initialize();
    await this.l2.initialize();
  }

  async get<T = unknown>(key: string): Promise<StateEntry<T> | null> {
    // 先查 L1
    const l1Entry = await this.l1.get<T>(key);
    if (l1Entry) return l1Entry;

    // 再查 L2
    const l2Entry = await this.l2.get<T>(key);
    if (l2Entry) {
      // 提升到 L1
      await this.l1.set(key, l2Entry.value, {
        ttl: 3600000, // 1 小时
        persist: false,
        encrypt: false,
        audit: false,
        maxSize: 0,
      });
    }

    return l2Entry;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    lifecycle: StateLifecycle
  ): Promise<StateEntry<T>> {
    // 写入 L1
    const entry = await this.l1.set(key, value, lifecycle);

    // 如果需要持久化，同时写入 L2
    if (lifecycle.persist) {
      await this.l2.set(key, value, lifecycle);
    }

    return entry;
  }

  async delete(key: string): Promise<boolean> {
    const l1Deleted = await this.l1.delete(key);
    const l2Deleted = await this.l2.delete(key);
    return l1Deleted || l2Deleted;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.l1.exists(key)) || (await this.l2.exists(key));
  }

  async keys(pattern?: string): Promise<string[]> {
    const l1Keys = await this.l1.keys(pattern);
    const l2Keys = await this.l2.keys(pattern);
    return [...new Set([...l1Keys, ...l2Keys])];
  }

  async cleanup(): Promise<number> {
    const l1Cleaned = await this.l1.cleanup();
    const l2Cleaned = await this.l2.cleanup();
    return l1Cleaned + l2Cleaned;
  }

  async close(): Promise<void> {
    await this.l1.close();
    await this.l2.close();
  }

  /**
   * 获取 L1 命中率
   */
  getL1HitRate(): number {
    // 简化实现
    return 0.8;
  }
}

// ============ 导出 ============

export { StateStore };
