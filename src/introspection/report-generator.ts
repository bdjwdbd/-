/**
 * 报告生成器
 * 
 * 生成自省报告，包括变更分析、能力对比、短板识别
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  IntrospectionReport,
  SystemSnapshot,
  DimensionScore,
  Shortfall,
  Recommendation,
  ChangeRecord,
  DIMENSION_CONFIGS,
  CapabilityDimension,
  TrendData,
} from './types';

export class ReportGenerator {
  private dataDir: string;
  private reportsDir: string;
  private historyDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.reportsDir = join(dataDir, 'reports');
    this.historyDir = join(dataDir, 'history');
    
    // 确保目录存在
    mkdirSync(this.reportsDir, { recursive: true });
    mkdirSync(this.historyDir, { recursive: true });
  }

  /**
   * 生成完整报告
   */
  generateReport(
    changes: ChangeRecord[],
    currentSnapshot: SystemSnapshot,
    previousSnapshot?: SystemSnapshot,
    trigger: 'startup' | 'manual' | 'scheduled' = 'manual'
  ): IntrospectionReport {
    // 分析提升和退步
    const { improvements, regressions, unchanged } = this.analyzeChanges(
      currentSnapshot.scores,
      previousSnapshot?.scores
    );

    // 识别短板
    const shortfalls = this.identifyShortfalls(currentSnapshot.scores);

    // 生成建议
    const recommendations = this.generateRecommendations(shortfalls, improvements);

    // 计算综合变化
    const overallChange = previousSnapshot
      ? currentSnapshot.overallScore - previousSnapshot.overallScore
      : 0;

    const report: IntrospectionReport = {
      id: `report-${Date.now()}`,
      timestamp: new Date().toISOString(),
      trigger,
      changes,
      hasChanges: changes.length > 0,
      currentSnapshot,
      previousSnapshot,
      improvements,
      regressions,
      unchanged,
      shortfalls,
      overallChange,
      recommendations,
    };

    return report;
  }

  /**
   * 分析维度变化
   */
  private analyzeChanges(
    currentScores: DimensionScore[],
    previousScores?: DimensionScore[]
  ): {
    improvements: DimensionScore[];
    regressions: DimensionScore[];
    unchanged: DimensionScore[];
  } {
    const improvements: DimensionScore[] = [];
    const regressions: DimensionScore[] = [];
    const unchanged: DimensionScore[] = [];

    if (!previousScores) {
      return { improvements: [], regressions: [], unchanged: currentScores };
    }

    const prevMap = new Map(previousScores.map(s => [s.dimension, s]));

    for (const current of currentScores) {
      const previous = prevMap.get(current.dimension);
      
      if (previous) {
        const change = current.score - previous.score;
        const scoreWithChange: DimensionScore = {
          ...current,
          previousScore: previous.score,
          change,
        };

        if (change > 5) {
          improvements.push(scoreWithChange);
        } else if (change < -5) {
          regressions.push(scoreWithChange);
        } else {
          unchanged.push(scoreWithChange);
        }
      } else {
        unchanged.push(current);
      }
    }

    return { improvements, regressions, unchanged };
  }

  /**
   * 识别短板
   */
  private identifyShortfalls(scores: DimensionScore[]): Shortfall[] {
    const shortfalls: Shortfall[] = [];

    for (const score of scores) {
      const config = DIMENSION_CONFIGS[score.dimension];
      const gap = config.target - score.score;

      if (gap > 0) {
        let priority: 'critical' | 'high' | 'medium' | 'low';
        if (gap > 30) priority = 'critical';
        else if (gap > 20) priority = 'high';
        else if (gap > 10) priority = 'medium';
        else priority = 'low';

        shortfalls.push({
          dimension: score.dimension,
          currentScore: score.score,
          targetScore: config.target,
          gap,
          priority,
          suggestion: this.generateSuggestion(score.dimension, gap),
        });
      }
    }

    // 按优先级排序
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    shortfalls.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return shortfalls;
  }

  /**
   * 生成优化建议
   */
  private generateSuggestion(dimension: CapabilityDimension, gap: number): string {
    const suggestions: Record<CapabilityDimension, string> = {
      response_speed: '优化缓存策略，减少不必要的计算',
      understanding_accuracy: '增加训练数据，改进意图识别模型',
      task_completion: '完善工具调用逻辑，增加错误处理',
      memory_recall: '优化向量索引，增加记忆条目',
      code_quality: '减少 any 类型使用，增加类型定义',
      error_recovery: '实现检查点机制，增加自动恢复逻辑',
      security: '增强输入验证，完善权限检查',
      resource_efficiency: '优化内存使用，实现懒加载',
      extensibility: '模块化重构，定义清晰的接口',
      maintainability: '完善文档，增加代码注释',
      documentation: '补充 API 文档，增加使用示例',
      test_coverage: '增加单元测试，提高覆盖率',
    };

    return suggestions[dimension] || '需要进一步分析';
  }

  /**
   * 生成推荐列表
   */
  private generateRecommendations(
    shortfalls: Shortfall[],
    improvements: DimensionScore[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 基于短板生成建议
    for (const shortfall of shortfalls.slice(0, 5)) {
      const config = DIMENSION_CONFIGS[shortfall.dimension];
      
      let effort: 'small' | 'medium' | 'large';
      if (shortfall.gap > 30) effort = 'large';
      else if (shortfall.gap > 15) effort = 'medium';
      else effort = 'small';

      recommendations.push({
        id: `rec-${shortfall.dimension}`,
        dimension: shortfall.dimension,
        priority: shortfall.priority,
        title: `提升${config.name}`,
        description: shortfall.suggestion,
        effort,
        impact: shortfall.gap * config.weight,
      });
    }

    // 按影响力排序
    recommendations.sort((a, b) => b.impact - a.impact);

    return recommendations;
  }

  /**
   * 保存报告
   */
  saveReport(report: IntrospectionReport): string {
    const filename = `report-${new Date().toISOString().split('T')[0]}-${report.id.split('-')[1]}.md`;
    const filepath = join(this.reportsDir, filename);

    const content = this.formatReportMarkdown(report);
    writeFileSync(filepath, content, 'utf-8');

    // 同时保存 JSON
    const jsonPath = filepath.replace('.md', '.json');
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    return filepath;
  }

  /**
   * 格式化为 Markdown
   */
  formatReportMarkdown(report: IntrospectionReport): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# 元灵自省报告`);
    lines.push(``);
    lines.push(`**生成时间**: ${new Date(report.timestamp).toLocaleString('zh-CN')}`);
    lines.push(`**触发方式**: ${report.trigger === 'startup' ? '启动检测' : report.trigger === 'manual' ? '手动触发' : '定时任务'}`);
    lines.push(`**综合评分**: ${report.currentSnapshot.overallScore.toFixed(1)}${report.overallChange !== 0 ? ` (${report.overallChange > 0 ? '+' : ''}${report.overallChange.toFixed(1)})` : ''}`);
    lines.push(``);

    // 变更信息
    if (report.hasChanges) {
      lines.push(`## 📝 变更记录`);
      lines.push(``);
      for (const change of report.changes) {
        lines.push(`- **${change.type === 'code' ? '代码' : change.type === 'config' ? '配置' : change.type === 'dependency' ? '依赖' : '文档'}**: ${change.description}`);
      }
      lines.push(``);
    }

    // 能力提升
    if (report.improvements.length > 0) {
      lines.push(`## ✅ 能力提升`);
      lines.push(``);
      lines.push(`| 维度 | 变化 | 详情 |`);
      lines.push(`|------|------|------|`);
      for (const imp of report.improvements) {
        const config = DIMENSION_CONFIGS[imp.dimension];
        lines.push(`| ${config.name} | ${imp.previousScore?.toFixed(1)} → ${imp.score.toFixed(1)} (+${imp.change?.toFixed(1)}) | ${imp.details} |`);
      }
      lines.push(``);
    }

    // 能力退步
    if (report.regressions.length > 0) {
      lines.push(`## ⚠️ 能力退步`);
      lines.push(``);
      lines.push(`| 维度 | 变化 | 详情 |`);
      lines.push(`|------|------|------|`);
      for (const reg of report.regressions) {
        const config = DIMENSION_CONFIGS[reg.dimension];
        lines.push(`| ${config.name} | ${reg.previousScore?.toFixed(1)} → ${reg.score.toFixed(1)} (${reg.change?.toFixed(1)}) | ${reg.details} |`);
      }
      lines.push(``);
    }

    // 短板识别
    if (report.shortfalls.length > 0) {
      lines.push(`## 🔍 待优化项`);
      lines.push(``);
      lines.push(`| 维度 | 当前 | 目标 | 差距 | 优先级 | 建议 |`);
      lines.push(`|------|------|------|------|--------|------|`);
      for (const shortfall of report.shortfalls) {
        const config = DIMENSION_CONFIGS[shortfall.dimension];
        const priorityEmoji = shortfall.priority === 'critical' ? '🔴' : shortfall.priority === 'high' ? '🟠' : shortfall.priority === 'medium' ? '🟡' : '🟢';
        lines.push(`| ${config.name} | ${shortfall.currentScore.toFixed(1)} | ${shortfall.targetScore} | -${shortfall.gap.toFixed(1)} | ${priorityEmoji} ${shortfall.priority} | ${shortfall.suggestion} |`);
      }
      lines.push(``);
    }

    // 优化建议
    if (report.recommendations.length > 0) {
      lines.push(`## 💡 优化建议`);
      lines.push(``);
      for (let i = 0; i < report.recommendations.length; i++) {
        const rec = report.recommendations[i];
        const config = DIMENSION_CONFIGS[rec.dimension];
        lines.push(`${i + 1}. **${rec.title}** (${rec.effort === 'small' ? '小' : rec.effort === 'medium' ? '中' : '大'}工作量)`);
        lines.push(`   - ${rec.description}`);
        lines.push(`   - 预期提升: +${rec.impact.toFixed(1)}`);
      }
      lines.push(``);
    }

    // 完整评分
    lines.push(`## 📊 完整评分`);
    lines.push(``);
    lines.push(`| 维度 | 评分 | 权重 | 加权分 | 详情 |`);
    lines.push(`|------|------|------|--------|------|`);
    for (const score of report.currentSnapshot.scores) {
      const config = DIMENSION_CONFIGS[score.dimension];
      const weighted = score.score * config.weight;
      lines.push(`| ${config.name} | ${score.score.toFixed(1)} | ${(config.weight * 100).toFixed(0)}% | ${weighted.toFixed(2)} | ${score.details} |`);
    }
    lines.push(``);
    lines.push(`**综合评分**: ${report.currentSnapshot.overallScore.toFixed(2)}`);
    lines.push(``);

    return lines.join('\n');
  }

  /**
   * 保存历史数据
   */
  saveHistory(snapshot: SystemSnapshot): void {
    const filename = `${new Date().toISOString().split('T')[0]}.json`;
    const filepath = join(this.historyDir, filename);
    writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  /**
   * 加载最近的历史数据（排除今天）
   */
  loadLatestHistory(): SystemSnapshot | null {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const files = readdirSync(this.historyDir)
        .filter(f => f.endsWith('.json') && !f.startsWith(today))
        .sort()
        .reverse();

      if (files.length === 0) return null;

      const latest = files[0];
      const content = readFileSync(join(this.historyDir, latest), 'utf-8');
      return JSON.parse(content) as SystemSnapshot;
    } catch {
      return null;
    }
  }

  /**
   * 获取趋势数据
   */
  getTrendData(dimension: CapabilityDimension, days: number = 30): TrendData | null {
    try {
      const files = readdirSync(this.historyDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, days);

      if (files.length === 0) return null;

      const data: { timestamp: string; score: number }[] = [];

      for (const file of files) {
        const content = readFileSync(join(this.historyDir, file), 'utf-8');
        const snapshot = JSON.parse(content) as SystemSnapshot;
        const score = snapshot.scores.find(s => s.dimension === dimension);
        if (score) {
          data.push({ timestamp: snapshot.timestamp, score: score.score });
        }
      }

      // 计算趋势
      if (data.length < 2) {
        return { dimension, data, trend: 'stable', changeRate: 0 };
      }

      const firstScore = data[data.length - 1].score;
      const lastScore = data[0].score;
      const changeRate = ((lastScore - firstScore) / firstScore) * 100;

      let trend: 'improving' | 'declining' | 'stable';
      if (changeRate > 5) trend = 'improving';
      else if (changeRate < -5) trend = 'declining';
      else trend = 'stable';

      return { dimension, data, trend, changeRate };
    } catch {
      return null;
    }
  }
}

// 需要导入 readdirSync
import { readdirSync } from 'fs';
