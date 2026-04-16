/**
 * Ralph Loop - 强制迭代循环
 * 
 * 核心机制：执行 → 验证 → 不通过则重试 → 直到通过或达到上限
 * 
 * 来源：Harness Engineering 文档
 * 
 * @module harness/ralph-loop
 */

// ============ 类型定义 ============

export interface RalphLoopConfig {
  /** 最大迭代次数 */
  maxIterations: number;
  /** 验证标准 */
  criteria: ValidationCriteria[];
  /** 是否自动降级 */
  autoDowngrade: boolean;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 迭代间隔（毫秒） */
  iterationDelay: number;
  /** 是否记录历史 */
  recordHistory: boolean;
}

export interface ValidationCriteria {
  /** 标准名称 */
  name: string;
  /** 验证函数 */
  validate: (result: any) => boolean;
  /** 是否必须通过 */
  required: boolean;
  /** 错误消息 */
  errorMessage?: string;
}

export interface IterationRecord {
  /** 迭代次数 */
  iteration: number;
  /** 执行结果 */
  result: any;
  /** 是否通过 */
  passed: boolean;
  /** 验证详情 */
  validationDetails: Array<{
    criteria: string;
    passed: boolean;
    required: boolean;
  }>;
  /** 执行时间（毫秒） */
  duration: number;
  /** 错误信息 */
  error?: string;
}

export interface RalphLoopResult<T> {
  /** 最终结果 */
  result: T;
  /** 迭代次数 */
  iterations: number;
  /** 是否通过验证 */
  passed: boolean;
  /** 迭代历史 */
  history: IterationRecord[];
  /** 总耗时（毫秒） */
  totalDuration: number;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: Partial<RalphLoopConfig> = {
  maxIterations: 5,
  criteria: [],
  autoDowngrade: true,
  timeout: 60000,
  iterationDelay: 100,
  recordHistory: true,
};

// ============ Ralph Loop 类 ============

/**
 * Ralph Loop - 强制迭代循环
 * 
 * 使用示例：
 * ```typescript
 * const ralphLoop = new RalphLoop({
 *   maxIterations: 3,
 *   criteria: [
 *     { name: '非空', validate: (r) => r != null, required: true },
 *     { name: '包含答案', validate: (r) => r.content?.length > 0, required: true },
 *   ],
 * });
 * 
 * const { result, iterations, passed } = await ralphLoop.execute(
 *   () => llm.generate(prompt),
 *   (r) => r.confidence > 0.8
 * );
 * ```
 */
export class RalphLoop {
  private config: RalphLoopConfig;
  private iterationCount: number = 0;
  private history: IterationRecord[] = [];

  constructor(config: Partial<RalphLoopConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as RalphLoopConfig;
  }

  /**
   * 执行 Ralph Loop
   * 
   * @param executor 执行函数
   * @param validator 可选的自定义验证器
   * @returns 执行结果
   */
  async execute<T>(
    executor: () => Promise<T>,
    validator?: (result: T) => boolean
  ): Promise<RalphLoopResult<T>> {
    const startTime = Date.now();
    this.iterationCount = 0;
    this.history = [];

    while (this.iterationCount < this.config.maxIterations) {
      // 检查超时
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.timeout) {
        return this.createTimeoutResult<T>(elapsed);
      }

      this.iterationCount++;
      const iterationStart = Date.now();

      try {
        // 执行
        const result = await executor();
        const duration = Date.now() - iterationStart;

        // 验证
        const validationDetails = this.validateWithDetails(result, validator);
        const passed = validationDetails.every(v => !v.required || v.passed);

        // 记录历史
        if (this.config.recordHistory) {
          this.history.push({
            iteration: this.iterationCount,
            result,
            passed,
            validationDetails,
            duration,
          });
        }

        if (passed) {
          return {
            result,
            iterations: this.iterationCount,
            passed: true,
            history: this.history,
            totalDuration: Date.now() - startTime,
          };
        }

        // 不通过，准备下一次迭代
        console.log(`[RalphLoop] 迭代 ${this.iterationCount} 未通过，重试...`);
        
        // 迭代间隔
        if (this.config.iterationDelay > 0) {
          await this.delay(this.config.iterationDelay);
        }
      } catch (error) {
        // 记录错误
        const duration = Date.now() - iterationStart;
        if (this.config.recordHistory) {
          this.history.push({
            iteration: this.iterationCount,
            result: null,
            passed: false,
            validationDetails: [],
            duration,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        console.error(`[RalphLoop] 迭代 ${this.iterationCount} 执行错误:`, error);
        
        // 继续下一次迭代
        if (this.config.iterationDelay > 0) {
          await this.delay(this.config.iterationDelay);
        }
      }
    }

    // 达到最大迭代次数
    const totalDuration = Date.now() - startTime;
    
    if (this.config.autoDowngrade && this.history.length > 0) {
      // 降级：返回最后一次成功的结果
      const lastSuccessful = [...this.history].reverse().find(h => h.passed);
      if (lastSuccessful) {
        return {
          result: lastSuccessful.result,
          iterations: this.iterationCount,
          passed: false,
          history: this.history,
          totalDuration,
        };
      }

      // 没有成功的，返回最后一次结果
      const lastResult = this.history[this.history.length - 1];
      return {
        result: lastResult?.result,
        iterations: this.iterationCount,
        passed: false,
        history: this.history,
        totalDuration,
      } as RalphLoopResult<T>;
    }

    throw new Error(`Ralph Loop 达到最大迭代次数 ${this.config.maxIterations}`);
  }

  /**
   * 验证结果（带详情）
   */
  private validateWithDetails<T>(
    result: T,
    customValidator?: (result: T) => boolean
  ): IterationRecord['validationDetails'] {
    const details: IterationRecord['validationDetails'] = [];

    // 自定义验证器
    if (customValidator) {
      details.push({
        criteria: 'custom',
        passed: customValidator(result),
        required: true,
      });
    }

    // 标准验证
    for (const criteria of this.config.criteria) {
      try {
        const passed = criteria.validate(result);
        details.push({
          criteria: criteria.name,
          passed,
          required: criteria.required,
        });
      } catch (error) {
        details.push({
          criteria: criteria.name,
          passed: false,
          required: criteria.required,
        });
      }
    }

    return details;
  }

  /**
   * 创建超时结果
   */
  private createTimeoutResult<T>(elapsed: number): RalphLoopResult<T> {
    if (this.config.autoDowngrade && this.history.length > 0) {
      const lastResult = this.history[this.history.length - 1];
      return {
        result: lastResult?.result,
        iterations: this.iterationCount,
        passed: false,
        history: this.history,
        totalDuration: elapsed,
      } as RalphLoopResult<T>;
    }

    throw new Error(`Ralph Loop 超时 (${elapsed}ms)`);
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取迭代历史
   */
  getHistory(): IterationRecord[] {
    return this.history;
  }

  /**
   * 获取当前迭代次数
   */
  getIterationCount(): number {
    return this.iterationCount;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.iterationCount = 0;
    this.history = [];
  }
}

// ============ 工厂函数 ============

/**
 * 创建 Ralph Loop 实例
 */
export function createRalphLoop(config: Partial<RalphLoopConfig> = {}): RalphLoop {
  return new RalphLoop(config);
}

// ============ 预设验证标准 ============

/**
 * 常用验证标准
 */
export const CommonCriteria = {
  /** 非空验证 */
  notNull: (): ValidationCriteria => ({
    name: '非空',
    validate: (r) => r != null,
    required: true,
    errorMessage: '结果为空',
  }),

  /** 非空字符串 */
  notEmptyString: (): ValidationCriteria => ({
    name: '非空字符串',
    validate: (r) => typeof r === 'string' && r.length > 0,
    required: true,
    errorMessage: '字符串为空',
  }),

  /** 非空数组 */
  notEmptyArray: (): ValidationCriteria => ({
    name: '非空数组',
    validate: (r) => Array.isArray(r) && r.length > 0,
    required: true,
    errorMessage: '数组为空',
  }),

  /** 置信度阈值 */
  minConfidence: (threshold: number): ValidationCriteria => ({
    name: `置信度 >= ${threshold}`,
    validate: (r) => r?.confidence != null && r.confidence >= threshold,
    required: true,
    errorMessage: `置信度低于 ${threshold}`,
  }),

  /** 包含指定字段 */
  hasField: (field: string): ValidationCriteria => ({
    name: `包含字段 ${field}`,
    validate: (r) => r != null && field in r,
    required: true,
    errorMessage: `缺少字段 ${field}`,
  }),

  /** 自定义条件 */
  custom: (name: string, validate: (result: any) => boolean, required = true): ValidationCriteria => ({
    name,
    validate,
    required,
  }),
};
