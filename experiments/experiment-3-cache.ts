/**
 * 实验 3：缓存命中率与时效性
 * 
 * 目的：验证 H-006（缓存时效性假设）
 * 
 * 方法：
 * 1. 运行 1000 个请求（含重复）
 * 2. 记录缓存命中率、结果正确率
 * 3. 分析缓存失效场景
 * 
 * 预期结果：
 * - 命中率 > 30% 且正确率 > 99% → 保持
 * - 正确率 < 95% → 调整 TTL 或淘汰策略
 * - 命中率 < 10% → 考虑移除
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface CacheRequest {
  id: string;
  query: string;
  params: Record<string, any>;
  timestamp: number;
  isRepeat: boolean;       // 是否是重复请求
  originalRequestId?: string;
  expectedStaleness?: number; // 预期数据过期时间（秒）
}

interface CacheEntry {
  key: string;
  value: any;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastHitAt: number;
  size: number;
}

interface CacheResult {
  requestId: string;
  hit: boolean;
  correct: boolean;
  staleness: number;       // 数据年龄（秒）
  latency: number;         // 响应时间（ms）
  cost: number;            // 成本（相对值）
}

interface AggregatedCacheResult {
  totalRequests: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  correctCount: number;
  correctRate: number;
  avgLatencyHit: number;
  avgLatencyMiss: number;
  avgCost: number;
  costSavings: number;     // 节省的成本比例
  staleCount: number;      // 过期数据次数
  staleRate: number;
}

interface CacheConfig {
  maxSize: number;         // 最大缓存条目数
  ttl: number;             // 默认 TTL（秒）
  strategy: "lru" | "lfu" | "fifo";
  staleWhileRevalidate: boolean;
}

// ============================================================
// 请求生成器
// ============================================================

class RequestGenerator {
  /**
   * 生成测试请求集
   * 
   * @param count 总请求数
   * @param repeatRate 重复请求比例
   */
  static generate(count: number = 1000, repeatRate: number = 0.3): CacheRequest[] {
    const requests: CacheRequest[] = [];
    const uniqueQueries = this.generateUniqueQueries(Math.floor(count * (1 - repeatRate)));
    
    // 先生成唯一请求
    for (let i = 0; i < uniqueQueries.length; i++) {
      requests.push({
        id: `req-${i}`,
        query: uniqueQueries[i].query,
        params: uniqueQueries[i].params,
        timestamp: Date.now() + i * 100, // 每个请求间隔 100ms
        isRepeat: false,
        expectedStaleness: Math.random() < 0.2 ? 60 : 3600, // 20% 短时效
      });
    }
    
    // 生成重复请求
    const repeatCount = count - uniqueQueries.length;
    for (let i = 0; i < repeatCount; i++) {
      const originalIndex = Math.floor(Math.random() * uniqueQueries.length);
      const original = requests[originalIndex];
      
      requests.push({
        id: `req-${uniqueQueries.length + i}`,
        query: original.query,
        params: { ...original.params },
        timestamp: Date.now() + (uniqueQueries.length + i) * 100,
        isRepeat: true,
        originalRequestId: original.id,
        expectedStaleness: original.expectedStaleness,
      });
    }
    
    // 打乱顺序
    return this.shuffle(requests);
  }
  
  private static generateUniqueQueries(count: number): Array<{ query: string; params: Record<string, any> }> {
    const queryTemplates = [
      { query: "获取用户信息", params: { userId: "string" } },
      { query: "搜索文档", params: { keyword: "string", limit: "number" } },
      { query: "分析代码", params: { file: "string" } },
      { query: "生成报告", params: { type: "string", date: "string" } },
      { query: "查询天气", params: { city: "string" } },
      { query: "翻译文本", params: { text: "string", targetLang: "string" } },
      { query: "计算统计", params: { data: "array" } },
      { query: "验证配置", params: { config: "object" } },
    ];
    
    const queries: Array<{ query: string; params: Record<string, any> }> = [];
    
    for (let i = 0; i < count; i++) {
      const template = queryTemplates[i % queryTemplates.length];
      const params: Record<string, any> = {};
      
      for (const [key, type] of Object.entries(template.params)) {
        switch (type) {
          case "string":
            params[key] = `${key}_${Math.floor(Math.random() * 100)}`;
            break;
          case "number":
            params[key] = Math.floor(Math.random() * 100);
            break;
          case "array":
            params[key] = [1, 2, 3, Math.random() * 100];
            break;
          case "object":
            params[key] = { a: 1, b: Math.random() };
            break;
        }
      }
      
      queries.push({
        query: template.query,
        params,
      });
    }
    
    return queries;
  }
  
  private static shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// ============================================================
// 缓存系统
// ============================================================

class CacheSystem {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private accessOrder: string[] = []; // LRU 顺序
  private hitCount: number = 0;
  private missCount: number = 0;
  
  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: 1000,
      ttl: 3600, // 1 小时
      strategy: "lru",
      staleWhileRevalidate: true,
      ...config,
    };
  }
  
  /**
   * 生成缓存键
   */
  private generateKey(query: string, params: Record<string, any>): string {
    const content = JSON.stringify({ query, params });
    return crypto.createHash("md5").update(content).digest("hex");
  }
  
  /**
   * 获取缓存
   */
  get(query: string, params: Record<string, any>): { hit: boolean; entry?: CacheEntry; stale: boolean } {
    const key = this.generateKey(query, params);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return { hit: false, stale: false };
    }
    
    const now = Date.now();
    const isExpired = now > entry.expiresAt;
    const isStale = now - entry.createdAt > 60000; // 超过 1 分钟视为可能过期
    
    if (isExpired && !this.config.staleWhileRevalidate) {
      this.cache.delete(key);
      this.missCount++;
      return { hit: false, stale: false };
    }
    
    // 更新访问顺序（LRU）
    if (this.config.strategy === "lru") {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
    }
    
    entry.hitCount++;
    entry.lastHitAt = now;
    this.hitCount++;
    
    return { hit: true, entry, stale: isStale || isExpired };
  }
  
  /**
   * 设置缓存
   */
  set(query: string, params: Record<string, any>, value: any, ttl?: number): void {
    const key = this.generateKey(query, params);
    const now = Date.now();
    const entryTtl = ttl || this.config.ttl;
    
    // 检查是否需要淘汰
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict();
    }
    
    const entry: CacheEntry = {
      key,
      value,
      createdAt: now,
      expiresAt: now + entryTtl * 1000,
      hitCount: 0,
      lastHitAt: now,
      size: JSON.stringify(value).length,
    };
    
    this.cache.set(key, entry);
    this.accessOrder.push(key);
  }
  
  /**
   * 淘汰策略
   */
  private evict(): void {
    if (this.cache.size === 0) return;
    
    let keyToEvict: string;
    
    switch (this.config.strategy) {
      case "lru":
        keyToEvict = this.accessOrder.shift() || this.cache.keys().next().value || "";
        break;
      case "lfu":
        let minHits = Infinity;
        keyToEvict = this.cache.keys().next().value || "";
        for (const [key, entry] of this.cache) {
          if (entry.hitCount < minHits) {
            minHits = entry.hitCount;
            keyToEvict = key;
          }
        }
        break;
      case "fifo":
        keyToEvict = this.accessOrder.shift() || this.cache.keys().next().value || "";
        break;
    }
    
    this.cache.delete(keyToEvict);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    size: number;
    hitRate: number;
    avgHitCount: number;
    avgAge: number;
  } {
    const now = Date.now();
    let totalHitCount = 0;
    let totalAge = 0;
    
    for (const entry of this.cache.values()) {
      totalHitCount += entry.hitCount;
      totalAge += now - entry.createdAt;
    }
    
    return {
      size: this.cache.size,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      avgHitCount: this.cache.size > 0 ? totalHitCount / this.cache.size : 0,
      avgAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
    };
  }
  
  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// ============================================================
// 模拟后端服务
// ============================================================

class BackendService {
  private dataVersion: Map<string, number> = new Map();
  
  /**
   * 模拟请求处理
   */
  async process(query: string, params: Record<string, any>): Promise<{ result: any; version: number }> {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    const key = JSON.stringify({ query, params });
    
    // 模拟数据变化（10% 概率数据更新）
    if (Math.random() < 0.1) {
      this.dataVersion.set(key, (this.dataVersion.get(key) || 0) + 1);
    }
    
    const version = this.dataVersion.get(key) || 1;
    
    return {
      result: { query, params, data: `result-${version}` },
      version,
    };
  }
  
  /**
   * 检查数据是否过期
   */
  isStale(query: string, params: Record<string, any>, cachedVersion: number): boolean {
    const key = JSON.stringify({ query, params });
    const currentVersion = this.dataVersion.get(key) || 1;
    return currentVersion > cachedVersion;
  }
}

// ============================================================
// 实验运行器
// ============================================================

class Experiment3Runner {
  private requests: CacheRequest[];
  private cache: CacheSystem;
  private backend: BackendService;
  private results: CacheResult[] = [];
  private outputDir: string;
  
  constructor(config?: {
    requestCount?: number;
    repeatRate?: number;
    cacheConfig?: Partial<CacheConfig>;
    outputDir?: string;
  }) {
    this.requests = RequestGenerator.generate(
      config?.requestCount || 1000,
      config?.repeatRate || 0.3
    );
    this.cache = new CacheSystem(config?.cacheConfig);
    this.backend = new BackendService();
    this.outputDir = config?.outputDir || "./experiment-results";
  }
  
  async run(): Promise<AggregatedCacheResult> {
    console.log("=".repeat(60));
    console.log("实验 3：缓存命中率与时效性");
    console.log("=".repeat(60));
    console.log(`总请求数: ${this.requests.length}`);
    console.log(`重复请求: ${this.requests.filter(r => r.isRepeat).length}`);
    console.log(`缓存配置: maxSize=1000, TTL=3600s, strategy=LRU`);
    console.log("");
    
    let hitCount = 0;
    let missCount = 0;
    let correctCount = 0;
    let staleCount = 0;
    let totalLatencyHit = 0;
    let totalLatencyMiss = 0;
    let totalCost = 0;
    let costSaved = 0;
    
    for (let i = 0; i < this.requests.length; i++) {
      const request = this.requests[i];
      const startTime = Date.now();
      
      // 尝试从缓存获取
      const cacheResult = this.cache.get(request.query, request.params);
      
      let result: CacheResult;
      
      if (cacheResult.hit) {
        // 缓存命中
        const latency = Date.now() - startTime;
        hitCount++;
        totalLatencyHit += latency;
        costSaved += 1; // 节省的成本
        
        // 检查数据是否过期
        const cachedVersion = cacheResult.entry!.value.version;
        const isStale = this.backend.isStale(request.query, request.params, cachedVersion);
        
        if (isStale) {
          staleCount++;
        }
        
        result = {
          requestId: request.id,
          hit: true,
          correct: !isStale,
          staleness: (Date.now() - cacheResult.entry!.createdAt) / 1000,
          latency,
          cost: 0.1, // 缓存命中成本很低
        };
      } else {
        // 缓存未命中，请求后端
        const backendResult = await this.backend.process(request.query, request.params);
        const latency = Date.now() - startTime;
        missCount++;
        totalLatencyMiss += latency;
        totalCost += 1;
        
        // 存入缓存
        this.cache.set(request.query, request.params, backendResult);
        
        result = {
          requestId: request.id,
          hit: false,
          correct: true,
          staleness: 0,
          latency,
          cost: 1,
        };
      }
      
      this.results.push(result);
      
      // 进度显示
      if ((i + 1) % 200 === 0) {
        console.log(`  进度: ${i + 1}/${this.requests.length}`);
      }
    }
    
    // 聚合结果
    const aggregated: AggregatedCacheResult = {
      totalRequests: this.requests.length,
      hitCount,
      missCount,
      hitRate: hitCount / this.requests.length,
      correctCount: this.results.filter(r => r.correct).length,
      correctRate: this.results.filter(r => r.correct).length / this.requests.length,
      avgLatencyHit: hitCount > 0 ? totalLatencyHit / hitCount : 0,
      avgLatencyMiss: missCount > 0 ? totalLatencyMiss / missCount : 0,
      avgCost: totalCost / this.requests.length,
      costSavings: costSaved / (totalCost + costSaved),
      staleCount,
      staleRate: staleCount / Math.max(1, hitCount),
    };
    
    // 保存结果
    await this.saveResults(aggregated);
    
    // 生成报告
    this.generateReport(aggregated);
    
    return aggregated;
  }
  
  private async saveResults(aggregated: AggregatedCacheResult): Promise<void> {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    const detailPath = path.join(this.outputDir, `experiment-3-detail-${timestamp}.json`);
    fs.writeFileSync(detailPath, JSON.stringify(this.results.slice(0, 100), null, 2)); // 只保存前 100 条
    
    const aggregatedPath = path.join(this.outputDir, `experiment-3-aggregated-${timestamp}.json`);
    fs.writeFileSync(aggregatedPath, JSON.stringify(aggregated, null, 2));
    
    console.log(`\n结果已保存到 ${this.outputDir}`);
  }
  
  private generateReport(aggregated: AggregatedCacheResult): void {
    console.log("\n" + "=".repeat(60));
    console.log("实验报告");
    console.log("=".repeat(60));
    
    console.log("\n--- 基础指标 ---");
    console.log(`总请求数: ${aggregated.totalRequests}`);
    console.log(`缓存命中: ${aggregated.hitCount} (${(aggregated.hitRate * 100).toFixed(1)}%)`);
    console.log(`缓存未命中: ${aggregated.missCount}`);
    
    console.log("\n--- 性能指标 ---");
    console.log(`平均延迟（命中）: ${aggregated.avgLatencyHit.toFixed(2)}ms`);
    console.log(`平均延迟（未命中）: ${aggregated.avgLatencyMiss.toFixed(2)}ms`);
    console.log(`延迟降低: ${((1 - aggregated.avgLatencyHit / aggregated.avgLatencyMiss) * 100).toFixed(1)}%`);
    
    console.log("\n--- 质量指标 ---");
    console.log(`结果正确率: ${(aggregated.correctRate * 100).toFixed(1)}%`);
    console.log(`过期数据次数: ${aggregated.staleCount}`);
    console.log(`过期率（占命中）: ${(aggregated.staleRate * 100).toFixed(1)}%`);
    
    console.log("\n--- 成本指标 ---");
    console.log(`成本节省: ${(aggregated.costSavings * 100).toFixed(1)}%`);
    console.log(`平均成本: ${aggregated.avgCost.toFixed(3)}`);
    
    console.log("\n--- 分析结论 ---");
    
    // 命中率分析
    if (aggregated.hitRate >= 0.3) {
      console.log(`✓ 命中率 ${(aggregated.hitRate * 100).toFixed(1)}% >= 30%，缓存有效`);
    } else if (aggregated.hitRate >= 0.1) {
      console.log(`⚠ 命中率 ${(aggregated.hitRate * 100).toFixed(1)}% 在 10-30% 之间，建议优化`);
    } else {
      console.log(`✗ 命中率 ${(aggregated.hitRate * 100).toFixed(1)}% < 10%，考虑移除缓存`);
    }
    
    // 正确率分析
    if (aggregated.correctRate >= 0.99) {
      console.log(`✓ 正确率 ${(aggregated.correctRate * 100).toFixed(1)}% >= 99%，数据可靠`);
    } else if (aggregated.correctRate >= 0.95) {
      console.log(`⚠ 正确率 ${(aggregated.correctRate * 100).toFixed(1)}% 在 95-99% 之间，建议调整 TTL`);
    } else {
      console.log(`✗ 正确率 ${(aggregated.correctRate * 100).toFixed(1)}% < 95%，需要缩短 TTL 或禁用缓存`);
    }
    
    // 过期率分析
    if (aggregated.staleRate > 0.1) {
      console.log(`⚠ 过期率 ${(aggregated.staleRate * 100).toFixed(1)}% > 10%，建议启用 stale-while-revalidate`);
    }
    
    // 最终建议
    console.log("\n--- 最终建议 ---");
    
    if (aggregated.hitRate >= 0.3 && aggregated.correctRate >= 0.99) {
      console.log("✓ 缓存系统表现良好，建议保持当前配置");
    } else if (aggregated.hitRate >= 0.1 && aggregated.correctRate >= 0.95) {
      console.log("→ 缓存系统可用，建议优化配置：");
      if (aggregated.hitRate < 0.3) {
        console.log("  - 增加缓存大小或延长 TTL");
      }
      if (aggregated.correctRate < 0.99) {
        console.log("  - 缩短 TTL 或启用 stale-while-revalidate");
      }
    } else {
      console.log("✗ 缓存系统效果不佳，建议：");
      if (aggregated.hitRate < 0.1) {
        console.log("  - 考虑移除缓存或调整缓存策略");
      }
      if (aggregated.correctRate < 0.95) {
        console.log("  - 对关键数据禁用缓存");
      }
    }
    
    console.log("\n" + "=".repeat(60));
  }
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  const runner = new Experiment3Runner({
    requestCount: 1000,
    repeatRate: 0.3,
    cacheConfig: {
      maxSize: 1000,
      ttl: 3600,
      strategy: "lru",
      staleWhileRevalidate: true,
    },
    outputDir: "./experiment-results",
  });
  
  await runner.run();
}

if (require.main === module) {
  main().catch(console.error);
}
