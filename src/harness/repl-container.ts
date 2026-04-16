/**
 * REPL 容器 - 带边界控制的执行容器
 * 
 * Read → Eval → Print → Loop
 * 
 * 核心机制：
 * - Read: 结构化灌入信息
 * - Eval: 拦截路由监控
 * - Print: 统一反馈组装
 * - Loop: 循环直到达标
 * 
 * 来源：Harness Engineering 文档
 * 
 * @module harness/repl-container
 */

// ============ 类型定义 ============

export interface REPLConfig {
  /** 输入过滤器 */
  inputFilter?: (input: any) => any;
  /** 输出过滤器 */
  outputFilter?: (output: any) => any;
  /** 执行拦截器 */
  interceptors?: REPLInterceptor[];
  /** 最大循环次数 */
  maxLoops: number;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 是否记录日志 */
  enableLogging: boolean;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface REPLInterceptor {
  /** 拦截器名称 */
  name: string;
  /** 拦截函数，返回 false 阻止执行 */
  intercept: (context: REPLContext) => boolean | Promise<boolean>;
  /** 优先级（数字越小越先执行） */
  priority: number;
}

export interface REPLContext {
  /** 输入数据 */
  input: any;
  /** 当前状态 */
  state: 'init' | 'read' | 'eval' | 'execute' | 'print' | 'loop' | 'done' | 'error';
  /** 输出数据 */
  output?: any;
  /** 错误信息 */
  error?: Error;
  /** 元数据 */
  metadata: Record<string, any>;
  /** 循环次数 */
  loopCount: number;
  /** 开始时间 */
  startTime: number;
  /** 执行历史 */
  history: REPLHistoryEntry[];
}

export interface REPLHistoryEntry {
  /** 状态 */
  state: REPLContext['state'];
  /** 时间戳 */
  timestamp: number;
  /** 数据 */
  data?: any;
  /** 耗时（毫秒） */
  duration?: number;
}

export interface REPLResult<TOutput> {
  /** 输出结果 */
  output: TOutput;
  /** 上下文 */
  context: REPLContext;
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 循环次数 */
  loops: number;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: Partial<REPLConfig> = {
  maxLoops: 10,
  timeout: 30000,
  enableLogging: true,
  logLevel: 'info',
  interceptors: [],
};

// ============ REPL 容器类 ============

/**
 * REPL 容器 - 带边界控制的执行容器
 * 
 * 使用示例：
 * ```typescript
 * const repl = new REPLContainer({
 *   maxLoops: 5,
 *   timeout: 10000,
 *   interceptors: [
 *     {
 *       name: '权限检查',
 *       intercept: (ctx) => ctx.input.userId != null,
 *       priority: 1,
 *     },
 *   ],
 * });
 * 
 * const { output, loops } = await repl.run(input, async (ctx) => {
 *   // 执行逻辑
 *   return result;
 * });
 * ```
 */
export class REPLContainer {
  private config: REPLConfig;
  private context: REPLContext;

  constructor(config: Partial<REPLConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as REPLConfig;
    
    this.context = this.createInitialContext();
  }

  /**
   * 执行 REPL 循环
   */
  async run<TInput, TOutput>(
    input: TInput,
    executor: (ctx: REPLContext) => Promise<TOutput>
  ): Promise<REPLResult<TOutput>> {
    this.context = this.createInitialContext();
    this.context.startTime = Date.now();

    try {
      // ========== Read: 结构化输入 ==========
      await this.transitionTo('read');
      this.context.input = this.config.inputFilter 
        ? this.config.inputFilter(input) 
        : input;
      this.log('info', `[REPL] Read: 输入已处理`);

      // ========== 主循环 ==========
      while (this.context.loopCount < this.config.maxLoops) {
        // 检查超时
        if (Date.now() - this.context.startTime > this.config.timeout) {
          throw new Error(`REPL 容器超时 (${this.config.timeout}ms)`);
        }

        // ========== Eval: 执行拦截 ==========
        await this.transitionTo('eval');
        const shouldContinue = await this.runInterceptors();
        
        if (!shouldContinue) {
          throw new Error('REPL 拦截器阻止执行');
        }
        this.log('info', `[REPL] Eval: 拦截器检查通过`);

        // ========== Execute: 执行 ==========
        await this.transitionTo('execute');
        const output = await executor(this.context);
        this.log('info', `[REPL] Execute: 执行完成`);

        // ========== Print: 输出过滤 ==========
        await this.transitionTo('print');
        this.context.output = this.config.outputFilter 
          ? this.config.outputFilter(output) 
          : output;
        this.log('info', `[REPL] Print: 输出已处理`);

        // ========== 检查是否需要继续循环 ==========
        if (this.shouldContinue(this.context.output)) {
          this.context.loopCount++;
          await this.transitionTo('loop');
          this.log('info', `[REPL] Loop: 继续循环 (${this.context.loopCount})`);
          continue;
        }

        // ========== Done: 完成 ==========
        await this.transitionTo('done');
        this.log('info', `[REPL] Done: 执行完成`);

        return {
          output: this.context.output as TOutput,
          context: this.context,
          totalDuration: Date.now() - this.context.startTime,
          loops: this.context.loopCount,
        };
      }

      // 达到最大循环次数
      throw new Error(`REPL 达到最大循环次数 ${this.config.maxLoops}`);

    } catch (error) {
      // ========== Error: 错误处理 ==========
      await this.transitionTo('error');
      this.context.error = error instanceof Error ? error : new Error(String(error));
      this.log('error', `[REPL] Error: ${this.context.error.message}`);
      throw error;
    }
  }

  /**
   * 状态转换
   */
  private async transitionTo(state: REPLContext['state']): Promise<void> {
    const previousState = this.context.state;
    this.context.state = state;
    
    this.context.history.push({
      state,
      timestamp: Date.now(),
      data: state === 'read' ? this.context.input : 
            state === 'print' ? this.context.output : undefined,
    });

    this.log('debug', `[REPL] 状态转换: ${previousState} → ${state}`);
  }

  /**
   * 运行拦截器
   */
  private async runInterceptors(): Promise<boolean> {
    if (!this.config.interceptors || this.config.interceptors.length === 0) {
      return true;
    }

    // 按优先级排序
    const sortedInterceptors = [...this.config.interceptors]
      .sort((a, b) => a.priority - b.priority);

    for (const interceptor of sortedInterceptors) {
      try {
        const result = await interceptor.intercept(this.context);
        if (!result) {
          this.log('warn', `[REPL] 拦截器 "${interceptor.name}" 阻止执行`);
          return false;
        }
        this.log('debug', `[REPL] 拦截器 "${interceptor.name}" 通过`);
      } catch (error) {
        this.log('error', `[REPL] 拦截器 "${interceptor.name}" 错误: ${error}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 判断是否需要继续循环
   */
  private shouldContinue(output: any): boolean {
    // 如果输出包含 "continue" 标记，则继续
    if (output?.continue === true) {
      return true;
    }
    
    // 如果输出包含 "needsMoreWork" 标记，则继续
    if (output?.needsMoreWork === true) {
      return true;
    }

    return false;
  }

  /**
   * 创建初始上下文
   */
  private createInitialContext(): REPLContext {
    return {
      input: null,
      state: 'init',
      metadata: {},
      loopCount: 0,
      startTime: 0,
      history: [],
    };
  }

  /**
   * 日志记录
   */
  private log(level: REPLConfig['logLevel'], message: string): void {
    if (!this.config.enableLogging) return;
    
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[this.config.logLevel]) return;

    console.log(message);
  }

  /**
   * 获取上下文
   */
  getContext(): REPLContext {
    return this.context;
  }
}

// ============ 工厂函数 ============

/**
 * 创建 REPL 容器实例
 */
export function createREPLContainer(config: Partial<REPLConfig> = {}): REPLContainer {
  return new REPLContainer(config);
}

// ============ 预设拦截器 ============

/**
 * 常用拦截器
 */
export const CommonInterceptors = {
  /** 非空输入检查 */
  notNullInput: (): REPLInterceptor => ({
    name: '非空输入检查',
    priority: 1,
    intercept: (ctx) => ctx.input != null,
  }),

  /** 权限检查 */
  requireAuth: (checkFn: (ctx: REPLContext) => boolean): REPLInterceptor => ({
    name: '权限检查',
    priority: 1,
    intercept: (ctx) => checkFn(ctx),
  }),

  /** 速率限制 */
  rateLimit: (maxCalls: number, windowMs: number): REPLInterceptor => {
    const calls: number[] = [];
    return {
      name: '速率限制',
      priority: 2,
      intercept: (ctx) => {
        const now = Date.now();
        // 清理过期记录
        while (calls.length > 0 && calls[0] < now - windowMs) {
          calls.shift();
        }
        // 检查是否超限
        if (calls.length >= maxCalls) {
          return false;
        }
        calls.push(now);
        return true;
      },
    };
  },

  /** 输入验证 */
  validateInput: (validator: (input: any) => boolean): REPLInterceptor => ({
    name: '输入验证',
    priority: 3,
    intercept: (ctx) => validator(ctx.input),
  }),

  /** 超时保护 */
  timeout: (ms: number): REPLInterceptor => ({
    name: '超时保护',
    priority: 0,
    intercept: (ctx) => Date.now() - ctx.startTime < ms,
  }),
};
