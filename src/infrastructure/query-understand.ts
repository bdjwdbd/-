/**
 * 查询理解
 * 
 * 功能：
 * 1. 意图识别
 * 2. 实体提取
 * 3. 查询分类
 */

// ============================================================
// 类型定义
// ============================================================

export type QueryIntent = 'search' | 'config' | 'explain' | 'compare' | 'unknown';

export interface QueryUnderstanding {
  intent: QueryIntent;
  entities: string[];
  keywords: string[];
  category: string;
  confidence: number;
  originalQuery: string;
  normalizedQuery: string;
}

export interface UnderstandConfig {
  enableEntityExtraction: boolean;
  enableIntentClassification: boolean;
  minConfidence: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: UnderstandConfig = {
  enableEntityExtraction: true,
  enableIntentClassification: true,
  minConfidence: 0.5,
};

// ============================================================
// 意图模式
// ============================================================

const INTENT_PATTERNS: Record<QueryIntent, RegExp[]> = {
  search: [
    /[查找搜索找一下有没有]/,
    /什么|哪些|如何|怎么/,
  ],
  config: [
    /[配置设置修改更新]/,
    /如何配置|怎么设置/,
  ],
  explain: [
    /[解释说明介绍是什么]/,
    /为什么|原因|原理/,
  ],
  compare: [
    /[对比比较区别差异]/,
    /vs|和.*区别|哪个好/,
  ],
  unknown: [],
};

// ============================================================
// 查询理解器
// ============================================================

export class QueryUnderstand {
  private config: UnderstandConfig;

  constructor(config: Partial<UnderstandConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 理解查询
   */
  understand(query: string): QueryUnderstanding {
    const normalizedQuery = this.normalizeQuery(query);
    
    // 意图识别
    const intent = this.classifyIntent(normalizedQuery);
    
    // 实体提取
    const entities = this.config.enableEntityExtraction 
      ? this.extractEntities(normalizedQuery) 
      : [];
    
    // 关键词提取
    const keywords = this.extractKeywords(normalizedQuery);
    
    // 分类
    const category = this.categorize(normalizedQuery, intent);
    
    // 置信度
    const confidence = this.calculateConfidence(intent, entities, keywords);

    return {
      intent,
      entities,
      keywords,
      category,
      confidence,
      originalQuery: query,
      normalizedQuery,
    };
  }

  /**
   * 归一化查询
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 分类意图
   */
  private classifyIntent(query: string): QueryIntent {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (intent === 'unknown') continue;
      
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return intent as QueryIntent;
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * 提取实体
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];

    // 引号内容
    const quotedMatches = query.match(/[""「」『』]([^""「」『』]+)[""「」『』]/g);
    if (quotedMatches) {
      quotedMatches.forEach(m => {
        const entity = m.replace(/[""「」『』]/g, '');
        if (entity.length > 0) {
          entities.push(entity);
        }
      });
    }

    // 大写英文
    const capitalMatches = query.match(/[A-Z][a-z]+/g);
    if (capitalMatches) {
      entities.push(...capitalMatches);
    }

    // 中文专有名词（简单规则：2-4字的词组）
    const chineseMatches = query.match(/[\u4e00-\u9fa5]{2,4}/g);
    if (chineseMatches) {
      // 过滤常见词
      const commonWords = new Set(['什么', '怎么', '如何', '为什么', '哪些', '那个', '这个']);
      chineseMatches
        .filter(w => !commonWords.has(w))
        .forEach(w => entities.push(w));
    }

    return [...new Set(entities)];
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    ]);

    const words = query.split(/[\s,，。！？!?.;；：:""''「」【】()（）]+/);
    return words
      .filter(w => w.length > 1 && !stopWords.has(w.toLowerCase()))
      .slice(0, 10);
  }

  /**
   * 分类
   */
  private categorize(query: string, intent: QueryIntent): string {
    // 技术类
    if (/[代码编程开发api接口配置]/.test(query)) {
      return 'technical';
    }
    
    // 业务类
    if (/[业务流程规则策略]/.test(query)) {
      return 'business';
    }
    
    // 概念类
    if (/[是什么意思定义概念]/.test(query)) {
      return 'conceptual';
    }
    
    // 操作类
    if (/[如何怎么操作步骤]/.test(query)) {
      return 'operational';
    }
    
    return 'general';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    intent: QueryIntent,
    entities: string[],
    keywords: string[]
  ): number {
    let confidence = 0.5;

    // 意图明确
    if (intent !== 'unknown') {
      confidence += 0.2;
    }

    // 有实体
    if (entities.length > 0) {
      confidence += Math.min(entities.length * 0.1, 0.2);
    }

    // 有关键词
    if (keywords.length > 0) {
      confidence += Math.min(keywords.length * 0.05, 0.1);
    }

    return Math.min(confidence, 1);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UnderstandConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
