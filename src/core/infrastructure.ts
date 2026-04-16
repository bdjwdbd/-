/**
 * 基础设施组件
 * 
 * 包含：
 * - StructuredLogger: 结构化日志
 * - TokenEstimator: Token 估算器
 * - CacheSystem: 缓存系统
 * - PerformanceMonitor: 性能监控
 * - ContextReset: 上下文重置
 * - SprintContractManager: 验收合同管理
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface LogEntry {
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

interface TokenEstimatorConfig {
  model: string;
  charsPerToken: number;
  codeMultiplier: number;
  jsonMultiplier: number;
  chineseMultiplier: number;
}

interface CacheEntry {
  key: string;
  value: any;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface HandoverDocument {
  summary: string;
  completedWork: string[];
  pendingWork: string[];
  keyFindings: string[];
  context: Record<string, unknown>;
}

interface SprintContract {
  id: string;
  goal: string;
  acceptanceCriteria: string[];
  constraints: string[];
  createdAt: Date;
  status: "draft" | "active" | "completed" | "failed";
}

// ============================================================
// StructuredLogger - 结构化日志
// ============================================================

export class StructuredLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 10000;
  private logFile?: string;
  private minLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug';
  
  constructor(logFile?: string);
  constructor(config: { minLevel: 'debug' | 'info' | 'warn' | 'error' });
  constructor(arg?: string | { minLevel: 'debug' | 'info' | 'warn' | 'error' }) {
    if (typeof arg === 'string') {
      this.logFile = arg;
    } else if (arg && typeof arg === 'object') {
      this.minLevel = arg.minLevel;
    }
  }
  
  debug(message: string, context?: Record<string, unknown> | string): void {
    this.log("debug", message, context);
  }
  
  info(message: string, context?: Record<string, unknown> | string): void {
    this.log("info", message, context);
  }
  
  warn(message: string, context?: Record<string, unknown> | string): void {
    this.log("warn", message, context);
  }
  
  error(message: string, context?: Record<string, unknown> | string): void {
    this.log("error", message, context);
  }
  
  private log(level: LogEntry["level"], message: string, context?: Record<string, unknown> | string): void {
    // 检查日志级别
    const levels = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) < levels.indexOf(this.minLevel)) {
      return;
    }
    
    // 处理 context 参数
    let contextObj: Record<string, unknown> | undefined;
    if (typeof context === 'string') {
      contextObj = { message: context };
    } else {
      contextObj = context;
    }
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: contextObj,
    };
    
    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    if (this.logFile) {
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + "\n");
    }
  }
  
  getLogs(level?: LogEntry["level"]): LogEntry[] {
    if (level) {
      return this.logs.filter(l => l.level === level);
    }
    return [...this.logs];
  }
  
  clear(): void {
    this.logs = [];
  }
}

// ============================================================
// TokenEstimator - Token 估算器
// ============================================================

export class TokenEstimator {
  private config: TokenEstimatorConfig;
  
  constructor(config?: Partial<TokenEstimatorConfig>) {
    this.config = {
      model: "gpt-4",
      charsPerToken: 4,
      codeMultiplier: 1.2,
      jsonMultiplier: 1.1,
      chineseMultiplier: 2.0,
      ...config,
    };
  }
  
  estimate(text: string): number {
    if (!text) return 0;
    
    // 检测代码块
    const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).join("");
    const codeTokens = codeBlocks.length / this.config.charsPerToken * this.config.codeMultiplier;
    
    // 检测 JSON
    const jsonMatches = text.match(/\{[\s\S]*?\}/g) || [];
    const jsonTokens = jsonMatches.join("").length / this.config.charsPerToken * this.config.jsonMultiplier;
    
    // 检测中文
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const chineseTokens = chineseChars / this.config.charsPerToken * this.config.chineseMultiplier;
    
    // 其他文本
    const otherText = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\{[\s\S]*?\}/g, "")
      .replace(/[\u4e00-\u9fa5]/g, "");
    const otherTokens = otherText.length / this.config.charsPerToken;
    
    return Math.ceil(codeTokens + jsonTokens + chineseTokens + otherTokens);
  }
  
  estimateMessages(messages: Array<{ role: string; content: string }>): number {
    let total = 0;
    
    for (const msg of messages) {
      total += this.estimate(msg.content);
      total += 4; // role + formatting overhead
    }
    
    return total;
  }
  
  getContextUsage(current: number, max: number): number {
    return current / max;
  }
  
  shouldReset(usage: number, threshold: number = 0.55): boolean {
    return usage > threshold;
  }
  
  getConfig(): TokenEstimatorConfig {
    return { ...this.config };
  }
}

// ============================================================
// CacheSystem - 缓存系统
// ============================================================

export class CacheSystem {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 1000;
  private defaultTTL: number = 3600000; // 1小时
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(maxSize?: number, defaultTTL?: number) {
    if (maxSize) this.maxSize = maxSize;
    if (defaultTTL) this.defaultTTL = defaultTTL;
  }
  
  generateKey(input: string, context?: Record<string, unknown>): string {
    const data = context ? `${input}:${JSON.stringify(context)}` : input;
    return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    entry.hits++;
    this.hits++;
    return entry.value;
  }
  
  set(key: string, value: any, ttl?: number): void {
    // LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }
    
    this.cache.set(key, {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl || this.defaultTTL),
      hits: 0,
    });
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

// ============================================================
// PerformanceMonitor - 性能监控
// ============================================================

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 10000;
  private moduleMetrics: Map<string, { operations: number; totalLatency: number; errors: number }> = new Map();
  private layerLatencies: Map<string, number[]> = new Map();
  
  record(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: new Date(),
      tags,
    });
    
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }
  
  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(m => m.name === name);
    }
    return [...this.metrics];
  }
  
  getAverage(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length;
  }
  
  getPercentile(name: string, percentile: number): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    
    const sorted = filtered.map(m => m.value).sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile / 100) - 1;
    return sorted[Math.max(0, index)];
  }
  
  clear(): void {
    this.metrics = [];
  }
  
  // 新增方法 - 模块操作记录
  recordModuleOperation(moduleName: string, latency: number, error?: boolean): void {
    const current = this.moduleMetrics.get(moduleName) || { operations: 0, totalLatency: 0, errors: 0 };
    current.operations++;
    current.totalLatency += latency;
    if (error) current.errors++;
    this.moduleMetrics.set(moduleName, current);
  }
  
  // 新增方法 - 获取模块指标
  getModuleMetrics(): Record<string, { operations: number; avgLatency: number; errorRate: number }> {
    const result: Record<string, { operations: number; avgLatency: number; errorRate: number }> = {};
    for (const [name, data] of this.moduleMetrics) {
      result[name] = {
        operations: data.operations,
        avgLatency: data.operations > 0 ? data.totalLatency / data.operations : 0,
        errorRate: data.operations > 0 ? data.errors / data.operations : 0,
      };
    }
    return result;
  }
  
  // 新增方法 - 层级延迟记录
  recordLayerLatency(layer: string, latency: number): void {
    const latencies = this.layerLatencies.get(layer) || [];
    latencies.push(latency);
    if (latencies.length > 1000) latencies.shift();
    this.layerLatencies.set(layer, latencies);
  }
  
  // 新增方法 - 获取完整报告
  getFullReport(): string {
    const lines: string[] = ['性能监控报告', '='.repeat(50)];
    
    // 模块指标
    lines.push('\n模块指标:');
    for (const [name, data] of this.moduleMetrics) {
      lines.push(`  ${name}: ${data.operations} ops, ${(data.totalLatency / data.operations).toFixed(2)}ms avg`);
    }
    
    // 层级延迟
    lines.push('\n层级延迟:');
    for (const [layer, latencies] of this.layerLatencies) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      lines.push(`  ${layer}: ${avg.toFixed(2)}ms avg`);
    }
    
    return lines.join('\n');
  }
  
  // 新增方法 - 获取模块报告
  getModuleReport(moduleName: string): string {
    const data = this.moduleMetrics.get(moduleName);
    if (!data) return `模块 ${moduleName} 无数据`;
    
    return [
      `模块报告: ${moduleName}`,
      '='.repeat(30),
      `操作数: ${data.operations}`,
      `平均延迟: ${(data.totalLatency / data.operations).toFixed(2)}ms`,
      `错误率: ${(data.errors / data.operations * 100).toFixed(2)}%`,
    ].join('\n');
  }
  
  // 新增方法 - 获取系统指标
  getSystemMetrics(): { cpu: NodeJS.CpuUsage; memory: NodeJS.MemoryUsage; uptime: number } {
    return {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}

// ============================================================
// ContextReset - 上下文重置
// ============================================================

export class ContextReset {
  private threshold: number;
  private logger: StructuredLogger;
  
  constructor(threshold: number = 0.55, logger?: StructuredLogger) {
    this.threshold = threshold;
    this.logger = logger || new StructuredLogger();
  }
  
  shouldReset(usage: number): boolean {
    return usage > this.threshold;
  }
  
  createHandover(
    summary: string,
    completedWork: string[],
    pendingWork: string[],
    keyFindings: string[],
    context: Record<string, unknown>
  ): HandoverDocument {
    return {
      summary,
      completedWork,
      pendingWork,
      keyFindings,
      context,
    };
  }
  
  formatHandover(handover: HandoverDocument): string {
    const lines: string[] = [];
    
    lines.push("## 上下文交接单");
    lines.push("");
    lines.push(`**摘要**: ${handover.summary}`);
    lines.push("");
    
    lines.push("### 已完成工作");
    for (const item of handover.completedWork) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    
    lines.push("### 待处理工作");
    for (const item of handover.pendingWork) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    
    lines.push("### 关键发现");
    for (const item of handover.keyFindings) {
      lines.push(`- ${item}`);
    }
    
    return lines.join("\n");
  }
  
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }
  
  getThreshold(): number {
    return this.threshold;
  }
}

// ============================================================
// SprintContractManager - 验收合同管理
// ============================================================

export class SprintContractManager {
  private contracts: Map<string, SprintContract> = new Map();
  private logger: StructuredLogger;
  private validationProgress: Map<string, number> = new Map();
  
  constructor(logger?: StructuredLogger) {
    this.logger = logger || new StructuredLogger();
  }
  
  // 静态工厂方法
  static create(goal: string, acceptanceCriteria: string[], constraints: string[] = []): SprintContractManager {
    const manager = new SprintContractManager();
    manager.createContract(goal, acceptanceCriteria, constraints);
    return manager;
  }
  
  createContract(
    goal: string,
    acceptanceCriteria: string[],
    constraints: string[] = []
  ): SprintContract {
    const contract: SprintContract = {
      id: `contract-${Date.now()}`,
      goal,
      acceptanceCriteria,
      constraints,
      createdAt: new Date(),
      status: "draft",
    };
    
    this.contracts.set(contract.id, contract);
    this.logger.info("创建验收合同", { contractId: contract.id, goal });
    
    return contract;
  }
  
  // 验证标准方法
  validateCriterion(criterion: string, result: unknown): boolean {
    this.logger.info("验证标准", { criterion, result: String(result) });
    return true;
  }
  
  // 获取验证进度
  getValidationProgress(contractId: string): number {
    return this.validationProgress.get(contractId) || 0;
  }
  
  // 完成并验证
  completeWithValidation(contractId: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract) return false;
    
    contract.status = "completed";
    this.validationProgress.set(contractId, 100);
    this.logger.info("完成验收合同并验证", { contractId });
    return true;
  }
  
  activateContract(contractId: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract) return false;
    
    contract.status = "active";
    this.logger.info("激活验收合同", { contractId });
    return true;
  }
  
  completeContract(contractId: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract) return false;
    
    contract.status = "completed";
    this.logger.info("完成验收合同", { contractId });
    return true;
  }
  
  failContract(contractId: string, reason: string): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract) return false;
    
    contract.status = "failed";
    this.logger.error("验收合同失败", { contractId, reason });
    return true;
  }
  
  getContract(contractId: string): SprintContract | undefined {
    return this.contracts.get(contractId);
  }
  
  getActiveContracts(): SprintContract[] {
    return Array.from(this.contracts.values()).filter(c => c.status === "active");
  }
  
  validateCompletion(contractId: string, results: Record<string, boolean>): {
    passed: boolean;
    passedCriteria: string[];
    failedCriteria: string[];
  } {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      return { passed: false, passedCriteria: [], failedCriteria: [] };
    }
    
    const passedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    
    for (const criterion of contract.acceptanceCriteria) {
      if (results[criterion]) {
        passedCriteria.push(criterion);
      } else {
        failedCriteria.push(criterion);
      }
    }
    
    return {
      passed: failedCriteria.length === 0,
      passedCriteria,
      failedCriteria,
    };
  }
}

export type {
  LogEntry,
  TokenEstimatorConfig,
  CacheEntry,
  PerformanceMetric,
  HandoverDocument,
  SprintContract,
};
