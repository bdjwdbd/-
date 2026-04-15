/**
 * 对话摘要器
 * 
 * 智能对话摘要和关键信息提取
 * 融合自 yaoyao-memory-v2
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationSummary {
  id: string;
  startTime: number;
  endTime: number;
  messageCount: number;
  summary: string;
  keyPoints: string[];
  entities: ExtractedEntity[];
  topics: string[];
  sentiment: SentimentScore;
  importance: number;
}

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'place' | 'organization' | 'date' | 'concept' | 'other';
  mentions: number;
  context: string;
}

export interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
  overall: 'positive' | 'negative' | 'neutral';
}

export interface SummarizerConfig {
  maxSummaryLength: number;
  maxKeyPoints: number;
  extractEntities: boolean;
  detectSentiment: boolean;
  minImportance: number;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: SummarizerConfig = {
  maxSummaryLength: 500,
  maxKeyPoints: 5,
  extractEntities: true,
  detectSentiment: true,
  minImportance: 0.3
};

// ============ 对话摘要器类 ============

export class ConversationSummarizer {
  private logger: StructuredLogger;
  private config: SummarizerConfig;

  constructor(logger: StructuredLogger, config?: Partial<SummarizerConfig>) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============ 摘要生成 ============

  async summarize(messages: ConversationMessage[]): Promise<ConversationSummary> {
    if (messages.length === 0) {
      throw new Error('消息列表为空');
    }

    const id = `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = messages[0].timestamp;
    const endTime = messages[messages.length - 1].timestamp;

    // 生成摘要
    const summary = this.generateSummary(messages);
    
    // 提取关键点
    const keyPoints = this.extractKeyPoints(messages);
    
    // 提取实体
    const entities = this.config.extractEntities 
      ? this.extractEntities(messages)
      : [];
    
    // 提取主题
    const topics = this.extractTopics(messages);
    
    // 情感分析
    const sentiment = this.config.detectSentiment
      ? this.analyzeSentiment(messages)
      : { positive: 0, negative: 0, neutral: 1, overall: 'neutral' as const };
    
    // 计算重要性
    const importance = this.calculateImportance(messages, keyPoints, entities);

    return {
      id,
      startTime,
      endTime,
      messageCount: messages.length,
      summary,
      keyPoints,
      entities,
      topics,
      sentiment,
      importance
    };
  }

  // ============ 摘要生成 ============

  private generateSummary(messages: ConversationMessage[]): string {
    // 提取用户消息
    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content);

    // 提取助手消息
    const assistantMessages = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content);

    // 生成摘要
    const userSummary = this.summarizeTexts(userMessages, this.config.maxSummaryLength / 2);
    const assistantSummary = this.summarizeTexts(assistantMessages, this.config.maxSummaryLength / 2);

    return `用户: ${userSummary}\n助手: ${assistantSummary}`;
  }

  private summarizeTexts(texts: string[], maxLength: number): string {
    if (texts.length === 0) return '无';

    // 简单的摘要策略：取前几句 + 关键词
    const combined = texts.join(' ');
    const sentences = combined.split(/[。！？.!?]/).filter(s => s.trim());

    if (sentences.length <= 3) {
      return combined.substring(0, maxLength);
    }

    // 取首尾句
    const summary = `${sentences[0]}...${sentences[sentences.length - 1]}`;
    return summary.substring(0, maxLength);
  }

  // ============ 关键点提取 ============

  private extractKeyPoints(messages: ConversationMessage[]): string[] {
    const keyPoints: string[] = [];
    const allContent = messages.map(m => m.content).join(' ');

    // 提取包含关键词的句子
    const keywords = ['重要', '关键', '必须', '需要', '问题', '解决', '决定', '结论'];
    const sentences = allContent.split(/[。！？.!?]/).filter(s => s.trim());

    for (const sentence of sentences) {
      if (keywords.some(k => sentence.includes(k))) {
        keyPoints.push(sentence.trim());
        if (keyPoints.length >= this.config.maxKeyPoints) break;
      }
    }

    // 如果关键点不足，添加用户问题
    if (keyPoints.length < this.config.maxKeyPoints) {
      const userQuestions = messages
        .filter(m => m.role === 'user' && m.content.includes('?') || m.content.includes('？'))
        .map(m => m.content);
      
      for (const q of userQuestions) {
        if (!keyPoints.includes(q)) {
          keyPoints.push(q);
          if (keyPoints.length >= this.config.maxKeyPoints) break;
        }
      }
    }

    return keyPoints;
  }

  // ============ 实体提取 ============

  private extractEntities(messages: ConversationMessage[]): ExtractedEntity[] {
    const entityMap = new Map<string, ExtractedEntity>();
    const allContent = messages.map(m => m.content).join(' ');

    // 简单的实体提取规则
    const patterns = {
      person: /([A-Z][a-z]+|[\\u4e00-\\u9fa5]{2,4})(说|认为|表示|指出)/g,
      place: /在([\\u4e00-\\u9fa5]{2,10})(工作|生活|学习|旅行)/g,
      organization: /([\\u4e00-\\u9fa5]{2,10})(公司|组织|机构|团队)/g,
      date: /(\\d{4}年\\d{1,2}月\\d{1,2}日|\\d{1,2}月\\d{1,2}日|今天|明天|昨天)/g,
      concept: /([\\u4e00-\\u9fa5]{2,8})(系统|框架|方法|技术)/g
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      let match;
      while ((match = pattern.exec(allContent)) !== null) {
        const name = match[1];
        if (entityMap.has(name)) {
          entityMap.get(name)!.mentions++;
        } else {
          entityMap.set(name, {
            name,
            type: type as ExtractedEntity['type'],
            mentions: 1,
            context: this.getContext(allContent, match.index, 50)
          });
        }
      }
    }

    // 按提及次数排序
    return Array.from(entityMap.values())
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10);
  }

  private getContext(text: string, index: number, length: number): string {
    const start = Math.max(0, index - length);
    const end = Math.min(text.length, index + length);
    return text.substring(start, end);
  }

  // ============ 主题提取 ============

  private extractTopics(messages: ConversationMessage[]): string[] {
    const topics: string[] = [];
    const allContent = messages.map(m => m.content).join(' ');

    // 简单的主题提取：高频词
    const words = allContent.split(/\\s+/);
    const wordCount = new Map<string, number>();

    for (const word of words) {
      if (word.length >= 2 && word.length <= 10) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    }

    // 排除停用词
    const stopWords = new Set(['的', '是', '在', '了', '和', '有', '我', '你', '他', '她', '它']);
    
    return Array.from(wordCount.entries())
      .filter(([word]) => !stopWords.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  // ============ 情感分析 ============

  private analyzeSentiment(messages: ConversationMessage[]): SentimentScore {
    const allContent = messages.map(m => m.content).join(' ');

    // 简单的情感词典
    const positiveWords = ['好', '棒', '优秀', '成功', '喜欢', '满意', '开心', '感谢', '完美'];
    const negativeWords = ['差', '糟', '失败', '讨厌', '不满', '难过', '抱歉', '错误', '问题'];

    let positive = 0;
    let negative = 0;

    for (const word of positiveWords) {
      const matches = allContent.match(new RegExp(word, 'g'));
      if (matches) positive += matches.length;
    }

    for (const word of negativeWords) {
      const matches = allContent.match(new RegExp(word, 'g'));
      if (matches) negative += matches.length;
    }

    const total = positive + negative + 1;
    const neutral = Math.max(0, 1 - (positive + negative) / total);

    let overall: 'positive' | 'negative' | 'neutral';
    if (positive > negative * 1.5) {
      overall = 'positive';
    } else if (negative > positive * 1.5) {
      overall = 'negative';
    } else {
      overall = 'neutral';
    }

    return {
      positive: positive / total,
      negative: negative / total,
      neutral,
      overall
    };
  }

  // ============ 重要性计算 ============

  private calculateImportance(
    messages: ConversationMessage[],
    keyPoints: string[],
    entities: ExtractedEntity[]
  ): number {
    let importance = 0.5;

    // 消息数量影响
    importance += Math.min(0.2, messages.length * 0.01);

    // 关键点影响
    importance += Math.min(0.15, keyPoints.length * 0.03);

    // 实体影响
    importance += Math.min(0.15, entities.length * 0.015);

    return Math.min(1, importance);
  }

  // ============ 配置管理 ============

  updateConfig(config: Partial<SummarizerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('ConversationSummarizer', '配置已更新');
  }

  getConfig(): SummarizerConfig {
    return { ...this.config };
  }
}
