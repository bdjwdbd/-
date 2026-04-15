/**
 * @file thread-pool.ts
 * @brief 高性能线程池
 * 
 * 功能：
 * 1. 复用 Worker 线程，避免创建开销
 * 2. 工作窃取调度
 * 3. 动态负载均衡
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';

// ============================================================
// 类型定义
// ============================================================

export interface Task<T = any, R = any> {
    id: string;
    type: string;
    data: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
}

export interface ThreadPoolOptions {
    minWorkers?: number;
    maxWorkers?: number;
    idleTimeout?: number;
}

export interface WorkerInfo {
    worker: Worker;
    busy: boolean;
    taskCount: number;
    lastUsed: number;
}

// ============================================================
// 线程池
// ============================================================

export class ThreadPool {
    private workers: WorkerInfo[] = [];
    private taskQueue: Task[] = [];
    private minWorkers: number;
    private maxWorkers: number;
    private idleTimeout: number;
    private taskIdCounter = 0;
    private workerPath: string;

    constructor(workerPath: string, options: ThreadPoolOptions = {}) {
        this.workerPath = workerPath;
        this.minWorkers = options.minWorkers || 2;
        this.maxWorkers = options.maxWorkers || 8;
        this.idleTimeout = options.idleTimeout || 30000;

        // 初始化最小数量的 Worker
        for (let i = 0; i < this.minWorkers; i++) {
            this.createWorker();
        }
    }

    /**
     * 创建新 Worker
     */
    private createWorker(): WorkerInfo {
        const worker = new Worker(this.workerPath);
        const info: WorkerInfo = {
            worker,
            busy: false,
            taskCount: 0,
            lastUsed: Date.now()
        };

        worker.on('message', (result: any) => {
            this.handleWorkerMessage(info, result);
        });

        worker.on('error', (error: Error) => {
            this.handleWorkerError(info, error);
        });

        worker.on('exit', (code: number) => {
            this.handleWorkerExit(info, code);
        });

        this.workers.push(info);
        return info;
    }

    /**
     * 提交任务
     */
    submit<T, R>(type: string, data: T): Promise<R> {
        return new Promise((resolve, reject) => {
            const task: Task<T, R> = {
                id: `task_${++this.taskIdCounter}`,
                type,
                data,
                resolve: resolve as any,
                reject
            };

            // 尝试分配给空闲 Worker
            const idleWorker = this.findIdleWorker();
            if (idleWorker) {
                this.assignTask(idleWorker, task);
            } else if (this.workers.length < this.maxWorkers) {
                // 创建新 Worker
                const newWorker = this.createWorker();
                this.assignTask(newWorker, task);
            } else {
                // 加入队列等待
                this.taskQueue.push(task as any);
            }
        });
    }

    /**
     * 查找空闲 Worker
     */
    private findIdleWorker(): WorkerInfo | null {
        // 优先选择任务数最少的 Worker
        let minTasks = Infinity;
        let selected: WorkerInfo | null = null;

        for (const info of this.workers) {
            if (!info.busy && info.taskCount < minTasks) {
                minTasks = info.taskCount;
                selected = info;
            }
        }

        return selected;
    }

    /**
     * 分配任务给 Worker
     */
    private assignTask(worker: WorkerInfo, task: Task): void {
        worker.busy = true;
        worker.taskCount++;
        worker.lastUsed = Date.now();

        worker.worker.postMessage({
            taskId: task.id,
            type: task.type,
            data: task.data
        });
    }

    /**
     * 处理 Worker 消息
     */
    private handleWorkerMessage(worker: WorkerInfo, result: any): void {
        worker.busy = false;

        // 处理下一个任务
        if (this.taskQueue.length > 0) {
            const nextTask = this.taskQueue.shift()!;
            this.assignTask(worker, nextTask);
        }
    }

    /**
     * 处理 Worker 错误
     */
    private handleWorkerError(worker: WorkerInfo, error: Error): void {
        console.error('Worker error:', error);
        worker.busy = false;

        // 重启 Worker
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
            this.workers.splice(index, 1);
            if (this.workers.length < this.minWorkers) {
                this.createWorker();
            }
        }
    }

    /**
     * 处理 Worker 退出
     */
    private handleWorkerExit(worker: WorkerInfo, code: number): void {
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
            this.workers.splice(index, 1);
        }
    }

    /**
     * 关闭线程池
     */
    async shutdown(): Promise<void> {
        const promises = this.workers.map(info => info.worker.terminate());
        await Promise.all(promises);
        this.workers = [];
        this.taskQueue = [];
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        totalWorkers: number;
        busyWorkers: number;
        queuedTasks: number;
    } {
        return {
            totalWorkers: this.workers.length,
            busyWorkers: this.workers.filter(w => w.busy).length,
            queuedTasks: this.taskQueue.length
        };
    }
}

// ============================================================
// 向量搜索线程池
// ============================================================

export class VectorSearchPool {
    private pool: ThreadPool;
    private native: any;

    constructor(options: ThreadPoolOptions = {}) {
        // 使用当前文件作为 Worker
        this.pool = new ThreadPool(__filename, options);

        // 主线程加载原生模块
        try {
            this.native = require(path.join(__dirname, '../../native/build/Release/yuanling_native.node'));
        } catch (e) {
            console.warn('Native module not available');
        }
    }

    /**
     * 并行搜索
     */
    async search(
        query: Float32Array,
        vectors: Float32Array,
        dim: number,
        k: number,
        numChunks?: number
    ): Promise<Array<{ index: number; score: number }>> {
        const numVectors = vectors.length / dim;
        const chunks = numChunks || Math.min(8, Math.ceil(numVectors / 10000));
        const chunkSize = Math.ceil(numVectors / chunks);

        const promises: Promise<Array<{ index: number; score: number }>>[] = [];

        for (let i = 0; i < chunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, numVectors);

            if (start >= numVectors) break;

            const chunkVectors = vectors.slice(start * dim, end * dim);
            const startIdx = start;

            promises.push(
                this.pool.submit('search', {
                    query: Array.from(query),
                    vectors: Array.from(chunkVectors),
                    dim,
                    k,
                    startIdx
                })
            );
        }

        const results = await Promise.all(promises);
        const allResults = results.flat();

        // 合并并取 Top-K
        allResults.sort((a: any, b: any) => b.score - a.score);
        return allResults.slice(0, k);
    }

    /**
     * 关闭
     */
    async shutdown(): Promise<void> {
        await this.pool.shutdown();
    }
}

// ============================================================
// Worker 线程代码
// ============================================================

if (!isMainThread && parentPort) {
    const native = require(path.join(__dirname, '../../native/build/Release/yuanling_native.node'));

    parentPort.on('message', (msg: { taskId: string; type: string; data: any }) => {
        const { taskId, type, data } = msg;

        try {
            let result: any;

            switch (type) {
                case 'search': {
                    const { query, vectors, dim, k, startIdx } = data;
                    const queryArr = new Float32Array(query);
                    const vectorsArr = new Float32Array(vectors);

                    // 使用原生模块搜索
                    const scores = native.cosineSimilarityBatchContiguous(queryArr, vectorsArr, dim);

                    // 取 Top-K
                    const indexed = Array.from(scores).map((score, i) => ({
                        index: startIdx + i,
                        score
                    }));
                    indexed.sort((a, b) => b.score - a.score);
                    result = indexed.slice(0, k);
                    break;
                }
                default:
                    throw new Error(`Unknown task type: ${type}`);
            }

            parentPort!.postMessage({ taskId, result, success: true });
        } catch (error: any) {
            parentPort!.postMessage({ taskId, error: error.message, success: false });
        }
    });
}

// ============================================================
// 导出
// ============================================================

export default VectorSearchPool;
