/**
 * 断点续传系统
 * 
 * 功能：
 * 1. 任务状态持久化
 * 2. 执行进度检查点
 * 3. 故障恢复机制
 * 4. 交接单生成
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface Checkpoint {
  id: string;
  sessionId: string;
  timestamp: number;
  status: "running" | "paused" | "completed" | "failed";
  progress: number; // 0-100
  currentStep: string;
  completedSteps: string[];
  pendingSteps: string[];
  context: Record<string, unknown>;
  variables: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    step: string;
    timestamp: number;
  };
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: string;
    model?: string;
    totalTokens?: number;
  };
}

interface HandoverDocument {
  sessionId: string;
  createdAt: string;
  goal: string;
  summary: string;
  completedWork: Array<{
    step: string;
    result: string;
    timestamp: number;
  }>;
  pendingWork: Array<{
    step: string;
    priority: "high" | "medium" | "low";
    dependencies: string[];
  }>;
  keyFindings: string[];
  warnings: string[];
  recommendations: string[];
  context: {
    variables: Record<string, unknown>;
    files: string[];
    lastCheckpoint: string;
  };
}

interface RecoveryPlan {
  canRecover: boolean;
  fromCheckpoint: string;
  steps: Array<{
    action: "restore" | "retry" | "skip" | "abort";
    step: string;
    reason: string;
  }>;
  estimatedTime: number;
  riskLevel: "low" | "medium" | "high";
}

interface CheckpointConfig {
  checkpointDir: string;
  autoSaveInterval: number; // ms
  maxCheckpoints: number;
  compressionEnabled: boolean;
}

// ============================================================
// 检查点管理器
// ============================================================

export class CheckpointManager {
  private config: CheckpointConfig;
  private currentCheckpoint: Checkpoint | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private checkpoints: Map<string, Checkpoint> = new Map();
  
  constructor(config?: Partial<CheckpointConfig>) {
    this.config = {
      checkpointDir: "./checkpoints",
      autoSaveInterval: 60000, // 1 分钟
      maxCheckpoints: 10,
      compressionEnabled: false,
      ...config,
    };
    
    this.ensureDir(this.config.checkpointDir);
    this.loadExistingCheckpoints();
  }
  
  /**
   * 创建新检查点
   */
  create(sessionId: string, goal: string): Checkpoint {
    const checkpoint: Checkpoint = {
      id: this.generateId(),
      sessionId,
      timestamp: Date.now(),
      status: "running",
      progress: 0,
      currentStep: "init",
      completedSteps: [],
      pendingSteps: [],
      context: { goal },
      variables: {},
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: "1.0",
      },
    };
    
    this.currentCheckpoint = checkpoint;
    this.checkpoints.set(checkpoint.id, checkpoint);
    this.saveCheckpoint(checkpoint);
    
    return checkpoint;
  }
  
  /**
   * 更新当前检查点
   */
  update(updates: Partial<Checkpoint>): Checkpoint | null {
    if (!this.currentCheckpoint) {
      return null;
    }
    
    this.currentCheckpoint = {
      ...this.currentCheckpoint,
      ...updates,
      metadata: {
        ...this.currentCheckpoint.metadata,
        updatedAt: Date.now(),
      },
    };
    
    this.checkpoints.set(this.currentCheckpoint.id, this.currentCheckpoint);
    return this.currentCheckpoint;
  }
  
  /**
   * 记录步骤完成
   */
  completeStep(step: string, result?: any): void {
    if (!this.currentCheckpoint) return;
    
    const completedSteps = [...this.currentCheckpoint.completedSteps, step];
    const pendingSteps = this.currentCheckpoint.pendingSteps.filter(s => s !== step);
    const progress = this.calculateProgress(completedSteps, pendingSteps);
    
    this.update({
      completedSteps,
      pendingSteps,
      progress,
      currentStep: pendingSteps[0] || "done",
      context: {
        ...this.currentCheckpoint.context,
        [`step_${step}_result`]: result,
      },
    });
    
    this.saveCheckpoint(this.currentCheckpoint!);
  }
  
  /**
   * 记录错误
   */
  recordError(error: Error, step: string): void {
    if (!this.currentCheckpoint) return;
    
    this.update({
      status: "failed",
      error: {
        message: error.message,
        stack: error.stack,
        step,
        timestamp: Date.now(),
      },
    });
    
    this.saveCheckpoint(this.currentCheckpoint!);
  }
  
  /**
   * 暂停任务
   */
  pause(): Checkpoint | null {
    if (!this.currentCheckpoint) return null;
    
    this.update({ status: "paused" });
    this.stopAutoSave();
    this.saveCheckpoint(this.currentCheckpoint!);
    
    return this.currentCheckpoint;
  }
  
  /**
   * 恢复任务
   */
  resume(checkpointId?: string): Checkpoint | null {
    const checkpoint = checkpointId 
      ? this.checkpoints.get(checkpointId)
      : this.findLatestPaused();
    
    if (!checkpoint) {
      return null;
    }
    
    this.currentCheckpoint = {
      ...checkpoint,
      status: "running",
      metadata: {
        ...checkpoint.metadata,
        updatedAt: Date.now(),
      },
    };
    
    this.startAutoSave();
    return this.currentCheckpoint;
  }
  
  /**
   * 完成任务
   */
  complete(): Checkpoint | null {
    if (!this.currentCheckpoint) return null;
    
    this.update({
      status: "completed",
      progress: 100,
      currentStep: "done",
    });
    
    this.stopAutoSave();
    this.saveCheckpoint(this.currentCheckpoint!);
    
    return this.currentCheckpoint;
  }
  
  /**
   * 生成交接单
   */
  generateHandover(): HandoverDocument | null {
    if (!this.currentCheckpoint) return null;
    
    const cp = this.currentCheckpoint;
    
    return {
      sessionId: cp.sessionId,
        // @ts-ignore
        // @ts-ignore
      createdAt: new Date().toISOString(),
      goal: cp.context.goal || "未指定目标",
        // @ts-ignore
        // @ts-ignore
      summary: this.generateSummary(cp),
      completedWork: cp.completedSteps.map(step => ({
        step,
        result: cp.context[`step_${step}_result`] || "已完成",
        timestamp: cp.metadata.updatedAt,
      })),
      pendingWork: cp.pendingSteps.map(step => ({
        step,
        priority: "medium" as const,
        dependencies: [],
      })),
      keyFindings: this.extractKeyFindings(cp),
      warnings: cp.error ? [cp.error.message] : [],
      recommendations: this.generateRecommendations(cp),
      context: {
        variables: cp.variables,
        files: this.extractFiles(cp),
        lastCheckpoint: cp.id,
      },
    };
  }
  
  /**
   * 创建恢复计划
   */
  createRecoveryPlan(checkpointId?: string): RecoveryPlan {
    const checkpoint = checkpointId 
      ? this.checkpoints.get(checkpointId)
      : this.currentCheckpoint;
    
    if (!checkpoint) {
      return {
        canRecover: false,
        fromCheckpoint: "",
        steps: [{ action: "abort", step: "none", reason: "无可用检查点" }],
        estimatedTime: 0,
        riskLevel: "high",
      };
    }
    
    const steps: RecoveryPlan["steps"] = [];
    let estimatedTime = 0;
    let riskLevel: "low" | "medium" | "high" = "low";
    
    // 恢复上下文
    steps.push({
      action: "restore",
      step: "context",
      reason: "恢复执行上下文",
    });
    estimatedTime += 100;
    
    // 处理已完成的步骤
    for (const step of checkpoint.completedSteps) {
      steps.push({
        action: "skip",
        step,
        reason: "已完成，跳过",
      });
    }
    
    // 处理失败的步骤
    if (checkpoint.error) {
      steps.push({
        action: "retry",
        step: checkpoint.error.step,
        reason: `之前失败: ${checkpoint.error.message}`,
      });
      riskLevel = "medium";
      estimatedTime += 5000;
    }
    
    // 处理待执行的步骤
    for (const step of checkpoint.pendingSteps) {
      steps.push({
        action: "retry",
        step,
        reason: "待执行",
      });
      estimatedTime += 2000;
    }
    
    return {
      canRecover: true,
      fromCheckpoint: checkpoint.id,
      steps,
      estimatedTime,
      riskLevel,
    };
  }
  
  /**
   * 获取所有检查点
   */
  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * 获取会话的检查点
   */
  getSessionCheckpoints(sessionId: string): Checkpoint[] {
    return this.getAllCheckpoints()
      .filter(cp => cp.sessionId === sessionId);
  }
  
  /**
   * 删除检查点
   */
  deleteCheckpoint(checkpointId: string): boolean {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return false;
    
    this.checkpoints.delete(checkpointId);
    
    const filePath = this.getCheckpointPath(checkpointId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return true;
  }
  
  /**
   * 清理旧检查点
   */
  cleanup(): number {
    const all = this.getAllCheckpoints();
    if (all.length <= this.config.maxCheckpoints) {
      return 0;
    }
    
    const toDelete = all.slice(this.config.maxCheckpoints);
    for (const cp of toDelete) {
      this.deleteCheckpoint(cp.id);
    }
    
    return toDelete.length;
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private generateId(): string {
    return `cp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  private getCheckpointPath(checkpointId: string): string {
    return path.join(this.config.checkpointDir, `${checkpointId}.json`);
  }
  
  private saveCheckpoint(checkpoint: Checkpoint): void {
    const filePath = this.getCheckpointPath(checkpoint.id);
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
  }
  
  private loadExistingCheckpoints(): void {
    if (!fs.existsSync(this.config.checkpointDir)) return;
    
    const files = fs.readdirSync(this.config.checkpointDir)
      .filter(f => f.endsWith(".json"));
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(
          path.join(this.config.checkpointDir, file),
          "utf-8"
        );
        const checkpoint: Checkpoint = JSON.parse(content);
        this.checkpoints.set(checkpoint.id, checkpoint);
      } catch (e) {
        // 忽略无效的检查点文件
      }
    }
  }
  
  private findLatestPaused(): Checkpoint | null {
    const paused = this.getAllCheckpoints()
      .filter(cp => cp.status === "paused" || cp.status === "failed");
    return paused[0] || null;
  }
  
  private startAutoSave(): void {
    if (this.autoSaveTimer) return;
    
    this.autoSaveTimer = setInterval(() => {
      if (this.currentCheckpoint) {
        this.saveCheckpoint(this.currentCheckpoint);
      }
    }, this.config.autoSaveInterval);
  }
  
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  private calculateProgress(completed: string[], pending: string[]): number {
    const total = completed.length + pending.length;
    if (total === 0) return 0;
    return Math.round((completed.length / total) * 100);
  }
  
  private generateSummary(cp: Checkpoint): string {
    const statusMap = {
      running: "执行中",
      paused: "已暂停",
      completed: "已完成",
      failed: "已失败",
    };
    
    return `任务状态: ${statusMap[cp.status]}, 进度: ${cp.progress}%, ` +
           `已完成 ${cp.completedSteps.length} 步, ` +
           `待执行 ${cp.pendingSteps.length} 步`;
  }
  
  private extractKeyFindings(cp: Checkpoint): string[] {
    const findings: string[] = [];
    
    for (const [key, value] of Object.entries(cp.context)) {
      if (key.startsWith("finding_")) {
        findings.push(value as string);
      }
    }
    
    return findings;
  }
  
  private generateRecommendations(cp: Checkpoint): string[] {
    const recommendations: string[] = [];
    
    if (cp.status === "failed" && cp.error) {
      recommendations.push(`修复错误后重试: ${cp.error.step}`);
    }
    
    if (cp.pendingSteps.length > 5) {
      recommendations.push("考虑拆分任务以减少复杂度");
    }
    
    if (cp.progress < 50 && cp.completedSteps.length > 10) {
      recommendations.push("检查是否有重复或无效步骤");
    }
    
    return recommendations;
  }
  
  private extractFiles(cp: Checkpoint): string[] {
    const files: string[] = [];
    
    for (const [key, value] of Object.entries(cp.context)) {
      if (typeof value === "string" && value.startsWith("/")) {
        files.push(value);
      }
    }
    
    return files;
  }
}

// ============================================================
// 任务恢复器
// ============================================================

export class TaskResumer {
  private checkpointManager: CheckpointManager;
  
  constructor(checkpointManager: CheckpointManager) {
    this.checkpointManager = checkpointManager;
  }
  
  /**
   * 检查是否有可恢复的任务
   */
  hasRecoverableTasks(): boolean {
    const checkpoints = this.checkpointManager.getAllCheckpoints();
    return checkpoints.some(cp => 
      cp.status === "paused" || cp.status === "failed"
    );
  }
  
  /**
   * 获取可恢复的任务列表
   */
  getRecoverableTasks(): Array<{
    checkpointId: string;
    sessionId: string;
    goal: string;
    progress: number;
    status: string;
        // @ts-ignore
    lastUpdated: Date;
        // @ts-ignore
  }> {
    return this.checkpointManager.getAllCheckpoints()
      .filter(cp => cp.status === "paused" || cp.status === "failed")
      .map(cp => ({
        checkpointId: cp.id,
        sessionId: cp.sessionId,
        goal: cp.context.goal || "未指定",
        progress: cp.progress,
        status: cp.status,
        lastUpdated: new Date(cp.metadata.updatedAt),
      }));
  }
  
  /**
   * 恢复任务执行
   */
  async resume(
    checkpointId: string,
    executor: (step: string, context: any) => Promise<any>
  ): Promise<{ success: boolean; checkpoint: Checkpoint | null; error?: string }> {
    const checkpoint = this.checkpointManager.resume(checkpointId);
    
    if (!checkpoint) {
      return { success: false, checkpoint: null, error: "检查点不存在" };
    }
    
    try {
      // 执行待处理的步骤
      for (const step of checkpoint.pendingSteps) {
        try {
          const result = await executor(step, checkpoint.context);
          this.checkpointManager.completeStep(step, result);
        } catch (error) {
          this.checkpointManager.recordError(error as Error, step);
          const failedCp = this.checkpointManager.getAllCheckpoints().find(c => c.id === checkpointId);
          return {
            success: false,
            checkpoint: failedCp || null,
            error: (error as Error).message,
          };
        }
      }
      
      // 完成
      const completed = this.checkpointManager.complete();
      return { success: true, checkpoint: completed };
      
    } catch (error) {
      const failedCp = this.checkpointManager.getAllCheckpoints().find(c => c.id === checkpointId);
      return {
        success: false,
        checkpoint: failedCp || null,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * 从错误中恢复
   */
  async recoverFromError(
    checkpointId: string,
    errorResolver: (error: any, step: string) => Promise<boolean>,
    executor: (step: string, context: any) => Promise<any>
  ): Promise<{ success: boolean; checkpoint: Checkpoint | null }> {
    const checkpoint = this.checkpointManager.getAllCheckpoints()
      .find(cp => cp.id === checkpointId);
    
    if (!checkpoint || !checkpoint.error) {
      return { success: false, checkpoint: null };
    }
    
    // 尝试解决错误
    const resolved = await errorResolver(checkpoint.error, checkpoint.error.step);
    
    if (!resolved) {
      return { success: false, checkpoint };
    }
    
    // 清除错误状态，重新执行
    return this.resume(checkpointId, executor);
  }
}

// ============================================================
// 扩展方法
// ============================================================

// 获取当前检查点的辅助方法
(CheckpointManager.prototype as any).getCurrent = function(): Checkpoint | null {
  return (this as any).currentCheckpoint;
};

// ============================================================
// 示例和测试
// ============================================================

function demo() {
  console.log("=".repeat(60));
  console.log("断点续传系统演示");
  console.log("=".repeat(60));
  
  const manager = new CheckpointManager({
    checkpointDir: "./experiment-results/checkpoints",
  });
  
  // 创建检查点
  console.log("\n1. 创建检查点");
  const cp = manager.create("session-001", "完成数据分析任务");
  console.log(`   检查点 ID: ${cp.id}`);
  console.log(`   状态: ${cp.status}`);
  
  // 设置待执行步骤
  console.log("\n2. 设置任务步骤");
  manager.update({
    pendingSteps: ["读取数据", "清洗数据", "分析数据", "生成报告"],
  });
  const checkpoints1 = manager.getAllCheckpoints();
  const current1 = checkpoints1.find(c => c.id === cp.id);
  console.log(`   待执行步骤: ${current1?.pendingSteps.join(", ")}`);
  
  // 完成步骤
  console.log("\n3. 执行步骤");
  manager.completeStep("读取数据", { rows: 1000 });
  const checkpoints2 = manager.getAllCheckpoints();
  const current2 = checkpoints2.find(c => c.id === cp.id);
  console.log(`   进度: ${current2?.progress}%`);
  
  manager.completeStep("清洗数据", { cleaned: 950 });
  const checkpoints3 = manager.getAllCheckpoints();
  const current3 = checkpoints3.find(c => c.id === cp.id);
  console.log(`   进度: ${current3?.progress}%`);
  
  // 模拟错误
  console.log("\n4. 模拟错误");
  manager.recordError(new Error("数据格式错误"), "分析数据");
  const checkpoints4 = manager.getAllCheckpoints();
  const current4 = checkpoints4.find(c => c.id === cp.id);
  console.log(`   状态: ${current4?.status}`);
  console.log(`   错误: ${current4?.error?.message}`);
  
  // 生成恢复计划
  console.log("\n5. 生成恢复计划");
  const recoveryPlan = manager.createRecoveryPlan();
  console.log(`   可恢复: ${recoveryPlan.canRecover}`);
  console.log(`   风险级别: ${recoveryPlan.riskLevel}`);
  console.log(`   预计时间: ${recoveryPlan.estimatedTime}ms`);
  console.log(`   恢复步骤:`);
  recoveryPlan.steps.forEach(s => {
    console.log(`     - ${s.action}: ${s.step} (${s.reason})`);
  });
  
  // 生成交接单
  console.log("\n6. 生成交接单");
  const handover = manager.generateHandover();
  if (handover) {
    console.log(`   目标: ${handover.goal}`);
    console.log(`   摘要: ${handover.summary}`);
    console.log(`   已完成: ${handover.completedWork.length} 项`);
    console.log(`   待执行: ${handover.pendingWork.length} 项`);
    console.log(`   警告: ${handover.warnings.length} 项`);
  }
  
  // 查看所有检查点
  console.log("\n7. 所有检查点");
  const allCheckpoints = manager.getAllCheckpoints();
  console.log(`   总数: ${allCheckpoints.length}`);
  allCheckpoints.forEach(cp => {
    console.log(`   - ${cp.id}: ${cp.status} (${cp.progress}%)`);
  });
  
  console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  demo();
}
