/**
 * RRF 融合排序
 * 
 * 功能：
 * 1. 向量搜索结果
 * 2. FTS 搜索结果
 * 3. LLM 重排序结果
 * 4. RRF 算法融合
 */

// ============================================================
// 类型定义
// ============================================================

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  source: 'vector' | 'fts' | 'llm';
  metadata?: Record<string, unknown>;
}

export interface RRFConfig {
  k: number;              // RRF 参数 k
  vectorWeight: number;   // 向量权重
  ftsWeight: number;      // FTS 权重
  llmWeight: number;      // LLM 权重
  maxResults: number;     // 最大结果数
}

export interface FusionResult {
  id: string;
  content: string;
  finalScore: number;
  vectorScore: number;
  ftsScore: number;
  llmScore: number;
  rank: number;
  metadata?: Record<string, unknown>;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: RRFConfig = {
  k: 60,                  // 标准 RRF 参数
  vectorWeight: 0.6,
  ftsWeight: 0.3,
  llmWeight: 0.1,
  maxResults: 20,
};

// ============================================================
// RRF 融合器
// ============================================================

export class RRFFusion {
  private config: RRFConfig;

  constructor(config: Partial<RRFConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 融合多个搜索结果
   */
  fuse(
    vectorResults: SearchResult[],
    ftsResults: SearchResult[],
    llmResults: SearchResult[] = []
  ): FusionResult[] {
    // 计算每个结果的 RRF 分数
    const scoreMap = new Map<string, {
      content: string;
      vectorScore: number;
      ftsScore: number;
      llmScore: number;
      metadata?: Record<string, unknown>;
    }>();

    // 处理向量结果
    vectorResults.forEach((result, index) => {
      const rrfScore = 1 / (this.config.k + index + 1);
      const weightedScore = rrfScore * this.config.vectorWeight;
      
      if (!scoreMap.has(result.id)) {
        scoreMap.set(result.id, {
          content: result.content,
          vectorScore: 0,
          ftsScore: 0,
          llmScore: 0,
          metadata: result.metadata,
        });
      }
      scoreMap.get(result.id)!.vectorScore = weightedScore;
    });

    // 处理 FTS 结果
    ftsResults.forEach((result, index) => {
      const rrfScore = 1 / (this.config.k + index + 1);
      const weightedScore = rrfScore * this.config.ftsWeight;
      
      if (!scoreMap.has(result.id)) {
        scoreMap.set(result.id, {
          content: result.content,
          vectorScore: 0,
          ftsScore: 0,
          llmScore: 0,
          metadata: result.metadata,
        });
      }
      scoreMap.get(result.id)!.ftsScore = weightedScore;
    });

    // 处理 LLM 结果
    llmResults.forEach((result, index) => {
      const rrfScore = 1 / (this.config.k + index + 1);
      const weightedScore = rrfScore * this.config.llmWeight;
      
      if (!scoreMap.has(result.id)) {
        scoreMap.set(result.id, {
          content: result.content,
          vectorScore: 0,
          ftsScore: 0,
          llmScore: 0,
          metadata: result.metadata,
        });
      }
      scoreMap.get(result.id)!.llmScore = weightedScore;
    });

    // 计算最终分数并排序
    const results: FusionResult[] = [];
    scoreMap.forEach((data, id) => {
      const finalScore = data.vectorScore + data.ftsScore + data.llmScore;
      results.push({
        id,
        content: data.content,
        finalScore,
        vectorScore: data.vectorScore,
        ftsScore: data.ftsScore,
        llmScore: data.llmScore,
        rank: 0,
        metadata: data.metadata,
      });
    });

    // 按分数排序
    results.sort((a, b) => b.finalScore - a.finalScore);

    // 设置排名
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    // 返回 top-k
    return results.slice(0, this.config.maxResults);
  }

  /**
   * 仅向量 + FTS 融合
   */
  fuseVectorAndFTS(
    vectorResults: SearchResult[],
    ftsResults: SearchResult[]
  ): FusionResult[] {
    return this.fuse(vectorResults, ftsResults, []);
  }

  /**
   * 更新权重
   */
  updateWeights(vector: number, fts: number, llm: number): void {
    const total = vector + fts + llm;
    this.config.vectorWeight = vector / total;
    this.config.ftsWeight = fts / total;
    this.config.llmWeight = llm / total;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RRFConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): RRFConfig {
    return { ...this.config };
  }
}
