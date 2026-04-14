/**
 * 监控指标采集器
 * 
 * 功能：
 * 1. 系统级指标采集
 * 2. 组件级指标采集
 * 3. 指标存储与查询
 * 4. 告警阈值检测
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

export interface SystemMetrics {
  timestamp: number;
  health: number;           // 0-100
  avgLatency: number;       // ms
  cacheHitRate: number;     // 0-1
  tokenEfficiency: number;  // 0-1
  taskCompletionRate: number; // 0-1
  uptime: number;           // seconds
  requestCount: number;
  errorCount: number;
}

export interface ComponentMetrics {
  componentId: string;
  timestamp: number;
  [key: string]: number | string;
}

export interface MetricThreshold {
  metric: string;
  warning: number;
  critical: number;
  comparison: "above" | "below";
}

export interface Alert {
  id: string;
  timestamp: number;
  level: "warning" | "critical";
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

// ============================================================
// 指标采集器
// ============================================================

export class MetricsCollector {
  private metricsPath: string;
  private systemMetrics: SystemMetrics[] = [];
  private componentMetrics: Map<string, ComponentMetrics[]> = new Map();
  private alerts: Alert[] = [];
  private thresholds: MetricThreshold[] = [];
  private startTime: number;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private latencySum: number = 0;
  private latencyCount: number = 0;

  constructor(metricsPath: string = "./metrics") {
    this.metricsPath = metricsPath;
    this.startTime = Date.now();
    this.ensureDir(metricsPath);
    this.loadMetrics();
    this.initThresholds();
  }

  /**
   * 初始化告警阈值
   */
  private initThresholds(): void {
    this.thresholds = [
      { metric: "health", warning: 80, critical: 70, comparison: "below" },
      { metric: "avgLatency", warning: 3000, critical: 5000, comparison: "above" },
      { metric: "cacheHitRate", warning: 0.3, critical: 0.1, comparison: "below" },
      { metric: "tokenEfficiency", warning: 0.7, critical: 0.5, comparison: "below" },
      { metric: "taskCompletionRate", warning: 0.9, critical: 0.8, comparison: "below" },
    ];
  }

  /**
   * 记录请求
   */
  recordRequest(latency: number, success: boolean): void {
    this.requestCount++;
    this.latencySum += latency;
    this.latencyCount++;
    if (!success) {
      this.errorCount++;
    }
  }

  /**
   * 采集系统指标
   */
  collectSystemMetrics(components: {
    cacheHitRate?: number;
    tokenEfficiency?: number;
    taskCompletionRate?: number;
  }): SystemMetrics {
    const now = Date.now();
    const uptime = Math.floor((now - this.startTime) / 1000);
    const avgLatency = this.latencyCount > 0 ? this.latencySum / this.latencyCount : 0;
    const taskCompletionRate = components.taskCompletionRate ?? 
      (this.requestCount > 0 ? (this.requestCount - this.errorCount) / this.requestCount : 1);

    // 计算健康度（加权平均）
    let health = 100;
    if (avgLatency > 3000) health -= 20;
    if (avgLatency > 5000) health -= 20;
    if (components.cacheHitRate && components.cacheHitRate < 0.3) health -= 15;
    if (components.tokenEfficiency && components.tokenEfficiency < 0.7) health -= 15;
    if (taskCompletionRate < 0.9) health -= 20;
    if (taskCompletionRate < 0.8) health -= 20;

    const metrics: SystemMetrics = {
      timestamp: now,
      health: Math.max(0, health),
      avgLatency,
      cacheHitRate: components.cacheHitRate ?? 0,
      tokenEfficiency: components.tokenEfficiency ?? 0,
      taskCompletionRate,
      uptime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
    };

    this.systemMetrics.push(metrics);
    this.checkThresholds(metrics);
    this.saveMetrics();

    return metrics;
  }

  /**
   * 采集组件指标
   */
  collectComponentMetrics(componentId: string, metrics: Record<string, number | string>): void {
    const componentMetrics: ComponentMetrics = {
      componentId,
      timestamp: Date.now(),
      ...metrics,
    };

    if (!this.componentMetrics.has(componentId)) {
      this.componentMetrics.set(componentId, []);
    }
    this.componentMetrics.get(componentId)!.push(componentMetrics);
    this.saveMetrics();
  }

  /**
   * 检查阈值并生成告警
   */
  private checkThresholds(metrics: SystemMetrics): void {
    for (const threshold of this.thresholds) {
      const value = metrics[threshold.metric as keyof SystemMetrics] as number;
      if (value === undefined) continue;

      const isWarning = threshold.comparison === "above" 
        ? value > threshold.warning 
        : value < threshold.warning;
      const isCritical = threshold.comparison === "above" 
        ? value > threshold.critical 
        : value < threshold.critical;

      if (isCritical) {
        this.alerts.push({
          id: `alert-${Date.now()}-${threshold.metric}`,
          timestamp: Date.now(),
          level: "critical",
          metric: threshold.metric,
          value,
          threshold: threshold.critical,
          message: `${threshold.metric} 达到临界值: ${value} (阈值: ${threshold.critical})`,
        });
      } else if (isWarning) {
        this.alerts.push({
          id: `alert-${Date.now()}-${threshold.metric}`,
          timestamp: Date.now(),
          level: "warning",
          metric: threshold.metric,
          value,
          threshold: threshold.warning,
          message: `${threshold.metric} 达到警告值: ${value} (阈值: ${threshold.warning})`,
        });
      }
    }
  }

  /**
   * 获取最新系统指标
   */
  getLatestSystemMetrics(): SystemMetrics | null {
    return this.systemMetrics.length > 0 
      ? this.systemMetrics[this.systemMetrics.length - 1] 
      : null;
  }

  /**
   * 获取系统指标历史
   */
  getSystemMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.systemMetrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * 获取组件指标
   */
  getComponentMetrics(componentId: string, hours: number = 24): ComponentMetrics[] {
    const metrics = this.componentMetrics.get(componentId) || [];
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(hours: number = 1): Alert[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.alerts.filter(a => a.timestamp > cutoff);
  }

  /**
   * 生成指标报告
   */
  generateReport(): string {
    const latest = this.getLatestSystemMetrics();
    const alerts = this.getActiveAlerts(24);

    const lines: string[] = [
      "# 元灵系统监控报告",
      "",
      `生成时间: ${new Date().toISOString()}`,
      "",
      "## 系统指标",
      "",
      "| 指标 | 当前值 | 状态 |",
      "|------|--------|------|",
    ];

    if (latest) {
      const healthStatus = latest.health >= 90 ? "✅" : latest.health >= 70 ? "⚠️" : "🔴";
      const latencyStatus = latest.avgLatency < 2000 ? "✅" : latest.avgLatency < 5000 ? "⚠️" : "🔴";
      const cacheStatus = latest.cacheHitRate > 0.3 ? "✅" : latest.cacheHitRate > 0.1 ? "⚠️" : "🔴";

      lines.push(`| 健康度 | ${latest.health.toFixed(1)}% | ${healthStatus} |`);
      lines.push(`| 平均延迟 | ${latest.avgLatency.toFixed(0)}ms | ${latencyStatus} |`);
      lines.push(`| 缓存命中率 | ${(latest.cacheHitRate * 100).toFixed(1)}% | ${cacheStatus} |`);
      lines.push(`| Token 效率 | ${(latest.tokenEfficiency * 100).toFixed(1)}% | - |`);
      lines.push(`| 任务完成率 | ${(latest.taskCompletionRate * 100).toFixed(1)}% | - |`);
      lines.push(`| 运行时间 | ${Math.floor(latest.uptime / 3600)}h | - |`);
      lines.push(`| 请求总数 | ${latest.requestCount} | - |`);
      lines.push(`| 错误总数 | ${latest.errorCount} | - |`);
    }

    lines.push("");
    lines.push("## 告警");
    lines.push("");

    if (alerts.length === 0) {
      lines.push("无活跃告警 ✅");
    } else {
      lines.push("| 时间 | 级别 | 指标 | 值 | 阈值 |");
      lines.push("|------|------|------|-----|------|");
      for (const alert of alerts) {
        const time = new Date(alert.timestamp).toLocaleString();
        const level = alert.level === "critical" ? "🔴 严重" : "⚠️ 警告";
        lines.push(`| ${time} | ${level} | ${alert.metric} | ${alert.value} | ${alert.threshold} |`);
      }
    }

    lines.push("");
    lines.push("---");
    lines.push(`*报告生成时间: ${new Date().toISOString()}*`);

    return lines.join("\n");
  }

  /**
   * 保存指标到文件
   */
  private saveMetrics(): void {
    const data = {
      systemMetrics: this.systemMetrics.slice(-1000), // 保留最近 1000 条
      componentMetrics: Object.fromEntries(
        Array.from(this.componentMetrics.entries()).map(([k, v]) => [k, v.slice(-1000)])
      ),
      alerts: this.alerts.slice(-100),
    };

    fs.writeFileSync(
      path.join(this.metricsPath, "metrics.json"),
      JSON.stringify(data, null, 2)
    );
  }

  /**
   * 从文件加载指标
   */
  private loadMetrics(): void {
    const filePath = path.join(this.metricsPath, "metrics.json");
    if (!fs.existsSync(filePath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      this.systemMetrics = data.systemMetrics || [];
      this.componentMetrics = new Map(Object.entries(data.componentMetrics || {}));
      this.alerts = data.alerts || [];
    } catch (e) {
      // 忽略加载错误
    }
  }

  /**
   * 确保目录存在
   */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.latencySum = 0;
    this.latencyCount = 0;
    this.startTime = Date.now();
  }
}

// ============================================================
// 全局实例
// ============================================================

let globalCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector();
  }
  return globalCollector;
}
