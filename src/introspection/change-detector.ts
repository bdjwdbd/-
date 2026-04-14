/**
 * 变更检测器
 * 
 * 检测代码、配置、依赖的变更
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  ChangeRecord,
  CapabilityDimension,
} from './types';

export class ChangeDetector {
  private workspaceRoot: string;
  private lastCommitFile: string;
  private lastConfigHashFile: string;

  constructor(workspaceRoot: string, dataDir: string) {
    this.workspaceRoot = workspaceRoot;
    this.lastCommitFile = join(dataDir, 'last-commit.txt');
    this.lastConfigHashFile = join(dataDir, 'last-config-hash.txt');
  }

  /**
   * 检测所有变更
   */
  detectChanges(): ChangeRecord[] {
    const changes: ChangeRecord[] = [];

    // 1. 检测代码变更
    const codeChanges = this.detectCodeChanges();
    if (codeChanges) changes.push(codeChanges);

    // 2. 检测配置变更
    const configChanges = this.detectConfigChanges();
    if (configChanges) changes.push(configChanges);

    // 3. 检测依赖变更
    const depChanges = this.detectDependencyChanges();
    if (depChanges) changes.push(depChanges);

    // 4. 检测文档变更
    const docChanges = this.detectDocumentationChanges();
    if (docChanges) changes.push(docChanges);

    return changes;
  }

  /**
   * 检测代码变更
   */
  private detectCodeChanges(): ChangeRecord | null {
    try {
      // 获取当前 commit
      const currentCommit = execSync('git rev-parse HEAD', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
      }).trim();

      // 获取上次记录的 commit
      let lastCommit = '';
      if (existsSync(this.lastCommitFile)) {
        lastCommit = readFileSync(this.lastCommitFile, 'utf-8').trim();
      }

      // 如果是首次运行或 commit 相同，返回 null
      if (!lastCommit || lastCommit === currentCommit) {
        return null;
      }

      // 获取变更的文件
      const changedFiles = execSync(
        `git diff --name-only ${lastCommit} ${currentCommit}`,
        { cwd: this.workspaceRoot, encoding: 'utf-8' }
      ).trim().split('\n').filter(Boolean);

      // 分类文件
      const codeFiles = changedFiles.filter(f => 
        f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.py')
      );

      if (codeFiles.length === 0) return null;

      // 分析影响范围
      const impact = this.analyzeCodeImpact(codeFiles);

      // 生成描述
      const description = this.generateCodeChangeDescription(lastCommit, currentCommit, codeFiles);

      return {
        id: `code-${currentCommit.slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        type: 'code',
        description,
        files: codeFiles,
        impact,
      };
    } catch (error) {
      // Git 不可用时，返回 null
      return null;
    }
  }

  /**
   * 检测配置变更
   */
  private detectConfigChanges(): ChangeRecord | null {
    const configFiles = [
      'openclaw.json',
      'package.json',
      'tsconfig.json',
      '.env',
      'config.json',
    ];

    const changedConfigs: string[] = [];
    const currentHashes: Record<string, string> = {};

    for (const file of configFiles) {
      const filePath = join(this.workspaceRoot, file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        const hash = createHash('md5').update(content).digest('hex');
        currentHashes[file] = hash;
      }
    }

    // 计算总 hash
    const totalHash = createHash('md5')
      .update(JSON.stringify(currentHashes))
      .digest('hex');

    // 读取上次 hash
    let lastHash = '';
    if (existsSync(this.lastConfigHashFile)) {
      lastHash = readFileSync(this.lastConfigHashFile, 'utf-8').trim();
    }

    if (!lastHash || lastHash === totalHash) {
      return null;
    }

    // 找出具体哪些配置变了
    for (const [file, hash] of Object.entries(currentHashes)) {
      changedConfigs.push(file);
    }

    return {
      id: `config-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'config',
      description: `配置文件变更: ${changedConfigs.join(', ')}`,
      files: changedConfigs,
      impact: ['understanding_accuracy', 'task_completion', 'security'],
    };
  }

  /**
   * 检测依赖变更
   */
  private detectDependencyChanges(): ChangeRecord | null {
    try {
      const packageJsonPath = join(this.workspaceRoot, 'package.json');
      if (!existsSync(packageJsonPath)) return null;

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // 简化：只检查是否有变化（通过 hash）
      const depHash = createHash('md5')
        .update(JSON.stringify(deps))
        .digest('hex');

      const depHashFile = join(this.workspaceRoot, 'memory/introspection/dep-hash.txt');
      let lastDepHash = '';
      if (existsSync(depHashFile)) {
        lastDepHash = readFileSync(depHashFile, 'utf-8').trim();
      }

      if (!lastDepHash || lastDepHash === depHash) {
        return null;
      }

      return {
        id: `dep-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'dependency',
        description: '依赖包变更',
        files: ['package.json'],
        impact: ['extensibility', 'security', 'resource_efficiency'],
      };
    } catch {
      return null;
    }
  }

  /**
   * 检测文档变更
   */
  private detectDocumentationChanges(): ChangeRecord | null {
    const docFiles: string[] = [];
    const docDir = join(this.workspaceRoot, 'docs');
    
    if (!existsSync(docDir)) return null;

    // 检查最近修改的文档
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const checkDir = (dir: string) => {
      const files = readdirSync(dir);
      for (const file of files) {
        const filePath = join(dir, file);
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          checkDir(filePath);
        } else if (file.endsWith('.md') && stat.mtimeMs > oneDayAgo) {
          docFiles.push(relative(this.workspaceRoot, filePath));
        }
      }
    };

    try {
      checkDir(docDir);
    } catch {
      return null;
    }

    if (docFiles.length === 0) return null;

    return {
      id: `doc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'documentation',
      description: `文档更新: ${docFiles.length} 个文件`,
      files: docFiles,
      impact: ['documentation'],
    };
  }

  /**
   * 分析代码变更的影响范围
   */
  private analyzeCodeImpact(files: string[]): CapabilityDimension[] {
    const impact: Set<CapabilityDimension> = new Set();

    for (const file of files) {
      // 根据文件路径判断影响
      if (file.includes('memory') || file.includes('embedding')) {
        impact.add('memory_recall');
      }
      if (file.includes('decision') || file.includes('understanding')) {
        impact.add('understanding_accuracy');
        impact.add('task_completion');
      }
      if (file.includes('security') || file.includes('validator')) {
        impact.add('security');
        impact.add('error_recovery');
      }
      if (file.includes('tool') || file.includes('executor')) {
        impact.add('task_completion');
        impact.add('response_speed');
      }
      if (file.includes('test')) {
        impact.add('test_coverage');
      }
      if (file.includes('perf') || file.includes('cache')) {
        impact.add('response_speed');
        impact.add('resource_efficiency');
      }
    }

    // 默认影响
    if (impact.size === 0) {
      impact.add('maintainability');
      impact.add('code_quality');
    }

    return Array.from(impact);
  }

  /**
   * 生成代码变更描述
   */
  private generateCodeChangeDescription(
    fromCommit: string,
    toCommit: string,
    files: string[]
  ): string {
    try {
      // 获取 commit 消息
      const message = execSync(
        `git log --oneline -1 ${toCommit}`,
        { cwd: this.workspaceRoot, encoding: 'utf-8' }
      ).trim();

      const fileCount = files.length;
      const tsFiles = files.filter(f => f.endsWith('.ts')).length;
      const pyFiles = files.filter(f => f.endsWith('.py')).length;

      let desc = `代码变更: ${message}`;
      if (tsFiles > 0) desc += ` (${tsFiles} TypeScript)`;
      if (pyFiles > 0) desc += ` (${pyFiles} Python)`;

      return desc;
    } catch {
      return `代码变更: ${files.length} 个文件`;
    }
  }

  /**
   * 更新记录（在报告生成后调用）
   */
  updateRecords(): void {
    try {
      const currentCommit = execSync('git rev-parse HEAD', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
      }).trim();

      // 更新 last commit
      const { writeFileSync, mkdirSync } = require('fs');
      const { dirname } = require('path');
      
      mkdirSync(dirname(this.lastCommitFile), { recursive: true });
      writeFileSync(this.lastCommitFile, currentCommit);

      // 更新 config hash
      const configFiles = ['openclaw.json', 'package.json'];
      const hashes: Record<string, string> = {};
      
      for (const file of configFiles) {
        const filePath = join(this.workspaceRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          hashes[file] = createHash('md5').update(content).digest('hex');
        }
      }

      const totalHash = createHash('md5')
        .update(JSON.stringify(hashes))
        .digest('hex');
      
      writeFileSync(this.lastConfigHashFile, totalHash);
    } catch {
      // 忽略错误
    }
  }

  /**
   * 获取当前 commit
   */
  getCurrentCommit(): string | null {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return null;
    }
  }

  /**
   * 获取当前分支
   */
  getCurrentBranch(): string | null {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return null;
    }
  }
}
