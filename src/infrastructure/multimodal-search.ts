/**
 * 多模态搜索
 * 
 * 功能：
 * 1. 图像编码
 * 2. 音频编码
 * 3. 跨模态搜索
 */

// ============================================================
// 类型定义
// ============================================================

export type ModalityType = 'text' | 'image' | 'audio' | 'video';

export interface MultimodalContent {
  type: ModalityType;
  data: string | Buffer;
  metadata?: Record<string, unknown>;
}

export interface MultimodalEmbedding {
  id: string;
  type: ModalityType;
  embedding: number[];
  content: MultimodalContent;
}

export interface MultimodalSearchResult {
  id: string;
  type: ModalityType;
  score: number;
  content: MultimodalContent;
}

export interface MultimodalEncoderConfig {
  textEncoder?: (text: string) => Promise<number[]>;
  imageEncoder?: (image: Buffer) => Promise<number[]>;
  audioEncoder?: (audio: Buffer) => Promise<number[]>;
  embeddingDim: number;
}

// ============================================================
// 多模态编码器
// ============================================================

export class MultimodalEncoder {
  private config: MultimodalEncoderConfig;

  constructor(config: Partial<MultimodalEncoderConfig> = {}) {
    this.config = {
      embeddingDim: config.embeddingDim || 512,
      ...config,
    };
  }

  /**
   * 编码文本
   */
  async encodeText(text: string): Promise<number[]> {
    if (this.config.textEncoder) {
      return this.config.textEncoder(text);
    }
    
    // 简单文本编码（词袋模型）
    return this.simpleTextEncode(text);
  }

  /**
   * 编码图像
   */
  async encodeImage(image: Buffer): Promise<number[]> {
    if (this.config.imageEncoder) {
      return this.config.imageEncoder(image);
    }
    
    // 简单图像编码（颜色直方图）
    return this.simpleImageEncode(image);
  }

  /**
   * 编码音频
   */
  async encodeAudio(audio: Buffer): Promise<number[]> {
    if (this.config.audioEncoder) {
      return this.config.audioEncoder(audio);
    }
    
    // 简单音频编码
    return this.simpleAudioEncode(audio);
  }

  /**
   * 编码任意类型
   */
  async encode(content: MultimodalContent): Promise<number[]> {
    switch (content.type) {
      case 'text':
        return this.encodeText(content.data as string);
      case 'image':
        return this.encodeImage(content.data as Buffer);
      case 'audio':
        return this.encodeAudio(content.data as Buffer);
      default:
        throw new Error(`不支持的类型: ${content.type}`);
    }
  }

  /**
   * 简单文本编码
   */
  private simpleTextEncode(text: string): number[] {
    const embedding = new Array(this.config.embeddingDim).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      const index = Math.abs(hash) % this.config.embeddingDim;
      embedding[index] += 1;
    }
    
    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? embedding.map(v => v / norm) : embedding;
  }

  /**
   * 简单图像编码
   */
  private simpleImageEncode(image: Buffer): number[] {
    const embedding = new Array(this.config.embeddingDim).fill(0);
    
    // 颜色直方图
    const colorCounts = new Array(64).fill(0);
    
    for (let i = 0; i < image.length; i += 3) {
      const r = Math.floor((image[i] || 0) / 64);
      const g = Math.floor((image[i + 1] || 0) / 64);
      const b = Math.floor((image[i + 2] || 0) / 64);
      const bin = r * 16 + g * 4 + b;
      colorCounts[bin % 64]++;
    }
    
    // 复制到嵌入向量
    for (let i = 0; i < Math.min(64, this.config.embeddingDim); i++) {
      embedding[i] = colorCounts[i] / (image.length / 3);
    }
    
    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? embedding.map(v => v / norm) : embedding;
  }

  /**
   * 简单音频编码
   */
  private simpleAudioEncode(audio: Buffer): number[] {
    const embedding = new Array(this.config.embeddingDim).fill(0);
    
    // 简单频谱特征
    const chunkSize = Math.floor(audio.length / this.config.embeddingDim);
    
    for (let i = 0; i < this.config.embeddingDim; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, audio.length);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += Math.abs(audio[j] - 128);
      }
      embedding[i] = sum / (end - start);
    }
    
    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? embedding.map(v => v / norm) : embedding;
  }

  /**
   * 设置文本编码器
   */
  setTextEncoder(encoder: (text: string) => Promise<number[]>): void {
    this.config.textEncoder = encoder;
  }

  /**
   * 设置图像编码器
   */
  setImageEncoder(encoder: (image: Buffer) => Promise<number[]>): void {
    this.config.imageEncoder = encoder;
  }

  /**
   * 设置音频编码器
   */
  setAudioEncoder(encoder: (audio: Buffer) => Promise<number[]>): void {
    this.config.audioEncoder = encoder;
  }
}

// ============================================================
// 多模态搜索器
// ============================================================

export class MultimodalSearcher {
  private encoder: MultimodalEncoder;
  private embeddings: Map<string, MultimodalEmbedding> = new Map();

  constructor(encoder: MultimodalEncoder) {
    this.encoder = encoder;
  }

  /**
   * 添加内容
   */
  async add(id: string, content: MultimodalContent): Promise<void> {
    const embedding = await this.encoder.encode(content);
    this.embeddings.set(id, { id, type: content.type, embedding, content });
  }

  /**
   * 批量添加
   */
  async addBatch(items: Array<{ id: string; content: MultimodalContent }>): Promise<void> {
    for (const item of items) {
      await this.add(item.id, item.content);
    }
  }

  /**
   * 搜索
   */
  async search(
    query: MultimodalContent,
    topK: number = 10,
    filter?: { type?: ModalityType }
  ): Promise<MultimodalSearchResult[]> {
    const queryEmbedding = await this.encoder.encode(query);
    const results: MultimodalSearchResult[] = [];

    for (const [id, item] of this.embeddings) {
      // 类型过滤
      if (filter?.type && item.type !== filter.type) {
        continue;
      }

      const score = this.cosineSimilarity(queryEmbedding, item.embedding);
      results.push({
        id,
        type: item.type,
        score,
        content: item.content,
      });
    }

    // 排序并返回 top-k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 跨模态搜索
   */
  async crossModalSearch(
    textQuery?: string,
    imageQuery?: Buffer,
    audioQuery?: Buffer,
    topK: number = 10
  ): Promise<MultimodalSearchResult[]> {
    const queries: Array<{ embedding: number[]; weight: number }> = [];

    if (textQuery) {
      const embedding = await this.encoder.encodeText(textQuery);
      queries.push({ embedding, weight: 1.0 });
    }

    if (imageQuery) {
      const embedding = await this.encoder.encodeImage(imageQuery);
      queries.push({ embedding, weight: 0.8 });
    }

    if (audioQuery) {
      const embedding = await this.encoder.encodeAudio(audioQuery);
      queries.push({ embedding, weight: 0.6 });
    }

    if (queries.length === 0) {
      return [];
    }

    // 合并查询
    const combinedEmbedding = new Array(this.encoder['config'].embeddingDim).fill(0);
    let totalWeight = 0;

    for (const { embedding, weight } of queries) {
      for (let i = 0; i < combinedEmbedding.length; i++) {
        combinedEmbedding[i] += embedding[i] * weight;
      }
      totalWeight += weight;
    }

    for (let i = 0; i < combinedEmbedding.length; i++) {
      combinedEmbedding[i] /= totalWeight;
    }

    // 搜索
    const results: MultimodalSearchResult[] = [];
    for (const [id, item] of this.embeddings) {
      const score = this.cosineSimilarity(combinedEmbedding, item.embedding);
      results.push({
        id,
        type: item.type,
        score,
        content: item.content,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dot += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    return norm1 && norm2 ? dot / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0;
  }

  /**
   * 删除
   */
  remove(id: string): boolean {
    return this.embeddings.delete(id);
  }

  /**
   * 清空
   */
  clear(): void {
    this.embeddings.clear();
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.embeddings.size;
  }
}
