/**
 * 查询历史管理
 * 
 * 功能：
 * 1. 高频查询缓存
 * 2. 查询统计
 * 3. 热门查询追踪
 */

// ============================================================
// 类型定义
// ============================================================

export interface QueryRecord {
  query: string;
  timestamp: number;
  resultCount: number;
  clickedPosition?: number;
  mode: string;
}

export interface QueryStats {
  query: string;
  count: number;
  avgResultCount: number;
  clickRate: number;
  lastQueried: number;
}

export interface HistoryConfig {
  maxHistory: number;
  cacheThreshold: number;    // 缓存阈值（查询次数）
  ttl: number;               // 缓存 TTL（毫秒）
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: HistoryConfig = {
  maxHistory: 10000,
  cacheThreshold: 3,
  ttl: 3600000,  // 1 小时
};

// ============================================================
// 查询历史管理器
// ============================================================

export class QueryHistory {
  private config: HistoryConfig;
  private history: QueryRecord[] = [];
  private stats: Map<string, QueryStats> = new Map();
  private cache: Map<string, { results: any[]; timestamp: number }> = new Map();

  constructor(config: Partial<HistoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 记录查询
   */
  record(record: QueryRecord): void {
    this.history.push(record);
    
    // 限制历史大小
    if (this.history.length > this.config.maxHistory) {
      this.history = this.history.slice(-this.config.maxHistory);
    }

    // 更新统计
    this.updateStats(record);
  }

  /**
   * 更新统计
   */
  private updateStats(record: QueryRecord): void {
    const existing = this.stats.get(record.query);
    
    if (existing) {
      existing.count++;
      existing.avgResultCount = (existing.avgResultCount + record.resultCount) / 2;
      existing.lastQueried = record.timestamp;
      if (record.clickedPosition !== undefined && record.clickedPosition > 0) {
        existing.clickRate = (existing.clickRate * (existing.count - 1) + 1) / existing.count;
      }
    } else {
      this.stats.set(record.query, {
        query: record.query,
        count: 1,
        avgResultCount: record.resultCount,
        clickRate: record.clickedPosition !== undefined && record.clickedPosition > 0 ? 1 : 0,
        lastQueried: record.timestamp,
      });
    }
  }

  /**
   * 检查缓存
   */
  checkCache(query: string): any[] | null {
    const cached = this.cache.get(query);
    
    if (!cached) {
      return null;
    }

    // 检查 TTL
    if (Date.now() - cached.timestamp > this.config.ttl) {
      this.cache.delete(query);
      return null;
    }

    return cached.results;
  }

  /**
   * 设置缓存
   */
  setCache(query: string, results: any[]): void {
    // 只缓存高频查询
    const stats = this.stats.get(query);
    if (stats && stats.count >= this.config.cacheThreshold) {
      this.cache.set(query, {
        results,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 获取热门查询
   */
  getTopQueries(limit: number = 10): QueryStats[] {
    return Array.from(this.stats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 获取最近查询
   */
  getRecentQueries(limit: number = 10): QueryRecord[] {
    return this.history.slice(-limit);
  }

  /**
   * 获取查询统计
   */
  getQueryStats(query: string): QueryStats | undefined {
    return this.stats.get(query);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.history = [];
    this.stats.clear();
    this.cache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    historyCount: number;
    uniqueQueries: number;
    cacheSize: number;
  } {
    return {
      historyCount: this.history.length,
      uniqueQueries: this.stats.size,
      cacheSize: this.cache.size,
    };
  }
}
