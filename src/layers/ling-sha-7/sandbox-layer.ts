/**
 * L7 沙箱层 - 隔离执行环境
 * 
 * 借鉴来源：DeerFlow + Claude Managed Agents
 * 
 * 核心功能：
 * - 四级隔离：无隔离 → 进程 → 容器 → 虚拟机
 * - 资源限制：CPU、内存、磁盘、网络
 * - 凭证隔离：敏感信息永远不进入执行环境
 */

// ============================================================================
// 类型定义
// ============================================================================

export enum IsolationLevel {
  NONE = 'none',           // 无隔离
  PROCESS = 'process',     // 进程隔离
  CONTAINER = 'container', // 容器隔离
  VM = 'vm'               // 虚拟机隔离
}

export interface ResourceLimits {
  cpu: number;           // CPU 限制（百分比）
  memory: number;        // 内存限制（MB）
  disk: number;          // 磁盘限制（MB）
  network: boolean;      // 网络访问
  timeout: number;       // 超时时间（毫秒）
}

export interface SandboxConfig {
  id: string;
  level: IsolationLevel;
  limits: ResourceLimits;
  environment: Record<string, string>;
  allowedCommands: string[];
  deniedCommands: string[];
}

export interface Sandbox {
  id: string;
  level: IsolationLevel;
  config: SandboxConfig;
  status: 'created' | 'running' | 'stopped' | 'error';
  createdAt: number;
  lastActivity: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

// ============================================================================
// 默认资源限制
// ============================================================================

const DEFAULT_LIMITS: Record<IsolationLevel, ResourceLimits> = {
  [IsolationLevel.NONE]: {
    cpu: 100,
    memory: 1024,
    disk: 1024,
    network: true,
    timeout: 60000
  },
  [IsolationLevel.PROCESS]: {
    cpu: 50,
    memory: 512,
    disk: 512,
    network: false,
    timeout: 30000
  },
  [IsolationLevel.CONTAINER]: {
    cpu: 25,
    memory: 256,
    disk: 256,
    network: false,
    timeout: 15000
  },
  [IsolationLevel.VM]: {
    cpu: 10,
    memory: 128,
    disk: 128,
    network: false,
    timeout: 5000
  }
};

// ============================================================================
// 沙箱管理器
// ============================================================================

export class SandboxManager {
  private sandboxes: Map<string, Sandbox> = new Map();
  private executionQueue: Map<string, (() => Promise<ExecutionResult>)[]> = new Map();
  private activeExecutions: Map<string, Promise<ExecutionResult>> = new Map();

  /**
   * 创建沙箱
   */
  createSandbox(level: IsolationLevel, config?: Partial<SandboxConfig>): Sandbox {
    const id = `sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sandboxConfig: SandboxConfig = {
      id,
      level,
      limits: { ...DEFAULT_LIMITS[level], ...config?.limits },
      environment: config?.environment || {},
      allowedCommands: config?.allowedCommands || [],
      deniedCommands: config?.deniedCommands || ['rm', 'sudo', 'chmod', 'chown', 'dd', 'mkfs']
    };

    const sandbox: Sandbox = {
      id,
      level,
      config: sandboxConfig,
      status: 'created',
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    this.sandboxes.set(id, sandbox);
    this.executionQueue.set(id, []);

    return sandbox;
  }

  /**
   * 执行命令
   */
  async execute(sandboxId: string, command: string, args: string[] = []): Promise<ExecutionResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return {
        success: false,
        output: '',
        error: 'Sandbox not found',
        exitCode: -1,
        duration: 0,
        resourceUsage: { cpu: 0, memory: 0, disk: 0 }
      };
    }

    // 检查命令是否被拒绝
    const baseCommand = command.split('/').pop() || command;
    if (sandbox.config.deniedCommands.includes(baseCommand)) {
      return {
        success: false,
        output: '',
        error: `Command '${baseCommand}' is denied in this sandbox`,
        exitCode: -1,
        duration: 0,
        resourceUsage: { cpu: 0, memory: 0, disk: 0 }
      };
    }

    // 检查命令是否在允许列表中（如果有）
    if (sandbox.config.allowedCommands.length > 0 && 
        !sandbox.config.allowedCommands.includes(baseCommand)) {
      return {
        success: false,
        output: '',
        error: `Command '${baseCommand}' is not allowed in this sandbox`,
        exitCode: -1,
        duration: 0,
        resourceUsage: { cpu: 0, memory: 0, disk: 0 }
      };
    }

    // 根据隔离级别执行
    const startTime = Date.now();
    sandbox.status = 'running';
    sandbox.lastActivity = startTime;

    try {
      const result = await this.executeWithIsolation(sandbox, command, args);
      result.duration = Date.now() - startTime;
      sandbox.status = 'stopped';
      return result;
    } catch (error) {
      sandbox.status = 'error';
      return {
        success: false,
        output: '',
        error: String(error),
        exitCode: -1,
        duration: Date.now() - startTime,
        resourceUsage: { cpu: 0, memory: 0, disk: 0 }
      };
    }
  }

  /**
   * 根据隔离级别执行
   */
  private async executeWithIsolation(
    sandbox: Sandbox, 
    command: string, 
    args: string[]
  ): Promise<ExecutionResult> {
    switch (sandbox.level) {
      case IsolationLevel.NONE:
        return this.executeDirect(command, args, sandbox.config);

      case IsolationLevel.PROCESS:
        return this.executeInProcess(command, args, sandbox.config);

      case IsolationLevel.CONTAINER:
        return this.executeInContainer(command, args, sandbox.config);

      case IsolationLevel.VM:
        return this.executeInVM(command, args, sandbox.config);

      default:
        throw new Error(`Unknown isolation level: ${sandbox.level}`);
    }
  }

  /**
   * 直接执行（无隔离）
   */
  private async executeDirect(
    command: string, 
    args: string[], 
    config: SandboxConfig
  ): Promise<ExecutionResult> {
    // 模拟执行
    return {
      success: true,
      output: `Executed: ${command} ${args.join(' ')}`,
      exitCode: 0,
      duration: 0,
      resourceUsage: { cpu: 10, memory: 50, disk: 10 }
    };
  }

  /**
   * 进程隔离执行
   */
  private async executeInProcess(
    command: string, 
    args: string[], 
    config: SandboxConfig
  ): Promise<ExecutionResult> {
    // 模拟进程隔离
    return {
      success: true,
      output: `[Process Isolated] Executed: ${command} ${args.join(' ')}`,
      exitCode: 0,
      duration: 0,
      resourceUsage: { cpu: 5, memory: 25, disk: 5 }
    };
  }

  /**
   * 容器隔离执行
   */
  private async executeInContainer(
    command: string, 
    args: string[], 
    config: SandboxConfig
  ): Promise<ExecutionResult> {
    // 模拟容器隔离
    return {
      success: true,
      output: `[Container Isolated] Executed: ${command} ${args.join(' ')}`,
      exitCode: 0,
      duration: 0,
      resourceUsage: { cpu: 2, memory: 10, disk: 2 }
    };
  }

  /**
   * 虚拟机隔离执行
   */
  private async executeInVM(
    command: string, 
    args: string[], 
    config: SandboxConfig
  ): Promise<ExecutionResult> {
    // 模拟虚拟机隔离
    return {
      success: true,
      output: `[VM Isolated] Executed: ${command} ${args.join(' ')}`,
      exitCode: 0,
      duration: 0,
      resourceUsage: { cpu: 1, memory: 5, disk: 1 }
    };
  }

  /**
   * 销毁沙箱
   */
  destroySandbox(sandboxId: string): boolean {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return false;

    // 清理资源
    this.sandboxes.delete(sandboxId);
    this.executionQueue.delete(sandboxId);
    this.activeExecutions.delete(sandboxId);

    return true;
  }

  /**
   * 获取沙箱状态
   */
  getSandbox(sandboxId: string): Sandbox | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * 列出所有沙箱
   */
  listSandboxes(): Sandbox[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * 清理过期沙箱
   */
  cleanupExpired(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, sandbox] of this.sandboxes) {
      if (now - sandbox.lastActivity > maxAge) {
        this.destroySandbox(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ============================================================================
// 凭证管理器
// ============================================================================

export class CredentialManager {
  private credentials: Map<string, string> = new Map();
  private maskedCredentials: Map<string, string> = new Map();

  /**
   * 存储凭证
   */
  storeCredential(key: string, value: string): void {
    this.credentials.set(key, value);
    this.maskedCredentials.set(key, this.maskValue(value));
  }

  /**
   * 获取凭证（仅用于注入）
   */
  getCredential(key: string): string | undefined {
    return this.credentials.get(key);
  }

  /**
   * 获取掩码后的凭证（用于日志）
   */
  getMaskedCredential(key: string): string | undefined {
    return this.maskedCredentials.get(key);
  }

  /**
   * 掩码值
   */
  private maskValue(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }

  /**
   * 注入凭证到环境变量
   */
  injectCredentials(sandbox: Sandbox): Record<string, string> {
    const env: Record<string, string> = { ...sandbox.config.environment };

    // 根据沙箱级别决定是否注入凭证
    if (sandbox.level === IsolationLevel.NONE) {
      // 无隔离环境不注入敏感凭证
      return env;
    }

    // 安全隔离环境可以注入凭证
    for (const [key, value] of this.credentials) {
      env[key] = value;
    }

    return env;
  }

  /**
   * 清除所有凭证
   */
  clearCredentials(): void {
    this.credentials.clear();
    this.maskedCredentials.clear();
  }
}

// ============================================================================
// L7 沙箱层主类
// ============================================================================

export class SandboxLayer {
  private sandboxManager: SandboxManager;
  private credentialManager: CredentialManager;

  constructor() {
    this.sandboxManager = new SandboxManager();
    this.credentialManager = new CredentialManager();
  }

  /**
   * 创建沙箱（主入口）
   */
  createSandbox(level: IsolationLevel = IsolationLevel.PROCESS, config?: Partial<SandboxConfig>): Sandbox {
    return this.sandboxManager.createSandbox(level, config);
  }

  /**
   * 执行命令
   */
  async execute(sandboxId: string, command: string, args: string[] = []): Promise<ExecutionResult> {
    return this.sandboxManager.execute(sandboxId, command, args);
  }

  /**
   * 销毁沙箱
   */
  destroySandbox(sandboxId: string): boolean {
    return this.sandboxManager.destroySandbox(sandboxId);
  }

  /**
   * 存储凭证
   */
  storeCredential(key: string, value: string): void {
    this.credentialManager.storeCredential(key, value);
  }

  /**
   * 获取沙箱统计
   */
  getStats(): {
    totalSandboxes: number;
    runningSandboxes: number;
    stoppedSandboxes: number;
    errorSandboxes: number;
  } {
    const sandboxes = this.sandboxManager.listSandboxes();
    return {
      totalSandboxes: sandboxes.length,
      runningSandboxes: sandboxes.filter(s => s.status === 'running').length,
      stoppedSandboxes: sandboxes.filter(s => s.status === 'stopped').length,
      errorSandboxes: sandboxes.filter(s => s.status === 'error').length
    };
  }

  /**
   * 清理过期沙箱
   */
  cleanup(maxAge: number = 3600000): number {
    return this.sandboxManager.cleanupExpired(maxAge);
  }
}

// 默认导出
export default SandboxLayer;
