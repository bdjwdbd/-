/**
 * 熵治理 - 技术债务自动清理
 * 
 * 核心机制：
 * - 熵检测：识别混乱、重复、过时代码
 * - 熵评分：量化技术债务程度
 * - 熵清理：自动或半自动清理
 * 
 * 来源：Harness Engineering 文档
 * 
 * @module harness/entropy-governor
 */

// ============ 类型定义 ============

export interface EntropyConfig {
  /** 检测周期（毫秒） */
  detectionInterval: number;
  /** 熵阈值（0-1，超过则触发清理） */
  entropyThreshold: number;
  /** 是否自动清理 */
  autoCleanup: boolean;
  /** 清理前是否确认 */
  confirmBeforeCleanup: boolean;
  /** 是否记录日志 */
  enableLogging: boolean;
  /** 检测范围 */
  scope: {
    checkDuplicates: boolean;
    checkDeprecated: boolean;
    checkUnused: boolean;
    checkInconsistent: boolean;
  };
}

export interface EntropyIssue {
  /** 问题类型 */
  type: 'duplicate' | 'deprecated' | 'unused' | 'inconsistent';
  /** 问题位置 */
  location: string;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high';
  /** 问题描述 */
  description: string;
  /** 修复建议 */
  suggestion: string;
  /** 是否可自动修复 */
  autoFixable: boolean;
  /** 元数据 */
  metadata?: Record<string, any>;
}

export interface EntropyReport {
  /** 熵评分（0-1，越高越混乱） */
  score: number;
  /** 问题列表 */
  issues: EntropyIssue[];
  /** 检测时间 */
  timestamp: Date;
  /** 检测耗时（毫秒） */
  duration: number;
  /** 统计信息 */
  stats: {
    totalIssues: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    autoFixable: number;
  };
}

export interface CleanupResult {
  /** 清理的问题数 */
  cleaned: number;
  /** 剩余问题数 */
  remaining: number;
  /** 清理详情 */
  details: Array<{
    issue: EntropyIssue;
    action: 'fixed' | 'skipped' | 'failed';
    message?: string;
  }>;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: Partial<EntropyConfig> = {
  detectionInterval: 86400000, // 24小时
  entropyThreshold: 0.7,
  autoCleanup: false,
  confirmBeforeCleanup: true,
  enableLogging: true,
  scope: {
    checkDuplicates: true,
    checkDeprecated: true,
    checkUnused: true,
    checkInconsistent: true,
  },
};

// ============ 熵治理类 ============

/**
 * 熵治理 - 技术债务自动清理
 * 
 * 使用示例：
 * ```typescript
 * const governor = new EntropyGovernor({
 *   entropyThreshold: 0.7,
 *   autoCleanup: false,
 * });
 * 
 * // 检测熵
 * const report = await governor.detect();
 * console.log('熵评分:', report.score);
 * 
 * // 清理熵
 * const result = await governor.cleanup();
 * console.log('已清理:', result.cleaned);
 * ```
 */
export class EntropyGovernor {
  private config: EntropyConfig;
  private lastReport: EntropyReport | null = null;
  private lastDetectionTime: number = 0;

  constructor(config: Partial<EntropyConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as EntropyConfig;
  }

  /**
   * 检测熵
   */
  async detect(): Promise<EntropyReport> {
    const startTime = Date.now();
    const issues: EntropyIssue[] = [];

    this.log('info', '[EntropyGovernor] 开始熵检测...');

    // 检测重复代码
    if (this.config.scope.checkDuplicates) {
      const duplicates = await this.detectDuplicates();
      issues.push(...duplicates);
      this.log('debug', `[EntropyGovernor] 检测到 ${duplicates.length} 个重复问题`);
    }

    // 检测废弃代码
    if (this.config.scope.checkDeprecated) {
      const deprecated = await this.detectDeprecated();
      issues.push(...deprecated);
      this.log('debug', `[EntropyGovernor] 检测到 ${deprecated.length} 个废弃问题`);
    }

    // 检测未使用代码
    if (this.config.scope.checkUnused) {
      const unused = await this.detectUnused();
      issues.push(...unused);
      this.log('debug', `[EntropyGovernor] 检测到 ${unused.length} 个未使用问题`);
    }

    // 检测不一致
    if (this.config.scope.checkInconsistent) {
      const inconsistent = await this.detectInconsistent();
      issues.push(...inconsistent);
      this.log('debug', `[EntropyGovernor] 检测到 ${inconsistent.length} 个不一致问题`);
    }

    // 计算熵评分
    const score = this.calculateScore(issues);
    const duration = Date.now() - startTime;

    this.lastReport = {
      score,
      issues,
      timestamp: new Date(),
      duration,
      stats: {
        totalIssues: issues.length,
        highSeverity: issues.filter(i => i.severity === 'high').length,
        mediumSeverity: issues.filter(i => i.severity === 'medium').length,
        lowSeverity: issues.filter(i => i.severity === 'low').length,
        autoFixable: issues.filter(i => i.autoFixable).length,
      },
    };

    this.lastDetectionTime = Date.now();
    this.log('info', `[EntropyGovernor] 熵检测完成，评分: ${score.toFixed(2)}`);

    return this.lastReport;
  }

  /**
   * 清理熵
   */
  async cleanup(): Promise<CleanupResult> {
    if (!this.lastReport) {
      await this.detect();
    }

    const details: CleanupResult['details'] = [];
    let cleaned = 0;

    this.log('info', '[EntropyGovernor] 开始熵清理...');

    for (const issue of this.lastReport!.issues) {
      // 检查是否需要确认
      if (this.config.confirmBeforeCleanup && !this.config.autoCleanup) {
        // 非自动模式，跳过
        details.push({
          issue,
          action: 'skipped',
          message: '需要手动确认',
        });
        continue;
      }

      // 检查是否可自动修复
      if (!issue.autoFixable) {
        details.push({
          issue,
          action: 'skipped',
          message: '不可自动修复',
        });
        continue;
      }

      // 执行清理
      try {
        await this.fixIssue(issue);
        details.push({
          issue,
          action: 'fixed',
        });
        cleaned++;
        this.log('info', `[EntropyGovernor] 已清理: ${issue.location}`);
      } catch (error) {
        details.push({
          issue,
          action: 'failed',
          message: error instanceof Error ? error.message : String(error),
        });
        this.log('error', `[EntropyGovernor] 清理失败: ${issue.location}`);
      }
    }

    const remaining = this.lastReport!.issues.length - cleaned;

    this.log('info', `[EntropyGovernor] 熵清理完成，已清理: ${cleaned}，剩余: ${remaining}`);

    return {
      cleaned,
      remaining,
      details,
    };
  }

  /**
   * 检测重复代码
   */
  private async detectDuplicates(): Promise<EntropyIssue[]> {
    // 简化实现：返回空数组
    // 实际实现需要分析代码库，检测重复代码块
    return [];
  }

  /**
   * 检测废弃代码
   */
  private async detectDeprecated(): Promise<EntropyIssue[]> {
    // 简化实现：返回空数组
    // 实际实现需要扫描 @deprecated 注解
    return [];
  }

  /**
   * 检测未使用代码
   */
  private async detectUnused(): Promise<EntropyIssue[]> {
    // 简化实现：返回空数组
    // 实际实现需要分析导入导出关系
    return [];
  }

  /**
   * 检测不一致
   */
  private async detectInconsistent(): Promise<EntropyIssue[]> {
    // 简化实现：返回空数组
    // 实际实现需要检查命名规范、代码风格等
    return [];
  }

  /**
   * 修复问题
   */
  private async fixIssue(issue: EntropyIssue): Promise<void> {
    // 简化实现：仅记录日志
    // 实际实现需要根据问题类型执行修复
    this.log('debug', `[EntropyGovernor] 修复问题: ${issue.type} at ${issue.location}`);
  }

  /**
   * 计算熵评分
   */
  private calculateScore(issues: EntropyIssue[]): number {
    if (issues.length === 0) return 0;

    const weights = { low: 1, medium: 2, high: 3 };
    const totalWeight = issues.reduce((sum, i) => sum + weights[i.severity], 0);
    const maxWeight = issues.length * 3;

    return totalWeight / maxWeight;
  }

  /**
   * 日志记录
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    if (!this.config.enableLogging) return;
    console.log(message);
  }

  /**
   * 获取最后报告
   */
  getLastReport(): EntropyReport | null {
    return this.lastReport;
  }

  /**
   * 检查是否需要检测
   */
  shouldDetect(): boolean {
    if (!this.lastReport) return true;
    return Date.now() - this.lastDetectionTime > this.config.detectionInterval;
  }

  /**
   * 检查是否超过阈值
   */
  isOverThreshold(): boolean {
    if (!this.lastReport) return false;
    return this.lastReport.score > this.config.entropyThreshold;
  }
}

// ============ 工厂函数 ============

/**
 * 创建熵治理实例
 */
export function createEntropyGovernor(config: Partial<EntropyConfig> = {}): EntropyGovernor {
  return new EntropyGovernor(config);
}

// ============ 预设检测规则 ============

/**
 * 常用检测规则
 */
export const DetectionRules = {
  /** 检测重复函数 */
  duplicateFunction: {
    type: 'duplicate' as const,
    severity: 'medium' as const,
    autoFixable: false,
  },

  /** 检测废弃 API */
  deprecatedAPI: {
    type: 'deprecated' as const,
    severity: 'high' as const,
    autoFixable: true,
  },

  /** 检测未使用导入 */
  unusedImport: {
    type: 'unused' as const,
    severity: 'low' as const,
    autoFixable: true,
  },

  /** 检测命名不一致 */
  inconsistentNaming: {
    type: 'inconsistent' as const,
    severity: 'low' as const,
    autoFixable: true,
  },
};
