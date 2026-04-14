/**
 * 异步向量搜索
 * 
 * 功能：
 * 1. 异步向量搜索
 * 2. 并发请求处理
 * 3. 批量搜索优化
 */

// ============================================================
// 类型定义
// ============================================================

export interface AsyncSearchResult {
  id: string | number;
  score: number;
  distance: number;
}

export interface AsyncSearchConfig {
  maxWorkers: number;
  batchSize: number;
  timeout: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: AsyncSearchConfig = {
  maxWorkers: 4,
  batchSize: 100,
  timeout: 30000,
};

// ============================================================
// 异步向量搜索类
// ============================================================

export class AsyncVectorSearch {
  private config: AsyncSearchConfig;
  private vectors: Map<string | number, number[]> = new Map();
  private normalizedVectors: Map<string | number, number[]> = new Map();

  constructor(config: Partial<AsyncSearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 添加向量
   */
  add(id: string | number, vector: number[]): void {
    this.vectors.set(id, vector);
    this.normalizedVectors.set(id, this.normalize(vector));
  }

  /**
   * 批量添加
   */
  addBatch(items: Array<{ id: string | number; vector: number[] }>): void {
    for (const item of items) {
      this.add(item.id, item.vector);
    }
  }

  /**
   * 异步搜索
   */
  async search(
    query: number[],
    topK: number = 10
  ): Promise<AsyncSearchResult[]> {
    const normalizedQuery = this.normalize(query);
    const results: AsyncSearchResult[] = [];

    // 并行计算相似度
    const entries = Array.from(this.normalizedVectors.entries());
    const batches = this.chunk(entries, this.config.batchSize);

    const batchResults = await Promise.all(
      batches.map(batch => this.searchBatch(normalizedQuery, batch))
    );

    // 合并结果
    for (const batch of batchResults) {
      results.push(...batch);
    }

    // 排序并返回 top-k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 批量搜索
   */
  private async searchBatch(
    query: number[],
    batch: Array<[string | number, number[]]>
  ): Promise<AsyncSearchResult[]> {
    return new Promise(resolve => {
      const results: AsyncSearchResult[] = [];
      
      for (const [id, vector] of batch) {
        const score = this.cosineSimilarity(query, vector);
        const distance = 1 - score;
        results.push({ id, score, distance });
      }
      
      resolve(results);
    });
  }

  /**
   * 批量查询搜索
   */
  async batchSearch(
    queries: number[][],
    topK: number = 10
  ): Promise<AsyncSearchResult[][]> {
    return Promise.all(queries.map(q => this.search(q, topK)));
  }

  /**
   * 归一化
   */
  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map(v => v / norm);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dot = 0;
    for (let i = 0; i < vec1.length; i++) {
      dot += vec1[i] * vec2[i];
    }
    return dot;
  }

  /**
   * 分块
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 清空
   */
  clear(): void {
    this.vectors.clear();
    this.normalizedVectors.clear();
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.vectors.size;
  }
}

// ============================================================
// 异步 LLM 客户端
// ============================================================

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LLMResponse {
  content: string;
  tokens: number;
  latency: number;
}

export class AsyncLLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * 异步调用 LLM
   */
  async complete(prompt: string): Promise<LLMResponse> {
    const start = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const tokens = data.usage?.total_tokens || 0;

      return {
        content,
        tokens,
        latency: Date.now() - start,
      };
    } catch (error) {
      throw new Error(`LLM 调用失败: ${error}`);
    }
  }

  /**
   * 批量调用
   */
  async batchComplete(prompts: string[]): Promise<LLMResponse[]> {
    return Promise.all(prompts.map(p => this.complete(p)));
  }
}

// ============================================================
// 异步 Embedding 客户端
// ============================================================

export class AsyncEmbeddingClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * 异步获取 Embedding
   */
  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text,
      }),
    });

    const data = await response.json();
    return data.data?.[0]?.embedding || [];
  }

  /**
   * 批量获取 Embedding
   */
  async batchEmbed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
      }),
    });

    const data = await response.json();
    return data.data?.map((d: { embedding: number[] }) => d.embedding) || [];
  }
}

// ============================================================
// 异步记忆管道
// ============================================================

export class AsyncMemoryPipeline {
  private vectorSearch: AsyncVectorSearch;
  private llmClient: AsyncLLMClient | null = null;
  private embeddingClient: AsyncEmbeddingClient | null = null;

  constructor(
    vectorConfig?: Partial<AsyncSearchConfig>,
    llmConfig?: LLMConfig,
    embeddingConfig?: LLMConfig
  ) {
    this.vectorSearch = new AsyncVectorSearch(vectorConfig);
    if (llmConfig) {
      this.llmClient = new AsyncLLMClient(llmConfig);
    }
    if (embeddingConfig) {
      this.embeddingClient = new AsyncEmbeddingClient(embeddingConfig);
    }
  }

  /**
   * 添加记忆
   */
  async addMemory(id: string | number, content: string): Promise<void> {
    if (this.embeddingClient) {
      const embedding = await this.embeddingClient.embed(content);
      this.vectorSearch.add(id, embedding);
    }
  }

  /**
   * 搜索记忆
   */
  async searchMemory(query: string, topK: number = 10): Promise<AsyncSearchResult[]> {
    if (this.embeddingClient) {
      const queryEmbedding = await this.embeddingClient.embed(query);
      return this.vectorSearch.search(queryEmbedding, topK);
    }
    return [];
  }

  /**
   * 获取向量搜索器
   */
  getVectorSearch(): AsyncVectorSearch {
    return this.vectorSearch;
  }
}
