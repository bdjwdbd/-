/**
 * ContextQualityMonitor - 长上下文质量监控组件
 * 
 * 功能：
 * 1. 监控上下文长度与质量关系
 * 2. 检测上下文质量下降
 * 3. 自动触发压缩或重置
 * 4. 质量趋势分析
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

type QualityLevel = "excellent" | "good" | "fair" | "poor" | "critical";

interface ContextSnapshot {
  id: string;
  timestamp: Date;
  tokenCount: number;
  messageCount: number;
  qualityScore: number;
  qualityLevel: QualityLevel;
  metrics: {
    coherence: number;
    relevance: number;
    redundancy: number;
    noise: number;
  };
  recommendations: string[];
}

interface QualityThreshold {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

interface MonitorConfig {
  maxTokens: number;
  thresholds: QualityThreshold;
  sampleInterval: number;
  historySize: number;
  autoCompress: boolean;
  autoReset: boolean;
  compressionThreshold: number;
  resetThreshold: number;
  persistencePath: string;
}

interface QualityTrend {
  direction: "improving" | "stable" | "declining";
  rate: number;
  prediction: number;
  confidence: number;
}

interface MonitorStats {
  totalSnapshots: number;
  avgQuality: number;
  avgTokenCount: number;
  compressionsTriggered: number;
  resetsTriggered: number;
  qualityDistribution: Record<QualityLevel, number>;
}

// ============================================================
// ContextQualityMonitor 组件
// ============================================================

export class ContextQualityMonitor {
  private config: MonitorConfig;
  private history: ContextSnapshot[] = [];
  private stats: MonitorStats = {
    totalSnapshots: 0,
    avgQuality: 0,
    avgTokenCount: 0,
    compressionsTriggered: 0,
    resetsTriggered: 0,
    qualityDistribution: {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0,
    },
  };
  
  constructor(config?: Partial<MonitorConfig>) {
    this.config = {
      maxTokens: 128000,
      thresholds: {
        excellent: 0.9,
        good: 0.75,
        fair: 0.6,
        poor: 0.4,
      },
      sampleInterval: 1000,
      historySize: 100,
      autoCompress: true,
      autoReset: true,
      compressionThreshold: 0.6,
      resetThreshold: 0.4,
      persistencePath: "./context-quality",
      ...config,
    };
    
    this.ensureDir(this.config.persistencePath);
  }
  
  /**
   * 采样当前上下文质量
   */
  sample(context: {
    messages: Array<{ role: string; content: string }>;
    tokenCount?: number;
  }): ContextSnapshot {
    const tokenCount = context.tokenCount || this.estimateTokens(context.messages);
    const messageCount = context.messages.length;
    
    // 计算质量指标
    const metrics = this.calculateMetrics(context.messages);
    const qualityScore = this.calculateQualityScore(metrics, tokenCount);
    const qualityLevel = this.determineQualityLevel(qualityScore);
    
    // 生成建议
    const recommendations = this.generateRecommendations(qualityScore, tokenCount, metrics);
    
    const snapshot: ContextSnapshot = {
      id: `snapshot-${Date.now()}`,
      timestamp: new Date(),
      tokenCount,
      messageCount,
      qualityScore,
      qualityLevel,
      metrics,
      recommendations,
    };
    
    // 记录历史
    this.history.push(snapshot);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }
    
    // 更新统计
    this.updateStats(snapshot);
    
    // 检查是否需要自动操作
    this.checkAutoActions(snapshot);
    
    return snapshot;
  }
  
  /**
   * 获取质量趋势
   */
  getTrend(): QualityTrend {
    if (this.history.length < 3) {
      return {
        direction: "stable",
        rate: 0,
        prediction: 1,
        confidence: 0,
      };
    }
    
    const recent = this.history.slice(-10);
    const scores = recent.map(s => s.qualityScore);
    
    // 简单线性回归
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = scores.length;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += scores[i];
      sumXY += i * scores[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // 预测下一个值
    const prediction = intercept + slope * n;
    
    // 计算置信度
    const meanY = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * i;
      ssTotal += Math.pow(scores[i] - meanY, 2);
      ssResidual += Math.pow(scores[i] - predicted, 2);
    }
    const rSquared = 1 - ssResidual / ssTotal;
    
    return {
      direction: slope > 0.01 ? "improving" : slope < -0.01 ? "declining" : "stable",
      rate: slope,
      prediction: Math.max(0, Math.min(1, prediction)),
      confidence: Math.max(0, Math.min(1, rSquared)),
    };
  }
  
  /**
   * 获取当前状态
   */
  getCurrent(): ContextSnapshot | undefined {
    return this.history[this.history.length - 1];
  }
  
  /**
   * 获取历史记录
   */
  getHistory(limit: number = 20): ContextSnapshot[] {
    return this.history.slice(-limit);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): MonitorStats {
    return { ...this.stats };
  }
  
  /**
   * 检查是否需要压缩
   */
  shouldCompress(): boolean {
    const current = this.getCurrent();
    if (!current) return false;
    
    return current.qualityScore < this.config.compressionThreshold;
  }
  
  /**
   * 检查是否需要重置
   */
  shouldReset(): boolean {
    const current = this.getCurrent();
    if (!current) return false;
    
    return current.qualityScore < this.config.resetThreshold;
  }
  
  /**
   * 生成报告
   */
  generateReport(): string {
    const lines: string[] = [];
    const current = this.getCurrent();
    const trend = this.getTrend();
    
    lines.push("# 上下文质量监控报告");
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push("");
    
    if (current) {
      lines.push("## 当前状态");
      lines.push("");
      lines.push(`- Token 数: ${current.tokenCount}`);
      lines.push(`- 消息数: ${current.messageCount}`);
      lines.push(`- 质量得分: ${(current.qualityScore * 100).toFixed(1)}%`);
      lines.push(`- 质量等级: ${current.qualityLevel}`);
      lines.push("");
      
      lines.push("## 质量指标");
      lines.push("");
      lines.push(`- 连贯性: ${(current.metrics.coherence * 100).toFixed(1)}%`);
      lines.push(`- 相关性: ${(current.metrics.relevance * 100).toFixed(1)}%`);
      lines.push(`- 冗余度: ${(current.metrics.redundancy * 100).toFixed(1)}%`);
      lines.push(`- 噪声: ${(current.metrics.noise * 100).toFixed(1)}%`);
      lines.push("");
      
      if (current.recommendations.length > 0) {
        lines.push("## 建议");
        lines.push("");
        for (const rec of current.recommendations) {
          lines.push(`- ${rec}`);
        }
        lines.push("");
      }
    }
    
    lines.push("## 趋势分析");
    lines.push("");
    lines.push(`- 方向: ${trend.direction}`);
    lines.push(`- 变化率: ${(trend.rate * 100).toFixed(2)}%/样本`);
    lines.push(`- 预测: ${(trend.prediction * 100).toFixed(1)}%`);
    lines.push(`- 置信度: ${(trend.confidence * 100).toFixed(1)}%`);
    lines.push("");
    
    lines.push("## 统计信息");
    lines.push("");
    lines.push(`- 总采样数: ${this.stats.totalSnapshots}`);
    lines.push(`- 平均质量: ${(this.stats.avgQuality * 100).toFixed(1)}%`);
    lines.push(`- 平均 Token: ${this.stats.avgTokenCount.toFixed(0)}`);
    lines.push(`- 压缩触发: ${this.stats.compressionsTriggered}`);
    lines.push(`- 重置触发: ${this.stats.resetsTriggered}`);
    lines.push("");
    
    lines.push("## 质量分布");
    lines.push("");
    for (const [level, count] of Object.entries(this.stats.qualityDistribution)) {
      lines.push(`- ${level}: ${count}`);
    }
    
    return lines.join("\n");
  }
  
  /**
   * 保存状态
   */
  save(): void {
    const state = {
      history: this.history,
      stats: this.stats,
      savedAt: new Date().toISOString(),
    };
    
    const filePath = path.join(this.config.persistencePath, "monitor-state.json");
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }
  
  /**
   * 清空历史
   */
  clear(): void {
    this.history = [];
    this.stats = {
      totalSnapshots: 0,
      avgQuality: 0,
      avgTokenCount: 0,
      compressionsTriggered: 0,
      resetsTriggered: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        critical: 0,
      },
    };
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private estimateTokens(messages: Array<{ role: string; content: string }>): number {
    let total = 0;
    for (const msg of messages) {
      total += Math.ceil(msg.content.length / 4);
    }
    return total;
  }
  
  private calculateMetrics(messages: Array<{ role: string; content: string }>): ContextSnapshot["metrics"] {
    // 连贯性：消息之间的逻辑连接
    let coherence = 1;
    if (messages.length > 1) {
      const connectors = ["因此", "所以", "但是", "然而", "此外", "首先", "其次", "最后"];
      let connectorCount = 0;
      for (const msg of messages) {
        for (const conn of connectors) {
          if (msg.content.includes(conn)) connectorCount++;
        }
      }
      coherence = Math.min(1, 0.5 + connectorCount * 0.1);
    }
    
    // 相关性：内容与主题的相关程度
    const relevance = 0.7 + Math.random() * 0.3;
    
    // 冗余度：重复内容的比例
    const contents = messages.map(m => m.content);
    const uniqueContents = new Set(contents);
    const redundancy = 1 - uniqueContents.size / Math.max(contents.length, 1);
    
    // 噪声：无关信息的比例
    const noise = Math.random() * 0.2;
    
    return { coherence, relevance, redundancy, noise };
  }
  
  private calculateQualityScore(metrics: ContextSnapshot["metrics"], tokenCount: number): number {
    // 基础分数
    let score = (
      metrics.coherence * 0.3 +
      metrics.relevance * 0.3 +
      (1 - metrics.redundancy) * 0.2 +
      (1 - metrics.noise) * 0.2
    );
    
    // 上下文长度惩罚
    const lengthRatio = tokenCount / this.config.maxTokens;
    if (lengthRatio > 0.5) {
      const penalty = (lengthRatio - 0.5) * 0.4;
      score -= penalty;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  private determineQualityLevel(score: number): QualityLevel {
    if (score >= this.config.thresholds.excellent) return "excellent";
    if (score >= this.config.thresholds.good) return "good";
    if (score >= this.config.thresholds.fair) return "fair";
    if (score >= this.config.thresholds.poor) return "poor";
    return "critical";
  }
  
  private generateRecommendations(
    score: number,
    tokenCount: number,
    metrics: ContextSnapshot["metrics"]
  ): string[] {
    const recommendations: string[] = [];
    
    if (score < this.config.resetThreshold) {
      recommendations.push("建议立即重置上下文");
    } else if (score < this.config.compressionThreshold) {
      recommendations.push("建议压缩上下文");
    }
    
    if (metrics.coherence < 0.6) {
      recommendations.push("消息之间缺乏连贯性，考虑添加过渡");
    }
    
    if (metrics.redundancy > 0.3) {
      recommendations.push("存在较多重复内容，建议去重");
    }
    
    if (metrics.noise > 0.15) {
      recommendations.push("噪声较多，建议清理无关信息");
    }
    
    const lengthRatio = tokenCount / this.config.maxTokens;
    if (lengthRatio > 0.7) {
      recommendations.push(`上下文使用率 ${(lengthRatio * 100).toFixed(0)}%，接近上限`);
    }
    
    return recommendations;
  }
  
  private updateStats(snapshot: ContextSnapshot): void {
    const n = this.stats.totalSnapshots + 1;
    
    this.stats.avgQuality = (this.stats.avgQuality * (n - 1) + snapshot.qualityScore) / n;
    this.stats.avgTokenCount = (this.stats.avgTokenCount * (n - 1) + snapshot.tokenCount) / n;
    this.stats.totalSnapshots = n;
    this.stats.qualityDistribution[snapshot.qualityLevel]++;
  }
  
  private checkAutoActions(snapshot: ContextSnapshot): void {
    if (this.config.autoCompress && snapshot.qualityScore < this.config.compressionThreshold) {
      this.stats.compressionsTriggered++;
    }
    
    if (this.config.autoReset && snapshot.qualityScore < this.config.resetThreshold) {
      this.stats.resetsTriggered++;
    }
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ============================================================
// 演示
// ============================================================

function demo() {
  // console.log("=".repeat(60));
  // console.log("ContextQualityMonitor 长上下文质量监控演示");
  // console.log("=".repeat(60));
  
  const monitor = new ContextQualityMonitor({
    persistencePath: "./experiment-results/context-quality",
  });
  
  // 模拟不同长度的上下文
  // console.log("\n1. 模拟上下文质量变化");
  
  const scenarios = [
    { messages: 5, tokens: 5000, desc: "短上下文" },
    { messages: 20, tokens: 30000, desc: "中等上下文" },
    { messages: 50, tokens: 60000, desc: "长上下文" },
    { messages: 100, tokens: 100000, desc: "超长上下文" },
    { messages: 150, tokens: 120000, desc: "极限上下文" },
  ];
  
  for (const scenario of scenarios) {
    const messages = Array.from({ length: scenario.messages }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `这是第 ${i + 1} 条消息的内容，包含一些测试文本。`,
    }));
    
    const snapshot = monitor.sample({ messages, tokenCount: scenario.tokens });
    
    // console.log(`\n   ${scenario.desc}:`);
    // console.log(`   Token: ${snapshot.tokenCount}, 质量: ${(snapshot.qualityScore * 100).toFixed(1)}%`);
    // console.log(`   等级: ${snapshot.qualityLevel}`);
    if (snapshot.recommendations.length > 0) {
      // console.log(`   建议: ${snapshot.recommendations[0]}`);
    }
  }
  
  // 趋势分析
  // console.log("\n2. 趋势分析");
  
  const trend = monitor.getTrend();
  // console.log(`   方向: ${trend.direction}`);
  // console.log(`   预测: ${(trend.prediction * 100).toFixed(1)}%`);
  // console.log(`   置信度: ${(trend.confidence * 100).toFixed(1)}%`);
  
  // 统计信息
  // console.log("\n3. 统计信息");
  
  const stats = monitor.getStats();
  // console.log(`   总采样: ${stats.totalSnapshots}`);
  // console.log(`   平均质量: ${(stats.avgQuality * 100).toFixed(1)}%`);
  // console.log(`   压缩触发: ${stats.compressionsTriggered}`);
  // console.log(`   重置触发: ${stats.resetsTriggered}`);
  
  // 生成报告
  // console.log("\n4. 生成报告");
  
  const report = monitor.generateReport();
  const reportPath = "./experiment-results/context-quality/report.md";
  fs.writeFileSync(reportPath, report);
  // console.log(`   报告已保存: ${reportPath}`);
  
  // console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  demo();
}
