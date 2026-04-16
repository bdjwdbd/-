/**
 * 元灵系统 × Harness Engineering 深度集成
 * 
 * 将 Harness 的所有能力深度集成到元灵系统的 L0-L6 各层：
 * 
 * - L0 灵思层：思考协议 + 追踪 + 状态检查点
 * - L1 灵枢层：决策中心 + 决策审计 + PPAF 规划
 * - L2 灵脉层：执行引擎 + 沙盒隔离 + 度量收集
 * - L3 灵躯层：工具执行 + 权限控制 + 资源限制
 * - L4 灵盾层：安全验证 + 风险评估 + 异常检测
 * - L5 灵韵层：反馈调节 + 学习记录 + 演进优化
 * - L6 灵识层：环境感知 + 状态感知 + 异常感知
 * 
 * @module integration/yuanling-harness-deep-integration
 */

import { YuanLingSystem, Message, ProcessingContext, ThinkingResult, DecisionResult } from '../yuanling-system';
import {
  // 状态管理
  HarnessSystem,
  StateCategory,
  
  // 追踪系统
  TraceCollector,
  Layer,
  SpanStatus,
  
  // PPAF 闭环
  PPAFEngine,
  PerceptionType,
  PlanningLevel,
  ActionType,
  
  // 沙盒隔离
  SandboxManager,
  SandboxLevel,
  RiskLevel,
  
  // 度量演进
  EvolutionEngine,
  MetricCategory,
} from '../harness';

// ============ 类型定义 ============

/**
 * 深度集成配置
 */
export interface DeepIntegrationConfig {
  /** 工作目录 */
  workspaceRoot: string;
  
  // ============ Harness 模块开关 ============
  
  /** 是否启用状态管理 */
  enableStateManager: boolean;
  
  /** 是否启用追踪 */
  enableTracing: boolean;
  
  /** 是否启用 PPAF 闭环 */
  enablePPAF: boolean;
  
  /** 是否启用沙盒隔离 */
  enableSandbox: boolean;
  
  /** 是否启用度量演进 */
  enableMetrics: boolean;
  
  // ============ 高级配置 ============
  
  /** 追踪采样率 */
  traceSampleRate: number;
  
  /** 默认沙盒级别 */
  defaultSandboxLevel: SandboxLevel;
  
  /** 是否启用自动风险评估 */
  enableAutoRiskAssessment: boolean;
  
  /** 是否启用自动优化 */
  enableAutoOptimization: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_DEEP_CONFIG: DeepIntegrationConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  enableStateManager: true,
  enableTracing: true,
  enablePPAF: true,
  enableSandbox: true,
  enableMetrics: true,
  traceSampleRate: 1.0,
  defaultSandboxLevel: SandboxLevel.PROCESS,
  enableAutoRiskAssessment: true,
  enableAutoOptimization: true,
};

/**
 * 处理结果（增强版）
 */
export interface EnhancedProcessingResult {
  /** 原始结果 */
  result: {
    content: string;
    toolCalls?: any[];
    usage?: { inputTokens: number; outputTokens: number };
  };
  
  /** 处理上下文 */
  context: ProcessingContext;
  
  /** Harness 增强数据 */
  harness: {
    /** 追踪 ID */
    traceId: string | null;
    
    /** 沙盒 ID */
    sandboxId: string | null;
    
    /** 风险评估 */
    riskAssessment: {
      level: RiskLevel;
      recommendedLevel: SandboxLevel;
    } | null;
    
    /** 性能指标 */
    metrics: {
      totalDuration: number;
      layerDurations: Record<string, number>;
      tokenUsage: { input: number; output: number };
    };
    
    /** 综合评分 */
    score: number;
  };
}

// ============ 深度集成系统 ============

/**
 * 元灵系统 × Harness 深度集成
 * 
 * 将 Harness 的所有能力深度集成到元灵系统的各层
 */
export class YuanLingHarnessDeepIntegration {
  private yuanling: YuanLingSystem;
  private config: DeepIntegrationConfig;
  
  // Harness 组件
  private harnessSystem?: HarnessSystem;
  private ppafEngine?: PPAFEngine;
  private sandboxManager?: SandboxManager;
  private evolutionEngine?: EvolutionEngine;
  
  private initialized: boolean = false;

  constructor(
    yuanling: YuanLingSystem,
    config: Partial<DeepIntegrationConfig> = {}
  ) {
    this.yuanling = yuanling;
    this.config = { ...DEFAULT_DEEP_CONFIG, ...config };
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 初始化 Harness 系统
    this.harnessSystem = new HarnessSystem({
      workspaceRoot: this.config.workspaceRoot,
      enableStateManager: this.config.enableStateManager,
      enableTracing: this.config.enableTracing,
      traceSampleRate: this.config.traceSampleRate,
      enableAudit: true,
    });
    await this.harnessSystem.initialize();

    // 初始化 PPAF 引擎
    if (this.config.enablePPAF) {
      this.ppafEngine = new PPAFEngine({
        workspaceRoot: this.config.workspaceRoot,
        maxIterations: 5,
        enableAutoReplanning: true,
        enableLearning: true,
      });
    }

    // 初始化沙盒管理器
    if (this.config.enableSandbox) {
      this.sandboxManager = new SandboxManager({
        workspaceRoot: this.config.workspaceRoot,
        defaultLevel: this.config.defaultSandboxLevel,
        maxSandboxes: 100,
        enableMonitoring: true,
        enableAudit: true,
      });
      await this.sandboxManager.initialize();
    }

    // 初始化演进引擎
    if (this.config.enableMetrics) {
      this.evolutionEngine = new EvolutionEngine({
        workspaceRoot: this.config.workspaceRoot,
        collectionInterval: 60000,
        analysisInterval: 300000,
        enableAutoOptimization: this.config.enableAutoOptimization,
        enableABTesting: true,
        enableCanaryRelease: true,
      });
      await this.evolutionEngine.initialize();
    }

    this.initialized = true;
  }

  // ============ 主处理流程 ============

  /**
   * 处理消息（深度集成版）
   * 
   * 完整流程：
   * 1. 风险评估 → 选择沙盒级别
   * 2. 创建沙盒
   * 3. 开始追踪
   * 4. L6 灵识层 - 环境感知（PPAF Perception）
   * 5. L0 灵思层 - 思考（带追踪 + 状态检查点）
   * 6. L1 灵枢层 - 决策（PPAF Planning + 决策审计）
   * 7. L2/L3 灵脉层/灵躯层 - 执行（沙盒隔离 + 度量收集）
   * 8. L4 灵盾层 - 验证（异常检测）
   * 9. L5 灵韵层 - 反馈（PPAF Feedback + 学习记录）
   * 10. 结束追踪 + 销毁沙盒
   */
  async process(
    userMessage: string,
    sessionHistory: Message[],
    executor: (prompt: string, context: ProcessingContext) => Promise<{
      content: string;
      toolCalls?: any[];
      usage?: { inputTokens: number; outputTokens: number };
    }>
  ): Promise<EnhancedProcessingResult> {
    const startTime = Date.now();
    const layerDurations: Record<string, number> = {};
    
    // ========== 0. 风险评估 ==========
    let riskAssessment: EnhancedProcessingResult['harness']['riskAssessment'] = null;
    let sandboxId: string | null = null;
    
    if (this.config.enableAutoRiskAssessment && this.sandboxManager) {
      // 根据输入内容推断可能使用的工具
      const inferredTools: string[] = ['llm'];
      const inputLower = userMessage.toLowerCase();
      
      if (inputLower.includes('执行') || inputLower.includes('命令') || inputLower.includes('run') || inputLower.includes('exec')) {
        inferredTools.push('exec', 'shell');
      }
      if (inputLower.includes('读取') || inputLower.includes('文件') || inputLower.includes('read') || inputLower.includes('file')) {
        inferredTools.push('read', 'file');
      }
      if (inputLower.includes('写入') || inputLower.includes('保存') || inputLower.includes('write') || inputLower.includes('save')) {
        inferredTools.push('write', 'file');
      }
      if (inputLower.includes('删除') || inputLower.includes('remove') || inputLower.includes('delete') || inputLower.includes('rm')) {
        inferredTools.push('delete', 'exec');
      }
      
      const assessment = this.sandboxManager.assessRisk({
        type: 'process',
        input: userMessage,
        tools: inferredTools,
      });
      riskAssessment = {
        level: assessment.level,
        recommendedLevel: assessment.recommendedLevel,
      };
      
      // 创建沙盒
      const sandbox = await this.sandboxManager.create({
        name: `session_${Date.now()}`,
        level: assessment.recommendedLevel,
      });
      sandboxId = sandbox.sandboxId;
    }

    // ========== 1. 开始追踪 ==========
    let traceId: string | null = null;
    if (this.config.enableTracing && this.harnessSystem) {
      const traceContext = this.harnessSystem.startTrace('process_message', {
        messageLength: userMessage.length,
        sandboxId,
        riskLevel: riskAssessment?.level,
      });
      traceId = traceContext?.traceId || null;
    }

    const context: ProcessingContext = {};
    
    try {
      // ========== 2. L6 灵识层 - 环境感知 ==========
      let l6Start = Date.now();
      
      if (this.config.enablePPAF && this.ppafEngine) {
        const perceptionResult = await this.ppafEngine.getPerceptor().perceive([
          {
            type: PerceptionType.TEXT,
            data: userMessage,
            timestamp: Date.now(),
          },
          {
            type: PerceptionType.SYSTEM,
            data: null,
            timestamp: Date.now(),
          },
        ]);
        
        // 记录感知结果
        if (this.config.enableMetrics && this.evolutionEngine) {
          this.evolutionEngine.recordMetric('perception_confidence', perceptionResult.confidence);
        }
      }
      
      layerDurations['L6'] = Date.now() - l6Start;

      // ========== 3. L0 灵思层 - 思考 ==========
      let l0Start = Date.now();
      
      // 创建思考前的检查点
      if (this.config.enableStateManager && this.harnessSystem) {
        await this.harnessSystem.createCheckpoint(
          [`session:${traceId}`],
          '思考前检查点'
        );
      }
      
      // 执行思考
      const thinkingResult = await this.yuanling.thinkOnly(userMessage);
      context.thinking = thinkingResult || undefined;
      
      // 记录思考指标
      if (this.config.enableMetrics && this.evolutionEngine && thinkingResult) {
        this.evolutionEngine.recordMetric('thinking_confidence', thinkingResult.confidence);
      }
      
      layerDurations['L0'] = Date.now() - l0Start;

      // ========== 4. L1 灵枢层 - 决策 ==========
      let l1Start = Date.now();
      
      // PPAF 规划
      if (this.config.enablePPAF && this.ppafEngine && context.thinking) {
        const planResult = await this.ppafEngine.getPlanner().plan(
          { 
            perceptionId: 'temp',
            processed: { text: userMessage },
            features: {},
            confidence: context.thinking.confidence,
            anomalies: [],
            latency: 0,
          },
          PlanningLevel.OPERATIONAL
        );
        
        // 记录规划指标
        if (this.config.enableMetrics && this.evolutionEngine) {
          this.evolutionEngine.recordMetric('planning_steps', planResult.steps.length);
        }
      }
      
      // 决策审计
      if (this.config.enableTracing && this.harnessSystem && context.thinking) {
        this.harnessSystem.recordDecision({
          spanId: 'decision_span',
          input: userMessage,
          reasoning: context.thinking.process,
          output: 'decision_made',
          confidence: context.thinking.confidence,
          alternatives: [
            { description: 'direct_reply', probability: 0.3, reason: '简单问题' },
            { description: 'tool_call', probability: 0.5, reason: '需要工具' },
          ],
        });
      }
      
      layerDurations['L1'] = Date.now() - l1Start;

      // ========== 5. L2/L3 灵脉层/灵躯层 - 执行 ==========
      let l2Start = Date.now();
      
      // 在沙盒中执行
      let result;
      if (this.sandboxManager && sandboxId) {
        const execResult = await this.sandboxManager.execute(
          sandboxId,
          async () => {
            return await this.yuanling.processWithExternalExecutor(
              userMessage,
              sessionHistory,
              executor
            );
          }
        );
        
        if (execResult.success) {
          result = execResult.output as any;
        } else {
          throw new Error(execResult.error || '执行失败');
        }
      } else {
        result = await this.yuanling.processWithExternalExecutor(
          userMessage,
          sessionHistory,
          executor
        );
      }
      
      // 记录执行指标
      if (this.config.enableMetrics && this.evolutionEngine) {
        this.evolutionEngine.recordResponseTime(
          Date.now() - l2Start,
          'process_message'
        );
        this.evolutionEngine.recordTaskCompletion(
          result.context.validation?.passed ?? true,
          'process'
        );
      }
      
      layerDurations['L2_L3'] = Date.now() - l2Start;

      // ========== 6. L4 灵盾层 - 验证 ==========
      let l4Start = Date.now();
      context.validation = result.context.validation;
      
      // 异常检测
      if (context.validation && !context.validation.passed) {
        if (this.config.enableMetrics && this.evolutionEngine) {
          this.evolutionEngine.recordMetric('validation_failures', 1);
        }
      }
      
      layerDurations['L4'] = Date.now() - l4Start;

      // ========== 7. L5 灵韵层 - 反馈 ==========
      let l5Start = Date.now();
      context.feedback = result.context.feedback;
      
      // PPAF 反馈
      if (this.config.enablePPAF && this.ppafEngine && result.context.validation) {
        const feedbackResult = await this.ppafEngine.getFeedbackProcessor().process({
          actionId: 'process_action',
          status: result.context.validation.passed ? 'completed' as any : 'failed' as any,
          duration: Date.now() - startTime,
          retryCount: 0,
          usedFallback: false,
          resourceUsage: { cpu: 0, memory: 0, network: 0 },
        });
        
        // 学习记录
        if (feedbackResult.learning && this.config.enableStateManager && this.harnessSystem) {
          await this.harnessSystem.setState(
            `learning:${Date.now()}`,
            feedbackResult.learning,
            StateCategory.MEMORY
          );
        }
      }
      
      layerDurations['L5'] = Date.now() - l5Start;

      // ========== 8. 结束追踪 ==========
      if (this.config.enableTracing && this.harnessSystem && traceId) {
        this.harnessSystem.endTrace(traceId, SpanStatus.COMPLETED);
      }

      // ========== 9. 计算综合评分 ==========
      let score = 0;
      if (this.config.enableMetrics && this.evolutionEngine) {
        const scoreResult = this.evolutionEngine.getScore();
        score = scoreResult.total;
      }

      return {
        result: result.result,
        context,
        harness: {
          traceId,
          sandboxId,
          riskAssessment,
          metrics: {
            totalDuration: Date.now() - startTime,
            layerDurations,
            tokenUsage: result.result.usage || { input: 0, output: 0 },
          },
          score,
        },
      };
    } catch (error) {
      // 记录失败
      if (this.config.enableTracing && this.harnessSystem && traceId) {
        this.harnessSystem.endTrace(traceId, SpanStatus.FAILED);
      }
      
      if (this.config.enableMetrics && this.evolutionEngine) {
        this.evolutionEngine.recordTaskCompletion(false, 'process');
      }
      
      throw error;
    } finally {
      // 销毁沙盒
      if (this.sandboxManager && sandboxId) {
        await this.sandboxManager.destroy(sandboxId);
      }
    }
  }

  // ============ 状态管理接口 ============

  /**
   * 获取会话状态
   */
  async getSessionState(sessionId: string): Promise<any> {
    if (!this.harnessSystem) return null;
    return this.harnessSystem.getState(`session:${sessionId}`);
  }

  /**
   * 保存会话状态
   */
  async saveSessionState(sessionId: string, state: any): Promise<void> {
    if (!this.harnessSystem) return;
    await this.harnessSystem.setState(`session:${sessionId}`, state, StateCategory.SESSION);
  }

  /**
   * 创建检查点
   */
  async createCheckpoint(keys: string[], description?: string): Promise<string | null> {
    if (!this.harnessSystem) return null;
    return this.harnessSystem.createCheckpoint(keys, description);
  }

  /**
   * 从检查点恢复
   */
  async restoreCheckpoint(checkpointId: string): Promise<number> {
    if (!this.harnessSystem) return 0;
    return this.harnessSystem.restoreCheckpoint(checkpointId);
  }

  // ============ 度量接口 ============

  /**
   * 获取综合评分
   */
  getScore(): number {
    if (!this.evolutionEngine) return 0;
    return this.evolutionEngine.getScore().total;
  }

  /**
   * 获取优化建议
   */
  getOptimizationSuggestions(): any[] {
    if (!this.evolutionEngine) return [];
    return this.evolutionEngine.getSuggestions();
  }

  /**
   * 获取所有指标
   */
  getAllMetrics(): any {
    if (!this.evolutionEngine) return null;
    return this.evolutionEngine.getAllMetrics();
  }

  // ============ 沙盒接口 ============

  /**
   * 评估风险
   */
  assessRisk(operation: {
    type: string;
    input: unknown;
    tools?: string[];
  }): any {
    if (!this.sandboxManager) return null;
    return this.sandboxManager.assessRisk(operation);
  }

  // ============ 状态查询 ============

  /**
   * 获取系统状态
   */
  getStatus(): {
    initialized: boolean;
    modules: {
      stateManager: boolean;
      tracing: boolean;
      ppaf: boolean;
      sandbox: boolean;
      metrics: boolean;
    };
    score: number;
  } {
    return {
      initialized: this.initialized,
      modules: {
        stateManager: this.config.enableStateManager,
        tracing: this.config.enableTracing,
        ppaf: this.config.enablePPAF,
        sandbox: this.config.enableSandbox,
        metrics: this.config.enableMetrics,
      },
      score: this.getScore(),
    };
  }

  /**
   * 关闭系统
   */
  async close(): Promise<void> {
    if (this.evolutionEngine) {
      await this.evolutionEngine.close();
    }
    if (this.sandboxManager) {
      await this.sandboxManager.close();
    }
    if (this.harnessSystem) {
      await this.harnessSystem.close();
    }
    this.initialized = false;
  }
}

// ============ 工厂函数 ============

/**
 * 创建深度集成的元灵系统
 */
export async function createDeepIntegratedSystem(
  yuanling: YuanLingSystem,
  config: Partial<DeepIntegrationConfig> = {}
): Promise<YuanLingHarnessDeepIntegration> {
  const integrated = new YuanLingHarnessDeepIntegration(yuanling, config);
  await integrated.initialize();
  return integrated;
}
