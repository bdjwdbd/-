/**
 * 分布式追踪系统
 * 
 * 功能：
 * 1. 全链路请求追踪
 * 2. 跨组件调用链可视化
 * 3. 性能瓶颈定位
 * 4. 错误传播分析
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage: Record<string, string>;
}

interface Span {
  context: SpanContext;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "ok" | "error";
  tags: Record<string, string | number | boolean>;
  logs: Array<{ timestamp: number; event: string; data?: any }>;
  component: string;
  kind: "client" | "server" | "producer" | "consumer";
}

interface Trace {
  traceId: string;
  rootSpanId: string;
  spans: Span[];
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "ok" | "error" | "partial";
  metadata: Record<string, unknown>;
}

interface TracingConfig {
  serviceName: string;
  samplingRate: number;        // 0-1
  maxSpansPerTrace: number;
  traceDir: string;
  exportFormat: "json" | "jaeger" | "zipkin";
  enableLogging: boolean;
}

interface TraceStats {
  totalTraces: number;
  totalSpans: number;
  avgDuration: number;
  errorRate: number;
  slowestOperations: Array<{ operation: string; avgDuration: number }>;
  mostFrequentOperations: Array<{ operation: string; count: number }>;
}

// ============================================================
// Span 上下文管理
// ============================================================

class SpanContextManager {
  private currentContext: SpanContext | null = null;
  private contextStack: SpanContext[] = [];
  
  /**
   * 创建新的追踪上下文
   */
  createTraceContext(): SpanContext {
    return {
      traceId: this.generateId(16),
      spanId: this.generateId(8),
      baggage: {},
    };
  }
  
  /**
   * 创建子 Span 上下文
   */
  createChildContext(parent: SpanContext): SpanContext {
    return {
      traceId: parent.traceId,
      spanId: this.generateId(8),
      parentSpanId: parent.spanId,
      baggage: { ...parent.baggage },
    };
  }
  
  /**
   * 设置当前上下文
   */
  setCurrent(context: SpanContext): void {
    if (this.currentContext) {
      this.contextStack.push(this.currentContext);
    }
    this.currentContext = context;
  }
  
  /**
   * 获取当前上下文
   */
  getCurrent(): SpanContext | null {
    return this.currentContext;
  }
  
  /**
   * 恢复上一个上下文
   */
  restore(): SpanContext | null {
    if (this.contextStack.length > 0) {
      this.currentContext = this.contextStack.pop()!;
    } else {
      this.currentContext = null;
    }
    return this.currentContext;
  }
  
  /**
   * 设置 baggage
   */
  setBaggage(key: string, value: string): void {
    if (this.currentContext) {
      this.currentContext.baggage[key] = value;
    }
  }
  
  /**
   * 获取 baggage
   */
  getBaggage(key: string): string | undefined {
    return this.currentContext?.baggage[key];
  }
  
  private generateId(length: number): string {
    return crypto.randomBytes(length).toString("hex");
  }
}

// ============================================================
// 追踪器
// ============================================================

export class Tracer {
  private config: TracingConfig;
  private contextManager: SpanContextManager;
  private activeSpans: Map<string, Span> = new Map();
  private completedTraces: Trace[] = [];
  private maxTraces: number = 1000;
  
  constructor(config: Partial<TracingConfig>) {
    this.config = {
      serviceName: "unknown",
      samplingRate: 1.0,
      maxSpansPerTrace: 100,
      traceDir: "./traces",
      exportFormat: "json",
      enableLogging: true,
      ...config,
    };
    
    this.contextManager = new SpanContextManager();
    this.ensureDir(this.config.traceDir);
  }
  
  /**
   * 开始新的追踪
   */
  startTrace(operationName: string, options?: {
    component?: string;
    kind?: Span["kind"];
    tags?: Record<string, string | number | boolean>;
  }): Span {
    // 采样检查
    if (Math.random() > this.config.samplingRate) {
      // 返回一个 no-op span
      return this.createNoOpSpan();
    }
    
    const context = this.contextManager.createTraceContext();
    
    const span: Span = {
      context,
      operationName,
      startTime: Date.now(),
      status: "ok",
      tags: options?.tags || {},
      logs: [],
      component: options?.component || this.config.serviceName,
      kind: options?.kind || "server",
    };
    
    this.activeSpans.set(context.spanId, span);
    this.contextManager.setCurrent(context);
    
    this.log(`[Trace] 开始追踪: ${operationName} (${context.traceId})`);
    
    return span;
  }
  
  /**
   * 开始子 Span
   */
  startSpan(operationName: string, options?: {
    component?: string;
    kind?: Span["kind"];
    tags?: Record<string, string | number | boolean>;
  }): Span {
    const parentContext = this.contextManager.getCurrent();
    
    if (!parentContext) {
      return this.startTrace(operationName, options);
    }
    
    const context = this.contextManager.createChildContext(parentContext);
    
    const span: Span = {
      context,
      operationName,
      startTime: Date.now(),
      status: "ok",
      tags: options?.tags || {},
      logs: [],
      component: options?.component || this.config.serviceName,
      kind: options?.kind || "server",
    };
    
    this.activeSpans.set(context.spanId, span);
    this.contextManager.setCurrent(context);
    
    this.log(`[Trace] 开始 Span: ${operationName} (${context.spanId})`);
    
    return span;
  }
  
  /**
   * 结束 Span
   */
  endSpan(span: Span, error?: Error): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    if (error) {
      span.status = "error";
      span.logs.push({
        timestamp: span.endTime,
        event: "error",
        data: {
          message: error.message,
          stack: error.stack,
        },
      });
    }
    
    this.activeSpans.delete(span.context.spanId);
    this.contextManager.restore();
    
    this.log(`[Trace] 结束 Span: ${span.operationName} (${span.duration}ms)`);
    
    // 如果是根 Span，完成追踪
    if (!span.context.parentSpanId) {
      this.completeTrace(span);
    }
  }
  
  /**
   * 添加 Span 标签
   */
  setTag(span: Span, key: string, value: string | number | boolean): void {
    span.tags[key] = value;
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
   * 注入上下文到载体
   */
  inject(carrier: Record<string, string>): void {
    const context = this.contextManager.getCurrent();
    if (!context) return;
    
    carrier["x-trace-id"] = context.traceId;
    carrier["x-span-id"] = context.spanId;
    carrier["x-parent-span-id"] = context.parentSpanId || "";
    
    for (const [key, value] of Object.entries(context.baggage)) {
      carrier[`x-baggage-${key}`] = value;
    }
  }
  
  /**
   * 从载体提取上下文
   */
  extract(carrier: Record<string, string>): SpanContext | null {
    const traceId = carrier["x-trace-id"];
    const spanId = carrier["x-span-id"];
    
    if (!traceId || !spanId) return null;
    
    const context: SpanContext = {
      traceId,
      spanId,
      parentSpanId: carrier["x-parent-span-id"] || undefined,
      baggage: {},
    };
    
    for (const [key, value] of Object.entries(carrier)) {
      if (key.startsWith("x-baggage-")) {
        const baggageKey = key.substring(10);
        context.baggage[baggageKey] = value;
      }
    }
    
    return context;
  }
  
  /**
   * 获取统计信息
   */
  getStats(): TraceStats {
    const allSpans = this.completedTraces.flatMap(t => t.spans);
    
    // 计算平均持续时间
    const durations = this.completedTraces
      .filter(t => t.duration !== undefined)
      .map(t => t.duration!);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    
    // 计算错误率
    const errorCount = this.completedTraces.filter(t => t.status === "error").length;
    const errorRate = this.completedTraces.length > 0
      ? errorCount / this.completedTraces.length
      : 0;
    
    // 最慢的操作
    const operationDurations = new Map<string, number[]>();
    for (const span of allSpans) {
      if (span.duration !== undefined) {
        const durations = operationDurations.get(span.operationName) || [];
        durations.push(span.duration);
        operationDurations.set(span.operationName, durations);
      }
    }
    
    const slowestOperations = Array.from(operationDurations.entries())
      .map(([operation, durations]) => ({
        operation,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);
    
    // 最频繁的操作
    const operationCounts = new Map<string, number>();
    for (const span of allSpans) {
      operationCounts.set(span.operationName, (operationCounts.get(span.operationName) || 0) + 1);
    }
    
    const mostFrequentOperations = Array.from(operationCounts.entries())
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalTraces: this.completedTraces.length,
      totalSpans: allSpans.length,
      avgDuration,
      errorRate,
      slowestOperations,
      mostFrequentOperations,
    };
  }
  
  /**
   * 导出追踪数据
   */
  export(format?: "json" | "jaeger" | "zipkin"): string {
    const exportFormat = format || this.config.exportFormat;
    
    switch (exportFormat) {
      case "jaeger":
        return this.exportJaeger();
      case "zipkin":
        return this.exportZipkin();
      default:
        return this.exportJSON();
    }
  }
  
  /**
   * 保存追踪到文件
   */
  saveToFile(filename?: string): string {
    const filePath = path.join(
      this.config.traceDir,
      filename || `traces-${Date.now()}.json`
    );
    
    fs.writeFileSync(filePath, this.export("json"));
    
    this.log(`[Trace] 保存追踪: ${filePath}`);
    
    return filePath;
  }
  
  /**
   * 生成追踪可视化报告
   */
  generateReport(): string {
    const stats = this.getStats();
    const lines: string[] = [];
    
    lines.push("# 分布式追踪报告");
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push(`服务名称: ${this.config.serviceName}`);
    lines.push("");
    
    lines.push("## 统计概览");
    lines.push("");
    lines.push(`- 总追踪数: ${stats.totalTraces}`);
    lines.push(`- 总 Span 数: ${stats.totalSpans}`);
    lines.push(`- 平均持续时间: ${stats.avgDuration.toFixed(2)}ms`);
    lines.push(`- 错误率: ${(stats.errorRate * 100).toFixed(2)}%`);
    lines.push("");
    
    lines.push("## 最慢的操作");
    lines.push("");
    lines.push("| 操作 | 平均持续时间 |");
    lines.push("|------|-------------|");
    for (const op of stats.slowestOperations) {
      lines.push(`| ${op.operation} | ${op.avgDuration.toFixed(2)}ms |`);
    }
    lines.push("");
    
    lines.push("## 最频繁的操作");
    lines.push("");
    lines.push("| 操作 | 调用次数 |");
    lines.push("|------|---------|");
    for (const op of stats.mostFrequentOperations) {
      lines.push(`| ${op.operation} | ${op.count} |`);
    }
    lines.push("");
    
    // 最近的追踪
    lines.push("## 最近的追踪");
    lines.push("");
    
    const recentTraces = this.completedTraces.slice(-10);
    for (const trace of recentTraces) {
      const rootSpan = trace.spans.find(s => s.context.spanId === trace.rootSpanId);
      lines.push(`### ${rootSpan?.operationName || "unknown"}`);
      lines.push(`- Trace ID: ${trace.traceId}`);
      lines.push(`- 持续时间: ${trace.duration?.toFixed(2) || "N/A"}ms`);
      lines.push(`- 状态: ${trace.status}`);
      lines.push(`- Span 数: ${trace.spans.length}`);
      lines.push("");
    }
    
    return lines.join("\n");
  }
  
  /**
   * 清空追踪数据
   */
  clear(): void {
    this.activeSpans.clear();
    this.completedTraces = [];
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private createNoOpSpan(): Span {
    const context = this.contextManager.createTraceContext();
    return {
      context,
      operationName: "no-op",
      startTime: Date.now(),
      status: "ok",
      tags: { sampled: false },
      logs: [],
      component: this.config.serviceName,
      kind: "server",
    };
  }
  
  private completeTrace(rootSpan: Span): void {
    // 收集同一 traceId 的所有 span
    const spans = [rootSpan];
    
    // 从已完成的追踪中查找（如果有子 span）
    // 这里简化处理，实际应该维护一个 trace -> spans 的映射
    
    const trace: Trace = {
      traceId: rootSpan.context.traceId,
      rootSpanId: rootSpan.context.spanId,
      spans,
      startTime: rootSpan.startTime,
      endTime: rootSpan.endTime,
      duration: rootSpan.duration,
      status: rootSpan.status,
      metadata: {},
    };
    
    this.completedTraces.push(trace);
    
    // 限制历史记录
    if (this.completedTraces.length > this.maxTraces) {
      this.completedTraces.shift();
    }
    
    this.log(`[Trace] 完成追踪: ${rootSpan.operationName} (${rootSpan.duration}ms)`);
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  private log(message: string): void {
    if (this.config.enableLogging) {
      // console.log(message);
    }
  }
  
  private exportJSON(): string {
    return JSON.stringify({
      serviceName: this.config.serviceName,
      traces: this.completedTraces,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
  
  private exportJaeger(): string {
    // Jaeger 格式
    const jaegerTraces = this.completedTraces.flatMap(trace => 
      trace.spans.map(span => ({
        traceID: span.context.traceId,
        spanID: span.context.spanId,
        parentSpanID: span.context.parentSpanId,
        operationName: span.operationName,
        startTime: span.startTime * 1000, // 微秒
        duration: (span.duration || 0) * 1000,
        tags: Object.entries(span.tags).map(([key, value]) => ({
          key,
          value,
          type: typeof value === "number" ? "int64" : "string",
        })),
        logs: span.logs.map(log => ({
          timestamp: log.timestamp * 1000,
          fields: [{ key: "event", value: log.event }],
        })),
        process: {
          serviceName: span.component,
          tags: [],
        },
      }))
    );
    
    return JSON.stringify({ data: jaegerTraces }, null, 2);
  }
  
  private exportZipkin(): string {
    // Zipkin 格式
    const zipkinSpans = this.completedTraces.flatMap(trace =>
      trace.spans.map(span => ({
        traceId: span.context.traceId,
        id: span.context.spanId,
        parentId: span.context.parentSpanId,
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
}

// ============================================================
// 追踪中间件
// ============================================================

export class TracingMiddleware {
  private tracer: Tracer;
  
  constructor(tracer: Tracer) {
    this.tracer = tracer;
  }
  
  /**
   * 包装异步函数
   */
  wrapAsync<T>(
    operationName: string,
    fn: () => Promise<T>,
    options?: {
      component?: string;
      tags?: Record<string, string | number | boolean>;
    }
  ): Promise<T> {
    const span = this.tracer.startSpan(operationName, options);
    
    return fn()
      .then(result => {
        this.tracer.endSpan(span);
        return result;
      })
      .catch(error => {
        this.tracer.endSpan(span, error);
        throw error;
      });
  }
  
  /**
   * 包装同步函数
   */
  wrapSync<T>(
    operationName: string,
    fn: () => T,
    options?: {
      component?: string;
      tags?: Record<string, string | number | boolean>;
    }
  ): T {
    const span = this.tracer.startSpan(operationName, options);
    
    try {
      const result = fn();
      this.tracer.endSpan(span);
      return result;
    } catch (error) {
      this.tracer.endSpan(span, error as Error);
      throw error;
    }
  }
  
  /**
   * 创建追踪装饰器
   */
  traced(operationName?: string) {
    return (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) => {
      const original = descriptor.value;
      const name = operationName || `${target.constructor.name}.${propertyKey}`;
      const self = this;
      
      descriptor.value = async function (...args: any[]) {
        const span = self.tracer.startSpan(name);
        
        try {
          const result = await original.apply(this, args);
          self.tracer.endSpan(span);
          return result;
        } catch (error) {
          self.tracer.endSpan(span, error as Error);
          throw error;
        }
      };
      
      return descriptor;
    };
  }
}

// ============================================================
// 演示
// ============================================================

function demo() {
  // console.log("=".repeat(60));
  // console.log("分布式追踪系统演示");
  // console.log("=".repeat(60));
  
  const tracer = new Tracer({
    serviceName: "yuanling-system",
    samplingRate: 1.0,
    traceDir: "./experiment-results/traces",
    enableLogging: true,
  });
  
  const middleware = new TracingMiddleware(tracer);
  
  // 模拟请求处理
  // console.log("\n1. 模拟请求处理链");
  
  const rootSpan = tracer.startTrace("process_request", {
    component: "api-gateway",
    kind: "server",
    tags: { "http.method": "POST", "http.url": "/api/chat" },
  });
  
  // 子操作 1：验证
  const authSpan = tracer.startSpan("authenticate", {
    component: "auth-service",
    tags: { "user.id": "user-123" },
  });
  
  // 模拟延迟
  const start = Date.now();
  while (Date.now() - start < 10) {}
  
  tracer.endSpan(authSpan);
  
  // 子操作 2：调用 LLM
  const llmSpan = tracer.startSpan("call_llm", {
    component: "llm-client",
    tags: { "model": "gpt-4", "tokens": 1500 },
  });
  
  tracer.logEvent(llmSpan, "request_sent", { prompt: "Hello" });
  
  // 模拟延迟
  const start2 = Date.now();
  while (Date.now() - start2 < 50) {}
  
  tracer.logEvent(llmSpan, "response_received", { tokens: 200 });
  tracer.endSpan(llmSpan);
  
  // 子操作 3：存储
  const dbSpan = tracer.startSpan("save_to_db", {
    component: "database",
    tags: { "table": "conversations" },
  });
  
  // 模拟延迟
  const start3 = Date.now();
  while (Date.now() - start3 < 20) {}
  
  tracer.endSpan(dbSpan);
  
  // 结束根 Span
  tracer.endSpan(rootSpan);
  
  // 使用中间件
  // console.log("\n2. 使用中间件包装函数");
  
  async function simulateLLMCall(): Promise<string> {
    await new Promise(r => setTimeout(r, 30));
    return "LLM response";
  }
  
  middleware.wrapAsync("llm_call", simulateLLMCall, {
    component: "llm-service",
    tags: { model: "claude-3" },
  }).then(result => {
    // console.log(`   结果: ${result}`);
    
    // 生成报告
    // console.log("\n3. 追踪统计");
    
    const stats = tracer.getStats();
    // console.log(`   总追踪数: ${stats.totalTraces}`);
    // console.log(`   总 Span 数: ${stats.totalSpans}`);
    // console.log(`   平均持续时间: ${stats.avgDuration.toFixed(2)}ms`);
    // console.log(`   错误率: ${(stats.errorRate * 100).toFixed(1)}%`);
    
    // 生成报告
    // console.log("\n4. 生成报告");
    
    const report = tracer.generateReport();
    const reportPath = "./experiment-results/traces/tracing-report.md";
    fs.writeFileSync(reportPath, report);
    // console.log(`   报告已保存: ${reportPath}`);
    
    // 导出追踪
    // console.log("\n5. 导出追踪数据");
    
    const jsonPath = tracer.saveToFile();
    // console.log(`   JSON: ${jsonPath}`);
    
    // console.log("\n" + "=".repeat(60));
  });
}

if (require.main === module) {
  demo();
}
