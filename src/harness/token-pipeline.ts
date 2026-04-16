/**
 * Token 流水线治理
 * 
 * 核心机制：
 * - 滑动窗口：保留最近 N 条消息
 * - 分层记忆：短期/中期/长期记忆
 * - 按需加载：根据相关性加载记忆
 * - 压缩摘要：自动压缩历史消息
 * 
 * 来源：Harness Engineering 文档
 * 
 * @module harness/token-pipeline
 */

// ============ 类型定义 ============

export interface TokenPipelineConfig {
  /** 最大 Token 数 */
  maxTokens: number;
  /** 滑动窗口大小（消息条数） */
  windowSize: number;
  /** 是否启用压缩 */
  enableCompression: boolean;
  /** 压缩阈值（Token 使用率） */
  compressionThreshold: number;
  /** 是否启用分层记忆 */
  enableTieredMemory: boolean;
  /** 短期记忆容量 */
  shortTermCapacity: number;
  /** 中期记忆容量 */
  midTermCapacity: number;
  /** 长期记忆容量 */
  longTermCapacity: number;
}

export interface MemoryEntry {
  /** 内容 */
  content: string;
  /** Token 数量 */
  tokens: number;
  /** 时间戳 */
  timestamp: number;
  /** 重要性分数 */
  importance: number;
  /** 标签 */
  tags: string[];
}

export interface CompressedEntry {
  /** 摘要内容 */
  summary: string;
  /** Token 数量 */
  tokens: number;
  /** 原始条目数 */
  originalCount: number;
  /** 时间范围 */
  timeRange: { start: number; end: number };
}

export interface TokenUsage {
  /** 短期记忆 Token 数 */
  shortTerm: number;
  /** 中期记忆 Token 数 */
  midTerm: number;
  /** 长期记忆 Token 数 */
  longTerm: number;
  /** 总 Token 数 */
  total: number;
  /** 使用率 */
  usageRate: number;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: Partial<TokenPipelineConfig> = {
  maxTokens: 4000,
  windowSize: 10,
  enableCompression: true,
  compressionThreshold: 0.8,
  enableTieredMemory: true,
  shortTermCapacity: 2000,
  midTermCapacity: 1500,
  longTermCapacity: 500,
};

// ============ Token 流水线类 ============

/**
 * Token 流水线治理
 * 
 * 使用示例：
 * ```typescript
 * const pipeline = new TokenPipeline({
 *   maxTokens: 4000,
 *   windowSize: 10,
 * });
 * 
 * // 添加消息
 * pipeline.addMessage('用户消息', 50);
 * pipeline.addMessage('AI 回复', 100);
 * 
 * // 构建上下文
 * const context = pipeline.buildContext('用户查询');
 * 
 * // 获取使用情况
 * const usage = pipeline.getUsage();
 * ```
 */
export class TokenPipeline {
  private config: TokenPipelineConfig;
  
  // 三层记忆
  private shortTermMemory: MemoryEntry[] = [];
  private midTermMemory: CompressedEntry[] = [];
  private longTermMemory: Map<string, { embedding: number[]; summary: string }> = new Map();

  constructor(config: Partial<TokenPipelineConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as TokenPipelineConfig;
  }

  /**
   * 添加消息
   */
  addMessage(content: string, tokens: number, tags: string[] = []): void {
    const entry: MemoryEntry = {
      content,
      tokens,
      timestamp: Date.now(),
      importance: this.calculateImportance(content, tags),
      tags,
    };

    this.shortTermMemory.push(entry);

    // 检查是否需要压缩
    if (this.getUsage().usageRate > this.config.compressionThreshold) {
      this.compress();
    }
  }

  /**
   * 获取 Token 使用情况
   */
  getUsage(): TokenUsage {
    const shortTerm = this.shortTermMemory.reduce((sum, m) => sum + m.tokens, 0);
    const midTerm = this.midTermMemory.reduce((sum, m) => sum + m.tokens, 0);
    const longTerm = this.longTermMemory.size * 50; // 估算
    const total = shortTerm + midTerm + longTerm;

    return {
      shortTerm,
      midTerm,
      longTerm,
      total,
      usageRate: total / this.config.maxTokens,
    };
  }

  /**
   * 构建上下文
   */
  buildContext(query: string): string {
    const parts: string[] = [];

    // 添加短期记忆（滑动窗口）
    const windowEntries = this.shortTermMemory.slice(-this.config.windowSize);
    for (const entry of windowEntries) {
      parts.push(entry.content);
    }

    // 添加中期记忆摘要
    if (this.midTermMemory.length > 0) {
      parts.push('\n[历史摘要]');
      for (const compressed of this.midTermMemory) {
        parts.push(compressed.summary);
      }
    }

    // 添加长期记忆（按需加载）
    if (this.config.enableTieredMemory && query) {
      const relevantMemories = this.loadRelevantMemories(query);
      if (relevantMemories.length > 0) {
        parts.push('\n[相关知识]');
        for (const memory of relevantMemories) {
          parts.push(memory.summary);
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * 压缩记忆
   */
  compress(): void {
    if (!this.config.enableCompression) return;

    // 滑动窗口：保留最近 N 条
    const toCompress = this.shortTermMemory.slice(0, -this.config.windowSize);
    this.shortTermMemory = this.shortTermMemory.slice(-this.config.windowSize);

    // 压缩到中期记忆
    if (toCompress.length > 0) {
      const compressed = this.compressEntries(toCompress);
      this.midTermMemory.push(compressed);

      // 检查中期记忆是否需要进一步压缩
      if (this.midTermMemory.length > 5) {
        this.compressMidTerm();
      }
    }
  }

  /**
   * 压缩条目
   */
  private compressEntries(entries: MemoryEntry[]): CompressedEntry {
    // 简单摘要：取前 200 字符
    const allContent = entries.map(e => e.content).join(' ');
    const summary = allContent.slice(0, 200) + '...';
    
    // 压缩后 Token 数约为原来的 30%
    const tokens = Math.floor(entries.reduce((sum, e) => sum + e.tokens, 0) * 0.3);

    return {
      summary,
      tokens,
      originalCount: entries.length,
      timeRange: {
        start: entries[0]?.timestamp || Date.now(),
        end: entries[entries.length - 1]?.timestamp || Date.now(),
      },
    };
  }

  /**
   * 压缩中期记忆到长期记忆
   */
  private compressMidTerm(): void {
    const toArchive = this.midTermMemory.slice(0, -3);
    this.midTermMemory = this.midTermMemory.slice(-3);

    for (const compressed of toArchive) {
      const key = `memory-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.longTermMemory.set(key, {
        embedding: [], // 实际实现需要生成 embedding
        summary: compressed.summary,
      });
    }
  }

  /**
   * 加载相关记忆
   */
  private loadRelevantMemories(query: string): Array<{ summary: string }> {
    // 简化实现：返回所有长期记忆
    // 实际实现需要基于 embedding 相似度检索
    const memories: Array<{ summary: string }> = [];
    
    for (const [, value] of this.longTermMemory) {
      memories.push({ summary: value.summary });
    }

    return memories.slice(0, 3); // 最多返回 3 条
  }

  /**
   * 计算重要性分数
   */
  private calculateImportance(content: string, tags: string[]): number {
    let score = 0.5; // 基础分数

    // 标签加成
    if (tags.includes('important')) score += 0.2;
    if (tags.includes('user')) score += 0.1;
    if (tags.includes('error')) score += 0.15;

    // 内容长度加成
    if (content.length > 500) score += 0.1;

    // 关键词加成
    if (content.includes('重要') || content.includes('关键')) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * 清空记忆
   */
  clear(): void {
    this.shortTermMemory = [];
    this.midTermMemory = [];
    this.longTermMemory.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    shortTermCount: number;
    midTermCount: number;
    longTermCount: number;
    usage: TokenUsage;
  } {
    return {
      shortTermCount: this.shortTermMemory.length,
      midTermCount: this.midTermMemory.length,
      longTermCount: this.longTermMemory.size,
      usage: this.getUsage(),
    };
  }
}

// ============ 工厂函数 ============

/**
 * 创建 Token 流水线实例
 */
export function createTokenPipeline(config: Partial<TokenPipelineConfig> = {}): TokenPipeline {
  return new TokenPipeline(config);
}

// ============ Token 估算工具 ============

/**
 * 估算文本 Token 数
 * 
 * 简化估算：英文约 4 字符 = 1 Token，中文约 1.5 字符 = 1 Token
 */
export function estimateTokens(text: string): number {
  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 统计英文字符
  const englishChars = text.length - chineseChars;
  
  // 估算
  const chineseTokens = Math.ceil(chineseChars / 1.5);
  const englishTokens = Math.ceil(englishChars / 4);
  
  return chineseTokens + englishTokens;
}
