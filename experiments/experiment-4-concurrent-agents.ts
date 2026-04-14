/**
 * 实验 4：并发 Agent 协调测试
 * 
 * 目的：验证 H-003（多个 Agent 并发会陷入无政府状态）
 * 
 * 假设：当多个 Agent 同时执行任务时，会出现：
 * 1. 资源竞争（文件、API 调用）
 * 2. 状态不一致
 * 3. 死锁或活锁
 * 4. 结果冲突
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface Agent {
  id: string;
  name: string;
  status: "idle" | "running" | "blocked" | "completed" | "failed";
  currentTask?: Task;
  resources: Set<string>;
  messageQueue: Message[];
  state: Record<string, any>;
}

interface Task {
  id: string;
  description: string;
  dependencies: string[];
  priority: number;
  status: "pending" | "running" | "completed" | "failed";
  assignedAgent?: string;
  result?: any;
  error?: string;
}

interface Message {
  from: string;
  to: string;
  type: "request" | "response" | "broadcast" | "lock" | "unlock";
  content: any;
  timestamp: number;
}

interface Resource {
  id: string;
  type: "file" | "api" | "memory" | "tool";
  lockedBy?: string;
  lockTime?: number;
  waitQueue: string[];
}

interface ExperimentResult {
  scenario: string;
  agentCount: number;
  taskCount: number;
  metrics: {
    completionRate: number;
    avgLatency: number;
    conflictCount: number;
    deadlockCount: number;
    resourceWaitTime: number;
    messageCount: number;
  };
  events: EventLog[];
  conclusion: string;
}

interface EventLog {
  timestamp: number;
  agentId: string;
  event: string;
  details: any;
}

// ============================================================
// 并发协调器
// ============================================================

class AgentCoordinator {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private resources: Map<string, Resource> = new Map();
  private messageBus: Message[] = [];
  private eventLog: EventLog[] = [];
  private lockTimeout: number = 5000; // 5 秒锁超时
  
  constructor() {
    this.initializeResources();
  }
  
  /**
   * 初始化资源
   */
  private initializeResources(): void {
    // 文件资源
    for (let i = 1; i <= 5; i++) {
      this.resources.set(`file-${i}`, {
        id: `file-${i}`,
        type: "file",
        waitQueue: [],
      });
    }
    
    // API 资源
    for (let i = 1; i <= 3; i++) {
      this.resources.set(`api-${i}`, {
        id: `api-${i}`,
        type: "api",
        waitQueue: [],
      });
    }
    
    // 工具资源
    this.resources.set("tool-exec", {
      id: "tool-exec",
      type: "tool",
      waitQueue: [],
    });
  }
  
  /**
   * 注册 Agent
   */
  registerAgent(id: string, name: string): Agent {
    const agent: Agent = {
      id,
      name,
      status: "idle",
      resources: new Set(),
      messageQueue: [],
      state: {},
    };
    
    this.agents.set(id, agent);
    this.log(id, "registered", { name });
    
    return agent;
  }
  
  /**
   * 添加任务
   */
  addTask(task: Omit<Task, "id" | "status">): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullTask: Task = {
      ...task,
      id,
      status: "pending",
    };
    
    this.tasks.set(id, fullTask);
    this.log("system", "task_added", { taskId: id, description: task.description });
    
    return id;
  }
  
  /**
   * 请求资源锁
   */
  requestLock(agentId: string, resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    const agent = this.agents.get(agentId);
    
    if (!resource || !agent) return false;
    
    // 检查锁超时
    if (resource.lockedBy && resource.lockTime) {
      if (Date.now() - resource.lockTime > this.lockTimeout) {
        // 锁超时，强制释放
        this.log(resource.lockedBy, "lock_timeout", { resourceId });
        resource.lockedBy = undefined;
        resource.lockTime = undefined;
      }
    }
    
    if (resource.lockedBy && resource.lockedBy !== agentId) {
      // 资源被占用，加入等待队列
      if (!resource.waitQueue.includes(agentId)) {
        resource.waitQueue.push(agentId);
        this.log(agentId, "waiting_for_resource", { resourceId, heldBy: resource.lockedBy });
      }
      return false;
    }
    
    // 获取锁
    resource.lockedBy = agentId;
    resource.lockTime = Date.now();
    agent.resources.add(resourceId);
    
    this.log(agentId, "acquired_lock", { resourceId });
    
    return true;
  }
  
  /**
   * 释放资源锁
   */
  releaseLock(agentId: string, resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    const agent = this.agents.get(agentId);
    
    if (!resource || !agent) return false;
    
    if (resource.lockedBy !== agentId) {
      this.log(agentId, "release_failed", { resourceId, heldBy: resource.lockedBy });
      return false;
    }
    
    // 释放锁
    resource.lockedBy = undefined;
    resource.lockTime = undefined;
    agent.resources.delete(resourceId);
    
    this.log(agentId, "released_lock", { resourceId });
    
    // 通知等待队列
    if (resource.waitQueue.length > 0) {
      const nextAgent = resource.waitQueue.shift()!;
      this.sendMessage(agentId, nextAgent, "lock", { resourceId, available: true });
    }
    
    return true;
  }
  
  /**
   * 发送消息
   */
  sendMessage(from: string, to: string, type: Message["type"], content: any): void {
    const message: Message = {
      from,
      to,
      type,
      content,
      timestamp: Date.now(),
    };
    
    this.messageBus.push(message);
    
    const targetAgent = this.agents.get(to);
    if (targetAgent) {
      targetAgent.messageQueue.push(message);
    }
    
    this.log(from, "message_sent", { to, type });
  }
  
  /**
   * 广播消息
   */
  broadcast(from: string, content: any): void {
    for (const agentId of this.agents.keys()) {
      if (agentId !== from) {
        this.sendMessage(from, agentId, "broadcast", content);
      }
    }
  }
  
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
      for (const [resourceId, resource] of this.resources) {
        if (resource.waitQueue.includes(agentId)) {
          // Agent 等待这个资源，资源被谁持有？
          if (resource.lockedBy) {
            waitGraph.get(agentId)!.add(resource.lockedBy);
          }
        }
      }
    }
    
    // 检测环
    for (const [start, _] of waitGraph) {
      const visited = new Set<string>();
      const path: string[] = [];
      
      if (this.hasCycle(start, waitGraph, visited, path)) {
        return path;
      }
    }
    
    return null;
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
  
  /**
   * 解决死锁
   */
  resolveDeadlock(deadlockedAgents: string[]): void {
    // 简单策略：终止优先级最低的 Agent
    let victim = deadlockedAgents[0];
    let lowestPriority = Infinity;
    
    for (const agentId of deadlockedAgents) {
      const agent = this.agents.get(agentId);
      if (agent && agent.currentTask) {
        const task = this.tasks.get(agent.currentTask.id);
        if (task && task.priority < lowestPriority) {
          lowestPriority = task.priority;
          victim = agentId;
        }
      }
    }
    
    // 终止受害者
    const victimAgent = this.agents.get(victim);
    if (victimAgent) {
      // 释放所有资源
      for (const resourceId of victimAgent.resources) {
        this.releaseLock(victim, resourceId);
      }
      
      victimAgent.status = "failed";
      this.log(victim, "deadlock_victim", { deadlockedAgents });
    }
  }
  
  /**
   * 模拟 Agent 执行
   */
  async simulateAgentExecution(agentId: string, steps: Array<{
    action: "lock" | "unlock" | "work" | "wait" | "message";
    resource?: string;
    target?: string;
    duration?: number;
  }>): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    agent.status = "running";
    
    for (const step of steps) {
      switch (step.action) {
        case "lock":
          const acquired = this.requestLock(agentId, step.resource!);
          if (!acquired) {
            agent.status = "blocked";
            // 等待资源
            await new Promise(r => setTimeout(r, step.duration || 100));
            agent.status = "running";
          }
          break;
          
        case "unlock":
          this.releaseLock(agentId, step.resource!);
          break;
          
        case "work":
          await new Promise(r => setTimeout(r, step.duration || 50));
          this.log(agentId, "working", { duration: step.duration });
          break;
          
        case "wait":
          await new Promise(r => setTimeout(r, step.duration || 100));
          break;
          
        case "message":
          if (step.target) {
            this.sendMessage(agentId, step.target, "request", { type: "sync" });
          }
          break;
      }
      
      // 检测死锁
      const deadlock = this.detectDeadlock();
      if (deadlock) {
        this.log("system", "deadlock_detected", { agents: deadlock });
        this.resolveDeadlock(deadlock);
      }
    }
    
    // 释放所有资源
    for (const resourceId of Array.from(agent.resources)) {
      this.releaseLock(agentId, resourceId);
    }
    
    agent.status = "completed";
    this.log(agentId, "completed", {});
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    agentCount: number;
    taskCount: number;
    resourceCount: number;
    messageCount: number;
    eventCount: number;
    conflictCount: number;
    deadlockCount: number;
  } {
    let conflictCount = 0;
    let deadlockCount = 0;
    
    for (const event of this.eventLog) {
      if (event.event === "waiting_for_resource") conflictCount++;
      if (event.event === "deadlock_detected") deadlockCount++;
    }
    
    return {
      agentCount: this.agents.size,
      taskCount: this.tasks.size,
      resourceCount: this.resources.size,
      messageCount: this.messageBus.length,
      eventCount: this.eventLog.length,
      conflictCount,
      deadlockCount,
    };
  }
  
  /**
   * 获取事件日志
   */
  getEventLog(): EventLog[] {
    return [...this.eventLog];
  }
  
  /**
   * 清理
   */
  reset(): void {
    this.agents.clear();
    this.tasks.clear();
    this.messageBus = [];
    this.eventLog = [];
    this.initializeResources();
  }
  
  private log(agentId: string, event: string, details: any): void {
    this.eventLog.push({
      timestamp: Date.now(),
      agentId,
      event,
      details,
    });
  }
}

// ============================================================
// 实验场景
// ============================================================

async function runScenario(
  name: string,
  agentCount: number,
  taskCount: number,
  coordinator: AgentCoordinator
): Promise<ExperimentResult> {
  console.log(`\n--- 场景: ${name} ---`);
  
  coordinator.reset();
  
  // 注册 Agent
  for (let i = 1; i <= agentCount; i++) {
    coordinator.registerAgent(`agent-${i}`, `Agent ${i}`);
  }
  
  // 添加任务
  for (let i = 1; i <= taskCount; i++) {
    coordinator.addTask({
      description: `Task ${i}`,
      dependencies: i > 1 ? [`task-${i - 1}`] : [],
      priority: Math.floor(Math.random() * 10) + 1,
    });
  }
  
  const startTime = Date.now();
  
  // 模拟并发执行
  const executions = [];
  
  for (let i = 1; i <= agentCount; i++) {
    const agentId = `agent-${i}`;
    
    // 随机生成执行步骤
    const steps = [];
    const resourceCount = Math.floor(Math.random() * 3) + 1;
    
    for (let j = 1; j <= resourceCount; j++) {
      const resourceId = `file-${Math.floor(Math.random() * 5) + 1}`;
      steps.push({ action: "lock" as const, resource: resourceId });
      steps.push({ action: "work" as const, duration: Math.random() * 100 });
      steps.push({ action: "unlock" as const, resource: resourceId });
    }
    
    executions.push(coordinator.simulateAgentExecution(agentId, steps));
  }
  
  await Promise.all(executions);
  
  const endTime = Date.now();
  const stats = coordinator.getStats();
  
  const result: ExperimentResult = {
    scenario: name,
    agentCount,
    taskCount,
    metrics: {
      completionRate: 1, // 简化
      avgLatency: (endTime - startTime) / agentCount,
      conflictCount: stats.conflictCount,
      deadlockCount: stats.deadlockCount,
      resourceWaitTime: 0, // 简化
      messageCount: stats.messageCount,
    },
    events: coordinator.getEventLog(),
    conclusion: "",
  };
  
  // 生成结论
  if (stats.deadlockCount > 0) {
    result.conclusion = `检测到 ${stats.deadlockCount} 次死锁，需要协调机制`;
  } else if (stats.conflictCount > agentCount) {
    result.conclusion = `资源冲突 ${stats.conflictCount} 次，建议增加资源或优化调度`;
  } else {
    result.conclusion = "并发执行正常，无严重问题";
  }
  
  console.log(`  Agent 数: ${agentCount}`);
  console.log(`  任务数: ${taskCount}`);
  console.log(`  冲突次数: ${stats.conflictCount}`);
  console.log(`  死锁次数: ${stats.deadlockCount}`);
  console.log(`  结论: ${result.conclusion}`);
  
  return result;
}

// ============================================================
// 主实验
// ============================================================

async function runExperiment() {
  console.log("=".repeat(60));
  console.log("实验 4：并发 Agent 协调测试");
  console.log("=".repeat(60));
  
  const coordinator = new AgentCoordinator();
  const results: ExperimentResult[] = [];
  
  // 场景 1：低并发（2 Agent）
  results.push(await runScenario("低并发", 2, 4, coordinator));
  
  // 场景 2：中并发（5 Agent）
  results.push(await runScenario("中并发", 5, 10, coordinator));
  
  // 场景 3：高并发（10 Agent）
  results.push(await runScenario("高并发", 10, 20, coordinator));
  
  // 场景 4：资源竞争（5 Agent，2 资源）
  console.log(`\n--- 场景: 资源竞争 ---`);
  coordinator.reset();
  
  for (let i = 1; i <= 5; i++) {
    coordinator.registerAgent(`agent-${i}`, `Agent ${i}`);
  }
  
  // 所有 Agent 竞争同一资源
  const competingExecutions = [];
  for (let i = 1; i <= 5; i++) {
    const agentId = `agent-${i}`;
    const steps = [
      { action: "lock" as const, resource: "file-1" },
      { action: "work" as const, duration: 200 },
      { action: "unlock" as const, resource: "file-1" },
    ];
    competingExecutions.push(coordinator.simulateAgentExecution(agentId, steps));
  }
  
  await Promise.all(competingExecutions);
  
  const competingStats = coordinator.getStats();
  console.log(`  冲突次数: ${competingStats.conflictCount}`);
  console.log(`  死锁次数: ${competingStats.deadlockCount}`);
  
  // 场景 5：死锁场景
  console.log(`\n--- 场景: 死锁测试 ---`);
  coordinator.reset();
  
  coordinator.registerAgent("agent-a", "Agent A");
  coordinator.registerAgent("agent-b", "Agent B");
  
  // A 持有 file-1，等待 file-2
  // B 持有 file-2，等待 file-1
  const deadlockExecutions = [
    coordinator.simulateAgentExecution("agent-a", [
      { action: "lock", resource: "file-1" },
      { action: "wait", duration: 50 },
      { action: "lock", resource: "file-2" },
      { action: "work", duration: 100 },
      { action: "unlock", resource: "file-2" },
      { action: "unlock", resource: "file-1" },
    ]),
    coordinator.simulateAgentExecution("agent-b", [
      { action: "lock", resource: "file-2" },
      { action: "wait", duration: 50 },
      { action: "lock", resource: "file-1" },
      { action: "work", duration: 100 },
      { action: "unlock", resource: "file-1" },
      { action: "unlock", resource: "file-2" },
    ]),
  ];
  
  await Promise.all(deadlockExecutions);
  
  const deadlockStats = coordinator.getStats();
  console.log(`  冲突次数: ${deadlockStats.conflictCount}`);
  console.log(`  死锁次数: ${deadlockStats.deadlockCount}`);
  
  // 汇总结果
  console.log("\n" + "=".repeat(60));
  console.log("实验结论");
  console.log("=".repeat(60));
  
  const totalConflicts = results.reduce((s, r) => s + r.metrics.conflictCount, 0);
  const totalDeadlocks = results.reduce((s, r) => s + r.metrics.deadlockCount, 0);
  
  console.log(`\n总冲突次数: ${totalConflicts}`);
  console.log(`总死锁次数: ${totalDeadlocks}`);
  
  if (totalDeadlocks > 0) {
    console.log("\n❌ 假设 H-003 成立：多 Agent 并发会产生死锁");
    console.log("建议：实现 AgentCoordinator 组件进行协调");
  } else if (totalConflicts > 0) {
    console.log("\n⚠️ 假设 H-003 部分成立：多 Agent 并发会产生资源冲突");
    console.log("建议：实现资源锁和调度机制");
  } else {
    console.log("\n✅ 假设 H-003 不成立：多 Agent 并发不会产生严重问题");
  }
  
  // 保存结果
  const reportPath = "./experiment-results/experiment-4-concurrent-agents.json";
  fs.writeFileSync(reportPath, JSON.stringify({
    results,
    summary: {
      totalConflicts,
      totalDeadlocks,
      conclusion: totalDeadlocks > 0 ? "H-003 成立" : "H-003 部分成立",
    },
  }, null, 2));
  
  console.log(`\n结果已保存: ${reportPath}`);
}

if (require.main === module) {
  runExperiment();
}

export { AgentCoordinator, runScenario };
export type { Agent, Task, Message, Resource, ExperimentResult, EventLog };
