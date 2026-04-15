/**
 * IRQ 隔离模块
 * 
 * 职责：
 * - CPU 亲和性：绑定关键线程到指定 CPU 核心
 * - IRQ 隔离：将中断请求隔离到非关键核心
 * - 实时优先级：提升关键线程优先级
 * - 性能隔离：确保关键任务不受干扰
 */

import * as os from "os";

// ============================================================
// 类型定义
// ============================================================

export type IsolationLevel = "none" | "soft" | "hard";

export interface CpuSet {
  isolated: number[];    // 隔离的 CPU 核心（用于关键任务）
  reserved: number[];    // 保留的 CPU 核心（用于系统/IRQ）
  available: number[];   // 可用的 CPU 核心
}

export interface IrqConfig {
  level: IsolationLevel;
  isolatedCores: number;
  reservedCores: number;
  realtimePriority: boolean;
}

export interface IsolationStatus {
  enabled: boolean;
  level: IsolationLevel;
  cpuSet: CpuSet;
  irqAffinity: Map<string, number[]>;
  warnings: string[];
}

// ============================================================
// CPU 亲和性管理器
// ============================================================

export class CpuAffinityManager {
  private cpuCount: number;
  private cpuSet: CpuSet;
  private config: IrqConfig;

  constructor(config: Partial<IrqConfig> = {}) {
    this.cpuCount = os.cpus().length;
    this.config = {
      level: config.level ?? "soft",
      isolatedCores: config.isolatedCores ?? Math.max(1, Math.floor(this.cpuCount * 0.5)),
      reservedCores: config.reservedCores ?? Math.max(1, Math.floor(this.cpuCount * 0.25)),
      realtimePriority: config.realtimePriority ?? false,
    };

    this.cpuSet = this.calculateCpuSet();
  }

  /**
   * 计算 CPU 集合
   */
  private calculateCpuSet(): CpuSet {
    const total = this.cpuCount;
    const isolated = this.config.isolatedCores;
    const reserved = this.config.reservedCores;

    // 验证配置
    if (isolated + reserved > total) {
      console.warn(`[CpuAffinity] 配置的核心数超过总数，自动调整`);
      this.config.isolatedCores = Math.floor(total * 0.5);
      this.config.reservedCores = Math.floor(total * 0.25);
    }

    const isolatedCores: number[] = [];
    const reservedCores: number[] = [];
    const availableCores: number[] = [];

    // 分配核心
    // 隔离核心：从高端核心开始（假设核心 0 是高端核心）
    for (let i = 0; i < this.config.isolatedCores && i < total; i++) {
      isolatedCores.push(i);
    }

    // 保留核心：从低端核心开始
    for (let i = total - this.config.reservedCores; i < total; i++) {
      if (i >= 0 && !isolatedCores.includes(i)) {
        reservedCores.push(i);
      }
    }

    // 可用核心：剩余核心
    for (let i = 0; i < total; i++) {
      if (!isolatedCores.includes(i) && !reservedCores.includes(i)) {
        availableCores.push(i);
      }
    }

    return {
      isolated: isolatedCores,
      reserved: reservedCores,
      available: availableCores,
    };
  }

  /**
   * 获取 CPU 集合
   */
  getCpuSet(): CpuSet {
    return { ...this.cpuSet };
  }

  /**
   * 获取隔离核心
   */
  getIsolatedCores(): number[] {
    return [...this.cpuSet.isolated];
  }

  /**
   * 获取保留核心
   */
  getReservedCores(): number[] {
    return [...this.cpuSet.reserved];
  }

  /**
   * 设置线程亲和性（模拟）
   * 
   * 注意：Node.js 不直接支持线程亲和性
   * 此方法提供配置信息，实际绑定需要系统级支持
   */
  setThreadAffinity(threadId: string, cores: number[]): boolean {
    // 验证核心是否有效
    const validCores = cores.filter(c => c >= 0 && c < this.cpuCount);
    
    if (validCores.length === 0) {
      return false;
    }

    // 记录配置（实际绑定需要系统级支持）
    console.log(`[CpuAffinity] 线程 ${threadId} 绑定到核心 ${validCores.join(",")}`);
    
    return true;
  }

  /**
   * 获取配置
   */
  getConfig(): IrqConfig {
    return { ...this.config };
  }

  /**
   * 获取 CPU 数量
   */
  getCpuCount(): number {
    return this.cpuCount;
  }
}

// ============================================================
// IRQ 隔离管理器
// ============================================================

export class IrqIsolationManager {
  private affinityManager: CpuAffinityManager;
  private irqAffinity: Map<string, number[]> = new Map();
  private enabled: boolean = false;

  constructor(config: Partial<IrqConfig> = {}) {
    this.affinityManager = new CpuAffinityManager(config);
  }

  /**
   * 启用 IRQ 隔离
   */
  enable(): IsolationStatus {
    const cpuSet = this.affinityManager.getCpuSet();
    const warnings: string[] = [];

    // 检查是否有足够的保留核心
    if (cpuSet.reserved.length === 0) {
      warnings.push("没有保留核心用于 IRQ，可能影响性能隔离");
    }

    // 检查是否有隔离核心
    if (cpuSet.isolated.length === 0) {
      warnings.push("没有隔离核心，关键任务可能受干扰");
    }

    // 配置 IRQ 亲和性（模拟）
    // 实际实现需要访问 /proc/irq/*/smp_affinity
    this.configureIrqAffinity(cpuSet.reserved);

    this.enabled = true;

    return {
      enabled: true,
      level: this.affinityManager.getConfig().level,
      cpuSet,
      irqAffinity: this.irqAffinity,
      warnings,
    };
  }

  /**
   * 禁用 IRQ 隔离
   */
  disable(): void {
    this.enabled = false;
    this.irqAffinity.clear();
  }

  /**
   * 配置 IRQ 亲和性
   */
  private configureIrqAffinity(reservedCores: number[]): void {
    // 模拟配置常见 IRQ
    const irqs = [
      "timer",
      "network",
      "disk",
      "usb",
    ];

    for (const irq of irqs) {
      this.irqAffinity.set(irq, reservedCores);
    }
  }

  /**
   * 获取状态
   */
  getStatus(): IsolationStatus {
    return {
      enabled: this.enabled,
      level: this.affinityManager.getConfig().level,
      cpuSet: this.affinityManager.getCpuSet(),
      irqAffinity: new Map(this.irqAffinity),
      warnings: [],
    };
  }

  /**
   * 获取 CPU 亲和性管理器
   */
  getAffinityManager(): CpuAffinityManager {
    return this.affinityManager;
  }

  /**
   * 检查是否支持 IRQ 隔离
   */
  static checkSupport(): {
    supported: boolean;
    reason: string;
    suggestions: string[];
  } {
    const suggestions: string[] = [];

    // 检查操作系统
    const platform = os.platform();
    if (platform !== "linux") {
      return {
        supported: false,
        reason: `IRQ 隔离仅支持 Linux，当前系统: ${platform}`,
        suggestions: [
          "在 Linux 系统上运行以获得完整支持",
          "可以使用软隔离模式获得部分效果",
        ],
      };
    }

    // 检查 CPU 核心数
    const cpuCount = os.cpus().length;
    if (cpuCount < 4) {
      suggestions.push("建议至少 4 核 CPU 以获得有效的隔离效果");
    }

    // 检查权限
    // 实际需要检查 /proc/irq 权限
    suggestions.push("需要 root 权限来配置 IRQ 亲和性");

    return {
      supported: true,
      reason: "系统支持 IRQ 隔离",
      suggestions,
    };
  }
}

// ============================================================
// 实时优先级管理器
// ============================================================

export class RealtimePriorityManager {
  private enabled: boolean = false;
  private priority: number = 0;

  /**
   * 设置实时优先级
   * 
   * 注意：Node.js 不直接支持实时优先级
   * 此方法提供配置信息，实际设置需要系统级支持
   */
  setRealtimePriority(priority: number): boolean {
    if (priority < 1 || priority > 99) {
      console.warn("[RealtimePriority] 优先级必须在 1-99 之间");
      return false;
    }

    this.priority = priority;
    this.enabled = true;

    console.log(`[RealtimePriority] 设置实时优先级: ${priority}`);
    
    return true;
  }

  /**
   * 禁用实时优先级
   */
  disable(): void {
    this.enabled = false;
    this.priority = 0;
  }

  /**
   * 获取状态
   */
  getStatus(): {
    enabled: boolean;
    priority: number;
  } {
    return {
      enabled: this.enabled,
      priority: this.priority,
    };
  }
}

// ============================================================
// 性能隔离系统
// ============================================================

export class PerformanceIsolationSystem {
  private irqManager: IrqIsolationManager;
  private priorityManager: RealtimePriorityManager;
  private config: IrqConfig;

  constructor(config: Partial<IrqConfig> = {}) {
    this.config = {
      level: config.level ?? "soft",
      isolatedCores: config.isolatedCores ?? 2,
      reservedCores: config.reservedCores ?? 1,
      realtimePriority: config.realtimePriority ?? false,
    };

    this.irqManager = new IrqIsolationManager(this.config);
    this.priorityManager = new RealtimePriorityManager();
  }

  /**
   * 启用性能隔离
   */
  enable(): IsolationStatus {
    const status = this.irqManager.enable();

    // 设置实时优先级
    if (this.config.realtimePriority) {
      this.priorityManager.setRealtimePriority(50);
    }

    return status;
  }

  /**
   * 禁用性能隔离
   */
  disable(): void {
    this.irqManager.disable();
    this.priorityManager.disable();
  }

  /**
   * 获取状态
   */
  getStatus(): {
    irq: IsolationStatus;
    priority: {
      enabled: boolean;
      priority: number;
    };
    support: {
      supported: boolean;
      reason: string;
    };
  } {
    return {
      irq: this.irqManager.getStatus(),
      priority: this.priorityManager.getStatus(),
      support: IrqIsolationManager.checkSupport(),
    };
  }

  /**
   * 获取组件
   */
  getIrqManager(): IrqIsolationManager {
    return this.irqManager;
  }

  getPriorityManager(): RealtimePriorityManager {
    return this.priorityManager;
  }
}

// ============================================================
// 单例导出
// ============================================================

let performanceIsolationInstance: PerformanceIsolationSystem | null = null;

export function getPerformanceIsolationSystem(config?: Partial<IrqConfig>): PerformanceIsolationSystem {
  if (!performanceIsolationInstance) {
    performanceIsolationInstance = new PerformanceIsolationSystem(config);
  }
  return performanceIsolationInstance;
}
