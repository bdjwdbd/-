/**
 * 跨语言搜索模块
 * 
 * 功能：
 * 1. 语言检测
 * 2. 跨语言编码
 * 3. 跨语言搜索
 */

// ============================================================
// 类型定义
// ============================================================

export type LanguageCode = 'zh' | 'en' | 'ja' | 'ko' | 'ru' | 'ar' | 'unknown';

export interface CrossLingualConfig {
  model: string;
  supportedLanguages: LanguageCode[];
  embeddingDim: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: CrossLingualConfig = {
  model: 'multilingual-e5-base',
  supportedLanguages: ['zh', 'en', 'ja', 'ko', 'ru', 'ar'],
  embeddingDim: 768,
};

// ============================================================
// 语言检测器
// ============================================================

export class LanguageDetector {
  private languageFeatures: Map<LanguageCode, RegExp>;

  constructor() {
    this.languageFeatures = new Map([
      ['zh', /[\u4e00-\u9fff]/],
      ['en', /[a-zA-Z]/],
      ['ja', /[\u3040-\u309f\u30a0-\u30ff]/],
      ['ko', /[\uac00-\ud7af]/],
      ['ru', /[\u0400-\u04ff]/],
      ['ar', /[\u0600-\u06ff]/],
    ]);
  }

  /**
   * 检测语言
   */
  detect(text: string): LanguageCode {
    const counts: Map<LanguageCode, number> = new Map();

    for (const [lang, pattern] of this.languageFeatures) {
      const matches = text.match(pattern);
      counts.set(lang, matches ? matches.length : 0);
    }

    // 返回最多的语言
    let maxLang: LanguageCode = 'unknown';
    let maxCount = 0;

    for (const [lang, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxLang = lang;
      }
    }

    return maxCount > 0 ? maxLang : 'unknown';
  }

  /**
   * 检测是否为中文
   */
  isChinese(text: string): boolean {
    return this.detect(text) === 'zh';
  }

  /**
   * 检测是否为英文
   */
  isEnglish(text: string): boolean {
    return this.detect(text) === 'en';
  }

  /**
   * 获取语言名称
   */
  getLanguageName(code: LanguageCode): string {
    const names: Record<LanguageCode, string> = {
      zh: '中文',
      en: '英文',
      ja: '日文',
      ko: '韩文',
      ru: '俄文',
      ar: '阿拉伯文',
      unknown: '未知',
    };
    return names[code];
  }
}

// ============================================================
// 跨语言编码器
// ============================================================

export class CrossLingualEncoder {
  private config: CrossLingualConfig;
  private detector: LanguageDetector;
  private encoder?: (text: string) => Promise<number[]>;

  constructor(config: Partial<CrossLingualConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.detector = new LanguageDetector();
  }

  /**
   * 设置编码器
   */
  setEncoder(encoder: (text: string) => Promise<number[]>): void {
    this.encoder = encoder;
  }

  /**
   * 编码文本
   */
  async encode(text: string, language?: LanguageCode): Promise<number[]> {
    // 检测语言
    const detectedLang = language || this.detector.detect(text);

    // 使用自定义编码器
    if (this.encoder) {
      return this.encoder(text);
    }

    // 简化实现：基于文本特征的向量
    return this.simpleEncode(text, detectedLang);
  }

  /**
   * 简单编码
   */
  private simpleEncode(text: string, language: LanguageCode): number[] {
    const embedding = new Array(this.config.embeddingDim).fill(0);

    // 语言特征
    const langOffset = this.getLanguageOffset(language);

    // 字符特征
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode + langOffset) % this.config.embeddingDim;
      embedding[index] += 1;
    }

    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? embedding.map(v => v / norm) : embedding;
  }

  /**
   * 获取语言偏移
   */
  private getLanguageOffset(language: LanguageCode): number {
    const offsets: Record<LanguageCode, number> = {
      zh: 0,
      en: 128,
      ja: 256,
      ko: 384,
      ru: 512,
      ar: 640,
      unknown: 0,
    };
    return offsets[language];
  }

  /**
   * 批量编码
   */
  async encodeBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.encode(t)));
  }

  /**
   * 获取支持的语言
   */
  getSupportedLanguages(): LanguageCode[] {
    return [...this.config.supportedLanguages];
  }
}

// ============================================================
// 跨语言搜索器
// ============================================================

export class CrossLingualSearcher {
  private encoder: CrossLingualEncoder;
  private detector: LanguageDetector;
  private embeddings: Map<string, { embedding: number[]; language: LanguageCode; content: string }> = new Map();

  constructor(encoder: CrossLingualEncoder) {
    this.encoder = encoder;
    this.detector = new LanguageDetector();
  }

  /**
   * 添加文档
   */
  async add(id: string, content: string): Promise<void> {
    const language = this.detector.detect(content);
    const embedding = await this.encoder.encode(content, language);
    this.embeddings.set(id, { embedding, language, content });
  }

  /**
   * 批量添加
   */
  async addBatch(items: Array<{ id: string; content: string }>): Promise<void> {
    for (const item of items) {
      await this.add(item.id, item.content);
    }
  }

  /**
   * 跨语言搜索
   */
  async search(
    query: string,
    topK: number = 10,
    crossLingual: boolean = true
  ): Promise<Array<{ id: string; score: number; language: LanguageCode }>> {
    const queryLang = this.detector.detect(query);
    const queryEmbedding = await this.encoder.encode(query, queryLang);

    const results: Array<{ id: string; score: number; language: LanguageCode }> = [];

    for (const [id, data] of this.embeddings) {
      // 跨语言搜索：所有语言
      // 单语言搜索：仅相同语言
      if (!crossLingual && data.language !== queryLang) {
        continue;
      }

      const score = this.cosineSimilarity(queryEmbedding, data.embedding);
      results.push({ id, score, language: data.language });
    }

    // 排序
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
