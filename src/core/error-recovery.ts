/**
 * 错误恢复管理器
 * 
 * 功能：
 * - 错误捕获与分类
 * - 自动重试策略
 * - 降级方案
 * - 错误学习
 */

import { FeedbackCenter } from "./feedback";
import { StructuredLogger } from "./infrastructure";

// ============================================================
// 类型定义
// ============================================================

type ErrorSeverity = "low" | "medium" | "high" | "critical";
type ErrorCategory = 
  | "network" 
  | "timeout" 
  | "resource" 
  | "validation" 
  | "permission" 
  | "unknown";
type RecoveryStrategy = "retry" | "fallback" | "skip" | "abort";

interface ErrorContext {
  id: string;
  error: Error;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  recovered: boolean;
  recoveryStrategy?: RecoveryStrategy;
}

interface RetryPolicy {
  maxRetries: number;
  baseDelay: number;    // ms
  maxDelay: number;     // ms
  backoffMultiplier: number;
  retryableErrors: ErrorCategory[];
}

interface FallbackHandler {
  name: string;
  condition: (error: Error, context: ErrorContext) => boolean;
  handler: (error: Error, context: ErrorContext) => Promise<any>;
}

// ============================================================
// ErrorRecoveryManager - 错误恢复管理器
// ============================================================

export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager | null = null;
  
  private errors: ErrorContext[] = [];
  private maxErrors: number = 1000;
  private logger: StructuredLogger;
  private feedbackCenter: FeedbackCenter;
  private fallbackHandlers: Map<string, FallbackHandler> = new Map();
  
  private defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: ["network", "timeout", "resource"],
  };
  
  private constructor() {
    this.logger = new StructuredLogger();
    this.feedbackCenter = new FeedbackCenter();
    this.registerDefaultFallbacks();
  }
  
  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }
  
  // ============ 错误捕获与分类 ============
  
  /**
   * 捕获并处理错误
   */
  async capture(
    error: Error,
    context?: Record<string, unknown>,
    policy?: Partial<RetryPolicy>
  ): Promise<ErrorContext> {
    const errorContext: ErrorContext = {
      id: `error-${Date.now()}`,
      error,
      category: this.categorizeError(error),
      severity: this.assessSeverity(error),
      timestamp: new Date(),
      context,
      retryCount: 0,
      maxRetries: policy?.maxRetries ?? this.defaultRetryPolicy.maxRetries,
      recovered: false,
    };
    
    this.errors.push(errorContext);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    
    this.logger.error(`错误捕获: ${error.message}`, {
      category: errorContext.category,
      severity: errorContext.severity,
    });
    
    // 提交反馈
    this.feedbackCenter.submit(
      "negative",
      "system",
      `错误: ${error.message}`,
      { category: errorContext.category, severity: errorContext.severity }
    );
    
    return errorContext;
  }
  
  /**
   * 分类错误
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes("network") || message.includes("econnrefused") || message.includes("enotfound")) {
      return "network";
    }
    if (message.includes("timeout") || message.includes("etimedout")) {
      return "timeout";
    }
    if (message.includes("memory") || message.includes("resource") || message.includes("enomem")) {
      return "resource";
    }
    if (message.includes("validation") || message.includes("invalid") || message.includes("typeerror")) {
      return "validation";
    }
    if (message.includes("permission") || message.includes("eacces") || message.includes("forbidden")) {
      return "permission";
    }
    
    return "unknown";
  }
  
  /**
   * 评估严重程度
   */
  private assessSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes("critical") || message.includes("fatal")) {
      return "critical";
    }
    if (message.includes("failed") || message.includes("error")) {
      return "high";
    }
    if (message.includes("warning") || message.includes("deprecated")) {
      return "medium";
    }
    
    return "low";
  }
  
  // ============ 自动重试 ============
  
  /**
   * 带重试的执行
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    policy?: Partial<RetryPolicy>
  ): Promise<T> {
    const finalPolicy = { ...this.defaultRetryPolicy, ...policy };
    let lastError: Error | null = null;
    let delay = finalPolicy.baseDelay;
    
    for (let attempt = 0; attempt <= finalPolicy.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const category = this.categorizeError(error);
        
        // 检查是否可重试
        if (!finalPolicy.retryableErrors.includes(category)) {
          throw error;
        }
        
        // 最后一次尝试
        if (attempt === finalPolicy.maxRetries) {
          break;
        }
        
        this.logger.warn(`操作失败，${delay}ms 后重试 (${attempt + 1}/${finalPolicy.maxRetries})`, {
          error: error.message,
        });
        
        await this.sleep(delay);
        delay = Math.min(delay * finalPolicy.backoffMultiplier, finalPolicy.maxDelay);
      }
    }
    
    throw lastError;
  }
  
  // ============ 降级方案 ============
  
  /**
   * 注册降级处理器
   */
  registerFallback(handler: FallbackHandler): void {
    this.fallbackHandlers.set(handler.name, handler);
  }
  
  /**
   * 带降级的执行
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackName?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // 查找匹配的降级处理器
      for (const [name, handler] of this.fallbackHandlers) {
        if (fallbackName && name !== fallbackName) continue;
        
        const errorContext: ErrorContext = {
          id: `error-${Date.now()}`,
          error,
          category: this.categorizeError(error),
          severity: this.assessSeverity(error),
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 0,
          recovered: false,
        };
        
        if (handler.condition(error, errorContext)) {
          this.logger.info(`使用降级方案: ${name}`);
          return handler.handler(error, errorContext);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 注册默认降级处理器
   */
  private registerDefaultFallbacks(): void {
    // 网络错误降级：返回缓存或默认值
    this.registerFallback({
      name: "network-cache",
      condition: (error, ctx) => ctx.category === "network",
      handler: async (error, ctx) => {
        this.logger.warn("网络错误，返回默认值");
        return null;
      },
    });
    
    // 超时降级：返回部分结果
    this.registerFallback({
      name: "timeout-partial",
      condition: (error, ctx) => ctx.category === "timeout",
      handler: async (error, ctx) => {
        this.logger.warn("操作超时，返回部分结果");
        return { partial: true, error: error.message };
      },
    });
    
    // 资源错误降级：清理后重试
    this.registerFallback({
      name: "resource-cleanup",
      condition: (error, ctx) => ctx.category === "resource",
      handler: async (error, ctx) => {
        this.logger.warn("资源不足，尝试清理");
        if (global.gc) global.gc();
        throw error; // 清理后仍抛出，让调用方决定
      },
    });
  }
  
  // ============ 错误学习 ============
  
  /**
   * 从错误中学习
   */
  learnFromErrors(): {
    patterns: Array<{ category: ErrorCategory; count: number; examples: string[] }>;
    suggestions: string[];
  } {
    const patterns: Map<ErrorCategory, { count: number; examples: string[] }> = new Map();
    
    for (const errorCtx of this.errors) {
      const existing = patterns.get(errorCtx.category) || { count: 0, examples: [] };
      existing.count++;
      if (existing.examples.length < 3) {
        existing.examples.push(errorCtx.error.message);
      }
      patterns.set(errorCtx.category, existing);
    }
    
    const suggestions: string[] = [];
    
    // 基于模式生成建议
    const networkErrors = patterns.get("network");
    if (networkErrors && networkErrors.count > 5) {
      suggestions.push("网络错误频繁，建议检查网络连接或增加超时时间");
    }
    
    const timeoutErrors = patterns.get("timeout");
    if (timeoutErrors && timeoutErrors.count > 3) {
      suggestions.push("超时错误较多，建议优化操作或增加超时阈值");
    }
    
    const resourceErrors = patterns.get("resource");
    if (resourceErrors && resourceErrors.count > 2) {
      suggestions.push("资源错误出现，建议检查内存使用或增加资源限制");
    }
    
    return {
      patterns: Array.from(patterns.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        examples: data.examples,
      })),
      suggestions,
    };
  }
  
  // ============ 统计 ============
  
  /**
   * 获取错误统计
   */
  getStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recoveryRate: number;
  } {
    const total = this.errors.length;
    const recovered = this.errors.filter(e => e.recovered).length;
    
    const byCategory: Record<ErrorCategory, number> = {
      network: 0,
      timeout: 0,
      resource: 0,
      validation: 0,
      permission: 0,
      unknown: 0,
    };
    
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    
    for (const errorCtx of this.errors) {
      byCategory[errorCtx.category]++;
      bySeverity[errorCtx.severity]++;
    }
    
    return {
      total,
      byCategory,
      bySeverity,
      recoveryRate: total > 0 ? recovered / total : 0,
    };
  }
  
  /**
   * 打印错误报告
   */
  printReport(): void {
    const stats = this.getStats();
    const learning = this.learnFromErrors();
    
    // console.log("\n=== 错误恢复报告 ===");
    // console.log(`\n【统计】`);
    // console.log(`  总错误数: ${stats.total}`);
    // console.log(`  恢复率: ${(stats.recoveryRate * 100).toFixed(1)}%`);
    
    // console.log(`\n【按类别】`);
    for (const [category, count] of Object.entries(stats.byCategory)) {
      if (count > 0) {
        // console.log(`  ${category}: ${count}`);
      }
    }
    
    // console.log(`\n【按严重程度】`);
    for (const [severity, count] of Object.entries(stats.bySeverity)) {
      if (count > 0) {
        // console.log(`  ${severity}: ${count}`);
      }
    }
    
    if (learning.suggestions.length > 0) {
      // console.log(`\n【建议】`);
      for (const suggestion of learning.suggestions) {
        // console.log(`  • ${suggestion}`);
      }
    }
  }
  
  // ============ 工具方法 ============
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  clear(): void {
    this.errors = [];
  }
}

// ============================================================
// 导出便捷函数
// ============================================================

export function getErrorRecoveryManager(): ErrorRecoveryManager {
  return ErrorRecoveryManager.getInstance();
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  policy?: Partial<RetryPolicy>
): Promise<T> {
  return getErrorRecoveryManager().executeWithRetry(operation, policy);
}

export async function withFallback<T>(
  operation: () => Promise<T>,
  fallbackName?: string
): Promise<T> {
  return getErrorRecoveryManager().executeWithFallback(operation, fallbackName);
}
