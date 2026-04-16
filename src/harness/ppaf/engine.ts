/**
 * Harness Engineering - PPAF 闭环引擎
 * 
 * 实现 Perception → Planning → Action → Feedback 闭环
 * 
 * @module harness/ppaf/engine
 */

import * as crypto from 'crypto';
import {
  PPAFConfig,
  DEFAULT_PPAF_CONFIG,
  PPAFContext,
  PerceptionInput,
  PerceptionResult,
  PerceptionType,
  PlanningResult,
  PlanningLevel,
  PlanningStep,
  ActionDefinition,
  ActionResult,
  ActionStatus,
  ActionType,
  FeedbackData,
  FeedbackResult,
  FeedbackType,
  FeedbackSource,
} from './types';

// ============ 感知器 ============

/**
 * 感知器
 * 
 * 负责环境感知、状态感知、异常感知
 */
export class Perceptor {
  private config: PPAFConfig;

  constructor(config: PPAFConfig) {
    this.config = config;
  }

  /**
   * 执行感知
   */
  async perceive(inputs: PerceptionInput[]): Promise<PerceptionResult> {
    const startTime = Date.now();
    const perceptionId = `perception_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 处理各类感知输入
    const processedData: Record<string, unknown> = {};
    const features: Record<string, unknown> = {};
    const anomalies: string[] = [];
    let totalConfidence = 0;

    for (const input of inputs) {
      switch (input.type) {
        case PerceptionType.TEXT:
          const textResult = await this.perceiveText(input.data as string);
          processedData.text = textResult.data;
          features.textFeatures = textResult.features;
          totalConfidence += textResult.confidence;
          break;

        case PerceptionType.CONTEXT:
          const contextResult = await this.perceiveContext(input.data as Record<string, unknown>);
          processedData.context = contextResult.data;
          features.contextFeatures = contextResult.features;
          if (contextResult.anomalies) {
            anomalies.push(...contextResult.anomalies);
          }
          totalConfidence += contextResult.confidence;
          break;

        case PerceptionType.SYSTEM:
          const systemResult = await this.perceiveSystem();
          processedData.system = systemResult.data;
          features.systemFeatures = systemResult.features;
          if (systemResult.anomalies) {
            anomalies.push(...systemResult.anomalies);
          }
          totalConfidence += systemResult.confidence;
          break;

        case PerceptionType.USER:
          const userResult = await this.perceiveUser(input.data as Record<string, unknown>);
          processedData.user = userResult.data;
          features.userFeatures = userResult.features;
          totalConfidence += userResult.confidence;
          break;
      }
    }

    const avgConfidence = inputs.length > 0 ? totalConfidence / inputs.length : 0;

    return {
      perceptionId,
      processed: processedData,
      features,
      confidence: avgConfidence,
      anomalies,
      latency: Date.now() - startTime,
    };
  }

  /**
   * 感知文本
   */
  private async perceiveText(text: string): Promise<{
    data: unknown;
    features: Record<string, unknown>;
    confidence: number;
  }> {
    // 提取文本特征
    const features = {
      length: text.length,
      wordCount: text.split(/\s+/).length,
      hasQuestion: text.includes('?') || text.includes('？'),
      hasCommand: /^(请|帮我|执行|运行)/.test(text),
      language: this.detectLanguage(text),
    };

    return {
      data: text,
      features,
      confidence: 0.9,
    };
  }

  /**
   * 感知上下文
   */
  private async perceiveContext(context: Record<string, unknown>): Promise<{
    data: unknown;
    features: Record<string, unknown>;
    confidence: number;
    anomalies?: string[];
  }> {
    const anomalies: string[] = [];
    
    // 检查上下文完整性
    if (!context.sessionId) {
      anomalies.push('缺少会话 ID');
    }
    
    if (!context.messages || (context.messages as any[]).length === 0) {
      anomalies.push('消息历史为空');
    }

    // 检查 Token 使用
    if (context.tokens && (context.tokens as number) > 100000) {
      anomalies.push('Token 使用量过高');
    }

    return {
      data: context,
      features: {
        hasSession: !!context.sessionId,
        messageCount: (context.messages as any[])?.length || 0,
        tokenUsage: context.tokens || 0,
      },
      confidence: anomalies.length === 0 ? 0.95 : 0.7,
      anomalies,
    };
  }

  /**
   * 感知系统状态
   */
  private async perceiveSystem(): Promise<{
    data: unknown;
    features: Record<string, unknown>;
    confidence: number;
    anomalies?: string[];
  }> {
    const anomalies: string[] = [];
    
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // 检查资源使用
    if (memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
      anomalies.push('内存使用过高');
    }

    return {
      data: {
        memory: memoryUsage,
        cpu: cpuUsage,
        uptime: process.uptime(),
      },
      features: {
        memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        uptimeSeconds: Math.round(process.uptime()),
      },
      confidence: anomalies.length === 0 ? 0.95 : 0.8,
      anomalies,
    };
  }

  /**
   * 感知用户状态
   */
  private async perceiveUser(user: Record<string, unknown>): Promise<{
    data: unknown;
    features: Record<string, unknown>;
    confidence: number;
  }> {
    return {
      data: user,
      features: {
        hasPreferences: !!user.preferences,
        hasHistory: !!user.history,
      },
      confidence: 0.9,
    };
  }

  /**
   * 检测语言
   */
  private detectLanguage(text: string): string {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = text.length;
    
    if (chineseChars / totalChars > 0.3) {
      return 'zh';
    }
    return 'en';
  }
}

// ============ 规划器 ============

/**
 * 规划器
 * 
 * 负责分层规划：战略 → 战术 → 执行
 */
export class Planner {
  private config: PPAFConfig;

  constructor(config: PPAFConfig) {
    this.config = config;
  }

  /**
   * 执行规划
   */
  async plan(
    perception: PerceptionResult,
    level: PlanningLevel = PlanningLevel.OPERATIONAL
  ): Promise<PlanningResult> {
    const planId = `plan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();

    // 根据感知结果生成规划
    const steps = await this.generateSteps(perception, level);
    const executionOrder = this.determineExecutionOrder(steps);
    const parallelGroups = this.identifyParallelGroups(steps, executionOrder);
    const risks = this.assessRisks(steps);
    const alternatives = this.generateAlternatives(perception);

    return {
      planId,
      level,
      steps,
      executionOrder,
      parallelGroups,
      totalEstimatedDuration: steps.reduce((sum, s) => sum + s.estimatedDuration, 0),
      risks,
      alternatives,
    };
  }

  /**
   * 生成规划步骤
   */
  private async generateSteps(
    perception: PerceptionResult,
    level: PlanningLevel
  ): Promise<PlanningStep[]> {
    const steps: PlanningStep[] = [];
    const processed = perception.processed as Record<string, unknown>;

    // 根据层级生成不同粒度的步骤
    switch (level) {
      case PlanningLevel.STRATEGIC:
        steps.push({
          stepId: 'strategic_1',
          name: '分析目标',
          description: '理解用户意图，确定长期目标',
          dependencies: [],
          expectedOutput: '目标定义',
          estimatedDuration: 5000,
          priority: 1,
          parallelizable: false,
        });
        break;

      case PlanningLevel.TACTICAL:
        steps.push(
          {
            stepId: 'tactical_1',
            name: '分解任务',
            description: '将目标分解为可执行的子任务',
            dependencies: [],
            expectedOutput: '任务列表',
            estimatedDuration: 3000,
            priority: 1,
            parallelizable: false,
          },
          {
            stepId: 'tactical_2',
            name: '分配资源',
            description: '为每个子任务分配所需资源',
            dependencies: ['tactical_1'],
            expectedOutput: '资源分配方案',
            estimatedDuration: 2000,
            priority: 2,
            parallelizable: false,
          }
        );
        break;

      case PlanningLevel.OPERATIONAL:
        // 根据感知结果生成具体操作步骤
        const textFeatures = perception.features.textFeatures as Record<string, unknown>;
        
        if (textFeatures?.hasQuestion) {
          steps.push({
            stepId: 'op_1',
            name: '搜索信息',
            description: '搜索相关信息以回答问题',
            dependencies: [],
            expectedOutput: '搜索结果',
            estimatedDuration: 2000,
            priority: 1,
            parallelizable: true,
          });
        }

        if (textFeatures?.hasCommand) {
          steps.push({
            stepId: 'op_2',
            name: '执行命令',
            description: '执行用户请求的操作',
            dependencies: [],
            expectedOutput: '执行结果',
            estimatedDuration: 5000,
            priority: 1,
            parallelizable: false,
          });
        }

        // 默认步骤
        if (steps.length === 0) {
          steps.push({
            stepId: 'op_default',
            name: '生成回复',
            description: '根据输入生成回复',
            dependencies: [],
            expectedOutput: '回复内容',
            estimatedDuration: 3000,
            priority: 1,
            parallelizable: false,
          });
        }
        break;
    }

    return steps;
  }

  /**
   * 确定执行顺序
   */
  private determineExecutionOrder(steps: PlanningStep[]): string[] {
    // 拓扑排序
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: PlanningStep) => {
      if (visited.has(step.stepId)) return;
      if (visiting.has(step.stepId)) {
        throw new Error(`检测到循环依赖: ${step.stepId}`);
      }

      visiting.add(step.stepId);

      for (const depId of step.dependencies) {
        const dep = steps.find(s => s.stepId === depId);
        if (dep) visit(dep);
      }

      visiting.delete(step.stepId);
      visited.add(step.stepId);
      order.push(step.stepId);
    };

    for (const step of steps) {
      visit(step);
    }

    return order;
  }

  /**
   * 识别并行组
   */
  private identifyParallelGroups(
    steps: PlanningStep[],
    executionOrder: string[]
  ): string[][] {
    const groups: string[][] = [];
    const assigned = new Set<string>();

    for (const stepId of executionOrder) {
      if (assigned.has(stepId)) continue;

      const step = steps.find(s => s.stepId === stepId);
      if (!step) continue;

      if (step.parallelizable) {
        // 找到所有可以并行的步骤
        const group = [stepId];
        assigned.add(stepId);

        for (const otherId of executionOrder) {
          if (assigned.has(otherId)) continue;

          const other = steps.find(s => s.stepId === otherId);
          if (other?.parallelizable && this.canParallelize(step, other)) {
            group.push(otherId);
            assigned.add(otherId);
          }
        }

        groups.push(group);
      } else {
        groups.push([stepId]);
        assigned.add(stepId);
      }
    }

    return groups;
  }

  /**
   * 检查是否可以并行
   */
  private canParallelize(step1: PlanningStep, step2: PlanningStep): boolean {
    // 检查依赖关系
    if (step1.dependencies.includes(step2.stepId)) return false;
    if (step2.dependencies.includes(step1.stepId)) return false;
    return true;
  }

  /**
   * 评估风险
   */
  private assessRisks(steps: PlanningStep[]): Array<{
    description: string;
    probability: number;
    impact: number;
    mitigation: string;
  }> {
    const risks: Array<{
      description: string;
      probability: number;
      impact: number;
      mitigation: string;
    }> = [];

    // 检查长耗时步骤
    const longSteps = steps.filter(s => s.estimatedDuration > 10000);
    if (longSteps.length > 0) {
      risks.push({
        description: '存在长耗时步骤，可能导致超时',
        probability: 0.3,
        impact: 0.7,
        mitigation: '设置合理的超时时间，准备降级方案',
      });
    }

    // 检查依赖复杂度
    const complexDeps = steps.filter(s => s.dependencies.length > 2);
    if (complexDeps.length > 0) {
      risks.push({
        description: '存在复杂依赖，可能影响执行效率',
        probability: 0.2,
        impact: 0.5,
        mitigation: '优化依赖关系，考虑并行执行',
      });
    }

    return risks;
  }

  /**
   * 生成备选方案
   */
  private generateAlternatives(perception: PerceptionResult): Array<{
    description: string;
    conditions: string[];
  }> {
    const alternatives: Array<{
      description: string;
      conditions: string[];
    }> = [];

    // 根据感知结果生成备选方案
    if (perception.confidence < 0.7) {
      alternatives.push({
        description: '请求用户澄清',
        conditions: ['置信度过低', '无法确定用户意图'],
      });
    }

    if (perception.anomalies.length > 0) {
      alternatives.push({
        description: '使用简化流程',
        conditions: ['检测到异常', '系统资源受限'],
      });
    }

    return alternatives;
  }
}

// ============ 执行器 ============

/**
 * 执行器
 * 
 * 负责执行动作，支持重试和降级
 */
export class Executor {
  private config: PPAFConfig;

  constructor(config: PPAFConfig) {
    this.config = config;
  }

  /**
   * 执行动作
   */
  async execute(
    action: ActionDefinition,
    executor?: (action: ActionDefinition) => Promise<unknown>
  ): Promise<ActionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;
    let usedFallback = false;

    // 检查前置条件
    const preconditionsMet = await this.checkPreconditions(action);
    if (!preconditionsMet) {
      return {
        actionId: action.actionId,
        status: ActionStatus.CANCELLED,
        error: '前置条件不满足',
        duration: Date.now() - startTime,
        retryCount: 0,
        usedFallback: false,
        resourceUsage: { cpu: 0, memory: 0, network: 0 },
      };
    }

    // 执行动作（带重试）
    while (retryCount <= action.maxRetries) {
      try {
        const output = executor
          ? await executor(action)
          : await this.defaultExecutor(action);

        // 检查后置条件
        const postconditionsMet = await this.checkPostconditions(action, output);
        if (!postconditionsMet) {
          throw new Error('后置条件不满足');
        }

        return {
          actionId: action.actionId,
          status: ActionStatus.COMPLETED,
          output,
          duration: Date.now() - startTime,
          retryCount,
          usedFallback,
          resourceUsage: this.getResourceUsage(),
        };
      } catch (error) {
        lastError = (error as Error).message;
        retryCount++;

        if (retryCount <= action.maxRetries) {
          // 等待后重试
          await this.sleep(1000 * retryCount);
        }
      }
    }

    // 所有重试失败，尝试降级
    if (action.fallback) {
      try {
        const fallbackOutput = await this.executeFallback(action);
        usedFallback = true;

        return {
          actionId: action.actionId,
          status: ActionStatus.COMPLETED,
          output: fallbackOutput,
          error: `使用降级方案: ${lastError}`,
          duration: Date.now() - startTime,
          retryCount,
          usedFallback,
          resourceUsage: this.getResourceUsage(),
        };
      } catch (fallbackError) {
        // 降级也失败
      }
    }

    return {
      actionId: action.actionId,
      status: ActionStatus.FAILED,
      error: lastError,
      duration: Date.now() - startTime,
      retryCount,
      usedFallback,
      resourceUsage: this.getResourceUsage(),
    };
  }

  /**
   * 默认执行器
   */
  private async defaultExecutor(action: ActionDefinition): Promise<unknown> {
    switch (action.type) {
      case ActionType.STATE_UPDATE:
        return { updated: true, input: action.input };
      
      case ActionType.MESSAGE_SEND:
        return { sent: true, message: action.input };
      
      default:
        return { executed: true, action: action.name };
    }
  }

  /**
   * 检查前置条件
   */
  private async checkPreconditions(action: ActionDefinition): Promise<boolean> {
    for (const precondition of action.preconditions) {
      if (precondition.required) {
        // 简化：假设所有必需的前置条件都满足
        // 实际应该检查具体条件
      }
    }
    return true;
  }

  /**
   * 检查后置条件
   */
  private async checkPostconditions(
    action: ActionDefinition,
    output: unknown
  ): Promise<boolean> {
    for (const postcondition of action.postconditions) {
      // 简化：假设所有后置条件都满足
      // 实际应该检查具体条件
    }
    return true;
  }

  /**
   * 执行降级方案
   */
  private async executeFallback(action: ActionDefinition): Promise<unknown> {
    if (!action.fallback) {
      throw new Error('没有降级方案');
    }

    // 简化：返回降级结果
    return { fallback: true, action: action.fallback.action };
  }

  /**
   * 获取资源使用
   */
  private getResourceUsage(): { cpu: number; memory: number; network: number } {
    const memory = process.memoryUsage();
    return {
      cpu: 0, // 简化
      memory: memory.heapUsed,
      network: 0, // 简化
    };
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============ 反馈器 ============

/**
 * 反馈器
 * 
 * 负责收集反馈、生成学习、调整系统
 */
export class FeedbackProcessor {
  private config: PPAFConfig;
  private feedbackHistory: FeedbackData[] = [];

  constructor(config: PPAFConfig) {
    this.config = config;
  }

  /**
   * 处理反馈
   */
  async process(
    actionResult: ActionResult,
    planResult?: PlanningResult
  ): Promise<FeedbackResult> {
    const feedback = await this.collectFeedback(actionResult, planResult);
    this.feedbackHistory.push(feedback);

    // 处理反馈
    const actions: FeedbackResult['actions'] = [];

    // 1. 错误处理
    if (actionResult.status === ActionStatus.FAILED) {
      actions.push({
        type: 'error_handling',
        description: `处理失败: ${actionResult.error}`,
        result: '已记录错误，建议重试或降级',
      });
    }

    // 2. 性能优化
    if (actionResult.duration > 5000) {
      actions.push({
        type: 'performance_optimization',
        description: '检测到长耗时操作',
        result: '建议优化或增加缓存',
      });
    }

    // 3. 学习
    let learning: FeedbackResult['learning'];
    if (feedback.shouldLearn && this.config.enableLearning) {
      learning = {
        knowledge: this.extractKnowledge(actionResult, feedback),
        category: feedback.score >= 0.7 ? 'success' : 'failure',
        importance: feedback.learningPriority || 0.5,
      };
    }

    // 4. 系统调整
    const adjustments = this.generateAdjustments(feedback);

    return {
      processed: true,
      actions,
      learning,
      adjustments,
    };
  }

  /**
   * 收集反馈
   */
  private async collectFeedback(
    actionResult: ActionResult,
    planResult?: PlanningResult
  ): Promise<FeedbackData> {
    // 计算评分
    let score = 1.0;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 检查执行状态
    if (actionResult.status === ActionStatus.FAILED) {
      score -= 0.5;
      issues.push(`执行失败: ${actionResult.error}`);
      suggestions.push('检查错误原因，考虑重试或降级');
    }

    // 检查执行时间
    if (actionResult.duration > 10000) {
      score -= 0.2;
      issues.push('执行时间过长');
      suggestions.push('优化算法或增加缓存');
    }

    // 检查重试次数
    if (actionResult.retryCount > 0) {
      score -= 0.1 * actionResult.retryCount;
      issues.push(`重试 ${actionResult.retryCount} 次`);
      suggestions.push('检查稳定性问题');
    }

    // 检查是否使用降级
    if (actionResult.usedFallback) {
      score -= 0.1;
      issues.push('使用了降级方案');
      suggestions.push('优化主流程，减少降级依赖');
    }

    return {
      feedbackId: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: FeedbackType.IMMEDIATE,
      source: FeedbackSource.SYSTEM,
      actionId: actionResult.actionId,
      planId: planResult?.planId,
      score: Math.max(0, score),
      issues,
      suggestions,
      shouldLearn: score < 0.7 || score > 0.9,
      learningPriority: score < 0.5 ? 0.9 : score < 0.7 ? 0.7 : 0.3,
      timestamp: Date.now(),
    };
  }

  /**
   * 提取知识
   */
  private extractKnowledge(
    actionResult: ActionResult,
    feedback: FeedbackData
  ): string {
    if (feedback.score >= 0.7) {
      return `成功模式: ${actionResult.actionId} - ${feedback.suggestions.join('; ')}`;
    } else {
      return `失败模式: ${actionResult.actionId} - ${feedback.issues.join('; ')}`;
    }
  }

  /**
   * 生成调整
   */
  private generateAdjustments(
    feedback: FeedbackData
  ): FeedbackResult['adjustments'] {
    const adjustments: FeedbackResult['adjustments'] = [];

    // 根据反馈生成调整建议
    if (feedback.score < this.config.feedbackThreshold) {
      adjustments.push({
        component: 'planner',
        parameter: 'planningDepth',
        oldValue: 'normal',
        newValue: 'detailed',
      });
    }

    return adjustments;
  }

  /**
   * 获取反馈历史
   */
  getHistory(limit: number = 10): FeedbackData[] {
    return this.feedbackHistory.slice(-limit);
  }
}

// ============ PPAF 引擎 ============

/**
 * PPAF 引擎
 * 
 * 协调 Perception → Planning → Action → Feedback 闭环
 */
export class PPAFEngine {
  private config: PPAFConfig;
  private perceptor: Perceptor;
  private planner: Planner;
  private executor: Executor;
  private feedbackProcessor: FeedbackProcessor;

  constructor(config: Partial<PPAFConfig> = {}) {
    this.config = { ...DEFAULT_PPAF_CONFIG, ...config };
    this.perceptor = new Perceptor(this.config);
    this.planner = new Planner(this.config);
    this.executor = new Executor(this.config);
    this.feedbackProcessor = new FeedbackProcessor(this.config);
  }

  /**
   * 运行 PPAF 闭环
   */
  async run(
    inputs: PerceptionInput[],
    executor?: (action: ActionDefinition) => Promise<unknown>
  ): Promise<PPAFContext> {
    const loopId = `loop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context: PPAFContext = {
      loopId,
      actions: [],
      feedbacks: [],
      currentPhase: 'perception',
      iteration: 0,
      maxIterations: this.config.maxIterations,
      completed: false,
    };

    try {
      // ========== Phase 1: Perception ==========
      context.currentPhase = 'perception';
      context.perception = await this.perceptor.perceive(inputs);

      // 检查是否需要终止
      if (context.perception.anomalies.length > 0 && context.perception.confidence < 0.5) {
        context.completed = true;
        context.completionReason = '感知阶段检测到严重异常';
        return context;
      }

      // ========== Phase 2: Planning ==========
      context.currentPhase = 'planning';
      context.planning = await this.planner.plan(context.perception);

      // ========== Phase 3: Action ==========
      context.currentPhase = 'action';
      for (const stepId of context.planning.executionOrder) {
        const step = context.planning.steps.find(s => s.stepId === stepId);
        if (!step) continue;

        const action: ActionDefinition = {
          actionId: `action_${step.stepId}`,
          type: ActionType.TOOL_CALL,
          name: step.name,
          input: { step },
          preconditions: step.dependencies.map(d => ({
            condition: `依赖 ${d} 已完成`,
            required: true,
          })),
          postconditions: [
            { condition: step.expectedOutput, expected: true },
          ],
          timeout: step.estimatedDuration * 2,
          maxRetries: 3,
        };

        const result = await this.executor.execute(action, executor);
        context.actions.push(result);

        // ========== Phase 4: Feedback ==========
        context.currentPhase = 'feedback';
        const feedbackResult = await this.feedbackProcessor.process(result, context.planning);
        if (feedbackResult.learning) {
          // 记录学习结果
        }

        // 检查是否需要重规划
        if (result.status === ActionStatus.FAILED && this.config.enableAutoReplanning) {
          context.iteration++;
          if (context.iteration < context.maxIterations) {
            // 重新规划
            context.planning = await this.planner.plan(context.perception, PlanningLevel.TACTICAL);
          }
        }
      }

      context.completed = true;
      context.completionReason = '所有步骤执行完成';
      return context;
    } catch (error) {
      context.completed = true;
      context.completionReason = `执行异常: ${(error as Error).message}`;
      return context;
    }
  }

  /**
   * 获取组件
   */
  getPerceptor(): Perceptor {
    return this.perceptor;
  }

  getPlanner(): Planner {
    return this.planner;
  }

  getExecutor(): Executor {
    return this.executor;
  }

  getFeedbackProcessor(): FeedbackProcessor {
    return this.feedbackProcessor;
  }
}
