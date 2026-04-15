/**
 * 决策中心 - L1 灵枢层核心
 * 
 * 职责：
 * - 意图理解：解析用户意图，确定任务类型
 * - 决策推理：基于规则和上下文做出决策
 * - 优先级排序：多任务时的优先级判断
 * - 资源分配：分配执行资源
 */

// ============================================================
// 类型定义
// ============================================================

export type IntentType =
  | "information" // 信息查询
  | "action" // 执行操作
  | "creation" // 创建内容
  | "analysis" // 分析推理
  | "conversation" // 日常对话
  | "clarification" // 澄清确认
  | "multi_step"; // 多步骤任务

export type Priority = "urgent" | "high" | "normal" | "low";

export interface Intent {
  type: IntentType;
  confidence: number;
  subIntents: Intent[];
  entities: Record<string, string>;
  context: string[];
}

export interface Decision {
  action: string;
  priority: Priority;
  estimatedComplexity: "low" | "medium" | "high";
  requiredResources: string[];
  dependencies: string[];
  riskLevel: "safe" | "moderate" | "risky";
  reasoning: string;
}

export interface TaskQueue {
  tasks: Decision[];
  currentTask: Decision | null;
  completedTasks: Decision[];
  blockedTasks: Decision[];
}

// ============================================================
// 意图理解引擎
// ============================================================

export class IntentEngine {
  /**
   * 分析意图
   */
  analyzeIntent(message: string): Intent {
    const lower = message.toLowerCase();

    // 确定主意图
    const type = this.determineIntentType(lower);
    const confidence = this.calculateConfidence(message, type);

    // 提取实体
    const entities = this.extractEntities(message);

    // 构建上下文
    const context = this.buildContext(message, type);

    // 分析子意图
    const subIntents = this.analyzeSubIntents(message);

    return {
      type,
      confidence,
      subIntents,
      entities,
      context,
    };
  }

  /**
   * 确定意图类型
   */
  private determineIntentType(lower: string): IntentType {
    // 信息查询
    if (
      lower.includes("什么") ||
      lower.includes("如何") ||
      lower.includes("为什么") ||
      lower.includes("？") ||
      lower.includes("?")
    ) {
      return "information";
    }

    // 执行操作
    if (
      lower.includes("帮我") ||
      lower.includes("请") ||
      lower.includes("执行") ||
      lower.includes("运行") ||
      lower.includes("删除") ||
      lower.includes("创建")
    ) {
      return "action";
    }

    // 创建内容
    if (
      lower.includes("写") ||
      lower.includes("生成") ||
      lower.includes("制作") ||
      lower.includes("设计")
    ) {
      return "creation";
    }

    // 分析推理
    if (
      lower.includes("分析") ||
      lower.includes("评估") ||
      lower.includes("比较") ||
      lower.includes("判断")
    ) {
      return "analysis";
    }

    // 澄清确认
    if (
      lower.includes("确认") ||
      lower.includes("是否") ||
      lower.includes("对吗") ||
      lower.includes("清楚吗")
    ) {
      return "clarification";
    }

    // 多步骤任务
    if (
      lower.includes("然后") ||
      lower.includes("接着") ||
      lower.includes("之后") ||
      lower.includes("同时")
    ) {
      return "multi_step";
    }

    // 默认为对话
    return "conversation";
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(message: string, type: IntentType): number {
    // 基于消息长度和关键词密度计算
    const length = message.length;
    const keywordDensity = this.countKeywords(message, type) / Math.max(length / 10, 1);

    let confidence = 0.5 + keywordDensity * 0.3;

    // 长消息置信度更高
    if (length > 50) confidence += 0.1;
    if (length > 100) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * 计算关键词数量
   */
  private countKeywords(message: string, type: IntentType): number {
    const keywordMap: Record<IntentType, string[]> = {
      information: ["什么", "如何", "为什么", "怎么", "哪"],
      action: ["帮我", "请", "执行", "运行", "做"],
      creation: ["写", "生成", "制作", "创建", "设计"],
      analysis: ["分析", "评估", "比较", "判断", "研究"],
      conversation: ["你好", "谢谢", "再见", "好的"],
      clarification: ["确认", "是否", "对吗", "清楚"],
      multi_step: ["然后", "接着", "之后", "同时", "再"],
    };

    const keywords = keywordMap[type] || [];
    return keywords.filter((k) => message.includes(k)).length;
  }

  /**
   * 提取实体
   */
  private extractEntities(message: string): Record<string, string> {
    const entities: Record<string, string> = {};

    // 时间实体
    const timePatterns = ["今天", "明天", "昨天", "下周", "上周", "现在"];
    for (const p of timePatterns) {
      if (message.includes(p)) {
        entities["time"] = p;
        break;
      }
    }

    // 地点实体
    const locationMatch = message.match(/在(.{2,10})/);
    if (locationMatch) {
      entities["location"] = locationMatch[1];
    }

    // 数量实体
    const numberMatch = message.match(/(\d+)(个|次|条|篇)/);
    if (numberMatch) {
      entities["quantity"] = numberMatch[0];
    }

    return entities;
  }

  /**
   * 构建上下文
   */
  private buildContext(message: string, type: IntentType): string[] {
    const context: string[] = [];

    context.push(`意图类型: ${type}`);
    context.push(`消息长度: ${message.length}`);

    if (message.includes("紧急") || message.includes("尽快")) {
      context.push("紧急程度: 高");
    }

    return context;
  }

  /**
   * 分析子意图
   */
  private analyzeSubIntents(message: string): Intent[] {
    const subIntents: Intent[] = [];

    // 检查是否有多个意图
    const separators = ["并且", "同时", "还有", "另外"];
    for (const sep of separators) {
      if (message.includes(sep)) {
        const parts = message.split(sep);
        for (const part of parts.slice(1)) {
          if (part.trim()) {
            subIntents.push({
              type: this.determineIntentType(part.toLowerCase()),
              confidence: 0.7,
              subIntents: [],
              entities: this.extractEntities(part),
              context: [],
            });
          }
        }
        break;
      }
    }

    return subIntents;
  }
}

// ============================================================
// 决策推理引擎
// ============================================================

export class DecisionReasoningEngine {
  private intentEngine: IntentEngine;

  constructor() {
    this.intentEngine = new IntentEngine();
  }

  /**
   * 做出决策
   */
  makeDecision(message: string, context?: Record<string, unknown>): Decision {
    const intent = this.intentEngine.analyzeIntent(message);

    // 确定行动
    const action = this.determineAction(intent);

    // 确定优先级
    const priority = this.determinePriority(message, intent);

    // 评估复杂度
    const estimatedComplexity = this.estimateComplexity(intent, message);

    // 确定所需资源
    const requiredResources = this.determineResources(intent);

    // 确定依赖
    const dependencies = this.determineDependencies(intent);

    // 评估风险
    const riskLevel = this.assessRisk(message, intent);

    // 生成推理说明
    const reasoning = this.generateReasoning(intent, action, priority);

    return {
      action,
      priority,
      estimatedComplexity,
      requiredResources,
      dependencies,
      riskLevel,
      reasoning,
    };
  }

  /**
   * 确定行动
   */
  private determineAction(intent: Intent): string {
    const actionMap: Record<IntentType, string> = {
      information: "搜索并返回信息",
      action: "执行指定操作",
      creation: "生成内容",
      analysis: "分析并给出结论",
      conversation: "自然对话回复",
      clarification: "确认或澄清",
      multi_step: "按顺序执行多步骤",
    };

    return actionMap[intent.type] || "处理请求";
  }

  /**
   * 确定优先级
   */
  private determinePriority(message: string, intent: Intent): Priority {
    const lower = message.toLowerCase();

    if (lower.includes("紧急") || lower.includes("立即") || lower.includes("马上")) {
      return "urgent";
    }

    if (lower.includes("重要") || lower.includes("尽快") || intent.type === "action") {
      return "high";
    }

    if (intent.type === "conversation" || intent.type === "clarification") {
      return "low";
    }

    return "normal";
  }

  /**
   * 评估复杂度
   */
  private estimateComplexity(intent: Intent, message: string): "low" | "medium" | "high" {
    // 多步骤任务复杂度高
    if (intent.type === "multi_step") {
      return "high";
    }

    // 创建和分析任务复杂度中等
    if (intent.type === "creation" || intent.type === "analysis") {
      return message.length > 100 ? "high" : "medium";
    }

    // 长消息复杂度中等
    if (message.length > 200) {
      return "medium";
    }

    return "low";
  }

  /**
   * 确定所需资源
   */
  private determineResources(intent: Intent): string[] {
    const resourceMap: Record<IntentType, string[]> = {
      information: ["搜索"],
      action: ["执行器"],
      creation: ["生成器"],
      analysis: ["分析器"],
      conversation: [],
      clarification: [],
      multi_step: ["执行器", "调度器"],
    };

    return resourceMap[intent.type] || [];
  }

  /**
   * 确定依赖
   */
  private determineDependencies(intent: Intent): string[] {
    const dependencies: string[] = [];

    if (intent.subIntents.length > 0) {
      dependencies.push("子任务完成");
    }

    return dependencies;
  }

  /**
   * 评估风险
   */
  private assessRisk(message: string, intent: Intent): "safe" | "moderate" | "risky" {
    const lower = message.toLowerCase();

    // 高风险操作
    const riskyKeywords = ["删除", "格式化", "清空", "重置", "修改配置"];
    if (riskyKeywords.some((k) => lower.includes(k))) {
      return "risky";
    }

    // 中等风险
    const moderateKeywords = ["修改", "更新", "发送", "发布"];
    if (moderateKeywords.some((k) => lower.includes(k))) {
      return "moderate";
    }

    return "safe";
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(intent: Intent, action: string, priority: Priority): string {
    return `意图: ${intent.type} (置信度: ${(intent.confidence * 100).toFixed(0)}%), 行动: ${action}, 优先级: ${priority}`;
  }
}

// ============================================================
// 任务队列管理器
// ============================================================

export class TaskQueueManager {
  private queue: TaskQueue = {
    tasks: [],
    currentTask: null,
    completedTasks: [],
    blockedTasks: [],
  };

  /**
   * 添加任务
   */
  addTask(decision: Decision): void {
    this.queue.tasks.push(decision);
    this.sortQueue();
  }

  /**
   * 获取下一个任务
   */
  getNextTask(): Decision | null {
    if (this.queue.tasks.length === 0) {
      return null;
    }

    this.queue.currentTask = this.queue.tasks.shift()!;
    return this.queue.currentTask;
  }

  /**
   * 完成当前任务
   */
  completeCurrentTask(): void {
    if (this.queue.currentTask) {
      this.queue.completedTasks.push(this.queue.currentTask);
      this.queue.currentTask = null;
    }
  }

  /**
   * 阻塞当前任务
   */
  blockCurrentTask(reason: string): void {
    if (this.queue.currentTask) {
      this.queue.blockedTasks.push(this.queue.currentTask);
      this.queue.currentTask = null;
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): TaskQueue {
    return { ...this.queue };
  }

  /**
   * 排序队列
   */
  private sortQueue(): void {
    const priorityOrder: Record<Priority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    this.queue.tasks.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

// ============================================================
// 单例导出
// ============================================================

let intentEngineInstance: IntentEngine | null = null;
let decisionReasoningInstance: DecisionReasoningEngine | null = null;
let taskQueueManagerInstance: TaskQueueManager | null = null;

export function getIntentEngine(): IntentEngine {
  if (!intentEngineInstance) {
    intentEngineInstance = new IntentEngine();
  }
  return intentEngineInstance;
}

export function getDecisionReasoningEngine(): DecisionReasoningEngine {
  if (!decisionReasoningInstance) {
    decisionReasoningInstance = new DecisionReasoningEngine();
  }
  return decisionReasoningInstance;
}

export function getTaskQueueManager(): TaskQueueManager {
  if (!taskQueueManagerInstance) {
    taskQueueManagerInstance = new TaskQueueManager();
  }
  return taskQueueManagerInstance;
}
