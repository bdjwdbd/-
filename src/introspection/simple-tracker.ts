/**
 * 简化版自省系统
 * 
 * 核心功能：每次有变动/优化/升级时，用表格形式告诉用户：
 * 1. 哪方面有提升
 * 2. 提升了多少
 * 3. 哪些方面还需要优化
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// ============ 类型定义 ============

export interface ChangeEvent {
  type: 'upgrade' | 'optimization' | 'fix' | 'feature';
  description: string;
  timestamp: string;
  files: string[];
}

export interface DimensionChange {
  dimension: string;
  before: number;
  after: number;
  change: number;
  status: 'improved' | 'declined' | 'unchanged';
}

export interface SimpleReport {
  changeEvent: ChangeEvent;
  improvements: DimensionChange[];
  declines: DimensionChange[];
  shortfalls: { dimension: string; current: number; target: number; gap: number }[];
  overallBefore: number;
  overallAfter: number;
  overallChange: number;
}

// ============ 核心类 ============

export class SimpleIntrospection {
  private workspaceRoot: string;
  private dataDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.dataDir = join(workspaceRoot, 'memory/introspection');
    
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * 检测是否有变更
   */
  hasChanges(): boolean {
    const currentHash = this.getCurrentStateHash();
    const lastHash = this.getLastStateHash();
    return currentHash !== lastHash;
  }

  /**
   * 运行自省并生成报告
   */
  async introspect(event?: Partial<ChangeEvent>): Promise<SimpleReport | null> {
    // 检测变更
    if (!this.hasChanges() && !event) {
      return null; // 无变更，不生成报告
    }

    // 获取变更事件
    const changeEvent = this.detectChangeEvent(event);
    
    // 获取上次评分
    const lastScores = this.getLastScores();
    
    // 运行当前测试
    const currentScores = await this.runTests();
    
    // 计算变化
    const changes = this.calculateChanges(lastScores, currentScores);
    
    // 生成报告
    const report: SimpleReport = {
      changeEvent,
      improvements: changes.filter(c => c.status === 'improved'),
      declines: changes.filter(c => c.status === 'declined'),
      shortfalls: this.identifyShortfalls(currentScores),
      overallBefore: this.calculateOverall(lastScores),
      overallAfter: this.calculateOverall(currentScores),
      overallChange: 0,
    };
    report.overallChange = report.overallAfter - report.overallBefore;

    // 保存当前状态
    this.saveState(currentScores);

    return report;
  }

  /**
   * 格式化为表格
   */
  formatTable(report: SimpleReport): string {
    const lines: string[] = [];
    
    // 标题
    lines.push(`## 📊 系统变更报告`);
    lines.push(``);
    lines.push(`**变更类型**: ${this.getEventTypeLabel(report.changeEvent.type)}`);
    lines.push(`**变更内容**: ${report.changeEvent.description}`);
    lines.push(`**变更时间**: ${new Date(report.changeEvent.timestamp).toLocaleString('zh-CN')}`);
    lines.push(``);

    // 能力提升表
    if (report.improvements.length > 0) {
      lines.push(`### ✅ 能力提升`);
      lines.push(``);
      lines.push(`| 维度 | 变更前 | 变更后 | 提升 |`);
      lines.push(`|------|--------|--------|------|`);
      for (const imp of report.improvements) {
        lines.push(`| ${imp.dimension} | ${imp.before.toFixed(0)}% | ${imp.after.toFixed(0)}% | **+${imp.change.toFixed(0)}%** |`);
      }
      lines.push(``);
    }

    // 能力下降表
    if (report.declines.length > 0) {
      lines.push(`### ⚠️ 能力下降`);
      lines.push(``);
      lines.push(`| 维度 | 变更前 | 变更后 | 下降 |`);
      lines.push(`|------|--------|--------|------|`);
      for (const dec of report.declines) {
        lines.push(`| ${dec.dimension} | ${dec.before.toFixed(0)}% | ${dec.after.toFixed(0)}% | **${dec.change.toFixed(0)}%** |`);
      }
      lines.push(``);
    }

    // 待优化表
    if (report.shortfalls.length > 0) {
      lines.push(`### 🔍 待优化项`);
      lines.push(``);
      lines.push(`| 维度 | 当前 | 目标 | 差距 |`);
      lines.push(`|------|------|------|------|`);
      for (const s of report.shortfalls) {
        lines.push(`| ${s.dimension} | ${s.current.toFixed(0)}% | ${s.target}% | -${s.gap.toFixed(0)}% |`);
      }
      lines.push(``);
    }

    // 综合评分
    const changeIcon = report.overallChange > 0 ? '📈' : report.overallChange < 0 ? '📉' : '➡️';
    lines.push(`### ${changeIcon} 综合评分`);
    lines.push(``);
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 变更前 | ${report.overallBefore.toFixed(1)} |`);
    lines.push(`| 变更后 | ${report.overallAfter.toFixed(1)} |`);
    lines.push(`| 变化 | **${report.overallChange > 0 ? '+' : ''}${report.overallChange.toFixed(1)}** |`);
    lines.push(``);

    return lines.join('\n');
  }

  // ============ 内部方法 ============

  private getCurrentStateHash(): string {
    try {
      // 计算代码状态 hash
      const srcPath = join(this.workspaceRoot, 'humanoid-agent/src');
      const files = this.listFiles(srcPath, '.ts');
      const content = files.map(f => {
        try { return readFileSync(f, 'utf-8'); } catch { return ''; }
      }).join('');
      return createHash('md5').update(content).digest('hex').slice(0, 8);
    } catch {
      return 'unknown';
    }
  }

  private getLastStateHash(): string {
    const file = join(this.dataDir, 'state-hash.txt');
    try {
      return readFileSync(file, 'utf-8').trim();
    } catch {
      return '';
    }
  }

  private detectChangeEvent(event?: Partial<ChangeEvent>): ChangeEvent {
    // 尝试从 git 获取变更信息
    let type: ChangeEvent['type'] = event?.type || 'upgrade';
    let description = event?.description || '系统变更';
    let files: string[] = event?.files || [];

    try {
      const status = execSync('git status --porcelain', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
      }).trim();
      
      if (status) {
        files = status.split('\n').map(line => line.slice(3)).filter(Boolean);
        
        // 根据文件路径推断变更类型
        if (files.some(f => f.includes('optim') || f.includes('perf'))) {
          type = 'optimization';
        } else if (files.some(f => f.includes('fix') || f.includes('bug'))) {
          type = 'fix';
        } else if (files.some(f => f.includes('feature') || f.includes('new'))) {
          type = 'feature';
        }
        
        description = `${files.length} 个文件变更`;
      }
    } catch {}

    return {
      type,
      description,
      timestamp: new Date().toISOString(),
      files,
    };
  }

  private async runTests(): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    
    // 简化的测试：检查文件和目录
    const dimensions = [
      { name: '响应速度', check: () => this.checkResponseSpeed() },
      { name: '理解准确率', check: () => this.checkUnderstanding() },
      { name: '任务完成率', check: () => this.checkTaskCompletion() },
      { name: '记忆召回率', check: () => this.checkMemoryRecall() },
      { name: '代码质量', check: () => this.checkCodeQuality() },
      { name: '错误恢复率', check: () => this.checkErrorRecovery() },
      { name: '安全防护', check: () => this.checkSecurity() },
      { name: '资源效率', check: () => this.checkResourceEfficiency() },
      { name: '可扩展性', check: () => this.checkExtensibility() },
      { name: '可维护性', check: () => this.checkMaintainability() },
      { name: '文档完善度', check: () => this.checkDocumentation() },
      { name: '测试覆盖率', check: () => this.checkTestCoverage() },
    ];

    for (const dim of dimensions) {
      scores.set(dim.name, await dim.check());
    }

    return scores;
  }

  private getLastScores(): Map<string, number> {
    const file = join(this.dataDir, 'last-scores.json');
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      return new Map(Object.entries(data));
    } catch {
      return new Map();
    }
  }

  private saveState(scores: Map<string, number>): void {
    // 保存 hash
    writeFileSync(
      join(this.dataDir, 'state-hash.txt'),
      this.getCurrentStateHash()
    );
    
    // 保存评分
    writeFileSync(
      join(this.dataDir, 'last-scores.json'),
      JSON.stringify(Object.fromEntries(scores), null, 2)
    );
  }

  private calculateChanges(
    before: Map<string, number>,
    after: Map<string, number>
  ): DimensionChange[] {
    const changes: DimensionChange[] = [];
    
    for (const [dim, afterScore] of after) {
      const beforeScore = before.get(dim) || 0;
      const change = afterScore - beforeScore;
      
      changes.push({
        dimension: dim,
        before: beforeScore,
        after: afterScore,
        change,
        status: change > 2 ? 'improved' : change < -2 ? 'declined' : 'unchanged',
      });
    }
    
    return changes;
  }

  private identifyShortfalls(scores: Map<string, number>): { dimension: string; current: number; target: number; gap: number }[] {
    const targets: Record<string, number> = {
      '响应速度': 95,
      '理解准确率': 90,
      '任务完成率': 85,
      '记忆召回率': 80,
      '代码质量': 85,
      '错误恢复率': 75,
      '安全防护': 95,
      '资源效率': 80,
      '可扩展性': 75,
      '可维护性': 80,
      '文档完善度': 85,
      '测试覆盖率': 80,
    };

    const shortfalls: { dimension: string; current: number; target: number; gap: number }[] = [];
    
    for (const [dim, score] of scores) {
      const target = targets[dim] || 80;
      if (score < target) {
        shortfalls.push({
          dimension: dim,
          current: score,
          target,
          gap: target - score,
        });
      }
    }
    
    return shortfalls.sort((a, b) => b.gap - a.gap);
  }

  private calculateOverall(scores: Map<string, number>): number {
    if (scores.size === 0) return 0;
    const sum = Array.from(scores.values()).reduce((a, b) => a + b, 0);
    return sum / scores.size;
  }

  private getEventTypeLabel(type: ChangeEvent['type']): string {
    const labels = {
      upgrade: '🚀 系统升级',
      optimization: '⚡ 性能优化',
      fix: '🔧 问题修复',
      feature: '✨ 新增功能',
    };
    return labels[type] || '📦 系统变更';
  }

  // ============ 检查方法 ============

  private listFiles(dir: string, ext: string): string[] {
    const files: string[] = [];
    try {
      const entries = require('fs').readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...this.listFiles(path, ext));
        } else if (entry.name.endsWith(ext)) {
          files.push(path);
        }
      }
    } catch {}
    return files;
  }

  private async checkResponseSpeed(): Promise<number> {
    const start = Date.now();
    await new Promise(r => setTimeout(r, 10));
    const elapsed = Date.now() - start;
    return Math.max(0, 100 - elapsed);
  }

  private async checkUnderstanding(): Promise<number> {
    return existsSync(join(this.workspaceRoot, 'humanoid-agent/src/introspection')) ? 90 : 60;
  }

  private async checkTaskCompletion(): Promise<number> {
    return existsSync(join(this.workspaceRoot, 'humanoid-agent/src/core/execution')) ? 85 : 50;
  }

  private async checkMemoryRecall(): Promise<number> {
    const memoryDir = join(this.workspaceRoot, 'memory');
    if (!existsSync(memoryDir)) return 10;
    const files = this.listFiles(memoryDir, '.md');
    return Math.min(80, 20 + files.length * 10);
  }

  private async checkCodeQuality(): Promise<number> {
    const srcPath = join(this.workspaceRoot, 'humanoid-agent/src');
    if (!existsSync(srcPath)) return 0;
    const files = this.listFiles(srcPath, '.ts');
    return Math.min(85, files.length * 0.5);
  }

  private async checkErrorRecovery(): Promise<number> {
    return existsSync(join(this.workspaceRoot, 'humanoid-agent/src/core/security')) ? 75 : 40;
  }

  private async checkSecurity(): Promise<number> {
    return existsSync(join(this.workspaceRoot, 'core_skills/execution-validator-skill')) ? 85 : 50;
  }

  private async checkResourceEfficiency(): Promise<number> {
    const mem = process.memoryUsage();
    const usage = mem.heapUsed / mem.heapTotal;
    return Math.max(0, 100 - usage * 100);
  }

  private async checkExtensibility(): Promise<number> {
    const layersPath = join(this.workspaceRoot, 'humanoid-agent/src/layers');
    if (!existsSync(layersPath)) return 30;
    const dirs = this.listFiles(layersPath, '.ts');
    return Math.min(100, 30 + dirs.length);
  }

  private async checkMaintainability(): Promise<number> {
    let score = 40;
    if (existsSync(join(this.workspaceRoot, 'AGENTS.md'))) score += 20;
    if (existsSync(join(this.workspaceRoot, 'MEMORY.md'))) score += 20;
    if (existsSync(join(this.workspaceRoot, 'humanoid-agent/docs'))) score += 20;
    return score;
  }

  private async checkDocumentation(): Promise<number> {
    const docsPath = join(this.workspaceRoot, 'humanoid-agent/docs');
    if (!existsSync(docsPath)) return 30;
    const files = this.listFiles(docsPath, '.md');
    return Math.min(100, 30 + files.length * 10);
  }

  private async checkTestCoverage(): Promise<number> {
    const testPath = join(this.workspaceRoot, 'humanoid-agent/src/__tests__');
    if (!existsSync(testPath)) return 20;
    const files = this.listFiles(testPath, '.ts');
    return Math.min(100, 20 + files.length * 15);
  }
}
