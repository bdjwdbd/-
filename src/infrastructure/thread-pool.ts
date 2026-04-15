/**
 * 线程池 - 复用 Worker 线程
 * 
 * 职责：
 * - 复用 Worker 线程，减少创建开销
 * - 动态扩容/缩容
 * - 任务队列管理
 * - 负载均衡
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';

// ============================================================
// 类型定义
// ============================================================

export interface ThreadPoolConfig {
  /** 最小线程数 */
  minThreads: number;
  /** 最大线程数 */
  maxThreads: number;
  /** 任务超时时间（毫秒） */
  taskTimeout: number;
  /** 空闲超时时间（毫秒） */
  idleTimeout: number;
  /** Worker 脚本路径 */
  workerScript?: string;
}

export interface Task<T = unknown, R = unknown> {
  /** 任务 ID */
  id: string;
  /** 任务数据 */
  data: T;
  /** 提交时间 */
  submittedAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 解决回调 */
  resolve: (result: R) => void;
  /** 拒绝回调 */
  reject: (error: Error) => void;
}

export interface WorkerInfo {
  /** Worker 实例 */
  worker: Worker;
  /** Worker ID */
  id: number;
  /** 是否忙碌 */
  busy: boolean;
  /** 当前任务 */
  currentTask?: Task;
  /** 完成的任务数 */
  completedTasks: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后活跃时间 */
  lastActiveAt: number;
}

export interface ThreadPoolStats {
  /** 总线程数 */
  totalThreads: number;
  /** 活跃线程数 */
  activeThreads: number;
  /** 空闲线程数 */
  idleThreads: number;
  /** 等待中的任务数 */
  pendingTasks: number;
  /** 已完成任务数 */
  completedTasks: number;
  /** 平均任务耗时 */
  avgTaskDuration: number;
}

// ============================================================
// 线程池
// ============================================================

export class ThreadPool {
  private config: Required<ThreadPoolConfig>;
  private workers: Map<number, WorkerInfo> = new Map();
  private taskQueue: Task[] = [];
  private taskIdCounter: number = 0;
  private workerIdCounter: number = 0;
  private completedTasks: number = 0;
  private totalTaskDuration: number = 0;
  private running: boolean = false;
  private shrinkTimer?: NodeJS.Timeout;

  constructor(config: Partial<ThreadPoolConfig> = {}) {
    this.config = {
      minThreads: config.minThreads ?? Math.max(1, Math.floor(os.cpus().length / 2)),
      maxThreads: config.maxThreads ?? os.cpus().length,
      taskTimeout: config.taskTimeout ?? 30000,
      idleTimeout: config.idleTimeout ?? 60000,
      workerScript: config.workerScript ?? path.join(__dirname, 'vector-worker.js'),
    };

    this.running = true;
    this.initialize();
  }

  /**
   * 初始化线程池
   */
  private initialize(): void {
    for (let i = 0; i < this.config.minThreads; i++) {
      this.createWorker();
    }

    // 启动缩容定时器
    this.startShrinkTimer();

    console.log(`[ThreadPool] 初始化完成，线程数: ${this.workers.size}`);
  }

  /**
   * 创建 Worker
   */
  private createWorker(): WorkerInfo | null {
    if (!this.running) return null;

    const workerId = this.workerIdCounter++;
    let worker: Worker;

    try {
      worker = new Worker(this.config.workerScript);
    } catch (error) {
      console.error(`[ThreadPool] 创建 Worker 失败:`, error);
      return null;
    }

    const info: WorkerInfo = {
      worker,
      id: workerId,
      busy: false,
      completedTasks: 0,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    // 监听消息
    worker.on('message', (result) => {
      this.handleWorkerMessage(info, result);
    });

    // 监听错误
    worker.on('error', (error) => {
      console.error(`[ThreadPool] Worker ${workerId} 错误:`, error);
      this.handleWorkerError(info, error);
    });

    // 监听退出
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[ThreadPool] Worker ${workerId} 异常退出: code=${code}`);
      }
      this.removeWorker(info);
    });

    this.workers.set(workerId, info);
    return info;
  }

  /**
   * 移除 Worker
   */
  private removeWorker(info: WorkerInfo): void {
    this.workers.delete(info.id);

    // 如果低于最小线程数，创建新的
    if (this.running && this.workers.size < this.config.minThreads) {
      this.createWorker();
    }
  }

  /**
   * 处理 Worker 消息
   */
  private handleWorkerMessage(info: WorkerInfo, result: any): void {
    const task = info.currentTask;

    if (!task) {
      console.warn(`[ThreadPool] Worker ${info.id} 收到消息但没有任务`);
      return;
    }

    // 更新统计
    info.busy = false;
    info.currentTask = undefined;
    info.completedTasks++;
    info.lastActiveAt = Date.now();

    this.completedTasks++;
    this.totalTaskDuration += Date.now() - (task.startedAt ?? task.submittedAt);

    // 完成任务
    task.completedAt = Date.now();
    task.resolve(result);

    // 处理下一个任务
    this.processQueue();
  }

  /**
   * 处理 Worker 错误
   */
  private handleWorkerError(info: WorkerInfo, error: unknown): void {
    const task = info.currentTask;

    if (task) {
      info.busy = false;
      info.currentTask = undefined;
      task.reject(error instanceof Error ? error : new Error(String(error)));
    }

    // 尝试重建 Worker
    this.removeWorker(info);
    if (this.running) {
      this.createWorker();
    }
  }

  /**
   * 执行任务
   */
  async execute<T = unknown, R = unknown>(data: T): Promise<R> {
    if (!this.running) {
      throw new Error('线程池已关闭');
    }

    return new Promise<R>((resolve, reject) => {
      const task: Task = {
        id: `task-${this.taskIdCounter++}`,
        data,
        submittedAt: Date.now(),
        resolve: resolve as (result: unknown) => void,
        reject: reject as (error: Error) => void,
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * 处理任务队列
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    // 找一个空闲的 Worker
    const idleWorker = this.findIdleWorker();

    if (idleWorker) {
      this.dispatchTask(idleWorker);
    } else if (this.workers.size < this.config.maxThreads) {
      // 创建新的 Worker
      const newWorker = this.createWorker();
      if (newWorker) {
        this.dispatchTask(newWorker);
      }
    }
    // 否则任务等待
  }

  /**
   * 查找空闲 Worker
   */
  private findIdleWorker(): WorkerInfo | null {
    for (const info of this.workers.values()) {
      if (!info.busy) {
        return info;
      }
    }
    return null;
  }

  /**
   * 分发任务
   */
  private dispatchTask(info: WorkerInfo): void {
    const task = this.taskQueue.shift();
    if (!task) return;

    info.busy = true;
    info.currentTask = task;
    info.lastActiveAt = Date.now();
    task.startedAt = Date.now();

    // 发送任务到 Worker
    info.worker.postMessage(task.data);

    // 设置超时
    const timeout = setTimeout(() => {
      if (info.currentTask === task) {
        task.reject(new Error('任务超时'));
        info.busy = false;
        info.currentTask = undefined;
        this.processQueue();
      }
    }, this.config.taskTimeout);

    // 清理超时定时器
    const originalResolve = task.resolve;
    const originalReject = task.reject;

    task.resolve = (result) => {
      clearTimeout(timeout);
      originalResolve(result);
    };

    task.reject = (error) => {
      clearTimeout(timeout);
      originalReject(error);
    };
  }

  /**
   * 启动缩容定时器
   */
  private startShrinkTimer(): void {
    this.shrinkTimer = setInterval(() => {
      this.shrink();
    }, this.config.idleTimeout);
  }

  /**
   * 缩容
   */
  private shrink(): void {
    if (this.workers.size <= this.config.minThreads) return;

    const now = Date.now();
    const toRemove: WorkerInfo[] = [];

    for (const info of this.workers.values()) {
      if (
        !info.busy &&
        now - info.lastActiveAt > this.config.idleTimeout &&
        this.workers.size - toRemove.length > this.config.minThreads
      ) {
        toRemove.push(info);
      }
    }

    for (const info of toRemove) {
      this.terminateWorker(info);
    }

    if (toRemove.length > 0) {
      console.log(`[ThreadPool] 缩容 ${toRemove.length} 个线程`);
    }
  }

  /**
   * 终止 Worker
   */
  private terminateWorker(info: WorkerInfo): void {
    info.worker.terminate();
    this.workers.delete(info.id);
  }

  /**
   * 获取统计信息
   */
  getStats(): ThreadPoolStats {
    let activeThreads = 0;
    let idleThreads = 0;

    for (const info of this.workers.values()) {
      if (info.busy) {
        activeThreads++;
      } else {
        idleThreads++;
      }
    }

    return {
      totalThreads: this.workers.size,
      activeThreads,
      idleThreads,
      pendingTasks: this.taskQueue.length,
      completedTasks: this.completedTasks,
      avgTaskDuration: this.completedTasks > 0 
        ? this.totalTaskDuration / this.completedTasks 
        : 0,
    };
  }

  /**
   * 关闭线程池
   */
  async shutdown(): Promise<void> {
    this.running = false;

    // 停止缩容定时器
    if (this.shrinkTimer) {
      clearInterval(this.shrinkTimer);
    }

    // 等待所有任务完成
    while (this.taskQueue.length > 0 || this.getActiveCount() > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 终止所有 Worker
    for (const info of this.workers.values()) {
      await info.worker.terminate();
    }

    this.workers.clear();
    console.log('[ThreadPool] 已关闭');
  }

  /**
   * 获取活跃线程数
   */
  private getActiveCount(): number {
    let count = 0;
    for (const info of this.workers.values()) {
      if (info.busy) count++;
    }
    return count;
  }
}

// ============================================================
// 向量计算 Worker
// ============================================================

/**
 * 创建向量计算线程池
 */
export function createVectorThreadPool(config?: Partial<ThreadPoolConfig>): ThreadPool {
  return new ThreadPool({
    ...config,
    workerScript: config?.workerScript ?? path.join(__dirname, 'vector-worker.js'),
  });
}

// ============================================================
// 单例实例
// ============================================================

let defaultPool: ThreadPool | null = null;

export function getThreadPool(config?: Partial<ThreadPoolConfig>): ThreadPool {
  if (!defaultPool) {
    defaultPool = new ThreadPool(config);
  }
  return defaultPool;
}

/**
 * 快速执行任务
 */
export async function executeInPool<T, R>(data: T): Promise<R> {
  const pool = getThreadPool();
  return pool.execute<T, R>(data);
}
