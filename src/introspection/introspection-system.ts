/**
 * 元灵自省系统 - 主入口
 * 
 * 整合变更检测、基准测试、报告生成
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { ChangeDetector } from './change-detector';
import { BenchmarkRunner } from './benchmark-runner';
import { ReportGenerator } from './report-generator';
import { VisualizationPanel } from './visualization-panel';
import {
  IntrospectionReport,
  SystemSnapshot,
  DimensionScore,
  IntrospectionConfig,
  DEFAULT_INTROSPECTION_CONFIG,
  CapabilityDimension,
} from './types';

export class IntrospectionSystem {
  private config: IntrospectionConfig;
  private changeDetector: ChangeDetector;
  private benchmarkRunner: BenchmarkRunner;
  private reportGenerator: ReportGenerator;
  private visualizationPanel: VisualizationPanel;
  private dataDir: string;
  private workspaceRoot: string;

  constructor(workspaceRoot: string, config?: Partial<IntrospectionConfig>) {
    this.config = { ...DEFAULT_INTROSPECTION_CONFIG, ...config };
    this.workspaceRoot = workspaceRoot;
    this.dataDir = join(workspaceRoot, 'memory/introspection');
    
    // 确保数据目录存在
    mkdirSync(this.dataDir, { recursive: true });
    mkdirSync(join(this.dataDir, 'history'), { recursive: true });
    mkdirSync(join(this.dataDir, 'reports'), { recursive: true });
    mkdirSync(join(this.dataDir, 'visualization'), { recursive: true });

    // 初始化组件
    this.changeDetector = new ChangeDetector(workspaceRoot, this.dataDir);
    this.benchmarkRunner = new BenchmarkRunner(workspaceRoot);
    this.reportGenerator = new ReportGenerator(this.dataDir);
    this.visualizationPanel = new VisualizationPanel({
      outputPath: join(this.dataDir, 'visualization'),
    });
  }

  /**
   * 执行自省（主入口）
   */
  async introspect(
    trigger: 'startup' | 'manual' | 'scheduled' = 'manual'
  ): Promise<IntrospectionReport> {
    console.log('[IntrospectionSystem] 开始自省...');

    // 1. 检测变更
    const changes = this.config.enabled ? this.changeDetector.detectChanges() : [];
    console.log(`[IntrospectionSystem] 检测到 ${changes.length} 个变更`);

    // 2. 运行基准测试
    console.log('[IntrospectionSystem] 运行基准测试...');
    const scores = await this.benchmarkRunner.runAllBenchmarks();

    // 3. 创建当前快照
    const currentSnapshot = this.createSnapshot(scores);
    console.log(`[IntrospectionSystem] 综合评分: ${currentSnapshot.overallScore.toFixed(2)}`);

    // 4. 加载上次快照
    const previousSnapshot = this.reportGenerator.loadLatestHistory();

    // 5. 生成报告
    const report = this.reportGenerator.generateReport(
      changes,
      currentSnapshot,
      previousSnapshot || undefined,
      trigger
    );

    // 6. 保存报告和历史
    this.reportGenerator.saveReport(report);
    this.reportGenerator.saveHistory(currentSnapshot);

    // 7. 生成可视化报告
    const vizPath = this.visualizationPanel.generateFullReport(
      currentSnapshot,
      join(this.dataDir, 'history')
    );
    console.log(`[IntrospectionSystem] 可视化报告: ${vizPath}`);

    // 8. 更新变更记录
    if (changes.length > 0) {
      this.changeDetector.updateRecords();
    }

    console.log('[IntrospectionSystem] 自省完成');

    return report;
  }

  /**
   * 创建系统快照
   */
  private createSnapshot(scores: DimensionScore[]): SystemSnapshot {
    // 计算综合评分
    let totalWeight = 0;
    let weightedSum = 0;

    for (const score of scores) {
      const config = this.getDimensionConfig(score.dimension);
      weightedSum += score.score * config.weight;
      totalWeight += config.weight;
    }

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      id: `snapshot-${Date.now()}`,
      timestamp: new Date().toISOString(),
      gitCommit: this.changeDetector.getCurrentCommit() || undefined,
      gitBranch: this.changeDetector.getCurrentBranch() || undefined,
      configHash: this.getConfigHash(),
      scores,
      overallScore,
      version: this.getSystemVersion(),
    };
  }

  /**
   * 获取维度配置
   */
  private getDimensionConfig(dimension: CapabilityDimension) {
    const configs: Record<CapabilityDimension, { weight: number; target: number }> = {
      response_speed: { weight: 0.10, target: 95 },
      understanding_accuracy: { weight: 0.15, target: 90 },
      task_completion: { weight: 0.15, target: 85 },
      memory_recall: { weight: 0.10, target: 80 },
      code_quality: { weight: 0.10, target: 85 },
      error_recovery: { weight: 0.08, target: 75 },
      security: { weight: 0.08, target: 95 },
      resource_efficiency: { weight: 0.06, target: 80 },
      extensibility: { weight: 0.05, target: 75 },
      maintainability: { weight: 0.05, target: 80 },
      documentation: { weight: 0.04, target: 85 },
      test_coverage: { weight: 0.04, target: 80 },
    };
    return configs[dimension];
  }

  /**
   * 获取配置 hash
   */
  private getConfigHash(): string {
    try {
      const configPath = join(this.workspaceRoot, 'openclaw.json');
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8');
        return require('crypto').createHash('md5').update(content).digest('hex').slice(0, 8);
      }
    } catch {}
    return 'unknown';
  }

  /**
   * 获取系统版本
   */
  private getSystemVersion(): string {
    try {
      const packagePath = join(this.workspaceRoot, 'package.json');
      if (existsSync(packagePath)) {
        const content = readFileSync(packagePath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.version || '0.0.0';
      }
    } catch {}
    return '0.0.0';
  }

  /**
   * 快速检查（仅检测变更，不运行完整测试）
   */
  quickCheck(): { hasChanges: boolean; changes: string[] } {
    const changes = this.changeDetector.detectChanges();
    return {
      hasChanges: changes.length > 0,
      changes: changes.map(c => c.description),
    };
  }

  /**
   * 获取历史趋势
   */
  getTrend(dimension: CapabilityDimension, days: number = 30) {
    return this.reportGenerator.getTrendData(dimension, days);
  }

  /**
   * 获取最新报告
   */
  getLatestReport(): IntrospectionReport | null {
    try {
      const reportsDir = join(this.dataDir, 'reports');
      const files = require('fs').readdirSync(reportsDir)
        .filter((f: string) => f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length === 0) return null;

      const content = readFileSync(join(reportsDir, files[0]), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 格式化报告摘要（用于控制台输出）
   */
  formatSummary(report: IntrospectionReport): string {
    const lines: string[] = [];

    lines.push('┌──────────────────────────────────────────────────┐');
    lines.push(`│        元灵自省报告 - ${new Date(report.timestamp).toLocaleDateString('zh-CN')}        │`);
    lines.push('├──────────────────────────────────────────────────┤');

    if (report.hasChanges) {
      lines.push('│ 变更内容:');
      for (const change of report.changes.slice(0, 3)) {
        const desc = change.description.slice(0, 40);
        lines.push(`│   • ${desc}${desc.length >= 40 ? '...' : ''}`);
      }
      lines.push('├──────────────────────────────────────────────────┤');
    }

    if (report.improvements.length > 0) {
      lines.push('│ 能力提升:');
      for (const imp of report.improvements.slice(0, 3)) {
        const config = this.getDimensionConfig(imp.dimension);
        const name = this.getDimensionName(imp.dimension);
        lines.push(`│   ✅ ${name}: ${imp.previousScore?.toFixed(0)}% → ${imp.score.toFixed(0)}% (+${imp.change?.toFixed(0)}%)`);
      }
      lines.push('├──────────────────────────────────────────────────┤');
    }

    if (report.shortfalls.length > 0) {
      lines.push('│ 待优化项:');
      for (const shortfall of report.shortfalls.slice(0, 3)) {
        const name = this.getDimensionName(shortfall.dimension);
        const emoji = shortfall.priority === 'critical' ? '🔴' : shortfall.priority === 'high' ? '🟠' : '🟡';
        lines.push(`│   ${emoji} ${name}: ${shortfall.currentScore.toFixed(0)}% (目标: ${shortfall.targetScore}%)`);
      }
      lines.push('├──────────────────────────────────────────────────┤');
    }

    const changeStr = report.overallChange > 0 ? `+${report.overallChange.toFixed(1)}` : report.overallChange.toFixed(1);
    lines.push(`│ 综合评分: ${report.currentSnapshot.overallScore.toFixed(1)} (${changeStr})`);
    lines.push('└──────────────────────────────────────────────────┘');

    return lines.join('\n');
  }

  /**
   * 获取可视化报告路径
   */
  getVisualizationPath(): string {
    return join(this.dataDir, 'visualization');
  }

  /**
   * 生成 ASCII 雷达图（用于控制台）
   */
  formatASCIIRadar(scores: DimensionScore[]): string {
    return this.visualizationPanel.generateASCIIRadar(scores);
  }

  /**
   * 生成 ASCII 趋势图（用于控制台）
   */
  formatASCIITrend(dimension: CapabilityDimension, days: number = 30): string {
    const trend = this.getTrend(dimension, days);
    if (!trend) return '无历史数据';
    return this.visualizationPanel.generateASCIITrend(trend.data);
  }

  /**
   * 获取维度名称
   */
  private getDimensionName(dimension: CapabilityDimension): string {
    const names: Record<CapabilityDimension, string> = {
      response_speed: '响应速度',
      understanding_accuracy: '理解准确率',
      task_completion: '任务完成率',
      memory_recall: '记忆召回率',
      code_quality: '代码质量',
      error_recovery: '错误恢复率',
      security: '安全防护',
      resource_efficiency: '资源效率',
      extensibility: '可扩展性',
      maintainability: '可维护性',
      documentation: '文档完善度',
      test_coverage: '测试覆盖率',
    };
    return names[dimension];
  }
}

// 导出所有类型和组件
export * from './types';
export * from './change-detector';
export * from './benchmark-runner';
export * from './report-generator';
