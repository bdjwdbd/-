/**
 * 查询理解与改写
 * 
 * 融合自 llm-memory-integration v5.2.17
 * 
 * 功能：
 * 1. 意图识别
 * 2. 实体提取
 * 3. 拼写纠正
 * 4. 同义词扩展
 * 5. 查询改写
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export interface QueryUnderstanding {
  originalQuery: string;
  rewrittenQuery: string;
  intent: QueryIntent;
  entities: Entity[];
  synonyms: string[];
  corrections: Correction[];
  language: string;
}

export type QueryIntent = 
  | 'search'      // 搜索
  | 'config'      // 配置
  | 'explain'     // 解释
  | 'compare'     // 对比
  | 'create'      // 创建
  | 'update'      // 更新
  | 'delete';     // 删除

export interface Entity {
  text: string;
  type: EntityType;
  confidence: number;
}

export type EntityType = 
  | 'person'      // 人物
  | 'date'        // 日期
  | 'location'    // 地点
  | 'concept'     // 概念
  | 'tool'        // 工具
  | 'file'        // 文件
  | 'unknown';    // 未知

export interface Correction {
  original: string;
  corrected: string;
  type: 'spelling' | 'grammar';
}

// ============ 查询理解器 ============

export class QueryUnderstander {
  private logger: StructuredLogger;
  
  // 同义词词典
  private static SYNONYMS: Record<string, string[]> = {
    '配置': ['设置', '设定', '配置项'],
    '搜索': ['查找', '寻找', '检索'],
    '删除': ['移除', '清除', '去掉'],
    '更新': ['修改', '更改', '编辑'],
    '创建': ['新建', '添加', '增加'],
    '记忆': ['回忆', '记录', '存储'],
    '系统': ['体系', '框架', '架构'],
  };
  
  // 常见拼写错误
  private static SPELLING_CORRECTIONS: Record<string, string> = {
    '规责': '规则',
    '配值': '配置',
    '搜锁': '搜索',
    '记意': '记忆',
    '系通': '系统',
  };
  
  // 意图关键词
  private static INTENT_KEYWORDS: Record<QueryIntent, string[]> = {
    search: ['搜索', '查找', '寻找', '检索', 'search', 'find'],
    config: ['配置', '设置', '设定', 'config', 'setting'],
    explain: ['如何', '怎么', '为什么', '解释', 'explain', 'how'],
    compare: ['对比', '比较', '区别', 'compare', 'difference'],
    create: ['创建', '新建', '添加', 'create', 'add', 'new'],
    update: ['更新', '修改', '更改', 'update', 'modify'],
    delete: ['删除', '移除', '清除', 'delete', 'remove'],
  };
  
  constructor(logger: StructuredLogger) {
    this.logger = logger;
  }
  
  /**
   * 理解查询
   */
  understand(query: string): QueryUnderstanding {
    const startTime = Date.now();
    
    // 1. 语言检测
    const language = this.detectLanguage(query);
    
    // 2. 拼写纠正
    const corrections = this.correctSpelling(query);
    let correctedQuery = query;
    for (const correction of corrections) {
      correctedQuery = correctedQuery.replace(correction.original, correction.corrected);
    }
    
    // 3. 意图识别
    const intent = this.recognizeIntent(correctedQuery);
    
    // 4. 实体提取
    const entities = this.extractEntities(correctedQuery);
    
    // 5. 同义词扩展
    const synonyms = this.expandSynonyms(correctedQuery);
    
    // 6. 查询改写
    const rewrittenQuery = this.rewriteQuery(correctedQuery, intent, entities, synonyms);
    
    const result: QueryUnderstanding = {
      originalQuery: query,
      rewrittenQuery,
      intent,
      entities,
      synonyms,
      corrections,
      language,
    };
    
    this.logger.info('QueryUnderstander', 
      `查询理解完成: intent=${intent}, entities=${entities.length}, 耗时 ${Date.now() - startTime}ms`
    );
    
    return result;
  }
  
  /**
   * 检测语言
   */
  private detectLanguage(query: string): string {
    // 简化实现：检测中文字符比例
    const chineseChars = query.match(/[\u4e00-\u9fa5]/g);
    const chineseRatio = chineseChars ? chineseChars.length / query.length : 0;
    
    return chineseRatio > 0.3 ? 'zh' : 'en';
  }
  
  /**
   * 拼写纠正
   */
  private correctSpelling(query: string): Correction[] {
    const corrections: Correction[] = [];
    
    for (const [wrong, correct] of Object.entries(QueryUnderstander.SPELLING_CORRECTIONS)) {
      if (query.includes(wrong)) {
        corrections.push({
          original: wrong,
          corrected: correct,
          type: 'spelling',
        });
      }
    }
    
    return corrections;
  }
  
  /**
   * 识别意图
   */
  private recognizeIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(QueryUnderstander.INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          return intent as QueryIntent;
        }
      }
    }
    
    return 'search'; // 默认搜索
  }
  
  /**
   * 提取实体
   */
  private extractEntities(query: string): Entity[] {
    const entities: Entity[] = [];
    
    // 提取日期
    const datePattern = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?/g;
    let match;
    while ((match = datePattern.exec(query)) !== null) {
      entities.push({
        text: match[0],
        type: 'date',
        confidence: 0.9,
      });
    }
    
    // 提取文件路径
    const filePattern = /[\/\\][\w\-\.]+/g;
    while ((match = filePattern.exec(query)) !== null) {
      entities.push({
        text: match[0],
        type: 'file',
        confidence: 0.8,
      });
    }
    
    // 提取概念词（中文词汇）
    const conceptPattern = /[\u4e00-\u9fa5]{2,}/g;
    while ((match = conceptPattern.exec(query)) !== null) {
      // 避免重复
      if (!entities.some(e => e.text === match![0])) {
        entities.push({
          text: match[0],
          type: 'concept',
          confidence: 0.6,
        });
      }
    }
    
    return entities;
  }
  
  /**
   * 同义词扩展
   */
  private expandSynonyms(query: string): string[] {
    const synonyms: string[] = [];
    
    for (const [word, syns] of Object.entries(QueryUnderstander.SYNONYMS)) {
      if (query.includes(word)) {
        synonyms.push(...syns);
      }
    }
    
    return [...new Set(synonyms)]; // 去重
  }
  
  /**
   * 改写查询
   */
  private rewriteQuery(
    query: string,
    intent: QueryIntent,
    entities: Entity[],
    synonyms: string[]
  ): string {
    let rewritten = query;
    
    // 添加同义词
    if (synonyms.length > 0) {
      rewritten += ` (${synonyms.slice(0, 3).join(', ')})`;
    }
    
    // 根据意图添加修饰词
    switch (intent) {
      case 'explain':
        rewritten = `如何 ${rewritten}`;
        break;
      case 'compare':
        rewritten = `${rewritten} 对比`;
        break;
      case 'config':
        rewritten = `${rewritten} 配置`;
        break;
    }
    
    return rewritten;
  }
  
  /**
   * 批量理解
   */
  batchUnderstand(queries: string[]): QueryUnderstanding[] {
    return queries.map(q => this.understand(q));
  }
}
