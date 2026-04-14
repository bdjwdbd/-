/**
 * 结果摘要器
 * 
 * 功能：
 * 1. LLM 生成结果摘要
 * 2. 关键信息提取
 * 3. 多结果整合
 */

// ============================================================
// 类型定义
// ============================================================

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  totalResults: number;
  timeRange?: { start: number; end: number };
  confidence: number;
}

export interface SummarizerConfig {
  maxSummaryLength: number;
  maxKeyPoints: number;
  enableLLM: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: SummarizerConfig = {
  maxSummaryLength: 300,
  maxKeyPoints: 5,
  enableLLM: true,
};

// ============================================================
// 结果摘要器
// ============================================================

export class ResultSummarizer {
  private config: SummarizerConfig;

  constructor(config: Partial<SummarizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 摘要多个结果
   */
  summarize(
    query: string,
    results: Array<{ id: string; content: string; score: number; timestamp?: number }>
  ): SummaryResult {
    if (results.length === 0) {
      return {
        summary: '未找到相关结果',
        keyPoints: [],
        totalResults: 0,
        confidence: 0,
      };
    }

    // 提取关键点
    const keyPoints = this.extractKeyPoints(results);
    
    // 生成摘要
    const summary = this.generateSummary(query, results, keyPoints);
    
    // 计算时间范围
    const timestamps = results
      .filter(r => r.timestamp !== undefined)
      .map(r => r.timestamp!);
    const timeRange = timestamps.length > 0 
      ? { start: Math.min(...timestamps), end: Math.max(...timestamps) }
      : undefined;
    
    // 计算置信度
    const confidence = this.calculateConfidence(results);

    return {
      summary,
      keyPoints: keyPoints.slice(0, this.config.maxKeyPoints),
      totalResults: results.length,
      timeRange,
      confidence,
    };
  }

  /**
   * 提取关键点
   */
  private extractKeyPoints(
    results: Array<{ id: string; content: string; score: number }>
  ): string[] {
    const points: string[] = [];
    const seen = new Set<string>();

    for (const result of results) {
      // 提取句子
      const sentences = result.content.split(/[。！？.!?]+/).filter(s => s.trim().length > 10);
      
      for (const sentence of sentences) {
        const normalized = sentence.trim().toLowerCase();
        
        // 去重
        if (seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);

        // 检查是否是关键句
        if (this.isKeySentence(sentence)) {
          points.push(sentence.trim());
          
          if (points.length >= this.config.maxKeyPoints) {
            return points;
          }
        }
      }
    }

    return points;
  }

  /**
   * 判断是否是关键句
   */
  private isKeySentence(sentence: string): boolean {
    // 包含关键信息标记
    const keyPatterns = [
      /重要|关键|核心|主要/,
      /规则|策略|配置|设置/,
      /必须|需要|要求/,
      /注意|警告|风险/,
      /总结|结论|结果/,
    ];

    for (const pattern of keyPatterns) {
      if (pattern.test(sentence)) {
        return true;
      }
    }

    // 长度适中
    return sentence.length >= 20 && sentence.length <= 100;
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    query: string,
    results: Array<{ id: string; content: string; score: number }>,
    keyPoints: string[]
  ): string {
    const parts: string[] = [];

    // 结果数量
    parts.push(`找到 ${results.length} 条相关结果`);

    // 平均相关性
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    if (avgScore > 0.7) {
      parts.push('，整体相关性较高');
    } else if (avgScore > 0.5) {
      parts.push('，部分结果相关');
    }

    // 关键点
    if (keyPoints.length > 0) {
      parts.push('。主要信息: ');
      parts.push(keyPoints.slice(0, 3).join('；'));
    }

    return parts.join('').slice(0, this.config.maxSummaryLength);
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    results: Array<{ id: string; content: string; score: number }>
  ): number {
    if (results.length === 0) {
      return 0;
    }

    // 基于结果数量和平均分数
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const countFactor = Math.min(results.length / 10, 1);
    
    return avgScore * 0.7 + countFactor * 0.3;
  }

  /**
   * 生成简短摘要
   */
  summarizeBrief(
    query: string,
    results: Array<{ id: string; content: string; score: number }>
  ): string {
    if (results.length === 0) {
      return '无结果';
    }

    const topResult = results[0];
    const preview = topResult.content.slice(0, 50);
    
    return `找到 ${results.length} 条结果，最相关: "${preview}..."`;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SummarizerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
