/**
 * 执行流转引擎 - L2 灵脉层核心
 * 
 * 职责：
 * - 流程控制：顺序、并行、条件分支、循环
 * - 状态管理：执行状态追踪、断点续传
 * - 异常处理：错误捕获、重试、回滚
 * - 性能优化：批处理、缓存、预加载
 */

// ============================================================
// 类型定义
// ============================================================

export type FlowStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type FlowNodeType = "start" | "end" | "action" | "condition" | "parallel" | "loop" | "subflow";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  name: string;
  config: Record<string, unknown>;
  nextNodes: string[];
  errorHandler?: string;
  retryCount?: number;
  timeout?: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string;
  label?: string;
}

export interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: Record<string, unknown>;
  timeout?: number;
}

export interface FlowExecution {
  executionId: string;
  flowId: string;
  status: FlowStatus;
  currentNode: string | null;
  completedNodes: string[];
  failedNodes: string[];
  variables: Record<string, unknown>;
  startTime: Date;
  endTime?: Date;
  error?: string;
  logs: FlowLog[];
}

export interface FlowLog {
  timestamp: Date;
  nodeId: string;
  action: string;
  result?: unknown;
  error?: string;
  duration?: number;
}

// ============================================================
// 执行流转引擎
// ============================================================

export class FlowEngine {
  private definitions: Map<string, FlowDefinition> = new Map();
  private executions: Map<string, FlowExecution> = new Map();
  private activeExecutions: Set<string> = new Set();
  private maxConcurrent: number = 10;

  /**
   * 注册流程定义
   */
  registerFlow(definition: FlowDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  /**
   * 启动流程
   */
  async startFlow(flowId: string, variables: Record<string, unknown> = {}): Promise<FlowExecution> {
    const definition = this.definitions.get(flowId);
    if (!definition) {
      throw new Error(`流程定义不存在: ${flowId}`);
    }

    // 等待执行槽
    while (this.activeExecutions.size >= this.maxConcurrent) {
      await new Promise((r) => setTimeout(r, 100));
    }

    const execution: FlowExecution = {
      executionId: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      flowId,
      status: "running",
      currentNode: this.findStartNode(definition),
      completedNodes: [],
      failedNodes: [],
      variables: { ...definition.variables, ...variables },
      startTime: new Date(),
      logs: [],
    };

    this.executions.set(execution.executionId, execution);
    this.activeExecutions.add(execution.executionId);

    // 异步执行
    this.executeFlow(execution, definition).catch((error) => {
      execution.status = "failed";
      execution.error = error.message;
      execution.endTime = new Date();
      this.activeExecutions.delete(execution.executionId);
    });

    return execution;
  }

  /**
   * 执行流程
   */
  private async executeFlow(execution: FlowExecution, definition: FlowDefinition): Promise<void> {
    const timeout = definition.timeout || 300000; // 默认 5 分钟
    const startTime = Date.now();

    while (execution.currentNode && execution.status === "running") {
      // 检查超时
      if (Date.now() - startTime > timeout) {
        execution.status = "failed";
        execution.error = "执行超时";
        break;
      }

      const node = definition.nodes.find((n) => n.id === execution.currentNode);
      if (!node) {
        execution.status = "failed";
        execution.error = `节点不存在: ${execution.currentNode}`;
        break;
      }

      try {
        await this.executeNode(execution, node, definition);
        execution.completedNodes.push(node.id);

        // 获取下一个节点
        const nextNode = this.getNextNode(execution, node, definition);
        if (nextNode) {
          execution.currentNode = nextNode;
        } else {
          execution.status = "completed";
          execution.endTime = new Date();
        }
      } catch (error: any) {
        execution.failedNodes.push(node.id);
        execution.logs.push({
          timestamp: new Date(),
          nodeId: node.id,
          action: "error",
          error: error.message,
        });

        // 错误处理
        if (node.errorHandler) {
          execution.currentNode = node.errorHandler;
        } else {
          execution.status = "failed";
          execution.error = error.message;
          execution.endTime = new Date();
        }
      }
    }

    this.activeExecutions.delete(execution.executionId);
  }

  /**
   * 执行节点
   */
  private async executeNode(
    execution: FlowExecution,
    node: FlowNode,
    definition: FlowDefinition
  ): Promise<void> {
    const startTime = Date.now();

    switch (node.type) {
      case "start":
        // 开始节点，无需操作
        break;

      case "end":
        // 结束节点，标记完成
        execution.status = "completed";
        break;

      case "action":
        // 执行动作
        await this.executeAction(execution, node);
        break;

      case "condition":
        // 条件节点，在 getNextNode 中处理
        break;

      case "parallel":
        // 并行节点
        await this.executeParallel(execution, node, definition);
        break;

      case "loop":
        // 循环节点
        await this.executeLoop(execution, node, definition);
        break;

      case "subflow":
        // 子流程节点
        await this.executeSubflow(execution, node);
        break;
    }

    execution.logs.push({
      timestamp: new Date(),
      nodeId: node.id,
      action: node.type,
      duration: Date.now() - startTime,
    });
  }

  /**
   * 执行动作
   */
  private async executeAction(execution: FlowExecution, node: FlowNode): Promise<void> {
    const { action, params } = node.config as { action?: string; params?: Record<string, unknown> };

    if (!action) {
      throw new Error("动作节点缺少 action 配置");
    }

    // 解析参数中的变量引用
    const resolvedParams = this.resolveVariables(params || {}, execution.variables);

    // 模拟执行动作
    await new Promise((r) => setTimeout(r, 100));

    // 将结果存入变量
    if (node.config.outputVar) {
      execution.variables[node.config.outputVar as string] = { success: true, params: resolvedParams };
    }
  }

  /**
   * 执行并行节点
   */
  private async executeParallel(
    execution: FlowExecution,
    node: FlowNode,
    definition: FlowDefinition
  ): Promise<void> {
    const branches = node.config.branches as string[] || [];
    const promises = branches.map((branchId) => {
      const branchNode = definition.nodes.find((n) => n.id === branchId);
      if (branchNode) {
        return this.executeNode(execution, branchNode, definition);
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  /**
   * 执行循环节点
   */
  private async executeLoop(
    execution: FlowExecution,
    node: FlowNode,
    definition: FlowDefinition
  ): Promise<void> {
    const { items, bodyNode } = node.config as { items?: unknown[]; bodyNode?: string };

    if (!items || !bodyNode) {
      return;
    }

    const body = definition.nodes.find((n) => n.id === bodyNode);
    if (!body) {
      return;
    }

    for (const item of items) {
      execution.variables["loopItem"] = item;
      await this.executeNode(execution, body, definition);
    }
  }

  /**
   * 执行子流程
   */
  private async executeSubflow(execution: FlowExecution, node: FlowNode): Promise<void> {
    const subflowId = node.config.subflowId as string;
    if (!subflowId || !this.definitions.has(subflowId)) {
      return;
    }

    // 简化处理：直接执行子流程
    const subflow = this.definitions.get(subflowId)!;
    const subExecution = await this.startFlow(subflowId, execution.variables);

    // 等待子流程完成
    while (subExecution.status === "running") {
      await new Promise((r) => setTimeout(r, 100));
    }

    // 合并变量
    Object.assign(execution.variables, subExecution.variables);
  }

  /**
   * 获取下一个节点
   */
  private getNextNode(
    execution: FlowExecution,
    node: FlowNode,
    definition: FlowDefinition
  ): string | null {
    if (node.type === "condition") {
      // 条件分支
      const condition = node.config.condition as string;
      const result = this.evaluateCondition(condition, execution.variables);

      // 找到满足条件的边
      const edge = definition.edges.find(
        (e) => e.from === node.id && (e.condition ? this.evaluateCondition(e.condition, execution.variables) === result : true)
      );

      return edge?.to || null;
    }

    // 默认取第一条边
    const edge = definition.edges.find((e) => e.from === node.id);
    return edge?.to || null;
  }

  /**
   * 解析变量引用
   */
  private resolveVariables(params: Record<string, unknown>, variables: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.startsWith("$")) {
        const varName = value.substring(1);
        resolved[key] = variables[varName] !== undefined ? variables[varName] : value;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * 计算条件
   */
  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    try {
      // 简单的条件计算
      const parts = condition.split(/\s*(==|!=|>|<|>=|<=)\s*/);
      if (parts.length === 3) {
        const left = variables[parts[0]] || parts[0];
        const right = variables[parts[2]] || parts[2];
        const op = parts[1];

        switch (op) {
          case "==": return left == right;
          case "!=": return left != right;
          case ">": return Number(left) > Number(right);
          case "<": return Number(left) < Number(right);
          case ">=": return Number(left) >= Number(right);
          case "<=": return Number(left) <= Number(right);
        }
      }
      return Boolean(variables[condition]);
    } catch {
      return false;
    }
  }

  /**
   * 查找开始节点
   */
  private findStartNode(definition: FlowDefinition): string {
    const startNode = definition.nodes.find((n) => n.type === "start");
    return startNode?.id || definition.nodes[0]?.id || "";
  }

  /**
   * 暂停流程
   */
  pauseFlow(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === "running") {
      execution.status = "paused";
      return true;
    }
    return false;
  }

  /**
   * 恢复流程
   */
  async resumeFlow(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== "paused") {
      return false;
    }

    const definition = this.definitions.get(execution.flowId);
    if (!definition) {
      return false;
    }

    execution.status = "running";
    this.activeExecutions.add(executionId);

    this.executeFlow(execution, definition).catch((error) => {
      execution.status = "failed";
      execution.error = error.message;
      execution.endTime = new Date();
      this.activeExecutions.delete(executionId);
    });

    return true;
  }

  /**
   * 取消流程
   */
  cancelFlow(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (execution && (execution.status === "running" || execution.status === "paused")) {
      execution.status = "cancelled";
      execution.endTime = new Date();
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * 获取执行状态
   */
  getExecution(executionId: string): FlowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * 获取活跃执行
   */
  getActiveExecutions(): FlowExecution[] {
    return Array.from(this.activeExecutions)
      .map((id) => this.executions.get(id))
      .filter((e): e is FlowExecution => e !== undefined);
  }

  /**
   * 获取流程定义
   */
  getFlowDefinition(flowId: string): FlowDefinition | undefined {
    return this.definitions.get(flowId);
  }

  /**
   * 获取所有流程定义
   */
  getAllFlowDefinitions(): FlowDefinition[] {
    return Array.from(this.definitions.values());
  }
}

// ============================================================
// 预定义流程模板
// ============================================================

export const FLOW_TEMPLATES: Record<string, Partial<FlowDefinition>> = {
  // 顺序执行
  sequential: {
    name: "顺序执行",
    description: "按顺序执行一系列动作",
    nodes: [
      { id: "start", type: "start", name: "开始", config: {}, nextNodes: ["step1"] },
      { id: "step1", type: "action", name: "步骤1", config: { action: "step1" }, nextNodes: ["step2"] },
      { id: "step2", type: "action", name: "步骤2", config: { action: "step2" }, nextNodes: ["end"] },
      { id: "end", type: "end", name: "结束", config: {}, nextNodes: [] },
    ],
    edges: [
      { id: "e1", from: "start", to: "step1" },
      { id: "e2", from: "step1", to: "step2" },
      { id: "e3", from: "step2", to: "end" },
    ],
    variables: {},
  },

  // 条件分支
  conditional: {
    name: "条件分支",
    description: "根据条件选择执行路径",
    nodes: [
      { id: "start", type: "start", name: "开始", config: {}, nextNodes: ["condition"] },
      { id: "condition", type: "condition", name: "条件判断", config: { condition: "flag" }, nextNodes: ["branchA", "branchB"] },
      { id: "branchA", type: "action", name: "分支A", config: { action: "branchA" }, nextNodes: ["end"] },
      { id: "branchB", type: "action", name: "分支B", config: { action: "branchB" }, nextNodes: ["end"] },
      { id: "end", type: "end", name: "结束", config: {}, nextNodes: [] },
    ],
    edges: [
      { id: "e1", from: "start", to: "condition" },
      { id: "e2", from: "condition", to: "branchA", condition: "true" },
      { id: "e3", from: "condition", to: "branchB", condition: "false" },
      { id: "e4", from: "branchA", to: "end" },
      { id: "e5", from: "branchB", to: "end" },
    ],
    variables: { flag: true },
  },

  // 并行执行
  parallel: {
    name: "并行执行",
    description: "并行执行多个任务",
    nodes: [
      { id: "start", type: "start", name: "开始", config: {}, nextNodes: ["parallel"] },
      { id: "parallel", type: "parallel", name: "并行", config: { branches: ["task1", "task2", "task3"] }, nextNodes: ["end"] },
      { id: "task1", type: "action", name: "任务1", config: { action: "task1" }, nextNodes: [] },
      { id: "task2", type: "action", name: "任务2", config: { action: "task2" }, nextNodes: [] },
      { id: "task3", type: "action", name: "任务3", config: { action: "task3" }, nextNodes: [] },
      { id: "end", type: "end", name: "结束", config: {}, nextNodes: [] },
    ],
    edges: [
      { id: "e1", from: "start", to: "parallel" },
      { id: "e2", from: "parallel", to: "end" },
    ],
    variables: {},
  },
};

// ============================================================
// 单例导出
// ============================================================

let flowEngineInstance: FlowEngine | null = null;

export function getFlowEngine(): FlowEngine {
  if (!flowEngineInstance) {
    flowEngineInstance = new FlowEngine();

    // 注册预定义流程
    for (const [id, template] of Object.entries(FLOW_TEMPLATES)) {
      flowEngineInstance.registerFlow({
        id,
        name: template.name || id,
        description: template.description || "",
        nodes: template.nodes || [],
        edges: template.edges || [],
        variables: template.variables || {},
      });
    }
  }
  return flowEngineInstance;
}
