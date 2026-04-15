/**
 * 预测性预热器
 * 
 * 功能：
 * 1. 基于历史模式预测下一步操作
 * 2. 预加载常用资源
 * 3. 智能缓存预热
 */

// ============================================================
// 类型定义
// ============================================================

interface UsagePattern {
  action: string;
  frequency: number;
  lastUsed: number;
  avgInterval: number;
  nextPredicted: number;
}

interface PreloadItem {
  type: 'model' | 'cache' | 'embedding' | 'config';
  key: string;
  priority: number;
  loadFn: () => Promise<any>;
}

interface WarmupStats {
  totalPreloads: number;
  successfulPreloads: number;
  failedPreloads: number;
  avgLoadTime: number;
  hitRate: number;
}

// ============================================================
// 预测性预热器
// ============================================================

export class PredictiveWarmer {
  private usagePatterns: Map<string, UsagePattern> = new Map();
  private preloadQueue: PreloadItem[] = [];
  private preloadedItems: Map<string, { data: any; timestamp: number }> = new Map();
  private stats: WarmupStats = {
    totalPreloads: 0,
    successfulPreloads: 0,
    failedPreloads: 0,
    avgLoadTime: 0,
    hitRate: 0,
  };

  private config: {
    maxPreloadItems: number;
    preloadThreshold: number;
    cacheExpiry: number;
    warmupInterval: number;
  };

  constructor(config?: Partial<typeof PredictiveWarmer.prototype.config>) {
    this.config = {
      maxPreloadItems: 50,
      preloadThreshold: 0.3,
      cacheExpiry: 300000, // 5 分钟
      warmupInterval: 60000, // 1 分钟
      ...config,
    };
  }

  /**
   * 记录使用模式
   */
  recordUsage(action: string): void {
    const now = Date.now();
    const existing = this.usagePatterns.get(action);

    if (existing) {
      // 更新现有模式
      const interval = now - existing.lastUsed;
      existing.frequency++;
      existing.avgInterval = (existing.avgInterval * (existing.frequency - 1) + interval) / existing.frequency;
      existing.lastUsed = now;
      existing.nextPredicted = now + existing.avgInterval;
    } else {
      // 创建新模式
      this.usagePatterns.set(action, {
        action,
        frequency: 1,
        lastUsed: now,
        avgInterval: 0,
        nextPredicted: now,
      });
    }
  }

  /**
   * 预测下一步操作
   */
  predictNext(currentAction: string): string[] {
    const predictions: Array<{ action: string; score: number }> = [];

    // 基于当前操作查找相关模式
    for (const [action, pattern] of this.usagePatterns) {
      if (action === currentAction) continue;

      // 计算预测分数
      const recency = 1 / (Date.now() - pattern.lastUsed + 1);
      const frequency = pattern.frequency / 100;
      const timing = pattern.nextPredicted < Date.now() + 60000 ? 1 : 0.5;

      const score = recency * 0.3 + frequency * 0.4 + timing * 0.3;

      if (score > this.config.preloadThreshold) {
        predictions.push({ action, score });
      }
    }

    // 按分数排序
    predictions.sort((a, b) => b.score - a.score);

    return predictions.slice(0, 5).map(p => p.action);
  }

  /**
   * 添加预加载项
   */
  addPreloadItem(item: PreloadItem): void {
    // 检查是否已存在
    const existing = this.preloadQueue.find(i => i.key === item.key);
    if (existing) {
      existing.priority = Math.max(existing.priority, item.priority);
      return;
    }

    // 添加到队列
    this.preloadQueue.push(item);
    this.preloadQueue.sort((a, b) => b.priority - a.priority);

    // 限制队列大小
    if (this.preloadQueue.length > this.config.maxPreloadItems) {
      this.preloadQueue.pop();
    }
  }

  /**
   * 执行预热
   */
  async warmup(): Promise<void> {
    const start = Date.now();

    for (const item of this.preloadQueue) {
      try {
        this.stats.totalPreloads++;
        const data = await item.loadFn();
        
        this.preloadedItems.set(item.key, {
          data,
          timestamp: Date.now(),
        });
        
        this.stats.successfulPreloads++;
      } catch (error) {
        this.stats.failedPreloads++;
        console.error(`预热失败: ${item.key}`, error);
      }
    }

    this.stats.avgLoadTime = Date.now() - start;
  }

  /**
   * 获取预加载的数据
   */
  getPreloaded<T>(key: string): T | null {
    const item = this.preloadedItems.get(key);
    
    if (!item) return null;
    
    // 检查是否过期
    if (Date.now() - item.timestamp > this.config.cacheExpiry) {
      this.preloadedItems.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * 智能预热（基于当前上下文）
   */
  async smartWarmup(context: {
    recentActions: string[];
    currentTime: number;
    userPreferences?: Record<string, unknown>;
  }): Promise<void> {
    // 1. 分析最近操作
    for (const action of context.recentActions) {
      this.recordUsage(action);
    }

    // 2. 预测下一步
    const predictions = new Set<string>();
    for (const action of context.recentActions.slice(-3)) {
      const next = this.predictNext(action);
      next.forEach(n => predictions.add(n));
    }

    // 3. 添加预加载项
    for (const predicted of predictions) {
      this.addPreloadItem({
        type: 'cache',
        key: predicted,
        priority: 0.5,
        loadFn: async () => ({ action: predicted, preloaded: true }),
      });
    }

    // 4. 执行预热
    await this.warmup();
  }

  /**
   * 获取统计信息
   */
  getStats(): WarmupStats & { patterns: number; queueSize: number; cacheSize: number } {
    return {
      ...this.stats,
      patterns: this.usagePatterns.size,
      queueSize: this.preloadQueue.length,
      cacheSize: this.preloadedItems.size,
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.preloadedItems) {
      if (now - item.timestamp > this.config.cacheExpiry) {
        this.preloadedItems.delete(key);
      }
    }
  }

  /**
   * 重置
   */
  reset(): void {
    this.usagePatterns.clear();
    this.preloadQueue = [];
    this.preloadedItems.clear();
    this.stats = {
      totalPreloads: 0,
      successfulPreloads: 0,
      failedPreloads: 0,
      avgLoadTime: 0,
      hitRate: 0,
    };
  }
}

// ============================================================
// 单例
// ============================================================

let instance: PredictiveWarmer | null = null;

export function getPredictiveWarmer(config?: {
  maxPreloadItems?: number;
  preloadThreshold?: number;
  cacheExpiry?: number;
  warmupInterval?: number;
}): PredictiveWarmer {
  if (!instance) {
    instance = new PredictiveWarmer(config);
  }
  return instance;
}
