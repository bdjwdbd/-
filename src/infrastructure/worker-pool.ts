/**
 * Worker 线程池模块
 * 
 * 使用 Node.js worker_threads 实现多线程并行计算
 * 适合大规模向量搜索场景
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';

// ============================================================
// 类型定义
// ============================================================

export interface WorkerPoolConfig {
  /** 线程数，默认 CPU 核心数 */
  numWorkers?: number;
  /** 任务超时时间（毫秒），默认 30000 */
  timeout?: number;
}

export interface WorkerTask<T = any, R = any> {
  id: string;
  type: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  startTime: number;
}

export interface WorkerMessage {
  type: 'result' | 'error' | 'ready';
  taskId?: string;
  result?: any;
  error?: string;
}

export interface VectorSearchTask {
  query: number[];
  vectors: number[][];
  operation: 'cosine' | 'euclidean' | 'dot';
  startIdx: number;
  endIdx: number;
}

export interface VectorSearchResult {
  scores: number[];
  indices: number[];
}

// ============================================================
// Worker 线程池
// ============================================================

export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private pendingTasks: Map<string, WorkerTask> = new Map();
  private availableWorkers: Worker[] = [];
  private config: Required<WorkerPoolConfig>;
  private taskIdCounter = 0;
  private initialized = false;

  constructor(config: WorkerPoolConfig = {}) {
    this.config = {
      numWorkers: config.numWorkers || Math.max(1, os.cpus().length - 1),
      timeout: config.timeout || 30000,
    };
  }

  /**
   * 初始化线程池
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const workerPath = __filename.replace('worker-pool.js', 'vector-worker.js');
    
    for (let i = 0; i < this.config.numWorkers; i++) {
      const worker = new Worker(workerPath);
      
      worker.on('message', (msg: WorkerMessage) => {
        this.handleWorkerMessage(worker, msg);
      });

      worker.on('error', (err: Error) => {
        console.error(`Worker error: ${err.message}`);
        this.handleWorkerError(worker, err);
      });

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }

    this.initialized = true;
  }

  /**
   * 执行向量搜索任务
   */
  async search(
    query: number[],
    vectors: number[][],
    operation: 'cosine' | 'euclidean' | 'dot' = 'cosine'
  ): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 分割任务
    const chunkSize = Math.ceil(vectors.length / this.config.numWorkers);
    const tasks: Promise<VectorSearchResult>[] = [];

    for (let i = 0; i < this.config.numWorkers; i++) {
      const startIdx = i * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, vectors.length);
      
      if (startIdx >= vectors.length) break;

      const taskData: VectorSearchTask = {
        query,
        vectors: vectors.slice(startIdx, endIdx),
        operation,
        startIdx,
        endIdx,
      };

      tasks.push(this.submitTask<VectorSearchTask, VectorSearchResult>('search', taskData));
    }

    // 合并结果
    const results = await Promise.all(tasks);
    const totalScores: number[] = new Array(vectors.length);
    
    for (const result of results) {
      for (let i = 0; i < result.scores.length; i++) {
        totalScores[result.indices[i]] = result.scores[i];
      }
    }

    return totalScores;
  }

  /**
   * 提交任务
   */
  private submitTask<T, R>(type: string, data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: `task_${++this.taskIdCounter}`,
        type,
        data,
        resolve: resolve as any,
        reject,
        startTime: Date.now(),
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * 处理任务队列
   */
  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift()!;
      const worker = this.availableWorkers.shift()!;

      this.pendingTasks.set(task.id, task);
      
      worker.postMessage({
        type: 'execute',
        taskId: task.id,
        taskType: task.type,
        data: task.data,
      });

      // 设置超时
      setTimeout(() => {
        if (this.pendingTasks.has(task.id)) {
          this.pendingTasks.delete(task.id);
          task.reject(new Error(`Task ${task.id} timeout`));
          this.availableWorkers.push(worker);
          this.processQueue();
        }
      }, this.config.timeout);
    }
  }

  /**
   * 处理 Worker 消息
   */
  private handleWorkerMessage(worker: Worker, msg: WorkerMessage): void {
    if (msg.type === 'result' && msg.taskId) {
      const task = this.pendingTasks.get(msg.taskId);
      if (task) {
        this.pendingTasks.delete(msg.taskId);
        task.resolve(msg.result);
        this.availableWorkers.push(worker);
        this.processQueue();
      }
    } else if (msg.type === 'error' && msg.taskId) {
      const task = this.pendingTasks.get(msg.taskId);
      if (task) {
        this.pendingTasks.delete(msg.taskId);
        task.reject(new Error(msg.error || 'Unknown error'));
        this.availableWorkers.push(worker);
        this.processQueue();
      }
    }
  }

  /**
   * 处理 Worker 错误
   */
  private handleWorkerError(worker: Worker, err: Error): void {
    // 将该 worker 的所有待处理任务标记为失败
    for (const [id, task] of this.pendingTasks) {
      task.reject(err);
      this.pendingTasks.delete(id);
    }
    
    // 重新创建 worker
    const idx = this.workers.indexOf(worker);
    if (idx >= 0) {
      const workerPath = __filename.replace('worker-pool.js', 'vector-worker.js');
      const newWorker = new Worker(workerPath);
      
      newWorker.on('message', (msg: WorkerMessage) => {
        this.handleWorkerMessage(newWorker, msg);
      });

      newWorker.on('error', (err: Error) => {
        this.handleWorkerError(newWorker, err);
      });

      this.workers[idx] = newWorker;
      this.availableWorkers.push(newWorker);
    }
  }

  /**
   * 关闭线程池
   */
  async shutdown(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
    this.pendingTasks.clear();
    this.taskQueue = [];
    this.initialized = false;
  }

  /**
   * 获取线程池状态
   */
  getStatus(): {
    numWorkers: number;
    availableWorkers: number;
    pendingTasks: number;
    queuedTasks: number;
  } {
    return {
      numWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      pendingTasks: this.pendingTasks.size,
      queuedTasks: this.taskQueue.length,
    };
  }
}

// ============================================================
// 导出
// ============================================================

export function createWorkerPool(config?: WorkerPoolConfig): WorkerPool {
  return new WorkerPool(config);
}
