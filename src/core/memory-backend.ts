/**
 * 记忆后端抽象层
 * 
 * 定义元灵系统记忆存储的统一接口，支持多种后端实现：
 * - TencentDBBackend: 生产环境，使用 memory-tencentdb
 * - InMemoryBackend: 测试环境，内存存储
 * - FileBackend: 文件存储（备用）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================
// 类型定义
// ============================================================

export type MemoryType = "episodic" | "semantic" | "procedural" | "preference";
export type MemoryPriority = "low" | "normal" | "high" | "critical";

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  priority: MemoryPriority;
  importance: number;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  expiresAt?: Date;
}

export interface Persona {
  id: string;
  content: string;
  traits: Array<{ name: string; value: string; confidence: number }>;
  preferences: Array<{ key: string; value: any; source: string }>;
  updatedAt: Date;
  version: number;
}

export interface SceneBlock {
  id: string;
  name: string;
  summary: string;
  events: Array<{
    timestamp: Date;
    type: string;
    description: string;
    participants: string[];
  }>;
  insights: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  memory: Memory;
  score: number;
  matchType: "keyword" | "semantic" | "hybrid";
  highlights?: string[];
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  types?: MemoryType[];
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  includeExpired?: boolean;
}

export interface StoreOptions {
  generateEmbedding?: boolean;
  extractEntities?: boolean;
  linkToRelated?: boolean;
}

// ============================================================
// MemoryBackend 抽象接口
// ============================================================

export interface MemoryBackend {
  // 基础 CRUD
  store(memory: Memory, options?: StoreOptions): Promise<void>;
  get(id: string): Promise<Memory | null>;
  update(id: string, updates: Partial<Memory>): Promise<void>;
  delete(id: string): Promise<boolean>;
  
  // 搜索
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  vectorSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  hybridSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // 批量操作
  storeBatch(memories: Memory[]): Promise<void>;
  searchBatch(queries: string[]): Promise<SearchResult[][]>;
  
  // 用户画像
  getPersona(): Promise<Persona | null>;
  updatePersona(updates: Partial<Persona>): Promise<void>;
  generatePersona(): Promise<Persona>;
  
  // 场景记忆
  getSceneBlocks(sceneName?: string): Promise<SceneBlock[]>;
  getSceneBlock(id: string): Promise<SceneBlock | null>;
  createSceneBlock(block: Omit<SceneBlock, "id" | "createdAt" | "updatedAt">): Promise<SceneBlock>;
  updateSceneBlock(id: string, updates: Partial<SceneBlock>): Promise<void>;
  
  // 统计与维护
  getStats(): Promise<BackendStats>;
  vacuum(): Promise<void>;
  backup(targetPath: string): Promise<void>;
  restore(sourcePath: string): Promise<void>;
  
  // 生命周期
  initialize(): Promise<void>;
  close(): Promise<void>;
  
  // 元信息
  readonly name: string;
  readonly type: string;
  readonly isReady: boolean;
}

export interface BackendStats {
  totalMemories: number;
  memoriesByType: Record<MemoryType, number>;
  totalSize: number;
  oldestMemory?: Date;
  newestMemory?: Date;
  avgAccessCount: number;
  embeddingCoverage: number;
  personaVersion?: number;
  sceneBlockCount: number;
}

// ============================================================
// InMemoryBackend - 内存后端（测试用）
// ============================================================

export class InMemoryBackend implements MemoryBackend {
  private memories: Map<string, Memory> = new Map();
  private persona: Persona | null = null;
  private sceneBlocks: Map<string, SceneBlock> = new Map();
  private _isReady: boolean = false;
  
  readonly name = "InMemoryBackend";
  readonly type = "memory";
  
  get isReady() { return this._isReady; }
  
  async initialize(): Promise<void> {
    this._isReady = true;
  }
  
  async close(): Promise<void> {
    this._isReady = false;
  }
  
  async store(memory: Memory, options?: StoreOptions): Promise<void> {
    this.memories.set(memory.id, { ...memory });
  }
  
  async get(id: string): Promise<Memory | null> {
    return this.memories.get(id) || null;
  }
  
  async update(id: string, updates: Partial<Memory>): Promise<void> {
    const memory = this.memories.get(id);
    if (memory) {
      this.memories.set(id, { ...memory, ...updates });
    }
  }
  
  async delete(id: string): Promise<boolean> {
    return this.memories.delete(id);
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const limit = options?.limit || 10;
    
    for (const memory of this.memories.values()) {
      if (memory.content.toLowerCase().includes(queryLower)) {
        results.push({
          memory,
          score: 0.5,
          matchType: "keyword",
        });
      }
    }
    
    return results.slice(0, limit);
  }
  
  async vectorSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // 内存后端不支持向量搜索，返回空
    return [];
  }
  
  async hybridSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.search(query, options);
  }
  
  async storeBatch(memories: Memory[]): Promise<void> {
    for (const memory of memories) {
      await this.store(memory);
    }
  }
  
  async searchBatch(queries: string[]): Promise<SearchResult[][]> {
    return Promise.all(queries.map(q => this.search(q)));
  }
  
  async getPersona(): Promise<Persona | null> {
    return this.persona;
  }
  
  async updatePersona(updates: Partial<Persona>): Promise<void> {
    if (this.persona) {
      this.persona = { ...this.persona, ...updates, updatedAt: new Date() };
    }
  }
  
  async generatePersona(): Promise<Persona> {
    this.persona = {
      id: `persona-${Date.now()}`,
      content: "自动生成的用户画像",
      traits: [],
      preferences: [],
      updatedAt: new Date(),
      version: 1,
    };
    return this.persona;
  }
  
  async getSceneBlocks(sceneName?: string): Promise<SceneBlock[]> {
    const blocks = Array.from(this.sceneBlocks.values());
    if (sceneName) {
      return blocks.filter(b => b.name === sceneName);
    }
    return blocks;
  }
  
  async getSceneBlock(id: string): Promise<SceneBlock | null> {
    return this.sceneBlocks.get(id) || null;
  }
  
  async createSceneBlock(block: Omit<SceneBlock, "id" | "createdAt" | "updatedAt">): Promise<SceneBlock> {
    const newBlock: SceneBlock = {
      ...block,
      id: `scene-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sceneBlocks.set(newBlock.id, newBlock);
    return newBlock;
  }
  
  async updateSceneBlock(id: string, updates: Partial<SceneBlock>): Promise<void> {
    const block = this.sceneBlocks.get(id);
    if (block) {
      this.sceneBlocks.set(id, { ...block, ...updates, updatedAt: new Date() });
    }
  }
  
  async getStats(): Promise<BackendStats> {
    const memoriesByType: Record<MemoryType, number> = {
      episodic: 0,
      semantic: 0,
      procedural: 0,
      preference: 0,
    };
    
    let totalAccess = 0;
    let withEmbedding = 0;
    
    for (const memory of this.memories.values()) {
      memoriesByType[memory.type]++;
      totalAccess += memory.accessCount;
      if (memory.embedding) withEmbedding++;
    }
    
    return {
      totalMemories: this.memories.size,
      memoriesByType,
      totalSize: 0,
      avgAccessCount: this.memories.size > 0 ? totalAccess / this.memories.size : 0,
      embeddingCoverage: this.memories.size > 0 ? withEmbedding / this.memories.size : 0,
      personaVersion: this.persona?.version,
      sceneBlockCount: this.sceneBlocks.size,
    };
  }
  
  async vacuum(): Promise<void> {
    // 清理过期记忆
    const now = new Date();
    for (const [id, memory] of this.memories) {
      if (memory.expiresAt && memory.expiresAt < now) {
        this.memories.delete(id);
      }
    }
  }
  
  async backup(targetPath: string): Promise<void> {
    // 内存后端不支持备份
  }
  
  async restore(sourcePath: string): Promise<void> {
    // 内存后端不支持恢复
  }
}

// ============================================================
// BackendFactory - 后端工厂
// ============================================================

export type BackendType = "tencentdb" | "memory" | "file";

export interface BackendConfig {
  type: BackendType;
  dataDir?: string;
  embedding?: {
    enabled: boolean;
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    dimensions?: number;
  };
}

export class BackendFactory {
  static async create(config: BackendConfig): Promise<MemoryBackend> {
    switch (config.type) {
      case "memory":
        const backend = new InMemoryBackend();
        await backend.initialize();
        return backend;
        
      case "tencentdb":
        // 动态导入，避免循环依赖
        const { TencentDBBackend } = await import("./tencentdb-backend");
        const tdaiBackend = new TencentDBBackend({
          type: "tencentdb",
          dataDir: config.dataDir,
          embedding: config.embedding,
        });
        await tdaiBackend.initialize();
        return tdaiBackend;
        
      case "file":
        // 文件后端实现
        const fileBackend = new FileBackend({
          type: "file",
          dataDir: config.dataDir || path.join(os.homedir(), ".openclaw/memory-file"),
        });
        await fileBackend.initialize();
        return fileBackend;
        
      default:
        throw new Error(`Unknown backend type: ${(config as any).type}`);
    }
  }
}

// ============================================================
// FileBackend - 文件后端实现（简化版，仅支持基础存储）
// ============================================================

class FileBackend implements Partial<MemoryBackend> {
  private config: { type: "file"; dataDir: string };
  private initialized: boolean = false;
  
  readonly name = "FileBackend";
  readonly type = "file";
  
  get isReady() { return this.initialized; }
  
  constructor(config: { type: "file"; dataDir: string }) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }
    this.initialized = true;
  }
  
  async close(): Promise<void> {
    this.initialized = false;
  }
  
  // 基础 CRUD
  async store(memory: Memory, options?: StoreOptions): Promise<void> {
    const filePath = path.join(this.config.dataDir, `${memory.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
  }
  
  async get(id: string): Promise<Memory | null> {
    const filePath = path.join(this.config.dataDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return { ...data, createdAt: new Date(data.createdAt), lastAccessed: new Date(data.lastAccessed) };
    }
    return null;
  }
  
  async update(id: string, updates: Partial<Memory>): Promise<void> {
    const memory = await this.get(id);
    if (memory) {
      await this.store({ ...memory, ...updates });
    }
  }
  
  async delete(id: string): Promise<boolean> {
    const filePath = path.join(this.config.dataDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
  
  // 搜索（简化实现）
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const limit = options?.limit || 10;
    
    if (!fs.existsSync(this.config.dataDir)) return [];
    
    const files = fs.readdirSync(this.config.dataDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(this.config.dataDir, file), "utf-8"));
      if (data.content && data.content.toLowerCase().includes(queryLower)) {
        results.push({
          memory: { ...data, createdAt: new Date(data.createdAt), lastAccessed: new Date(data.lastAccessed) },
          score: 0.5,
          matchType: "keyword",
        });
      }
    }
    
    return results.slice(0, limit);
  }
  
  async vectorSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return []; // 文件后端不支持向量搜索
  }
  
  async hybridSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.search(query, options);
  }
  
  // 批量操作
  async storeBatch(memories: Memory[]): Promise<void> {
    for (const memory of memories) {
      await this.store(memory);
    }
  }
  
  async searchBatch(queries: string[]): Promise<SearchResult[][]> {
    return Promise.all(queries.map(q => this.search(q)));
  }
  
  // 用户画像
  async getPersona(): Promise<Persona | null> {
    return this.loadObject("persona") as Promise<Persona | null>;
  }
  
  async updatePersona(updates: Partial<Persona>): Promise<void> {
    const persona = await this.getPersona();
    if (persona) {
      await this.saveObject("persona", { ...persona, ...updates, updatedAt: new Date() });
    }
  }
  
  async generatePersona(): Promise<Persona> {
    const persona: Persona = {
      id: `persona-${Date.now()}`,
      content: "自动生成的用户画像",
      traits: [],
      preferences: [],
      updatedAt: new Date(),
      version: 1,
    };
    await this.saveObject("persona", persona);
    return persona;
  }
  
  // 场景记忆
  async getSceneBlocks(sceneName?: string): Promise<SceneBlock[]> {
    const blocks = await this.loadObject("sceneBlocks") as SceneBlock[] || [];
    if (sceneName) {
      return blocks.filter(b => b.name === sceneName);
    }
    return blocks;
  }
  
  async getSceneBlock(id: string): Promise<SceneBlock | null> {
    const blocks = await this.getSceneBlocks();
    return blocks.find(b => b.id === id) || null;
  }
  
  async createSceneBlock(block: Omit<SceneBlock, "id" | "createdAt" | "updatedAt">): Promise<SceneBlock> {
    const blocks = await this.getSceneBlocks();
    const newBlock: SceneBlock = {
      ...block,
      id: `scene-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    blocks.push(newBlock);
    await this.saveObject("sceneBlocks", blocks);
    return newBlock;
  }
  
  async updateSceneBlock(id: string, updates: Partial<SceneBlock>): Promise<void> {
    const blocks = await this.getSceneBlocks();
    const index = blocks.findIndex(b => b.id === id);
    if (index >= 0) {
      blocks[index] = { ...blocks[index], ...updates, updatedAt: new Date() };
      await this.saveObject("sceneBlocks", blocks);
    }
  }
  
  // 统计与维护
  async getStats(): Promise<BackendStats> {
    if (!fs.existsSync(this.config.dataDir)) {
      return { totalMemories: 0, memoriesByType: { episodic: 0, semantic: 0, procedural: 0, preference: 0 }, totalSize: 0, avgAccessCount: 0, embeddingCoverage: 0, sceneBlockCount: 0 };
    }
    
    const files = fs.readdirSync(this.config.dataDir).filter(f => f.endsWith(".json") && f !== "persona.json" && f !== "sceneBlocks.json");
    const memoriesByType: Record<MemoryType, number> = { episodic: 0, semantic: 0, procedural: 0, preference: 0 };
    let totalAccess = 0;
    let withEmbedding = 0;
    
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(this.config.dataDir, file), "utf-8"));
      if (data.type) memoriesByType[data.type as MemoryType]++;
      if (data.accessCount) totalAccess += data.accessCount;
      if (data.embedding) withEmbedding++;
    }
    
    return {
      totalMemories: files.length,
      memoriesByType,
      totalSize: 0,
      avgAccessCount: files.length > 0 ? totalAccess / files.length : 0,
      embeddingCoverage: files.length > 0 ? withEmbedding / files.length : 0,
      sceneBlockCount: (await this.getSceneBlocks()).length,
    };
  }
  
  async vacuum(): Promise<void> {
    // 清理过期记忆
    const now = new Date();
    const files = fs.readdirSync(this.config.dataDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(this.config.dataDir, file), "utf-8"));
      if (data.expiresAt && new Date(data.expiresAt) < now) {
        fs.unlinkSync(path.join(this.config.dataDir, file));
      }
    }
  }
  
  async backup(targetPath: string): Promise<void> {
    // 简化实现：复制目录
  }
  
  async restore(sourcePath: string): Promise<void> {
    // 简化实现：复制目录
  }
  
  // 辅助方法
  private async saveObject(key: string, value: any): Promise<void> {
    const filePath = path.join(this.config.dataDir, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  }
  
  private async loadObject(key: string): Promise<any | null> {
    const filePath = path.join(this.config.dataDir, `${key}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    return null;
  }
}
