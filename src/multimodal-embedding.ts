/**
 * 多模态向量支持
 * 
 * 功能：
 * 1. 文本嵌入（Text Embedding）
 * 2. 图像嵌入（Image Embedding）
 * 3. 混合检索（文本 + 图像）
 * 4. 跨模态相似度计算
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface EmbeddingConfig {
  provider: "openai" | "gitee" | "local";
  textModel: string;
  imageModel: string;
  textDimensions: number;
  imageDimensions: number;
  baseUrl?: string;
  apiKey?: string;
}

interface TextEmbedding {
  id: string;
  text: string;
  vector: number[];
  model: string;
  dimensions: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

interface ImageEmbedding {
  id: string;
  imageUrl: string;
  imageHash: string;
  vector: number[];
  model: string;
  dimensions: number;
  createdAt: Date;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    caption?: string;
  };
}

interface MultimodalEntry {
  id: string;
  textEmbedding?: TextEmbedding;
  imageEmbedding?: ImageEmbedding;
  combinedVector?: number[];
  createdAt: Date;
  tags: string[];
}

interface SearchResult {
  id: string;
  score: number;
  type: "text" | "image" | "multimodal";
  text?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

interface MultimodalStoreConfig {
  storeDir: string;
  cacheSize: number;
  enableTextCache: boolean;
  enableImageCache: boolean;
  fusionStrategy: "concat" | "average" | "weighted";
  textWeight: number;
  imageWeight: number;
}

// ============================================================
// 向量工具
// ============================================================

class VectorMath {
  /**
   * 余弦相似度
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
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
  
  /**
   * 向量拼接
   */
  static concat(a: number[], b: number[]): number[] {
    return [...a, ...b];
  }
  
  /**
   * 向量平均
   */
  static average(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];
    
    const length = vectors[0].length;
    const result = new Array(length).fill(0);
    
    for (const vec of vectors) {
      for (let i = 0; i < length; i++) {
        result[i] += vec[i];
      }
    }
    
    return result.map(v => v / vectors.length);
  }
  
  /**
   * 加权平均
   */
  static weightedAverage(vectors: number[][], weights: number[]): number[] {
    if (vectors.length === 0 || vectors.length !== weights.length) return [];
    
    const length = vectors[0].length;
    const result = new Array(length).fill(0);
    let totalWeight = 0;
    
    for (let i = 0; i < vectors.length; i++) {
      const weight = weights[i];
      totalWeight += weight;
      
      for (let j = 0; j < length; j++) {
        result[j] += vectors[i][j] * weight;
      }
    }
    
    return result.map(v => v / totalWeight);
  }
  
  /**
   * 归一化
   */
  static normalize(vector: number[]): number[] {
    let norm = 0;
    for (const v of vector) {
      norm += v * v;
    }
    norm = Math.sqrt(norm);
    
    if (norm === 0) return vector;
    
    return vector.map(v => v / norm);
  }
  
  /**
   * 降维（简单 PCA 近似）
   */
  static reduceDimensions(vector: number[], targetDims: number): number[] {
    if (vector.length <= targetDims) return vector;
    
    // 简单平均池化
    const chunkSize = Math.ceil(vector.length / targetDims);
    const result: number[] = [];
    
    for (let i = 0; i < targetDims; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, vector.length);
      const chunk = vector.slice(start, end);
      const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
      result.push(avg);
    }
    
    return result;
  }
}

// ============================================================
// 文本嵌入服务
// ============================================================

class TextEmbeddingService {
  private config: EmbeddingConfig;
  private cache: Map<string, TextEmbedding> = new Map();
  private maxCacheSize: number = 1000;
  
  constructor(config: EmbeddingConfig) {
    this.config = config;
  }
  
  /**
   * 生成文本嵌入
   */
  async embed(text: string): Promise<TextEmbedding> {
    // 检查缓存
    const cacheKey = this.getCacheKey(text);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    
    // 模拟 API 调用（实际应调用真实 API）
    const vector = await this.callEmbeddingAPI(text);
    
    const embedding: TextEmbedding = {
      id: this.generateId(),
      text,
      vector,
      model: this.config.textModel,
      dimensions: this.config.textDimensions,
      createdAt: new Date(),
    };
    
    // 缓存
    this.addToCache(cacheKey, embedding);
    
    return embedding;
  }
  
  /**
   * 批量嵌入
   */
  async embedBatch(texts: string[]): Promise<TextEmbedding[]> {
    const results: TextEmbedding[] = [];
    
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    
    return results;
  }
  
  private async callEmbeddingAPI(text: string): Promise<number[]> {
    // 模拟 API 调用延迟
    await new Promise(r => setTimeout(r, 10));
    
    // 生成模拟向量（实际应调用 API）
    const vector: number[] = [];
    const hash = crypto.createHash("sha256").update(text).digest();
    
    for (let i = 0; i < this.config.textDimensions; i++) {
      // 使用 hash 生成伪随机向量
      const value = (hash[i % hash.length] / 128 - 1) * 0.5;
      vector.push(value + (Math.random() - 0.5) * 0.1);
    }
    
    return VectorMath.normalize(vector);
  }
  
  private getCacheKey(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex");
  }
  
  private addToCache(key: string, embedding: TextEmbedding): void {
    if (this.cache.size >= this.maxCacheSize) {
      // LRU: 删除最早的
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, embedding);
  }
  
  private generateId(): string {
    return `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================
// 图像嵌入服务
// ============================================================

class ImageEmbeddingService {
  private config: EmbeddingConfig;
  private cache: Map<string, ImageEmbedding> = new Map();
  private maxCacheSize: number = 500;
  
  constructor(config: EmbeddingConfig) {
    this.config = config;
  }
  
  /**
   * 从 URL 生成图像嵌入
   */
  async embedFromUrl(imageUrl: string): Promise<ImageEmbedding> {
    // 检查缓存
    const cacheKey = this.getCacheKey(imageUrl);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    
    // 模拟下载和嵌入
    const { vector, metadata } = await this.processImage(imageUrl);
    
    const embedding: ImageEmbedding = {
      id: this.generateId(),
      imageUrl,
      imageHash: cacheKey,
      vector,
      model: this.config.imageModel,
      dimensions: this.config.imageDimensions,
      createdAt: new Date(),
      metadata,
    };
    
    this.addToCache(cacheKey, embedding);
    
    return embedding;
  }
  
  /**
   * 从本地文件生成嵌入
   */
  async embedFromFile(filePath: string): Promise<ImageEmbedding> {
    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    
    // 检查缓存
    const cached = this.cache.get(hash);
    if (cached) return cached;
    
    // 模拟处理
    const vector = await this.generateImageVector(buffer);
    
    const embedding: ImageEmbedding = {
      id: this.generateId(),
      imageUrl: `file://${filePath}`,
      imageHash: hash,
      vector,
      model: this.config.imageModel,
      dimensions: this.config.imageDimensions,
      createdAt: new Date(),
      metadata: {
        format: path.extname(filePath).slice(1),
      },
    };
    
    this.addToCache(hash, embedding);
    
    return embedding;
  }
  
  /**
   * 批量嵌入
   */
  async embedBatch(imageUrls: string[]): Promise<ImageEmbedding[]> {
    const results: ImageEmbedding[] = [];
    
    for (const url of imageUrls) {
      results.push(await this.embedFromUrl(url));
    }
    
    return results;
  }
  
  private async processImage(imageUrl: string): Promise<{
    vector: number[];
    metadata: ImageEmbedding["metadata"];
  }> {
    // 模拟 API 调用
    await new Promise(r => setTimeout(r, 50));
    
    const vector = await this.generateImageVector(Buffer.from(imageUrl));
    
    return {
      vector,
      metadata: {
        width: 224,
        height: 224,
        format: "jpg",
        caption: `Image from ${imageUrl}`,
      },
    };
  }
  
  private async generateImageVector(buffer: Buffer): Promise<number[]> {
    const vector: number[] = [];
    const hash = crypto.createHash("sha256").update(buffer).digest();
    
    for (let i = 0; i < this.config.imageDimensions; i++) {
      const value = (hash[i % hash.length] / 128 - 1) * 0.5;
      vector.push(value + (Math.random() - 0.5) * 0.1);
    }
    
    return VectorMath.normalize(vector);
  }
  
  private getCacheKey(url: string): string {
    return crypto.createHash("md5").update(url).digest("hex");
  }
  
  private addToCache(key: string, embedding: ImageEmbedding): void {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, embedding);
  }
  
  private generateId(): string {
    return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================
// 多模态向量存储
// ============================================================

export class MultimodalVectorStore {
  private config: MultimodalStoreConfig;
  private textService: TextEmbeddingService;
  private imageService: ImageEmbeddingService;
  private entries: Map<string, MultimodalEntry> = new Map();
  private textIndex: Map<string, string> = new Map();  // textHash -> entryId
  private imageIndex: Map<string, string> = new Map(); // imageHash -> entryId
  
  constructor(
    embeddingConfig: EmbeddingConfig,
    storeConfig?: Partial<MultimodalStoreConfig>
  ) {
    this.config = {
      storeDir: "./multimodal-store",
      cacheSize: 1000,
      enableTextCache: true,
      enableImageCache: true,
      fusionStrategy: "weighted",
      textWeight: 0.6,
      imageWeight: 0.4,
      ...storeConfig,
    };
    
    this.textService = new TextEmbeddingService(embeddingConfig);
    this.imageService = new ImageEmbeddingService(embeddingConfig);
    
    this.ensureDir(this.config.storeDir);
  }
  
  /**
   * 添加文本
   */
  async addText(text: string, tags?: string[], metadata?: any): Promise<string> {
    const embedding = await this.textService.embed(text);
    
    const entry: MultimodalEntry = {
      id: embedding.id,
      textEmbedding: embedding,
      createdAt: new Date(),
      tags: tags || [],
    };
    
    this.entries.set(entry.id, entry);
    this.textIndex.set(this.hashText(text), entry.id);
    
    return entry.id;
  }
  
  /**
   * 添加图像
   */
  async addImage(imageUrl: string, tags?: string[], metadata?: any): Promise<string> {
    const embedding = await this.imageService.embedFromUrl(imageUrl);
    
    const entry: MultimodalEntry = {
      id: embedding.id,
      imageEmbedding: embedding,
      createdAt: new Date(),
      tags: tags || [],
    };
    
    this.entries.set(entry.id, entry);
    this.imageIndex.set(embedding.imageHash, entry.id);
    
    return entry.id;
  }
  
  /**
   * 添加多模态条目（文本 + 图像）
   */
  async addMultimodal(
    text: string,
    imageUrl: string,
    tags?: string[]
  ): Promise<string> {
    const [textEmbedding, imageEmbedding] = await Promise.all([
      this.textService.embed(text),
      this.imageService.embedFromUrl(imageUrl),
    ]);
    
    // 生成融合向量
    const combinedVector = this.fuseVectors(
      textEmbedding.vector,
      imageEmbedding.vector
    );
    
    const entry: MultimodalEntry = {
      id: `mm-${Date.now()}`,
      textEmbedding,
      imageEmbedding,
      combinedVector,
      createdAt: new Date(),
      tags: tags || [],
    };
    
    this.entries.set(entry.id, entry);
    this.textIndex.set(this.hashText(text), entry.id);
    this.imageIndex.set(imageEmbedding.imageHash, entry.id);
    
    return entry.id;
  }
  
  /**
   * 文本搜索
   */
  async searchText(query: string, topK: number = 10): Promise<SearchResult[]> {
    const queryEmbedding = await this.textService.embed(query);
    
    const results: Array<{ entry: MultimodalEntry; score: number }> = [];
    
    for (const entry of this.entries.values()) {
      let score = 0;
      
      if (entry.textEmbedding) {
        score = VectorMath.cosineSimilarity(
          queryEmbedding.vector,
          entry.textEmbedding.vector
        );
      }
      
      if (entry.combinedVector) {
        // 对于多模态条目，也检查融合向量
        const combinedScore = VectorMath.cosineSimilarity(
          queryEmbedding.vector,
          entry.combinedVector
        );
        score = Math.max(score, combinedScore);
      }
      
      if (score > 0) {
        results.push({ entry, score });
      }
    }
    
    // 排序并返回 topK
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK).map(r => ({
      id: r.entry.id,
      score: r.score,
      type: r.entry.combinedVector ? "multimodal" : "text",
      text: r.entry.textEmbedding?.text,
      imageUrl: r.entry.imageEmbedding?.imageUrl,
    }));
  }
  
  /**
   * 图像搜索
   */
  async searchImage(imageUrl: string, topK: number = 10): Promise<SearchResult[]> {
    const queryEmbedding = await this.imageService.embedFromUrl(imageUrl);
    
    const results: Array<{ entry: MultimodalEntry; score: number }> = [];
    
    for (const entry of this.entries.values()) {
      let score = 0;
      
      if (entry.imageEmbedding) {
        score = VectorMath.cosineSimilarity(
          queryEmbedding.vector,
          entry.imageEmbedding.vector
        );
      }
      
      if (entry.combinedVector) {
        const combinedScore = VectorMath.cosineSimilarity(
          queryEmbedding.vector,
          entry.combinedVector
        );
        score = Math.max(score, combinedScore);
      }
      
      if (score > 0) {
        results.push({ entry, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK).map(r => ({
      id: r.entry.id,
      score: r.score,
      type: r.entry.combinedVector ? "multimodal" : "image",
      text: r.entry.textEmbedding?.text,
      imageUrl: r.entry.imageEmbedding?.imageUrl,
    }));
  }
  
  /**
   * 跨模态搜索（文本搜图像）
   */
  async textToImage(query: string, topK: number = 10): Promise<SearchResult[]> {
    const queryEmbedding = await this.textService.embed(query);
    
    const results: Array<{ entry: MultimodalEntry; score: number }> = [];
    
    for (const entry of this.entries.values()) {
      if (!entry.imageEmbedding) continue;
      
      let score = 0;
      
      if (entry.combinedVector) {
        score = VectorMath.cosineSimilarity(
          queryEmbedding.vector,
          entry.combinedVector
        );
      } else if (entry.imageEmbedding) {
        // 跨模态：使用文本向量与图像向量比较
        // 实际应用中需要 CLIP 等跨模态模型
        score = VectorMath.cosineSimilarity(
          queryEmbedding.vector,
          entry.imageEmbedding.vector
        ) * 0.5; // 降低跨模态分数
      }
      
      if (score > 0) {
        results.push({ entry, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK).map(r => ({
      id: r.entry.id,
      score: r.score,
      type: "image",
      text: r.entry.textEmbedding?.text,
      imageUrl: r.entry.imageEmbedding?.imageUrl,
    }));
  }
  
  /**
   * 跨模态搜索（图像搜文本）
   */
  async imageToText(imageUrl: string, topK: number = 10): Promise<SearchResult[]> {
    const queryEmbedding = await this.imageService.embedFromUrl(imageUrl);
    
    const results: Array<{ entry: MultimodalEntry; score: number }> = [];
    
    for (const entry of this.entries.values()) {
      if (!entry.textEmbedding) continue;
      
      let score = 0;
      
      if (entry.combinedVector) {
        score = VectorMath.cosineSimilarity(
          queryEmbedding.vector,
          entry.combinedVector
        );
      } else if (entry.textEmbedding) {
        score = VectorMath.cosineSimilarity(
          queryEmbedding.vector,
          entry.textEmbedding.vector
        ) * 0.5;
      }
      
      if (score > 0) {
        results.push({ entry, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK).map(r => ({
      id: r.entry.id,
      score: r.score,
      type: "text",
      text: r.entry.textEmbedding?.text,
      imageUrl: r.entry.imageEmbedding?.imageUrl,
    }));
  }
  
  /**
   * 获取条目
   */
  get(id: string): MultimodalEntry | undefined {
    return this.entries.get(id);
  }
  
  /**
   * 删除条目
   */
  delete(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    
    if (entry.textEmbedding) {
      this.textIndex.delete(this.hashText(entry.textEmbedding.text));
    }
    if (entry.imageEmbedding && entry.imageEmbedding.imageHash) {
      this.imageIndex.delete(entry.imageEmbedding.imageHash);
    }
    
    return this.entries.delete(id);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalEntries: number;
    textOnly: number;
    imageOnly: number;
    multimodal: number;
    tags: string[];
  } {
    let textOnly = 0;
    let imageOnly = 0;
    let multimodal = 0;
    const tagSet = new Set<string>();
    
    for (const entry of this.entries.values()) {
      if (entry.textEmbedding && entry.imageEmbedding) {
        multimodal++;
      } else if (entry.textEmbedding) {
        textOnly++;
      } else if (entry.imageEmbedding) {
        imageOnly++;
      }
      
      for (const tag of entry.tags) {
        tagSet.add(tag);
      }
    }
    
    return {
      totalEntries: this.entries.size,
      textOnly,
      imageOnly,
      multimodal,
      tags: Array.from(tagSet),
    };
  }
  
  /**
   * 保存到文件
   */
  save(filename?: string): string {
    const filePath = path.join(
      this.config.storeDir,
      filename || `multimodal-${Date.now()}.json`
    );
    
    const data = {
      entries: Array.from(this.entries.entries()),
      config: this.config,
      savedAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    return filePath;
  }
  
  /**
   * 从文件加载
   */
  load(filename: string): void {
    const filePath = path.join(this.config.storeDir, filename);
    
    if (!fs.existsSync(filePath)) return;
    
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    this.entries.clear();
    this.textIndex.clear();
    this.imageIndex.clear();
    
    for (const [id, entry] of data.entries) {
      entry.createdAt = new Date(entry.createdAt);
      this.entries.set(id, entry);
      
      if (entry.textEmbedding) {
        this.textIndex.set(this.hashText(entry.textEmbedding.text), id);
      }
      if (entry.imageEmbedding) {
        this.imageIndex.set(entry.imageEmbedding.imageHash, id);
      }
    }
  }
  
  /**
   * 清空存储
   */
  clear(): void {
    this.entries.clear();
    this.textIndex.clear();
    this.imageIndex.clear();
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private fuseVectors(textVector: number[], imageVector: number[]): number[] {
    switch (this.config.fusionStrategy) {
      case "concat":
        return VectorMath.concat(textVector, imageVector);
        
      case "average":
        // 需要先对齐维度
        const textReduced = VectorMath.reduceDimensions(textVector, 512);
        const imageReduced = VectorMath.reduceDimensions(imageVector, 512);
        return VectorMath.average([textReduced, imageReduced]);
        
      case "weighted":
      default:
        const textReducedW = VectorMath.reduceDimensions(textVector, 512);
        const imageReducedW = VectorMath.reduceDimensions(imageVector, 512);
        return VectorMath.weightedAverage(
          [textReducedW, imageReducedW],
          [this.config.textWeight, this.config.imageWeight]
        );
    }
  }
  
  private hashText(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex");
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ============================================================
// 演示
// ============================================================

async function demo() {
  // console.log("=".repeat(60));
  // console.log("多模态向量支持演示");
  // console.log("=".repeat(60));
  
  const embeddingConfig: EmbeddingConfig = {
    provider: "gitee",
    textModel: "Qwen3-Embedding-8B",
    imageModel: "CLIP-ViT-B-32",
    textDimensions: 512,
    imageDimensions: 512,
  };
  
  const store = new MultimodalVectorStore(embeddingConfig, {
    storeDir: "./experiment-results/multimodal-store",
  });
  
  // 添加文本
  // console.log("\n1. 添加文本条目");
  
  const textId1 = await store.addText("一只可爱的猫咪在阳光下睡觉", ["动物", "猫"]);
  // console.log(`   添加: ${textId1}`);
  
  const textId2 = await store.addText("美丽的日落风景，海边沙滩", ["风景", "日落"]);
  // console.log(`   添加: ${textId2}`);
  
  const textId3 = await store.addText("现代城市夜景，霓虹灯闪烁", ["城市", "夜景"]);
  // console.log(`   添加: ${textId3}`);
  
  // 添加图像
  // console.log("\n2. 添加图像条目");
  
  const imageId1 = await store.addImage("https://example.com/cat.jpg", ["动物", "猫"]);
  // console.log(`   添加: ${imageId1}`);
  
  const imageId2 = await store.addImage("https://example.com/sunset.jpg", ["风景", "日落"]);
  // console.log(`   添加: ${imageId2}`);
  
  // 添加多模态
  // console.log("\n3. 添加多模态条目");
  
  const mmId = await store.addMultimodal(
    "一只金毛犬在公园里奔跑",
    "https://example.com/dog.jpg",
    ["动物", "狗"]
  );
  // console.log(`   添加: ${mmId}`);
  
  // 文本搜索
  // console.log("\n4. 文本搜索: '可爱的动物'");
  
  const textResults = await store.searchText("可爱的动物", 3);
  for (const r of textResults) {
    // console.log(`   - ${r.id}: ${r.score.toFixed(3)} (${r.type})`);
    if (r.text) // console.log(`     文本: ${r.text.substring(0, 30)}...`);
  }
  
  // 图像搜索
  // console.log("\n5. 图像搜索");
  
  const imageResults = await store.searchImage("https://example.com/cat.jpg", 3);
  for (const r of imageResults) {
    // console.log(`   - ${r.id}: ${r.score.toFixed(3)} (${r.type})`);
  }
  
  // 跨模态搜索
  // console.log("\n6. 跨模态搜索: 文本 → 图像");
  
  const crossResults = await store.textToImage("日落", 3);
  for (const r of crossResults) {
    // console.log(`   - ${r.id}: ${r.score.toFixed(3)}`);
    if (r.imageUrl) // console.log(`     图像: ${r.imageUrl}`);
  }
  
  // 统计信息
  // console.log("\n7. 统计信息");
  
  const stats = store.getStats();
  // console.log(`   总条目: ${stats.totalEntries}`);
  // console.log(`   纯文本: ${stats.textOnly}`);
  // console.log(`   纯图像: ${stats.imageOnly}`);
  // console.log(`   多模态: ${stats.multimodal}`);
  // console.log(`   标签: ${stats.tags.join(", ")}`);
  
  // 保存
  // console.log("\n8. 保存存储");
  
  const savedPath = store.save();
  // console.log(`   已保存: ${savedPath}`);
  
  // console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  demo();
}
