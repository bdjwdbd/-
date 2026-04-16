/**
 * VFS 风格工具接口抽象
 * 
 * 借鉴 Linux VFS 的接口抽象设计，实现统一的工具操作接口
 * 
 * @module layers/ling-qu/vfs-tool-interface
 */

// ============ 类型定义 ============

/**
 * 工具类别
 */
export enum ToolCategory {
  /** 信息获取类 */
  INFORMATION = 'information',
  /** 操作执行类 */
  ACTION = 'action',
  /** 通信类 */
  COMMUNICATION = 'communication',
  /** 学习类 */
  LEARNING = 'learning',
  /** 系统类 */
  SYSTEM = 'system',
}

/**
 * 工具元数据
 */
export interface ToolMetadata {
  /** 工具名称 */
  name: string;
  /** 工具类别 */
  category: ToolCategory;
  /** 工具描述 */
  description: string;
  /** 版本 */
  version: string;
  /** 作者 */
  author?: string;
  /** 标签 */
  tags?: string[];
  /** 是否需要权限 */
  requiresPermission?: boolean;
  /** 是否支持流式输出 */
  supportsStreaming?: boolean;
  /** 是否支持取消 */
  supportsCancellation?: boolean;
}

/**
 * 工具参数定义
 */
export interface ToolParameterSchema {
  /** 参数名 */
  name: string;
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** 是否必需 */
  required: boolean;
  /** 描述 */
  description?: string;
  /** 默认值 */
  defaultValue?: unknown;
  /** 枚举值 */
  enum?: unknown[];
  /** 最小值（数字类型） */
  minimum?: number;
  /** 最大值（数字类型） */
  maximum?: number;
  /** 最小长度（字符串/数组类型） */
  minLength?: number;
  /** 最大长度（字符串/数组类型） */
  maxLength?: number;
}

/**
 * 工具结果
 */
export interface ToolResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  duration: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  /** 执行 ID */
  executionId: string;
  /** 开始时间 */
  startTime: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 取消信号 */
  cancellationToken?: { cancelled: boolean };
  /** 日志函数 */
  log?: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
  /** 用户 ID */
  userId?: string;
  /** 会话 ID */
  sessionId?: string;
}

// ============ VFS 风格操作接口 ============

/**
 * 工具操作接口（类似 VFS 的 file_operations）
 * 
 * 每个工具必须实现这个接口
 */
export interface ToolOperations<TParams = unknown, TResult = unknown> {
  /**
   * 验证参数
   * 
   * 类似 VFS 的权限检查
   */
  validate(params: unknown, context: ToolExecutionContext): params is TParams;

  /**
   * 执行工具
   * 
   * 类似 VFS 的 read/write 操作
   */
  execute(params: TParams, context: ToolExecutionContext): Promise<ToolResult<TResult>>;

  /**
   * 清理资源（可选）
   * 
   * 类似 VFS 的 release 操作
   */
  cleanup?(context: ToolExecutionContext): Promise<void>;

  /**
   * 取消执行（可选）
   * 
   * 类似 VFS 的 flush 操作
   */
  cancel?(context: ToolExecutionContext): Promise<void>;

  /**
   * 获取进度（可选）
   * 
   * 类似 VFS 的 ioctl 操作
   */
  getProgress?(context: ToolExecutionContext): Promise<number>;

  /**
   * 流式执行（可选）
   * 
   * 类似 VFS 的异步 I/O
   */
  executeStream?(
    params: TParams,
    context: ToolExecutionContext,
    onChunk: (chunk: TResult) => void
  ): Promise<ToolResult<TResult>>;
}

// ============ 工具定义 ============

/**
 * 完整的工具定义
 */
export interface ToolDefinition<TParams = unknown, TResult = unknown> {
  /** 元数据 */
  metadata: ToolMetadata;
  /** 参数模式 */
  parameters: ToolParameterSchema[];
  /** 操作接口 */
  operations: ToolOperations<TParams, TResult>;
}

// ============ 工具注册表 ============

/**
 * 工具注册表（类似 VFS 的文件系统注册）
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<ToolCategory, Set<string>> = new Map();

  /**
   * 注册工具
   */
  register<TParams, TResult>(definition: ToolDefinition<TParams, TResult>): void {
    const { metadata, operations } = definition;

    // 验证操作接口
    if (!operations.validate || !operations.execute) {
      throw new Error(`Tool ${metadata.name} must implement validate and execute`);
    }

    // 注册工具
    this.tools.set(metadata.name, definition);

    // 按类别索引
    if (!this.categories.has(metadata.category)) {
      this.categories.set(metadata.category, new Set());
    }
    this.categories.get(metadata.category)!.add(metadata.name);
  }

  /**
   * 注销工具
   */
  unregister(name: string): boolean {
    const definition = this.tools.get(name);
    if (!definition) return false;

    this.tools.delete(name);
    this.categories.get(definition.metadata.category)?.delete(name);

    return true;
  }

  /**
   * 获取工具
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取工具操作
   */
  getOperations<TParams = unknown, TResult = unknown>(
    name: string
  ): ToolOperations<TParams, TResult> | undefined {
    return this.tools.get(name)?.operations as ToolOperations<TParams, TResult>;
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 按类别获取工具
   */
  getByCategory(category: ToolCategory): ToolDefinition[] {
    const names = this.categories.get(category);
    if (!names) return [];

    return Array.from(names)
      .map((name) => this.tools.get(name)!)
      .filter(Boolean);
  }

  /**
   * 获取所有工具
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取工具名称列表
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 搜索工具
   */
  search(query: string): ToolDefinition[] {
    const lowerQuery = query.toLowerCase();

    return this.getAll().filter((tool) => {
      const { metadata } = tool;
      return (
        metadata.name.toLowerCase().includes(lowerQuery) ||
        metadata.description.toLowerCase().includes(lowerQuery) ||
        metadata.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }
}

// ============ 工具执行器 ============

/**
 * 工具执行器（类似 VFS 的 VFS 层）
 * 
 * 统一的工具执行入口，处理验证、执行、错误处理
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private executionCounter: number = 0;

  constructor(registry?: ToolRegistry) {
    this.registry = registry || new ToolRegistry();
  }

  /**
   * 执行工具
   */
  async execute<TResult = unknown>(
    toolName: string,
    params: unknown,
    options?: {
      timeout?: number;
      userId?: string;
      sessionId?: string;
    }
  ): Promise<ToolResult<TResult>> {
    const startTime = Date.now();

    // 获取工具定义
    const definition = this.registry.get(toolName);
    if (!definition) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        duration: Date.now() - startTime,
      };
    }

    // 创建执行上下文
    const context: ToolExecutionContext = {
      executionId: `exec-${++this.executionCounter}`,
      startTime,
      timeout: options?.timeout,
      cancellationToken: { cancelled: false },
      userId: options?.userId,
      sessionId: options?.sessionId,
    };

    const { operations } = definition;

    try {
      // 1. 验证参数
      if (!operations.validate(params, context)) {
        return {
          success: false,
          error: `Invalid parameters for tool: ${toolName}`,
          duration: Date.now() - startTime,
        };
      }

      // 2. 执行工具
      const result = await operations.execute(params, context);

      // 3. 清理资源
      if (operations.cleanup) {
        await operations.cleanup(context);
      }

      return result as ToolResult<TResult>;
    } catch (error) {
      // 错误处理
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 取消执行
   */
  async cancel(executionId: string): Promise<boolean> {
    // TODO: 实现取消逻辑
    return false;
  }

  /**
   * 获取注册表
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }
}

// ============ 工具构建器 ============

/**
 * 工具构建器（流式 API）
 */
export class ToolBuilder<TParams = unknown, TResult = unknown> {
  private metadata: Partial<ToolMetadata> = {};
  private parameters: ToolParameterSchema[] = [];
  private operations: Partial<ToolOperations<TParams, TResult>> = {};

  /**
   * 设置名称
   */
  name(name: string): this {
    this.metadata.name = name;
    return this;
  }

  /**
   * 设置类别
   */
  category(category: ToolCategory): this {
    this.metadata.category = category;
    return this;
  }

  /**
   * 设置描述
   */
  description(description: string): this {
    this.metadata.description = description;
    return this;
  }

  /**
   * 设置版本
   */
  version(version: string): this {
    this.metadata.version = version;
    return this;
  }

  /**
   * 添加参数
   */
  param(schema: ToolParameterSchema): this {
    this.parameters.push(schema);
    return this;
  }

  /**
   * 设置验证函数
   */
  validate(fn: ToolOperations<TParams, TResult>['validate']): this {
    this.operations.validate = fn;
    return this;
  }

  /**
   * 设置执行函数
   */
  execute(fn: ToolOperations<TParams, TResult>['execute']): this {
    this.operations.execute = fn;
    return this;
  }

  /**
   * 设置清理函数
   */
  cleanup(fn: ToolOperations<TParams, TResult>['cleanup']): this {
    this.operations.cleanup = fn;
    return this;
  }

  /**
   * 构建工具定义
   */
  build(): ToolDefinition<TParams, TResult> {
    if (!this.metadata.name) {
      throw new Error('Tool name is required');
    }
    if (!this.metadata.category) {
      throw new Error('Tool category is required');
    }
    if (!this.metadata.description) {
      throw new Error('Tool description is required');
    }
    if (!this.operations.validate) {
      throw new Error('Tool validate function is required');
    }
    if (!this.operations.execute) {
      throw new Error('Tool execute function is required');
    }

    return {
      metadata: {
        name: this.metadata.name,
        category: this.metadata.category,
        description: this.metadata.description,
        version: this.metadata.version || '1.0.0',
        author: this.metadata.author,
        tags: this.metadata.tags,
        requiresPermission: this.metadata.requiresPermission,
        supportsStreaming: this.metadata.supportsStreaming,
        supportsCancellation: this.metadata.supportsCancellation,
      },
      parameters: this.parameters,
      operations: this.operations as ToolOperations<TParams, TResult>,
    };
  }
}

/**
 * 创建工具构建器
 */
export function createTool<TParams = unknown, TResult = unknown>(): ToolBuilder<TParams, TResult> {
  return new ToolBuilder<TParams, TResult>();
}

// ============ 导出 ============

export default ToolExecutor;
