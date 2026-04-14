/**
 * 查询改写
 * 
 * 功能：
 * 1. 拼写纠正
 * 2. 同义词扩展
 * 3. 语义扩展
 */

// ============================================================
// 类型定义
// ============================================================

export interface RewriteResult {
  original: string;
  rewritten: string;
  corrections: string[];
  expansions: string[];
  synonyms: string[];
}

export interface RewriterConfig {
  enableSpellingCorrection: boolean;
  enableSynonymExpansion: boolean;
  enableSemanticExpansion: boolean;
  maxExpansions: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: RewriterConfig = {
  enableSpellingCorrection: true,
  enableSynonymExpansion: true,
  enableSemanticExpansion: true,
  maxExpansions: 5,
};

// ============================================================
// 常见拼写错误
// ============================================================

const SPELLING_CORRECTIONS: Record<string, string> = {
  // 中文常见错误
  '规责': '规则',
  '配值': '配置',
  '记意': '记忆',
  '向两': '向量',
  '搜锁': '搜索',
  '查寻': '查询',
  '模形': '模型',
  '接品': '接口',
  '数剧': '数据',
  '函树': '函数',
  // 英文常见错误
  'recieve': 'receive',
  'occured': 'occurred',
  'seperate': 'separate',
  'definately': 'definitely',
  'accomodate': 'accommodate',
};

// ============================================================
// 同义词词典
// ============================================================

const SYNONYMS: Record<string, string[]> = {
  '配置': ['设置', '设定', '配置项'],
  '搜索': ['查找', '检索', '寻找'],
  '记忆': ['存储', '保存', '记录'],
  '模型': ['AI', 'LLM', '大模型'],
  '向量': ['嵌入', 'embedding', '向量表示'],
  '查询': ['搜索', '检索', '查找'],
  '规则': ['策略', '条件', '约束'],
  '用户': ['使用者', '终端用户'],
  '系统': ['平台', '框架'],
  '接口': ['API', '端点', 'endpoint'],
};

// ============================================================
// 查询改写器
// ============================================================

export class QueryRewriter {
  private config: RewriterConfig;
  private customCorrections: Map<string, string> = new Map();
  private customSynonyms: Map<string, string[]> = new Map();

  constructor(config: Partial<RewriterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 改写查询
   */
  rewrite(query: string): RewriteResult {
    const corrections: string[] = [];
    const expansions: string[] = [];
    const synonyms: string[] = [];

    let rewritten = query;

    // 拼写纠正
    if (this.config.enableSpellingCorrection) {
      const correctionResult = this.correctSpelling(rewritten);
      rewritten = correctionResult.text;
      corrections.push(...correctionResult.corrections);
    }

    // 同义词扩展
    if (this.config.enableSynonymExpansion) {
      const synonymResult = this.expandSynonyms(rewritten);
      synonyms.push(...synonymResult);
    }

    // 语义扩展
    if (this.config.enableSemanticExpansion) {
      const expansionResult = this.expandSemantically(rewritten);
      expansions.push(...expansionResult);
    }

    return {
      original: query,
      rewritten,
      corrections,
      expansions: expansions.slice(0, this.config.maxExpansions),
      synonyms,
    };
  }

  /**
   * 拼写纠正
   */
  private correctSpelling(text: string): { text: string; corrections: string[] } {
    const corrections: string[] = [];
    let corrected = text;

    // 合并默认和自定义纠正
    const allCorrections = { ...SPELLING_CORRECTIONS };
    this.customCorrections.forEach((v, k) => {
      allCorrections[k] = v;
    });

    for (const [wrong, right] of Object.entries(allCorrections)) {
      if (corrected.includes(wrong)) {
        corrected = corrected.replace(new RegExp(wrong, 'g'), right);
        corrections.push(`${wrong} → ${right}`);
      }
    }

    return { text: corrected, corrections };
  }

  /**
   * 同义词扩展
   */
  private expandSynonyms(text: string): string[] {
    const foundSynonyms: string[] = [];

    // 合并默认和自定义同义词
    const allSynonyms = { ...SYNONYMS };
    this.customSynonyms.forEach((v, k) => {
      allSynonyms[k] = v;
    });

    for (const [word, syns] of Object.entries(allSynonyms)) {
      if (text.includes(word)) {
        foundSynonyms.push(...syns);
      }
    }

    return [...new Set(foundSynonyms)];
  }

  /**
   * 语义扩展
   */
  private expandSemantically(text: string): string[] {
    const expansions: string[] = [];

    // 基于规则的语义扩展
    const patterns = [
      { pattern: /如何/, expansions: ['怎么', '怎样', '方法'] },
      { pattern: /为什么/, expansions: ['原因', '理由', '因为'] },
      { pattern: /什么/, expansions: ['哪些', '什么类型'] },
      { pattern: /配置/, expansions: ['设置', '设定'] },
      { pattern: /问题/, expansions: ['错误', '异常', '故障'] },
    ];

    for (const { pattern, expansions: exps } of patterns) {
      if (pattern.test(text)) {
        expansions.push(...exps);
      }
    }

    return [...new Set(expansions)];
  }

  /**
   * 添加自定义纠正
   */
  addCorrection(wrong: string, right: string): void {
    this.customCorrections.set(wrong, right);
  }

  /**
   * 添加自定义同义词
   */
  addSynonyms(word: string, synonyms: string[]): void {
    this.customSynonyms.set(word, synonyms);
  }

  /**
   * 生成扩展查询
   */
  generateExpandedQueries(result: RewriteResult): string[] {
    const queries: string[] = [result.rewritten];

    // 添加同义词变体
    for (const synonym of result.synonyms.slice(0, 3)) {
      queries.push(`${result.rewritten} ${synonym}`);
    }

    // 添加扩展词
    for (const expansion of result.expansions.slice(0, 2)) {
      queries.push(`${result.rewritten} ${expansion}`);
    }

    return queries;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RewriterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
