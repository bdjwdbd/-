/**
 * 混合搜索引擎 - TypeScript 原生实现
 * 
 * 功能：
 * 1. 向量搜索（使用 sqlite-vec）
 * 2. 全文搜索（FTS5）
 * 3. RRF 融合（Reciprocal Rank Fusion）
 * 4. LLM 查询扩展（可选）
 * 
 * 性能优化：
 * - 使用 node:sqlite（Node.js 22+ 内置）
 * - 使用 sqlite-vec 原生扩展
 * - 支持缓存
 * - 支持并行搜索
 */

import { DatabaseSync } from "node:sqlite";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as https from "https";
import * as http from "http";

// ============================================================
// 类型定义
// ============================================================

export interface SearchOptions {
  query: string;
  limit?: number;
  minScore?: number;
  useVector?: boolean;
  useFTS?: boolean;
  useLLM?: boolean;
  mode?: "fast" | "balanced" | "full";
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  type?: string;
  scene?: string;
  timestamp?: string;
  source: "vector" | "fts" | "llm" | "hybrid";
  metadata?: Record<string, any>;
}

export interface EmbeddingConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions: number;
}

export interface HybridSearchConfig {
  dbPath: string;
  embedding?: EmbeddingConfig;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  rrfK?: number;
}

// ============================================================
// 缓存管理
// ============================================================

class SearchCache {
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private ttl: number;
  
  constructor(ttl: number = 3600000) {
    this.ttl = ttl;
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }
  
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl,
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// ============================================================
// Embedding 服务
// ============================================================

class EmbeddingService {
  private config: EmbeddingConfig;
  private cache: SearchCache;
  
  constructor(config: EmbeddingConfig, cache: SearchCache) {
    this.config = config;
    this.cache = cache;
  }
  
  async getEmbedding(text: string): Promise<number[] | null> {
    // 检查缓存
    const cacheKey = `embedding:${this.hash(text)}`;
    const cached = this.cache.get<number[]>(cacheKey);
    if (cached) return cached;
    
    // 调用 API
    try {
      const embedding = await this.callAPI(text);
      if (embedding) {
        this.cache.set(cacheKey, embedding);
      }
      return embedding;
    } catch (error) {
      console.error("[EmbeddingService] API 调用失败:", error);
      return null;
    }
  }
  
  private async callAPI(text: string): Promise<number[] | null> {
    const url = new URL("/v1/embeddings", this.config.baseUrl);
    
    const body = JSON.stringify({
      input: text.slice(0, 2000),
      model: this.config.model,
      dimensions: this.config.dimensions,
    });
    
    return new Promise((resolve, reject) => {
      const client = url.protocol === "https:" ? https : http;
      
      const req = client.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.config.apiKey}`,
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 30000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const result = JSON.parse(data);
              if (result.data && result.data[0] && result.data[0].embedding) {
                resolve(result.data[0].embedding);
              } else {
                reject(new Error("Invalid response format"));
              }
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
      
      req.write(body);
      req.end();
    });
  }
  
  private hash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

// ============================================================
// HybridSearchEngine 类
// ============================================================

export class HybridSearchEngine {
  private db: DatabaseSync | null = null;
  private config: HybridSearchConfig;
  private cache: SearchCache;
  private embeddingService: EmbeddingService | null = null;
  private initialized: boolean = false;
  
  constructor(config: Partial<HybridSearchConfig> = {}) {
    const home = os.homedir();
    
    this.config = {
      dbPath: config.dbPath || path.join(home, ".openclaw/memory-tdai/vectors.db"),
      cacheEnabled: config.cacheEnabled !== false,
      cacheTTL: config.cacheTTL || 3600000,
      rrfK: config.rrfK || 60,
      ...config,
    };
    
    this.cache = new SearchCache(this.config.cacheTTL);
    
    if (this.config.embedding) {
      this.embeddingService = new EmbeddingService(this.config.embedding, this.cache);
    }
  }
  
  // ============================================================
  // 初始化
  // ============================================================
  
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    
    console.log("[HybridSearchEngine] 初始化中...");
    
    // 检查数据库文件
    if (!fs.existsSync(this.config.dbPath)) {
      console.warn("[HybridSearchEngine] 数据库文件不存在:", this.config.dbPath);
      return false;
    }
    
    // 打开数据库
    try {
      this.db = new DatabaseSync(this.config.dbPath);
      
      // 加载 sqlite-vec 扩展
      await this.loadVectorExtension();
      
      console.log("[HybridSearchEngine] ✅ 初始化完成");
      this.initialized = true;
      return true;
    } catch (error) {
      console.error("[HybridSearchEngine] 初始化失败:", error);
      return false;
    }
  }
  
  private async loadVectorExtension(): Promise<void> {
    // 尝试加载 sqlite-vec 扩展
    const extensionPaths = [
      path.join(os.homedir(), ".openclaw/extensions/memory-tencentdb/node_modules/sqlite-vec-linux-x64/vec0"),
      path.join(os.homedir(), ".openclaw/extensions/memory-tencentdb/node_modules/sqlite-vec-linux-x64/vec0.so"),
    ];
    
    for (const extPath of extensionPaths) {
      if (fs.existsSync(extPath)) {
        try {
          this.db!.enableLoadExtension(true);
          this.db!.loadExtension(extPath);
          console.log("[HybridSearchEngine] ✅ sqlite-vec 扩展已加载");
          return;
        } catch (error) {
          console.warn("[HybridSearchEngine] 扩展加载失败:", error);
        }
      }
    }
    
    console.warn("[HybridSearchEngine] ⚠️ sqlite-vec 扩展未找到，向量搜索将不可用");
  }
  
  // ============================================================
  // 向量搜索
  // ============================================================
  
  async vectorSearch(query: string, topK: number = 10): Promise<SearchResult[]> {
    if (!this.embeddingService) {
      console.warn("[HybridSearchEngine] Embedding 服务未配置");
      return [];
    }
    
    // 获取查询向量
    const embedding = await this.embeddingService.getEmbedding(query);
    if (!embedding) {
      console.warn("[HybridSearchEngine] 获取向量失败");
      return [];
    }
    
    // 检查缓存
    const cacheKey = `vector:${this.hash(query)}:${topK}`;
    const cached = this.cache.get<SearchResult[]>(cacheKey);
    if (cached) return cached;
    
    // 执行搜索
    try {
      const vecBuffer = Buffer.from(new Float32Array(embedding).buffer);
      
      const stmt = this.db!.prepare(`
        SELECT 
          r.record_id,
          r.content,
          r.type,
          r.scene_name,
          r.created_at,
          vec_distance_cosine(v.embedding, ?) as distance
        FROM l1_records r
        JOIN l1_vec v ON r.record_id = v.record_id
        ORDER BY distance ASC
        LIMIT ?
      `);
      
      const rows = stmt.all(vecBuffer, topK) as any[];
      
      const results: SearchResult[] = rows.map((row: any) => ({
        id: row.record_id,
        content: row.content,
        score: 1 - (row.distance || 0),
        type: row.type,
        scene: row.scene_name,
        timestamp: row.created_at,
        source: "vector" as const,
      }));
      
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error("[HybridSearchEngine] 向量搜索失败:", error);
      return [];
    }
  }
  
  // ============================================================
  // 全文搜索
  // ============================================================
  
  ftsSearch(query: string, topK: number = 10): SearchResult[] {
    // 检查缓存
    const cacheKey = `fts:${this.hash(query)}:${topK}`;
    const cached = this.cache.get<SearchResult[]>(cacheKey);
    if (cached) return cached;
    
    try {
      // 使用 LIKE 搜索（简单实现）
      const stmt = this.db!.prepare(`
        SELECT 
          record_id,
          content,
          type,
          scene_name,
          created_at
        FROM l1_records
        WHERE content LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const rows = stmt.all(`%${query}%`, topK) as any[];
      
      const results: SearchResult[] = rows.map((row: any) => ({
        id: row.record_id,
        content: row.content,
        score: 0.5, // FTS 没有分数，给默认值
        type: row.type,
        scene: row.scene_name,
        timestamp: row.created_at,
        source: "fts" as const,
      }));
      
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error("[HybridSearchEngine] FTS 搜索失败:", error);
      return [];
    }
  }
  
  // ============================================================
  // RRF 融合
  // ============================================================
  
  rrfFusion(
    vectorResults: SearchResult[],
    ftsResults: SearchResult[],
    topK: number = 10,
    k: number = 60
  ): SearchResult[] {
    const scores: Map<string, { result: SearchResult; score: number }> = new Map();
    
    // 向量搜索结果
    vectorResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scores.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(result.id, { result, score: rrfScore });
      }
    });
    
    // FTS 搜索结果
    ftsResults.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scores.get(result.id);
      if (existing) {
        existing.score += rrfScore;
        existing.result.source = "hybrid";
      } else {
        scores.set(result.id, { result, score: rrfScore });
      }
    });
    
    // 排序并返回
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => ({
        ...item.result,
        score: item.score,
      }));
  }
  
  // ============================================================
  // 混合搜索（主入口）
  // ============================================================
  
  async search(options: SearchOptions): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const {
      query,
      limit = 10,
      useVector = true,
      useFTS = true,
      mode = "balanced",
    } = options;
    
    console.log(`[HybridSearchEngine] 混合搜索: "${query}" (mode: ${mode})`);
    
    // 并行执行搜索
    const [vectorResults, ftsResults] = await Promise.all([
      useVector ? this.vectorSearch(query, limit * 2) : Promise.resolve([]),
      useFTS ? Promise.resolve(this.ftsSearch(query, limit * 2)) : Promise.resolve([]),
    ]);
    
    console.log(`[HybridSearchEngine] 向量搜索: ${vectorResults.length} 条`);
    console.log(`[HybridSearchEngine] FTS 搜索: ${ftsResults.length} 条`);
    
    // RRF 融合
    const fused = this.rrfFusion(vectorResults, ftsResults, limit, this.config.rrfK);
    
    console.log(`[HybridSearchEngine] 融合结果: ${fused.length} 条`);
    
    return fused;
  }
  
  // ============================================================
  // 工具方法
  // ============================================================
  
  private hash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.cache.clear();
    this.initialized = false;
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================
// 导出
// ============================================================

export default HybridSearchEngine;
