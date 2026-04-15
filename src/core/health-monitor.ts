/**
 * 健康监控器 - TypeScript 原生实现
 * 
 * 功能：
 * 1. 系统健康检查
 * 2. 向量覆盖率监控
 * 3. 性能指标收集
 * 4. 告警通知
 */

import { DatabaseSync } from "node:sqlite";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// ============================================================
// 类型定义
// ============================================================

export interface HealthStatus {
  status: "healthy" | "warning" | "critical";
  checks: Record<string, HealthCheck>;
  timestamp: string;
  message: string;
}

export interface HealthCheck {
  status: "pass" | "warn" | "fail";
  message: string;
  value?: number;
  threshold?: number;
}

export interface CoverageStats {
  l0Total: number;
  l0Vectorized: number;
  l0Coverage: number;
  l1Total: number;
  l1Vectorized: number;
  l1Coverage: number;
  totalCoverage: number;
}

export interface PerformanceMetrics {
  avgSearchTime: number;
  avgEmbeddingTime: number;
  cacheHitRate: number;
  errorRate: number;
  requestsPerMinute: number;
}

export interface HealthMonitorConfig {
  dbPath: string;
  checkInterval: number;
  alertThresholds: {
    coverageMin: number;
    errorRateMax: number;
    responseTimeMax: number;
  };
}

// ============================================================
// HealthMonitor 类
// ============================================================

export class HealthMonitor {
  private config: HealthMonitorConfig;
  private db: DatabaseSync | null = null;
  private metrics: PerformanceMetrics = {
    avgSearchTime: 0,
    avgEmbeddingTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    requestsPerMinute: 0,
  };
  
  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = {
      dbPath: config.dbPath || path.join(os.homedir(), ".openclaw/memory-tdai/vectors.db"),
      checkInterval: config.checkInterval || 3600,
      alertThresholds: {
        coverageMin: 0.8,
        errorRateMax: 0.1,
        responseTimeMax: 5000,
        ...config.alertThresholds,
      },
    };
  }
  
  // ============================================================
  // 初始化
  // ============================================================
  
  async initialize(): Promise<boolean> {
    if (!fs.existsSync(this.config.dbPath)) {
      console.warn("[HealthMonitor] 数据库文件不存在");
      return false;
    }
    
    try {
      this.db = new DatabaseSync(this.config.dbPath);
      // console.log("[HealthMonitor] ✅ 初始化完成");
      return true;
    } catch (error) {
      console.error("[HealthMonitor] 初始化失败:", error);
      return false;
    }
  }
  
  // ============================================================
  // 健康检查
  // ============================================================
  
  async checkHealth(): Promise<HealthStatus> {
    const checks: Record<string, HealthCheck> = {};
    
    // 1. 数据库连接检查
    checks.database = this.checkDatabase();
    
    // 2. 向量覆盖率检查
    checks.coverage = await this.checkCoverage();
    
    // 3. 磁盘空间检查
    checks.diskSpace = this.checkDiskSpace();
    
    // 4. 内存使用检查
    checks.memory = this.checkMemory();
    
    // 5. 性能检查
    checks.performance = this.checkPerformance();
    
    // 计算整体状态
    const hasFail = Object.values(checks).some((c) => c.status === "fail");
    const hasWarn = Object.values(checks).some((c) => c.status === "warn");
    
    const status = hasFail ? "critical" : hasWarn ? "warning" : "healthy";
    const message = this.generateMessage(status, checks);
    
    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
      message,
    };
  }
  
  private checkDatabase(): HealthCheck {
    if (!this.db) {
      return {
        status: "fail",
        message: "数据库未连接",
      };
    }
    
    try {
      const stmt = this.db.prepare("SELECT 1");
      stmt.get();
      
      return {
        status: "pass",
        message: "数据库连接正常",
      };
    } catch (error: any) {
      return {
        status: "fail",
        message: `数据库连接失败: ${error.message}`,
      };
    }
  }
  
  private async checkCoverage(): Promise<HealthCheck> {
    const stats = await this.getCoverageStats();
    
    if (stats.totalCoverage >= this.config.alertThresholds.coverageMin) {
      return {
        status: "pass",
        message: `向量覆盖率: ${(stats.totalCoverage * 100).toFixed(1)}%`,
        value: stats.totalCoverage,
        threshold: this.config.alertThresholds.coverageMin,
      };
    } else {
      return {
        status: "warn",
        message: `向量覆盖率过低: ${(stats.totalCoverage * 100).toFixed(1)}%`,
        value: stats.totalCoverage,
        threshold: this.config.alertThresholds.coverageMin,
      };
    }
  }
  
  private checkDiskSpace(): HealthCheck {
    try {
      const stats = fs.statfsSync(path.dirname(this.config.dbPath));
      const availableGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
      
      if (availableGB < 1) {
        return {
          status: "fail",
          message: `磁盘空间不足: ${availableGB.toFixed(2)} GB`,
          value: availableGB,
        };
      } else if (availableGB < 5) {
        return {
          status: "warn",
          message: `磁盘空间较低: ${availableGB.toFixed(2)} GB`,
          value: availableGB,
        };
      }
      
      return {
        status: "pass",
        message: `磁盘空间充足: ${availableGB.toFixed(2)} GB`,
        value: availableGB,
      };
    } catch (error: any) {
      return {
        status: "warn",
        message: `无法检查磁盘空间: ${error.message}`,
      };
    }
  }
  
  private checkMemory(): HealthCheck {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedPercent = (totalMem - freeMem) / totalMem;
    
    if (usedPercent > 0.9) {
      return {
        status: "fail",
        message: `内存使用过高: ${(usedPercent * 100).toFixed(1)}%`,
        value: usedPercent,
      };
    } else if (usedPercent > 0.8) {
      return {
        status: "warn",
        message: `内存使用较高: ${(usedPercent * 100).toFixed(1)}%`,
        value: usedPercent,
      };
    }
    
    return {
      status: "pass",
      message: `内存使用正常: ${(usedPercent * 100).toFixed(1)}%`,
      value: usedPercent,
    };
  }
  
  private checkPerformance(): HealthCheck {
    const { avgSearchTime, errorRate } = this.metrics;
    
    if (errorRate > this.config.alertThresholds.errorRateMax) {
      return {
        status: "fail",
        message: `错误率过高: ${(errorRate * 100).toFixed(1)}%`,
        value: errorRate,
        threshold: this.config.alertThresholds.errorRateMax,
      };
    }
    
    if (avgSearchTime > this.config.alertThresholds.responseTimeMax) {
      return {
        status: "warn",
        message: `响应时间较慢: ${avgSearchTime.toFixed(0)}ms`,
        value: avgSearchTime,
        threshold: this.config.alertThresholds.responseTimeMax,
      };
    }
    
    return {
      status: "pass",
      message: `性能正常 (搜索: ${avgSearchTime.toFixed(0)}ms, 错误率: ${(errorRate * 100).toFixed(1)}%)`,
      value: avgSearchTime,
    };
  }
  
  // ============================================================
  // 向量覆盖率统计
  // ============================================================
  
  async getCoverageStats(): Promise<CoverageStats> {
    if (!this.db) {
      await this.initialize();
    }
    
    if (!this.db) {
      return {
        l0Total: 0,
        l0Vectorized: 0,
        l0Coverage: 0,
        l1Total: 0,
        l1Vectorized: 0,
        l1Coverage: 0,
        totalCoverage: 0,
      };
    }
    
    try {
      // L0 统计
      const l0TotalStmt = this.db.prepare("SELECT COUNT(*) as count FROM l0_conversations");
      const l0Total = (l0TotalStmt.get() as any)?.count || 0;
      
      const l0VecStmt = this.db.prepare("SELECT COUNT(*) as count FROM l0_vec_rowids");
      const l0Vectorized = (l0VecStmt.get() as any)?.count || 0;
      
      // L1 统计
      const l1TotalStmt = this.db.prepare("SELECT COUNT(*) as count FROM l1_records");
      const l1Total = (l1TotalStmt.get() as any)?.count || 0;
      
      const l1VecStmt = this.db.prepare("SELECT COUNT(*) as count FROM l1_vec_rowids");
      const l1Vectorized = (l1VecStmt.get() as any)?.count || 0;
      
      const l0Coverage = l0Total > 0 ? l0Vectorized / l0Total : 0;
      const l1Coverage = l1Total > 0 ? l1Vectorized / l1Total : 0;
      const total = l0Total + l1Total;
      const totalVectorized = l0Vectorized + l1Vectorized;
      const totalCoverage = total > 0 ? totalVectorized / total : 0;
      
      return {
        l0Total,
        l0Vectorized,
        l0Coverage,
        l1Total,
        l1Vectorized,
        l1Coverage,
        totalCoverage,
      };
    } catch (error) {
      console.error("[HealthMonitor] 获取覆盖率统计失败:", error);
      return {
        l0Total: 0,
        l0Vectorized: 0,
        l0Coverage: 0,
        l1Total: 0,
        l1Vectorized: 0,
        l1Coverage: 0,
        totalCoverage: 0,
      };
    }
  }
  
  // ============================================================
  // 性能指标更新
  // ============================================================
  
  updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
  }
  
  recordSearchTime(time: number): void {
    // 简单移动平均
    this.metrics.avgSearchTime = (this.metrics.avgSearchTime * 0.9) + (time * 0.1);
  }
  
  recordError(): void {
    this.metrics.errorRate = (this.metrics.errorRate * 0.95) + (1 * 0.05);
  }
  
  // ============================================================
  // 工具方法
  // ============================================================
  
  private generateMessage(status: string, checks: Record<string, HealthCheck>): string {
    if (status === "healthy") {
      return "所有检查通过";
    }
    
    const failed = Object.entries(checks)
      .filter(([, c]) => c.status !== "pass")
      .map(([name, c]) => `${name}: ${c.message}`);
    
    return `问题: ${failed.join("; ")}`;
  }
  
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ============================================================
// 导出
// ============================================================

export default HealthMonitor;
