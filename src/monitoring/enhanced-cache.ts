/**
 * 增强型缓存系统
 * 
 * 优化策略：
 * 1. 语义缓存：相似请求复用
 * 2. 分层缓存：热点数据优先
 * 3. 自适应 TTL：根据访问频率调整
 * 4. 预测性缓存：基于历史模式
 */

import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface CacheEntry {
  key: string;
  value: any;
  embedding?: number[];
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessAt: number;
  priority: "high" | "medium" | "low";
  tags: string[];
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  semanticHits: number;
}

interface EnhancedCacheConfig {
  maxSize: number;
  defaultTTL: number;
  semanticThreshold: number;  // 语义相似度阈值
  enableSemanticCache: boolean;
  enableAdaptiveTTL: boolean;
}

// ============================================================
// 增强型缓存系统
// ============================================================

export class EnhancedCacheSystem {
  private cache: Map<string, CacheEntry> = new Map();
  private config: EnhancedCacheConfig;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private semanticHits: number = 0;
  private accessPatterns: Map<string, number[]> = new Map(); // 访问时间模式

  constructor(config?: Partial<EnhancedCacheConfig>) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 3600000, // 1小时
      semanticThreshold: 0.85,
      enableSemanticCache: true,
      enableAdaptiveTTL: true,
      ...config,
    };
  }

  /**
   * 生成缓存键
   */
  generateKey(input: string, context?: Record<string, unknown>): string {
    // 标准化输入，提高命中率
    const normalized = this.normalizeInput(input);
    const data = context ? `${normalized}:${JSON.stringify(context)}` : normalized;
    return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
  }

  /**
   * 标准化输入（去除空格、统一大小写等）
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\u4e00-\u9fa5\s?！？。，,.]/g, '')
      .trim();
  }

  /**
   * 提取特征标签
   */
  private extractTags(input: string): string[] {
    const tags: string[] = [];
    
    // 关键词标签
    const keywords = [
      '天气', '文件', '搜索', '日程', '备忘', '天气',
      'file', 'search', 'calendar', 'note', 'weather',
      '代码', 'code', 'python', 'javascript',
      '翻译', 'translate', '英语', 'english',
      '计算', 'calculate', '数学', 'math',
      '写', 'write', '生成', 'generate',
      '分析', 'analyze', '解释', 'explain',
    ];
    for (const kw of keywords) {
      if (input.toLowerCase().includes(kw)) {
        tags.push(kw);
      }
    }
    
    // 意图标签
    if (input.includes('?') || input.includes('？')) tags.push('question');
    if (input.includes('请') || input.includes('帮')) tags.push('request');
    if (input.includes('如何') || input.includes('怎么')) tags.push('how-to');
    if (input.includes('什么是') || input.includes('what is')) tags.push('definition');
    
    return tags;
  }

  /**
   * 计算简单相似度（基于 Jaccard + 编辑距离）
   */
  private calculateSimilarity(a: string, b: string): number {
    // 标准化
    const normA = a.toLowerCase().replace(/\s+/g, ' ').trim();
    const normB = b.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // 完全相同
    if (normA === normB) return 1.0;
    
    // 包含关系
    if (normA.includes(normB) || normB.includes(normA)) {
      const shorter = Math.min(normA.length, normB.length);
      const longer = Math.max(normA.length, normB.length);
      return shorter / longer;
    }
    
    // Jaccard 相似度
    const wordsA = new Set(normA.split(/\s+/));
    const wordsB = new Set(normB.split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    const jaccard = intersection.size / union.size;
    
    // 字符级相似度
    const charA = new Set(normA.split(''));
    const charB = new Set(normB.split(''));
    const charIntersection = new Set([...charA].filter(x => charB.has(x)));
    const charUnion = new Set([...charA, ...charB]);
    const charSimilarity = charIntersection.size / charUnion.size;
    
    // 综合分数
    return jaccard * 0.6 + charSimilarity * 0.4;
  }

  /**
   * 获取缓存（支持语义匹配）
   */
  get(key: string, originalInput?: string): any | null {
    const entry = this.cache.get(key);
    
    if (entry) {
      // 直接命中
      if (Date.now() <= entry.expiresAt) {
        entry.hitCount++;
        entry.lastAccessAt = Date.now();
        this.hits++;
        this.recordAccess(key);
        return entry.value;
      } else {
        // 过期
        this.cache.delete(key);
      }
    }

    // 语义缓存匹配
    if (this.config.enableSemanticCache && originalInput) {
      const semanticMatch = this.findSemanticMatch(originalInput);
      if (semanticMatch) {
        this.semanticHits++;
        this.hits++;
        semanticMatch.hitCount++;
        semanticMatch.lastAccessAt = Date.now();
        return semanticMatch.value;
      }
    }

    this.misses++;
    return null;
  }

  /**
   * 查找语义匹配
   */
  private findSemanticMatch(input: string): CacheEntry | null {
    const normalizedInput = this.normalizeInput(input);
    const inputTags = this.extractTags(input);
    
    let bestMatch: CacheEntry | null = null;
    let bestScore = 0;

    for (const entry of this.cache.values()) {
      // 标签匹配加分
      const tagOverlap = entry.tags.filter(t => inputTags.includes(t)).length;
      const maxTags = Math.max(entry.tags.length, inputTags.length, 1);
      const tagScore = tagOverlap / maxTags;
      
      // 文本相似度
      const textScore = this.calculateSimilarity(normalizedInput, entry.key);
      
      // 综合分数（标签权重更高）
      const score = tagScore * 0.6 + textScore * 0.4;
      
      // 动态阈值：有标签重叠时降低阈值
      const threshold = tagOverlap > 0 ? 0.3 : 0.5;
      
      if (score >= threshold && score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    return bestMatch;
  }

  /**
   * 设置缓存
   */
  set(key: string, value: any, ttl?: number, tags?: string[], originalInput?: string): void {
    // 淘汰策略
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    const now = Date.now();
    const finalTTL = this.config.enableAdaptiveTTL 
      ? this.calculateAdaptiveTTL(key, ttl) 
      : (ttl || this.config.defaultTTL);

    const entry: CacheEntry = {
      key: originalInput || key, // 存储原始输入用于语义匹配
      value,
      createdAt: now,
      expiresAt: now + finalTTL,
      hitCount: 0,
      lastAccessAt: now,
      priority: this.determinePriority(value),
      tags: tags || [],
    };

    this.cache.set(key, entry);
  }

  /**
   * 计算自适应 TTL
   */
  private calculateAdaptiveTTL(key: string, baseTTL?: number): number {
    const pattern = this.accessPatterns.get(key);
    if (!pattern || pattern.length < 3) {
      return baseTTL || this.config.defaultTTL;
    }

    // 根据访问频率调整 TTL
    const avgInterval = pattern.slice(1).reduce((sum, t, i) => sum + (t - pattern[i]), 0) / (pattern.length - 1);
    
    // 访问频繁 → 延长 TTL
    if (avgInterval < 60000) { // 1分钟内
      return (baseTTL || this.config.defaultTTL) * 2;
    }
    // 访问稀疏 → 缩短 TTL
    if (avgInterval > 3600000) { // 1小时以上
      return (baseTTL || this.config.defaultTTL) * 0.5;
    }

    return baseTTL || this.config.defaultTTL;
  }

  /**
   * 记录访问模式
   */
  private recordAccess(key: string): void {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }
    const pattern = this.accessPatterns.get(key)!;
    pattern.push(Date.now());
    // 只保留最近 10 次访问
    if (pattern.length > 10) {
      pattern.shift();
    }
  }

  /**
   * 确定优先级
   */
  private determinePriority(value: any): "high" | "medium" | "low" {
    if (typeof value === 'object' && value !== null) {
      // 复杂对象优先级高
      if (Array.isArray(value) && value.length > 10) return "high";
      if (Object.keys(value).length > 5) return "high";
    }
    if (typeof value === 'string' && value.length > 500) return "medium";
    return "low";
  }

  /**
   * 智能淘汰
   */
  private evict(): void {
    const candidates: Array<{ key: string; score: number }> = [];

    for (const [key, entry] of this.cache) {
      // 计算淘汰分数（越低越应该淘汰）
      const age = Date.now() - entry.createdAt;
      const recency = Date.now() - entry.lastAccessAt;
      const priorityWeight = entry.priority === "high" ? 3 : entry.priority === "medium" ? 2 : 1;
      
      const score = (entry.hitCount * priorityWeight) - (age / 100000) - (recency / 10000);
      
      candidates.push({ key, score });
    }

    // 淘汰分数最低的 10%
    candidates.sort((a, b) => a.score - b.score);
    const evictCount = Math.ceil(this.config.maxSize * 0.1);
    
    for (let i = 0; i < evictCount && i < candidates.length; i++) {
      this.cache.delete(candidates[i].key);
      this.evictions++;
    }
  }

  /**
   * 预热缓存
   */
  warmup(entries: Array<{ key: string; value: any; tags?: string[] }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.value, undefined, entry.tags);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      evictions: this.evictions,
      semanticHits: this.semanticHits,
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.accessPatterns.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.semanticHits = 0;
  }

  /**
   * 获取热点数据
   */
  getHotKeys(limit: number = 10): Array<{ key: string; hitCount: number }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, hitCount: entry.hitCount }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);
  }
}

// ============================================================
// 全局实例
// ============================================================

let globalEnhancedCache: EnhancedCacheSystem | null = null;

export function getEnhancedCache(): EnhancedCacheSystem {
  if (!globalEnhancedCache) {
    globalEnhancedCache = new EnhancedCacheSystem();
  }
  return globalEnhancedCache;
}
