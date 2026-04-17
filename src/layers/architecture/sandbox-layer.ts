/**
 * Sandbox 层 - 执行环境
 * 
 * 借鉴：DeerFlow + Open Interpreter
 * 
 * 核心职责：
 * 1. Docker 容器隔离 - 安全的执行环境
 * 2. 资源限制 - CPU/内存/网络/超时控制
 * 3. 凭证隔离 - 敏感信息不进入执行环境
 * 4. 执行快照 - 支持回滚和恢复
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 隔离级别
 */
export enum IsolationLevel {
  /** 无隔离 - 直接在宿主机执行 */
  NONE = 'none',
  /** 进程隔离 - 使用子进程 */
  PROCESS = 'process',
  /** 容器隔离 - 使用 Docker */
  CONTAINER = 'container',
  /** 虚拟机隔离 - 使用 VM */
  VM = 'vm'
}

/**
 * 资源限制
 */
export interface ResourceLimits {
  /** CPU 限制（核心数） */
  cpu?: number;
  /** 内存限制（MB） */
  memory?: number;
  /** 磁盘限制（MB） */
  disk?: number;
  /** 网络访问 */
  network?: boolean;
  /** 执行超时（毫秒） */
  timeout?: number;
  /** 最大进程数 */
  maxProcesses?: number;
  /** 最大文件描述符数 */
  maxFileDescriptors?: number;
}

/**
 * 沙箱配置
 */
export interface SandboxConfig {
  /** 沙箱 ID */
  id: string;
  /** 隔离级别 */
  isolationLevel: IsolationLevel;
  /** 资源限制 */
  resources: ResourceLimits;
  /** 工作目录 */
  workDir?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 挂载点 */
  mounts?: Array<{
    source: string;
    target: string;
    readOnly?: boolean;
  }>;
  /** 允许的命令 */
  allowedCommands?: string[];
  /** 禁止的命令 */
  blockedCommands?: string[];
  /** 镜像名称（仅容器隔离） */
  image?: string;
}

/**
 * 沙箱状态
 */
export enum SandboxState {
  /** 创建中 */
  CREATING = 'creating',
  /** 运行中 */
  RUNNING = 'running',
  /** 暂停 */
  PAUSED = 'paused',
  /** 已停止 */
  STOPPED = 'stopped',
  /** 错误 */
  ERROR = 'error'
}

/**
 * 执行请求
 */
export interface ExecutionRequest {
  /** 请求 ID */
  id: string;
  /** 命令 */
  command: string;
  /** 参数 */
  args?: string[];
  /** 输入 */
  input?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 工作目录 */
  workDir?: string;
  /** 超时覆盖 */
  timeout?: number;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  /** 请求 ID */
  id: string;
  /** 是否成功 */
  success: boolean;
  /** 退出码 */
  exitCode: number;
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 执行时间（毫秒） */
  duration: number;
  /** 资源使用 */
  resourceUsage?: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

/**
 * 沙箱快照
 */
export interface SandboxSnapshot {
  /** 快照 ID */
  id: string;
  /** 沙箱 ID */
  sandboxId: string;
  /** 创建时间 */
  createdAt: number;
  /** 文件系统状态 */
  fileSystemState: string;
  /** 进程状态 */
  processState: string;
  /** 元数据 */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Sandbox 层实现
// ============================================================================

/**
 * Sandbox 层
 * 
 * 核心特性：
 * 1. 四级隔离 - 无/进程/容器/虚拟机
 * 2. 资源限制 - CPU/内存/磁盘/网络/超时
 * 3. 凭证隔离 - 敏感信息不进入执行环境
 * 4. 执行快照 - 支持回滚和恢复
 */
export class SandboxLayer {
  /** 配置 */
  private readonly config: SandboxConfig;
  
  /** 状态 */
  private state: SandboxState = SandboxState.CREATING;
  
  /** 容器 ID（仅容器隔离） */
  private containerId?: string;
  
  /** 快照列表 */
  private snapshots: SandboxSnapshot[] = [];
  
  /** 执行历史 */
  private executionHistory: ExecutionResult[] = [];
  
  /** 资源监控 */
  private resourceMonitor?: NodeJS.Timeout;

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  // ==========================================================================
  // 公共 API
  // ==========================================================================

  /**
   * 获取沙箱 ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * 获取当前状态
   */
  getState(): SandboxState {
    return this.state;
  }

  /**
   * 获取配置
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * 启动沙箱
   */
  async start(): Promise<void> {
    if (this.state === SandboxState.RUNNING) {
      return;
    }

    this.state = SandboxState.CREATING;

    try {
      switch (this.config.isolationLevel) {
        case IsolationLevel.NONE:
          // 无隔离，直接使用宿主机
          break;

        case IsolationLevel.PROCESS:
          // 进程隔离，设置资源限制
          await this.setupProcessIsolation();
          break;

        case IsolationLevel.CONTAINER:
          // 容器隔离，创建 Docker 容器
          await this.createContainer();
          break;

        case IsolationLevel.VM:
          // 虚拟机隔离
          await this.createVM();
          break;
      }

      this.state = SandboxState.RUNNING;
      this.startResourceMonitor();

    } catch (error) {
      this.state = SandboxState.ERROR;
      throw error;
    }
  }

  /**
   * 停止沙箱
   */
  async stop(): Promise<void> {
    if (this.state !== SandboxState.RUNNING && this.state !== SandboxState.PAUSED) {
      return;
    }

    try {
      this.stopResourceMonitor();

      switch (this.config.isolationLevel) {
        case IsolationLevel.CONTAINER:
          await this.destroyContainer();
          break;

        case IsolationLevel.VM:
          await this.destroyVM();
          break;
      }

      this.state = SandboxState.STOPPED;

    } catch (error) {
      this.state = SandboxState.ERROR;
      throw error;
    }
  }

  /**
   * 暂停沙箱
   */
  async pause(): Promise<void> {
    if (this.state !== SandboxState.RUNNING) {
      return;
    }

    if (this.config.isolationLevel === IsolationLevel.CONTAINER && this.containerId) {
      // 暂停 Docker 容器
      await this.execCommand(`docker pause ${this.containerId}`);
    }

    this.state = SandboxState.PAUSED;
  }

  /**
   * 恢复沙箱
   */
  async resume(): Promise<void> {
    if (this.state !== SandboxState.PAUSED) {
      return;
    }

    if (this.config.isolationLevel === IsolationLevel.CONTAINER && this.containerId) {
      // 恢复 Docker 容器
      await this.execCommand(`docker unpause ${this.containerId}`);
    }

    this.state = SandboxState.RUNNING;
  }

  /**
   * 执行命令
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (this.state !== SandboxState.RUNNING) {
      throw new Error('Sandbox is not running');
    }

    // 验证命令
    this.validateCommand(request.command);

    const startTime = Date.now();
    const timeout = request.timeout || this.config.resources.timeout || 30000;

    try {
      let result: ExecutionResult;

      switch (this.config.isolationLevel) {
        case IsolationLevel.NONE:
          result = await this.executeDirect(request, timeout);
          break;

        case IsolationLevel.PROCESS:
          result = await this.executeInProcess(request, timeout);
          break;

        case IsolationLevel.CONTAINER:
          result = await this.executeInContainer(request, timeout);
          break;

        case IsolationLevel.VM:
          result = await this.executeInVM(request, timeout);
          break;

        default:
          throw new Error(`Unknown isolation level: ${this.config.isolationLevel}`);
      }

      result.duration = Date.now() - startTime;
      this.executionHistory.push(result);

      return result;

    } catch (error) {
      const result: ExecutionResult = {
        id: request.id,
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.executionHistory.push(result);
      return result;
    }
  }

  /**
   * 创建快照
   */
  async createSnapshot(): Promise<SandboxSnapshot> {
    const snapshotId = `snap_${this.config.id}_${Date.now()}`;

    let fileSystemState = '';
    let processState = '';

    if (this.config.isolationLevel === IsolationLevel.CONTAINER && this.containerId) {
      // 创建 Docker 容器快照
      fileSystemState = await this.execCommand(
        `docker commit ${this.containerId} ${snapshotId}`
      );
      processState = await this.execCommand(
        `docker inspect ${this.containerId} --format='{{.State}}'`
      );
    }

    const snapshot: SandboxSnapshot = {
      id: snapshotId,
      sandboxId: this.config.id,
      createdAt: Date.now(),
      fileSystemState,
      processState,
      metadata: {
        executionCount: this.executionHistory.length
      }
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * 恢复快照
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    if (this.config.isolationLevel === IsolationLevel.CONTAINER) {
      // 停止当前容器
      await this.stop();

      // 从快照恢复
      await this.execCommand(
        `docker run -d --name ${this.config.id}_restored ${snapshot.fileSystemState}`
      );

      this.containerId = `${this.config.id}_restored`;
      this.state = SandboxState.RUNNING;
    }
  }

  /**
   * 获取快照列表
   */
  getSnapshots(): SandboxSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(): ExecutionResult[] {
    return [...this.executionHistory];
  }

  /**
   * 获取资源使用情况
   */
  async getResourceUsage(): Promise<{
    cpu: number;
    memory: number;
    disk: number;
  }> {
    if (this.config.isolationLevel === IsolationLevel.CONTAINER && this.containerId) {
      const stats = await this.execCommand(
        `docker stats ${this.containerId} --no-stream --format '{{.CPUPerc}},{{.MemUsage}},{{.DiskUsage}}'`
      );
      
      // 解析 Docker stats 输出
      const [cpu, mem, disk] = stats.split(',');
      return {
        cpu: parseFloat(cpu.replace('%', '')),
        memory: parseFloat(mem.split('/')[0].trim()),
        disk: parseFloat(disk.replace('GB', '').replace('MB', ''))
      };
    }

    // 默认返回 0
    return { cpu: 0, memory: 0, disk: 0 };
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 设置进程隔离
   */
  private async setupProcessIsolation(): Promise<void> {
    // 设置进程级别的资源限制
    // TODO: 使用 POSIX setrlimit 实现
  }

  /**
   * 创建 Docker 容器
   */
  private async createContainer(): Promise<void> {
    const image = this.config.image || 'ubuntu:22.04';
    const resources = this.config.resources;

    // 构建资源限制参数
    const resourceArgs: string[] = [];
    
    if (resources.cpu) {
      resourceArgs.push(`--cpus="${resources.cpu}"`);
    }
    if (resources.memory) {
      resourceArgs.push(`--memory="${resources.memory}m"`);
    }
    if (resources.disk) {
      resourceArgs.push(`--storage-opt size=${resources.disk}m`);
    }
    if (resources.network === false) {
      resourceArgs.push('--network none');
    }

    // 构建挂载参数
    const mountArgs: string[] = [];
    if (this.config.mounts) {
      for (const mount of this.config.mounts) {
        const ro = mount.readOnly ? ':ro' : '';
        mountArgs.push(`-v "${mount.source}:${mount.target}${ro}"`);
      }
    }

    // 构建环境变量参数
    const envArgs: string[] = [];
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        envArgs.push(`-e "${key}=${value}"`);
      }
    }

    // 创建容器
    const command = `docker run -d ${resourceArgs.join(' ')} ${mountArgs.join(' ')} ${envArgs.join(' ')} --name ${this.config.id} ${image} tail -f /dev/null`;
    
    this.containerId = (await this.execCommand(command)).trim();
  }

  /**
   * 销毁 Docker 容器
   */
  private async destroyContainer(): Promise<void> {
    if (this.containerId) {
      await this.execCommand(`docker stop ${this.containerId}`);
      await this.execCommand(`docker rm ${this.containerId}`);
      this.containerId = undefined;
    }
  }

  /**
   * 创建虚拟机
   */
  private async createVM(): Promise<void> {
    // TODO: 实现虚拟机创建
    throw new Error('VM isolation not implemented yet');
  }

  /**
   * 销毁虚拟机
   */
  private async destroyVM(): Promise<void> {
    // TODO: 实现虚拟机销毁
    throw new Error('VM isolation not implemented yet');
  }

  /**
   * 直接执行（无隔离）
   */
  private async executeDirect(request: ExecutionRequest, timeout: number): Promise<ExecutionResult> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      const proc = spawn(request.command, request.args || [], {
        cwd: request.workDir || this.config.workDir,
        env: { ...process.env, ...this.config.env, ...request.env },
        timeout
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number) => {
        resolve({
          id: request.id,
          success: code === 0,
          exitCode: code,
          stdout,
          stderr,
          duration: 0
        });
      });

      proc.on('error', (err: Error) => {
        resolve({
          id: request.id,
          success: false,
          exitCode: -1,
          stdout,
          stderr: err.message,
          duration: 0
        });
      });

      // 发送输入
      if (request.input) {
        proc.stdin?.write(request.input);
        proc.stdin?.end();
      }
    });
  }

  /**
   * 进程隔离执行
   */
  private async executeInProcess(request: ExecutionRequest, timeout: number): Promise<ExecutionResult> {
    // TODO: 实现进程隔离执行
    return this.executeDirect(request, timeout);
  }

  /**
   * 容器内执行
   */
  private async executeInContainer(request: ExecutionRequest, timeout: number): Promise<ExecutionResult> {
    if (!this.containerId) {
      throw new Error('Container not created');
    }

    // 构建执行命令
    const envArgs = request.env 
      ? Object.entries(request.env).map(([k, v]) => `-e "${k}=${v}"`).join(' ')
      : '';

    const workDir = request.workDir || this.config.workDir || '/workspace';
    const command = `docker exec ${envArgs} -w ${workDir} ${this.containerId} ${request.command} ${(request.args || []).join(' ')}`;

    const output = await this.execCommand(command, timeout);
    
    return {
      id: request.id,
      success: true,
      exitCode: 0,
      stdout: output,
      stderr: '',
      duration: 0
    };
  }

  /**
   * 虚拟机内执行
   */
  private async executeInVM(request: ExecutionRequest, timeout: number): Promise<ExecutionResult> {
    // TODO: 实现虚拟机内执行
    throw new Error('VM execution not implemented yet');
  }

  /**
   * 执行系统命令
   */
  private async execCommand(command: string, timeout: number = 30000): Promise<string> {
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      exec(command, { timeout }, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * 验证命令
   */
  private validateCommand(command: string): void {
    // 检查禁止的命令
    if (this.config.blockedCommands) {
      for (const blocked of this.config.blockedCommands) {
        if (command.includes(blocked)) {
          throw new Error(`Command blocked: ${blocked}`);
        }
      }
    }

    // 检查允许的命令（如果配置了白名单）
    if (this.config.allowedCommands && this.config.allowedCommands.length > 0) {
      const isAllowed = this.config.allowedCommands.some(allowed => 
        command.startsWith(allowed)
      );
      
      if (!isAllowed) {
        throw new Error(`Command not allowed: ${command}`);
      }
    }
  }

  /**
   * 启动资源监控
   */
  private startResourceMonitor(): void {
    this.resourceMonitor = setInterval(async () => {
      try {
        const usage = await this.getResourceUsage();
        
        // 检查资源限制
        if (this.config.resources.cpu && usage.cpu > this.config.resources.cpu * 100) {
          console.warn(`[Sandbox] CPU usage exceeded: ${usage.cpu}%`);
        }
        if (this.config.resources.memory && usage.memory > this.config.resources.memory) {
          console.warn(`[Sandbox] Memory usage exceeded: ${usage.memory}MB`);
        }
      } catch (error) {
        console.error('[Sandbox] Resource monitor error:', error);
      }
    }, 5000);
  }

  /**
   * 停止资源监控
   */
  private stopResourceMonitor(): void {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = undefined;
    }
  }
}

// ============================================================================
// Sandbox 管理器
// ============================================================================

/**
 * Sandbox 管理器配置
 */
export interface SandboxManagerConfig {
  /** 默认隔离级别 */
  defaultIsolationLevel?: IsolationLevel;
  /** 默认资源限制 */
  defaultResources?: ResourceLimits;
  /** 最大沙箱数 */
  maxSandboxes?: number;
  /** 默认镜像 */
  defaultImage?: string;
}

/**
 * Sandbox 管理器
 * 
 * 职责：
 * 1. 创建和管理多个沙箱
 * 2. 沙箱生命周期管理
 * 3. 资源池管理
 */
export class SandboxManager {
  /** 活跃的沙箱 */
  private sandboxes: Map<string, SandboxLayer> = new Map();
  
  /** 配置 */
  private readonly config: Required<SandboxManagerConfig>;
  
  /** 沙箱计数器 */
  private sandboxCounter: number = 0;

  constructor(config: SandboxManagerConfig = {}) {
    this.config = {
      defaultIsolationLevel: config.defaultIsolationLevel || IsolationLevel.CONTAINER,
      defaultResources: config.defaultResources || {
        cpu: 2,
        memory: 2048,
        disk: 10240,
        network: true,
        timeout: 60000
      },
      maxSandboxes: config.maxSandboxes || 50,
      defaultImage: config.defaultImage || 'ubuntu:22.04'
    };
  }

  /**
   * 创建沙箱
   */
  async createSandbox(
    isolationLevel?: IsolationLevel,
    resources?: ResourceLimits
  ): Promise<SandboxLayer> {
    if (this.sandboxes.size >= this.config.maxSandboxes) {
      throw new Error('Maximum sandboxes reached');
    }

    const sandboxId = this.generateSandboxId();
    const sandbox = new SandboxLayer({
      id: sandboxId,
      isolationLevel: isolationLevel || this.config.defaultIsolationLevel,
      resources: { ...this.config.defaultResources, ...resources },
      image: this.config.defaultImage
    });

    await sandbox.start();
    this.sandboxes.set(sandboxId, sandbox);

    return sandbox;
  }

  /**
   * 获取沙箱
   */
  getSandbox(sandboxId: string): SandboxLayer | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * 销毁沙箱
   */
  async destroySandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      await sandbox.stop();
      this.sandboxes.delete(sandboxId);
    }
  }

  /**
   * 销毁所有沙箱
   */
  async destroyAllSandboxes(): Promise<void> {
    for (const sandbox of this.sandboxes.values()) {
      await sandbox.stop();
    }
    this.sandboxes.clear();
  }

  /**
   * 获取活跃沙箱数
   */
  getActiveSandboxCount(): number {
    return this.sandboxes.size;
  }

  /**
   * 生成沙箱 ID
   */
  private generateSandboxId(): string {
    return `sbx_${Date.now()}_${++this.sandboxCounter}`;
  }
}

// ============================================================================
// 导出
// ============================================================================

export default SandboxLayer;
