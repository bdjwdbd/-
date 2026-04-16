/**
 * Harness Engineering - 追踪收集器
 * 
 * 负责收集、存储和管理追踪数据
 * 
 * @module harness/trace-system/collector
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  Trace,
  TraceContext,
  Span,
  SpanStatus,
  SpanKind,
  Layer,
  LogEntry,
  Event,
  TraceSystemConfig,
  DEFAULT_TRACE_CONFIG,
  DecisionAudit,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  TraceMetrics,
  SpanMetrics,
  TraceQuery,
  TraceQueryResult,
} from './trace-types';

// ============ 追踪收集器 ============

/**
 * 追踪收集器
 * 
 * 核心功能：
 * - 创建和管理追踪
 * - 跨度生命周期管理
 * - 决策审计记录
 * - 异常检测
 * - 性能分析
 */
export class TraceCollector {
  private config: TraceSystemConfig;
  private activeTraces: Map<string, Trace> = new Map();
  private completedTraces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private decisionAudits: Map<string, DecisionAudit> = new Map();
  private anomalies: Anomaly[] = [];
  private contextStack: TraceContext[] = [];

  constructor(config: Partial<TraceSystemConfig> = {}) {
    this.config = { ...DEFAULT_TRACE_CONFIG, ...config };
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.config.enablePersistence) {
      await this.loadPersistedTraces();
    }
  }

  // ============ 追踪管理 ============

  /**
   * 开始新追踪
   */
  startTrace(name: string, metadata?: Record<string, unknown>): TraceContext {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const trace: Trace = {
      traceId,
      rootSpanId: spanId,
      spans: new Map(),
      createdAt: Date.now(),
      name,
      status: SpanStatus.RUNNING,
      metadata,
    };

    this.activeTraces.set(traceId, trace);

    const context: TraceContext = {
      traceId,
      spanId,
      sampled: Math.random() < this.config.sampleRate,
    };

    this.contextStack.push(context);
    return context;
  }

  /**
   * 结束追踪
   */
  endTrace(traceId: string, status: SpanStatus = SpanStatus.COMPLETED): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    trace.completedAt = Date.now();
    trace.status = status;

    // 移动到已完成追踪
    this.activeTraces.delete(traceId);
    this.completedTraces.set(traceId, trace);

    // 限制已完成追踪数量
    if (this.completedTraces.size > this.config.maxTraces) {
      const oldestKey = this.completedTraces.keys().next().value;
      if (oldestKey) {
        this.completedTraces.delete(oldestKey);
      }
    }

    // 持久化
    if (this.config.enablePersistence) {
      this.persistTrace(trace);
    }

    // 异常检测
    if (this.config.enableAnomalyDetection) {
      this.detectAnomalies(trace);
    }

    // 清理上下文栈
    this.contextStack = this.contextStack.filter(ctx => ctx.traceId !== traceId);
  }

  /**
   * 获取追踪
   */
  getTrace(traceId: string): Trace | undefined {
    return this.activeTraces.get(traceId) || this.completedTraces.get(traceId);
  }

  // ============ 跨度管理 ============

  /**
   * 开始跨度
   */
  startSpan(
    operationName: string,
    layer: Layer,
    parentContext?: TraceContext,
    kind: SpanKind = SpanKind.INTERNAL
  ): TraceContext {
    const traceId = parentContext?.traceId || this.contextStack[this.contextStack.length - 1]?.traceId;
    if (!traceId) {
      throw new Error('No active trace');
    }

    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    const spanId = this.generateSpanId();
    const parentSpanId = parentContext?.spanId || trace.rootSpanId;

    const span: Span = {
      spanId,
      parentSpanId,
      traceId,
      operationName,
      kind,
      layer,
      startTime: Date.now(),
      status: SpanStatus.RUNNING,
      tags: {},
      attributes: {},
      logs: [],
      events: [],
      childSpanIds: [],
    };

    // 添加到追踪
    trace.spans.set(spanId, span);
    this.activeSpans.set(spanId, span);

    // 更新父跨度的子跨度列表
    if (parentSpanId) {
      const parentSpan = trace.spans.get(parentSpanId);
      if (parentSpan) {
        parentSpan.childSpanIds.push(spanId);
      }
    }

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      sampled: parentContext?.sampled ?? true,
    };

    this.contextStack.push(context);
    return context;
  }

  /**
   * 结束跨度
   */
  endSpan(
    spanId: string,
    status: SpanStatus = SpanStatus.COMPLETED,
    message?: string
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.status = status;
    if (message) {
      span.statusMessage = message;
    }

    this.activeSpans.delete(spanId);

    // 检查性能阈值
    const duration = span.endTime - span.startTime;
    const threshold = this.config.performanceThresholds[span.layer];
    if (threshold && duration > threshold) {
      this.addSpanEvent(span, 'performance_warning', {
        duration,
        threshold,
        exceeded: duration - threshold,
      });
    }

    // 清理上下文栈
    this.contextStack = this.contextStack.filter(ctx => ctx.spanId !== spanId);
  }

  /**
   * 获取当前上下文
   */
  getCurrentContext(): TraceContext | undefined {
    return this.contextStack[this.contextStack.length - 1];
  }

  // ============ 跨度操作 ============

  /**
   * 添加标签
   */
  addSpanTag(
    spanId: string,
    key: string,
    value: string | number | boolean
  ): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  /**
   * 添加属性
   */
  addSpanAttribute(spanId: string, key: string, value: unknown): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }

  /**
   * 添加日志
   */
  addSpanLog(
    spanId: string,
    level: LogEntry['level'],
    message: string,
    attributes?: Record<string, unknown>
  ): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        attributes,
      });
    }
  }

  /**
   * 添加事件
   */
  addSpanEvent(
    span: Span,
    name: string,
    attributes?: Record<string, unknown>
  ): void {
    span.events.push({
      timestamp: Date.now(),
      name,
      attributes,
    });
  }

  /**
   * 记录异常
   */
  recordException(spanId: string, error: Error): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.status = SpanStatus.FAILED;
      span.statusMessage = error.message;
      span.tags['error'] = true;
      span.tags['error.type'] = error.name;
      span.attributes['error.stack'] = error.stack;
    }
  }

  // ============ 决策审计 ============

  /**
   * 记录决策审计
   */
  recordDecisionAudit(audit: Omit<DecisionAudit, 'decisionId' | 'timestamp'>): string {
    const decisionId = `decision_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const fullAudit: DecisionAudit = {
      ...audit,
      decisionId,
      timestamp: Date.now(),
    };

    this.decisionAudits.set(decisionId, fullAudit);

    // 关联到当前跨度
    const currentContext = this.getCurrentContext();
    if (currentContext) {
      const span = this.activeSpans.get(currentContext.spanId);
      if (span) {
        span.attributes['decision.id'] = decisionId;
        span.attributes['decision.confidence'] = audit.confidence;
      }
    }

    return decisionId;
  }

  /**
   * 获取决策审计
   */
  getDecisionAudit(decisionId: string): DecisionAudit | undefined {
    return this.decisionAudits.get(decisionId);
  }

  // ============ 异常检测 ============

  /**
   * 检测异常
   */
  private detectAnomalies(trace: Trace): void {
    const metrics = this.calculateTraceMetrics(trace);

    // 检测性能异常
    for (const [layer, duration] of Object.entries(metrics.layerDurations)) {
      const threshold = this.config.performanceThresholds[layer];
      if (threshold && duration > threshold * 2) {
        this.anomalies.push({
          id: `anomaly_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          traceId: trace.traceId,
          type: AnomalyType.PERFORMANCE,
          severity: duration > threshold * 5 ? AnomalySeverity.CRITICAL : AnomalySeverity.HIGH,
          description: `${layer} 层执行时间异常: ${duration}ms (阈值: ${threshold}ms)`,
          detectedAt: Date.now(),
          metrics: { duration, threshold },
          baseline: { duration: threshold },
          suggestions: [
            '检查是否有阻塞操作',
            '考虑增加缓存',
            '优化算法复杂度',
          ],
        });
      }
    }

    // 检测错误率异常
    if (metrics.errorRate > 0.1) {
      this.anomalies.push({
        id: `anomaly_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        traceId: trace.traceId,
        type: AnomalyType.BEHAVIOR,
        severity: AnomalySeverity.HIGH,
        description: `错误率异常: ${(metrics.errorRate * 100).toFixed(1)}%`,
        detectedAt: Date.now(),
        metrics: { errorRate: metrics.errorRate },
        baseline: { errorRate: 0 },
        suggestions: [
          '检查错误日志',
          '验证输入数据',
          '检查依赖服务状态',
        ],
      });
    }
  }

  /**
   * 获取异常列表
   */
  getAnomalies(traceId?: string): Anomaly[] {
    if (traceId) {
      return this.anomalies.filter(a => a.traceId === traceId);
    }
    return this.anomalies;
  }

  // ============ 性能分析 ============

  /**
   * 计算追踪性能指标
   */
  calculateTraceMetrics(trace: Trace): TraceMetrics {
    const spans = Array.from(trace.spans.values());
    
    // 计算各层级耗时
    const layerDurations: Record<Layer, number> = {
      [Layer.L0]: 0,
      [Layer.L1]: 0,
      [Layer.L2]: 0,
      [Layer.L3]: 0,
      [Layer.L4]: 0,
      [Layer.L5]: 0,
      [Layer.L6]: 0,
    };

    for (const span of spans) {
      if (span.endTime) {
        layerDurations[span.layer] += span.endTime - span.startTime;
      }
    }

    // 计算总执行时间
    const totalDuration = trace.completedAt && trace.createdAt
      ? trace.completedAt - trace.createdAt
      : 0;

    // 计算关键路径
    const criticalPath = this.findCriticalPath(trace);

    // 计算 Token 使用
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    for (const span of spans) {
      const tokenUsage = span.attributes['tokenUsage'] as { input: number; output: number } | undefined;
      if (tokenUsage) {
        totalInputTokens += tokenUsage.input;
        totalOutputTokens += tokenUsage.output;
      }
    }

    // 计算错误率
    const failedSpans = spans.filter(s => s.status === SpanStatus.FAILED).length;
    const errorRate = spans.length > 0 ? failedSpans / spans.length : 0;

    return {
      traceId: trace.traceId,
      totalDuration,
      layerDurations,
      criticalPath,
      parallelism: this.calculateParallelism(trace),
      waitTime: 0, // 简化
      executionTime: totalDuration,
      totalTokenUsage: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
      },
      errorRate,
      retryCount: spans.filter(s => s.tags['retry'] === true).length,
    };
  }

  /**
   * 查找关键路径
   */
  private findCriticalPath(trace: Trace): string[] {
    const spans = Array.from(trace.spans.values());
    const rootSpan = spans.find(s => s.spanId === trace.rootSpanId);
    if (!rootSpan) return [];

    const path: string[] = [];
    let current = rootSpan;

    while (current) {
      path.push(current.operationName);
      
      // 找到最耗时的子跨度
      const children = spans.filter(s => s.parentSpanId === current.spanId);
      if (children.length === 0) break;

      const longestChild = children.reduce((max, child) => {
        const maxDuration = max.endTime && max.startTime ? max.endTime - max.startTime : 0;
        const childDuration = child.endTime && child.startTime ? child.endTime - child.startTime : 0;
        return childDuration > maxDuration ? child : max;
      });

      current = longestChild;
    }

    return path;
  }

  /**
   * 计算并行度
   */
  private calculateParallelism(trace: Trace): number {
    const spans = Array.from(trace.spans.values());
    if (spans.length === 0) return 0;

    // 简化：计算同时运行的跨度数的最大值
    const events: Array<{ time: number; delta: number }> = [];
    for (const span of spans) {
      events.push({ time: span.startTime, delta: 1 });
      if (span.endTime) {
        events.push({ time: span.endTime, delta: -1 });
      }
    }

    events.sort((a, b) => a.time - b.time);

    let maxParallelism = 0;
    let currentParallelism = 0;
    for (const event of events) {
      currentParallelism += event.delta;
      maxParallelism = Math.max(maxParallelism, currentParallelism);
    }

    return maxParallelism;
  }

  // ============ 查询 ============

  /**
   * 查询追踪
   */
  queryTraces(query: TraceQuery): TraceQueryResult {
    const startTime = Date.now();
    let traces = Array.from(this.completedTraces.values());

    // 应用过滤条件
    if (query.traceId) {
      traces = traces.filter(t => t.traceId === query.traceId);
    }

    if (query.operationName) {
      const regex = new RegExp('^' + query.operationName.replace(/\*/g, '.*') + '$');
      traces = traces.filter(t => regex.test(t.name));
    }

    if (query.status) {
      traces = traces.filter(t => t.status === query.status);
    }

    if (query.timeRange) {
      traces = traces.filter(t => 
        t.createdAt >= query.timeRange!.start &&
        t.createdAt <= query.timeRange!.end
      );
    }

    // 分页
    const total = traces.length;
    if (query.pagination) {
      const { offset, limit } = query.pagination;
      traces = traces.slice(offset, offset + limit);
    }

    return {
      traces,
      total,
      latency: Date.now() - startTime,
    };
  }

  // ============ 持久化 ============

  /**
   * 持久化追踪
   */
  private async persistTrace(trace: Trace): Promise<void> {
    if (!this.config.persistencePath) return;

    const tracePath = path.join(
      this.config.persistencePath,
      `${trace.traceId}.json`
    );

    // 将 Map 转换为数组以便序列化
    const serializableTrace = {
      ...trace,
      spans: Array.from(trace.spans.entries()),
    };

    await fs.promises.writeFile(
      tracePath,
      JSON.stringify(serializableTrace, null, 2),
      'utf-8'
    );
  }

  /**
   * 加载持久化的追踪
   */
  private async loadPersistedTraces(): Promise<void> {
    if (!this.config.persistencePath) return;

    try {
      const files = await fs.promises.readdir(this.config.persistencePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.promises.readFile(
            path.join(this.config.persistencePath, file),
            'utf-8'
          );
          const serializableTrace = JSON.parse(content);
          
          // 将数组转换回 Map
          const trace: Trace = {
            ...serializableTrace,
            spans: new Map(serializableTrace.spans),
          };

          this.completedTraces.set(trace.traceId, trace);
        }
      }
    } catch (error) {
      // 目录不存在，忽略
    }
  }

  // ============ 工具方法 ============

  /**
   * 生成追踪 ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 生成跨度 ID
   */
  private generateSpanId(): string {
    return `span_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    activeTraces: number;
    completedTraces: number;
    activeSpans: number;
    decisionAudits: number;
    anomalies: number;
  } {
    return {
      activeTraces: this.activeTraces.size,
      completedTraces: this.completedTraces.size,
      activeSpans: this.activeSpans.size,
      decisionAudits: this.decisionAudits.size,
      anomalies: this.anomalies.length,
    };
  }

  /**
   * 关闭收集器
   */
  async close(): Promise<void> {
    // 持久化所有活跃追踪
    for (const trace of this.activeTraces.values()) {
      await this.persistTrace(trace);
    }
  }
}
