import type { Failure, Compensation } from "../types";

/**
 * 观测面板
 * 对应：OpenClaw 的 status 命令
 */
export class ObservabilityPanel {
  private failures: Failure[] = [];
  private compensations: Compensation[] = [];

  /**
   * 更新失败记录
   */
  updateFailures(failures: Failure[]): void {
    this.failures = failures;
  }

  /**
   * 更新补偿组件
   */
  updateCompensations(compensations: Compensation[]): void {
    this.compensations = compensations;
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    health: "healthy" | "degraded" | "unhealthy";
    failureCount: number;
    activeCompensations: number;
    summary: string;
  } {
    const recentFailures = this.failures.filter(
      f => Date.now() - f.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    const activeCompensations = this.compensations.filter(
      c => c.status === "active"
    );

    let health: "healthy" | "degraded" | "unhealthy";
    if (recentFailures.length === 0) {
      health = "healthy";
    } else if (recentFailures.length < 5) {
      health = "degraded";
    } else {
      health = "unhealthy";
    }

    return {
      health,
      failureCount: recentFailures.length,
      activeCompensations: activeCompensations.length,
      summary: this.generateSummary(health, recentFailures, activeCompensations),
    };
  }

  /**
   * 打印状态
   */
  printStatus(): void {
    const status = this.getStatus();
    console.log("\n╔══════════════════════════════════════╗");
    console.log("║         系统状态                      ║");
    console.log("╠══════════════════════════════════════╣");
    console.log(`║ 健康状态: ${this.padRight(status.health, 26)}║`);
    console.log(`║ 24小时内失败: ${this.padRight(String(status.failureCount), 22)}║`);
    console.log(`║ 活跃补偿组件: ${this.padRight(String(status.activeCompensations), 22)}║`);
    console.log("╠══════════════════════════════════════╣");
    console.log(`║ 摘要: ${this.padRight("", 32)}║`);
    console.log(`║ ${this.padRight(status.summary.substring(0, 36), 36)}║`);
    console.log("╚══════════════════════════════════════╝\n");
  }

  /**
   * 获取详细报告
   */
  getDetailedReport(): string {
    const status = this.getStatus();
    const lines: string[] = [];

    lines.push("# 系统状态报告");
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("## 健康状态");
    lines.push(`- 状态: ${status.health}`);
    lines.push(`- 24小时内失败: ${status.failureCount} 次`);
    lines.push(`- 活跃补偿组件: ${status.activeCompensations} 个`);
    lines.push("");

    if (this.failures.length > 0) {
      lines.push("## 最近失败");
      for (const f of this.failures.slice(-5)) {
        lines.push(`- [${f.severity}] ${f.type}: ${JSON.stringify(f.context).substring(0, 50)}`);
      }
      lines.push("");
    }

    if (this.compensations.length > 0) {
      lines.push("## 补偿组件");
      for (const c of this.compensations) {
        lines.push(`- [${c.status}] ${c.name}: ${c.assumption}`);
      }
    }

    return lines.join("\n");
  }

  private generateSummary(
    health: string,
    failures: Failure[],
    compensations: Compensation[]
  ): string {
    if (health === "healthy") {
      return "系统运行正常";
    }

    const failureTypes = [...new Set(failures.map(f => f.type))];
    if (failureTypes.length === 0) {
      return "系统运行正常";
    }
    return `检测到问题: ${failureTypes.join(", ")}`;
  }

  private padRight(str: string, length: number): string {
    return str.padEnd(length, " ").substring(0, length);
  }
}
