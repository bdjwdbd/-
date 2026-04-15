/**
 * 工具编排引擎 - L3 灵躯层核心
 * 
 * 职责：
 * - 工具编排：多工具协同、依赖管理、并行执行
 * - 执行策略：重试、超时、降级
 * - 结果聚合：多工具结果合并、冲突解决
 * - 状态追踪：执行进度、资源占用
 */

import { ToolExecutor, ToolFramework, Tool, ToolCall } from "../../core/execution";

// ============================================================
// 类型定义
// ============================================================

export interface ToolStep {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  dependencies: string[]; // 依赖的前置步骤 ID
  timeout?: number;
  retries?: number;
  fallback?: string; // 降级工具
  condition?: (context: ExecutionContext) => boolean; // 执行条件
}

export interface ExecutionPlan {
  id: string;
  name: string;
  description: string;
  steps: ToolStep[];
  parallelGroups: string[][]; // 可并行执行的步骤组
  timeout?: number;
  onFail: "abort" | "continue" | "rollback";
}

export interface ExecutionContext {
  planId: string;
  inputs: Record<string, unknown>;
  results: Map<string, ToolCall>;
  variables: Map<string, unknown>;
  startTime: Date;
  currentStep?: string;
  status: "pending" | "running" | "completed" | "failed" | "aborted";
  error?: string;
}

export interface ExecutionResult {
  planId: string;
  status: "success" | "partial" | "failed";
  results: Map<string, ToolCall>;
  outputs: Record<string, unknown>;
  duration: number;
  errors: Array<{ stepId: string; error: string }>;
}

export interface ResourceUsage {
  toolCalls: number;
  parallelCalls: number;
  peakMemory: number;
  totalTime: number;
}

// ============================================================
// 工具编排引擎
// ============================================================

export class ToolOrchestrator {
  private toolFramework: ToolFramework;
  private executionHistory: Map<string, ExecutionResult> = new Map();
  private activeExecutions: Map<string, ExecutionContext> = new Map();
  private maxParallel: number = 5;
  private defaultTimeout: number = 30000; // 30 秒

  constructor(toolFramework?: ToolFramework) {
    this.toolFramework = toolFramework || new ToolFramework();
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.toolFramework.defineTool(
      tool.name,
      tool.description,
      tool.parameters,
      tool.execute
    );
  }

  /**
   * 创建执行计划
   */
  createPlan(
    name: string,
    description: string,
    steps: ToolStep[],
    options?: {
      timeout?: number;
      onFail?: "abort" | "continue" | "rollback";
    }
  ): ExecutionPlan {
    // 分析依赖关系，生成并行组
    const parallelGroups = this.analyzeDependencies(steps);

    return {
      id: `plan-${Date.now()}`,
      name,
      description,
      steps,
      parallelGroups,
      timeout: options?.timeout || this.defaultTimeout,
      onFail: options?.onFail || "abort",
    };
  }

  /**
   * 执行计划
   */
  async executePlan(
    plan: ExecutionPlan,
    inputs: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const context: ExecutionContext = {
      planId: plan.id,
      inputs,
      results: new Map(),
      variables: new Map(Object.entries(inputs)),
      startTime: new Date(),
      status: "running",
    };

    this.activeExecutions.set(plan.id, context);
    const errors: Array<{ stepId: string; error: string }> = [];

    try {
      // 按并行组执行
      for (const group of plan.parallelGroups) {
        if (context.status === "aborted") break;

        // 检查组内步骤是否满足条件
        const executableSteps = group.filter((stepId) => {
          const step = plan.steps.find((s) => s.id === stepId);
          if (!step) return false;
          if (step.condition && !step.condition(context)) return false;
          // 检查依赖是否完成
          return step.dependencies.every((depId) => {
            const result = context.results.get(depId);
            return result && !result.error;
          });
        });

        if (executableSteps.length === 0) continue;

        // 并行执行组内步骤
        const promises = executableSteps.map((stepId) =>
          this.executeStep(plan, stepId, context)
        );

        const results = await Promise.allSettled(promises);

        // 处理结果
        for (let i = 0; i < executableSteps.length; i++) {
          const stepId = executableSteps[i];
          const result = results[i];

          if (result.status === "rejected") {
            errors.push({ stepId, error: result.reason?.message || "执行失败" });

            if (plan.onFail === "abort") {
              context.status = "aborted";
              break;
            }
          }
        }
      }

      // 确定最终状态
      let status: "success" | "partial" | "failed" = "success";
      if (errors.length > 0) {
        status = context.status === "aborted" ? "failed" : "partial";
      }

      const executionResult: ExecutionResult = {
        planId: plan.id,
        status,
        results: context.results,
        outputs: Object.fromEntries(context.variables),
        duration: Date.now() - startTime,
        errors,
      };

      this.executionHistory.set(plan.id, executionResult);
      context.status = status === "success" ? "completed" : "failed";

      return executionResult;
    } finally {
      this.activeExecutions.delete(plan.id);
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    plan: ExecutionPlan,
    stepId: string,
    context: ExecutionContext
  ): Promise<ToolCall> {
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`步骤不存在: ${stepId}`);
    }

    context.currentStep = stepId;

    // 解析参数中的变量引用
    const resolvedArgs = this.resolveArgs(step.args, context);

    // 执行工具
    let result: ToolCall | undefined;
    const retries = step.retries || 0;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const callResult = await this.toolFramework.call(step.toolName, resolvedArgs);
        result = { name: step.toolName, args: resolvedArgs, result: callResult };
        context.results.set(stepId, result);
        return result;
      } catch (error: any) {
        lastError = error.message;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    // 重试失败，尝试降级
    if (step.fallback) {
      try {
        const callResult = await this.toolFramework.call(step.fallback, resolvedArgs);
        result = { name: step.fallback, args: resolvedArgs, result: callResult };
        context.results.set(stepId, result);
        return result;
      } catch (error: any) {
        lastError = error.message;
      }
    }

    // 完全失败
    const failedCall: ToolCall = {
      name: step.toolName,
      args: resolvedArgs,
      error: lastError,
    };
    context.results.set(stepId, failedCall);
    throw new Error(lastError || "执行失败");
  }

  /**
   * 解析参数中的变量引用
   */
  private resolveArgs(
    args: Record<string, unknown>,
    context: ExecutionContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === "string" && value.startsWith("$")) {
        // 变量引用
        const varName = value.substring(1);
        const varValue = context.variables.get(varName);
        resolved[key] = varValue !== undefined ? varValue : value;
      } else if (typeof value === "string" && value.startsWith("${")) {
        // 表达式引用 ${step1.result.data}
        const expr = value.substring(2, value.length - 1);
        resolved[key] = this.evaluateExpression(expr, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * 计算表达式
   */
  private evaluateExpression(
    expr: string,
    context: ExecutionContext
  ): unknown {
    const parts = expr.split(".");
    let value: unknown;

    // 第一部分是步骤 ID 或变量名
    const first = parts[0];
    if (context.results.has(first)) {
      const result = context.results.get(first);
      value = result?.result;
    } else if (context.variables.has(first)) {
      value = context.variables.get(first);
    } else {
      return undefined;
    }

    // 后续部分是属性访问
    for (let i = 1; i < parts.length && value !== undefined; i++) {
      if (typeof value === "object" && value !== null) {
        value = (value as Record<string, unknown>)[parts[i]];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 分析依赖关系，生成并行组
   */
  private analyzeDependencies(steps: ToolStep[]): string[][] {
    const groups: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(steps.map((s) => s.id));

    while (remaining.size > 0) {
      const ready: string[] = [];

      for (const stepId of remaining) {
        const step = steps.find((s) => s.id === stepId);
        if (!step) continue;

        // 检查依赖是否都已完成
        if (step.dependencies.every((dep) => completed.has(dep))) {
          ready.push(stepId);
        }
      }

      if (ready.length === 0) {
        // 循环依赖，强制添加剩余步骤
        ready.push(...remaining);
      }

      groups.push(ready);
      ready.forEach((id) => {
        completed.add(id);
        remaining.delete(id);
      });
    }

    return groups;
  }

  /**
   * 获取执行历史
   */
  getHistory(limit: number = 20): ExecutionResult[] {
    return Array.from(this.executionHistory.values())
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * 获取活跃执行
   */
  getActiveExecutions(): ExecutionContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * 取消执行
   */
  cancel(planId: string): boolean {
    const context = this.activeExecutions.get(planId);
    if (context) {
      context.status = "aborted";
      return true;
    }
    return false;
  }

  /**
   * 获取工具框架
   */
  getToolFramework(): ToolFramework {
    return this.toolFramework;
  }

  /**
   * 获取资源使用情况
   */
  getResourceUsage(): ResourceUsage {
    const history = Array.from(this.executionHistory.values());
    return {
      toolCalls: history.reduce((sum, r) => sum + r.results.size, 0),
      parallelCalls: this.maxParallel,
      peakMemory: process.memoryUsage().heapUsed,
      totalTime: history.reduce((sum, r) => sum + r.duration, 0),
    };
  }
}

// ============================================================
// 预定义执行计划模板
// ============================================================

export const PLAN_TEMPLATES: Record<string, Partial<ExecutionPlan>> = {
  // 搜索并总结
  searchAndSummarize: {
    name: "搜索并总结",
    description: "搜索信息并生成总结",
    steps: [
      { id: "search", toolName: "search", args: { query: "$query" }, dependencies: [] },
      { id: "summarize", toolName: "summarize", args: { content: "${search.result}" }, dependencies: ["search"] },
    ],
    onFail: "abort",
  },

  // 分析并报告
  analyzeAndReport: {
    name: "分析并报告",
    description: "分析数据并生成报告",
    steps: [
      { id: "fetch", toolName: "fetch", args: { url: "$url" }, dependencies: [] },
      { id: "parse", toolName: "parse", args: { data: "${fetch.result}" }, dependencies: ["fetch"] },
      { id: "analyze", toolName: "analyze", args: { parsed: "${parse.result}" }, dependencies: ["parse"] },
      { id: "report", toolName: "report", args: { analysis: "${analyze.result}" }, dependencies: ["analyze"] },
    ],
    onFail: "abort",
  },

  // 并行搜索
  parallelSearch: {
    name: "并行搜索",
    description: "多个搜索源并行查询",
    steps: [
      { id: "search1", toolName: "search", args: { source: "web", query: "$query" }, dependencies: [] },
      { id: "search2", toolName: "search", args: { source: "news", query: "$query" }, dependencies: [] },
      { id: "search3", toolName: "search", args: { source: "academic", query: "$query" }, dependencies: [] },
      { id: "merge", toolName: "merge", args: { results: ["${search1.result}", "${search2.result}", "${search3.result}"] }, dependencies: ["search1", "search2", "search3"] },
    ],
    onFail: "continue",
  },
};

// ============================================================
// 单例导出
// ============================================================

let orchestratorInstance: ToolOrchestrator | null = null;

export function getToolOrchestrator(): ToolOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ToolOrchestrator();
  }
  return orchestratorInstance;
}

export { ToolExecutor, ToolFramework, Tool, ToolCall };
