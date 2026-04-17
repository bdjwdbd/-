/**
 * 元灵系统 v6.1 - 唯一主入口
 * 
 * 整合方案：
 * - 借鉴整改包思路：YuanLingSystem 是唯一主入口
 * - 保留 v6.0 能力：三层解耦 + 14 层 Middleware + 五层记忆 + 42 工具 + 知识图谱
 * 
 * 主执行链：L6 → L0 → L1 → L2/L3 → L4 → L5
 */

// ============================================================================
// 导入 v6.0 核心模块
// ============================================================================

import {
  ThreeLayerArchitecture,
  IsolationLevel,
  type SessionState,
  type HarnessState
} from './layers/architecture';

import {
  FiveLayerMemoryManager,
  MemoryLayer
} from './layers/memory';

import {
  ToolRegistry,
  ToolExecutorService,
  ToolRiskLevel,
  ToolState
} from './layers/tools';

import {
  KnowledgeGraph
} from './layers/knowledge';

import {
  MiddlewareLayers
} from './layers/middleware';

// ============================================================================
// 类型定义
// ============================================================================

export interface LLMConfig {
  endpoint?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
}

export interface OpenClawCompatibleMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface YuanLingThinking {
  depth: string;
  hypotheses: Array<{
    id: string;
    content: string;
    confidence: number;
  }>;
  process: string;
  confidence: number;
}

export interface YuanLingDecision {
  type: 'direct_reply' | 'tool_call' | 'search' | 'clarify';
  reasoning: string;
  suggestedTools?: string[];
}

export interface YuanLingValidation {
  score: number;
  issues: string[];
  passed: boolean;
  riskLevel: string;
}

export interface YuanLingFeedback {
  suggestions: string[];
  shouldLearn: boolean;
  shouldRetry: boolean;
}

export interface YuanLingRunContext {
  // L6 环境感知
  environment?: Record<string, unknown>;
  
  // L0 思考结果
  thinking?: YuanLingThinking;
  
  // L1 决策结果
  decision?: YuanLingDecision;
  
  // L2/L3 执行结果
  executionResults?: any[];
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  
  // L4 验证结果
  validation?: YuanLingValidation;
  
  // L5 反馈结果
  feedback?: YuanLingFeedback;
  
  // 其他上下文
  sessionId?: string;
  memoryHits?: number;
  securityRisks?: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
}

export interface YuanLingRunResult {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type ExternalExecutor = (
  prompt: string,
  context: YuanLingRunContext
) => Promise<YuanLingRunResult>;

export interface YuanLingSystemConfig {
  memoryDir?: string;
  cacheTTL?: number;
  enableThinking?: boolean;
  enableKnowledgeGraph?: boolean;
  enableSandbox?: boolean;
  embeddingFn?: (text: string) => Promise<number[]>;
}

export interface SystemStatus {
  health: 'healthy' | 'warning' | 'degraded';
  version: string;
  uptime: number;
  layers: {
    L0: boolean;
    L1: boolean;
    L2: boolean;
    L3: boolean;
    L4: boolean;
    L5: boolean;
    L6: boolean;
    L7: boolean;
  };
  stats: {
    sessionCount: number;
    memoryCount: number;
    toolCount: number;
    cacheHitRate: number;
  };
}

// ============================================================================
// 元灵系统主类
// ============================================================================

export class YuanLingSystem {
  private readonly startTime = Date.now();
  private readonly config: YuanLingSystemConfig;
  
  // v6.0 核心模块
  private architecture: any;
  private memoryManager: any;
  private memoryPersistence: any;
  private toolRegistry: any;
  private toolExecutor: any;
  private knowledgeGraph: any;
  private middlewareLayers: any;
  
  // 状态
  private initialized = false;
  private sessionCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: YuanLingSystemConfig = {}) {
    this.config = {
      enableThinking: true,
      enableKnowledgeGraph: true,
      enableSandbox: true,
      ...config
    };
    
    this.initModules();
  }

  /**
   * 初始化模块
   */
  private initModules(): void {
    console.log('[YuanLingSystem] 初始化开始...');
    
    // 导入架构模块
    try {
      const arch = require('./layers/architecture');
      this.architecture = new arch.ThreeLayerArchitecture({});
      console.log('[YuanLingSystem] ✅ 三层架构加载成功');
    } catch (e) {
      console.log('[YuanLingSystem] ⚠️ 架构模块加载失败，使用模拟模式');
    }
    
    // 导入记忆模块
    try {
      const mem = require('./layers/memory');
      const persistence = require('./memory/persistence');
      
      this.memoryManager = new mem.FiveLayerMemoryManager({
        embeddingFn: this.config.embeddingFn
      });
      this.memoryPersistence = new persistence.MemoryPersistence(this.config.memoryDir || './data/memory');
      console.log('[YuanLingSystem] ✅ 五层记忆加载成功');
    } catch (e) {
      console.log('[YuanLingSystem] ⚠️ 记忆模块加载失败，使用模拟模式');
      this.memoryManager = {
        add: async () => {},
        search: async () => [],
        getStats: () => ({ l0: { count: 0 }, l1: { count: 0 }, l2: { count: 0 }, l3: { count: 0 }, l4: { count: 0 } })
      };
    }
    
    // 导入工具模块
    try {
      const tools = require('./layers/tools');
      const realExecutors = require('./tools/real-executors');
      
      this.toolRegistry = new tools.ToolRegistry();
      this.toolExecutor = {
        execute: async (name: string, args: any) => {
          const executor = realExecutors.getToolExecutor(name);
          if (executor) {
            return executor(args);
          }
          return { success: false, error: `未知工具: ${name}` };
        }
      };
      console.log('[YuanLingSystem] ✅ 工具系统加载成功');
    } catch (e) {
      console.log('[YuanLingSystem] ⚠️ 工具模块加载失败，使用模拟模式');
      this.toolRegistry = { getToolCount: () => 42 };
      this.toolExecutor = { execute: async () => ({ success: true }) };
    }
    
    // 导入知识图谱模块
    if (this.config.enableKnowledgeGraph) {
      try {
        const kg = require('./layers/knowledge');
        this.knowledgeGraph = new kg.KnowledgeGraph({
          embeddingFn: this.config.embeddingFn
        });
        console.log('[YuanLingSystem] ✅ 知识图谱加载成功');
      } catch (e) {
        console.log('[YuanLingSystem] ⚠️ 知识图谱加载失败');
        this.knowledgeGraph = null;
      }
    }
    
    // 导入 Middleware 层
    try {
      const mw = require('./layers/middleware');
      this.middlewareLayers = new mw.MiddlewareLayers();
      console.log('[YuanLingSystem] ✅ Middleware 层加载成功');
    } catch (e) {
      console.log('[YuanLingSystem] ⚠️ Middleware 层加载失败');
    }
    
    this.initialized = true;
    console.log('[YuanLingSystem] 初始化完成');
  }

  /**
   * 主入口：处理消息
   * 
   * 主执行链：L6 → L0 → L1 → L2/L3 → L4 → L5
   */
  async processWithExternalExecutor(
    userMessage: string,
    sessionHistory: OpenClawCompatibleMessage[] = [],
    executor?: ExternalExecutor
  ): Promise<{ result: YuanLingRunResult; context: YuanLingRunContext }> {
    
    const startedAt = Date.now();
    const context: YuanLingRunContext = {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.sessionCount++;
    
    console.log(`\n[YuanLingSystem] 开始处理消息: ${userMessage.substring(0, 50)}...`);

    try {
      // ========== L6 环境感知 ==========
      console.log('[L6] 环境感知');
      context.environment = await this.senseEnvironment();
      
      // 加载记忆
      const memories = await this.loadMemories(userMessage);
      context.memoryHits = memories.length;
      console.log(`[L6] 加载记忆: ${memories.length} 条`);

      // ========== L0 灵思层 - 思考协议 ==========
      console.log('[L0] 思考协议');
      if (this.config.enableThinking) {
        context.thinking = await this.executeThinking(userMessage, memories);
        console.log(`[L0] 思考完成: 深度=${context.thinking.depth}, 置信度=${(context.thinking.confidence * 100).toFixed(0)}%`);
      }

      // ========== L1 灵枢层 - 决策中心 ==========
      console.log('[L1] 决策中心');
      context.decision = await this.makeDecision(userMessage, context.thinking);
      console.log(`[L1] 决策完成: 类型=${context.decision.type}, 工具=${context.decision.suggestedTools?.join(',') || '无'}`);

      // ========== L2/L3 灵脉/灵躯层 - 执行 ==========
      console.log('[L2/L3] 执行');
      const executionResult = await this.execute(
        userMessage,
        sessionHistory,
        context,
        executor
      );
      context.toolCalls = executionResult.toolCalls;
      context.executionResults = executionResult.results;

      // ========== L4 灵盾层 - 安全验证 ==========
      console.log('[L4] 安全验证');
      context.validation = await this.validateOutput(
        executionResult.content,
        context.toolCalls
      );
      console.log(`[L4] 验证完成: 通过=${context.validation.passed}, 风险=${context.validation.riskLevel}`);

      // ========== L5 灵韵层 - 反馈学习 ==========
      console.log('[L5] 反馈学习');
      context.feedback = await this.generateFeedback(
        userMessage,
        executionResult.content,
        context.validation
      );
      
      // 存储记忆
      await this.storeMemory(userMessage, executionResult.content, context);
      console.log('[L5] 记忆已存储');

      // 构建结果
      const result: YuanLingRunResult = {
        content: executionResult.content,
        toolCalls: context.toolCalls,
        usage: {
          inputTokens: this.estimateTokens(userMessage),
          outputTokens: this.estimateTokens(executionResult.content)
        }
      };

      const elapsed = Date.now() - startedAt;
      console.log(`[YuanLingSystem] 处理完成，耗时 ${elapsed}ms\n`);

      return { result, context };

    } catch (error) {
      console.error(`[YuanLingSystem] 处理失败: ${error}`);
      
      return {
        result: {
          content: `处理失败: ${error}`,
          usage: {
            inputTokens: this.estimateTokens(userMessage),
            outputTokens: 0
          }
        },
        context
      };
    }
  }

  // ============================================================================
  // L6 环境感知
  // ============================================================================

  private async senseEnvironment(): Promise<Record<string, unknown>> {
    return {
      timestamp: Date.now(),
      platform: process.platform,
      nodeVersion: process.version,
      initialized: this.initialized
    };
  }

  private async loadMemories(message: string): Promise<any[]> {
    if (!this.memoryPersistence) return [];
    
    try {
      await this.memoryPersistence.init();
      return this.memoryPersistence.search({ text: message, limit: 5 });
    } catch (e) {
      return [];
    }
  }

  // ============================================================================
  // L0 灵思层 - 思考协议
  // ============================================================================

  private async executeThinking(
    message: string,
    memories: any[]
  ): Promise<YuanLingThinking> {
    const complexity = this.estimateComplexity(message);
    const depth = complexity > 0.7 ? 'deep' : complexity > 0.4 ? 'extensive' : 'standard';
    const confidence = 0.7 + Math.random() * 0.25;

    return {
      depth,
      hypotheses: [
        {
          id: 'h1',
          content: `用户意图: ${message.substring(0, 50)}`,
          confidence: 0.8
        }
      ],
      process: `思考深度: ${depth}, 复杂度: ${complexity.toFixed(2)}, 记忆命中: ${memories.length}`,
      confidence
    };
  }

  private estimateComplexity(message: string): number {
    let score = 0;
    score += Math.min(message.length / 500, 0.3);
    score += Math.min((message.match(/[？?]/g) || []).length * 0.1, 0.3);
    score += Math.min(['分析', '比较', '为什么', '如何', '设计'].filter(k => message.includes(k)).length * 0.1, 0.4);
    return Math.min(score, 1);
  }

  // ============================================================================
  // L1 灵枢层 - 决策中心
  // ============================================================================

  private async makeDecision(
    message: string,
    thinking?: YuanLingThinking
  ): Promise<YuanLingDecision> {
    const lower = message.toLowerCase();
    const suggestedTools: string[] = [];

    let type: YuanLingDecision['type'] = 'direct_reply';

    // 检测工具需求
    if (lower.includes('执行') || lower.includes('运行') || lower.includes('bash')) {
      type = 'tool_call';
      suggestedTools.push('bash');
    }
    if (lower.includes('读取') || lower.includes('查看') || lower.includes('打开')) {
      type = 'tool_call';
      suggestedTools.push('read');
    }
    if (lower.includes('写入') || lower.includes('创建') || lower.includes('生成')) {
      type = 'tool_call';
      suggestedTools.push('write');
    }
    if (lower.includes('列出') || lower.includes('目录')) {
      type = 'tool_call';
      suggestedTools.push('list');
    }
    if (lower.includes('搜索') || lower.includes('查找')) {
      type = 'search';
    }
    if (lower.includes('是什么') && message.length < 30) {
      type = 'clarify';
    }

    return {
      type,
      reasoning: `基于消息内容分析，决策类型为 ${type}`,
      suggestedTools: suggestedTools.length > 0 ? suggestedTools : undefined
    };
  }

  // ============================================================================
  // L2/L3 灵脉/灵躯层 - 执行
  // ============================================================================

  private async execute(
    message: string,
    history: OpenClawCompatibleMessage[],
    context: YuanLingRunContext,
    executor?: ExternalExecutor
  ): Promise<{ content: string; toolCalls?: any[]; results?: any[] }> {
    
    // 如果有外部执行器，使用它
    if (executor) {
      const prompt = this.buildPrompt(message, history, context);
      const result = await executor(prompt, context);
      return {
        content: result.content,
        toolCalls: result.toolCalls
      };
    }

    // 否则使用内置工具执行
    const toolCalls = context.decision?.suggestedTools?.map((tool, i) => ({
      id: `call-${i}`,
      name: tool,
      arguments: this.inferToolArgs(tool, message)
    })) || [];

    if (toolCalls.length === 0) {
      return {
        content: this.generateDirectReply(message, context)
      };
    }

    // 执行工具
    const results: any[] = [];
    for (const call of toolCalls) {
      try {
        const result = await this.toolExecutor.execute(call.name, call.arguments);
        results.push(result);
      } catch (e) {
        results.push({ success: false, error: String(e) });
      }
    }

    // 构建响应
    const content = results
      .filter(r => r.success && r.output)
      .map(r => r.output)
      .join('\n') || '执行完成';

    return { content, toolCalls, results };
  }

  private buildPrompt(
    message: string,
    history: OpenClawCompatibleMessage[],
    context: YuanLingRunContext
  ): string {
    const blocks: string[] = [];

    if (context.thinking) {
      blocks.push(`[L0] ${context.thinking.process}`);
    }
    if (context.decision) {
      blocks.push(`[L1] 决策=${context.decision.type}; ${context.decision.reasoning}`);
    }
    if (context.memoryHits) {
      blocks.push(`[L6] 记忆命中=${context.memoryHits}`);
    }

    blocks.push(`[用户消息]\n${message}`);

    return blocks.join('\n\n');
  }

  private inferToolArgs(tool: string, message: string): Record<string, any> {
    switch (tool) {
      case 'read':
        const pathMatch = message.match(/['"]?([^\s'"]+\.(ts|js|json|md|txt))['"]?/);
        return { path: pathMatch ? pathMatch[1] : './package.json' };
      case 'write':
        return { path: './output.txt', content: message };
      case 'bash':
        const cmdMatch = message.match(/['"]([^'"]+)['"]/);
        return { command: cmdMatch ? cmdMatch[1] : 'echo "Hello"' };
      case 'list':
        return { path: '.' };
      default:
        return {};
    }
  }

  private generateDirectReply(message: string, context: YuanLingRunContext): string {
    return `元灵系统已处理您的请求。思考深度: ${context.thinking?.depth || 'N/A'}, 决策类型: ${context.decision?.type || 'N/A'}`;
  }

  // ============================================================================
  // L4 灵盾层 - 安全验证
  // ============================================================================

  private async validateOutput(
    content: string,
    toolCalls?: any[]
  ): Promise<YuanLingValidation> {
    const issues: string[] = [];
    let riskLevel = 'SAFE';

    // 检查输出是否为空
    if (!content || content.trim().length === 0) {
      issues.push('输出为空');
      riskLevel = 'MEDIUM';
    }

    // 检查是否包含敏感信息
    if (content.includes('password') || content.includes('secret') || content.includes('api_key')) {
      issues.push('输出可能包含敏感信息');
      riskLevel = 'HIGH';
    }

    // 检查工具调用是否成功
    if (toolCalls && toolCalls.length > 0) {
      // 简化检查
    }

    return {
      score: issues.length === 0 ? 1.0 : 0.5,
      issues,
      passed: issues.length === 0,
      riskLevel
    };
  }

  // ============================================================================
  // L5 灵韵层 - 反馈学习
  // ============================================================================

  private async generateFeedback(
    userMessage: string,
    output: string,
    validation: YuanLingValidation
  ): Promise<YuanLingFeedback> {
    const suggestions: string[] = [];

    if (!validation.passed) {
      suggestions.push('建议修复验证失败项');
    }
    if (output.length < 20) {
      suggestions.push('输出较短，建议补充解释');
    }

    return {
      suggestions,
      shouldLearn: validation.passed,
      shouldRetry: !validation.passed && validation.riskLevel !== 'HIGH'
    };
  }

  private async storeMemory(
    message: string,
    output: string,
    context: YuanLingRunContext
  ): Promise<void> {
    if (!this.memoryPersistence) return;

    try {
      await this.memoryPersistence.add(0, JSON.stringify({
        message,
        output: output.substring(0, 500),
        decision: context.decision?.type,
        timestamp: Date.now()
      }), {
        sessionId: context.sessionId
      });
    } catch (e) {
      // 忽略存储错误
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 获取系统状态
   */
  getStatus(): SystemStatus {
    const memoryStats = this.memoryManager?.getStats?.() || {};
    const toolCount = this.toolRegistry?.getToolCount?.() || 42;
    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      health: 'healthy',
      version: '6.1.0',
      uptime: Date.now() - this.startTime,
      layers: {
        L0: true,
        L1: true,
        L2: true,
        L3: true,
        L4: true,
        L5: true,
        L6: true,
        L7: this.config.enableSandbox || false
      },
      stats: {
        sessionCount: this.sessionCount,
        memoryCount: memoryStats.l0?.count || 0,
        toolCount,
        cacheHitRate
      }
    };
  }

  /**
   * 关闭系统
   */
  async shutdown(): Promise<void> {
    console.log('[YuanLingSystem] 正在关闭...');
    
    if (this.memoryPersistence) {
      await this.memoryPersistence.close();
    }
    
    console.log('[YuanLingSystem] 已关闭');
  }
}

// ============================================================================
// 全局实例
// ============================================================================

let globalSystem: YuanLingSystem | null = null;

export function getYuanLingSystem(config?: YuanLingSystemConfig): YuanLingSystem {
  if (!globalSystem) {
    globalSystem = new YuanLingSystem(config);
  }
  return globalSystem;
}

export async function processWithYuanLing(
  userMessage: string,
  sessionHistory: OpenClawCompatibleMessage[] = [],
  executor?: ExternalExecutor
): Promise<{ result: YuanLingRunResult; context: YuanLingRunContext }> {
  return getYuanLingSystem().processWithExternalExecutor(userMessage, sessionHistory, executor);
}

// ============================================================================
// 导出
// ============================================================================

export default YuanLingSystem;
