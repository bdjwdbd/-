/**
 * 元灵系统 × Harness Engineering 集成
 * 
 * 将 Harness 的核心能力集成到元灵系统的各层级：
 * - L0-L6 全链路追踪
 * - 状态外置（无状态原则）
 * - PPAF 闭环增强
 * 
 * @module integration/harness-integration
 */

import { YuanLingSystem, Message, ProcessingContext } from '../yuanling-system';
import {
  HarnessSystem,
  StateCategory,
  Layer,
  SpanStatus,
  initializeHarness,
  getHarness,
} from '../harness';

// ============ 类型定义 ============

/**
 * 集成配置
 */
export interface HarnessIntegrationConfig {
  /** 工作目录 */
  workspaceRoot: string;
  
  /** 是否启用追踪 */
  enableTracing: boolean;
  
  /** 是否启用状态管理 */
  enableStateManagement: boolean;
  
  /** 是否启用审计 */
  enableAudit: boolean;
  
  /** 追踪采样率 */
  traceSampleRate: number;
}

/**
 * 默认配置
 */
const DEFAULT_INTEGRATION_CONFIG: HarnessIntegrationConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  enableTracing: true,
  enableStateManagement: true,
  enableAudit: true,
  traceSampleRate: 1.0,
};

// ============ 集成包装器 ============

/**
 * 元灵系统 Harness 包装器
 * 
 * 为元灵系统添加 Harness 能力
 */
export class YuanLingWithHarness {
  private yuanling: YuanLingSystem;
  private harness: HarnessSystem;
  private config: HarnessIntegrationConfig;
  private initialized: boolean = false;

  constructor(
    yuanling: YuanLingSystem,
    config: Partial<HarnessIntegrationConfig> = {}
  ) {
    this.yuanling = yuanling;
    this.config = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
    this.harness = getHarness({
      workspaceRoot: this.config.workspaceRoot,
      enableStateManager: this.config.enableStateManagement,
      enableTracing: this.config.enableTracing,
      traceSampleRate: this.config.traceSampleRate,
      enableAudit: this.config.enableAudit,
    });
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.harness.initialize();
    this.initialized = true;
  }

  // ============ 增强的处理流程 ============

  /**
   * 处理消息（带 Harness 增强）
   * 
   * 流程：
   * 1. 开始追踪
   * 2. L6 灵识层 - 环境感知（带追踪）
   * 3. L0 灵思层 - 思考（带追踪 + 状态检查点）
   * 4. L1 灵枢层 - 决策（带追踪 + 决策审计）
   * 5. L2/L3 灵脉层/灵躯层 - 执行（带追踪 + 状态管理）
   * 6. L4 灵盾层 - 验证（带追踪）
   * 7. L5 灵韵层 - 反馈（带追踪 + 学习记录）
   * 8. 结束追踪
   */
  async processWithHarness(
    userMessage: string,
    sessionHistory: Message[],
    executor: (prompt: string, context: ProcessingContext) => Promise<{
      content: string;
      toolCalls?: any[];
      usage?: { inputTokens: number; outputTokens: number };
    }>
  ): Promise<{
    result: { content: string; toolCalls?: any[]; usage?: any };
    context: ProcessingContext;
    traceId: string | null;
  }> {
    // 开始追踪
    const traceContext = this.harness.startTrace('process_message', {
      messageLength: userMessage.length,
      historyLength: sessionHistory.length,
    });

    const traceId = traceContext?.traceId || null;
    const context: ProcessingContext = {};

    try {
      // ========== L6 灵识层 - 环境感知 ==========
      const l6Span = this.harness.startSpan('L6_环境感知', Layer.L6, traceContext);
      
      // 检查是否有缓存的会话状态
      const sessionKey = `session:${traceId}`;
      const cachedSession = await this.harness.getState(sessionKey);
      
      if (l6Span) {
        this.harness.traceCollector?.addSpanAttribute(l6Span.spanId, 'cachedSession', !!cachedSession);
        this.harness.endSpan(l6Span.spanId);
      }

      // ========== L0 灵思层 - 思考 ==========
      const l0Span = this.harness.startSpan('L0_思考', Layer.L0, traceContext);
      
      // 创建思考前的检查点
      if (this.config.enableStateManagement) {
        await this.harness.createCheckpoint([sessionKey], '思考前检查点');
      }

      // 执行思考（委托给元灵系统）
      const thinkingResult = await this.yuanling.thinkOnly(userMessage);
      context.thinking = thinkingResult || undefined;

      if (l0Span) {
        if (thinkingResult) {
          this.harness.traceCollector?.addSpanAttribute(l0Span.spanId, 'depth', thinkingResult.depth);
          this.harness.traceCollector?.addSpanAttribute(l0Span.spanId, 'confidence', thinkingResult.confidence);
        }
        this.harness.endSpan(l0Span.spanId);
      }

      // ========== L1 灵枢层 - 决策 ==========
      const l1Span = this.harness.startSpan('L1_决策', Layer.L1, traceContext);
      
      // 执行决策（委托给元灵系统）
      // 注意：这里简化了，实际应该调用元灵系统的决策方法
      const decisionType = this.inferDecisionType(userMessage, thinkingResult);
      context.decision = {
        type: decisionType,
        reasoning: thinkingResult 
          ? `基于 ${thinkingResult.depth} 思考，建议 ${decisionType}`
          : `建议 ${decisionType}`,
      };

      // 记录决策审计
      if (l1Span && this.config.enableAudit) {
        this.harness.recordDecision({
          spanId: l1Span.spanId,
          input: userMessage,
          reasoning: context.decision.reasoning,
          output: decisionType,
          confidence: thinkingResult?.confidence || 0.5,
          alternatives: [
            { description: 'direct_reply', probability: 0.3, reason: '简单问题' },
            { description: 'tool_call', probability: 0.5, reason: '需要工具' },
            { description: 'search', probability: 0.2, reason: '信息不足' },
          ],
        });
      }

      if (l1Span) {
        this.harness.traceCollector?.addSpanAttribute(l1Span.spanId, 'decisionType', decisionType);
        this.harness.endSpan(l1Span.spanId);
      }

      // ========== L2/L3 灵脉层/灵躯层 - 执行 ==========
      const l2Span = this.harness.startSpan('L2_L3_执行', Layer.L2, traceContext);
      
      // 保存执行前状态
      if (this.config.enableStateManagement) {
        await this.harness.setState(
          `${sessionKey}:pre_execution`,
          { thinking: context.thinking, decision: context.decision },
          StateCategory.TASK
        );
      }

      // 执行（委托给元灵系统）
      const result = await this.yuanling.processWithExternalExecutor(
        userMessage,
        sessionHistory,
        executor
      );

      // 保存执行结果状态
      if (this.config.enableStateManagement) {
        await this.harness.setState(
          `${sessionKey}:post_execution`,
          { result: result.result.content.substring(0, 200) },
          StateCategory.TASK
        );
      }

      if (l2Span) {
        this.harness.traceCollector?.addSpanAttribute(l2Span.spanId, 'resultLength', result.result.content.length);
        if (result.result.usage) {
          this.harness.traceCollector?.addSpanAttribute(l2Span.spanId, 'tokenUsage', result.result.usage);
        }
        this.harness.endSpan(l2Span.spanId);
      }

      // ========== L4 灵盾层 - 验证 ==========
      const l4Span = this.harness.startSpan('L4_验证', Layer.L4, traceContext);
      
      // 验证（已在元灵系统中完成）
      context.validation = result.context.validation;

      if (l4Span) {
        if (context.validation) {
          this.harness.traceCollector?.addSpanAttribute(l4Span.spanId, 'score', context.validation.score);
          this.harness.traceCollector?.addSpanAttribute(l4Span.spanId, 'passed', context.validation.passed);
        }
        this.harness.endSpan(l4Span.spanId);
      }

      // ========== L5 灵韵层 - 反馈 ==========
      const l5Span = this.harness.startSpan('L5_反馈', Layer.L5, traceContext);
      
      // 反馈（已在元灵系统中完成）
      context.feedback = result.context.feedback;

      // 记录学习反馈
      if (this.config.enableStateManagement && context.validation) {
        await this.harness.setState(
          `${sessionKey}:feedback`,
          {
            score: context.validation.score,
            issues: context.validation.issues,
            suggestions: context.feedback?.suggestions,
          },
          StateCategory.MEMORY
        );
      }

      if (l5Span) {
        if (context.feedback) {
          this.harness.traceCollector?.addSpanAttribute(l5Span.spanId, 'shouldLearn', context.feedback.shouldLearn);
        }
        this.harness.endSpan(l5Span.spanId);
      }

      // 结束追踪
      if (traceContext) {
        this.harness.endTrace(traceContext.traceId, SpanStatus.COMPLETED);
      }

      return { result: result.result, context, traceId };
    } catch (error) {
      // 记录异常
      if (traceContext) {
        this.harness.endTrace(traceContext.traceId, SpanStatus.FAILED);
      }

      throw error;
    }
  }

  /**
   * 推断决策类型
   */
  private inferDecisionType(
    message: string,
    thinking?: any
  ): 'direct_reply' | 'tool_call' | 'search' | 'clarify' {
    const lowerMessage = message.toLowerCase();

    // 检查工具关键词
    const toolKeywords = ['文件', '读取', '执行', '搜索', '浏览器', '日程', '备忘'];
    if (toolKeywords.some(kw => lowerMessage.includes(kw))) {
      return 'tool_call';
    }

    // 检查问题关键词
    if ((lowerMessage.includes('?') || lowerMessage.includes('？')) &&
        (lowerMessage.includes('什么') || lowerMessage.includes('如何') || lowerMessage.includes('为什么'))) {
      return 'search';
    }

    // 检查澄清关键词
    if (lowerMessage.includes('确认') || lowerMessage.includes('你是说')) {
      return 'clarify';
    }

    return 'direct_reply';
  }

  // ============ 状态管理接口 ============

  /**
   * 获取会话状态
   */
  async getSessionState(sessionId: string): Promise<any> {
    return this.harness.getState(`session:${sessionId}`);
  }

  /**
   * 保存会话状态
   */
  async saveSessionState(sessionId: string, state: any): Promise<void> {
    await this.harness.setState(`session:${sessionId}`, state, StateCategory.SESSION);
  }

  /**
   * 创建检查点
   */
  async createCheckpoint(keys: string[], description?: string): Promise<string | null> {
    return this.harness.createCheckpoint(keys, description);
  }

  /**
   * 从检查点恢复
   */
  async restoreCheckpoint(checkpointId: string): Promise<number> {
    return this.harness.restoreCheckpoint(checkpointId);
  }

  // ============ 追踪接口 ============

  /**
   * 获取追踪统计
   */
  getTraceStats(): any {
    return this.harness.getStatus().traceCollector.stats;
  }

  /**
   * 获取状态统计
   */
  getStateStats(): any {
    return this.harness.getStatus().stateManager.stats;
  }

  /**
   * 获取系统状态
   */
  getStatus(): {
    initialized: boolean;
    harness: any;
  } {
    return {
      initialized: this.initialized,
      harness: this.harness.getStatus(),
    };
  }

  /**
   * 关闭
   */
  async close(): Promise<void> {
    await this.harness.close();
  }
}

// ============ 工厂函数 ============

/**
 * 创建带 Harness 的元灵系统
 */
export async function createYuanLingWithHarness(
  config: Partial<HarnessIntegrationConfig> = {}
): Promise<YuanLingWithHarness> {
  const yuanling = new YuanLingSystem({
    workspaceRoot: config.workspaceRoot,
  });
  
  const integrated = new YuanLingWithHarness(yuanling, config);
  await integrated.initialize();
  
  return integrated;
}
