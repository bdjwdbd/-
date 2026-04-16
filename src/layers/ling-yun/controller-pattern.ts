/**
 * 控制器模式
 * 
 * 借鉴 Kubernetes 的控制器模式，实现自动调谐和自我修复
 * 
 * @module layers/ling-yun/controller-pattern
 */

// ============ 类型定义 ============

/**
 * 资源状态
 */
export interface ResourceStatus {
  /** 是否健康 */
  healthy: boolean;
  /** 是否就绪 */
  ready: boolean;
  /** 状态消息 */
  message: string;
  /** 最后更新时间 */
  lastUpdateTime: number;
  /** 条件列表 */
  conditions: ResourceCondition[];
}

/**
 * 资源条件
 */
export interface ResourceCondition {
  /** 条件类型 */
  type: string;
  /** 条件状态 */
  status: 'True' | 'False' | 'Unknown';
  /** 最后转换时间 */
  lastTransitionTime: number;
  /** 原因 */
  reason: string;
  /** 消息 */
  message: string;
}

/**
 * 调谐结果
 */
export interface ReconcileResult {
  /** 是否需要重新入队 */
  requeue: boolean;
  /** 重新入队延迟（毫秒） */
  requeueAfter?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 控制器配置
 */
export interface ControllerConfig {
  /** 控制器名称 */
  name: string;
  /** 调谐间隔（毫秒），默认 1000 */
  reconcileInterval: number;
  /** 最大并发调谐数，默认 10 */
  maxConcurrentReconciles: number;
  /** 是否启用，默认 true */
  enabled: boolean;
  /** 错误重试延迟（毫秒），默认 5000 */
  errorRetryDelay: number;
  /** 最大重试次数，默认 5 */
  maxRetries: number;
}

export const DEFAULT_CONTROLLER_CONFIG: ControllerConfig = {
  name: 'controller',
  reconcileInterval: 1000,
  maxConcurrentReconciles: 10,
  enabled: true,
  errorRetryDelay: 5000,
  maxRetries: 5,
};

// ============ 资源接口 ============

/**
 * 可调谐资源接口
 */
export interface Reconcilable<TSpec = unknown, TStatus = ResourceStatus> {
  /** 资源 ID */
  id: string;
  /** 期望状态（Spec） */
  spec: TSpec;
  /** 实际状态（Status） */
  status: TStatus;
  /** 资源版本（用于乐观并发控制） */
  resourceVersion: number;
}

// ============ 控制器接口 ============

/**
 * 控制器接口
 */
export interface Controller<TResource extends Reconcilable = Reconcilable> {
  /** 控制器名称 */
  readonly name: string;
  
  /** 启动控制器 */
  start(): Promise<void>;
  
  /** 停止控制器 */
  stop(): Promise<void>;
  
  /** 是否正在运行 */
  isRunning(): boolean;
  
  /** 入队资源进行调谐 */
  enqueue(resource: TResource): void;
  
  /** 获取队列长度 */
  getQueueLength(): number;
}

// ============ 工作队列 ============

/**
 * 工作队列项
 */
interface WorkQueueItem<T> {
  /** 资源 */
  resource: T;
  /** 入队时间 */
  enqueueTime: number;
  /** 重试次数 */
  retryCount: number;
  /** 处理中 */
  processing: boolean;
}

/**
 * 工作队列（类似 K8s 的 workqueue）
 */
class WorkQueue<T extends Reconcilable> {
  private queue: Map<string, WorkQueueItem<T>> = new Map();
  private processing: Set<string> = new Set();

  /**
   * 入队
   */
  enqueue(resource: T): void {
    const id = resource.id;
    const existing = this.queue.get(id);

    if (existing) {
      // 已存在，更新重试次数
      existing.enqueueTime = Date.now();
    } else {
      // 新项
      this.queue.set(id, {
        resource,
        enqueueTime: Date.now(),
        retryCount: 0,
        processing: false,
      });
    }
  }

  /**
   * 出队
   */
  dequeue(): T | null {
    for (const [id, item] of this.queue) {
      if (!item.processing) {
        item.processing = true;
        this.processing.add(id);
        return item.resource;
      }
    }
    return null;
  }

  /**
   * 标记完成
   */
  done(resource: T): void {
    const id = resource.id;
    this.processing.delete(id);
    this.queue.delete(id);
  }

  /**
   * 标记失败，重新入队
   */
  requeue(resource: T, delay: number = 0): void {
    const id = resource.id;
    const item = this.queue.get(id);

    if (item) {
      item.processing = false;
      this.processing.delete(id);
      item.retryCount++;

      if (delay > 0) {
        setTimeout(() => {
          this.enqueue(resource);
        }, delay);
      } else {
        item.enqueueTime = Date.now();
      }
    }
  }

  /**
   * 获取队列长度
   */
  length(): number {
    return this.queue.size;
  }

  /**
   * 清空
   */
  clear(): void {
    this.queue.clear();
    this.processing.clear();
  }
}

// ============ 基础控制器 ============

/**
 * 基础控制器实现
 * 
 * 核心循环：
 * 1. 从工作队列获取资源
 * 2. 获取期望状态和实际状态
 * 3. 比较两者差异
 * 4. 执行调谐操作
 * 5. 更新状态
 * 6. 如果需要，重新入队
 */
export abstract class BaseController<TResource extends Reconcilable>
  implements Controller<TResource>
{
  protected config: ControllerConfig;
  protected workQueue: WorkQueue<TResource>;
  protected running: boolean = false;
  protected activeReconciles: number = 0;
  private reconcileLoop?: ReturnType<typeof setInterval>;

  constructor(config: Partial<ControllerConfig> = {}) {
    this.config = { ...DEFAULT_CONTROLLER_CONFIG, ...config };
    this.workQueue = new WorkQueue<TResource>();
  }

  /**
   * 控制器名称
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * 启动控制器
   */
  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.reconcileLoop = setInterval(
      () => this.processQueue(),
      this.config.reconcileInterval
    );

    console.log(`[${this.config.name}] Controller started`);
  }

  /**
   * 停止控制器
   */
  async stop(): Promise<void> {
    this.running = false;

    if (this.reconcileLoop) {
      clearInterval(this.reconcileLoop);
      this.reconcileLoop = undefined;
    }

    this.workQueue.clear();
    console.log(`[${this.config.name}] Controller stopped`);
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 入队资源
   */
  enqueue(resource: TResource): void {
    this.workQueue.enqueue(resource);
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.workQueue.length();
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (!this.running || !this.config.enabled) return;

    // 控制并发数
    while (
      this.activeReconciles < this.config.maxConcurrentReconciles &&
      this.workQueue.length() > 0
    ) {
      const resource = this.workQueue.dequeue();
      if (resource) {
        this.activeReconciles++;
        this.reconcileResource(resource).finally(() => {
          this.activeReconciles--;
        });
      }
    }
  }

  /**
   * 调谐单个资源
   */
  private async reconcileResource(resource: TResource): Promise<void> {
    const startTime = Date.now();

    try {
      // 调用子类实现的调谐逻辑
      const result = await this.reconcile(resource);

      if (result.requeue) {
        // 重新入队
        this.workQueue.requeue(resource, result.requeueAfter);
      } else {
        // 标记完成
        this.workQueue.done(resource);
      }

      const duration = Date.now() - startTime;
      console.log(
        `[${this.config.name}] Reconciled ${resource.id} in ${duration}ms`
      );
    } catch (error) {
      console.error(
        `[${this.config.name}] Reconcile error for ${resource.id}:`,
        error
      );

      // 获取重试次数
      const item = (this.workQueue as any).queue.get(resource.id);
      const retryCount = item?.retryCount || 0;

      if (retryCount < this.config.maxRetries) {
        // 重试
        this.workQueue.requeue(resource, this.config.errorRetryDelay);
      } else {
        // 超过最大重试次数，放弃
        this.workQueue.done(resource);
        console.error(
          `[${this.config.name}] Max retries exceeded for ${resource.id}`
        );
      }
    }
  }

  /**
   * 调谐逻辑（子类实现）
   */
  protected abstract reconcile(resource: TResource): Promise<ReconcileResult>;
}

// ============ 具体控制器实现 ============

/**
 * 健康检查控制器
 * 
 * 监控系统健康状态，自动修复问题
 */
export class HealthCheckController extends BaseController<Reconcilable> {
  private healthChecker: () => Promise<boolean>;
  private healer?: () => Promise<void>;

  constructor(
    healthChecker: () => Promise<boolean>,
    healer?: () => Promise<void>,
    config?: Partial<ControllerConfig>
  ) {
    super({ name: 'health-check', ...config });
    this.healthChecker = healthChecker;
    this.healer = healer;
  }

  protected async reconcile(resource: Reconcilable): Promise<ReconcileResult> {
    const isHealthy = await this.healthChecker();

    if (!isHealthy && this.healer) {
      // 不健康，尝试修复
      await this.healer();

      // 修复后重新检查
      return { requeue: true, requeueAfter: 1000 };
    }

    // 健康或无法修复，定期重新检查
    return { requeue: true, requeueAfter: this.config.reconcileInterval };
  }
}

/**
 * 性能优化控制器
 * 
 * 监控系统性能，自动优化
 */
export class PerformanceController extends BaseController<Reconcilable> {
  private metricsCollector: () => Promise<{
    cpu: number;
    memory: number;
    latency: number;
  }>;
  private optimizer?: (metrics: {
    cpu: number;
    memory: number;
    latency: number;
  }) => Promise<void>;
  private thresholds: { cpu: number; memory: number; latency: number };

  constructor(
    metricsCollector: () => Promise<{
      cpu: number;
      memory: number;
      latency: number;
    }>,
    optimizer?: (metrics: {
      cpu: number;
      memory: number;
      latency: number;
    }) => Promise<void>,
    thresholds = { cpu: 80, memory: 80, latency: 1000 }
  ) {
    super({ name: 'performance', reconcileInterval: 5000 });
    this.metricsCollector = metricsCollector;
    this.optimizer = optimizer;
    this.thresholds = thresholds;
  }

  protected async reconcile(resource: Reconcilable): Promise<ReconcileResult> {
    const metrics = await this.metricsCollector();

    const needsOptimization =
      metrics.cpu > this.thresholds.cpu ||
      metrics.memory > this.thresholds.memory ||
      metrics.latency > this.thresholds.latency;

    if (needsOptimization && this.optimizer) {
      await this.optimizer(metrics);
      return { requeue: true, requeueAfter: 2000 };
    }

    return { requeue: true, requeueAfter: this.config.reconcileInterval };
  }
}

/**
 * 资源清理控制器
 * 
 * 定期清理过期资源
 */
export class GarbageCollectionController extends BaseController<Reconcilable> {
  private resourceScanner: () => Promise<string[]>;
  private resourceCleaner: (id: string) => Promise<void>;
  private isExpired: (id: string) => Promise<boolean>;

  constructor(
    resourceScanner: () => Promise<string[]>,
    resourceCleaner: (id: string) => Promise<void>,
    isExpired: (id: string) => Promise<boolean>,
    config?: Partial<ControllerConfig>
  ) {
    super({ name: 'garbage-collection', reconcileInterval: 60000, ...config });
    this.resourceScanner = resourceScanner;
    this.resourceCleaner = resourceCleaner;
    this.isExpired = isExpired;
  }

  protected async reconcile(resource: Reconcilable): Promise<ReconcileResult> {
    // 扫描资源
    const resources = await this.resourceScanner();

    for (const id of resources) {
      if (await this.isExpired(id)) {
        await this.resourceCleaner(id);
        console.log(`[gc] Cleaned up expired resource: ${id}`);
      }
    }

    return { requeue: true, requeueAfter: this.config.reconcileInterval };
  }
}

// ============ 控制器管理器 ============

/**
 * 控制器管理器
 * 
 * 管理多个控制器的生命周期
 */
export class ControllerManager {
  private controllers: Map<string, Controller<Reconcilable>> = new Map();

  /**
   * 注册控制器
   */
  register(controller: Controller<Reconcilable>): void {
    this.controllers.set(controller.name, controller);
  }

  /**
   * 启动所有控制器
   */
  async startAll(): Promise<void> {
    for (const controller of this.controllers.values()) {
      await controller.start();
    }
  }

  /**
   * 停止所有控制器
   */
  async stopAll(): Promise<void> {
    for (const controller of this.controllers.values()) {
      await controller.stop();
    }
  }

  /**
   * 获取控制器
   */
  get(name: string): Controller<Reconcilable> | undefined {
    return this.controllers.get(name);
  }

  /**
   * 获取所有控制器名称
   */
  getNames(): string[] {
    return Array.from(this.controllers.keys());
  }
}

// ============ 导出 ============

export default BaseController;
