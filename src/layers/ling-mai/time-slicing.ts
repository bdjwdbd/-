/**
 * 时间切片执行器
 * 
 * 借鉴 React Fiber 的时间切片机制，实现可中断的长任务执行
 * 
 * @module layers/ling-mai/time-slicing
 */

// ============ 类型定义 ============

export interface TimeSlicingConfig {
  /** 每帧最大工作时间（毫秒），默认 5ms */
  frameInterval: number;
  /** 是否启用时间切片，默认 true */
  enabled: boolean;
  /** 最大连续帧数，超过后强制让出，默认 10 */
  maxContinuousFrames: number;
  /** 是否启用输入检测，默认 false */
  enableInputDetection: boolean;
}

export const DEFAULT_TIME_SLICING_CONFIG: TimeSlicingConfig = {
  frameInterval: 5,
  enabled: true,
  maxContinuousFrames: 10,
  enableInputDetection: false,
};

export interface WorkUnit<T = unknown> {
  /** 工作单元 ID */
  id: string;
  /** 工作单元数据 */
  data: T;
  /** 是否有更多工作 */
  hasMore: () => boolean;
  /** 执行一个工作单元 */
  execute: () => Promise<void>;
  /** 获取结果 */
  getResult: () => unknown;
}

export interface ExecutionResult<T = unknown> {
  /** 是否完成 */
  completed: boolean;
  /** 结果 */
  result?: T;
  /** 已执行的工作单元数 */
  executedUnits: number;
  /** 总耗时（毫秒） */
  totalTime: number;
  /** 让出次数 */
  yieldCount: number;
}

// ============ 时间切片执行器 ============

/**
 * 时间切片执行器
 * 
 * 核心机制：
 * 1. 每帧最多工作 frameInterval 毫秒
 * 2. 超过时间片后让出控制权
 * 3. 使用 MessageChannel 或 setTimeout 调度下一帧
 * 4. 支持输入检测，有高优先级输入时让出
 */
export class TimeSlicingExecutor {
  private config: TimeSlicingConfig;
  private frameStartTime: number = 0;
  private continuousFrames: number = 0;
  private isExecuting: boolean = false;

  constructor(config: Partial<TimeSlicingConfig> = {}) {
    this.config = { ...DEFAULT_TIME_SLICING_CONFIG, ...config };
  }

  /**
   * 执行可中断的工作
   */
  async execute<T>(work: WorkUnit<T>): Promise<ExecutionResult<T>> {
    if (!this.config.enabled) {
      // 禁用时间切片，直接执行
      return this.executeSync(work);
    }

    this.isExecuting = true;
    const totalStartTime = Date.now();
    let executedUnits = 0;
    let yieldCount = 0;

    try {
      while (work.hasMore()) {
        // 开始新帧
        this.frameStartTime = Date.now();
        this.continuousFrames++;

        // 执行工作单元
        await work.execute();
        executedUnits++;

        // 检查是否需要让出
        if (this.shouldYield()) {
          yieldCount++;
          await this.yield();
        }
      }

      return {
        completed: true,
        result: work.getResult() as T,
        executedUnits,
        totalTime: Date.now() - totalStartTime,
        yieldCount,
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 同步执行（禁用时间切片时使用）
   */
  private async executeSync<T>(work: WorkUnit<T>): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    let executedUnits = 0;

    while (work.hasMore()) {
      await work.execute();
      executedUnits++;
    }

    return {
      completed: true,
      result: work.getResult() as T,
      executedUnits,
      totalTime: Date.now() - startTime,
      yieldCount: 0,
    };
  }

  /**
   * 检查是否应该让出控制权
   */
  private shouldYield(): boolean {
    const elapsed = Date.now() - this.frameStartTime;

    // 1. 时间片用完
    if (elapsed >= this.config.frameInterval) {
      return true;
    }

    // 2. 连续帧数超过限制
    if (this.continuousFrames >= this.config.maxContinuousFrames) {
      return true;
    }

    // 3. 输入检测（如果启用）
    if (this.config.enableInputDetection && this.hasPendingInput()) {
      return true;
    }

    return false;
  }

  /**
   * 检测是否有待处理的输入
   * 
   * 注意：在 Node.js 环境中，这个检测有限
   * 在浏览器中可以使用 navigator.scheduling.isInputPending()
   */
  private hasPendingInput(): boolean {
    // Node.js 环境暂不支持输入检测
    // 浏览器环境可以使用：
    // if (typeof navigator !== 'undefined' && navigator.scheduling?.isInputPending) {
    //   return navigator.scheduling.isInputPending();
    // }
    return false;
  }

  /**
   * 让出控制权
   * 
   * 使用 MessageChannel 或 setTimeout 调度下一帧
   */
  private async yield(): Promise<void> {
    this.continuousFrames = 0;

    // 使用 MessageChannel（类似 React Fiber）
    // 在 Node.js 中回退到 setImmediate 或 setTimeout
    return new Promise((resolve) => {
      if (typeof MessageChannel !== 'undefined') {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
        channel.port2.postMessage(null);
      } else if (typeof setImmediate !== 'undefined') {
        setImmediate(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TimeSlicingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): TimeSlicingConfig {
    return { ...this.config };
  }

  /**
   * 是否正在执行
   */
  getIsExecuting(): boolean {
    return this.isExecuting;
  }
}

// ============ 工作单元工厂 ============

/**
 * 创建数组处理工作单元
 */
export function createArrayWorkUnit<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>
): WorkUnit<R[]> {
  let index = 0;
  const results: R[] = [];

  return {
    id: `array_work_${Date.now()}`,
    data: results,
    hasMore: () => index < items.length,
    execute: async () => {
      const result = await processor(items[index], index);
      results.push(result);
      index++;
    },
    getResult: () => results,
  };
}

/**
 * 创建迭代处理工作单元
 */
export function createIteratorWorkUnit<T, R>(
  iterator: Iterator<T> | AsyncIterator<T>,
  processor: (item: T) => Promise<R>
): WorkUnit<R[]> {
  let done = false;
  const results: R[] = [];

  return {
    id: `iterator_work_${Date.now()}`,
    data: results,
    hasMore: () => !done,
    execute: async () => {
      const result = await iterator.next();
      if (result.done) {
        done = true;
      } else {
        const processed = await processor(result.value);
        results.push(processed);
      }
    },
    getResult: () => results,
  };
}

/**
 * 创建批量任务工作单元
 */
export function createBatchWorkUnit<T extends () => Promise<unknown>>(
  tasks: T[]
): WorkUnit<unknown[]> {
  let index = 0;
  const results: unknown[] = [];

  return {
    id: `batch_work_${Date.now()}`,
    data: results,
    hasMore: () => index < tasks.length,
    execute: async () => {
      const result = await tasks[index]();
      results.push(result);
      index++;
    },
    getResult: () => results,
  };
}

// ============ 导出 ============

export default TimeSlicingExecutor;
