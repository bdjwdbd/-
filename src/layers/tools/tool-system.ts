/**
 * 42 个工具系统 + fail-closed 安全机制
 * 
 * 借鉴：Claude Code
 * 
 * 工具分类：
 * 1. 文件操作（10 个）：Read, Write, Edit, Delete, List, Copy, Move, Search, Grep, Find
 * 2. 代码执行（8 个）：Bash, Python, Node, Shell, TypeScript, Rust, Go, Java
 * 3. 网络请求（6 个）：Http, WebSocket, DNS, Curl, Wget, Ping
 * 4. Git 操作（6 个）：Status, Commit, Push, Pull, Branch, Merge
 * 5. 记忆操作（6 个）：Add, Search, Update, Delete, Promote, Query
 * 6. 其他工具（6 个）：Schedule, Notify, Log, Timer, Env, Help
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 工具风险级别
 */
export enum ToolRiskLevel {
  /** 安全 - 无副作用 */
  SAFE = 'safe',
  /** 低风险 - 可逆操作 */
  LOW = 'low',
  /** 中风险 - 需要确认 */
  MEDIUM = 'medium',
  /** 高风险 - 需要二次确认 */
  HIGH = 'high',
  /** 危险 - 需要特殊授权 */
  DANGEROUS = 'dangerous'
}

/**
 * 工具状态
 */
export enum ToolState {
  /** 启用 */
  ENABLED = 'enabled',
  /** 禁用 */
  DISABLED = 'disabled',
  /** 需要确认 */
  REQUIRES_CONFIRMATION = 'requires_confirmation',
  /** 需要授权 */
  REQUIRES_AUTHORIZATION = 'requires_authorization'
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 参数 Schema */
  parameters: JSONSchema;
  /** 风险级别 */
  riskLevel: ToolRiskLevel;
  /** 状态 */
  state: ToolState;
  /** 是否需要确认 */
  requiresConfirmation: boolean;
  /** 是否危险 */
  isDangerous: boolean;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 标签 */
  tags: string[];
  /** 示例 */
  examples?: Array<{
    input: Record<string, unknown>;
    output: string;
  }>;
}

/**
 * JSON Schema 定义
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
    required?: boolean;
  }>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  /** 调用 ID */
  callId: string;
  /** 工具名称 */
  toolName: string;
  /** 参数 */
  arguments: Record<string, unknown>;
  /** 上下文 */
  context?: {
    sessionId?: string;
    userId?: string;
    workingDirectory?: string;
    environment?: Record<string, string>;
  };
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  /** 调用 ID */
  callId: string;
  /** 工具名称 */
  toolName: string;
  /** 是否成功 */
  success: boolean;
  /** 结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  duration: number;
  /** 重试次数 */
  retries: number;
  /** 是否被拒绝 */
  rejected?: boolean;
  /** 拒绝原因 */
  rejectionReason?: string;
}

/**
 * 工具执行器
 */
export type ToolExecutor = (
  args: Record<string, unknown>,
  context?: ToolCallRequest['context']
) => Promise<unknown>;

/**
 * 权限检查函数
 */
export type PermissionChecker = (
  toolName: string,
  args: Record<string, unknown>,
  context?: ToolCallRequest['context']
) => Promise<{
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}>;

// ============================================================================
// fail-closed 安全机制
// ============================================================================

/**
 * fail-closed 安全策略
 * 
 * 核心原则：
 * 1. 默认拒绝 - 所有工具默认禁用
 * 2. 显式授权 - 必须用户明确授权
 * 3. 最小权限 - 只授予必要权限
 * 4. 审计追踪 - 记录所有操作
 */
export class FailClosedSecurityPolicy {
  /** 工具权限映射 */
  private toolPermissions: Map<string, ToolState> = new Map();
  
  /** 危险命令黑名单 */
  private dangerousPatterns: RegExp[] = [
    /rm\s+-rf\s+\//, // 删除根目录
    /sudo\s+/, // sudo 命令
    /chmod\s+777/, // 危险权限
    />\s*\/dev\/sd/, // 写入磁盘设备
    /mkfs/, // 格式化
    /dd\s+if=/, // dd 命令
    /:(){ :|:& };:/, // Fork 炸弹
    /curl.*\|\s*bash/, // 远程脚本执行
    /wget.*\|\s*bash/, // 远程脚本执行
  ];

  /** 敏感文件黑名单 */
  private sensitiveFiles: RegExp[] = [
    /\/etc\/passwd/,
    /\/etc\/shadow/,
    /\/\.ssh\//,
    /\/\.gnupg\//,
    /\/\.env/,
    /\.pem$/,
    /\.key$/,
    /credentials/i,
    /secrets?\.json$/i,
  ];

  constructor() {
    // 默认所有工具禁用
    this.initializeDefaultPolicy();
  }

  /**
   * 初始化默认策略
   */
  private initializeDefaultPolicy(): void {
    // 安全工具默认启用
    const safeTools = [
      'read', 'list', 'search', 'grep', 'find',
      'http_get', 'ping',
      'git_status', 'git_log',
      'memory_search', 'memory_query',
      'help', 'env'
    ];

    for (const tool of safeTools) {
      this.toolPermissions.set(tool, ToolState.ENABLED);
    }

    // 低风险工具需要确认
    const lowRiskTools = [
      'write', 'edit', 'copy', 'move',
      'bash', 'python', 'node',
      'http_post', 'curl', 'wget',
      'git_commit', 'git_push', 'git_pull',
      'memory_add', 'memory_update'
    ];

    for (const tool of lowRiskTools) {
      this.toolPermissions.set(tool, ToolState.REQUIRES_CONFIRMATION);
    }

    // 高风险工具需要授权
    const highRiskTools = [
      'delete',
      'shell',
      'git_merge', 'git_reset',
      'memory_delete'
    ];

    for (const tool of highRiskTools) {
      this.toolPermissions.set(tool, ToolState.REQUIRES_AUTHORIZATION);
    }
  }

  /**
   * 检查工具权限
   */
  async checkPermission(
    toolName: string,
    args: Record<string, unknown>,
    context?: ToolCallRequest['context']
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiresConfirmation?: boolean;
  }> {
    // 1. 检查工具状态
    const state = this.toolPermissions.get(toolName);
    
    if (!state || state === ToolState.DISABLED) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' is disabled by security policy`
      };
    }

    if (state === ToolState.REQUIRES_AUTHORIZATION) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' requires explicit authorization`,
        requiresConfirmation: true
      };
    }

    if (state === ToolState.REQUIRES_CONFIRMATION) {
      return {
        allowed: true,
        reason: `Tool '${toolName}' requires user confirmation`,
        requiresConfirmation: true
      };
    }

    // 2. 检查危险命令
    if (args.command && typeof args.command === 'string') {
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(args.command)) {
          return {
            allowed: false,
            reason: `Command matches dangerous pattern: ${pattern.source}`
          };
        }
      }
    }

    // 3. 检查敏感文件
    const filePaths = [
      args.path,
      args.file,
      args.source,
      args.target,
      args.directory
    ].filter(Boolean);

    for (const path of filePaths) {
      if (typeof path === 'string') {
        for (const pattern of this.sensitiveFiles) {
          if (pattern.test(path)) {
            return {
              allowed: false,
              reason: `Access to sensitive file is blocked: ${path}`
            };
          }
        }
      }
    }

    // 4. 检查网络访问
    if (args.url && typeof args.url === 'string') {
      // 阻止访问内网地址
      const privateRanges = [
        /^https?:\/\/localhost/i,
        /^https?:\/\/127\./i,
        /^https?:\/\/10\./i,
        /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./i,
        /^https?:\/\/192\.168\./i,
      ];

      for (const range of privateRanges) {
        if (range.test(args.url)) {
          return {
            allowed: false,
            reason: `Access to private network is blocked: ${args.url}`
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * 授权工具
   */
  authorizeTool(toolName: string, permanent: boolean = false): void {
    this.toolPermissions.set(toolName, ToolState.ENABLED);
  }

  /**
   * 禁用工具
   */
  disableTool(toolName: string): void {
    this.toolPermissions.set(toolName, ToolState.DISABLED);
  }

  /**
   * 获取工具状态
   */
  getToolState(toolName: string): ToolState | undefined {
    return this.toolPermissions.get(toolName);
  }

  /**
   * 获取所有启用的工具
   */
  getEnabledTools(): string[] {
    return Array.from(this.toolPermissions.entries())
      .filter(([_, state]) => state === ToolState.ENABLED)
      .map(([name]) => name);
  }

  /**
   * 获取需要确认的工具
   */
  getToolsRequiringConfirmation(): string[] {
    return Array.from(this.toolPermissions.entries())
      .filter(([_, state]) => 
        state === ToolState.REQUIRES_CONFIRMATION || 
        state === ToolState.REQUIRES_AUTHORIZATION
      )
      .map(([name]) => name);
  }
}

// ============================================================================
// 工具注册表
// ============================================================================

/**
 * 工具注册表
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private executors: Map<string, ToolExecutor> = new Map();
  private securityPolicy: FailClosedSecurityPolicy;

  constructor(securityPolicy?: FailClosedSecurityPolicy) {
    this.securityPolicy = securityPolicy || new FailClosedSecurityPolicy();
    this.registerDefaultTools();
  }

  /**
   * 注册默认工具
   */
  private registerDefaultTools(): void {
    // 文件操作工具
    this.registerFileTools();
    
    // 代码执行工具
    this.registerExecutionTools();
    
    // 网络请求工具
    this.registerNetworkTools();
    
    // Git 操作工具
    this.registerGitTools();
    
    // 记忆操作工具
    this.registerMemoryTools();
    
    // 其他工具
    this.registerUtilityTools();
  }

  /**
   * 注册文件操作工具
   */
  private registerFileTools(): void {
    // Read
    this.register({
      name: 'read',
      description: 'Read file contents',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
          offset: { type: 'number', description: 'Start line number' },
          limit: { type: 'number', description: 'Number of lines to read' }
        },
        required: ['path']
      },
      riskLevel: ToolRiskLevel.SAFE,
      state: ToolState.ENABLED,
      requiresConfirmation: false,
      isDangerous: false,
      timeout: 30000,
      maxRetries: 2,
      tags: ['file', 'read', 'safe']
    });

    // Write
    this.register({
      name: 'write',
      description: 'Write content to file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
      },
      riskLevel: ToolRiskLevel.LOW,
      state: ToolState.REQUIRES_CONFIRMATION,
      requiresConfirmation: true,
      isDangerous: false,
      timeout: 30000,
      maxRetries: 2,
      tags: ['file', 'write']
    });

    // Edit
    this.register({
      name: 'edit',
      description: 'Edit file by replacing text',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to edit' },
          oldText: { type: 'string', description: 'Text to replace' },
          newText: { type: 'string', description: 'New text' }
        },
        required: ['path', 'oldText', 'newText']
      },
      riskLevel: ToolRiskLevel.LOW,
      state: ToolState.REQUIRES_CONFIRMATION,
      requiresConfirmation: true,
      isDangerous: false,
      timeout: 30000,
      maxRetries: 2,
      tags: ['file', 'edit']
    });

    // Delete
    this.register({
      name: 'delete',
      description: 'Delete file or directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to delete' }
        },
        required: ['path']
      },
      riskLevel: ToolRiskLevel.HIGH,
      state: ToolState.REQUIRES_AUTHORIZATION,
      requiresConfirmation: true,
      isDangerous: true,
      timeout: 30000,
      maxRetries: 0,
      tags: ['file', 'delete', 'dangerous']
    });

    // List
    this.register({
      name: 'list',
      description: 'List directory contents',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
          recursive: { type: 'boolean', description: 'List recursively' }
        },
        required: ['path']
      },
      riskLevel: ToolRiskLevel.SAFE,
      state: ToolState.ENABLED,
      requiresConfirmation: false,
      isDangerous: false,
      timeout: 30000,
      maxRetries: 2,
      tags: ['file', 'list', 'safe']
    });

    // Copy
    this.register({
      name: 'copy',
      description: 'Copy file or directory',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path' },
          target: { type: 'string', description: 'Target path' }
        },
        required: ['source', 'target']
      },
      riskLevel: ToolRiskLevel.LOW,
      state: ToolState.REQUIRES_CONFIRMATION,
      requiresConfirmation: true,
      isDangerous: false,
      timeout: 60000,
      maxRetries: 2,
      tags: ['file', 'copy']
    });

    // Move
    this.register({
      name: 'move',
      description: 'Move file or directory',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path' },
          target: { type: 'string', description: 'Target path' }
        },
        required: ['source', 'target']
      },
      riskLevel: ToolRiskLevel.LOW,
      state: ToolState.REQUIRES_CONFIRMATION,
      requiresConfirmation: true,
      isDangerous: false,
      timeout: 30000,
      maxRetries: 2,
      tags: ['file', 'move']
    });

    // Search
    this.register({
      name: 'search',
      description: 'Search for files by name',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Search directory' },
          pattern: { type: 'string', description: 'Search pattern' }
        },
        required: ['path', 'pattern']
      },
      riskLevel: ToolRiskLevel.SAFE,
      state: ToolState.ENABLED,
      requiresConfirmation: false,
      isDangerous: false,
      timeout: 60000,
      maxRetries: 2,
      tags: ['file', 'search', 'safe']
    });

    // Grep
    this.register({
      name: 'grep',
      description: 'Search for text in files',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Search directory' },
          pattern: { type: 'string', description: 'Search pattern' },
          filePattern: { type: 'string', description: 'File pattern' }
        },
        required: ['path', 'pattern']
      },
      riskLevel: ToolRiskLevel.SAFE,
      state: ToolState.ENABLED,
      requiresConfirmation: false,
      isDangerous: false,
      timeout: 60000,
      maxRetries: 2,
      tags: ['file', 'grep', 'safe']
    });

    // Find
    this.register({
      name: 'find',
      description: 'Find files matching criteria',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Search directory' },
          name: { type: 'string', description: 'File name pattern' },
          type: { type: 'string', enum: ['file', 'directory'], description: 'File type' }
        },
        required: ['path']
      },
      riskLevel: ToolRiskLevel.SAFE,
      state: ToolState.ENABLED,
      requiresConfirmation: false,
      isDangerous: false,
      timeout: 60000,
      maxRetries: 2,
      tags: ['file', 'find', 'safe']
    });
  }

  /**
   * 注册代码执行工具
   */
  private registerExecutionTools(): void {
    const executionTools = [
      { name: 'bash', description: 'Execute bash command', language: 'bash' },
      { name: 'python', description: 'Execute Python code', language: 'python' },
      { name: 'node', description: 'Execute Node.js code', language: 'javascript' },
      { name: 'shell', description: 'Execute shell command', language: 'shell' },
      { name: 'typescript', description: 'Execute TypeScript code', language: 'typescript' },
      { name: 'rust', description: 'Execute Rust code', language: 'rust' },
      { name: 'go', description: 'Execute Go code', language: 'go' },
      { name: 'java', description: 'Execute Java code', language: 'java' }
    ];

    for (const tool of executionTools) {
      this.register({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code to execute' },
            timeout: { type: 'number', description: 'Execution timeout (ms)' }
          },
          required: ['code']
        },
        riskLevel: tool.name === 'shell' ? ToolRiskLevel.HIGH : ToolRiskLevel.MEDIUM,
        state: ToolState.REQUIRES_CONFIRMATION,
        requiresConfirmation: true,
        isDangerous: tool.name === 'shell',
        timeout: 120000,
        maxRetries: 1,
        tags: ['execution', tool.language]
      });
    }
  }

  /**
   * 注册网络请求工具
   */
  private registerNetworkTools(): void {
    const networkTools = [
      { name: 'http_get', description: 'HTTP GET request', method: 'GET' },
      { name: 'http_post', description: 'HTTP POST request', method: 'POST' },
      { name: 'curl', description: 'Execute curl command', method: 'curl' },
      { name: 'wget', description: 'Execute wget command', method: 'wget' },
      { name: 'ping', description: 'Ping host', method: 'ping' },
      { name: 'dns', description: 'DNS lookup', method: 'dns' }
    ];

    for (const tool of networkTools) {
      this.register({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL' },
            headers: { type: 'object', description: 'Headers' },
            body: { type: 'string', description: 'Request body' }
          },
          required: ['url']
        },
        riskLevel: tool.method === 'POST' ? ToolRiskLevel.MEDIUM : ToolRiskLevel.LOW,
        state: tool.name === 'ping' || tool.name === 'dns' ? ToolState.ENABLED : ToolState.REQUIRES_CONFIRMATION,
        requiresConfirmation: tool.method === 'POST' || tool.method === 'curl' || tool.method === 'wget',
        isDangerous: false,
        timeout: 60000,
        maxRetries: 2,
        tags: ['network', tool.method]
      });
    }
  }

  /**
   * 注册 Git 操作工具
   */
  private registerGitTools(): void {
    const gitTools = [
      { name: 'git_status', description: 'Git status', riskLevel: ToolRiskLevel.SAFE, requiresConfirmation: false },
      { name: 'git_log', description: 'Git log', riskLevel: ToolRiskLevel.SAFE, requiresConfirmation: false },
      { name: 'git_commit', description: 'Git commit', riskLevel: ToolRiskLevel.LOW, requiresConfirmation: true },
      { name: 'git_push', description: 'Git push', riskLevel: ToolRiskLevel.MEDIUM, requiresConfirmation: true },
      { name: 'git_pull', description: 'Git pull', riskLevel: ToolRiskLevel.LOW, requiresConfirmation: true },
      { name: 'git_branch', description: 'Git branch operations', riskLevel: ToolRiskLevel.MEDIUM, requiresConfirmation: true }
    ];

    for (const tool of gitTools) {
      this.register({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {
            args: { type: 'string', description: 'Git arguments' }
          },
          required: []
        },
        riskLevel: tool.riskLevel,
        state: tool.requiresConfirmation ? ToolState.REQUIRES_CONFIRMATION : ToolState.ENABLED,
        requiresConfirmation: tool.requiresConfirmation,
        isDangerous: false,
        timeout: 60000,
        maxRetries: 2,
        tags: ['git', 'version-control']
      });
    }
  }

  /**
   * 注册记忆操作工具
   */
  private registerMemoryTools(): void {
    const memoryTools = [
      { name: 'memory_add', description: 'Add memory entry', riskLevel: ToolRiskLevel.LOW },
      { name: 'memory_search', description: 'Search memory', riskLevel: ToolRiskLevel.SAFE },
      { name: 'memory_update', description: 'Update memory entry', riskLevel: ToolRiskLevel.LOW },
      { name: 'memory_delete', description: 'Delete memory entry', riskLevel: ToolRiskLevel.HIGH },
      { name: 'memory_promote', description: 'Promote memory to higher layer', riskLevel: ToolRiskLevel.LOW },
      { name: 'memory_query', description: 'Query memory across layers', riskLevel: ToolRiskLevel.SAFE }
    ];

    for (const tool of memoryTools) {
      this.register({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {
            layer: { type: 'string', description: 'Memory layer' },
            content: { type: 'string', description: 'Memory content' },
            query: { type: 'string', description: 'Search query' }
          },
          required: []
        },
        riskLevel: tool.riskLevel,
        state: tool.riskLevel === ToolRiskLevel.HIGH ? ToolState.REQUIRES_AUTHORIZATION : 
               tool.riskLevel === ToolRiskLevel.SAFE ? ToolState.ENABLED : ToolState.REQUIRES_CONFIRMATION,
        requiresConfirmation: tool.riskLevel !== ToolRiskLevel.SAFE,
        isDangerous: tool.riskLevel === ToolRiskLevel.HIGH,
        timeout: 30000,
        maxRetries: 2,
        tags: ['memory']
      });
    }
  }

  /**
   * 注册其他工具
   */
  private registerUtilityTools(): void {
    const utilityTools = [
      { name: 'schedule', description: 'Schedule a task', riskLevel: ToolRiskLevel.LOW },
      { name: 'notify', description: 'Send notification', riskLevel: ToolRiskLevel.LOW },
      { name: 'log', description: 'Log message', riskLevel: ToolRiskLevel.SAFE },
      { name: 'timer', description: 'Timer operations', riskLevel: ToolRiskLevel.SAFE },
      { name: 'env', description: 'Environment variables', riskLevel: ToolRiskLevel.SAFE },
      { name: 'help', description: 'Get help', riskLevel: ToolRiskLevel.SAFE }
    ];

    for (const tool of utilityTools) {
      this.register({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {},
          required: []
        },
        riskLevel: tool.riskLevel,
        state: ToolState.ENABLED,
        requiresConfirmation: false,
        isDangerous: false,
        timeout: 10000,
        maxRetries: 1,
        tags: ['utility']
      });
    }
  }

  /**
   * 注册工具
   */
  register(
    definition: ToolDefinition,
    executor?: ToolExecutor
  ): void {
    this.tools.set(definition.name, definition);
    if (executor) {
      this.executors.set(definition.name, executor);
    }
  }

  /**
   * 获取工具定义
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取工具执行器
   */
  getExecutor(name: string): ToolExecutor | undefined {
    return this.executors.get(name);
  }

  /**
   * 获取所有工具
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按标签获取工具
   */
  getByTag(tag: string): ToolDefinition[] {
    return this.getAll().filter(t => t.tags.includes(tag));
  }

  /**
   * 获取安全策略
   */
  getSecurityPolicy(): FailClosedSecurityPolicy {
    return this.securityPolicy;
  }
}

// ============================================================================
// 工具执行器
// ============================================================================

/**
 * 工具执行器配置
 */
export interface ToolExecutorConfig {
  /** 默认超时 */
  defaultTimeout?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 权限检查器 */
  permissionChecker?: PermissionChecker;
  /** 审计日志 */
  auditLog?: (entry: {
    toolName: string;
    args: Record<string, unknown>;
    result: ToolCallResult;
    timestamp: number;
  }) => void;
}

/**
 * 工具执行器
 */
export class ToolExecutorService {
  private registry: ToolRegistry;
  private config: Required<ToolExecutorConfig>;

  constructor(registry: ToolRegistry, config: ToolExecutorConfig = {}) {
    this.registry = registry;
    this.config = {
      defaultTimeout: config.defaultTimeout || 60000,
      maxRetries: config.maxRetries || 3,
      permissionChecker: config.permissionChecker || 
        registry.getSecurityPolicy().checkPermission.bind(registry.getSecurityPolicy()),
      auditLog: config.auditLog || (() => {})
    };
  }

  /**
   * 执行工具
   */
  async execute(request: ToolCallRequest): Promise<ToolCallResult> {
    const startTime = Date.now();
    const tool = this.registry.get(request.toolName);

    // 1. 检查工具是否存在
    if (!tool) {
      return {
        callId: request.callId,
        toolName: request.toolName,
        success: false,
        error: `Tool not found: ${request.toolName}`,
        duration: Date.now() - startTime,
        retries: 0,
        rejected: true,
        rejectionReason: 'Tool not registered'
      };
    }

    // 2. 检查权限
    const permission = await this.config.permissionChecker(
      request.toolName,
      request.arguments,
      request.context
    );

    if (!permission.allowed) {
      return {
        callId: request.callId,
        toolName: request.toolName,
        success: false,
        error: permission.reason,
        duration: Date.now() - startTime,
        retries: 0,
        rejected: true,
        rejectionReason: permission.reason
      };
    }

    // 3. 如果需要确认，返回待确认状态
    if (permission.requiresConfirmation) {
      return {
        callId: request.callId,
        toolName: request.toolName,
        success: false,
        error: 'Tool requires user confirmation',
        duration: Date.now() - startTime,
        retries: 0,
        rejected: false,
        rejectionReason: 'Requires confirmation'
      };
    }

    // 4. 执行工具
    const executor = this.registry.getExecutor(request.toolName);
    if (!executor) {
      return {
        callId: request.callId,
        toolName: request.toolName,
        success: false,
        error: `No executor for tool: ${request.toolName}`,
        duration: Date.now() - startTime,
        retries: 0
      };
    }

    // 5. 带重试的执行
    let retries = 0;
    let lastError: string | undefined;

    while (retries <= tool.maxRetries) {
      try {
        const timeout = tool.timeout || this.config.defaultTimeout;
        const result = await Promise.race([
          executor(request.arguments, request.context),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
          )
        ]);

        const toolResult: ToolCallResult = {
          callId: request.callId,
          toolName: request.toolName,
          success: true,
          result,
          duration: Date.now() - startTime,
          retries
        };

        // 审计日志
        this.config.auditLog({
          toolName: request.toolName,
          args: request.arguments,
          result: toolResult,
          timestamp: Date.now()
        });

        return toolResult;

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retries++;

        if (retries <= tool.maxRetries) {
          // 指数退避
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retries) * 1000)
          );
        }
      }
    }

    const toolResult: ToolCallResult = {
      callId: request.callId,
      toolName: request.toolName,
      success: false,
      error: lastError,
      duration: Date.now() - startTime,
      retries
    };

    // 审计日志
    this.config.auditLog({
      toolName: request.toolName,
      args: request.arguments,
      result: toolResult,
      timestamp: Date.now()
    });

    return toolResult;
  }

  /**
   * 批量执行工具
   */
  async executeBatch(requests: ToolCallRequest[]): Promise<ToolCallResult[]> {
    return Promise.all(requests.map(r => this.execute(r)));
  }
}

// ============================================================================
// 导出
// ============================================================================

export default ToolRegistry;
