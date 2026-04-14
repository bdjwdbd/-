/**
 * 语义去重
 * 
 * 功能：
 * 1. 基于内容相似度去重
 * 2. 基于向量相似度去重
 * 3. 保留最高分结果
 */

// ============================================================
// 类型定义
// ============================================================

export interface DedupConfig {
  contentSimilarityThreshold: number;   // 内容相似度阈值
  vectorSimilarityThreshold: number;    // 向量相似度阈值
  minContentLength: number;             // 最小内容长度
}

export interface DedupResult<T> {
  items: T[];
  duplicates: Array<{ original: T; duplicate: T; similarity: number }>;
  removedCount: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: DedupConfig = {
  contentSimilarityThreshold: 0.85,
  vectorSimilarityThreshold: 0.95,
  minContentLength: 10,
};

// ============================================================
// 语义去重器
// ============================================================

export class SemanticDedup<T extends { id: string; content: string; score?: number }> {
  private config: DedupConfig;

  constructor(config: Partial<DedupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 去重
   */
  dedup(items: T[]): DedupResult<T> {
    const duplicates: Array<{ original: T; duplicate: T; similarity: number }> = [];
    const kept: T[] = [];
    const seen = new Set<string>();

    // 按分数排序（保留高分）
    const sorted = [...items].sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      return scoreB - scoreA;
    });

    for (const item of sorted) {
      if (seen.has(item.id)) {
        continue;
      }

      // 检查是否与已保留的重复
      let isDuplicate = false;
      for (const keptItem of kept) {
        const similarity = this.calculateContentSimilarity(item.content, keptItem.content);
        if (similarity >= this.config.contentSimilarityThreshold) {
          duplicates.push({
            original: keptItem,
            duplicate: item,
            similarity,
          });
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        kept.push(item);
        seen.add(item.id);
      }
    }

    return {
      items: kept,
      duplicates,
      removedCount: items.length - kept.length,
    };
  }

  /**
   * 基于向量的去重
   */
  dedupWithVectors(
    items: Array<T & { vector?: number[] }>
  ): DedupResult<T & { vector?: number[] }> {
    const duplicates: Array<{ original: T & { vector?: number[] }; duplicate: T & { vector?: number[] }; similarity: number }> = [];
    const kept: Array<T & { vector?: number[] }> = [];
    const seen = new Set<string>();

    // 按分数排序
    const sorted = [...items].sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      return scoreB - scoreA;
    });

    for (const item of sorted) {
      if (seen.has(item.id)) {
        continue;
      }

      let isDuplicate = false;
      for (const keptItem of kept) {
        // 优先使用向量相似度
        if (item.vector && keptItem.vector) {
          const similarity = this.calculateVectorSimilarity(item.vector, keptItem.vector);
          if (similarity >= this.config.vectorSimilarityThreshold) {
            duplicates.push({
              original: keptItem,
              duplicate: item,
              similarity,
            });
            isDuplicate = true;
            break;
          }
        } else {
          // 回退到内容相似度
          const similarity = this.calculateContentSimilarity(item.content, keptItem.content);
          if (similarity >= this.config.contentSimilarityThreshold) {
            duplicates.push({
              original: keptItem,
              duplicate: item,
              similarity,
            });
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        kept.push(item);
        seen.add(item.id);
      }
    }

    return {
      items: kept,
      duplicates,
      removedCount: items.length - kept.length,
    };
  }

  /**
   * 计算内容相似度（Jaccard）
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(this.tokenize(content1));
    const words2 = new Set(this.tokenize(content2));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }

  /**
   * 计算向量相似度（余弦）
   */
  private calculateVectorSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    // 简单分词：按空格和标点分割
    return text
      .toLowerCase()
      .split(/[\s,，。！？!?.;；：:""''「」【】()（）]+/)
      .filter(w => w.length >= this.config.minContentLength);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DedupConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): DedupConfig {
    return { ...this.config };
  }
}
