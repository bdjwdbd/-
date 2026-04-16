/**
 * 边缘运行时
 * 
 * 轻量级运行时，支持离线模式和资源受限环境
 * 
 * @module edge/runtime
 */

import * as crypto from 'crypto';
import {
  EdgeNodeConfig,
  EdgeTask,
  EdgeTaskStatus,
  EdgeRuntimeStatus,
  SyncStatus,
  SyncRecord,
  DEFAULT_EDGE_CONFIG,
} from './types';

// ============ 边缘运行时 ============

/**
 * 边缘运行时
 */
export class EdgeRuntime {
  private config: EdgeNodeConfig;
  private tasks: Map<string, EdgeTask> = new Map();
  private syncQueue: SyncRecord[] = [];
  private syncStatus: SyncStatus = SyncStatus.OFFLINE;
  private startTime: number = Date.now();
  private syncTimer?: NodeJS.Timeout;
  private resourceMonitor?: NodeJS.Timeout;

  constructor(config: Partial<EdgeNodeConfig> = {}) {
    this.config = { ...DEFAULT_EDGE_CONFIG, ...config };
  }

  /**
   * 启动运行时
   */
  async start(): Promise<void> {
    console.log(`🚀 边缘运行时启动: ${this.config.name}`);
    console.log(`   节点类型: ${this.config.type}`);
    console.log(`   内存限制: ${this.config.limits.maxMemoryMB}MB`);
    console.log(`   任务限制: ${this.config.limits.maxTasks}`);

    // 启动同步
    if (this.config.sync.enabled) {
      this.startSync();
    }

    // 启动资源监控
    this.startResourceMonitor();

    console.log('✅ 边缘运行时已启动');
  }

  /**
   * 停止运行时
   */
  async stop(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }

    // 保存未同步的数据
    if (this.syncQueue.length > 0) {
      console.log(`💾 保存 ${this.syncQueue.length} 条未同步记录`);
    }

    console.log('🛑 边缘运行时已停止');
  }

  // ============ 任务管理 ============

  /**
   * 提交任务
   */
  async submitTask(
    name: string,
    type: EdgeTask['type'],
    input: any,
    priority: number = 5
  ): Promise<EdgeTask> {
    // 检查资源限制
    if (this.tasks.size >= this.config.limits.maxTasks) {
      throw new Error('任务数量已达上限');
    }

    const task: EdgeTask = {
      taskId: `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      name,
      type,
      priority,
      status: this.syncStatus === SyncStatus.OFFLINE && this.config.offline.enabled
        ? EdgeTaskStatus.QUEUED_OFFLINE
        : EdgeTaskStatus.PENDING,
      input,
      createdAt: Date.now(),
      retryCount: 0,
      resourceUsage: {
        memoryMB: 0,
        cpuMs: 0,
        storageMB: 0,
      },
    };

    this.tasks.set(task.taskId, task);

    // 记录同步
    this.addSyncRecord('task', 'create', task);

    console.log(`📥 任务提交: ${name} (${task.taskId})`);
    return task;
  }

  /**
   * 执行任务
   */
  async executeTask(taskId: string): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    task.status = EdgeTaskStatus.RUNNING;
    task.startedAt = Date.now();

    console.log(`⚡ 执行任务: ${task.name}`);

    try {
      // 模拟任务执行
      const result = await this.simulateTaskExecution(task);

      task.status = EdgeTaskStatus.COMPLETED;
      task.completedAt = Date.now();
      task.output = result;

      // 记录同步
      this.addSyncRecord('task', 'update', task);

      console.log(`✅ 任务完成: ${task.name}`);
      return result;
    } catch (error) {
      task.status = EdgeTaskStatus.FAILED;
      task.completedAt = Date.now();
      task.retryCount++;

      console.log(`❌ 任务失败: ${task.name} - ${error}`);
      throw error;
    }
  }

  /**
   * 模拟任务执行
   */
  private async simulateTaskExecution(task: EdgeTask): Promise<any> {
    // 模拟资源使用
    task.resourceUsage.memoryMB = Math.random() * 50 + 10;
    task.resourceUsage.cpuMs = Math.random() * 100 + 50;

    // 模拟执行时间
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    return { result: `Task ${task.name} completed`, input: task.input };
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): EdgeTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): EdgeTask[] {
    return Array.from(this.tasks.values());
  }

  // ============ 状态管理 ============

  /**
   * 设置状态
   */
  async setState(key: string, value: any): Promise<void> {
    // 检查存储限制
    const currentStorage = this.calculateStorageUsage();
    const valueSize = JSON.stringify(value).length / 1024; // KB

    if (currentStorage + valueSize > this.config.limits.maxStorageMB * 1024) {
      throw new Error('存储空间不足');
    }

    // 记录同步
    this.addSyncRecord('state', 'update', { key, value });

    console.log(`💾 状态设置: ${key}`);
  }

  /**
   * 获取状态
   */
  async getState(key: string): Promise<any> {
    // 简化：返回 null
    return null;
  }

  // ============ 同步管理 ============

  /**
   * 启动同步
   */
  private startSync(): void {
    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.config.sync.intervalMs);

    // 初始同步
    this.sync();
  }

  /**
   * 执行同步
   */
  private async sync(): Promise<void> {
    if (this.syncQueue.length === 0) {
      this.syncStatus = SyncStatus.ONLINE;
      return;
    }

    this.syncStatus = SyncStatus.SYNCING;
    console.log(`🔄 同步 ${this.syncQueue.length} 条记录...`);

    try {
      // 模拟同步
      await new Promise(resolve => setTimeout(resolve, 100));

      // 标记已同步
      for (const record of this.syncQueue) {
        record.synced = true;
        record.syncedAt = Date.now();
      }

      // 清空队列
      const syncedCount = this.syncQueue.length;
      this.syncQueue = [];

      this.syncStatus = SyncStatus.ONLINE;
      console.log(`✅ 同步完成: ${syncedCount} 条记录`);
    } catch (error) {
      this.syncStatus = SyncStatus.ERROR;
      console.log(`❌ 同步失败: ${error}`);
    }
  }

  /**
   * 添加同步记录
   */
  private addSyncRecord(
    type: SyncRecord['type'],
    operation: SyncRecord['operation'],
    data: any
  ): void {
    // 检查离线队列限制
    if (this.syncQueue.length >= this.config.offline.maxQueueSize) {
      console.log('⚠️ 离线队列已满，丢弃最旧记录');
      this.syncQueue.shift();
    }

    const record: SyncRecord = {
      recordId: `sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      type,
      operation,
      data,
      timestamp: Date.now(),
      synced: false,
    };

    this.syncQueue.push(record);
  }

  // ============ 资源监控 ============

  /**
   * 启动资源监控
   */
  private startResourceMonitor(): void {
    this.resourceMonitor = setInterval(() => {
      this.checkResources();
    }, 5000);
  }

  /**
   * 检查资源
   */
  private checkResources(): void {
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

    if (memoryMB > this.config.limits.maxMemoryMB) {
      console.log(`⚠️ 内存使用超限: ${memoryMB.toFixed(2)}MB > ${this.config.limits.maxMemoryMB}MB`);
    }
  }

  /**
   * 计算存储使用
   */
  private calculateStorageUsage(): number {
    // 简化：返回 0
    return 0;
  }

  // ============ 状态查询 ============

  /**
   * 获取运行时状态
   */
  getStatus(): EdgeRuntimeStatus {
    const memoryUsage = process.memoryUsage();

    // 统计任务
    const taskStats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      queuedOffline: 0,
    };

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case EdgeTaskStatus.PENDING:
          taskStats.pending++;
          break;
        case EdgeTaskStatus.RUNNING:
          taskStats.running++;
          break;
        case EdgeTaskStatus.COMPLETED:
          taskStats.completed++;
          break;
        case EdgeTaskStatus.FAILED:
          taskStats.failed++;
          break;
        case EdgeTaskStatus.QUEUED_OFFLINE:
          taskStats.queuedOffline++;
          break;
      }
    }

    return {
      node: {
        id: this.config.nodeId,
        name: this.config.name,
        type: this.config.type,
      },
      sync: {
        status: this.syncStatus,
        lastSyncAt: undefined,
        pendingRecords: this.syncQueue.length,
      },
      resources: {
        memoryUsedMB: memoryUsage.heapUsed / 1024 / 1024,
        memoryTotalMB: this.config.capabilities.memoryMB,
        cpuPercent: 0,
        storageUsedMB: 0,
        storageTotalMB: this.config.capabilities.storageMB,
      },
      tasks: taskStats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * 获取同步队列
   */
  getSyncQueue(): SyncRecord[] {
    return this.syncQueue;
  }

  /**
   * 是否在线
   */
  isOnline(): boolean {
    return this.syncStatus === SyncStatus.ONLINE;
  }
}

// ============ 工厂函数 ============

/**
 * 创建边缘运行时
 */
export function createEdgeRuntime(config?: Partial<EdgeNodeConfig>): EdgeRuntime {
  return new EdgeRuntime(config);
}
