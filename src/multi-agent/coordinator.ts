/**
 * 多 Agent 协调器
 * 
 * 负责：
 * - Agent 注册与管理
 * - 任务分配与调度
 * - 消息路由
 * - 故障检测与恢复
 * 
 * @module multi-agent/coordinator
 */

import * as crypto from 'crypto';
import {
  AgentDefinition,
  AgentInstance,
  AgentStatus,
  TaskDefinition,
  TaskInstance,
  TaskStatus,
  TaskPriority,
  Message,
  MessageType,
  CoordinatorConfig,
  DEFAULT_COORDINATOR_CONFIG,
  SchedulingStrategy,
} from './types';

// ============ Agent 注册表 ============

/**
 * Agent 注册表
 */
class AgentRegistry {
  private agents: Map<string, AgentInstance> = new Map();

  /**
   * 注册 Agent
   */
  register(definition: AgentDefinition): AgentInstance {
    const instance: AgentInstance = {
      definition,
      status: AgentStatus.IDLE,
      currentTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      lastHeartbeat: Date.now(),
      stats: {
        avgResponseTime: 0,
        successRate: 1.0,
        totalCost: 0,
      },
    };

    this.agents.set(definition.agentId, instance);
    return instance;
  }

  /**
   * 注销 Agent
   */
  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * 获取 Agent
   */
  get(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 获取所有 Agent
   */
  getAll(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取空闲 Agent
   */
  getIdle(): AgentInstance[] {
    return this.getAll().filter(
      a => a.status === AgentStatus.IDLE && 
           a.currentTasks < a.definition.resourceLimits.maxConcurrentTasks
    );
  }

  /**
   * 更新 Agent 状态
   */
  updateStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastHeartbeat = Date.now();
    }
  }

  /**
   * 更新心跳
   */
  updateHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
    }
  }

  /**
   * 检查超时 Agent
   */
  checkTimeout(timeout: number): string[] {
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [id, agent] of this.agents) {
      if (now - agent.lastHeartbeat > timeout) {
        agent.status = AgentStatus.OFFLINE;
        timedOut.push(id);
      }
    }

    return timedOut;
  }
}

// ============ 任务队列 ============

/**
 * 任务队列
 */
class TaskQueue {
  private pending: TaskInstance[] = [];
  private running: Map<string, TaskInstance> = new Map();
  private completed: Map<string, TaskInstance> = new Map();

  /**
   * 添加任务
   */
  add(definition: TaskDefinition): TaskInstance {
    const instance: TaskInstance = {
      definition,
      status: TaskStatus.PENDING,
      retryCount: 0,
      history: [{
        timestamp: Date.now(),
        status: TaskStatus.PENDING,
        message: '任务创建',
      }],
    };

    this.pending.push(instance);
    this.sort();
    return instance;
  }

  /**
   * 排序（按优先级）
   */
  private sort(): void {
    this.pending.sort((a, b) => b.definition.priority - a.definition.priority);
  }

  /**
   * 获取下一个任务
   */
  getNext(): TaskInstance | undefined {
    return this.pending.shift();
  }

  /**
   * 开始执行任务
   */
  start(taskId: string, agentId: string): void {
    const task = this.pending.find(t => t.definition.taskId === taskId);
    if (task) {
      task.status = TaskStatus.RUNNING;
      task.assignedAgent = agentId;
      task.startTime = Date.now();
      task.history.push({
        timestamp: Date.now(),
        status: TaskStatus.RUNNING,
        agent: agentId,
        message: '任务开始执行',
      });
      
      this.pending = this.pending.filter(t => t.definition.taskId !== taskId);
      this.running.set(taskId, task);
    }
  }

  /**
   * 完成任务
   */
  complete(taskId: string, output: any): void {
    const task = this.running.get(taskId);
    if (task) {
      task.status = TaskStatus.COMPLETED;
      task.output = output;
      task.endTime = Date.now();
      task.history.push({
        timestamp: Date.now(),
        status: TaskStatus.COMPLETED,
        message: '任务完成',
      });
      
      this.running.delete(taskId);
      this.completed.set(taskId, task);
    }
  }

  /**
   * 任务失败
   */
  fail(taskId: string, error: string): void {
    const task = this.running.get(taskId);
    if (task) {
      task.status = TaskStatus.FAILED;
      task.error = error;
      task.endTime = Date.now();
      task.history.push({
        timestamp: Date.now(),
        status: TaskStatus.FAILED,
        message: `任务失败: ${error}`,
      });
      
      this.running.delete(taskId);
      this.completed.set(taskId, task);
    }
  }

  /**
   * 重试任务
   */
  retry(taskId: string): boolean {
    const task = this.completed.get(taskId);
    if (task && task.retryCount < task.definition.constraints.maxRetries) {
      task.status = TaskStatus.PENDING;
      task.retryCount++;
      task.assignedAgent = undefined;
      task.startTime = undefined;
      task.endTime = undefined;
      task.error = undefined;
      task.history.push({
        timestamp: Date.now(),
        status: TaskStatus.PENDING,
        message: `任务重试 (${task.retryCount}/${task.definition.constraints.maxRetries})`,
      });
      
      this.completed.delete(taskId);
      this.pending.push(task);
      this.sort();
      return true;
    }
    return false;
  }

  /**
   * 获取队列状态
   */
  getStats() {
    return {
      pending: this.pending.length,
      running: this.running.size,
      completed: this.completed.size,
    };
  }
}

// ============ 调度器 ============

/**
 * 调度器
 */
class Scheduler {
  private config: CoordinatorConfig;
  private roundRobinIndex: number = 0;

  constructor(config: CoordinatorConfig) {
    this.config = config;
  }

  /**
   * 选择 Agent
   */
  selectAgent(
    task: TaskDefinition,
    agents: AgentInstance[]
  ): AgentInstance | null {
    if (agents.length === 0) return null;

    // 过滤符合条件的 Agent
    const eligible = agents.filter(agent => 
      this.hasRequiredCapabilities(agent, task.constraints.requiredCapabilities) &&
      !this.isExcluded(agent, task.constraints.excludedAgents || []) &&
      agent.currentTasks < agent.definition.resourceLimits.maxConcurrentTasks
    );

    if (eligible.length === 0) return null;

    // 优先使用指定的 Agent
    if (task.constraints.preferredAgents && task.constraints.preferredAgents.length > 0) {
      const preferred = eligible.find(a => 
        task.constraints.preferredAgents!.includes(a.definition.agentId)
      );
      if (preferred) return preferred;
    }

    // 根据策略选择
    switch (this.config.schedulingStrategy) {
      case SchedulingStrategy.ROUND_ROBIN:
        return this.roundRobin(eligible);
      
      case SchedulingStrategy.LEAST_TASKS:
        return this.leastTasks(eligible);
      
      case SchedulingStrategy.BEST_PERFORMANCE:
        return this.bestPerformance(eligible);
      
      case SchedulingStrategy.LOWEST_COST:
        return this.lowestCost(eligible);
      
      case SchedulingStrategy.RANDOM:
        return this.random(eligible);
      
      default:
        return eligible[0];
    }
  }

  /**
   * 轮询调度
   */
  private roundRobin(agents: AgentInstance[]): AgentInstance {
    const agent = agents[this.roundRobinIndex % agents.length];
    this.roundRobinIndex++;
    return agent;
  }

  /**
   * 最少任务调度
   */
  private leastTasks(agents: AgentInstance[]): AgentInstance {
    return agents.reduce((min, a) => 
      a.currentTasks < min.currentTasks ? a : min
    );
  }

  /**
   * 最高性能调度
   */
  private bestPerformance(agents: AgentInstance[]): AgentInstance {
    return agents.reduce((best, a) => 
      a.stats.successRate > best.stats.successRate ? a : best
    );
  }

  /**
   * 最低成本调度
   */
  private lowestCost(agents: AgentInstance[]): AgentInstance {
    return agents.reduce((min, a) => 
      a.stats.totalCost < min.stats.totalCost ? a : min
    );
  }

  /**
   * 随机调度
   */
  private random(agents: AgentInstance[]): AgentInstance {
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * 检查能力
   */
  private hasRequiredCapabilities(
    agent: AgentInstance,
    required: string[]
  ): boolean {
    const agentCapabilities = agent.definition.capabilities.map(c => c.id);
    return required.every(cap => agentCapabilities.includes(cap));
  }

  /**
   * 检查是否被排除
   */
  private isExcluded(agent: AgentInstance, excluded: string[]): boolean {
    return excluded.includes(agent.definition.agentId);
  }
}

// ============ 协调器 ============

/**
 * 多 Agent 协调器
 */
export class Coordinator {
  private config: CoordinatorConfig;
  private registry: AgentRegistry;
  private queue: TaskQueue;
  private scheduler: Scheduler;
  private messageHandlers: Map<MessageType, ((msg: Message) => void)[]> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private dispatchTimer?: NodeJS.Timeout;

  constructor(config: Partial<CoordinatorConfig> = {}) {
    this.config = { ...DEFAULT_COORDINATOR_CONFIG, ...config };
    this.registry = new AgentRegistry();
    this.queue = new TaskQueue();
    this.scheduler = new Scheduler(this.config);
  }

  /**
   * 启动协调器
   */
  async start(): Promise<void> {
    // 启动心跳检测
    this.heartbeatTimer = setInterval(() => {
      const timedOut = this.registry.checkTimeout(this.config.heartbeatTimeout);
      for (const agentId of timedOut) {
        console.log(`⚠️ Agent ${agentId} 超时离线`);
      }
    }, this.config.heartbeatInterval);

    // 启动任务分发
    this.dispatchTimer = setInterval(() => {
      this.dispatchTasks();
    }, 100);

    console.log('🚀 协调器已启动');
  }

  /**
   * 停止协调器
   */
  async stop(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    console.log('🛑 协调器已停止');
  }

  // ============ Agent 管理 ============

  /**
   * 注册 Agent
   */
  registerAgent(definition: AgentDefinition): AgentInstance {
    const instance = this.registry.register(definition);
    console.log(`✅ Agent 注册: ${definition.name} (${definition.agentId})`);
    return instance;
  }

  /**
   * 注销 Agent
   */
  unregisterAgent(agentId: string): boolean {
    const result = this.registry.unregister(agentId);
    if (result) {
      console.log(`👋 Agent 注销: ${agentId}`);
    }
    return result;
  }

  /**
   * 获取所有 Agent
   */
  getAgents(): AgentInstance[] {
    return this.registry.getAll();
  }

  /**
   * 获取 Agent 状态
   */
  getAgentStatus(agentId: string): AgentInstance | undefined {
    return this.registry.get(agentId);
  }

  // ============ 任务管理 ============

  /**
   * 提交任务
   */
  submitTask(definition: TaskDefinition): TaskInstance {
    const instance = this.queue.add(definition);
    console.log(`📥 任务提交: ${definition.name} (${definition.taskId})`);
    return instance;
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): TaskInstance | undefined {
    // 从各个队列查找
    return undefined; // 简化
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    // 简化实现
    return false;
  }

  // ============ 任务分发 ============

  /**
   * 分发任务
   */
  private dispatchTasks(): void {
    const idleAgents = this.registry.getIdle();
    if (idleAgents.length === 0) return;

    while (true) {
      const task = this.queue.getNext();
      if (!task) break;

      const agent = this.scheduler.selectAgent(task.definition, idleAgents);
      if (!agent) {
        // 没有合适的 Agent，任务放回队列
        // this.queue.addBack(task);
        break;
      }

      // 分配任务
      this.assignTask(task, agent);
    }
  }

  /**
   * 分配任务给 Agent
   */
  private assignTask(task: TaskInstance, agent: AgentInstance): void {
    task.status = TaskStatus.ASSIGNED;
    task.assignedAgent = agent.definition.agentId;
    task.history.push({
      timestamp: Date.now(),
      status: TaskStatus.ASSIGNED,
      agent: agent.definition.agentId,
      message: '任务已分配',
    });

    agent.currentTasks++;
    if (agent.currentTasks >= agent.definition.resourceLimits.maxConcurrentTasks) {
      agent.status = AgentStatus.BUSY;
    }

    // 发送任务分配消息
    this.sendMessage({
      messageId: `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      type: MessageType.TASK_ASSIGN,
      from: 'coordinator',
      to: agent.definition.agentId,
      timestamp: Date.now(),
      payload: task.definition,
      taskId: task.definition.taskId,
    });

    console.log(`📤 任务分配: ${task.definition.name} → ${agent.definition.name}`);
  }

  // ============ 消息处理 ============

  /**
   * 发送消息
   */
  sendMessage(message: Message): void {
    const handlers = this.messageHandlers.get(message.type) || [];
    for (const handler of handlers) {
      handler(message);
    }
  }

  /**
   * 注册消息处理器
   */
  onMessage(type: MessageType, handler: (msg: Message) => void): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  /**
   * 处理接收的消息
   */
  handleIncomingMessage(message: Message): void {
    switch (message.type) {
      case MessageType.HEARTBEAT:
        this.registry.updateHeartbeat(message.from);
        break;

      case MessageType.TASK_COMPLETE:
        this.handleTaskComplete(message);
        break;

      case MessageType.TASK_FAIL:
        this.handleTaskFail(message);
        break;

      case MessageType.TASK_PROGRESS:
        this.handleTaskProgress(message);
        break;
    }
  }

  /**
   * 处理任务完成
   */
  private handleTaskComplete(message: Message): void {
    const { taskId, output } = message.payload;
    this.queue.complete(taskId, output);

    const agent = this.registry.get(message.from);
    if (agent) {
      agent.currentTasks--;
      agent.completedTasks++;
      if (agent.currentTasks === 0) {
        agent.status = AgentStatus.IDLE;
      }
    }

    console.log(`✅ 任务完成: ${taskId}`);
  }

  /**
   * 处理任务失败
   */
  private handleTaskFail(message: Message): void {
    const { taskId, error } = message.payload;
    
    const agent = this.registry.get(message.from);
    if (agent) {
      agent.currentTasks--;
      agent.failedTasks++;
      if (agent.currentTasks === 0) {
        agent.status = AgentStatus.IDLE;
      }
    }

    // 尝试重试
    if (!this.queue.retry(taskId)) {
      this.queue.fail(taskId, error);
      console.log(`❌ 任务失败: ${taskId} - ${error}`);
    } else {
      console.log(`🔄 任务重试: ${taskId}`);
    }
  }

  /**
   * 处理任务进度
   */
  private handleTaskProgress(message: Message): void {
    const { taskId, progress } = message.payload;
    console.log(`📊 任务进度: ${taskId} - ${progress}%`);
  }

  // ============ 状态查询 ============

  /**
   * 获取系统状态
   */
  getStatus() {
    return {
      agents: {
        total: this.registry.getAll().length,
        idle: this.registry.getIdle().length,
      },
      tasks: this.queue.getStats(),
    };
  }
}

// ============ 工厂函数 ============

/**
 * 创建协调器
 */
export function createCoordinator(config?: Partial<CoordinatorConfig>): Coordinator {
  return new Coordinator(config);
}
