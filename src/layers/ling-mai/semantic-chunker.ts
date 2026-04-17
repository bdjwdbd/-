/**
 * HOPE 语义分块系统
 * 
 * 借鉴来源：LlamaIndex
 * 
 * 核心功能：
 * - Concept Unity：概念统一性
 * - Semantic Independence：语义独立性
 * - Information Preservation：信息保存度
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface Chunk {
  id: string;
  content: string;
  tokenCount: number;
  sourceId: string;
  startIndex: number;
  endIndex: number;
  metadata: {
    conceptUnity: number;
    semanticIndependence: number;
    informationPreservation: number;
    overallScore: number;
  };
}

export interface ChunkingConfig {
  chunkTokenSize: number;
  chunkOverlapTokenSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  preserveCodeBlocks: boolean;
  preserveSentences: boolean;
}

export interface HOPEMetrics {
  conceptUnity: number;
  semanticIndependence: number;
  informationPreservation: number;
}

// ============================================================================
// HOPE 评估器
// ============================================================================

export class HOPEEvaluator {
  /**
   * 评估概念统一性
   * 一个分块应尽量表达单一核心观点
   */
  evaluateConceptUnity(chunk: string): number {
    let score = 1.0;

    // 检查是否有多个主题转换
    const topicMarkers = ['但是', '然而', '另一方面', '此外', '另外', 'but', 'however', 'on the other hand', 'additionally'];
    let topicChanges = 0;
    for (const marker of topicMarkers) {
      if (chunk.toLowerCase().includes(marker.toLowerCase())) {
        topicChanges++;
      }
    }

    // 每个主题转换扣分
    score -= topicChanges * 0.15;

    // 检查段落数量
    const paragraphs = chunk.split(/\n\n+/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 3) {
      score -= (paragraphs.length - 3) * 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 评估语义独立性
   * 一个分块必须包含完整的语境
   */
  evaluateSemanticIndependence(chunk: string, original: string): number {
    let score = 1.0;

    // 检查是否有不完整的句子
    const sentences = chunk.match(/[^。！？.!?]+[。！？.!?]/g) || [];
    const incompleteSentences = chunk.split(/[。！？.!?]/).filter(s => s.trim().length > 0).length - sentences.length;
    
    if (incompleteSentences > 0) {
      score -= incompleteSentences * 0.2;
    }

    // 检查是否有代词但没有先行词
    const pronouns = ['他', '她', '它', '他们', '这', '那', 'he', 'she', 'it', 'they', 'this', 'that'];
    const hasPronouns = pronouns.some(p => chunk.includes(p));
    
    if (hasPronouns) {
      // 检查是否有先行词
      const hasAntecedent = /[A-Z][a-z]+|[\u4e00-\u9fa5]{2,4}/.test(chunk);
      if (!hasAntecedent) {
        score -= 0.3;
      }
    }

    // 检查是否以连接词开头
    const startConnectors = ['但是', '然而', '所以', '因此', '但是', 'but', 'however', 'so', 'therefore'];
    for (const connector of startConnectors) {
      if (chunk.trim().toLowerCase().startsWith(connector.toLowerCase())) {
        score -= 0.2;
        break;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 评估信息保存度
   * 切分过程中不能丢失关键信息精度
   */
  evaluateInformationPreservation(chunk: string, original: string): number {
    let score = 1.0;

    // 检查数字是否丢失
    const originalNumbers = original.match(/\d+(\.\d+)?/g) || [];
    const chunkNumbers = chunk.match(/\d+(\.\d+)?/g) || [];
    
    if (originalNumbers.length > 0) {
      const preservedRatio = chunkNumbers.length / originalNumbers.length;
      score *= preservedRatio;
    }

    // 检查专有名词是否丢失
    const originalNames = original.match(/[A-Z][a-z]+|[\u4e00-\u9fa5]{2,4}/g) || [];
    const chunkNames = chunk.match(/[A-Z][a-z]+|[\u4e00-\u9fa5]{2,4}/g) || [];
    
    if (originalNames.length > 0) {
      const preservedRatio = new Set(chunkNames).size / new Set(originalNames).size;
      score *= preservedRatio;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 综合评估
   */
  evaluate(chunk: string, original: string): HOPEMetrics {
    return {
      conceptUnity: this.evaluateConceptUnity(chunk),
      semanticIndependence: this.evaluateSemanticIndependence(chunk, original),
      informationPreservation: this.evaluateInformationPreservation(chunk, original)
    };
  }
}

// ============================================================================
// 语义分块器
// ============================================================================

export class SemanticChunker {
  private config: ChunkingConfig;
  private evaluator: HOPEEvaluator;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      chunkTokenSize: config.chunkTokenSize || 1200,
      chunkOverlapTokenSize: config.chunkOverlapTokenSize || 100,
      minChunkSize: config.minChunkSize || 200,
      maxChunkSize: config.maxChunkSize || 2000,
      preserveCodeBlocks: config.preserveCodeBlocks ?? true,
      preserveSentences: config.preserveSentences ?? true
    };
    this.evaluator = new HOPEEvaluator();
  }

  /**
   * 分块
   */
  chunk(content: string, sourceId: string): Chunk[] {
    // 1. 预处理：保护代码块
    const { processed, codeBlocks } = this.preserveCodeBlocks(content);

    // 2. 按段落分割
    const paragraphs = this.splitByParagraphs(processed);

    // 3. 合并段落为块
    const chunks = this.mergeParagraphs(paragraphs, sourceId);

    // 4. 恢复代码块
    const restoredChunks = this.restoreCodeBlocks(chunks, codeBlocks);

    // 5. 评估 HOPE 指标
    for (const chunk of restoredChunks) {
      const metrics = this.evaluator.evaluate(chunk.content, content);
      chunk.metadata = {
        conceptUnity: metrics.conceptUnity,
        semanticIndependence: metrics.semanticIndependence,
        informationPreservation: metrics.informationPreservation,
        overallScore: (metrics.conceptUnity + metrics.semanticIndependence + metrics.informationPreservation) / 3
      };
    }

    return restoredChunks;
  }

  /**
   * 保护代码块
   */
  private preserveCodeBlocks(content: string): { processed: string; codeBlocks: Map<string, string> } {
    const codeBlocks = new Map<string, string>();
    let processed = content;

    if (this.config.preserveCodeBlocks) {
      const codeBlockPattern = /```[\s\S]*?```/g;
      let match;
      let index = 0;

      while ((match = codeBlockPattern.exec(content)) !== null) {
        const placeholder = `__CODE_BLOCK_${index}__`;
        codeBlocks.set(placeholder, match[0]);
        processed = processed.replace(match[0], placeholder);
        index++;
      }
    }

    return { processed, codeBlocks };
  }

  /**
   * 按段落分割
   */
  private splitByParagraphs(content: string): string[] {
    return content
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * 合并段落为块
   */
  private mergeParagraphs(paragraphs: string[], sourceId: string): Chunk[] {
    const chunks: Chunk[] = [];
    let currentChunk: string[] = [];
    let currentTokenCount = 0;
    let startIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphTokens = this.estimateTokens(paragraph);

      // 如果单个段落超过最大大小，需要分割
      if (paragraphTokens > this.config.maxChunkSize) {
        // 先保存当前块
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk, sourceId, startIndex));
          currentChunk = [];
          currentTokenCount = 0;
          startIndex = i;
        }

        // 分割大段落
        const subChunks = this.splitLargeParagraph(paragraph, sourceId, i);
        chunks.push(...subChunks);
        continue;
      }

      // 检查是否需要创建新块
      if (currentTokenCount + paragraphTokens > this.config.chunkTokenSize && 
          currentTokenCount >= this.config.minChunkSize) {
        chunks.push(this.createChunk(currentChunk, sourceId, startIndex));
        currentChunk = [];
        currentTokenCount = 0;
        startIndex = i;
      }

      currentChunk.push(paragraph);
      currentTokenCount += paragraphTokens;
    }

    // 保存最后一个块
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, sourceId, startIndex));
    }

    return chunks;
  }

  /**
   * 分割大段落
   */
  private splitLargeParagraph(paragraph: string, sourceId: string, startIndex: number): Chunk[] {
    const chunks: Chunk[] = [];
    const sentences = this.splitBySentences(paragraph);
    let currentChunk: string[] = [];
    let currentTokenCount = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      if (currentTokenCount + sentenceTokens > this.config.chunkTokenSize && 
          currentTokenCount >= this.config.minChunkSize) {
        chunks.push(this.createChunk(currentChunk, sourceId, startIndex));
        currentChunk = [];
        currentTokenCount = 0;
      }

      currentChunk.push(sentence);
      currentTokenCount += sentenceTokens;
    }

    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, sourceId, startIndex));
    }

    return chunks;
  }

  /**
   * 按句子分割
   */
  private splitBySentences(text: string): string[] {
    return text
      .split(/(?<=[。！？.!?])\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * 恢复代码块
   */
  private restoreCodeBlocks(chunks: Chunk[], codeBlocks: Map<string, string>): Chunk[] {
    for (const chunk of chunks) {
      for (const [placeholder, code] of codeBlocks) {
        chunk.content = chunk.content.replace(placeholder, code);
      }
    }
    return chunks;
  }

  /**
   * 创建块
   */
  private createChunk(paragraphs: string[], sourceId: string, startIndex: number): Chunk {
    const content = paragraphs.join('\n\n');
    return {
      id: `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      tokenCount: this.estimateTokens(content),
      sourceId,
      startIndex,
      endIndex: startIndex + paragraphs.length - 1,
      metadata: {
        conceptUnity: 0,
        semanticIndependence: 0,
        informationPreservation: 0,
        overallScore: 0
      }
    };
  }

  /**
   * 估算 Token 数量
   */
  private estimateTokens(text: string): number {
    // 简化估算：英文约 4 字符 = 1 token，中文约 2 字符 = 1 token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }
}

// ============================================================================
// 混合检索系统
// ============================================================================

export class HybridSearch {
  private vectorIndex: Map<string, { vector: number[]; chunk: Chunk }> = new Map();
  private ftsIndex: Map<string, Set<string>> = new Map(); // 词到块 ID 的映射

  /**
   * 索引块
   */
  index(chunk: Chunk, embedding: number[]): void {
    // 向量索引
    this.vectorIndex.set(chunk.id, { vector: embedding, chunk });

    // FTS 索引
    const words = this.tokenize(chunk.content);
    for (const word of words) {
      if (!this.ftsIndex.has(word)) {
        this.ftsIndex.set(word, new Set());
      }
      this.ftsIndex.get(word)!.add(chunk.id);
    }
  }

  /**
   * 向量检索
   */
  vectorSearch(queryVector: number[], topK: number = 10): { chunk: Chunk; score: number }[] {
    const results: { chunk: Chunk; score: number }[] = [];

    for (const { vector, chunk } of this.vectorIndex.values()) {
      const score = this.cosineSimilarity(queryVector, vector);
      results.push({ chunk, score });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * FTS 检索
   */
  ftsSearch(query: string, topK: number = 10): { chunk: Chunk; score: number }[] {
    const queryWords = this.tokenize(query);
    const chunkScores = new Map<string, number>();

    for (const word of queryWords) {
      const chunkIds = this.ftsIndex.get(word);
      if (chunkIds) {
        for (const chunkId of chunkIds) {
          chunkScores.set(chunkId, (chunkScores.get(chunkId) || 0) + 1);
        }
      }
    }

    const results: { chunk: Chunk; score: number }[] = [];
    for (const [chunkId, score] of chunkScores) {
      const entry = this.vectorIndex.get(chunkId);
      if (entry) {
        results.push({ chunk: entry.chunk, score: score / queryWords.length });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * RRF 融合检索
   */
  hybridSearch(queryVector: number[], query: string, topK: number = 10): { chunk: Chunk; score: number }[] {
    const vectorResults = this.vectorSearch(queryVector, topK * 2);
    const ftsResults = this.ftsSearch(query, topK * 2);

    // RRF 融合
    const k = 60;
    const scores = new Map<string, number>();

    for (let i = 0; i < vectorResults.length; i++) {
      const chunkId = vectorResults[i].chunk.id;
      scores.set(chunkId, (scores.get(chunkId) || 0) + 1 / (k + i + 1));
    }

    for (let i = 0; i < ftsResults.length; i++) {
      const chunkId = ftsResults[i].chunk.id;
      scores.set(chunkId, (scores.get(chunkId) || 0) + 1 / (k + i + 1));
    }

    // 排序并返回
    const results: { chunk: Chunk; score: number }[] = [];
    for (const [chunkId, score] of scores) {
      const entry = this.vectorIndex.get(chunkId);
      if (entry) {
        results.push({ chunk: entry.chunk, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s\n\r\t,，。！？、；：""''（）【】《》\.\!\?\,\;\:\(\)\[\]]+/)
      .filter(w => w.length > 0);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
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
}

// 默认导出
export default SemanticChunker;
