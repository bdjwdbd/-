/**
 * @file monitor.ts
 * @brief 监控告警系统
 * 
 * 功能：
 * 1. 性能指标采集
 * 2. 健康检查
 * 3. 告警通知
 */

// ============================================================
// 类型定义
// ============================================================

export interface Metric {
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
}

export interface Alert {
    id: string;
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: number;
    resolved: boolean;
}

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, {
        status: boolean;
        message?: string;
        latency?: number;
    }>;
    metrics: Record<string, number>;
}

// ============================================================
// 监控系统
// ============================================================

export class Monitor {
    private metrics: Metric[] = [];
    private alerts: Alert[] = [];
    private thresholds: Map<string, { warning: number; critical: number }> = new Map();
    private maxMetrics: number = 10000;

    constructor() {
        // 默认阈值
        this.thresholds.set('latency_p99', { warning: 100, critical: 500 });
        this.thresholds.set('error_rate', { warning: 0.01, critical: 0.05 });
        this.thresholds.set('memory_usage', { warning: 0.8, critical: 0.95 });
        this.thresholds.set('cpu_usage', { warning: 0.7, critical: 0.9 });
    }

    // ============================================================
    // 指标采集
    // ============================================================

    /**
     * 记录指标
     */
    recordMetric(name: string, value: number, tags?: Record<string, string>): void {
        this.metrics.push({
            name,
            value,
            timestamp: Date.now(),
            tags,
        });

        // 限制数量
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }

        // 检查告警
        this.checkThreshold(name, value);
    }

    /**
     * 记录延迟
     */
    recordLatency(operation: string, latencyMs: number): void {
        this.recordMetric(`latency_${operation}`, latencyMs, { type: 'latency' });
    }

    /**
     * 记录错误
     */
    recordError(operation: string, error: Error): void {
        this.recordMetric(`error_${operation}`, 1, { 
            type: 'error',
            message: error.message 
        });
    }

    /**
     * 记录计数
     */
    incrementCounter(name: string, delta: number = 1): void {
        const current = this.getLatestMetric(name)?.value || 0;
        this.recordMetric(name, current + delta, { type: 'counter' });
    }

    // ============================================================
    // 查询
    // ============================================================

    /**
     * 获取最新指标
     */
    getLatestMetric(name: string): Metric | null {
        for (let i = this.metrics.length - 1; i >= 0; i--) {
            if (this.metrics[i].name === name) {
                return this.metrics[i];
            }
        }
        return null;
    }

    /**
     * 获取指标历史
     */
    getMetricHistory(name: string, since?: number): Metric[] {
        return this.metrics.filter(m => 
            m.name === name && (!since || m.timestamp >= since)
        );
    }

    /**
     * 计算百分位
     */
    getPercentile(name: string, percentile: number): number | null {
        const values = this.metrics
            .filter(m => m.name === name)
            .map(m => m.value)
            .sort((a, b) => a - b);

        if (values.length === 0) return null;

        const index = Math.floor(values.length * percentile / 100);
        return values[index];
    }

    /**
     * 计算平均值
     */
    getAverage(name: string): number | null {
        const values = this.metrics
            .filter(m => m.name === name)
            .map(m => m.value);

        if (values.length === 0) return null;

        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    // ============================================================
    // 告警
    // ============================================================

    /**
     * 设置阈值
     */
    setThreshold(name: string, warning: number, critical: number): void {
        this.thresholds.set(name, { warning, critical });
    }

    /**
     * 检查阈值
     */
    private checkThreshold(name: string, value: number): void {
        const threshold = this.thresholds.get(name);
        if (!threshold) return;

        if (value >= threshold.critical) {
            this.createAlert('critical', `${name} exceeded critical threshold: ${value} >= ${threshold.critical}`);
        } else if (value >= threshold.warning) {
            this.createAlert('warning', `${name} exceeded warning threshold: ${value} >= ${threshold.warning}`);
        }
    }

    /**
     * 创建告警
     */
    createAlert(level: Alert['level'], message: string): Alert {
        const alert: Alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            level,
            message,
            timestamp: Date.now(),
            resolved: false,
        };

        this.alerts.push(alert);
        this.onAlert(alert);

        return alert;
    }

    /**
     * 获取活跃告警
     */
    getActiveAlerts(): Alert[] {
        return this.alerts.filter(a => !a.resolved);
    }

    /**
     * 解决告警
     */
    resolveAlert(id: string): void {
        const alert = this.alerts.find(a => a.id === id);
        if (alert) {
            alert.resolved = true;
        }
    }

    /**
     * 告警回调（可覆盖）
     */
    protected onAlert(alert: Alert): void {
        // console.log(`[${alert.level.toUpperCase()}] ${alert.message}`);
    }

    // ============================================================
    // 健康检查
    // ============================================================

    /**
     * 执行健康检查
     */
    async healthCheck(checks: Record<string, () => Promise<boolean>>): Promise<HealthStatus> {
        const results: HealthStatus['checks'] = {};

        for (const [name, check] of Object.entries(checks)) {
            const start = Date.now();
            try {
                const status = await check();
                results[name] = {
                    status,
                    latency: Date.now() - start,
                };
            } catch (error: any) {
                results[name] = {
                    status: false,
                    message: error.message,
                    latency: Date.now() - start,
                };
            }
        }

        // 计算整体状态
        const failedChecks = Object.values(results).filter(r => !r.status);
        let status: HealthStatus['status'];

        if (failedChecks.length === 0) {
            status = 'healthy';
        } else if (failedChecks.length <= Object.keys(checks).length / 2) {
            status = 'degraded';
        } else {
            status = 'unhealthy';
        }

        // 收集指标
        const metrics: Record<string, number> = {
            latency_p50: this.getPercentile('latency_search', 50) || 0,
            latency_p99: this.getPercentile('latency_search', 99) || 0,
            error_rate: this.getAverage('error_rate') || 0,
            memory_usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        };

        return { status, checks: results, metrics };
    }

    // ============================================================
    // 导出
    // ============================================================

    /**
     * 导出 Prometheus 格式
     */
    exportPrometheus(): string {
        const lines: string[] = [];

        // 按名称分组
        const grouped = new Map<string, Metric[]>();
        for (const metric of this.metrics) {
            const existing = grouped.get(metric.name) || [];
            existing.push(metric);
            grouped.set(metric.name, existing);
        }

        // 导出
        for (const [name, metrics] of grouped) {
            const latest = metrics[metrics.length - 1];
            const tags = latest.tags 
                ? Object.entries(latest.tags).map(([k, v]) => `${k}="${v}"`).join(',')
                : '';
            
            lines.push(`# TYPE ${name} gauge`);
            lines.push(`${name}${tags ? '{' + tags + '}' : ''} ${latest.value}`);
        }

        return lines.join('\n');
    }
}

// ============================================================
// 单例
// ============================================================

let defaultMonitor: Monitor | null = null;

export function getMonitor(): Monitor {
    if (!defaultMonitor) {
        defaultMonitor = new Monitor();
    }
    return defaultMonitor;
}

// ============================================================
// 装饰器：自动记录延迟
// ============================================================

export function monitored(name?: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const original = descriptor.value;
        const operationName = name || propertyKey;

        descriptor.value = async function (...args: any[]) {
            const monitor = getMonitor();
            const start = Date.now();

            try {
                const result = await original.apply(this, args);
                monitor.recordLatency(operationName, Date.now() - start);
                return result;
            } catch (error) {
                monitor.recordError(operationName, error as Error);
                throw error;
            }
        };

        return descriptor;
    };
}

// ============================================================
// 导出
// ============================================================

export default Monitor;
