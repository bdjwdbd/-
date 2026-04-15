/**
 * 元灵系统 v4.3.0 - 统一主入口
 * 
 * 这是系统的唯一主入口，整合所有层级：
 * - L0 灵思层（思考协议）
 * - L1 灵枢层（决策中心）
 * - L2 灵脉层（执行引擎）
 * - L3 灵躯层（工具执行）
 * - L4 灵盾层（安全验证）
 * - L5 灵韵层（反馈调节）
 * - L6 灵识层（环境感知）
 * 
 * 架构原则：
 * - YuanLingSystem 是唯一主入口
 * - OpenClawBridge 是薄适配器，委托给本系统
 * - 旧版 YuanLingCore 改为兼容包装层
 */

import { quickThink, L0Manager, getL0Manager } from './l0-integration';
import { SimpleIntrospection } from './introspection/simple-tracker';
import { IntrospectionSystem } from './introspection';
import { IntegratedSystem, SystemHealth } from './integrated-system';
import { PerformanceMonitor, StructuredLogger } from './infrastructure/index';

// ============ 类型定义 ============

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============ 工具相关类型 ============

export interface ToolParameter {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  isError?: boolean;
}

export interface Context {
  sessionId: string;
  messages: Message[];
  tokens: number;
  maxTokens: number;
}

export interface Failure {
  type: string;
  timestamp: Date;
  context: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high';
}

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
}

export interface EmbeddingConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
  dimensions?: number;
}

export interface EmbeddingResult {
  vector: number[];
  tokens: number;
}

export interface VectorEntry {
  id: string;
  vector: number[];
  text: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface VectorSearchResult {
  entry: VectorEntry;
  score: number;
}

export interface VectorStoreConfig {
  persistDir: string;
  maxEntries: number;
  defaultTopK: number;
}

// ============ 思考结果类型 ============

export interface ThinkingResult {
  depth: 'minimal' | 'standard' | 'extensive' | 'deep';
  hypotheses: Array<{
    id: string;
    content: string;
    confidence: number;
  }>;
  process: string;
  confidence: number;
}

// ============ 决策结果类型 ============

export interface DecisionResult {
  type: 'direct_reply' | 'tool_call' | 'search' | 'clarify';
  reasoning: string;
  suggestedTools?: string[];
}

// ============ 验证结果类型 ============

export interface ValidationResult {
  score: number;
  issues: string[];
  passed: boolean;
}

// ============ 反馈结果类型 ============

export interface FeedbackResult {
  suggestions: string[];
  shouldLearn: boolean;
}

// ============ 执行器类型 ============

export interface ExternalExecutor {
  (prompt: string, context: ProcessingContext): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    usage?: { inputTokens: number; outputTokens: number };
  }>;
}

// ============ 处理上下文 ============

export interface ProcessingContext {
  thinking?: ThinkingResult;
  decision?: DecisionResult;
  validation?: ValidationResult;
  feedback?: FeedbackResult;
}

// ============ 系统配置 ============

export interface YuanLingSystemConfig {
  workspaceRoot?: string;
  memoryDir?: string;
  enableL0?: boolean;
  enableIntrospection?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_CONFIG: Required<Omit<YuanLingSystemConfig, 'embeddingConfig'>> = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  memoryDir: './memory',
  enableL0: true,
  enableIntrospection: true,
  logLevel: 'info',
};

// ============ 元灵系统主类 ============

export class YuanLingSystem {
  private config: Required<YuanLingSystemConfig>;
  private _l0Manager: L0Manager;
  private introspection: SimpleIntrospection;
  private fullIntrospection: IntrospectionSystem;
  private lastIntrospectionReport: string | null = null;
  private tools: Map<string, Tool> = new Map();
  private llmConfig?: LLMConfig;
  private integratedSystem: IntegratedSystem;
  private performanceMonitor: PerformanceMonitor;
  private logger: StructuredLogger;

  /** 获取 L0 思考协议管理器 */
  get l0Manager(): L0Manager {
    return this._l0Manager;
  }

  constructor(config: YuanLingSystemConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<YuanLingSystemConfig>;
    this._l0Manager = getL0Manager();
    this.introspection = new SimpleIntrospection(this.config.workspaceRoot);
    this.fullIntrospection = new IntrospectionSystem(this.config.workspaceRoot);
    this.integratedSystem = new IntegratedSystem({
      memoryDir: this.config.memoryDir,
      enableLearning: true,
      enableHealthCheck: true
    });
    this.performanceMonitor = new PerformanceMonitor();
    this.logger = new StructuredLogger({ minLevel: this.config.logLevel });
  }

  // ============ L6 灵识层 - 环境感知 ============

  /**
   * 系统启动（三步唤醒）
   */
  async startup(): Promise<{
    introspectionReport?: any;
    environment: {
      os: string;
      nodeVersion: string;
      cwd: string;
      workspaceRoot: string;
    };
    integratedSystem?: SystemHealth;
  }> {
    console.log('[YuanLing] 元灵系统启动中...');
    console.log('[YuanLing] 工作目录:', this.config.workspaceRoot);

    // 环境感知
    const environment = {
      os: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd(),
      workspaceRoot: this.config.workspaceRoot,
    };

    // 初始化集成系统
    await this.integratedSystem.initialize();
    const integratedSystem = await this.integratedSystem.checkHealth();

    // 自省评估（如果启用）
    let introspectionReport;
    if (this.config.enableIntrospection) {
      console.log('[YuanLing] 运行自省评估...');
      introspectionReport = await this.fullIntrospection.introspect('startup');
      console.log('[YuanLing] 综合评分:', introspectionReport.currentSnapshot.overallScore.toFixed(1));
    }

    console.log('[YuanLing] 元灵系统启动完成');

    return { introspectionReport, environment, integratedSystem };
  }

  // ============ L0 灵思层 - 思考协议 ============

  /**
   * L0 思考（内部方法）
   */
  private async think(message: string): Promise<ThinkingResult | null> {
    if (!this.config.enableL0) return null;
    
    const result = await quickThink(message);
    if (!result) return null;

    return {
      depth: result.depth as ThinkingResult['depth'],
      hypotheses: [],
      process: `思考深度: ${result.depth}, 置信度: ${result.confidence}`,
      confidence: result.confidence,
    };
  }

  /**
   * 仅运行 L0 思考（不执行）
   */
  async thinkOnly(message: string): Promise<ThinkingResult | null> {
    return this.think(message);
  }

  // ============ L1 灵枢层 - 决策中心 ============

  /**
   * L1 决策（内部方法）
   */
  private async makeDecision(
    message: string,
    thinking?: ThinkingResult
  ): Promise<DecisionResult> {
    const lowerMessage = message.toLowerCase();

    // 检查是否需要工具调用
    const toolKeywords: Record<string, string[]> = {
      'file': ['文件', '读取', '写入', '编辑', 'file', 'read', 'write'],
      'search': ['搜索', '查找', 'search', 'find'],
      'exec': ['执行', '运行', '命令', 'exec', 'run', 'command'],
      'browser': ['浏览器', '网页', 'browser', 'web'],
      'calendar': ['日程', '日历', 'calendar', 'schedule'],
      'note': ['备忘', '笔记', 'note', 'memo'],
    };

    const suggestedTools: string[] = [];
    for (const [tool, keywords] of Object.entries(toolKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        suggestedTools.push(tool);
      }
    }

    // 使用元认知检查知识边界
    const metaCheck = await this.integratedSystem.metaCheck(message);
    
    // 如果置信度低且不是工具调用，建议搜索
    if (metaCheck.confidence < 0.5 && suggestedTools.length === 0) {
      return {
        type: 'search',
        reasoning: `元认知检查显示置信度较低 (${metaCheck.confidence.toFixed(2)})，知识缺口: ${metaCheck.gaps.join(', ')}`,
        suggestedTools: ['search']
      };
    }

    // 决策类型
    const decisionType: DecisionResult['type'] = 
      suggestedTools.length > 0 ? 'tool_call' :
      (lowerMessage.includes('?') || lowerMessage.includes('？')) && 
      (lowerMessage.includes('什么') || lowerMessage.includes('如何') || lowerMessage.includes('为什么')) ? 'search' :
      lowerMessage.includes('确认') || lowerMessage.includes('你是说') ? 'clarify' :
      'direct_reply';

    return {
      type: decisionType,
      reasoning: thinking 
        ? `基于 ${thinking.depth} 思考，元认知置信度 ${metaCheck.confidence.toFixed(2)}，建议 ${decisionType}`
        : `元认知置信度 ${metaCheck.confidence.toFixed(2)}，建议 ${decisionType}`,
      suggestedTools: suggestedTools.length > 0 ? suggestedTools : undefined,
    };
  }

  // ============ L4 灵盾层 - 安全验证 ============

  /**
   * L4 验证输出（内部方法）
   */
  private validateOutput(
    result: { content: string },
    originalMessage: string
  ): ValidationResult {
    let score = 100;
    const issues: string[] = [];

    // 检查回复长度
    if (result.content.length < 10) {
      score -= 20;
      issues.push('回复过短');
    }

    // 检查是否包含错误标记
    if (result.content.includes('ERROR') || result.content.includes('失败')) {
      score -= 30;
      issues.push('执行可能失败');
    }

    // 检查是否使用了 NO_REPLY
    if (result.content.includes('NO_REPLY')) {
      score -= 10;
      issues.push('使用了静默标记');
    }

    // 检查是否回答了问题
    if (originalMessage.includes('?') || originalMessage.includes('？')) {
      if (!result.content.includes('。') && !result.content.includes('.')) {
        score -= 15;
        issues.push('可能未完整回答问题');
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      passed: score >= 60,
    };
  }

  // ============ L5 灵韵层 - 反馈调节 ============

  /**
   * L5 生成反馈（内部方法）
   */
  private generateFeedback(
    validation?: ValidationResult,
    result?: { content: string }
  ): FeedbackResult {
    void result; // 参数保留用于扩展
    const suggestions: string[] = [];

    if (!validation) {
      return { suggestions, shouldLearn: false };
    }

    if (validation.issues.includes('回复过短')) {
      suggestions.push('建议提供更详细的回复');
    }

    if (validation.issues.includes('执行可能失败')) {
      suggestions.push('建议检查错误原因并提供替代方案');
    }

    if (validation.issues.includes('可能未完整回答问题')) {
      suggestions.push('建议完整回答用户问题');
    }

    // 学习反馈：如果验证分数低，建议学习
    const shouldLearn = validation.score < 80;

    return {
      suggestions,
      shouldLearn,
    };
  }

  /**
   * L5 学习反馈（内部方法）
   */
  private async learnFromFeedback(
    message: string,
    result: { content: string },
    validation: ValidationResult
  ): Promise<void> {
    if (validation.score < 60) {
      // 添加失败案例到记忆
      await this.integratedSystem.addMemory(
        `失败案例: ${message.substring(0, 100)} -> ${validation.issues.join(', ')}`,
        'task',
        { score: validation.score, timestamp: Date.now() }
      );
    } else if (validation.score >= 80) {
      // 添加成功案例到记忆
      await this.integratedSystem.addMemory(
        `成功案例: ${message.substring(0, 100)}`,
        'insight',
        { score: validation.score, response: result.content.substring(0, 200) }
      );
    }
  }

  // ============ 主执行流程 ============

  /**
   * 处理消息（主入口）
   * 
   * 流程：L6 → L0 → L1 → L2/L3 → L4 → L5
   */
  async processWithExternalExecutor(
    userMessage: string,
    sessionHistory: Message[],
    executor: ExternalExecutor
  ): Promise<{
    result: { content: string; toolCalls?: ToolCall[]; usage?: { inputTokens: number; outputTokens: number } };
    context: ProcessingContext;
  }> {
    void sessionHistory; // 参数保留用于扩展
    const context: ProcessingContext = {};
    const startTime = Date.now();
    let success = true;

    try {
      // ========== L6 灵识层 - 环境感知（已在 startup 完成）==========

      // ========== L0 灵思层 - 思考 ==========
      const l0Start = Date.now();
      context.thinking = await this.think(userMessage) || undefined;
      this.performanceMonitor.recordLayerLatency('L0-灵思层', Date.now() - l0Start);

      // ========== L1 灵枢层 - 决策 ==========
      const l1Start = Date.now();
      context.decision = await this.makeDecision(userMessage, context.thinking);
      this.performanceMonitor.recordLayerLatency('L1-灵枢层', Date.now() - l1Start);

      // ========== L2/L3 灵脉层/灵躯层 - 执行（委托给外部执行器）==========
      const l2Start = Date.now();
      const enhancedPrompt = await this.buildEnhancedPrompt(userMessage, context);
      const result = await executor(enhancedPrompt, context);
      this.performanceMonitor.recordLayerLatency('L2-L3-灵脉灵躯层', Date.now() - l2Start);

      // ========== L4 灵盾层 - 验证 ==========
      const l4Start = Date.now();
      context.validation = this.validateOutput(result, userMessage);
      this.performanceMonitor.recordLayerLatency('L4-灵盾层', Date.now() - l4Start);

      // ========== L5 灵韵层 - 反馈 ==========
      context.feedback = this.generateFeedback(context.validation, result);

      // ========== L5 学习反馈 ==========
      await this.learnFromFeedback(userMessage, result, context.validation);

      return { result, context };
    } catch (error) {
      success = false;
      throw error;
    } finally {
      // 记录请求指标
      const latency = Date.now() - startTime;
      this.performanceMonitor.recordRequest(success, latency);
      this.logger.info('YuanLingSystem', `处理完成: ${latency}ms, 成功: ${success}`);
    }
  }

  /**
   * 构建增强提示
   */
  private async buildEnhancedPrompt(
    userMessage: string,
    context: ProcessingContext
  ): Promise<string> {
    const parts: string[] = [];

    // 添加相关记忆
    const memories = await this.integratedSystem.searchMemory(userMessage, { limit: 3 });
    if (memories.length > 0) {
      parts.push('[相关记忆]');
      for (const m of memories) {
        parts.push(`- ${m.memory.content.substring(0, 100)} (相关度: ${m.score.toFixed(2)})`);
      }
      parts.push('');
    }

    // 添加思考过程
    if (context.thinking) {
      parts.push(`[元灵思考] ${context.thinking.process}`);
      if (context.thinking.hypotheses.length > 0) {
        parts.push(`活跃假设: ${context.thinking.hypotheses.map(h => h.content).join(', ')}`);
      }
    }

    // 添加决策建议
    if (context.decision) {
      parts.push(`[决策] ${context.decision.reasoning}`);
      if (context.decision.suggestedTools) {
        parts.push(`建议工具: ${context.decision.suggestedTools.join(', ')}`);
      }
    }

    // 如果有增强内容，包装用户消息
    if (parts.length > 0) {
      return `${parts.join('\n')}\n\n[用户消息]\n${userMessage}`;
    }

    return userMessage;
  }

  // ============ 自省系统 ============

  /**
   * 运行自省检查
   */
  async introspect(): Promise<string | null> {
    if (this.introspection.hasChanges()) {
      const report = await this.introspection.introspect();
      return report ? this.introspection.formatTable(report) : null;
    }
    return null;
  }

  /**
   * 快速自省检查
   */
  quickIntrospect(): {
    hasChanges: boolean;
    changes: string[];
    overallScore?: number;
  } {
    const check = this.fullIntrospection.quickCheck();
    
    return {
      hasChanges: check.hasChanges,
      changes: check.changes,
    };
  }

  /**
   * 检查是否有系统变动
   */
  hasSystemChanges(): boolean {
    return this.introspection.hasChanges();
  }

  /**
   * 获取上次自省报告
   */
  getLastIntrospectionReport(): string | null {
    return this.lastIntrospectionReport;
  }

  // ============ 工具管理 ============

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取工具
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 列出所有工具
   */
  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  // ============ LLM 配置 ============

  /**
   * 配置 LLM
   */
  configureLLM(config: LLMConfig): void {
    this.llmConfig = config;
  }

  /**
   * 获取 LLM 配置
   */
  getLLMConfig(): LLMConfig | undefined {
    return this.llmConfig;
  }

  // ============ 状态查询 ============

  /**
   * 获取系统状态
   */
  getStatus(): {
    health: 'healthy' | 'degraded' | 'unhealthy';
    toolCount: number;
    hasLLMConfig: boolean;
    l0Enabled: boolean;
    introspectionEnabled: boolean;
    performance: {
      health: number;
      avgLatency: number;
      cacheHitRate: number;
      successRate: number;
      totalRequests: number;
    };
  } {
    const perfMetrics = this.performanceMonitor.getSystemMetrics();
    
    // 根据性能指标判断健康状态
    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (perfMetrics.health < 0.7) {
      health = 'unhealthy';
    } else if (perfMetrics.health < 0.9) {
      health = 'degraded';
    }

    return {
      health,
      toolCount: this.tools.size,
      hasLLMConfig: !!this.llmConfig,
      l0Enabled: this.config.enableL0,
      introspectionEnabled: this.config.enableIntrospection,
      performance: perfMetrics,
    };
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    return this.performanceMonitor.getFullReport();
  }

  /**
   * 获取性能监控器
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * 获取补偿组件统计
   */
  getCompensationStats(): {
    total: number;
    active: number;
    deprecated: number;
    removed: number;
  } {
    // 简化实现
    return {
      total: 12,
      active: 12,
      deprecated: 0,
      removed: 0,
    };
  }

  // ============ 记忆系统接口 ============

  /**
   * 添加记忆
   */
  async addMemory(content: string, type?: string, metadata?: Record<string, unknown>): Promise<string> {
    return this.integratedSystem.addMemory(content, type as any, metadata);
  }

  /**
   * 搜索记忆
   */
  async searchMemory(query: string, options?: {
    type?: string;
    tags?: string[];
    limit?: number;
  }): Promise<Array<{ memory: any; score: number }>> {
    return this.integratedSystem.searchMemory(query, options as any);
  }

  /**
   * 获取记忆
   */
  async getMemory(id: string): Promise<any> {
    return this.integratedSystem.getMemory(id);
  }

  /**
   * 删除记忆
   */
  async deleteMemory(id: string): Promise<boolean> {
    return this.integratedSystem.deleteMemory(id);
  }

  // ============ 学习系统接口 ============

  /**
   * 推理
   */
  async infer(premises: string[]): Promise<{ conclusions: string[]; confidence: number }> {
    return this.integratedSystem.infer(premises);
  }

  /**
   * 元认知检查
   */
  async metaCheck(query: string): Promise<{ known: boolean; confidence: number; gaps: string[] }> {
    return this.integratedSystem.metaCheck(query);
  }

  /**
   * 自主学习
   */
  async learn(goal: string): Promise<{ progress: number; learned: string[] }> {
    return this.integratedSystem.learn(goal);
  }

  /**
   * 健康检查
   */
  async checkHealth(): Promise<SystemHealth> {
    return this.integratedSystem.checkHealth();
  }

  /**
   * 运行维护
   */
  async runMaintenance(): Promise<{ cleaned: number; archived: number; synced: number }> {
    return this.integratedSystem.runMaintenance();
  }

  /**
   * 关闭系统
   */
  async shutdown(): Promise<void> {
    await this.integratedSystem.shutdown();
  }
}

// ============ 全局实例 ============

let globalSystem: YuanLingSystem | null = null;

/**
 * 获取全局元灵系统实例
 */
export function getYuanLingSystem(config?: YuanLingSystemConfig): YuanLingSystem {
  if (!globalSystem) {
    globalSystem = new YuanLingSystem(config);
  }
  return globalSystem;
}

/**
 * 快速启动
 */
export async function startup(options: {
  workspaceRoot: string;
  enableIntrospection?: boolean;
}): Promise<{
  introspectionReport?: any;
}> {
  const system = getYuanLingSystem({
    workspaceRoot: options.workspaceRoot,
    enableIntrospection: options.enableIntrospection,
  });
  
  const result = await system.startup();
  return { introspectionReport: result.introspectionReport };
}

/**
 * 快速自省
 */
export async function quickIntrospect(workspaceRoot: string): Promise<{
  hasChanges: boolean;
  changes: string[];
  overallScore?: number;
}> {
  const system = new IntrospectionSystem(workspaceRoot);
  const check = system.quickCheck();
  
  if (check.hasChanges) {
    const report = await system.introspect('startup');
    return {
      hasChanges: true,
      changes: check.changes,
      overallScore: report.currentSnapshot.overallScore,
    };
  }

  return {
    hasChanges: false,
    changes: [],
  };
}

// ============ 版本信息 ============

export const VERSION = '4.3.0';
export const BUILD_DATE = '2026-04-15';
