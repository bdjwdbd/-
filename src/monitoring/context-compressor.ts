/**
 * 上下文压缩器
 * 
 * 功能：
 * 1. 智能摘要生成
 * 2. 关键信息提取
 * 3. 冗余内容去除
 * 4. 分层压缩策略
 */

// ============================================================
// 类型定义
// ============================================================

export interface CompressionResult {
  original: string;
  compressed: string;
  ratio: number;
  preserved: string[];
  removed: string[];
}

export interface CompressionConfig {
  maxRatio: number;          // 最大压缩比
  preserveKeywords: string[]; // 保留关键词
  preservePatterns: RegExp[]; // 保留模式
  summaryLength: number;     // 摘要长度
}

export interface MessageSummary {
  role: 'user' | 'assistant' | 'system';
  summary: string;
  keyPoints: string[];
  timestamp: number;
  tokenCount: number;
}

// ============================================================
// 上下文压缩器
// ============================================================

export class ContextCompressor {
  private config: CompressionConfig;

  constructor(config?: Partial<CompressionConfig>) {
    this.config = {
      maxRatio: 0.3, // 最多压缩到 30%
      preserveKeywords: [
        // 中文关键词
        '重要', '关键', '必须', '注意', '错误', '成功', '失败',
        '警告', '危险', '紧急', '核心', '重点', '结论',
        '问题', '原因', '结果', '建议', '方案', '目标',
        // 英文关键词
        'important', 'key', 'must', 'error', 'success', 'fail',
        'warning', 'critical', 'urgent', 'core', 'conclusion',
        'problem', 'reason', 'result', 'suggestion', 'solution',
      ],
      preservePatterns: [
        /\d{4}-\d{2}-\d{2}/,           // 日期
        /\d{1,3}\.\d{1,3}\.\d{1,3}/,  // IP 地址
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // 邮箱
        /https?:\/\/[^\s]+/,          // URL
        /```[\s\S]*?```/,             // 代码块
        /\d{11}/,                      // 手机号
        /\d{4}\s*\d{4}\s*\d{4}\s*\d{4}/, // 银行卡号
        /[A-Z]{2}\d{6}/,               // 护照号
        /\d{17}[\dXx]/,                // 身份证号
      ],
      summaryLength: 100,
      ...config,
    };
  }

  /**
   * 压缩文本
   */
  compress(text: string): CompressionResult {
    const preserved: string[] = [];
    const removed: string[] = [];

    // 1. 提取需要保留的内容
    const preservedContent = this.extractPreserved(text, preserved);

    // 2. 去除冗余
    let compressed = this.removeRedundancy(text, removed);

    // 3. 恢复保留内容
    compressed = this.restorePreserved(compressed, preservedContent);

    // 4. 计算压缩比
    const ratio = compressed.length / text.length;

    return {
      original: text,
      compressed,
      ratio,
      preserved,
      removed,
    };
  }

  /**
   * 提取需要保留的内容
   */
  private extractPreserved(text: string, preserved: string[]): Map<string, string> {
    const map = new Map<string, string>();
    let counter = 0;

    // 提取匹配模式的内容
    for (const pattern of this.config.preservePatterns) {
      text = text.replace(pattern, (match) => {
        const placeholder = `__PRESERVED_${counter++}__`;
        map.set(placeholder, match);
        preserved.push(match);
        return placeholder;
      });
    }

    // 提取包含关键词的句子
    const sentences = text.split(/[。！？.!?]+/);
    for (const sentence of sentences) {
      if (this.config.preserveKeywords.some(kw => sentence.includes(kw))) {
        const placeholder = `__PRESERVED_${counter++}__`;
        map.set(placeholder, sentence.trim());
        preserved.push(sentence.trim());
      }
    }

    return map;
  }

  /**
   * 去除冗余内容
   */
  private removeRedundancy(text: string, removed: string[]): string {
    let result = text;

    // 去除重复空格
    result = result.replace(/\s+/g, ' ');
    removed.push('多余空格');

    // 去除重复行
    const lines = result.split('\n');
    const seen = new Set<string>();
    const uniqueLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        uniqueLines.push(line);
      } else if (trimmed) {
        removed.push(`重复行: ${trimmed.substring(0, 30)}...`);
      }
    }
    result = uniqueLines.join('\n');

    // 去除常见的填充词
    const fillers = [
      '嗯', '啊', '那个', '这个', '就是', '然后',
      'basically', 'actually', 'literally', 'like',
    ];
    for (const filler of fillers) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      result = result.replace(regex, '');
    }

    return result.trim();
  }

  /**
   * 恢复保留内容
   */
  private restorePreserved(text: string, preserved: Map<string, string>): string {
    let result = text;
    for (const [placeholder, content] of preserved) {
      result = result.replace(placeholder, content);
    }
    return result;
  }

  /**
   * 生成消息摘要
   */
  summarizeMessage(message: { role: string; content: string }): MessageSummary {
    const content = message.content;
    
    // 提取关键点
    const keyPoints = this.extractKeyPoints(content);
    
    // 生成摘要
    const summary = this.generateSummary(content, keyPoints);
    
    // 估算 token 数
    const tokenCount = Math.ceil(summary.length / 4);

    return {
      role: message.role as 'user' | 'assistant' | 'system',
      summary,
      keyPoints,
      timestamp: Date.now(),
      tokenCount,
    };
  }

  /**
   * 提取关键点
   */
  private extractKeyPoints(content: string): string[] {
    const points: string[] = [];
    
    // 按句子分割
    const sentences = content.split(/[。！？.!?]+/).filter(s => s.trim());
    
    // 提取包含关键词的句子
    for (const sentence of sentences) {
      if (this.config.preserveKeywords.some(kw => sentence.includes(kw))) {
        points.push(sentence.trim());
      }
    }
    
    // 提取问句
    for (const sentence of sentences) {
      if (sentence.includes('?') || sentence.includes('？')) {
        points.push(sentence.trim());
      }
    }
    
    // 提取数字相关内容
    const numberPattern = /\d+[.,\d]*\s*(%|个|次|元|美元|小时|分钟|秒|天|周|月|年)/;
    for (const sentence of sentences) {
      if (numberPattern.test(sentence)) {
        points.push(sentence.trim());
      }
    }

    return [...new Set(points)].slice(0, 5);
  }

  /**
   * 生成摘要
   */
  private generateSummary(content: string, keyPoints: string[]): string {
    if (keyPoints.length === 0) {
      // 无关键点，取前 N 个字符
      return content.substring(0, this.config.summaryLength) + '...';
    }

    // 用关键点组成摘要
    const summary = keyPoints.join('；');
    
    if (summary.length > this.config.summaryLength) {
      return summary.substring(0, this.config.summaryLength) + '...';
    }

    return summary;
  }

  /**
   * 压缩消息历史
   */
  compressHistory(
    messages: Array<{ role: string; content: string }>,
    maxTokens: number
  ): Array<MessageSummary | { role: string; content: string }> {
    const result: Array<MessageSummary | { role: string; content: string }> = [];
    let totalTokens = 0;

    // 从最新消息开始处理
    const reversed = [...messages].reverse();
    
    for (const msg of reversed) {
      const tokens = Math.ceil(msg.content.length / 4);
      
      if (totalTokens + tokens <= maxTokens) {
        // 直接保留
        result.unshift(msg);
        totalTokens += tokens;
      } else {
        // 压缩为摘要
        const summary = this.summarizeMessage(msg);
        if (totalTokens + summary.tokenCount <= maxTokens) {
          result.unshift(summary);
          totalTokens += summary.tokenCount;
        } else {
          // 超出限制，停止添加
          break;
        }
      }
    }

    return result;
  }

  /**
   * 生成交接单
   */
  generateHandover(
    context: {
      goal: string;
      completed: string[];
      pending: string[];
      findings: string[];
    }
  ): string {
    const lines: string[] = [
      '# 交接单',
      '',
      `## 目标`,
      context.goal,
      '',
      `## 已完成`,
      ...context.completed.map(c => `- ${c}`),
      '',
      `## 待处理`,
      ...context.pending.map(p => `- ${p}`),
      '',
      `## 关键发现`,
      ...context.findings.map(f => `- ${f}`),
      '',
      `---`,
      `生成时间: ${new Date().toISOString()}`,
    ];

    return lines.join('\n');
  }

  /**
   * 分层压缩策略
   */
  layeredCompress(
    text: string,
    targetRatio: number = 0.5
  ): CompressionResult {
    let current = text;
    let totalPreserved: string[] = [];
    let totalRemoved: string[] = [];

    // 短文本直接返回
    if (text.length < 100) {
      return {
        original: text,
        compressed: text,
        ratio: 1,
        preserved: [],
        removed: ['短文本无需压缩'],
      };
    }

    // 第一层：去除冗余
    const step1 = this.compress(current);
    current = step1.compressed;
    totalPreserved.push(...step1.preserved);
    totalRemoved.push(...step1.removed);

    // 如果已达到目标，返回
    if (current.length / text.length <= targetRatio) {
      return {
        original: text,
        compressed: current,
        ratio: current.length / text.length,
        preserved: totalPreserved,
        removed: totalRemoved,
      };
    }

    // 第二层：提取摘要
    const keyPoints = this.extractKeyPoints(current);
    if (keyPoints.length > 0) {
      current = keyPoints.join('；');
      totalRemoved.push('非关键内容');
    }

    // 如果已达到目标，返回
    if (current.length / text.length <= targetRatio) {
      return {
        original: text,
        compressed: current,
        ratio: current.length / text.length,
        preserved: totalPreserved,
        removed: totalRemoved,
      };
    }

    // 第三层：截断
    if (current.length > this.config.summaryLength) {
      const truncated = current.substring(0, this.config.summaryLength);
      totalRemoved.push(`截断 ${current.length - this.config.summaryLength} 字符`);
      current = truncated + '...';
    }

    return {
      original: text,
      compressed: current,
      ratio: current.length / text.length,
      preserved: totalPreserved,
      removed: totalRemoved,
    };
  }

  /**
   * 批量压缩消息
   */
  batchCompress(
    messages: Array<{ role: string; content: string }>,
    strategy: 'light' | 'medium' | 'aggressive' = 'medium'
  ): Array<{ role: string; content: string; originalLength: number }> {
    const targetRatios = {
      light: 0.7,
      medium: 0.5,
      aggressive: 0.3,
    };

    const targetRatio = targetRatios[strategy];

    return messages.map(msg => {
      const result = this.layeredCompress(msg.content, targetRatio);
      return {
        role: msg.role,
        content: result.compressed,
        originalLength: result.original.length,
      };
    });
  }
}

// ============================================================
// 全局实例
// ============================================================

let globalCompressor: ContextCompressor | null = null;

export function getContextCompressor(): ContextCompressor {
  if (!globalCompressor) {
    globalCompressor = new ContextCompressor();
  }
  return globalCompressor;
}
