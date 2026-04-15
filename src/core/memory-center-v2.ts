/**
 * 记忆中心 v2 - 统一记忆管理
 * 
 * 基于可插拔后端架构，支持：
 * - TencentDBBackend: 生产环境
 * - InMemoryBackend: 测试环境
 * 
 * 功能：
 * - 多类型记忆存储（episodic, semantic, procedural, preference）
 * - 混合搜索（关键词 + 语义）
 * - 用户画像管理
 * - 场景记忆管理
 * - 智能压缩与过期
 */

import * as crypto from "crypto";
import type {
  MemoryBackend,
  Memory,
  Persona,
  SceneBlock,
  SearchResult,
  SearchOptions,
  StoreOptions,
  BackendStats,
} from "./memory-backend";
import { BackendFactory, InMemoryBackend } from "./memory-backend";
import type { BackendType, BackendConfig } from "./memory-backend";

// ============================================================
// 类型定义
// ============================================================

export type { MemoryType, MemoryPriority } from "./memory-backend.js";

export interface MemoryCenterConfig {
  backendType: BackendType;
  backendConfig?: Partial<BackendConfig>;
  autoCompress?: boolean;
  compressionThreshold?: number;
  maxShortTerm?: number;
  maxLongTerm?: number;
}

export interface RememberOptions {
  type?: Memory["type"];
  priority?: Memory["priority"];
  importance?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  generateEmbedding?: boolean;
}

export interface RecallOptions extends SearchOptions {
  strategy?: "keyword" | "semantic" | "hybrid";
  includePersona?: boolean;
  includeScene?: boolean;
}

export interface RecallResult {
  memories: SearchResult[];
  persona?: Persona | null;
  sceneBlocks?: SceneBlock[];
  strategy: string;
  durationMs: number;
}

// ============================================================
// MemoryCenter v2 实现
// ============================================================

export class MemoryCenter {
  private backend: MemoryBackend;
  private config: Required<MemoryCenterConfig>;
  private shortTermCache: Map<string, Memory> = new Map();
  private initialized: boolean = false;
  
  constructor(config?: Partial<MemoryCenterConfig>) {
    this.config = {
      backendType: config?.backendType || "memory",
      backendConfig: config?.backendConfig || {},
      autoCompress: config?.autoCompress ?? true,
      compressionThreshold: config?.compressionThreshold || 0.7,
      maxShortTerm: config?.maxShortTerm || 100,
      maxLongTerm: config?.maxLongTerm || 1000,
    };
    
    // 默认使用内存后端
    this.backend = new InMemoryBackend();
  }
  
  // ============================================================
  // 初始化
  // ============================================================
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // 创建配置的后端
    const fullConfig: BackendConfig = {
      type: this.config.backendType,
      ...this.config.backendConfig,
    };
    
    this.backend = await BackendFactory.create(fullConfig);
    this.initialized = true;
  }
  
  async close(): Promise<void> {
    await this.backend.close();
    this.initialized = false;
  }
  
  // ============================================================
  // 核心操作
  // ============================================================
  
  /**
   * 记住一条信息
   */
  async remember(
    content: string,
    options?: RememberOptions
  ): Promise<Memory> {
    await this.ensureInitialized();
    
    const memory: Memory = {
      id: this.generateId(),
      type: options?.type || "episodic",
      content,
      priority: options?.priority || "normal",
      importance: options?.importance ?? this.calculateImportance(content),
      tags: options?.tags || [],
      metadata: options?.metadata || {},
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      expiresAt: options?.expiresAt,
    };
    
    // 存储到后端
    await this.backend.store(memory, {
      generateEmbedding: options?.generateEmbedding,
    });
    
    // 更新短期缓存
    this.shortTermCache.set(memory.id, memory);
    
    // 检查是否需要压缩
    if (this.config.autoCompress && this.shortTermCache.size > this.config.maxShortTerm) {
      await this.compress();
    }
    
    return memory;
  }
  
  /**
   * 回忆相关信息
   */
  async recall(query: string, options?: RecallOptions): Promise<RecallResult> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    const strategy = options?.strategy || "hybrid";
    
    // 执行搜索
    let memories: SearchResult[];
    
    switch (strategy) {
      case "keyword":
        memories = await this.backend.search(query, options);
        break;
      case "semantic":
        memories = await this.backend.vectorSearch(query, options);
        break;
      case "hybrid":
      default:
        memories = await this.backend.hybridSearch(query, options);
        break;
    }
    
    // 更新访问计数
    for (const result of memories) {
      result.memory.accessCount++;
      result.memory.lastAccessed = new Date();
    }
    
    // 可选：包含用户画像
    let persona: Persona | null = null;
    if (options?.includePersona) {
      persona = await this.backend.getPersona();
    }
    
    // 可选：包含场景记忆
    let sceneBlocks: SceneBlock[] = [];
    if (options?.includeScene) {
      sceneBlocks = await this.backend.getSceneBlocks();
    }
    
    return {
      memories,
      persona,
      sceneBlocks,
      strategy,
      durationMs: Date.now() - startTime,
    };
  }
  
  /**
   * 遗忘一条记忆
   */
  async forget(memoryId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    this.shortTermCache.delete(memoryId);
    return this.backend.delete(memoryId);
  }
  
  /**
   * 更新一条记忆
   */
  async update(memoryId: string, updates: Partial<Memory>): Promise<void> {
    await this.ensureInitialized();
    
    await this.backend.update(memoryId, updates);
    
    // 更新缓存
    const cached = this.shortTermCache.get(memoryId);
    if (cached) {
      this.shortTermCache.set(memoryId, { ...cached, ...updates });
    }
  }
  
  // ============================================================
  // 用户画像
  // ============================================================
  
  /**
   * 获取用户画像
   */
  async getPersona(): Promise<Persona | null> {
    await this.ensureInitialized();
    return this.backend.getPersona();
  }
  
  /**
   * 更新用户画像
   */
  async updatePersona(updates: Partial<Persona>): Promise<void> {
    await this.ensureInitialized();
    return this.backend.updatePersona(updates);
  }
  
  /**
   * 生成用户画像
   */
  async generatePersona(): Promise<Persona> {
    await this.ensureInitialized();
    return this.backend.generatePersona();
  }
  
  // ============================================================
  // 场景记忆
  // ============================================================
  
  /**
   * 获取场景块
   */
  async getSceneBlocks(sceneName?: string): Promise<SceneBlock[]> {
    await this.ensureInitialized();
    return this.backend.getSceneBlocks(sceneName);
  }
  
  /**
   * 创建场景块
   */
  async createSceneBlock(
    name: string,
    summary: string,
    events: SceneBlock["events"] = [],
    insights: string[] = []
  ): Promise<SceneBlock> {
    await this.ensureInitialized();
    return this.backend.createSceneBlock({ name, summary, events, insights });
  }
  
  // ============================================================
  // 批量操作
  // ============================================================
  
  /**
   * 批量记住
   */
  async rememberBatch(items: Array<{ content: string; options?: RememberOptions }>): Promise<Memory[]> {
    const memories: Memory[] = [];
    
    for (const item of items) {
      const memory = await this.remember(item.content, item.options);
      memories.push(memory);
    }
    
    return memories;
  }
  
  /**
   * 批量回忆
   */
  async recallBatch(queries: string[], options?: RecallOptions): Promise<RecallResult[]> {
    return Promise.all(queries.map(q => this.recall(q, options)));
  }
  
  // ============================================================
  // 维护操作
  // ============================================================
  
  /**
   * 压缩记忆
   */
  async compress(): Promise<void> {
    await this.ensureInitialized();
    
    // 清理短期缓存
    if (this.shortTermCache.size > this.config.maxShortTerm) {
      const entries = Array.from(this.shortTermCache.entries());
      entries.sort((a, b) => a[1].importance - b[1].importance);
      
      const toRemove = this.shortTermCache.size - this.config.maxShortTerm;
      for (let i = 0; i < toRemove; i++) {
        this.shortTermCache.delete(entries[i][0]);
      }
    }
    
    // 清理后端过期记忆
    await this.backend.vacuum();
  }
  
  /**
   * 获取统计信息
   */
  async getStats(): Promise<BackendStats> {
    await this.ensureInitialized();
    return this.backend.getStats();
  }
  
  /**
   * 备份
   */
  async backup(targetPath: string): Promise<void> {
    await this.ensureInitialized();
    return this.backend.backup(targetPath);
  }
  
  /**
   * 恢复
   */
  async restore(sourcePath: string): Promise<void> {
    await this.ensureInitialized();
    return this.backend.restore(sourcePath);
  }
  
  // ============================================================
  // 后端管理
  // ============================================================
  
  /**
   * 切换后端
   */
  async setBackend(type: BackendType, config?: Partial<BackendConfig>): Promise<void> {
    // 关闭当前后端
    await this.backend.close();
    
    // 创建新后端
    const fullConfig: BackendConfig = {
      type,
      ...config,
    };
    
    this.backend = await BackendFactory.create(fullConfig);
    this.config.backendType = type;
  }
  
  /**
   * 获取当前后端
   */
  getBackend(): MemoryBackend {
    return this.backend;
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
  
  private generateId(): string {
    return `mem-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  }
  
  private calculateImportance(content: string): number {
    // 基于内容特征计算重要性
    let importance = 0.5;
    
    // 长度因素
    if (content.length > 500) importance += 0.1;
    if (content.length > 1000) importance += 0.1;
    
    // 关键词因素
    const importantKeywords = ["重要", "关键", "必须", "记住", "不要忘记", "important", "critical", "must"];
    for (const keyword of importantKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        importance += 0.1;
        break;
      }
    }
    
    // 问题因素
    if (content.includes("?") || content.includes("？")) {
      importance += 0.05;
    }
    
    return Math.min(importance, 1);
  }
}

// ============================================================
// 便捷导出
// ============================================================

// 类型已在上层 index.ts 中导出，这里不再重复导出
