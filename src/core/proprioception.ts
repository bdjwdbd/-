import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

/**
 * 本体感觉：三步唤醒仪式
 * 解决：环境盲区
 * 对应：Harness 的三步唤醒仪式
 */
export class Proprioception {
  /**
   * 三步唤醒仪式
   */
  async wakeUp(): Promise<{
    currentDir: string;
    recentChanges: string[];
    progress: string;
  }> {
    // 第一步：pwd（确认工位）
    const currentDir = await this.pwd();
    
    // 第二步：git log（查看最近变更）
    const recentChanges = await this.gitLog();
    
    // 第三步：progress.txt（读取进度）
    const progress = await this.readProgress();

    return { currentDir, recentChanges, progress };
  }

  /**
   * 第一步：确认当前目录
   */
  private async pwd(): Promise<string> {
    try {
      const { stdout } = await execAsync("pwd");
      return stdout.trim();
    } catch {
      return process.cwd();
    }
  }

  /**
   * 第二步：查看 Git 历史
   */
  private async gitLog(): Promise<string[]> {
    try {
      const { stdout } = await execAsync("git log -5 --oneline 2>/dev/null || echo ''");
      return stdout.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * 第三步：读取进度文件
   */
  private async readProgress(): Promise<string> {
    const progressPath = path.join(process.cwd(), "progress.txt");
    
    try {
      if (fs.existsSync(progressPath)) {
        return fs.readFileSync(progressPath, "utf-8").trim();
      }
    } catch {
      // ignore
    }
    return "";
  }

  /**
   * 写入进度文件
   */
  async writeProgress(content: string): Promise<void> {
    const progressPath = path.join(process.cwd(), "progress.txt");
    fs.writeFileSync(progressPath, content);
  }

  /**
   * 获取环境信息
   */
  async getEnvironment(): Promise<{
    os: string;
    nodeVersion: string;
    cwd: string;
    gitBranch?: string;
    gitStatus?: string;
  }> {
    const env = {
      os: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd(),
      gitBranch: undefined as string | undefined,
      gitStatus: undefined as string | undefined,
    };

    try {
      const { stdout: branch } = await execAsync("git branch --show-current 2>/dev/null");
      env.gitBranch = branch.trim();
    } catch {
      // ignore
    }

    try {
      const { stdout: status } = await execAsync("git status --short 2>/dev/null");
      env.gitStatus = status.trim() || "clean";
    } catch {
      // ignore
    }

    return env;
  }
}
