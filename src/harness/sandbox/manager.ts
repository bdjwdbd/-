/**
 * Harness Engineering - 沙盒管理器
 * 
 * 实现四级沙盒隔离：
 * - L1: 进程级隔离
 * - L2: 容器级隔离
 * - L3: 虚拟机级隔离
 * - L4: 物理级隔离
 * 
 * @module harness/sandbox/manager
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import {
  SandboxLevel,
  SandboxStatus,
  SandboxConfig,
  Sandbox,
  SandboxManagerConfig,
  DEFAULT_SANDBOX_MANAGER_CONFIG,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_PERMISSIONS,
  SandboxExecutionResult,
  RiskLevel,
  RiskAssessment,
} from './types';

// ============ 风险评估器 ============

/**
 * 风险评估器
 * 
 * 评估操作风险，推荐合适的沙盒级别
 */
export class RiskAssessor {
  /**
   * 评估操作风险
   */
  assess(operation: {
    type: string;
    input: unknown;
    tools?: string[];
  }): RiskAssessment {
    const riskFactors: RiskAssessment['riskFactors'] = [];
    let totalRisk = 0;

    // 1. 操作类型风险
    const typeRisk = this.assessOperationType(operation.type);
    riskFactors.push({
      factor: 'operation_type',
      weight: typeRisk,
      description: `操作类型: ${operation.type}`,
    });
    totalRisk += typeRisk;

    // 2. 工具使用风险
    if (operation.tools && operation.tools.length > 0) {
      const toolRisk = this.assessToolUsage(operation.tools);
      riskFactors.push({
        factor: 'tool_usage',
        weight: toolRisk,
        description: `使用工具: ${operation.tools.join(', ')}`,
      });
      totalRisk += toolRisk;
    }

    // 3. 输入风险
    const inputRisk = this.assessInput(operation.input);
    riskFactors.push({
      factor: 'input_risk',
      weight: inputRisk,
      description: '输入数据风险',
    });
    totalRisk += inputRisk;

    // 确定风险级别（使用加权平均，输入风险权重最高）
    const weights = {
      operation_type: 0.15,
      tool_usage: 0.15,
      input_risk: 0.7,  // 输入风险权重最高
    };
    
    let weightedRisk = 0;
    let totalWeight = 0;
    
    for (const factor of riskFactors) {
      const weight = weights[factor.factor as keyof typeof weights] || 0.33;
      weightedRisk += factor.weight * weight;
      totalWeight += weight;
    }
    
    const avgRisk = weightedRisk / totalWeight;
    
    let level: RiskLevel;
    let recommendedLevel: SandboxLevel;

    // 调整阈值，使高风险操作更容易被识别
    if (avgRisk < 0.25) {
      level = RiskLevel.LOW;
      recommendedLevel = SandboxLevel.PROCESS;
    } else if (avgRisk < 0.5) {
      level = RiskLevel.MEDIUM;
      recommendedLevel = SandboxLevel.CONTAINER;
    } else if (avgRisk < 0.8) {
      level = RiskLevel.HIGH;
      recommendedLevel = SandboxLevel.VM;
    } else {
      level = RiskLevel.CRITICAL;
      recommendedLevel = SandboxLevel.PHYSICAL;
    }

    // 生成缓解措施
    const mitigations = this.generateMitigations(level, riskFactors);

    return {
      operation: operation.type,
      level,
      recommendedLevel,
      riskFactors,
      mitigations,
    };
  }

  /**
   * 评估操作类型风险
   */
  private assessOperationType(type: string): number {
    const typeRisks: Record<string, number> = {
      // 低风险
      'read': 0.1,
      'query': 0.1,
      'search': 0.15,
      'list': 0.15,
      
      // 中等风险
      'write': 0.4,
      'create': 0.35,
      'update': 0.35,
      'network': 0.45,
      'file_read': 0.3,
      'file_write': 0.5,
      
      // 高风险
      'exec': 0.75,
      'shell': 0.85,
      'file_delete': 0.8,
      'process_kill': 0.7,
      'package_install': 0.65,
      
      // 极高风险
      'system_config': 0.9,
      'sudo': 0.95,
      'root': 1.0,
    };

    return typeRisks[type] || 0.5;
  }

  /**
   * 评估工具使用风险
   */
  private assessToolUsage(tools: string[]): number {
    const highRiskTools = ['exec', 'shell', 'sudo', 'su', 'chmod', 'chown'];
    const mediumRiskTools = ['write', 'delete', 'network'];

    let risk = 0;
    for (const tool of tools) {
      if (highRiskTools.includes(tool)) {
        risk += 0.3;
      } else if (mediumRiskTools.includes(tool)) {
        risk += 0.2;
      } else {
        risk += 0.1;
      }
    }

    return Math.min(1, risk / tools.length);
  }

  /**
   * 评估输入风险
   */
  private assessInput(input: unknown): number {
    if (typeof input === 'string') {
      const inputLower = input.toLowerCase();
      
      // ========== 危险模式（CRITICAL）==========
      const criticalPatterns = [
        /rm\s+-rf\s+\//,           // rm -rf /
        /rm\s+-rf\s+\*/,           // rm -rf *
        /rm\s+-rf\s+\/root/,       // rm -rf /root
        /rm\s+-rf\s+\/home/,       // rm -rf /home
        /rm\s+-rf\s+\/etc/,        // rm -rf /etc
        /rm\s+.*-rf.*\//,          // rm -rf (任意顺序)
        />\s*\/dev\/sd/,           // 写入磁盘设备
        /mkfs/,                    // 格式化
        /dd\s+if=.*of=\/dev/,      // dd 写入设备
        /:\(\)\{\s*:\|:&\s*\};:/,  // Fork bomb
        /chmod\s+-R\s+777\s+\//,   // 递归修改根目录权限
        /chown\s+-R.*\//,          // 递归修改所有者
        /执行\s+rm/,               // 执行 rm（中文）
        /执行.*删除/,              // 执行删除（中文）
      ];

      for (const pattern of criticalPatterns) {
        if (pattern.test(inputLower)) {
          return 1.0; // CRITICAL
        }
      }

      // ========== 高风险模式（HIGH）==========
      const highRiskPatterns = [
        /rm\s+-rf/,                // rm -rf
        /sudo/,                    // sudo
        /chmod\s+777/,             // 危险权限
        />\s*\/dev\/null/,         // 重定向到 /dev/null
        /\|\s*(sh|bash|zsh)/,      // 管道到 shell
        /\$\(/,                    // 命令替换
        /`.*`/,                    // 反引号命令替换
        /curl.*\|.*sh/,            // 下载并执行
        /wget.*\|.*sh/,            // 下载并执行
        /exec/,                    // exec 命令
        /eval/,                    // eval 命令
        /shutdown/,                // 关机
        /reboot/,                  // 重启
        /init\s+[06]/,             // 切换运行级别
        /执行\s+.*命令/,           // 执行命令（中文）
        /run\s+.*command/,         // 运行命令（英文）
        /execute\s+.*command/,     // 执行命令（英文）
        /ls\s+-la/,                // 列出文件详情
        /ls\s+-l/,                 // 列出文件
      ];

      for (const pattern of highRiskPatterns) {
        if (pattern.test(inputLower)) {
          return 0.85; // HIGH
        }
      }

      // ========== 中等风险模式（MEDIUM）==========
      const mediumRiskPatterns = [
        /读取.*文件/,              // 文件读取（中文）
        /read.*file/,              // 文件读取（英文）
        /打开.*文件/,              // 打开文件
        /open.*file/,              // open file
        /\/tmp\//,                 // 临时文件路径
        /\/home\//,                // 用户目录
        /\/etc\//,                 // 系统配置目录
        /执行.*命令/,              // 执行命令（中文）
        /run.*command/,            // 运行命令（英文）
        /execute.*command/,        // 执行命令（英文）
        /ls\s+-la/,                // 列出文件
        /cat\s+/,                  // 读取文件
        /grep/,                    // 搜索
        /find/,                    // 查找文件
        /ps\s+/,                   // 进程列表
        /kill/,                    // 杀进程
        /apt/,                     // 包管理器
        /yum/,                     // 包管理器
        /npm/,                     // npm
        /pip/,                     // pip
        /git\s+/,                  // git 命令
      ];

      for (const pattern of mediumRiskPatterns) {
        if (pattern.test(inputLower)) {
          return 0.5; // MEDIUM
        }
      }

      // ========== 低风险模式 ==========
      return 0.2;
    }

    return 0.3;
  }

  /**
   * 生成缓解措施
   */
  private generateMitigations(
    level: RiskLevel,
    factors: RiskAssessment['riskFactors']
  ): string[] {
    const mitigations: string[] = [];

    if (level === RiskLevel.HIGH || level === RiskLevel.CRITICAL) {
      mitigations.push('使用更高级别的沙盒隔离');
      mitigations.push('限制网络访问');
      mitigations.push('禁用危险工具');
    }

    if (level === RiskLevel.MEDIUM) {
      mitigations.push('限制文件系统访问');
      mitigations.push('设置资源配额');
    }

    mitigations.push('启用审计日志');
    mitigations.push('设置执行超时');

    return mitigations;
  }
}

// ============ 沙盒管理器 ============

/**
 * 沙盒管理器
 * 
 * 管理沙盒的创建、执行、监控和销毁
 */
export class SandboxManager {
  private config: SandboxManagerConfig;
  private sandboxes: Map<string, Sandbox> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private riskAssessor: RiskAssessor;
  private monitoringTimer?: NodeJS.Timeout;
  private auditLog: Array<{
    timestamp: number;
    sandboxId: string;
    action: string;
    result: string;
  }> = [];

  constructor(config: Partial<SandboxManagerConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_MANAGER_CONFIG, ...config };
    this.riskAssessor = new RiskAssessor();
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    // 创建沙盒目录
    const sandboxDir = path.join(this.config.workspaceRoot, '.sandboxes');
    await fs.promises.mkdir(sandboxDir, { recursive: true });

    // 启动监控
    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }
  }

  // ============ 沙盒管理 ============

  /**
   * 创建沙盒
   */
  async create(options: {
    name: string;
    level?: SandboxLevel;
    resourceLimits?: Partial<typeof DEFAULT_RESOURCE_LIMITS[SandboxLevel]>;
    permissions?: Partial<typeof DEFAULT_PERMISSIONS[SandboxLevel]>;
    autoDestroy?: boolean;
    lifecycle?: number;
  }): Promise<Sandbox> {
    const level = options.level || this.config.defaultLevel;
    const sandboxId = `sandbox_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 检查沙盒数量限制
    if (this.sandboxes.size >= this.config.maxSandboxes) {
      throw new Error('已达到最大沙盒数量限制');
    }

    const config: SandboxConfig = {
      sandboxId,
      name: options.name,
      level,
      resourceLimits: {
        ...DEFAULT_RESOURCE_LIMITS[level],
        ...options.resourceLimits,
      },
      permissions: {
        ...DEFAULT_PERMISSIONS[level],
        ...options.permissions,
      },
      autoDestroy: options.autoDestroy ?? true,
      lifecycle: options.lifecycle ?? 3600000, // 默认 1 小时
    };

    const sandbox: Sandbox = {
      sandboxId,
      config,
      status: SandboxStatus.CREATING,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      resourceUsage: { cpu: 0, memory: 0, disk: 0, network: 0 },
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalDuration: 0,
      },
      auditLog: [],
    };

    // 根据级别创建沙盒
    switch (level) {
      case SandboxLevel.PROCESS:
        // 进程级沙盒无需额外创建
        break;

      case SandboxLevel.CONTAINER:
        // 容器级沙盒需要 Docker
        await this.createContainerSandbox(sandbox);
        break;

      case SandboxLevel.VM:
        // 虚拟机级沙盒需要虚拟化支持
        await this.createVMSandbox(sandbox);
        break;

      case SandboxLevel.PHYSICAL:
        // 物理级沙盒需要物理机资源
        await this.createPhysicalSandbox(sandbox);
        break;
    }

    sandbox.status = SandboxStatus.RUNNING;
    this.sandboxes.set(sandboxId, sandbox);

    this.logAudit(sandboxId, 'create', 'success');

    return sandbox;
  }

  /**
   * 执行操作
   */
  async execute<T = unknown>(
    sandboxId: string,
    operation: () => Promise<T>,
    options?: {
      timeout?: number;
      onProgress?: (progress: unknown) => void;
    }
  ): Promise<SandboxExecutionResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`沙盒不存在: ${sandboxId}`);
    }

    if (sandbox.status !== SandboxStatus.RUNNING) {
      throw new Error(`沙盒状态不正确: ${sandbox.status}`);
    }

    const executionId = `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();
    const timeout = options?.timeout || sandbox.config.resourceLimits.timeout;

    sandbox.lastActivityAt = Date.now();
    sandbox.stats.totalExecutions++;

    try {
      // 执行操作（带超时）
      const result = await this.executeWithTimeout(operation, timeout);

      sandbox.stats.successfulExecutions++;
      sandbox.stats.totalDuration += Date.now() - startTime;

      this.logAudit(sandboxId, 'execute', 'success');

      return {
        sandboxId,
        executionId,
        success: true,
        output: result,
        duration: Date.now() - startTime,
        resourceUsage: sandbox.resourceUsage,
        securityEvents: [],
      };
    } catch (error) {
      sandbox.stats.failedExecutions++;

      this.logAudit(sandboxId, 'execute', `failed: ${(error as Error).message}`);

      return {
        sandboxId,
        executionId,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        resourceUsage: sandbox.resourceUsage,
        securityEvents: [],
      };
    }
  }

  /**
   * 销毁沙盒
   */
  async destroy(sandboxId: string): Promise<boolean> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return false;

    sandbox.status = SandboxStatus.STOPPING;

    // 根据级别销毁沙盒
    switch (sandbox.config.level) {
      case SandboxLevel.PROCESS:
        // 终止相关进程
        const process = this.processes.get(sandboxId);
        if (process) {
          process.kill();
          this.processes.delete(sandboxId);
        }
        break;

      case SandboxLevel.CONTAINER:
        await this.destroyContainerSandbox(sandbox);
        break;

      case SandboxLevel.VM:
        await this.destroyVMSandbox(sandbox);
        break;

      case SandboxLevel.PHYSICAL:
        await this.destroyPhysicalSandbox(sandbox);
        break;
    }

    sandbox.status = SandboxStatus.STOPPED;
    this.sandboxes.delete(sandboxId);

    this.logAudit(sandboxId, 'destroy', 'success');

    return true;
  }

  /**
   * 获取沙盒
   */
  get(sandboxId: string): Sandbox | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * 列出所有沙盒
   */
  list(): Sandbox[] {
    return Array.from(this.sandboxes.values());
  }

  // ============ 风险评估 ============

  /**
   * 评估操作风险
   */
  assessRisk(operation: {
    type: string;
    input: unknown;
    tools?: string[];
  }): RiskAssessment {
    return this.riskAssessor.assess(operation);
  }

  /**
   * 根据风险自动选择沙盒级别
   */
  async createWithRiskAssessment(options: {
    name: string;
    operation: {
      type: string;
      input: unknown;
      tools?: string[];
    };
  }): Promise<Sandbox> {
    const assessment = this.assessRisk(options.operation);

    return this.create({
      name: options.name,
      level: assessment.recommendedLevel,
    });
  }

  // ============ 私有方法 ============

  /**
   * 创建容器级沙盒
   */
  private async createContainerSandbox(sandbox: Sandbox): Promise<void> {
    // 简化实现：实际需要调用 Docker API
    // docker run -d --name {sandboxId} --cpus={cpu} --memory={memory}m {image}
    console.log(`[Sandbox] 创建容器级沙盒: ${sandbox.sandboxId}`);
  }

  /**
   * 创建虚拟机级沙盒
   */
  private async createVMSandbox(sandbox: Sandbox): Promise<void> {
    // 简化实现：实际需要调用虚拟化 API
    console.log(`[Sandbox] 创建虚拟机级沙盒: ${sandbox.sandboxId}`);
  }

  /**
   * 创建物理级沙盒
   */
  private async createPhysicalSandbox(sandbox: Sandbox): Promise<void> {
    // 简化实现：实际需要物理机资源管理
    console.log(`[Sandbox] 创建物理级沙盒: ${sandbox.sandboxId}`);
  }

  /**
   * 销毁容器级沙盒
   */
  private async destroyContainerSandbox(sandbox: Sandbox): Promise<void> {
    // 简化实现：docker rm -f {sandboxId}
    console.log(`[Sandbox] 销毁容器级沙盒: ${sandbox.sandboxId}`);
  }

  /**
   * 销毁虚拟机级沙盒
   */
  private async destroyVMSandbox(sandbox: Sandbox): Promise<void> {
    console.log(`[Sandbox] 销毁虚拟机级沙盒: ${sandbox.sandboxId}`);
  }

  /**
   * 销毁物理级沙盒
   */
  private async destroyPhysicalSandbox(sandbox: Sandbox): Promise<void> {
    console.log(`[Sandbox] 销毁物理级沙盒: ${sandbox.sandboxId}`);
  }

  /**
   * 带超时执行
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`执行超时: ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.monitor();
    }, this.config.monitoringInterval);
  }

  /**
   * 监控沙盒
   */
  private monitor(): void {
    const now = Date.now();

    for (const [sandboxId, sandbox] of this.sandboxes) {
      // 更新资源使用
      sandbox.resourceUsage = {
        cpu: Math.random() * 100, // 简化
        memory: process.memoryUsage().heapUsed,
        disk: 0,
        network: 0,
      };

      // 检查生命周期
      if (sandbox.config.autoDestroy) {
        const age = now - sandbox.createdAt;
        if (age > sandbox.config.lifecycle) {
          this.destroy(sandboxId);
        }
      }
    }
  }

  /**
   * 记录审计日志
   */
  private logAudit(
    sandboxId: string,
    action: string,
    result: string
  ): void {
    if (!this.config.enableAudit) return;

    const entry = {
      timestamp: Date.now(),
      sandboxId,
      action,
      result,
    };

    this.auditLog.push(entry);

    // 限制日志大小
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * 获取审计日志
   */
  getAuditLog(limit: number = 100): typeof this.auditLog {
    return this.auditLog.slice(-limit);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalSandboxes: number;
    byLevel: Record<SandboxLevel, number>;
    byStatus: Record<SandboxStatus, number>;
  } {
    const byLevel: Record<SandboxLevel, number> = {
      [SandboxLevel.PROCESS]: 0,
      [SandboxLevel.CONTAINER]: 0,
      [SandboxLevel.VM]: 0,
      [SandboxLevel.PHYSICAL]: 0,
    };

    const byStatus: Record<SandboxStatus, number> = {
      [SandboxStatus.CREATING]: 0,
      [SandboxStatus.RUNNING]: 0,
      [SandboxStatus.PAUSED]: 0,
      [SandboxStatus.STOPPING]: 0,
      [SandboxStatus.STOPPED]: 0,
      [SandboxStatus.ERROR]: 0,
    };

    for (const sandbox of this.sandboxes.values()) {
      byLevel[sandbox.config.level]++;
      byStatus[sandbox.status]++;
    }

    return {
      totalSandboxes: this.sandboxes.size,
      byLevel,
      byStatus,
    };
  }

  /**
   * 关闭管理器
   */
  async close(): Promise<void> {
    // 停止监控
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    // 销毁所有沙盒
    for (const sandboxId of this.sandboxes.keys()) {
      await this.destroy(sandboxId);
    }
  }
}
