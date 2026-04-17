/**
 * Lane 优先级模型
 * 
 * 借鉴 React Fiber 的 Lane 模型，使用位掩码实现高效的优先级管理
 * 
 * @module layers/ling-shu/lane
 */

// ============ 类型定义 ============

/**
 * Lane 类型 - 31 位位掩码
 */
export type Lane = number;

/**
 * Lanes 类型 - 多个 Lane 的组合
 */
export type Lanes = number;

/**
 * Lane 优先级定义
 * 
 * 位越低，优先级越高
 */
export const Lanes = {
  /** 同步优先级 - 最高优先级，立即执行 */
  Sync: /*                        */ 0b0000000000000000000000000000001,
  
  /** 用户输入优先级 - 用户交互相关 */
  UserInput: /*                   */ 0b0000000000000000000000000010000,
  
  /** 默认优先级 - 普通任务 */
  Default: /*                     */ 0b0000000000000000000000000100000,
  
  /** 过渡优先级 - 低优先级动画/过渡 */
  Transition1: /*                 */ 0b0000000000000000000000001000000,
  Transition2: /*                 */ 0b0000000000000000000000010000000,
  Transition3: /*                 */ 0b0000000000000000000000100000000,
  Transition4: /*                 */ 0b0000000000000000000001000000000,
  Transition5: /*                 */ 0b0000000000000000000010000000000,
  Transition6: /*                 */ 0b0000000000000000000100000000000,
  Transition7: /*                 */ 0b0000000000000000001000000000000,
  Transition8: /*                 */ 0b0000000000000000010000000000000,
  Transition9: /*                 */ 0b0000000000000000100000000000000,
  Transition10: /*                */ 0b0000000000000001000000000000000,
  Transition11: /*                */ 0b0000000000000010000000000000000,
  Transition12: /*                */ 0b0000000000000100000000000000000,
  Transition13: /*                */ 0b0000000000001000000000000000000,
  Transition14: /*                */ 0b0000000000010000000000000000000,
  Transition15: /*                */ 0b0000000000100000000000000000000,
  Transition16: /*                */ 0b0000000001000000000000000000000,
  
  /** 所有过渡优先级 */
  TransitionLanes: /*             */ 0b0000000001111111111111111000000,
  
  /** 重试优先级 */
  Retry1: /*                      */ 0b0000000010000000000000000000000,
  Retry2: /*                      */ 0b0000000100000000000000000000000,
  Retry3: /*                      */ 0b0000001000000000000000000000000,
  Retry4: /*                      */ 0b0000010000000000000000000000000,
  Retry5: /*                      */ 0b0000100000000000000000000000000,
  
  /** 所有重试优先级 */
  RetryLanes: /*                  */ 0b0000111110000000000000000000000,
  
  /** 空闲优先级 - 最低优先级 */
  Idle: /*                        */ 0b0100000000000000000000000000000,
  
  /** 无优先级 */
  NoLanes: /*                     */ 0b0000000000000000000000000000000,
  
  /** 所有优先级 */
  AllLanes: /*                    */ 0b1111111111111111111111111111111,
} as const;

// ============ Lane 操作函数 ============

/**
 * 获取最高优先级的 Lane
 * 
 * 使用位运算取最低位的 1
 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

/**
 * 合并多个 Lane
 */
export function mergeLanes(a: Lanes, b: Lanes): Lanes {
  return a | b;
}

/**
 * 移除指定的 Lane
 */
export function removeLane(lanes: Lanes, lane: Lane): Lanes {
  return lanes & ~lane;
}

/**
 * 检查是否包含指定的 Lane
 */
export function includesLane(lanes: Lanes, lane: Lane): boolean {
  return (lanes & lane) !== Lanes.NoLanes;
}

/**
 * 检查是否包含某些 Lane（任意一个）
 */
export function includesSomeLanes(lanes: Lanes, subset: Lanes): boolean {
  return (lanes & subset) !== Lanes.NoLanes;
}

/**
 * 检查是否是 Lane 的子集
 */
export function isSubsetOfLanes(set: Lanes, subset: Lanes): boolean {
  return (set & subset) === subset;
}

/**
 * 获取 Lane 的优先级等级（数字越小优先级越高）
 */
export function getLanePriority(lane: Lane): number {
  // 计算最低位 1 的位置
  let priority = 0;
  let mask = lane;
  
  while (mask !== 0 && (mask & 1) === 0) {
    mask >>= 1;
    priority++;
  }
  
  return priority;
}

/**
 * 比较两个 Lane 的优先级
 * 
 * @returns 负数表示 a 优先级更高，正数表示 b 优先级更高
 */
export function compareLanes(a: Lane, b: Lane): number {
  return getLanePriority(a) - getLanePriority(b);
}

// ============ Lane 调度器 ============

/**
 * Lane 调度器
 * 
 * 管理任务的优先级和调度
 */
export class LaneScheduler {
  private pendingLanes: Lanes = Lanes.NoLanes;
  private suspendedLanes: Lanes = Lanes.NoLanes;
  private pingedLanes: Lanes = Lanes.NoLanes;
  private expiredLanes: Lanes = Lanes.NoLanes;
  private laneEventTimes: Map<Lane, number> = new Map();

  /**
   * 标记 Lane 为待处理
   */
  markLanePending(lane: Lane, eventTime: number = Date.now()): void {
    this.pendingLanes = mergeLanes(this.pendingLanes, lane);
    this.laneEventTimes.set(lane, eventTime);
  }

  /**
   * 标记 Lane 为已暂停
   */
  markLaneSuspended(lane: Lane): void {
    this.suspendedLanes = mergeLanes(this.suspendedLanes, lane);
    this.pendingLanes = removeLane(this.pendingLanes, lane);
  }

  /**
   * 标记 Lane 为已唤醒
   */
  markLanePinged(lane: Lane): void {
    this.pingedLanes = mergeLanes(this.pingedLanes, lane);
    this.suspendedLanes = removeLane(this.suspendedLanes, lane);
    // 唤醒时也需要将 Lane 重新加入待处理队列
    this.pendingLanes = mergeLanes(this.pendingLanes, lane);
  }

  /**
   * 标记 Lane 为已过期
   */
  markLaneExpired(lane: Lane): void {
    this.expiredLanes = mergeLanes(this.expiredLanes, lane);
  }

  /**
   * 获取下一个待处理的 Lane
   */
  getNextLane(): Lane | null {
    // 优先处理过期的 Lane
    if (this.expiredLanes !== Lanes.NoLanes) {
      return getHighestPriorityLane(this.expiredLanes);
    }
    
    // 处理唤醒的 Lane
    const pingedAndPending = this.pingedLanes & this.pendingLanes;
    if (pingedAndPending !== Lanes.NoLanes) {
      return getHighestPriorityLane(pingedAndPending);
    }
    
    // 处理普通待处理的 Lane
    if (this.pendingLanes !== Lanes.NoLanes) {
      return getHighestPriorityLane(this.pendingLanes);
    }
    
    return null;
  }

  /**
   * 获取所有待处理的 Lanes
   */
  getPendingLanes(): Lanes {
    return this.pendingLanes;
  }

  /**
   * 检查是否有待处理的 Lane
   */
  hasPendingLanes(): boolean {
    return this.pendingLanes !== Lanes.NoLanes;
  }

  /**
   * 清除指定的 Lane
   */
  clearLane(lane: Lane): void {
    this.pendingLanes = removeLane(this.pendingLanes, lane);
    this.suspendedLanes = removeLane(this.suspendedLanes, lane);
    this.pingedLanes = removeLane(this.pingedLanes, lane);
    this.expiredLanes = removeLane(this.expiredLanes, lane);
    this.laneEventTimes.delete(lane);
  }

  /**
   * 获取 Lane 的事件时间
   */
  getLaneEventTime(lane: Lane): number | undefined {
    return this.laneEventTimes.get(lane);
  }

  /**
   * 重置调度器
   */
  reset(): void {
    this.pendingLanes = Lanes.NoLanes;
    this.suspendedLanes = Lanes.NoLanes;
    this.pingedLanes = Lanes.NoLanes;
    this.expiredLanes = Lanes.NoLanes;
    this.laneEventTimes.clear();
  }
}

// ============ 优先级任务 ============

/**
 * 带优先级的任务
 */
export interface PrioritizedTask<T = unknown> {
  /** 任务 ID */
  id: string;
  /** 优先级 */
  lane: Lane;
  /** 任务函数 */
  execute: () => Promise<T>;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间（可选） */
  expiresAt?: number;
}

/**
 * 优先级任务队列
 */
export class PriorityTaskQueue {
  private scheduler: LaneScheduler;
  private tasks: Map<Lane, PrioritizedTask[]> = new Map();

  constructor() {
    this.scheduler = new LaneScheduler();
  }

  /**
   * 添加任务
   */
  enqueue<T>(task: PrioritizedTask<T>): void {
    const lane = task.lane;
    
    if (!this.tasks.has(lane)) {
      this.tasks.set(lane, []);
    }
    
    this.tasks.get(lane)!.push(task as PrioritizedTask);
    this.scheduler.markLanePending(lane, task.createdAt);
  }

  /**
   * 获取下一个任务
   */
  dequeue(): PrioritizedTask | null {
    const nextLane = this.scheduler.getNextLane();
    
    if (nextLane === null) {
      return null;
    }
    
    const laneTasks = this.tasks.get(nextLane);
    
    if (!laneTasks || laneTasks.length === 0) {
      // 清理空的任务列表
      this.tasks.delete(nextLane);
      this.scheduler.clearLane(nextLane);
      // 尝试获取下一个 Lane
      return this.dequeue();
    }
    
    const task = laneTasks.shift();
    
    // 如果该 Lane 没有更多任务，清理
    if (laneTasks.length === 0) {
      this.tasks.delete(nextLane);
      this.scheduler.clearLane(nextLane);
    }
    
    return task || null;
  }

  /**
   * 查看下一个任务（不移除）
   */
  peek(): PrioritizedTask | null {
    const nextLane = this.scheduler.getNextLane();
    
    if (nextLane === null) {
      return null;
    }
    
    const laneTasks = this.tasks.get(nextLane);
    return laneTasks?.[0] || null;
  }

  /**
   * 检查是否有待处理的任务
   */
  hasTasks(): boolean {
    return this.scheduler.hasPendingLanes();
  }

  /**
   * 获取任务数量
   */
  size(): number {
    let count = 0;
    for (const tasks of this.tasks.values()) {
      count += tasks.length;
    }
    return count;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.tasks.clear();
    this.scheduler.reset();
  }
}

// ============ 导出 ============

export default LaneScheduler;
