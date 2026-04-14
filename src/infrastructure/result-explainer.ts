/**
 * 结果解释器
 * 
 * 功能：
 * 1. LLM 生成结果解释
 * 2. 相关性说明
 * 3. 匹配原因分析
 */

// ============================================================
// 类型定义
// ============================================================

export interface ExplanationResult {
  resultId: string;
  explanation: string;
  relevanceScore: number;
  matchReasons: string[];
  confidence: number;
}

export interface ExplainerConfig {
  maxExplanationLength: number;
  maxReasons: number;
  enableLLM: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: ExplainerConfig = {
  maxExplanationLength: 200,
  maxReasons: 3,
  enableLLM: true,
};

// ============================================================
// 结果解释器
// ============================================================

export class ResultExplainer {
  private config: ExplainerConfig;

  constructor(config: Partial<ExplainerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 解释单个结果
   */
  explain(
    query: string,
    result: { id: string; content: string; score: number },
    keywords: string[] = []
  ): ExplanationResult {
    // 分析匹配原因
    const matchReasons = this.analyzeMatchReasons(query, result.content, keywords);
    
    // 计算相关性分数
    const relevanceScore = this.calculateRelevance(query, result.content, result.score);
    
    // 生成解释
    const explanation = this.generateExplanation(query, result, matchReasons);
    
    // 计算置信度
    const confidence = this.calculateConfidence(matchReasons, relevanceScore);

    return {
      resultId: result.id,
      explanation,
      relevanceScore,
      matchReasons: matchReasons.slice(0, this.config.maxReasons),
      confidence,
    };
  }

  /**
   * 批量解释
   */
  explainBatch(
    query: string,
    results: Array<{ id: string; content: string; score: number }>,
    keywords: string[] = []
  ): ExplanationResult[] {
    return results.map(r => this.explain(query, r, keywords));
  }

  /**
   * 分析匹配原因
   */
  private analyzeMatchReasons(
    query: string,
    content: string,
    keywords: string[]
  ): string[] {
    const reasons: string[] = [];

    // 关键词匹配
    const matchedKeywords = keywords.filter(k => 
      content.toLowerCase().includes(k.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      reasons.push(`包含关键词: ${matchedKeywords.slice(0, 3).join(', ')}`);
    }

    // 语义相似
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    const overlap = [...queryWords].filter(w => contentWords.has(w) && w.length > 2);
    if (overlap.length > 0) {
      reasons.push(`语义相关: ${overlap.slice(0, 3).join(', ')}`);
    }

    // 主题匹配
    const topic = this.detectTopic(content);
    if (topic) {
      reasons.push(`主题: ${topic}`);
    }

    return reasons;
  }

  /**
   * 检测主题
   */
  private detectTopic(content: string): string | null {
    const topics: Record<string, RegExp> = {
      '技术文档': /代码|API|接口|函数|配置/,
      '业务规则': /规则|策略|流程|条件/,
      '用户指南': /如何|怎么|步骤|操作/,
      '概念解释': /是什么|定义|概念|原理/,
    };

    for (const [topic, pattern] of Object.entries(topics)) {
      if (pattern.test(content)) {
        return topic;
      }
    }

    return null;
  }

  /**
   * 计算相关性
   */
  private calculateRelevance(query: string, content: string, score: number): number {
    // 基础分数
    let relevance = score;

    // 长度惩罚
    if (content.length < 50) {
      relevance *= 0.8;
    } else if (content.length > 500) {
      relevance *= 0.9;
    }

    // 关键词密度
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    const density = queryWords.filter(w => contentLower.includes(w)).length / queryWords.length;
    relevance *= (0.5 + density * 0.5);

    return Math.min(relevance, 1);
  }

  /**
   * 生成解释
   */
  private generateExplanation(
    query: string,
    result: { id: string; content: string; score: number },
    reasons: string[]
  ): string {
    const parts: string[] = [];

    // 相关性描述
    if (result.score > 0.8) {
      parts.push('高度相关');
    } else if (result.score > 0.5) {
      parts.push('相关');
    } else {
      parts.push('部分相关');
    }

    // 匹配原因
    if (reasons.length > 0) {
      parts.push(`，${reasons[0]}`);
    }

    // 内容摘要
    const summary = result.content.slice(0, 100);
    parts.push(`。内容: "${summary}..."`);

    return parts.join('').slice(0, this.config.maxExplanationLength);
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(reasons: string[], relevance: number): number {
    let confidence = 0.5;

    // 原因数量
    confidence += Math.min(reasons.length * 0.1, 0.3);

    // 相关性
    confidence += relevance * 0.2;

    return Math.min(confidence, 1);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExplainerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
