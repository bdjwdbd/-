import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

/**
 * Git 存档系统
 * 解决：失忆实习生综合征
 * 对应：Harness 的 Git 存档与回滚
 */
export class GitArchive {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  /**
   * 存档：Git commit
   */
  async archive(message: string): Promise<string> {
    try {
      await execAsync("git add -A", { cwd: this.repoPath });
      const { stdout } = await execAsync(
        `git commit -m "${message}" --allow-empty`,
        { cwd: this.repoPath }
      );
      const match = stdout.match(/\[.* ([a-f0-9]+)\]/);
      return match ? match[1] : "";
    } catch (error) {
      // 可能没有变更
      return "";
    }
  }

  /**
   * 回滚：Git reset
   */
  async rollback(commitHash: string): Promise<void> {
    await execAsync(`git reset --hard ${commitHash}`, { cwd: this.repoPath });
  }

  /**
   * 软回滚：保留工作区变更
   */
  async softRollback(commitHash: string): Promise<void> {
    await execAsync(`git reset --soft ${commitHash}`, { cwd: this.repoPath });
  }

  /**
   * 获取当前 commit hash
   */
  async getCurrentHash(): Promise<string> {
    try {
      const { stdout } = await execAsync("git rev-parse HEAD", { cwd: this.repoPath });
      return stdout.trim();
    } catch {
      return "";
    }
  }

  /**
   * 生成交接单
   */
  async generateHandoff(): Promise<string> {
    // 收集当前状态
    const currentDir = process.cwd();
    const gitStatus = await this.getGitStatus();
    const recentCommits = await this.getRecentCommits();
    const currentHash = await this.getCurrentHash();

    const handoff = `# 交接单
生成时间: ${new Date().toISOString()}

## 当前目录
${currentDir}

## 当前 Commit
${currentHash}

## Git 状态
${gitStatus}

## 最近提交
${recentCommits.join("\n")}

## 下一步建议
- 检查未提交的变更
- 确认当前分支
- 查看最近的修改
`;

    // 保存交接单
    const handoffPath = path.join(currentDir, "handoff.md");
    fs.writeFileSync(handoffPath, handoff);

    return handoff;
  }

  /**
   * 获取 Git 状态
   */
  private async getGitStatus(): Promise<string> {
    try {
      const { stdout } = await execAsync("git status --short", { cwd: this.repoPath });
      return stdout.trim() || "工作区干净";
    } catch {
      return "无法获取状态";
    }
  }

  /**
   * 获取最近提交
   */
  private async getRecentCommits(): Promise<string[]> {
    try {
      const { stdout } = await execAsync("git log -5 --oneline", { cwd: this.repoPath });
      return stdout.trim().split("\n");
    } catch {
      return [];
    }
  }

  /**
   * 创建分支存档
   */
  async createArchiveBranch(branchName: string): Promise<void> {
    await execAsync(`git branch ${branchName}`, { cwd: this.repoPath });
  }

  /**
   * 列出所有存档分支
   */
  async listArchiveBranches(): Promise<string[]> {
    try {
      const { stdout } = await execAsync("git branch", { cwd: this.repoPath });
      return stdout.trim().split("\n").map(b => b.trim().replace("* ", ""));
    } catch {
      return [];
    }
  }
}
