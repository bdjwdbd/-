/**
 * TencentDB 后端实现
 * 
 * 将 memory-tencentdb 插件作为元灵系统的记忆后端
 * 
 * 功能映射：
 * - store() → L1 记忆提取 + 向量嵌入
 * - search() → L1 关键词搜索
 * - vectorSearch() → 向量语义搜索
 * - getPersona() → L3 用户画像
 * - getSceneBlocks() → L2 场景块
 */

import * as fs from "fs";
import * as path from "path";
import type {
  MemoryBackend,
  Memory,
  Persona,
  SceneBlock,
  SearchResult,
  SearchOptions,
  StoreOptions,
  BackendStats,
} from "./memory-backend.js";
import type { MemoryType, MemoryPriority } from "./memory-backend.js";

// ============================================================
// 类型定义
// ============================================================

interface TencentDBConfig {
  type: "tencentdb";
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

interface L1Record {
  id: string;
  content: string;
  type: string;
  timestamp: string;
  sessionId?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

interface L3Persona {
  content: string;
  traits?: Array<{ name: string; value: string; confidence: number }>;
  preferences?: Array<{ key: string; value: any; source: string }>;
  updatedAt?: string;
  version?: number;
}

interface L2SceneBlock {
  id: string;
  name: string;
  summary: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================
// TencentDBBackend 实现
// ============================================================

export class TencentDBBackend implements MemoryBackend {
  private config: TencentDBConfig;
  private dataDir: string;
  private _isReady: boolean = false;
  
  // 向量存储（简化版，实际应使用 memory-tencentdb 的 VectorStore）
  private vectorStore: Map<string, { vector: number[]; memory: Memory }> = new Map();
  private embeddingService: EmbeddingService | null = null;
  
  readonly name = "TencentDBBackend";
  readonly type = "tencentdb";
  
  get isReady() { return this._isReady; }
  
  constructor(config: TencentDBConfig) {
    this.config = config;
    this.dataDir = config.dataDir || path.join(process.env.HOME || "", ".openclaw", "memory-tdai");
    
    // 初始化嵌入服务
    if (config.embedding?.enabled) {
      this.embeddingService = new EmbeddingService({
        provider: config.embedding.provider || "openai",
        baseUrl: config.embedding.baseUrl,
        apiKey: config.embedding.apiKey,
        model: config.embedding.model || "Qwen3-Embedding-8B",
        dimensions: config.embedding.dimensions || 4096,
      });
    }
  }
  
  async initialize(): Promise<void> {
    // 确保目录存在
    const dirs = ["conversations", "records", "scene_blocks", ".metadata"];
    for (const dir of dirs) {
      const fullPath = path.join(this.dataDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
    
    // 加载已有数据
    await this.loadExistingData();
    
    this._isReady = true;
  }
  
  async close(): Promise<void> {
    this._isReady = false;
  }
  
  // ============================================================
  // 基础 CRUD
  // ============================================================
  
  async store(memory: Memory, options?: StoreOptions): Promise<void> {
    // 转换为 L1 格式
    const record: L1Record = {
      id: memory.id,
      content: memory.content,
      type: this.mapMemoryType(memory.type),
      timestamp: memory.createdAt.toISOString(),
      sessionId: memory.metadata?.sessionId,
        // @ts-ignore
      embedding: memory.embedding,
      metadata: {
        priority: memory.priority,
        importance: memory.importance,
        tags: memory.tags,
        ...memory.metadata,
      },
    };
    
    // 生成嵌入（如果启用）
    if (options?.generateEmbedding !== false && this.embeddingService) {
      try {
        const result = await this.embeddingService.embed(memory.content);
        record.embedding = result.vector;
        memory.embedding = result.vector;
      } catch (e) {
        // 嵌入失败不影响存储
      }
    }
    
    // 写入 L1 记录
    const date = new Date().toISOString().split("T")[0];
    const recordPath = path.join(this.dataDir, "records", `${date}.jsonl`);
    fs.appendFileSync(recordPath, JSON.stringify(record) + "\n");
    
    // 更新向量存储
    if (memory.embedding) {
      this.vectorStore.set(memory.id, { vector: memory.embedding, memory });
    }
  }
  
  async get(id: string): Promise<Memory | null> {
    // 搜索所有记录文件
    const recordsDir = path.join(this.dataDir, "records");
    if (!fs.existsSync(recordsDir)) return null;
    
    const files = fs.readdirSync(recordsDir).filter(f => f.endsWith(".jsonl"));
    
    for (const file of files) {
      const filePath = path.join(recordsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");
      
      for (const line of lines) {
        try {
          const record: L1Record = JSON.parse(line);
          if (record.id === id) {
            return this.recordToMemory(record);
          }
        } catch {}
      }
    }
    
    return null;
  }
  
  async update(id: string, updates: Partial<Memory>): Promise<void> {
    // 找到并更新记录
    const memory = await this.get(id);
    if (!memory) return;
    
    const updated = { ...memory, ...updates };
    
    // 重新存储（简化实现，实际应该原地更新）
    await this.store(updated);
  }
  
  async delete(id: string): Promise<boolean> {
    // 从向量存储中删除
    return this.vectorStore.delete(id);
  }
  
  // ============================================================
  // 搜索
  // ============================================================
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const limit = options?.limit || 10;
    
    const recordsDir = path.join(this.dataDir, "records");
    if (!fs.existsSync(recordsDir)) return [];
    
    const files = fs.readdirSync(recordsDir).filter(f => f.endsWith(".jsonl"));
    
    for (const file of files) {
      const filePath = path.join(recordsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");
      
      for (const line of lines) {
        try {
          const record: L1Record = JSON.parse(line);
          
          // 关键词匹配
          if (record.content.toLowerCase().includes(queryLower)) {
            const memory = this.recordToMemory(record);
            
            // 过滤条件
            if (options?.types && !options.types.includes(memory.type)) continue;
            if (options?.tags && !options.tags.some(t => memory.tags.includes(t))) continue;
            
            results.push({
              memory,
              score: 0.5 + (record.content.toLowerCase().split(queryLower).length - 1) * 0.1,
              matchType: "keyword",
            });
          }
        } catch {}
      }
    }
    
    // 排序并返回
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  
  async vectorSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.embeddingService) {
      return this.search(query, options);
    }
    
    // 生成查询向量
    const queryResult = await this.embeddingService.embed(query);
    const queryVector = queryResult.vector;
    
    // 计算相似度
    const results: SearchResult[] = [];
    const limit = options?.limit || 10;
    
    for (const [id, { vector, memory }] of this.vectorStore) {
      const score = this.cosineSimilarity(queryVector, vector);
      
      if (score >= (options?.minScore || 0.5)) {
        // 过滤条件
        if (options?.types && !options.types.includes(memory.type)) continue;
        if (options?.tags && !options.tags.some(t => memory.tags.includes(t))) continue;
        
        results.push({
          memory,
          score,
          matchType: "semantic",
        });
      }
    }
    
    // 排序并返回
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  
  async hybridSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // 并行执行关键词和向量搜索
    const [keywordResults, vectorResults] = await Promise.all([
      this.search(query, { ...options, limit: (options?.limit || 10) * 2 }),
      this.vectorSearch(query, { ...options, limit: (options?.limit || 10) * 2 }),
    ]);
    
    // 合并结果
    const merged = new Map<string, SearchResult>();
    
    for (const result of keywordResults) {
      merged.set(result.memory.id, {
        ...result,
        matchType: "hybrid",
        score: result.score * 0.3,
      });
    }
    
    for (const result of vectorResults) {
      const existing = merged.get(result.memory.id);
      if (existing) {
        existing.score += result.score * 0.7;
      } else {
        merged.set(result.memory.id, {
          ...result,
          matchType: "hybrid",
          score: result.score * 0.7,
        });
      }
    }
    
    // 排序并返回
    const results = Array.from(merged.values());
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options?.limit || 10);
  }
  
  // ============================================================
  // 批量操作
  // ============================================================
  
  async storeBatch(memories: Memory[]): Promise<void> {
    for (const memory of memories) {
      await this.store(memory);
    }
  }
  
  async searchBatch(queries: string[]): Promise<SearchResult[][]> {
    return Promise.all(queries.map(q => this.hybridSearch(q)));
  }
  
  // ============================================================
  // 用户画像
  // ============================================================
  
  async getPersona(): Promise<Persona | null> {
    const personaPath = path.join(this.dataDir, "persona.md");
    
    if (!fs.existsSync(personaPath)) return null;
    
    const content = fs.readFileSync(personaPath, "utf-8");
    
    return {
      id: "persona-main",
      content,
      traits: [],
      preferences: [],
      updatedAt: new Date(),
      version: 1,
    };
  }
  
  async updatePersona(updates: Partial<Persona>): Promise<void> {
    const persona = await this.getPersona();
    const content = updates.content || persona?.content || "";
    
    const personaPath = path.join(this.dataDir, "persona.md");
    fs.writeFileSync(personaPath, content);
  }
  
  async generatePersona(): Promise<Persona> {
    // 简化实现，实际应调用 LLM
    const persona: Persona = {
      id: "persona-main",
      content: "# 用户画像\n\n基于对话历史自动生成。",
      traits: [],
      preferences: [],
      updatedAt: new Date(),
      version: 1,
    };
    
    await this.updatePersona(persona);
    return persona;
  }
  
  // ============================================================
  // 场景记忆
  // ============================================================
  
  async getSceneBlocks(sceneName?: string): Promise<SceneBlock[]> {
    const sceneDir = path.join(this.dataDir, "scene_blocks");
    if (!fs.existsSync(sceneDir)) return [];
    
    const files = fs.readdirSync(sceneDir).filter(f => f.endsWith(".md"));
    const blocks: SceneBlock[] = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(sceneDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        
        const block: SceneBlock = {
          id: file.replace(".md", ""),
          name: file.replace(".md", ""),
          summary: content.split("\n")[0].replace(/^#\s*/, ""),
          events: [],
          insights: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        if (!sceneName || block.name === sceneName) {
          blocks.push(block);
        }
      } catch {}
    }
    
    return blocks;
  }
  
  async getSceneBlock(id: string): Promise<SceneBlock | null> {
    const blocks = await this.getSceneBlocks();
    return blocks.find(b => b.id === id) || null;
  }
  
  async createSceneBlock(block: Omit<SceneBlock, "id" | "createdAt" | "updatedAt">): Promise<SceneBlock> {
    const id = block.name.toLowerCase().replace(/\s+/g, "-");
    const newBlock: SceneBlock = {
      ...block,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const scenePath = path.join(this.dataDir, "scene_blocks", `${id}.md`);
    fs.writeFileSync(scenePath, `# ${block.summary}\n\n${block.events.map(e => `- ${e.description}`).join("\n")}`);
    
    return newBlock;
  }
  
  async updateSceneBlock(id: string, updates: Partial<SceneBlock>): Promise<void> {
    const block = await this.getSceneBlock(id);
    if (!block) return;
    
    const updated = { ...block, ...updates, updatedAt: new Date() };
    const scenePath = path.join(this.dataDir, "scene_blocks", `${id}.md`);
    fs.writeFileSync(scenePath, `# ${updated.summary}\n\n${updated.events.map(e => `- ${e.description}`).join("\n")}`);
  }
  
  // ============================================================
  // 统计与维护
  // ============================================================
  
  async getStats(): Promise<BackendStats> {
    const recordsDir = path.join(this.dataDir, "records");
    let totalMemories = 0;
    const memoriesByType: Record<MemoryType, number> = {
      episodic: 0,
      semantic: 0,
      procedural: 0,
      preference: 0,
    };
    
    if (fs.existsSync(recordsDir)) {
      const files = fs.readdirSync(recordsDir).filter(f => f.endsWith(".jsonl"));
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(recordsDir, file), "utf-8");
        const lines = content.trim().split("\n");
        totalMemories += lines.length;
        
        for (const line of lines) {
          try {
            const record: L1Record = JSON.parse(line);
            const type = this.unmapMemoryType(record.type);
            memoriesByType[type]++;
          } catch {}
        }
      }
    }
    
    const persona = await this.getPersona();
    const sceneBlocks = await this.getSceneBlocks();
    
    return {
      totalMemories,
      memoriesByType,
      totalSize: 0,
      avgAccessCount: 0,
      embeddingCoverage: this.vectorStore.size / Math.max(totalMemories, 1),
      personaVersion: persona?.version,
      sceneBlockCount: sceneBlocks.length,
    };
  }
  
  async vacuum(): Promise<void> {
    // 清理过期记忆
    const now = new Date();
    const recordsDir = path.join(this.dataDir, "records");
    
    if (!fs.existsSync(recordsDir)) return;
    
    const files = fs.readdirSync(recordsDir).filter(f => f.endsWith(".jsonl"));
    
    for (const file of files) {
      const filePath = path.join(recordsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");
      const validLines: string[] = [];
      
      for (const line of lines) {
        try {
          const record: L1Record = JSON.parse(line);
          // 保留所有记录（简化实现）
          validLines.push(line);
        } catch {
          // 跳过无效行
        }
      }
      
      fs.writeFileSync(filePath, validLines.join("\n") + "\n");
    }
  }
  
  async backup(targetPath: string): Promise<void> {
    // 简化实现：复制整个数据目录
    const { execSync } = require("child_process");
    execSync(`cp -r "${this.dataDir}" "${targetPath}"`);
  }
  
  async restore(sourcePath: string): Promise<void> {
    // 简化实现：复制源目录到数据目录
    const { execSync } = require("child_process");
    execSync(`cp -r "${sourcePath}/"* "${this.dataDir}/"`);
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private async loadExistingData(): Promise<void> {
    const recordsDir = path.join(this.dataDir, "records");
    if (!fs.existsSync(recordsDir)) return;
    
    const files = fs.readdirSync(recordsDir).filter(f => f.endsWith(".jsonl"));
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(recordsDir, file), "utf-8");
      const lines = content.trim().split("\n");
      
      for (const line of lines) {
        try {
          const record: L1Record = JSON.parse(line);
          if (record.embedding) {
            const memory = this.recordToMemory(record);
            this.vectorStore.set(record.id, { vector: record.embedding, memory });
          }
        } catch {}
      }
    }
  }
  
  private recordToMemory(record: L1Record): Memory {
    return {
      id: record.id,
      type: this.unmapMemoryType(record.type),
      content: record.content,
      embedding: record.embedding,
      priority: (record.metadata?.priority as MemoryPriority) || "normal",
        // @ts-ignore
        // @ts-ignore
      importance: record.metadata?.importance || 0.5,
      tags: record.metadata?.tags || [],
      metadata: record.metadata || {},
      createdAt: new Date(record.timestamp),
      lastAccessed: new Date(),
      accessCount: 0,
    };
  }
  
  private mapMemoryType(type: MemoryType): string {
    const mapping: Record<MemoryType, string> = {
      episodic: "episodic",
      semantic: "semantic",
      procedural: "procedural",
      preference: "preference",
    };
    return mapping[type] || "episodic";
  }
  
  private unmapMemoryType(type: string): MemoryType {
    const mapping: Record<string, MemoryType> = {
      episodic: "episodic",
      semantic: "semantic",
      procedural: "procedural",
      preference: "preference",
    };
    return mapping[type] || "episodic";
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ============================================================
// 嵌入服务（简化版）
// ============================================================

interface EmbeddingConfig {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  dimensions: number;
}

class EmbeddingService {
  private config: EmbeddingConfig;
  
  constructor(config: EmbeddingConfig) {
    this.config = config;
  }
  
  async embed(text: string): Promise<{ vector: number[]; tokens: number }> {
    // 如果有 API 配置，调用真实 API
    if (this.config.baseUrl && this.config.apiKey) {
      try {
        const response = await fetch(`${this.config.baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            input: text,
          }),
        });
        
        const data = await response.json() as any;
        return {
          vector: data.data[0].embedding,
          tokens: data.usage?.total_tokens || 0,
        };
      } catch (e) {
        // API 调用失败，返回模拟向量
      }
    }
    
    // 返回模拟向量
    const vector: number[] = [];
    for (let i = 0; i < this.config.dimensions; i++) {
      vector.push(Math.random() * 2 - 1);
    }
    
    // 归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return {
      vector: vector.map(v => v / norm),
      tokens: Math.ceil(text.length / 4),
    };
  }
}
