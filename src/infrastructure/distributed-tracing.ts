/**
 * 分布式追踪集成
 * 
 * 功能：
 * 1. Jaeger/Zipkin 格式导出
 * 2. 调用链可视化
 * 3. 性能瓶颈定位
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'ok' | 'error';
  tags: Record<string, string | number | boolean>;
  logs: Array<{ timestamp: number; event: string; data?: any }>;
  component: string;
}

export interface Trace {
  traceId: string;
  rootSpanId: string;
  spans: Span[];
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'ok' | 'error' | 'partial';
}

export interface TraceExportOptions {
  format: 'json' | 'jaeger' | 'zipkin';
  outputDir?: string;
}

export interface PerformanceBottleneck {
  operation: string;
  avgDuration: number;
  callCount: number;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
}

// ============ 分布式追踪器 ============

export class DistributedTracing {
  private logger: StructuredLogger;
  private traces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private maxTraces: number = 1000;
  private outputDir: string;
  
  constructor(logger: StructuredLogger, outputDir: string = './traces') {
    this.logger = logger;
    this.outputDir = outputDir;
    this.ensureDir(outputDir);
  }
  
  /**
   * 开始新的追踪
   */
  startTrace(operationName: string, tags?: Record<string, unknown>): Span {
    const traceId = this.generateId(16);
    const spanId = this.generateId(8);
    
    const span: Span = {
      traceId,
      spanId,
      operationName,
      startTime: Date.now(),
      status: 'ok',
      tags: tags || {},
      logs: [],
      component: 'yuanling',
    };
    
    // 创建追踪记录
    const trace: Trace = {
      traceId,
      rootSpanId: spanId,
      spans: [span],
      startTime: span.startTime,
      status: 'ok',
    };
    
    this.traces.set(traceId, trace);
    this.activeSpans.set(spanId, span);
    
    this.logger.debug('DistributedTracing', `开始追踪: ${operationName} (${traceId})`);
    
    return span;
  }
  
  /**
   * 开始子 Span
   */
  startSpan(
    operationName: string,
    parentSpan: Span,
    tags?: Record<string, unknown>
  ): Span {
    const spanId = this.generateId(8);
    
    const span: Span = {
      traceId: parentSpan.traceId,
      spanId,
      parentSpanId: parentSpan.spanId,
      operationName,
      startTime: Date.now(),
      status: 'ok',
      tags: tags || {},
      logs: [],
      component: 'yuanling',
    };
    
    // 添加到追踪
    const trace = this.traces.get(parentSpan.traceId);
    if (trace) {
      trace.spans.push(span);
    }
    
    this.activeSpans.set(spanId, span);
    
    return span;
  }
  
  /**
   * 结束 Span
   */
  endSpan(span: Span, error?: Error): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    if (error) {
      span.status = 'error';
      span.logs.push({
        timestamp: span.endTime,
        event: 'error',
        data: {
          message: error.message,
          stack: error.stack,
        },
      });
    }
    
    this.activeSpans.delete(span.spanId);
    
    // 如果是根 Span，完成追踪
    if (!span.parentSpanId) {
      this.completeTrace(span);
    }
    
    this.logger.debug('DistributedTracing', 
      `结束 Span: ${span.operationName} (${span.duration}ms)`
    );
  }
  
  /**
   * 添加 Span 日志
   */
  logEvent(span: Span, event: string, data?: any): void {
    span.logs.push({
      timestamp: Date.now(),
      event,
      data,
    });
  }
  
  /**
   * 添加 Span 标签
   */
  setTag(span: Span, key: string, value: string | number | boolean): void {
    span.tags[key] = value;
  }
  
  /**
   * 完成追踪
   */
  private completeTrace(rootSpan: Span): void {
    const trace = this.traces.get(rootSpan.traceId);
    if (!trace) return;
    
    trace.endTime = rootSpan.endTime;
    trace.duration = rootSpan.duration;
    trace.status = rootSpan.status;
    
    // 限制历史记录
    if (this.traces.size > this.maxTraces) {
      const oldestKey = this.traces.keys().next().value;
      if (oldestKey) {
        this.traces.delete(oldestKey);
      }
    }
  }
  
  /**
   * 导出追踪数据
   */
  export(options: TraceExportOptions): string {
    const { format, outputDir = this.outputDir } = options;
    
    let content: string;
    let filename: string;
    
    switch (format) {
      case 'jaeger':
        content = this.exportJaeger();
        filename = `traces-jaeger-${Date.now()}.json`;
        break;
      case 'zipkin':
        content = this.exportZipkin();
        filename = `traces-zipkin-${Date.now()}.json`;
        break;
      default:
        content = this.exportJson();
        filename = `traces-${Date.now()}.json`;
    }
    
    const filePath = path.join(outputDir, filename);
    this.ensureDir(outputDir);
    fs.writeFileSync(filePath, content);
    
    this.logger.info('DistributedTracing', `导出追踪: ${filePath}`);
    
    return filePath;
  }
  
  /**
   * 导出 JSON 格式
   */
  private exportJson(): string {
    return JSON.stringify({
      traces: Array.from(this.traces.values()),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
  
  /**
   * 导出 Jaeger 格式
   */
  private exportJaeger(): string {
    const jaegerTraces = Array.from(this.traces.values()).flatMap(trace =>
      trace.spans.map(span => ({
        traceID: span.traceId,
        spanID: span.spanId,
        parentSpanID: span.parentSpanId,
        operationName: span.operationName,
        startTime: span.startTime * 1000, // 微秒
        duration: (span.duration || 0) * 1000,
        tags: Object.entries(span.tags).map(([key, value]) => ({
          key,
          value,
          type: typeof value === 'number' ? 'int64' : 'string',
        })),
        logs: span.logs.map(log => ({
          timestamp: log.timestamp * 1000,
          fields: [{ key: 'event', value: log.event }],
        })),
        process: {
          serviceName: span.component,
          tags: [],
        },
      }))
    );
    
    return JSON.stringify({ data: jaegerTraces }, null, 2);
  }
  
  /**
   * 导出 Zipkin 格式
   */
  private exportZipkin(): string {
    const zipkinSpans = Array.from(this.traces.values()).flatMap(trace =>
      trace.spans.map(span => ({
        traceId: span.traceId,
        id: span.spanId,
        parentId: span.parentSpanId,
        name: span.operationName,
        timestamp: span.startTime * 1000,
        duration: (span.duration || 0) * 1000,
        localEndpoint: {
          serviceName: span.component,
        },
        tags: Object.fromEntries(
          Object.entries(span.tags).map(([k, v]) => [k, String(v)])
        ),
        annotations: span.logs.map(log => ({
          timestamp: log.timestamp * 1000,
          value: log.event,
        })),
      }))
    );
    
    return JSON.stringify(zipkinSpans, null, 2);
  }
  
  /**
   * 分析性能瓶颈
   */
  analyzeBottlenecks(): PerformanceBottleneck[] {
    const operationStats = new Map<string, { durations: number[]; count: number }>();
    
    // 收集所有操作的耗时
    for (const trace of this.traces.values()) {
      for (const span of trace.spans) {
        if (span.duration !== undefined) {
          const stats = operationStats.get(span.operationName) || { durations: [], count: 0 };
          stats.durations.push(span.duration);
          stats.count++;
          operationStats.set(span.operationName, stats);
        }
      }
    }
    
    // 分析瓶颈
    const bottlenecks: PerformanceBottleneck[] = [];
    
    for (const [operation, stats] of operationStats) {
      const avgDuration = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length;
      
      // 判断影响程度
      let impact: 'high' | 'medium' | 'low';
      let suggestion: string;
      
      if (avgDuration > 1000) {
        impact = 'high';
        suggestion = '考虑优化此操作或使用缓存';
      } else if (avgDuration > 500) {
        impact = 'medium';
        suggestion = '可以进一步优化性能';
      } else {
        impact = 'low';
        suggestion = '性能良好';
      }
      
      bottlenecks.push({
        operation,
        avgDuration: Math.round(avgDuration),
        callCount: stats.count,
        impact,
        suggestion,
      });
    }
    
    // 按影响程度排序
    return bottlenecks.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }
  
  /**
   * 生成追踪报告
   */
  generateReport(): string {
    const bottlenecks = this.analyzeBottlenecks();
    const lines: string[] = [];
    
    lines.push('# 分布式追踪报告');
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push(`追踪总数: ${this.traces.size}`);
    lines.push('');
    
    // 性能瓶颈
    lines.push('## 性能瓶颈分析');
    lines.push('');
    lines.push('| 操作 | 平均耗时 | 调用次数 | 影响 | 建议 |');
    lines.push('|------|----------|----------|------|------|');
    
    for (const b of bottlenecks.slice(0, 10)) {
      lines.push(`| ${b.operation} | ${b.avgDuration}ms | ${b.callCount} | ${b.impact} | ${b.suggestion} |`);
    }
    
    lines.push('');
    
    // 最近追踪
    lines.push('## 最近追踪');
    lines.push('');
    
    const recentTraces = Array.from(this.traces.values()).slice(-5);
    for (const trace of recentTraces) {
      const rootSpan = trace.spans.find(s => s.spanId === trace.rootSpanId);
      lines.push(`### ${rootSpan?.operationName || 'unknown'}`);
      lines.push(`- Trace ID: ${trace.traceId}`);
      lines.push(`- 持续时间: ${trace.duration || 0}ms`);
      lines.push(`- 状态: ${trace.status}`);
      lines.push(`- Span 数: ${trace.spans.length}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * 清空追踪数据
   */
  clear(): void {
    this.traces.clear();
    this.activeSpans.clear();
  }
  
  // ============ 辅助方法 ============
  
  private generateId(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
