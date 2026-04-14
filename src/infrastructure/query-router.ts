/**
 * 智能查询路由
 * 
 * 功能：
 * 1. 查询复杂度分析
 * 2. 模式选择（fast/balanced/full）
 * 3. 资源预估
 */

// ============================================================
// 类型定义
// ============================================================

export type SearchMode = 'fast' | 'balanced' | 'full';

export interface QueryAnalysis {
  complexity: number;        // 0-1 复杂度分数
  wordCount: number;         // 词数
  hasQuestion: boolean;      // 是否包含问句
  hasComparison: boolean;    // 是否包含比较
  hasExplanation: boolean;   // 是否需要解释
  entities: string[];        // 识别的实体
  keywords: string[];        // 关键词
}

export interface RoutingDecision {
  mode: SearchMode;
  reason: string;
  estimatedTime: number;     // 预估时间（ms）
  useLLM: boolean;           // 是否使用 LLM
  useVector: boolean;        // 是否使用向量搜索
  useFTS: boolean;           // 是否使用 FTS
}

export interface RouterConfig {
  fastThreshold: number;     // fast 模式阈值
  fullThreshold: number;     // full 模式阈值
  enableLLM: boolean;        // 是否启用 LLM
  maxFastTime: number;       // fast 模式最大时间
  maxBalancedTime: number;   // balanced 模式最大时间
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: RouterConfig = {
  fastThreshold: 0.3,
  fullThreshold: 0.7,
  enableLLM: true,
  maxFastTime: 2000,
  maxBalancedTime: 5000,
};

// ============================================================
// 查询路由器
// ============================================================

export class QueryRouter {
  private config: RouterConfig;

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 分析查询复杂度
   */
  analyzeQuery(query: string): QueryAnalysis {
    const words = query.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // 检测问句
    const questionPatterns = /[？?如何怎么为什么什么哪些怎样]/;
    const hasQuestion = questionPatterns.test(query);

    // 检测比较
    const comparisonPatterns = /[对比比较区别差异vs和与]/;
    const hasComparison = comparisonPatterns.test(query);

    // 检测解释需求
    const explanationPatterns = /[解释说明详细介绍原理]/;
    const hasExplanation = explanationPatterns.test(query);

    // 提取关键词
    const keywords = this.extractKeywords(query);

    // 提取实体
    const entities = this.extractEntities(query);

    // 计算复杂度
    let complexity = 0;
    complexity += Math.min(wordCount / 20, 0.3);  // 词数贡献
    complexity += hasQuestion ? 0.2 : 0;
    complexity += hasComparison ? 0.3 : 0;
    complexity += hasExplanation ? 0.2 : 0;
    complexity = Math.min(complexity, 1);

    return {
      complexity,
      wordCount,
      hasQuestion,
      hasComparison,
      hasExplanation,
      entities,
      keywords,
    };
  }

  /**
   * 路由决策
   */
  route(query: string): RoutingDecision {
    const analysis = this.analyzeQuery(query);

    // 根据复杂度选择模式
    let mode: SearchMode;
    let reason: string;
    let estimatedTime: number;
    let useLLM = this.config.enableLLM;
    let useVector = true;
    let useFTS = true;

    if (analysis.complexity < this.config.fastThreshold) {
      // Fast 模式：简单查询
      mode = 'fast';
      reason = '简单查询，使用快速模式';
      estimatedTime = 500;
      useLLM = false;
    } else if (analysis.complexity > this.config.fullThreshold) {
      // Full 模式：复杂查询
      mode = 'full';
      reason = '复杂查询，使用完整模式';
      estimatedTime = 10000;
    } else {
      // Balanced 模式：中等查询
      mode = 'balanced';
      reason = '中等复杂度，使用平衡模式';
      estimatedTime = 3000;
    }

    // 根据查询特征调整
    if (analysis.hasComparison) {
      mode = 'full';
      reason = '包含比较，升级为完整模式';
      estimatedTime = 12000;
    }

    if (analysis.hasExplanation && mode === 'fast') {
      mode = 'balanced';
      reason = '需要解释，升级为平衡模式';
      estimatedTime = 4000;
    }

    return {
      mode,
      reason,
      estimatedTime,
      useLLM,
      useVector,
      useFTS,
    };
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string[] {
    // 停用词
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
   * 提取实体
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];
    
    // 识别引号内容
    const quotedMatches = query.match(/[""「」『』]([^""「」『』]+)[""「」『』]/g);
    if (quotedMatches) {
      quotedMatches.forEach(m => {
        const entity = m.replace(/[""「」『』]/g, '');
        if (entity.length > 0) {
          entities.push(entity);
        }
      });
    }

    // 识别大写开头的英文
    const capitalMatches = query.match(/[A-Z][a-z]+/g);
    if (capitalMatches) {
      entities.push(...capitalMatches);
    }

    return [...new Set(entities)];
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): RouterConfig {
    return { ...this.config };
  }
}
