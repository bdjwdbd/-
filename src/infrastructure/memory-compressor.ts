/**
 * 记忆压缩算法
 * 
 * 功能：
 * 1. 语义重要性评分
 * 2. 关键信息提取
 * 3. 冗余内容合并
 * 4. 生成交接文档
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  importance?: number;
}

export interface CompressionResult {
  kept: Message[];           // 保留的消息
  compressed: Message[];     // 压缩后的消息
  handover: string;          // 交接文档
  stats: {
    original: number;        // 原始消息数
    after: number;           // 压缩后消息数
    compressionRate: number; // 压缩率
  };
}

export type CompressionLevel = 'emergency' | 'standard' | 'relaxed';

// ============ 记忆压缩器 ============

export class MemoryCompressor {
  private logger: StructuredLogger;
  
  // 压缩级别配置
  private static COMPRESSION_CONFIG: Record<CompressionLevel, {
    keepCount: number;       // 保留消息数
    importanceThreshold: number;  // 重要性阈值
    enableSummarization: boolean; // 是否启用摘要
  }> = {
    emergency: { keepCount: 5, importanceThreshold: 0.8, enableSummarization: true },
    standard: { keepCount: 10, importanceThreshold: 0.5, enableSummarization: true },
    relaxed: { keepCount: 20, importanceThreshold: 0.3, enableSummarization: false },
  };
  
  constructor(logger: StructuredLogger) {
    this.logger = logger;
  }
  
  /**
   * 压缩消息列表
   */
  compress(
    messages: Message[],
    level: CompressionLevel = 'standard'
  ): CompressionResult {
    const config = MemoryCompressor.COMPRESSION_CONFIG[level];
    const startTime = Date.now();
    
    this.logger.info('MemoryCompressor', `开始压缩 (级别: ${level}, 消息数: ${messages.length})`);
    
    // 1. 计算重要性分数
    const scoredMessages = messages.map(msg => ({
      ...msg,
      importance: this.calculateImportance(msg),
    }));
    
    // 2. 按重要性排序
    scoredMessages.sort((a, b) => (b.importance || 0) - (a.importance || 0));
    
    // 3. 分离保留和压缩的消息
    const kept: Message[] = [];
    const toCompress: Message[] = [];
    
    for (const msg of scoredMessages) {
      if (kept.length < config.keepCount || (msg.importance || 0) >= config.importanceThreshold) {
        kept.push(msg);
      } else {
        toCompress.push(msg);
      }
    }
    
    // 4. 生成压缩摘要
    let compressed: Message[] = [];
    let handover = '';
    
    if (config.enableSummarization && toCompress.length > 0) {
      const summary = this.generateSummary(toCompress);
      compressed = [summary];
      handover = this.generateHandover(toCompress, kept);
    }
    
    // 5. 按时间排序保留的消息
    kept.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    const result: CompressionResult = {
      kept,
      compressed,
      handover,
      stats: {
        original: messages.length,
        after: kept.length + compressed.length,
        compressionRate: messages.length > 0 
          ? 1 - (kept.length + compressed.length) / messages.length 
          : 0,
      },
    };
    
    this.logger.info('MemoryCompressor', 
      `压缩完成: ${result.stats.original} → ${result.stats.after} (压缩率: ${(result.stats.compressionRate * 100).toFixed(1)}%)`
    );
    
    return result;
  }
  
  /**
   * 计算消息重要性分数
   */
  private calculateImportance(message: Message): number {
    let score = 0.5; // 基础分数
    
    const content = message.content.toLowerCase();
    
    // 关键词加分
    const importantKeywords = [
      '决策', '决定', '选择', '方案',
      '错误', '失败', '异常', '问题',
      '完成', '成功', '结果', '结论',
      '重要', '关键', '核心', '必须',
      'decision', 'error', 'success', 'important',
    ];
    
    for (const keyword of importantKeywords) {
      if (content.includes(keyword)) {
        score += 0.1;
      }
    }
    
    // 角色加分
    if (message.role === 'user') {
      score += 0.1; // 用户消息更重要
    }
    
    // 长度惩罚（过长的消息可能包含冗余）
    if (content.length > 1000) {
      score -= 0.1;
    }
    
    // 代码块加分（通常包含重要信息）
    if (content.includes('```') || content.includes('`')) {
      score += 0.1;
    }
    
    return Math.min(1, Math.max(0, score));
  }
  
  /**
   * 生成压缩摘要
   */
  private generateSummary(messages: Message[]): Message {
    // 提取关键信息
    const keyPoints: string[] = [];
    const decisions: string[] = [];
    const errors: string[] = [];
    
    for (const msg of messages) {
      const content = msg.content;
      
      // 提取决策
      if (content.includes('决策') || content.includes('决定') || content.includes('选择')) {
        decisions.push(this.extractKeySentence(content));
      }
      
      // 提取错误
      if (content.includes('错误') || content.includes('失败') || content.includes('异常')) {
        errors.push(this.extractKeySentence(content));
      }
      
      // 提取关键点
      keyPoints.push(this.extractKeySentence(content));
    }
    
    // 构建摘要
    let summaryContent = '# 历史对话摘要\n\n';
    
    if (decisions.length > 0) {
      summaryContent += '## 关键决策\n';
      decisions.slice(0, 3).forEach((d, i) => {
        summaryContent += `${i + 1}. ${d}\n`;
      });
      summaryContent += '\n';
    }
    
    if (errors.length > 0) {
      summaryContent += '## 遇到的问题\n';
      errors.slice(0, 3).forEach((e, i) => {
        summaryContent += `${i + 1}. ${e}\n`;
      });
      summaryContent += '\n';
    }
    
    summaryContent += `## 概要\n`;
    summaryContent += `压缩了 ${messages.length} 条历史消息。\n`;
    
    return {
      role: 'system',
      content: summaryContent,
      timestamp: Date.now(),
      importance: 0.7,
    };
  }
  
  /**
   * 提取关键句子
   */
  private extractKeySentence(content: string): string {
    // 简化实现：取前 100 字符
    const cleaned = content.replace(/```[\s\S]*?```/g, '').trim();
    return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned;
  }
  
  /**
   * 生成交接文档
   */
  private generateHandover(compressed: Message[], kept: Message[]): string {
    const handover: string[] = [];
    
    handover.push('# 上下文交接文档');
    handover.push(`生成时间: ${new Date().toISOString()}`);
    handover.push('');
    
    handover.push('## 压缩概要');
    handover.push(`- 压缩消息数: ${compressed.length}`);
    handover.push(`- 保留消息数: ${kept.length}`);
    handover.push('');
    
    handover.push('## 保留的关键信息');
    kept.slice(-5).forEach((msg, i) => {
      handover.push(`${i + 1}. [${msg.role}] ${this.extractKeySentence(msg.content)}`);
    });
    
    return handover.join('\n');
  }
  
  /**
   * 智能压缩（根据上下文使用率自动选择级别）
   */
  smartCompress(
    messages: Message[],
    tokenCount: number,
    maxTokens: number
  ): CompressionResult {
    const usageRate = tokenCount / maxTokens;
    
    let level: CompressionLevel;
    if (usageRate > 0.8) {
      level = 'emergency';
    } else if (usageRate > 0.6) {
      level = 'standard';
    } else {
      level = 'relaxed';
    }
    
    this.logger.info('MemoryCompressor', 
      `智能压缩: 使用率 ${(usageRate * 100).toFixed(1)}%, 选择级别: ${level}`
    );
    
    return this.compress(messages, level);
  }
}
