/**
 * 棘轮管理器
 * 
 * 借鉴 Darwin Skill 的 Git Ratchet 机制
 * 核心原则：只保留有改进的变更，自动回滚退步
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ==================== 类型定义 ====================

/**
 * 棘轮状态
 */
export interface RatchetState {
  /** 当前最优分数 */
  bestScore: number;
  /** 最优分数对应的 commit hash */
  bestCommit: string;
  /** 历史尝试记录 */
  history: RatchetAttempt[];
  /** 最后更新时间 */
  updatedAt: string;
}

/**
 * 棘轮尝试记录
 */
export interface RatchetAttempt {
  /** 尝试 ID */
  id: string;
  /** 时间戳 */
  timestamp: string;
  /** 变更描述 */
  change: string;
  /** 变更前分数 */
  beforeScore: number;
  /** 变更后分数 */
  afterScore: number;
  /** 结果：keep 或 revert */
  result: "keep" | "revert";
  /** commit hash */
  commitHash: string;
  /** 备注 */
  note?: string;
}

/**
 * 棘轮配置
 */
export interface RatchetConfig {
  /** 是否启用棘轮机制 */
  enabled: boolean;
  /** 最小改进阈值（新分必须比旧分高多少才保留） */
  minImprovement: number;
  /** 最大历史记录数 */
  maxHistory: number;
  /** 是否自动 commit */
  autoCommit: boolean;
  /** 是否自动 revert */
  autoRevert: boolean;
  /** 状态文件路径 */
  stateFile: string;
}

/**
 * 默认配置
 */
export const DEFAULT_RATCHET_CONFIG: RatchetConfig = {
  enabled: true,
  minImprovement: 0.1,
  maxHistory: 100,
  autoCommit: true,
  autoRevert: true,
  stateFile: ".ratchet/state.json",
};

// ==================== 棘轮管理器 ====================

export class RatchetManager {
  private config: RatchetConfig;
  private state: RatchetState;
  private workDir: string;

  constructor(config: Partial<RatchetConfig> = {}, workDir: string = process.cwd()) {
    this.config = { ...DEFAULT_RATCHET_CONFIG, ...config };
    this.workDir = workDir;
    this.state = this.loadState();
  }

  /**
   * 加载状态
   */
  private loadState(): RatchetState {
    const statePath = path.join(this.workDir, this.config.stateFile);
    
    if (fs.existsSync(statePath)) {
      try {
        const content = fs.readFileSync(statePath, "utf-8");
        return JSON.parse(content);
      } catch (e) {
        console.warn("Failed to load ratchet state, using default");
      }
    }

    return {
      bestScore: 0,
      bestCommit: "",
      history: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 保存状态
   */
  private saveState(): void {
    const statePath = path.join(this.workDir, this.config.stateFile);
    const stateDir = path.dirname(statePath);

    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    this.state.updatedAt = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2));
  }

  /**
   * 初始化基线
   */
  initializeBaseline(score: number, description: string = "Initial baseline"): string {
    if (this.config.autoCommit) {
      const commitHash = this.gitCommit(`ratchet: ${description}`);
      this.state.bestScore = score;
      this.state.bestCommit = commitHash;
      this.saveState();
      return commitHash;
    }

    this.state.bestScore = score;
    this.state.bestCommit = "baseline";
    this.saveState();
    return "baseline";
  }

  /**
   * 尝试改进
   * 
   * @param change 变更描述
   * @param newScore 新分数
   * @param applyChange 应用变更的函数
   * @returns 是否保留变更
   */
  async attemptImprovement(
    change: string,
    newScore: number,
    applyChange: () => Promise<void> | void
  ): Promise<{ kept: boolean; reason: string }> {
    if (!this.config.enabled) {
      await applyChange();
      return { kept: true, reason: "Ratchet disabled" };
    }

    const beforeScore = this.state.bestScore;
    const improvement = newScore - beforeScore;

    // 应用变更
    await applyChange();

    // 判断是否改进
    if (newScore > beforeScore + this.config.minImprovement) {
      // 保留变更
      const commitHash = this.config.autoCommit
        ? this.gitCommit(`ratchet: ${change} (+${improvement.toFixed(2)})`)
        : `manual_${Date.now()}`;

      this.recordAttempt({
        id: `attempt_${Date.now()}`,
        timestamp: new Date().toISOString(),
        change,
        beforeScore,
        afterScore: newScore,
        result: "keep",
        commitHash,
        note: `Improvement: +${improvement.toFixed(2)}`,
      });

      this.state.bestScore = newScore;
      this.state.bestCommit = commitHash;
      this.saveState();

      return { kept: true, reason: `Improved by ${improvement.toFixed(2)}` };
    } else {
      // 回滚变更
      if (this.config.autoRevert) {
        this.gitRevert();
      }

      this.recordAttempt({
        id: `attempt_${Date.now()}`,
        timestamp: new Date().toISOString(),
        change,
        beforeScore,
        afterScore: newScore,
        result: "revert",
        commitHash: "",
        note: `No improvement: ${improvement.toFixed(2)} <= ${this.config.minImprovement}`,
      });

      this.saveState();

      return { kept: false, reason: `No improvement (${improvement.toFixed(2)} <= ${this.config.minImprovement})` };
    }
  }

  /**
   * 记录尝试
   */
  private recordAttempt(attempt: RatchetAttempt): void {
    this.state.history.push(attempt);

    // 限制历史记录数
    if (this.state.history.length > this.config.maxHistory) {
      this.state.history = this.state.history.slice(-this.config.maxHistory);
    }
  }

  /**
   * Git commit
   */
  private gitCommit(message: string): string {
    try {
      execSync("git add -A", { cwd: this.workDir, stdio: "pipe" });
      execSync(`git commit -m "${message}"`, { cwd: this.workDir, stdio: "pipe" });
      const hash = execSync("git rev-parse HEAD", { cwd: this.workDir, encoding: "utf-8" }).trim();
      return hash.substring(0, 7);
    } catch (e) {
      console.warn("Git commit failed:", e);
      return `error_${Date.now()}`;
    }
  }

  /**
   * Git revert
   */
  private gitRevert(): void {
    try {
      // 使用 git revert 而不是 reset --hard，保留历史
      execSync("git revert --no-edit HEAD", { cwd: this.workDir, stdio: "pipe" });
    } catch (e) {
      // 如果 revert 失败，尝试 checkout
      try {
        execSync("git checkout HEAD~1 -- .", { cwd: this.workDir, stdio: "pipe" });
      } catch (e2) {
        console.warn("Git revert failed:", e2);
      }
    }
  }

  /**
   * 获取当前最优状态
   */
  getBestState(): { score: number; commit: string } {
    return {
      score: this.state.bestScore,
      commit: this.state.bestCommit,
    };
  }

  /**
   * 获取历史记录
   */
  getHistory(limit: number = 20): RatchetAttempt[] {
    return this.state.history.slice(-limit);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalAttempts: number;
    keptCount: number;
    revertedCount: number;
    keepRate: number;
    averageImprovement: number;
  } {
    const history = this.state.history;
    const keptCount = history.filter(h => h.result === "keep").length;
    const revertedCount = history.filter(h => h.result === "revert").length;
    
    const improvements = history
      .filter(h => h.result === "keep")
      .map(h => h.afterScore - h.beforeScore);
    
    const averageImprovement = improvements.length > 0
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length
      : 0;

    return {
      totalAttempts: history.length,
      keptCount,
      revertedCount,
      keepRate: history.length > 0 ? keptCount / history.length : 0,
      averageImprovement,
    };
  }

  /**
   * 重置到最优状态
   */
  resetToBest(): void {
    if (this.state.bestCommit && this.state.bestCommit !== "baseline") {
      try {
        execSync(`git checkout ${this.state.bestCommit} -- .`, { cwd: this.workDir, stdio: "pipe" });
        console.log(`Reset to best commit: ${this.state.bestCommit}`);
      } catch (e) {
        console.warn("Failed to reset to best commit:", e);
      }
    }
  }

  /**
   * 导出报告
   */
  exportReport(): string {
    const stats = this.getStats();
    const lines: string[] = [
      "# 棘轮机制报告",
      "",
      "## 当前状态",
      `| 指标 | 值 |`,
      `|------|-----|`,
      `| 最优分数 | ${this.state.bestScore.toFixed(2)} |`,
      `| 最优 Commit | ${this.state.bestCommit} |`,
      `| 更新时间 | ${this.state.updatedAt} |`,
      "",
      "## 统计信息",
      `| 指标 | 值 |`,
      `|------|-----|`,
      `| 总尝试次数 | ${stats.totalAttempts} |`,
      `| 保留次数 | ${stats.keptCount} |`,
      `| 回滚次数 | ${stats.revertedCount} |`,
      `| 保留率 | ${(stats.keepRate * 100).toFixed(1)}% |`,
      `| 平均改进 | ${stats.averageImprovement.toFixed(2)} |`,
      "",
      "## 最近尝试",
      `| 时间 | 变更 | 前 | 后 | 结果 |`,
      `|------|------|-----|-----|------|`,
    ];

    for (const attempt of this.getHistory(10)) {
      lines.push(`| ${attempt.timestamp.split("T")[0]} | ${attempt.change.substring(0, 30)} | ${attempt.beforeScore.toFixed(1)} | ${attempt.afterScore.toFixed(1)} | ${attempt.result} |`);
    }

    return lines.join("\n");
  }
}

// 导出单例
export const ratchetManager = new RatchetManager();
