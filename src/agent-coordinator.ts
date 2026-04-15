/**
 * AgentCoordinator - 多 Agent 协调组件
 * 
 * 功能：
 * 1. 任务分配与调度
 * 2. 资源锁管理
 * 3. 死锁检测与解决
 * 4. 消息传递
 * 5. 状态同步
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

type AgentStatus = "idle" | "running" | "blocked" | "completed" | "failed";
type TaskStatus = "pending" | "assigned" | "running" | "completed" | "failed";
type ResourceStatus = "available" | "locked";
type Priority = "low" | "normal" | "high" | "critical";

interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  capabilities: string[];
  currentTaskId?: string;
  lockedResources: Set<string>;
  messageQueue: Message[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastHeartbeat: Date;
}

interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  requiredCapabilities: string[];
  requiredResources: string[];
  dependencies: string[];
  assignedAgentId?: string;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}

interface Resource {
  id: string;
  name: string;
  type: "file" | "api" | "tool" | "memory";
  status: ResourceStatus;
  lockedBy?: string;
  lockedAt?: Date;
  lockTimeout: number;
  waitQueue: Array<{ agentId: string; requestedAt: Date }>;
  metadata: Record<string, unknown>;
}

interface Message {
  id: string;
  from: string;
  to: string;
  type: "task_assign" | "task_complete" | "resource_request" | "resource_release" | "resource_available" | "sync" | "broadcast";
  payload: any;
  timestamp: Date;
  read: boolean;
}

interface CoordinationConfig {
  maxAgents: number;
  maxTasksPerAgent: number;
  defaultLockTimeout: number;
  deadlockCheckInterval: number;
  heartbeatTimeout: number;
  persistencePath: string;
  enableLogging: boolean;
}

interface CoordinationStats {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalResources: number;
  lockedResources: number;
  messagesProcessed: number;
  deadlocksDetected: number;
  deadlocksResolved: number;
}

// ============================================================
// AgentCoordinator 组件
// ============================================================

export class AgentCoordinator {
  private config: CoordinationConfig;
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private resources: Map<string, Resource> = new Map();
  private messages: Map<string, Message> = new Map();
  private eventLog: Array<{ timestamp: Date; event: string; data: any }> = [];
  private deadlockCheckTimer: NodeJS.Timeout | null = null;
  private stats = {
    messagesProcessed: 0,
    deadlocksDetected: 0,
    deadlocksResolved: 0,
  };
  
  constructor(config?: Partial<CoordinationConfig>) {
    this.config = {
      maxAgents: 100,
      maxTasksPerAgent: 10,
      defaultLockTimeout: 30000,
      deadlockCheckInterval: 5000,
      heartbeatTimeout: 60000,
      persistencePath: "./coordinator-state",
      enableLogging: true,
      ...config,
    };
    
    this.ensureDir(this.config.persistencePath);
    this.startDeadlockCheck();
  }
  
  // ============================================================
  // Agent 管理
  // ============================================================
  
  /**
   * 注册 Agent
   */
  registerAgent(id: string, name: string, capabilities: string[] = []): Agent {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`已达到最大 Agent 数量: ${this.config.maxAgents}`);
    }
    
    const agent: Agent = {
      id,
      name,
      status: "idle",
      capabilities,
      currentTaskId: undefined,
      lockedResources: new Set(),
      messageQueue: [],
      metadata: {},
      createdAt: new Date(),
      lastHeartbeat: new Date(),
    };
    
    this.agents.set(id, agent);
    this.log("agent_registered", { agentId: id, name, capabilities });
    
    return agent;
  }
  
  /**
   * 注销 Agent
   */
  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    // 释放所有资源
    for (const resourceId of agent.lockedResources) {
      this.releaseResource(agentId, resourceId);
    }
    
    // 重新分配任务
    if (agent.currentTaskId) {
      const task = this.tasks.get(agent.currentTaskId);
      if (task && task.status === "running") {
        task.status = "pending";
        task.assignedAgentId = undefined;
        this.scheduleNextTask();
      }
    }
    
    this.agents.delete(agentId);
    this.log("agent_unregistered", { agentId });
    
    return true;
  }
  
  /**
   * 更新心跳
   */
  heartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    agent.lastHeartbeat = new Date();
    return true;
  }
  
  /**
   * 获取 Agent
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }
  
  /**
   * 获取所有 Agent
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * 获取空闲 Agent
   */
  getIdleAgents(): Agent[] {
    return this.getAllAgents().filter(a => a.status === "idle");
  }
  
  // ============================================================
  // 任务管理
  // ============================================================
  
  /**
   * 添加任务
   */
  addTask(description: string, options?: {
    priority?: Priority;
    requiredCapabilities?: string[];
    requiredResources?: string[];
    dependencies?: string[];
    metadata?: Record<string, unknown>;
  }): Task {
    const id = this.generateId("task");
    
    const task: Task = {
      id,
      description,
      status: "pending",
      priority: options?.priority || "normal",
      requiredCapabilities: options?.requiredCapabilities || [],
      requiredResources: options?.requiredResources || [],
      dependencies: options?.dependencies || [],
      assignedAgentId: undefined,
      createdAt: new Date(),
      metadata: options?.metadata || {},
    };
    
    this.tasks.set(id, task);
    this.log("task_added", { taskId: id, description, priority: task.priority });
    
    // 尝试调度
    this.scheduleNextTask();
    
    return task;
  }
  
  /**
   * 分配任务给 Agent
   */
  assignTask(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    const agent = this.agents.get(agentId);
    
    if (!task || !agent) return false;
    if (task.status !== "pending") return false;
    if (agent.status !== "idle") return false;
    
    // 检查能力匹配
    const hasCapabilities = task.requiredCapabilities.every(
      cap => agent.capabilities.includes(cap)
    );
    if (!hasCapabilities) return false;
    
    // 检查依赖
    const dependenciesMet = task.dependencies.every(depId => {
      const dep = this.tasks.get(depId);
      return dep && dep.status === "completed";
    });
    if (!dependenciesMet) return false;
    
    // 分配
    task.status = "assigned";
    task.assignedAgentId = agentId;
    agent.status = "running";
    agent.currentTaskId = taskId;
    
    // 发送消息
    this.sendMessage("coordinator", agentId, "task_assign", { taskId });
    
    this.log("task_assigned", { taskId, agentId });
    
    return true;
  }
  
  /**
   * 开始任务
   */
  startTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "assigned") return false;
    
    task.status = "running";
    task.startedAt = new Date();
    
    this.log("task_started", { taskId });
    
    return true;
  }
  
  /**
   * 完成任务
   */
  completeTask(taskId: string, result?: any): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "running") return false;
    
    const agent = this.agents.get(task.assignedAgentId!);
    
    task.status = "completed";
    task.result = result;
    task.completedAt = new Date();
    
    if (agent) {
      agent.status = "idle";
      agent.currentTaskId = undefined;
      
      // 释放资源
      for (const resourceId of Array.from(agent.lockedResources)) {
        this.releaseResource(agent.id, resourceId);
      }
    }
    
    this.log("task_completed", { taskId, duration: task.completedAt.getTime() - task.startedAt!.getTime() });
    
    // 调度下一个任务
    this.scheduleNextTask();
    
    return true;
  }
  
  /**
   * 任务失败
   */
  failTask(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    const agent = task.assignedAgentId ? this.agents.get(task.assignedAgentId) : undefined;
    
    task.status = "failed";
    task.error = error;
    task.completedAt = new Date();
    
    if (agent) {
      agent.status = "idle";
      agent.currentTaskId = undefined;
      
      // 释放资源
      for (const resourceId of Array.from(agent.lockedResources)) {
        this.releaseResource(agent.id, resourceId);
      }
    }
    
    this.log("task_failed", { taskId, error });
    
    // 调度下一个任务
    this.scheduleNextTask();
    
    return true;
  }
  
  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }
  
  /**
   * 获取待处理任务
   */
  getPendingTasks(): Task[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === "pending")
      .sort((a, b) => this.comparePriority(b.priority, a.priority));
  }
  
  // ============================================================
  // 资源管理
  // ============================================================
  
  /**
   * 注册资源
   */
  registerResource(id: string, name: string, type: Resource["type"]): Resource {
    const resource: Resource = {
      id,
      name,
      type,
      status: "available",
      lockedBy: undefined,
      lockedAt: undefined,
      lockTimeout: this.config.defaultLockTimeout,
      waitQueue: [],
      metadata: {},
    };
    
    this.resources.set(id, resource);
    this.log("resource_registered", { resourceId: id, name, type });
    
    return resource;
  }
  
  /**
   * 请求资源锁
   */
  requestResource(agentId: string, resourceId: string): boolean {
    const agent = this.agents.get(agentId);
    const resource = this.resources.get(resourceId);
    
    if (!agent || !resource) return false;
    
    // 检查锁超时
    if (resource.lockedBy && resource.lockedAt) {
      const elapsed = Date.now() - resource.lockedAt.getTime();
      if (elapsed > resource.lockTimeout) {
        // 锁超时，强制释放
        this.releaseResource(resource.lockedBy, resourceId);
      }
    }
    
    if (resource.status === "available") {
      // 获取锁
      resource.status = "locked";
      resource.lockedBy = agentId;
      resource.lockedAt = new Date();
      agent.lockedResources.add(resourceId);
      
      this.log("resource_locked", { resourceId, agentId });
      return true;
    } else {
      // 加入等待队列
      if (!resource.waitQueue.find(w => w.agentId === agentId)) {
        resource.waitQueue.push({ agentId, requestedAt: new Date() });
        agent.status = "blocked";
        
        this.log("resource_queued", { resourceId, agentId, queuePosition: resource.waitQueue.length });
      }
      return false;
    }
  }
  
  /**
   * 释放资源锁
   */
  releaseResource(agentId: string, resourceId: string): boolean {
    const agent = this.agents.get(agentId);
    const resource = this.resources.get(resourceId);
    
    if (!agent || !resource) return false;
    if (resource.lockedBy !== agentId) return false;
    
    // 释放锁
    resource.status = "available";
    resource.lockedBy = undefined;
    resource.lockedAt = undefined;
    agent.lockedResources.delete(resourceId);
    
    this.log("resource_released", { resourceId, agentId });
    
    // 通知等待队列
    if (resource.waitQueue.length > 0) {
      const next = resource.waitQueue.shift()!;
      const nextAgent = this.agents.get(next.agentId);
      
      if (nextAgent) {
        this.sendMessage("coordinator", next.agentId, "resource_available", { resourceId });
        
        if (nextAgent.status === "blocked") {
          nextAgent.status = "running";
        }
      }
    }
    
    return true;
  }
  
  /**
   * 获取资源
   */
  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }
  
  /**
   * 获取锁定资源
   */
  getLockedResources(): Resource[] {
    return Array.from(this.resources.values()).filter(r => r.status === "locked");
  }
  
  // ============================================================
  // 消息传递
  // ============================================================
  
  /**
   * 发送消息
   */
  sendMessage(from: string, to: string, type: Message["type"], payload: any): Message {
    const id = this.generateId("msg");
    
    const message: Message = {
      id,
      from,
      to,
      type,
      payload,
      timestamp: new Date(),
      read: false,
    };
    
    this.messages.set(id, message);
    
    const targetAgent = this.agents.get(to);
    if (targetAgent) {
      targetAgent.messageQueue.push(message);
    }
    
    this.stats.messagesProcessed++;
    this.log("message_sent", { messageId: id, from, to, type });
    
    return message;
  }
  
  /**
   * 广播消息
   */
  broadcast(from: string, type: Message["type"], payload: any): Message[] {
    const messages: Message[] = [];
    
    for (const agentId of this.agents.keys()) {
      if (agentId !== from) {
        messages.push(this.sendMessage(from, agentId, type, payload));
      }
    }
    
    return messages;
  }
  
  /**
   * 获取消息
   */
  getMessages(agentId: string, unreadOnly: boolean = true): Message[] {
    const agent = this.agents.get(agentId);
    if (!agent) return [];
    
    const messages = unreadOnly
      ? agent.messageQueue.filter(m => !m.read)
      : agent.messageQueue;
    
    // 标记为已读
    messages.forEach(m => m.read = true);
    
    return messages;
  }
  
  // ============================================================
  // 死锁检测与解决
  // ============================================================
  
  /**
   * 检测死锁
   */
  detectDeadlock(): string[] | null {
    // 构建等待图
    const waitGraph: Map<string, Set<string>> = new Map();
    
    for (const [agentId, agent] of this.agents) {
      if (agent.status !== "blocked") continue;
      
      waitGraph.set(agentId, new Set());
      
      // 查找 Agent 正在等待的资源
      for (const resource of this.resources.values()) {
        if (resource.waitQueue.find(w => w.agentId === agentId)) {
          if (resource.lockedBy) {
            waitGraph.get(agentId)!.add(resource.lockedBy);
          }
        }
      }
    }
    
    // 检测环
    for (const start of waitGraph.keys()) {
      const visited = new Set<string>();
      const path: string[] = [];
      
      if (this.hasCycle(start, waitGraph, visited, path)) {
        this.stats.deadlocksDetected++;
        this.log("deadlock_detected", { agents: path });
        return path;
      }
    }
    
    return null;
  }
  
  /**
   * 解决死锁
   */
  resolveDeadlock(deadlockedAgents: string[]): boolean {
    // 策略：终止优先级最低的任务
    let victim: string | null = null;
    let lowestPriority: Priority = "critical";
    
    const priorityOrder: Priority[] = ["low", "normal", "high", "critical"];
    
    for (const agentId of deadlockedAgents) {
      const agent = this.agents.get(agentId);
      if (!agent || !agent.currentTaskId) continue;
      
      const task = this.tasks.get(agent.currentTaskId);
      if (!task) continue;
      
      if (priorityOrder.indexOf(task.priority) < priorityOrder.indexOf(lowestPriority)) {
        lowestPriority = task.priority;
        victim = agentId;
      }
    }
    
    if (!victim) {
      victim = deadlockedAgents[0];
    }
    
    // 终止受害者
    const victimAgent = this.agents.get(victim);
    if (victimAgent) {
      // 释放所有资源
      for (const resourceId of Array.from(victimAgent.lockedResources)) {
        this.releaseResource(victim, resourceId);
      }
      
      // 标记任务失败
      if (victimAgent.currentTaskId) {
        this.failTask(victimAgent.currentTaskId, "死锁牺牲者");
      }
      
      victimAgent.status = "idle";
      
      this.stats.deadlocksResolved++;
      this.log("deadlock_resolved", { victim, deadlockedAgents });
      
      return true;
    }
    
    return false;
  }
  
  private hasCycle(
    node: string,
    graph: Map<string, Set<string>>,
    visited: Set<string>,
    path: string[]
  ): boolean {
    if (visited.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        path.push(node);
        return true;
      }
      return false;
    }
    
    visited.add(node);
    path.push(node);
    
    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (this.hasCycle(neighbor, graph, visited, path)) {
          return true;
        }
      }
    }
    
    path.pop();
    return false;
  }
  
  // ============================================================
  // 调度
  // ============================================================
  
  /**
   * 调度下一个任务
   */
  private scheduleNextTask(): void {
    const pendingTasks = this.getPendingTasks();
    const idleAgents = this.getIdleAgents();
    
    for (const task of pendingTasks) {
      for (const agent of idleAgents) {
        if (this.assignTask(task.id, agent.id)) {
          break;
        }
      }
    }
  }
  
  private comparePriority(a: Priority, b: Priority): number {
    const order: Priority[] = ["low", "normal", "high", "critical"];
    return order.indexOf(a) - order.indexOf(b);
  }
  
  // ============================================================
  // 持久化
  // ============================================================
  
  /**
   * 保存状态
   */
  save(): void {
    const state = {
      agents: Array.from(this.agents.entries()),
      tasks: Array.from(this.tasks.entries()),
      resources: Array.from(this.resources.entries()),
      stats: this.stats,
      savedAt: new Date().toISOString(),
    };
    
    const filePath = path.join(this.config.persistencePath, "coordinator-state.json");
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    
    this.log("state_saved", { filePath });
  }
  
  /**
   * 加载状态
   */
  load(): void {
    const filePath = path.join(this.config.persistencePath, "coordinator-state.json");
    
    if (!fs.existsSync(filePath)) return;
    
    const state = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    this.agents.clear();
    this.tasks.clear();
    this.resources.clear();
    
    for (const [id, agent] of state.agents) {
      agent.createdAt = new Date(agent.createdAt);
      agent.lastHeartbeat = new Date(agent.lastHeartbeat);
      agent.lockedResources = new Set(agent.lockedResources);
      this.agents.set(id, agent);
    }
    
    for (const [id, task] of state.tasks) {
      task.createdAt = new Date(task.createdAt);
      if (task.startedAt) task.startedAt = new Date(task.startedAt);
      if (task.completedAt) task.completedAt = new Date(task.completedAt);
      this.tasks.set(id, task);
    }
    
    for (const [id, resource] of state.resources) {
      if (resource.lockedAt) resource.lockedAt = new Date(resource.lockedAt);
      resource.waitQueue = resource.waitQueue.map((w: any) => ({
        ...w,
        requestedAt: new Date(w.requestedAt),
      }));
      this.resources.set(id, resource);
    }
    
    this.stats = state.stats;
    
    this.log("state_loaded", { filePath });
  }
  
  // ============================================================
  // 统计与报告
  // ============================================================
  
  /**
   * 获取统计信息
   */
  getStats(): CoordinationStats {
    return {
      totalAgents: this.agents.size,
      activeAgents: this.getAllAgents().filter(a => a.status === "running").length,
      totalTasks: this.tasks.size,
      completedTasks: Array.from(this.tasks.values()).filter(t => t.status === "completed").length,
      pendingTasks: Array.from(this.tasks.values()).filter(t => t.status === "pending").length,
      totalResources: this.resources.size,
      lockedResources: this.getLockedResources().length,
      messagesProcessed: this.stats.messagesProcessed,
      deadlocksDetected: this.stats.deadlocksDetected,
      deadlocksResolved: this.stats.deadlocksResolved,
    };
  }
  
  /**
   * 生成报告
   */
  generateReport(): string {
    const stats = this.getStats();
    const lines: string[] = [];
    
    lines.push("# AgentCoordinator 报告");
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push("");
    
    lines.push("## 统计概览");
    lines.push("");
    lines.push(`- 总 Agent 数: ${stats.totalAgents}`);
    lines.push(`- 活跃 Agent: ${stats.activeAgents}`);
    lines.push(`- 总任务数: ${stats.totalTasks}`);
    lines.push(`- 已完成: ${stats.completedTasks}`);
    lines.push(`- 待处理: ${stats.pendingTasks}`);
    lines.push(`- 锁定资源: ${stats.lockedResources}/${stats.totalResources}`);
    lines.push(`- 消息处理: ${stats.messagesProcessed}`);
    lines.push(`- 死锁检测: ${stats.deadlocksDetected}`);
    lines.push(`- 死锁解决: ${stats.deadlocksResolved}`);
    lines.push("");
    
    lines.push("## Agent 状态");
    lines.push("");
    lines.push("| ID | 名称 | 状态 | 当前任务 | 锁定资源 |");
    lines.push("|----|------|------|----------|----------|");
    
    for (const agent of this.getAllAgents()) {
      lines.push(`| ${agent.id} | ${agent.name} | ${agent.status} | ${agent.currentTaskId || "-"} | ${agent.lockedResources.size} |`);
    }
    
    lines.push("");
    
    lines.push("## 任务状态");
    lines.push("");
    lines.push("| ID | 描述 | 状态 | 优先级 | 分配给 |");
    lines.push("|----|------|------|--------|--------|");
    
    for (const task of Array.from(this.tasks.values()).slice(-20)) {
      lines.push(`| ${task.id} | ${task.description.substring(0, 30)} | ${task.status} | ${task.priority} | ${task.assignedAgentId || "-"} |`);
    }
    
    return lines.join("\n");
  }
  
  // ============================================================
  // 生命周期
  // ============================================================
  
  /**
   * 启动
   */
  start(): void {
    this.startDeadlockCheck();
    this.log("coordinator_started", {});
  }
  
  /**
   * 停止
   */
  stop(): void {
    if (this.deadlockCheckTimer) {
      clearInterval(this.deadlockCheckTimer);
      this.deadlockCheckTimer = null;
    }
    this.log("coordinator_stopped", {});
  }
  
  /**
   * 清理
   */
  clear(): void {
    this.agents.clear();
    this.tasks.clear();
    this.resources.clear();
    this.messages.clear();
    this.eventLog = [];
    this.stats = { messagesProcessed: 0, deadlocksDetected: 0, deadlocksResolved: 0 };
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private startDeadlockCheck(): void {
    if (this.deadlockCheckTimer) return;
    
    this.deadlockCheckTimer = setInterval(() => {
      const deadlock = this.detectDeadlock();
      if (deadlock) {
        this.resolveDeadlock(deadlock);
      }
      
      // 检查心跳超时
      const now = Date.now();
      for (const agent of this.agents.values()) {
        if (agent.status === "running" || agent.status === "blocked") {
          const elapsed = now - agent.lastHeartbeat.getTime();
          if (elapsed > this.config.heartbeatTimeout) {
            this.log("agent_timeout", { agentId: agent.id, elapsed });
            this.unregisterAgent(agent.id);
          }
        }
      }
    }, this.config.deadlockCheckInterval);
  }
  
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  private log(event: string, data: any): void {
    if (this.config.enableLogging) {
      this.eventLog.push({ timestamp: new Date(), event, data });
    }
  }
}

// ============================================================
// 演示
// ============================================================

function demo() {
  // console.log("=".repeat(60));
  // console.log("AgentCoordinator 多 Agent 协调组件演示");
  // console.log("=".repeat(60));
  
  const coordinator = new AgentCoordinator({
    persistencePath: "./experiment-results/coordinator",
  });
  
  // 注册资源
  // console.log("\n1. 注册资源");
  
  coordinator.registerResource("file-1", "数据文件", "file");
  coordinator.registerResource("api-1", "LLM API", "api");
  coordinator.registerResource("tool-1", "执行工具", "tool");
  
  // console.log("   已注册 3 个资源");
  
  // 注册 Agent
  // console.log("\n2. 注册 Agent");
  
  const agent1 = coordinator.registerAgent("agent-1", "数据分析 Agent", ["analysis", "read"]);
  const agent2 = coordinator.registerAgent("agent-2", "执行 Agent", ["execute", "write"]);
  const agent3 = coordinator.registerAgent("agent-3", "监控 Agent", ["monitor"]);
  
  // console.log(`   已注册 ${coordinator.getAllAgents().length} 个 Agent`);
  
  // 添加任务
  // console.log("\n3. 添加任务");
  
  const task1 = coordinator.addTask("读取数据文件", {
    priority: "high",
    requiredCapabilities: ["read"],
    requiredResources: ["file-1"],
  });
  
  const task2 = coordinator.addTask("分析数据", {
    priority: "normal",
    requiredCapabilities: ["analysis"],
    dependencies: [task1.id],
  });
  
  const task3 = coordinator.addTask("执行操作", {
    priority: "low",
    requiredCapabilities: ["execute"],
    requiredResources: ["tool-1"],
  });
  
  // console.log(`   已添加 ${coordinator.getStats().totalTasks} 个任务`);
  
  // 模拟执行
  // console.log("\n4. 模拟任务执行");
  
  // Agent 1 请求资源
  const locked = coordinator.requestResource("agent-1", "file-1");
  // console.log(`   Agent 1 请求 file-1: ${locked ? "成功" : "等待"}`);
  
  // Agent 2 尝试请求同一资源
  const locked2 = coordinator.requestResource("agent-2", "file-1");
  // console.log(`   Agent 2 请求 file-1: ${locked2 ? "成功" : "等待（排队）"}`);
  
  // 获取消息
  const messages = coordinator.getMessages("agent-2");
  // console.log(`   Agent 2 收到 ${messages.length} 条消息`);
  
  // 释放资源
  coordinator.releaseResource("agent-1", "file-1");
  // console.log("   Agent 1 释放 file-1");
  
  // 统计信息
  // console.log("\n5. 统计信息");
  
  const stats = coordinator.getStats();
  // console.log(`   总 Agent: ${stats.totalAgents}`);
  // console.log(`   活跃 Agent: ${stats.activeAgents}`);
  // console.log(`   总任务: ${stats.totalTasks}`);
  // console.log(`   已完成: ${stats.completedTasks}`);
  // console.log(`   锁定资源: ${stats.lockedResources}`);
  // console.log(`   消息处理: ${stats.messagesProcessed}`);
  
  // 生成报告
  // console.log("\n6. 生成报告");
  
  const report = coordinator.generateReport();
  const reportPath = "./experiment-results/coordinator/report.md";
  fs.writeFileSync(reportPath, report);
  // console.log(`   报告已保存: ${reportPath}`);
  
  // 保存状态
  coordinator.save();
  
  // 停止
  coordinator.stop();
  
  // console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  demo();
}
