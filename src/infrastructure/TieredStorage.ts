/**
 * 智能存储分层系统
 * 
 * 职责：
 * - 热数据：内存缓存，快速访问
 * - 温数据：LRU 缓存，自动淘汰
 * - 冷数据：SQLite 持久化，长期存储
 * - 自动迁移：根据访问频率自动分层
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

export type StorageTier = "hot" | "warm" | "cold";

export interface StorageItem<T> {
  key: string;
  value: T;
  tier: StorageTier;
  accessCount: number;
  lastAccess: Date;
  createdAt: Date;
  size: number;
}

export interface StorageConfig {
  hotMaxSize: number;      // 热数据最大条目数
  warmMaxSize: number;     // 温数据最大条目数
  coldDbPath: string;      // 冷数据数据库路径
  migrationThreshold: number; // 迁移阈值（访问次数）
  autoMigrate: boolean;    // 自动迁移
}

export interface StorageStats {
  hotCount: number;
  warmCount: number;
  coldCount: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
}

// ============================================================
// LRU 缓存
// ============================================================

class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 移到末尾（最近使用）
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的（第一个）
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  entries(): Array<[K, V]> {
    return Array.from(this.cache.entries());
  }
}

// ============================================================
// 热数据存储（内存）
// ============================================================

class HotStorage<T> {
  private data: Map<string, StorageItem<T>> = new Map();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  set(key: string, value: T, size: number = 0): StorageItem<T> {
    // 如果超过最大值，淘汰最旧的
    if (this.data.size >= this.maxSize) {
      const oldest = this.findOldest();
      if (oldest) {
        this.data.delete(oldest);
      }
    }

    const item: StorageItem<T> = {
      key,
      value,
      tier: "hot",
      accessCount: 1,
      lastAccess: new Date(),
      createdAt: new Date(),
      size,
    };

    this.data.set(key, item);
    return item;
  }

  get(key: string): StorageItem<T> | undefined {
    const item = this.data.get(key);
    if (item) {
      item.accessCount++;
      item.lastAccess = new Date();
    }
    return item;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  size(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }

  entries(): Array<[string, StorageItem<T>]> {
    return Array.from(this.data.entries());
  }

  private findOldest(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.data) {
      if (item.lastAccess.getTime() < oldestTime) {
        oldestTime = item.lastAccess.getTime();
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

// ============================================================
// 温数据存储（LRU 缓存）
// ============================================================

class WarmStorage<T> {
  private cache: LRUCache<string, StorageItem<T>>;

  constructor(maxSize: number) {
    this.cache = new LRUCache(maxSize);
  }

  set(key: string, value: T, size: number = 0): StorageItem<T> {
    const item: StorageItem<T> = {
      key,
      value,
      tier: "warm",
      accessCount: 1,
      lastAccess: new Date(),
      createdAt: new Date(),
      size,
    };

    this.cache.set(key, item);
    return item;
  }

  get(key: string): StorageItem<T> | undefined {
    const item = this.cache.get(key);
    if (item) {
      item.accessCount++;
      item.lastAccess = new Date();
    }
    return item;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size();
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  entries(): Array<[string, StorageItem<T>]> {
    return this.cache.entries();
  }
}

// ============================================================
// 冷数据存储（模拟 SQLite）
// ============================================================

class ColdStorage<T> {
  private dbPath: string;
  private data: Map<string, StorageItem<T>> = new Map();
  private initialized: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.init();
  }

  private init(): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 尝试加载现有数据
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, "utf-8");
        const parsed = JSON.parse(content);
        for (const [key, item] of Object.entries(parsed)) {
          this.data.set(key, item as StorageItem<T>);
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error("[ColdStorage] 初始化失败:", error);
      this.initialized = false;
    }
  }

  private persist(): void {
    if (!this.initialized) return;

    try {
      const obj: Record<string, StorageItem<T>> = {};
      for (const [key, item] of this.data) {
        obj[key] = item;
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(obj));
    } catch (error) {
      console.error("[ColdStorage] 持久化失败:", error);
    }
  }

  set(key: string, value: T, size: number = 0): StorageItem<T> {
    const item: StorageItem<T> = {
      key,
      value,
      tier: "cold",
      accessCount: 1,
      lastAccess: new Date(),
      createdAt: new Date(),
      size,
    };

    this.data.set(key, item);
    this.persist();
    return item;
  }

  get(key: string): StorageItem<T> | undefined {
    const item = this.data.get(key);
    if (item) {
      item.accessCount++;
      item.lastAccess = new Date();
    }
    return item;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    const result = this.data.delete(key);
    if (result) {
      this.persist();
    }
    return result;
  }

  size(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
    this.persist();
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }
}

// ============================================================
// 智能存储分层系统
// ============================================================

export class TieredStorage<T> {
  private hot: HotStorage<T>;
  private warm: WarmStorage<T>;
  private cold: ColdStorage<T>;
  private config: StorageConfig;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      hotMaxSize: config.hotMaxSize ?? 1000,
      warmMaxSize: config.warmMaxSize ?? 5000,
      coldDbPath: config.coldDbPath ?? path.join(process.cwd(), "data", "cold-storage.json"),
      migrationThreshold: config.migrationThreshold ?? 5,
      autoMigrate: config.autoMigrate ?? true,
    };

    this.hot = new HotStorage(this.config.hotMaxSize);
    this.warm = new WarmStorage(this.config.warmMaxSize);
    this.cold = new ColdStorage(this.config.coldDbPath);
  }

  /**
   * 设置数据
   */
  set(key: string, value: T, size: number = 0): void {
    // 新数据默认放入热存储
    this.hot.set(key, value, size);
  }

  /**
   * 获取数据
   */
  get(key: string): T | undefined {
    // 1. 先查热存储
    let item = this.hot.get(key);
    if (item) {
      this.hits++;
      return item.value;
    }

    // 2. 查温存储
    item = this.warm.get(key);
    if (item) {
      this.hits++;
      // 如果访问次数超过阈值，提升到热存储
      if (this.config.autoMigrate && item.accessCount >= this.config.migrationThreshold) {
        this.warm.delete(key);
        this.hot.set(key, item.value, item.size);
      }
      return item.value;
    }

    // 3. 查冷存储
    item = this.cold.get(key);
    if (item) {
      this.hits++;
      // 冷数据被访问，提升到温存储
      if (this.config.autoMigrate) {
        this.cold.delete(key);
        this.warm.set(key, item.value, item.size);
      }
      return item.value;
    }

    this.misses++;
    return undefined;
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    return this.hot.has(key) || this.warm.has(key) || this.cold.has(key);
  }

  /**
   * 删除数据
   */
  delete(key: string): boolean {
    return this.hot.delete(key) || this.warm.delete(key) || this.cold.delete(key);
  }

  /**
   * 获取存储层级
   */
  getTier(key: string): StorageTier | null {
    if (this.hot.has(key)) return "hot";
    if (this.warm.has(key)) return "warm";
    if (this.cold.has(key)) return "cold";
    return null;
  }

  /**
   * 手动迁移到指定层级
   */
  migrate(key: string, targetTier: StorageTier): boolean {
    // 找到数据
    let item: StorageItem<T> | undefined;
    let sourceTier: StorageTier | null = null;

    if (this.hot.has(key)) {
      item = this.hot.get(key);
      sourceTier = "hot";
    } else if (this.warm.has(key)) {
      item = this.warm.get(key);
      sourceTier = "warm";
    } else if (this.cold.has(key)) {
      item = this.cold.get(key);
      sourceTier = "cold";
    }

    if (!item || sourceTier === targetTier) {
      return false;
    }

    // 从源层级删除
    switch (sourceTier) {
      case "hot":
        this.hot.delete(key);
        break;
      case "warm":
        this.warm.delete(key);
        break;
      case "cold":
        this.cold.delete(key);
        break;
    }

    // 添加到目标层级
    switch (targetTier) {
      case "hot":
        this.hot.set(key, item.value, item.size);
        break;
      case "warm":
        this.warm.set(key, item.value, item.size);
        break;
      case "cold":
        this.cold.set(key, item.value, item.size);
        break;
    }

    return true;
  }

  /**
   * 获取统计信息
   */
  getStats(): StorageStats {
    const total = this.hits + this.misses;
    return {
      hotCount: this.hot.size(),
      warmCount: this.warm.size(),
      coldCount: this.cold.size(),
      totalSize: this.hot.size() + this.warm.size() + this.cold.size(),
      hitRate: total > 0 ? this.hits / total : 0,
      missRate: total > 0 ? this.misses / total : 0,
    };
  }

  /**
   * 清空所有存储
   */
  clear(): void {
    this.hot.clear();
    this.warm.clear();
    this.cold.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return [
      ...this.hot.keys(),
      ...this.warm.keys(),
      ...this.cold.keys(),
    ];
  }

  /**
   * 获取配置
   */
  getConfig(): StorageConfig {
    return { ...this.config };
  }
}

// ============================================================
// 单例导出
// ============================================================

let tieredStorageInstance: TieredStorage<unknown> | null = null;

export function getTieredStorage<T>(config?: Partial<StorageConfig>): TieredStorage<T> {
  if (!tieredStorageInstance) {
    tieredStorageInstance = new TieredStorage<unknown>(config);
  }
  return tieredStorageInstance as TieredStorage<T>;
}
