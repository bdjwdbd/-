/**
 * 健康检查器
 * 
 * 系统健康状态监控和自动修复
 * 融合自 yaoyao-memory-v2
 */

import { StructuredLogger } from './index';
import { MemoryStore } from './memory-store';

// ============ 类型定义 ============

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface HealthReport {
  overall: 'healthy' | 'warning' | 'error';
  results: HealthCheckResult[];
  timestamp: number;
  recommendations: string[];
}

export interface HealthConfig {
  checkInterval: number;  // 检查间隔（毫秒）
  autoFix: boolean;       // 自动修复
  alertThreshold: number; // 警告阈值
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: HealthConfig = {
  checkInterval: 6 * 60 * 60 * 1000, // 6小时
  autoFix: true,
  alertThreshold: 0.7
};

// ============ 健康检查器类 ============

export class HealthChecker {
  private logger: StructuredLogger;
  private memoryStore: MemoryStore;
  private config: HealthConfig;
  private lastCheck: number = 0;
  private checkHistory: HealthReport[] = [];

  constructor(
    logger: StructuredLogger,
    memoryStore: MemoryStore,
    config?: Partial<HealthConfig>
  ) {
    this.logger = logger;
    this.memoryStore = memoryStore;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============ 健康检查 ============

  async check(): Promise<HealthReport> {
    const results: HealthCheckResult[] = [];
    const recommendations: string[] = [];
    const now = Date.now();

    // 1. 检查记忆存储
    results.push(await this.checkMemoryStore());

    // 2. 检查记忆质量
    results.push(await this.checkMemoryQuality());

    // 3. 检查系统资源
    results.push(this.checkSystemResources());

    // 4. 检查配置
    results.push(this.checkConfiguration());

    // 计算整体状态
    const hasError = results.some(r => r.status === 'error');
    const hasWarning = results.some(r => r.status === 'warning');
    
    let overall: 'healthy' | 'warning' | 'error';
    if (hasError) {
      overall = 'error';
    } else if (hasWarning) {
      overall = 'warning';
    } else {
      overall = 'healthy';
    }

    // 生成建议
    for (const result of results) {
      if (result.status !== 'healthy') {
        recommendations.push(this.generateRecommendation(result));
      }
    }

    const report: HealthReport = {
      overall,
      results,
      timestamp: now,
      recommendations
    };

    // 记录历史
    this.lastCheck = now;
    this.checkHistory.push(report);
    if (this.checkHistory.length > 100) {
      this.checkHistory.shift();
    }

    this.logger.info('HealthChecker', `健康检查完成: ${overall}`);
    return report;
  }

  private async checkMemoryStore(): Promise<HealthCheckResult> {
    try {
      const stats = await this.memoryStore.getStats();
      
      if (stats.total === 0) {
        return {
          component: 'memory_store',
          status: 'warning',
          message: '记忆存储为空',
          details: { total: 0 },
          timestamp: Date.now()
        };
      }

      if (stats.avgConfidence < 0.5) {
        return {
          component: 'memory_store',
          status: 'warning',
          message: '平均置信度过低',
          details: { avgConfidence: stats.avgConfidence },
          timestamp: Date.now()
        };
      }

      return {
        component: 'memory_store',
        status: 'healthy',
        message: '记忆存储正常',
        details: {
          total: stats.total,
          avgImportance: stats.avgImportance,
          avgConfidence: stats.avgConfidence
        },
        timestamp: Date.now()
      };
    } catch (e) {
      return {
        component: 'memory_store',
        status: 'error',
        message: `记忆存储异常: ${e}`,
        timestamp: Date.now()
      };
    }
  }

  private async checkMemoryQuality(): Promise<HealthCheckResult> {
    try {
      const memories = await this.memoryStore.exportAll();
      
      // 检查重复记忆
      const contentSet = new Set<string>();
      let duplicates = 0;
      
      for (const memory of memories) {
        const key = memory.content.substring(0, 50);
        if (contentSet.has(key)) {
          duplicates++;
        } else {
          contentSet.add(key);
        }
      }

      if (duplicates > memories.length * 0.1) {
        return {
          component: 'memory_quality',
          status: 'warning',
          message: '存在较多重复记忆',
          details: { duplicates, total: memories.length },
          timestamp: Date.now()
        };
      }

      // 检查过期记忆
      const now = Date.now();
      const oldThreshold = 30 * 24 * 60 * 60 * 1000; // 30天
      const oldMemories = memories.filter(m => now - m.createdAt > oldThreshold);

      if (oldMemories.length > memories.length * 0.5) {
        return {
          component: 'memory_quality',
          status: 'warning',
          message: '存在较多过期记忆',
          details: { oldMemories: oldMemories.length, total: memories.length },
          timestamp: Date.now()
        };
      }

      return {
        component: 'memory_quality',
        status: 'healthy',
        message: '记忆质量良好',
        details: {
          duplicates,
          oldMemories: oldMemories.length,
          total: memories.length
        },
        timestamp: Date.now()
      };
    } catch (e) {
      return {
        component: 'memory_quality',
        status: 'error',
        message: `质量检查异常: ${e}`,
        timestamp: Date.now()
      };
    }
  }

  private checkSystemResources(): HealthCheckResult {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const usageRatio = mem.heapUsed / mem.heapTotal;

    if (usageRatio > 0.9) {
      return {
        component: 'system_resources',
        status: 'error',
        message: '内存使用率过高',
        details: { heapUsedMB, heapTotalMB, usageRatio },
        timestamp: Date.now()
      };
    }

    if (usageRatio > 0.7) {
      return {
        component: 'system_resources',
        status: 'warning',
        message: '内存使用率较高',
        details: { heapUsedMB, heapTotalMB, usageRatio },
        timestamp: Date.now()
      };
    }

    return {
      component: 'system_resources',
      status: 'healthy',
      message: '系统资源正常',
      details: { heapUsedMB, heapTotalMB, usageRatio },
      timestamp: Date.now()
    };
  }

  private checkConfiguration(): HealthCheckResult {
    // 检查配置是否合理
    const issues: string[] = [];

    if (this.config.checkInterval < 60 * 60 * 1000) {
      issues.push('检查间隔过短');
    }

    if (issues.length > 0) {
      return {
        component: 'configuration',
        status: 'warning',
        message: '配置存在问题',
        details: { issues },
        timestamp: Date.now()
      };
    }

    return {
      component: 'configuration',
      status: 'healthy',
      message: '配置正常',
      timestamp: Date.now()
    };
  }

  // ============ 自动修复 ============

  async autoFix(report: HealthReport): Promise<string[]> {
    if (!this.config.autoFix) {
      return ['自动修复已禁用'];
    }

    const fixes: string[] = [];

    for (const result of report.results) {
      if (result.status === 'error' || result.status === 'warning') {
        const fix = await this.applyFix(result);
        if (fix) {
          fixes.push(fix);
        }
      }
    }

    return fixes;
  }

  private async applyFix(result: HealthCheckResult): Promise<string | null> {
    switch (result.component) {
      case 'memory_quality':
        if (result.details?.duplicates > 0) {
          // 清理重复记忆
          const cleaned = await this.memoryStore.cleanup({ minImportance: 0.2 });
          return `清理了 ${cleaned} 条低质量记忆`;
        }
        break;

      case 'system_resources':
        if (result.details?.usageRatio > 0.8) {
          // 触发垃圾回收（如果可用）
          if (global.gc) {
            global.gc();
            return '已触发垃圾回收';
          }
        }
        break;
    }

    return null;
  }

  // ============ 建议 ============

  private generateRecommendation(result: HealthCheckResult): string {
    switch (result.component) {
      case 'memory_store':
        return '建议添加更多高质量记忆';
      case 'memory_quality':
        return '建议运行清理操作移除重复或过期记忆';
      case 'system_resources':
        return '建议重启系统或增加内存';
      case 'configuration':
        return '建议调整配置参数';
      default:
        return '建议检查系统状态';
    }
  }

  // ============ 历史记录 ============

  getHistory(limit: number = 10): HealthReport[] {
    return this.checkHistory.slice(-limit);
  }

  getLastCheck(): number {
    return this.lastCheck;
  }

  // ============ 配置管理 ============

  updateConfig(config: Partial<HealthConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('HealthChecker', '配置已更新');
  }

  getConfig(): HealthConfig {
    return { ...this.config };
  }
}
