/**
 * 安全与验证组件
 * 
 * 包含：
 * - HardConstraints: 硬约束
 * - LearningValidator: 学习验证器
 * - CleanupRecycler: 清理回收器
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

type ConstraintSeverity = "error" | "warning" | "info";
type ValidationResult = "pass" | "fail" | "warning";

interface Constraint {
  id: string;
  name: string;
  description: string;
  severity: ConstraintSeverity;
  check: (input: any) => boolean;
}

interface ValidationReport {
  passed: boolean;
  results: Array<{
    constraintId: string;
    result: ValidationResult;
    message: string;
  }>;
  score: number;
}

interface LearningRecord {
  id: string;
  input: string;
  output: string;
  feedback: "positive" | "negative" | "neutral";
  timestamp: Date;
}

interface CleanupTask {
  id: string;
  type: "file" | "memory" | "cache" | "log";
  target: string;
  priority: number;
  createdAt: Date;
  executedAt?: Date;
}

// ============================================================
// HardConstraints - 硬约束
// ============================================================

export class HardConstraints {
  private constraints: Map<string, Constraint> = new Map();
  
  addConstraint(constraint: Constraint): void {
    this.constraints.set(constraint.id, constraint);
  }
  
  removeConstraint(id: string): boolean {
    return this.constraints.delete(id);
  }
  
  validate(input: any): ValidationReport {
    const results: ValidationReport["results"] = [];
    let passCount = 0;
    let warningCount = 0;
    
    for (const [id, constraint] of this.constraints) {
      const passed = constraint.check(input);
      
      results.push({
        constraintId: id,
        result: passed ? "pass" : constraint.severity === "error" ? "fail" : "warning",
        message: passed 
          ? `约束 "${constraint.name}" 通过` 
          : `约束 "${constraint.name}" 失败: ${constraint.description}`,
      });
      
      if (passed) {
        passCount++;
      } else if (constraint.severity === "warning") {
        warningCount++;
      }
    }
    
    const hasErrors = results.some(r => r.result === "fail");
    const score = passCount / this.constraints.size;
    
    return {
      passed: !hasErrors,
      results,
      score,
    };
  }
  
  getConstraints(): Constraint[] {
    return Array.from(this.constraints.values());
  }
  
  clear(): void {
    this.constraints.clear();
  }
}

// ============================================================
// LearningValidator - 学习验证器
// ============================================================

export class LearningValidator {
  private records: LearningRecord[] = [];
  private maxRecords: number = 10000;
  private generator: unknown = null;
  private evaluator: unknown = null;
  
  constructor() {
    // 初始化
  }
  
  record(input: string, output: string, feedback: LearningRecord["feedback"]): void {
    this.records.push({
      id: `learn-${Date.now()}`,
      input,
      output,
      feedback,
      timestamp: new Date(),
    });
    
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }
  
  async validate(input: string, output: string): Promise<{
    valid: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let score = 1.0;
    
    // 检查输出是否为空
    if (!output || output.trim().length === 0) {
      issues.push("输出为空");
      score -= 0.5;
    }
    
    // 检查输出是否包含错误标记
    if (output.includes("error") || output.includes("failed")) {
      issues.push("输出包含错误标记");
      score -= 0.3;
    }
    
    // 检查历史反馈
    const similarRecords = this.findSimilar(input);
    const negativeRate = similarRecords.filter(r => r.feedback === "negative").length / Math.max(similarRecords.length, 1);
    
    if (negativeRate > 0.5) {
      issues.push("类似输入历史反馈较差");
      score -= 0.2;
    }
    
    return {
      valid: score >= 0.5,
      score: Math.max(0, score),
      issues,
    };
  }
  
  private findSimilar(input: string): LearningRecord[] {
    // 简单的相似度匹配
    const inputWords = input.toLowerCase().split(/\s+/);
    
    return this.records.filter(record => {
      const recordWords = record.input.toLowerCase().split(/\s+/);
      const commonWords = inputWords.filter(w => recordWords.includes(w));
      return commonWords.length >= Math.min(inputWords.length, recordWords.length) * 0.5;
    });
  }
  
  getStats(): {
    totalRecords: number;
    positiveRate: number;
    negativeRate: number;
  } {
    const total = this.records.length;
    const positive = this.records.filter(r => r.feedback === "positive").length;
    const negative = this.records.filter(r => r.feedback === "negative").length;
    
    return {
      totalRecords: total,
      positiveRate: total > 0 ? positive / total : 0,
      negativeRate: total > 0 ? negative / total : 0,
    };
  }
  
  clear(): void {
    this.records = [];
  }
}

// ============================================================
// CleanupRecycler - 清理回收器
// ============================================================

export class CleanupRecycler {
  private tasks: CleanupTask[] = [];
  private maxTasks: number = 1000;
  private autoCleanup: boolean = true;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor(autoCleanup: boolean = true) {
    this.autoCleanup = autoCleanup;
    
    if (autoCleanup) {
      this.startAutoCleanup();
    }
  }
  
  scheduleCleanup(type: CleanupTask["type"], target: string, priority: number = 5): CleanupTask {
    const task: CleanupTask = {
      id: `cleanup-${Date.now()}`,
      type,
      target,
      priority,
      createdAt: new Date(),
    };
    
    this.tasks.push(task);
    this.tasks.sort((a, b) => a.priority - b.priority);
    
    if (this.tasks.length > this.maxTasks) {
      this.tasks = this.tasks.slice(-this.maxTasks);
    }
    
    return task;
  }
  
  async executeNext(): Promise<CleanupTask | null> {
    const task = this.tasks.shift();
    if (!task) return null;
    
    try {
      await this.executeTask(task);
      task.executedAt = new Date();
    } catch (error) {
      console.error(`清理任务失败: ${task.id}`, error);
    }
    
    return task;
  }
  
  private async executeTask(task: CleanupTask): Promise<void> {
    switch (task.type) {
      case "file":
        if (fs.existsSync(task.target)) {
          fs.unlinkSync(task.target);
        }
        break;
        
      case "cache":
        // 清理缓存
        break;
        
      case "log":
        // 清理日志
        if (fs.existsSync(task.target)) {
          const stats = fs.statSync(task.target);
          if (stats.size > 10 * 1024 * 1024) { // 10MB
            fs.writeFileSync(task.target, "");
          }
        }
        break;
        
      case "memory":
        // 触发垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
        break;
    }
  }
  
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      if (this.tasks.length > 0) {
        this.executeNext();
      }
    }, 60000); // 每分钟执行一次
  }
  
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  getPendingTasks(): CleanupTask[] {
    return [...this.tasks];
  }
  
  getTaskCount(): number {
    return this.tasks.length;
  }
  
  clear(): void {
    this.tasks = [];
  }
}

export type {
  ConstraintSeverity,
  ValidationResult,
  Constraint,
  ValidationReport,
  LearningRecord,
  CleanupTask,
};
