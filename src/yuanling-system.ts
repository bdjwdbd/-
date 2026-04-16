/**
 * 元灵系统 v4.9.0 - 统一主入口（全智能版）
 * 
 * 这是系统的唯一主入口，整合所有层级和模块：
 * - L0 灵思层（思考协议）
 * - L1 灵枢层（决策中心）
 * - L2 灵脉层（执行引擎）
 * - L3 灵躯层（工具执行）
 * - L4 灵盾层（安全验证）
 * - L5 灵韵层（反馈调节）
 * - L6 灵识层（环境感知）
 * 
 * 新增模块（已完整集成）：
 * - Harness Engineering（状态管理、追踪、沙盒、度量）
 * - Dashboard（可视化监控）
 * - Multi-Agent（多 Agent 协作）
 * - NL-Programming（自然语言编程）
 * - Edge Computing（边缘计算）
 * - Federated Learning（联邦学习）
 * - Intelligence System（全智能系统）← 新增
 * 
 * 核心模块（已完整集成）：
 * - HNSW Index（向量索引）
 * - Vector Quantizer（向量量化）
 * - Health Monitor（健康监控）
 * - Hybrid Search Engine（混合搜索）
 * - Smart Memory Upgrader（智能记忆升级）
 * - Persona Manager（用户画像）
 * 
 * 架构原则：
 * - YuanLingSystem 是唯一主入口
 * - OpenClawBridge 是薄适配器，委托给本系统
 * - 所有模块通过统一接口访问
 */

import { quickThink, L0Manager, getL0Manager } from './l0-integration';
import { SimpleIntrospection } from './introspection/simple-tracker';
import { IntrospectionSystem } from './introspection';
import { IntegratedSystem, SystemHealth } from './integrated-system';
import { PerformanceMonitor, StructuredLogger } from './infrastructure/index';

// Darwin Skill 机制（L5 灵韵层增强）
import { 
  RatchetManager, 
  IndependentEvaluator, 
  ResultCardGenerator,
  TestPromptFramework,
  EvaluationResult,
  CardTheme
} from './layers/ling-yun';

// ============ 新模块导入 ============

// Harness Engineering
import { 
  HarnessSystem, 
  StateCategory, 
  TraceCollector,
  PPAFEngine,
  SandboxManager,
  RiskLevel,
  MetricsCollector as HarnessMetricsCollector,
  EvolutionEngine,
  // 新增模块
  RalphLoop,
  createRalphLoop,
  CommonCriteria,
  REPLContainer,
  createREPLContainer,
  CommonInterceptors,
  TokenPipeline,
  createTokenPipeline,
  estimateTokens,
  EntropyGovernor,
  createEntropyGovernor,
} from './harness';

// Dashboard
import { DashboardServer, createDashboard } from './dashboard';

// Multi-Agent
import { Coordinator, createCoordinator, TaskPriority } from './multi-agent';

// NL-Programming
import { NaturalLanguageParser, createParser, ParsedIntentType } from './nl-programming';

// Edge Computing
import { EdgeRuntime, createEdgeRuntime, EdgeNodeType } from './edge';

// Federated Learning
import { 
  FederatedEngine, 
  createFederatedEngine, 
  FederatedRole,
  AggregationStrategy as FederatedAggregationStrategy,
  PrivacyStrategy,
} from './federated';

// 核心模块
import { HNSWIndex } from './core/hnsw-index';
import { VectorQuantizer } from './core/vector-quantizer';
import { HealthMonitor } from './core/health-monitor';
import { HybridSearchEngine } from './core/hybrid-search-engine';
import { SmartMemoryUpgrader } from './core/smart-memory-upgrader';
import { PersonaManager } from './core/persona-manager';

// 智能系统
import {
  IntelligenceSystem,
  IntelligenceResult,
  createIntelligenceSystem,
} from './intelligence';

// L4 灵盾层
import { 
  ToolExecutionGuard, 
  ToolExecutionContext,
  ToolExecutionResult,
  GuardConfig,
} from './layers/ling-dun';

// 错误处理
import {
  YuanLingError,
  ErrorCode,
  ErrorLayer,
  ErrorHandler,
  getErrorHandler,
  handleError,
  L0Error,
  L1Error,
  L2Error,
  L3Error,
  L4Error,
  L5Error,
  L6Error,
  SystemError,
  ModuleError,
} from './error-handling';

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

// ============ P2：上下文传递增强 ============
export interface ProcessingContext {
  thinking?: ThinkingResult;
  decision?: DecisionResult;
  validation?: ValidationResult;
  feedback?: FeedbackResult;
  // P0-1：智能系统结果
  intelligence?: IntelligenceResult;
  // P1-2：工具调用结果
  toolResults?: Array<{
    name: string;
    score: number;
    status: 'available' | 'called' | 'failed';
    result?: any;
    error?: string;
  }>;
  // P1-3：Skill 调用结果
  skillResults?: Array<{
    name: string;
    score: number;
    status: 'available' | 'called' | 'failed';
    result?: any;
    error?: string;
  }>;
  // P2：性能指标
  performance?: {
    l0l1Latency?: number;
    l2l3Latency?: number;
    l4Latency?: number;
    totalLatency?: number;
  };
}

// ============ 系统配置 ============

export interface YuanLingSystemConfig {
  workspaceRoot?: string;
  memoryDir?: string;
  enableL0?: boolean;
  enableIntrospection?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  // P1-1：智能路由置信度阈值
  intentConfidenceThreshold?: number;
  // P2-1：请求去重
  enableRequestDeduplication?: boolean;
  // P2-2：流式响应
  enableStreamingResponse?: boolean;
  // P1-2：超时控制
  requestTimeoutMs?: number;
  // P1-3：重试机制
  maxRetries?: number;
  retryDelayMs?: number;
  // P2-1：熔断机制
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  // P2-2：限流机制
  enableRateLimiter?: boolean;
  maxRequestsPerMinute?: number;
}

const DEFAULT_CONFIG: Required<YuanLingSystemConfig> = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  memoryDir: './memory',
  enableL0: true,
  enableIntrospection: true,
  logLevel: 'info',
  intentConfidenceThreshold: 0.8,
  enableRequestDeduplication: true,
  enableStreamingResponse: false,
  requestTimeoutMs: 30000, // P1-2：默认 30 秒超时
  maxRetries: 2, // P1-3：默认最多重试 2 次
  retryDelayMs: 1000, // P1-3：默认重试间隔 1 秒
  enableCircuitBreaker: true, // P2-1：默认启用熔断
  circuitBreakerThreshold: 5, // P2-1：默认 5 次失败后熔断
  enableRateLimiter: true, // P2-2：默认启用限流
  maxRequestsPerMinute: 60, // P2-2：默认每分钟 60 个请求
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

  // Darwin Skill 机制实例
  private ratchetManager: RatchetManager;
  private independentEvaluator: IndependentEvaluator;
  private resultCardGenerator: ResultCardGenerator;
  private testPromptFramework: TestPromptFramework;

  // ============ 新模块实例 ============
  
  // Harness Engineering
  private _harnessSystem?: HarnessSystem;
  
  // 新增 Harness 模块
  private _ralphLoop?: RalphLoop;
  private _replContainer?: REPLContainer;
  private _tokenPipeline?: TokenPipeline;
  private _entropyGovernor?: EntropyGovernor;
  
  // Dashboard
  private _dashboard?: DashboardServer;
  
  // Multi-Agent
  private _coordinator?: Coordinator;
  
  // NL-Programming
  private _parser?: NaturalLanguageParser;
  
  // Edge Computing
  private _edgeRuntime?: EdgeRuntime;
  
  // Federated Learning
  private _federatedEngine?: FederatedEngine;
  
  // 智能系统
  private _intelligenceSystem?: IntelligenceSystem;
  
  // 模块检查缓存（修复问题5）
  private _moduleCheckCache?: boolean;
  
  // 优化5：增强提示缓存
  private _promptCache: Map<string, { prompt: string; timestamp: number }> = new Map();
  private readonly PROMPT_CACHE_TTL = 60000; // 1 分钟
  
  // P2-3：智能系统结果缓存
  private _intelligenceCache: Map<string, { result: IntelligenceResult; timestamp: number }> = new Map();
  private readonly INTELLIGENCE_CACHE_TTL = 30000; // 30 秒
  
  // 优化4：性能监控采样率
  private _perfSampleRate: number = 0.1; // 10% 采样
  
  // 优化3：日志级别
  private _logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  
  // 核心模块
  private _hnswIndex?: HNSWIndex;
  private _vectorQuantizer?: VectorQuantizer;
  private _healthMonitor?: HealthMonitor;
  private _hybridSearchEngine?: HybridSearchEngine;
  private _smartMemoryUpgrader?: SmartMemoryUpgrader;
  private _personaManager?: PersonaManager;
  
  // L4 灵盾层
  private _toolExecutionGuard?: ToolExecutionGuard;
  
  // 错误处理器
  private _errorHandler?: ErrorHandler;

  /** 获取 L0 思考协议管理器 */
  get l0Manager(): L0Manager {
    return this._l0Manager;
  }
  
  /** 获取智能系统 */
  get intelligence(): IntelligenceSystem {
    if (!this._intelligenceSystem) {
      this._intelligenceSystem = createIntelligenceSystem();
    }
    return this._intelligenceSystem;
  }
  
  /**
   * P2-3：智能系统分析（带缓存）
   */
  private async analyzeWithCache(message: string): Promise<IntelligenceResult> {
    // 检查缓存
    const cacheKey = message.substring(0, 100); // 使用前 100 字符作为 key
    const cached = this._intelligenceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.INTELLIGENCE_CACHE_TTL) {
      this.logDebug(`[智能系统] 使用缓存结果`);
      return cached.result;
    }
    
    // 执行分析
    const result = await this.intelligence.analyze(message);
    
    // 存入缓存
    this._intelligenceCache.set(cacheKey, { result, timestamp: Date.now() });
    
    // 清理过期缓存
    if (this._intelligenceCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this._intelligenceCache.entries()) {
        if (now - value.timestamp > this.INTELLIGENCE_CACHE_TTL) {
          this._intelligenceCache.delete(key);
        }
      }
    }
    
    return result;
  }
  
  /**
   * 优化3：日志级别控制
   */
  private logDebug(message: string): void {
    if (this._logLevel === 'debug') {
      console.log(message);
    }
  }
  
  private logInfo(message: string): void {
    if (this._logLevel === 'debug' || this._logLevel === 'info') {
      console.log(message);
    }
  }
  
  private logWarn(message: string): void {
    if (this._logLevel !== 'error') {
      console.warn(message);
    }
  }
  
  private logError(message: string): void {
    console.error(message);
  }
  
  /**
   * 优化4：性能监控采样
   */
  private recordPerformanceWithSampling(metric: string, value: number, tags?: Record<string, string>): void {
    if (Math.random() < this._perfSampleRate) {
      this.performanceMonitor.record(metric, value, tags);
    }
  }
  
  /**
   * P1-2：会话历史独立处理
   */
  private processSessionHistory(sessionHistory: Message[]): string {
    if (!sessionHistory || sessionHistory.length === 0) {
      return '';
    }
    
    const recentHistory = sessionHistory.slice(-5); // 最近 5 条
    return recentHistory.map(m => `[${m.role}] ${m.content?.substring(0, 100) || ''}`).join('\n');
  }
  
  /**
   * P2-1：请求去重
   */
  private _requestCache: Map<string, { result: any; timestamp: number }> = new Map();
  private readonly REQUEST_CACHE_TTL = 5000; // 5 秒
  
  private checkRequestDuplication(userMessage: string): {
    isDuplicate: boolean;
    cachedResult?: any;
  } {
    const cacheKey = userMessage.substring(0, 100);
    const cached = this._requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.REQUEST_CACHE_TTL) {
      return { isDuplicate: true, cachedResult: cached.result };
    }
    
    return { isDuplicate: false };
  }
  
  private cacheRequestResult(userMessage: string, result: any): void {
    const cacheKey = userMessage.substring(0, 100);
    this._requestCache.set(cacheKey, { result, timestamp: Date.now() });
    
    // 清理过期缓存
    if (this._requestCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of this._requestCache.entries()) {
        if (now - value.timestamp > this.REQUEST_CACHE_TTL) {
          this._requestCache.delete(key);
        }
      }
    }
  }

  // ============ P1-2/P1-3/P2-1/P2-2：健壮性机制 ============
  
  // P2-1：熔断器状态
  private _circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private _circuitBreakerFailures: number = 0;
  private _circuitBreakerLastFailure: number = 0;
  
  // P2-2：限流器状态
  private _rateLimiterRequests: number[] = [];
  
  /**
   * P1-2：超时控制
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`${operation} 超时 (${timeoutMs}ms)`)), timeoutMs)
      ),
    ]);
  }
  
  /**
   * P1-3：重试机制
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const maxRetries = this.config.maxRetries;
    const retryDelayMs = this.config.retryDelayMs;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          this.logWarn(`[${operationName}] 第 ${attempt + 1} 次尝试失败，${retryDelayMs}ms 后重试: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * P2-1：熔断器检查
   */
  private checkCircuitBreaker(): boolean {
    if (!this.config.enableCircuitBreaker) {
      return true; // 未启用熔断，允许通过
    }
    
    const now = Date.now();
    
    // 熔断器打开状态
    if (this._circuitBreakerState === 'open') {
      // 检查是否可以进入半开状态（30 秒后）
      if (now - this._circuitBreakerLastFailure > 30000) {
        this._circuitBreakerState = 'half-open';
        this.logInfo(`[熔断器] 进入半开状态，尝试恢复`);
        return true;
      }
      return false; // 仍在熔断中
    }
    
    return true;
  }
  
  /**
   * P2-1：记录熔断器成功
   */
  private recordCircuitBreakerSuccess(): void {
    if (this._circuitBreakerState === 'half-open') {
      this._circuitBreakerState = 'closed';
      this._circuitBreakerFailures = 0;
      this.logInfo(`[熔断器] 恢复正常，关闭熔断器`);
    }
  }
  
  /**
   * P2-1：记录熔断器失败
   */
  private recordCircuitBreakerFailure(): void {
    this._circuitBreakerFailures++;
    this._circuitBreakerLastFailure = Date.now();
    
    if (this._circuitBreakerFailures >= this.config.circuitBreakerThreshold) {
      this._circuitBreakerState = 'open';
      this.logWarn(`[熔断器] 连续失败 ${this._circuitBreakerFailures} 次，打开熔断器`);
    }
  }
  
  /**
   * P2-2：限流器检查
   */
  private checkRateLimiter(): boolean {
    if (!this.config.enableRateLimiter) {
      return true; // 未启用限流，允许通过
    }
    
    const now = Date.now();
    const windowStart = now - 60000; // 1 分钟窗口
    
    // 清理过期的请求记录
    this._rateLimiterRequests = this._rateLimiterRequests.filter(t => t > windowStart);
    
    // 检查是否超过限制
    if (this._rateLimiterRequests.length >= this.config.maxRequestsPerMinute) {
      this.logWarn(`[限流器] 请求超过限制 (${this.config.maxRequestsPerMinute}/min)`);
      return false;
    }
    
    // 记录本次请求
    this._rateLimiterRequests.push(now);
    return true;
  }
  
  /**
   * 优化1/2：Skill 实际执行
   */
  private async executeSkill(
    skill: any,
    userMessage: string,
    context: ProcessingContext
  ): Promise<any> {
    // 检查 Skill 是否有执行方法
    if (skill.execute && typeof skill.execute === 'function') {
      return await skill.execute(userMessage, context);
    }
    
    // 检查 Skill 是否有 handler 方法
    if (skill.handler && typeof skill.handler === 'function') {
      return await skill.handler(userMessage, context);
    }
    
    // 检查 Skill 是否有 run 方法
    if (skill.run && typeof skill.run === 'function') {
      return await skill.run(userMessage, context);
    }
    
    // 默认返回 Skill 信息
    return {
      name: skill.name,
      description: skill.description,
      status: 'skill_ready',
    };
  }
  
  /**
   * 优化5：请求优先级管理
   */
  private _requestPriorityQueue: Array<{
    message: string;
    priority: 'high' | 'normal' | 'low';
    timestamp: number;
  }> = [];
  
  private getRequestPriority(message: string): 'high' | 'normal' | 'low' {
    const lowerMessage = message.toLowerCase();
    
    // 高优先级关键词
    if (lowerMessage.includes('紧急') || 
        lowerMessage.includes('urgent') ||
        lowerMessage.includes('立即') ||
        lowerMessage.includes('马上')) {
      return 'high';
    }
    
    // 低优先级关键词
    if (lowerMessage.includes('稍后') ||
        lowerMessage.includes('待会') ||
        lowerMessage.includes('不急')) {
      return 'low';
    }
    
    return 'normal';
  }
  
  /**
   * 优化6：请求取消机制
   */
  private _activeRequests: Map<string, AbortController> = new Map();
  
  createAbortableRequest(requestId: string): AbortController {
    const controller = new AbortController();
    this._activeRequests.set(requestId, controller);
    return controller;
  }
  
  cancelRequest(requestId: string): boolean {
    const controller = this._activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this._activeRequests.delete(requestId);
      this.logInfo(`[取消] 请求 ${requestId} 已取消`);
      return true;
    }
    return false;
  }
  
  cleanupRequest(requestId: string): void {
    this._activeRequests.delete(requestId);
  }

  // ============ 新模块访问器 ============
  
  /** 获取 Harness 系统 */
  get harness(): HarnessSystem | undefined {
    return this._harnessSystem;
  }
  
  /** 获取 Dashboard */
  get dashboard(): DashboardServer | undefined {
    return this._dashboard;
  }
  
  /** 获取 Ralph Loop */
  get ralphLoop(): RalphLoop | undefined {
    return this._ralphLoop;
  }
  
  /** 获取 REPL 容器 */
  get replContainer(): REPLContainer | undefined {
    return this._replContainer;
  }
  
  /** 获取 Token 流水线 */
  get tokenPipeline(): TokenPipeline | undefined {
    return this._tokenPipeline;
  }
  
  /** 获取熵治理器 */
  get entropyGovernor(): EntropyGovernor | undefined {
    return this._entropyGovernor;
  }
  
  /** 获取 Multi-Agent 协调器 */
  get coordinator(): Coordinator | undefined {
    return this._coordinator;
  }
  
  /** 获取自然语言解析器 */
  get parser(): NaturalLanguageParser | undefined {
    return this._parser;
  }
  
  /** 获取边缘运行时 */
  get edgeRuntime(): EdgeRuntime | undefined {
    return this._edgeRuntime;
  }
  
  /** 获取联邦学习引擎 */
  get federatedEngine(): FederatedEngine | undefined {
    return this._federatedEngine;
  }
  
  /** 获取 HNSW 索引 */
  get hnswIndex(): HNSWIndex | undefined {
    return this._hnswIndex;
  }
  
  /** 获取混合搜索引擎 */
  get hybridSearchEngine(): HybridSearchEngine | undefined {
    return this._hybridSearchEngine;
  }
  
  /** 获取用户画像管理器 */
  get personaManager(): PersonaManager | undefined {
    return this._personaManager;
  }
  
  /** 获取工具执行守卫（L4 灵盾层） */
  get toolExecutionGuard(): ToolExecutionGuard | undefined {
    return this._toolExecutionGuard;
  }
  
  /** 获取错误处理器 */
  get errorHandler(): ErrorHandler {
    if (!this._errorHandler) {
      this._errorHandler = getErrorHandler({
        enableLogging: true,
        enableRecovery: true,
      });
    }
    return this._errorHandler;
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
    
    // 初始化 Darwin Skill 机制
    this.ratchetManager = new RatchetManager({
      enabled: true,
      autoCommit: false, // 默认禁用自动 commit
      autoRevert: true,
    }, this.config.workspaceRoot);
    
    this.independentEvaluator = new IndependentEvaluator({
      useSubAgent: false, // 默认禁用子 Agent
      allowDryRun: true,
    }, this.config.workspaceRoot);
    
    this.resultCardGenerator = new ResultCardGenerator({
      usePlaywright: false,
    }, this.config.workspaceRoot);
    
    this.testPromptFramework = new TestPromptFramework({}, this.config.workspaceRoot);
    
    // 共享 PerformanceMonitor 到 IntegratedSystem
    this.integratedSystem.setPerformanceMonitor(this.performanceMonitor);
    
    // 初始化核心模块
    this._hnswIndex = new HNSWIndex({ dimensions: 128 });
    this._vectorQuantizer = new VectorQuantizer({ type: 'fp16', dimensions: 128 });
    this._healthMonitor = new HealthMonitor({ checkInterval: 60000 });
    this._hybridSearchEngine = new HybridSearchEngine({});
    this._smartMemoryUpgrader = new SmartMemoryUpgrader({});
    this._personaManager = new PersonaManager({});
    
    // 初始化自然语言解析器
    this._parser = createParser();
    
    // 初始化 L4 灵盾层
    this._toolExecutionGuard = new ToolExecutionGuard({
      enableLoopDetection: true,
      enableOutputTruncation: true,
      enableForceInterrupt: true,
      maxCallsPerSession: 1000,
      maxSessionDurationMs: 600000,
    });
  }

  // ============ 模块初始化方法 ============
  
  /**
   * 初始化 Harness 系统
   */
  async initializeHarness(options?: {
    enableStateManager?: boolean;
    enableTracing?: boolean;
    enableAudit?: boolean;
  }): Promise<HarnessSystem> {
    const startTime = Date.now();
    
    if (this._harnessSystem) {
      return this._harnessSystem;
    }
    
    this._harnessSystem = new HarnessSystem({
      workspaceRoot: this.config.workspaceRoot,
      enableStateManager: options?.enableStateManager ?? true,
      enableTracing: options?.enableTracing ?? true,
      enableAudit: options?.enableAudit ?? true,
    });
    
    await this._harnessSystem.initialize();
    console.log('[YuanLing] Harness 系统已初始化');
    
    // 记录性能
    this.recordModuleOperation('harness', Date.now() - startTime);
    
    return this._harnessSystem;
  }
  
  /** 获取 Dashboard（自动初始化） */
  get dashboard(): DashboardServer | undefined {
    return this._dashboard;
  }
  
  /** 获取 Dashboard（自动初始化） */
  async getDashboardAsync(port: number = 3000): Promise<DashboardServer> {
    if (!this._dashboard) {
      await this.initializeDashboard(port);
    }
    return this._dashboard!;
  }
  
  /**
   * 初始化 Dashboard
   */
  async initializeDashboard(port: number = 3000): Promise<DashboardServer> {
    const startTime = Date.now();
    
    if (this._dashboard) {
      return this._dashboard;
    }
    
    if (!this._harnessSystem) {
      await this.initializeHarness();
    }
    
    this._dashboard = await createDashboard(this._harnessSystem!, { port });
    console.log(`[YuanLing] Dashboard 已启动: http://localhost:${port}`);
    
    // 记录性能
    this.recordModuleOperation('dashboard', Date.now() - startTime);
    
    return this._dashboard;
  }
  
  /** 获取 Multi-Agent 协调器（自动初始化） */
  async getCoordinatorAsync(): Promise<Coordinator> {
    if (!this._coordinator) {
      this.initializeCoordinator();
    }
    return this._coordinator!;
  }
  
  /**
   * 初始化 Multi-Agent 协调器
   */
  initializeCoordinator(): Coordinator {
    const startTime = Date.now();
    
    if (this._coordinator) {
      return this._coordinator;
    }
    
    this._coordinator = createCoordinator();
    console.log('[YuanLing] Multi-Agent 协调器已初始化');
    
    // 记录性能
    this.recordModuleOperation('multi-agent', Date.now() - startTime);
    
    return this._coordinator;
  }
  
  /** 获取边缘运行时（自动初始化） */
  async getEdgeRuntimeAsync(nodeType?: EdgeNodeType): Promise<EdgeRuntime> {
    if (!this._edgeRuntime) {
      await this.initializeEdgeRuntime(nodeType);
    }
    return this._edgeRuntime!;
  }
  
  /**
   * 初始化边缘运行时
   */
  async initializeEdgeRuntime(nodeType: EdgeNodeType = EdgeNodeType.EDGE_SERVER): Promise<EdgeRuntime> {
    const startTime = Date.now();
    
    if (this._edgeRuntime) {
      return this._edgeRuntime;
    }
    
    this._edgeRuntime = createEdgeRuntime({
      nodeId: `edge_${Date.now()}`,
      name: 'YuanLing Edge Node',
      type: nodeType,
    });
    
    await this._edgeRuntime.start();
    console.log('[YuanLing] 边缘运行时已启动');
    
    // 记录性能
    this.recordModuleOperation('edge', Date.now() - startTime);
    
    return this._edgeRuntime;
  }
  
  /** 获取联邦学习引擎（自动初始化） */
  async getFederatedEngineAsync(role?: FederatedRole): Promise<FederatedEngine> {
    if (!this._federatedEngine) {
      await this.initializeFederatedEngine(role);
    }
    return this._federatedEngine!;
  }
  
  /**
   * 初始化联邦学习引擎
   */
  async initializeFederatedEngine(role: FederatedRole = FederatedRole.SERVER): Promise<FederatedEngine> {
    const startTime = Date.now();
    
    if (this._federatedEngine) {
      return this._federatedEngine;
    }
    
    this._federatedEngine = createFederatedEngine({
      nodeId: `federated_${Date.now()}`,
      role,
    });
    
    await this._federatedEngine.initialize();
    console.log('[YuanLing] 联邦学习引擎已初始化');
    
    // 记录性能
    this.recordModuleOperation('federated', Date.now() - startTime);
    
    return this._federatedEngine;
  }
  
  // ============ 新增 Harness 模块初始化 ============
  
  /**
   * 初始化 Ralph Loop（强制迭代循环）
   */
  initializeRalphLoop(config?: {
    maxIterations?: number;
    autoDowngrade?: boolean;
    timeout?: number;
  }): RalphLoop {
    if (this._ralphLoop) {
      return this._ralphLoop;
    }
    
    this._ralphLoop = createRalphLoop({
      maxIterations: config?.maxIterations || 5,
      autoDowngrade: config?.autoDowngrade ?? true,
      timeout: config?.timeout || 60000,
    });
    
    console.log('[YuanLing] Ralph Loop 已初始化');
    return this._ralphLoop;
  }
  
  /**
   * 初始化 REPL 容器（带边界控制的执行容器）
   */
  initializeREPLContainer(config?: {
    maxLoops?: number;
    timeout?: number;
  }): REPLContainer {
    if (this._replContainer) {
      return this._replContainer;
    }
    
    this._replContainer = createREPLContainer({
      maxLoops: config?.maxLoops || 10,
      timeout: config?.timeout || 30000,
    });
    
    console.log('[YuanLing] REPL 容器已初始化');
    return this._replContainer;
  }
  
  /**
   * 初始化 Token 流水线（Token 治理）
   */
  initializeTokenPipeline(config?: {
    maxTokens?: number;
    windowSize?: number;
  }): TokenPipeline {
    if (this._tokenPipeline) {
      return this._tokenPipeline;
    }
    
    this._tokenPipeline = createTokenPipeline({
      maxTokens: config?.maxTokens || 4000,
      windowSize: config?.windowSize || 10,
    });
    
    console.log('[YuanLing] Token 流水线已初始化');
    return this._tokenPipeline;
  }
  
  /**
   * 初始化熵治理器（技术债务清理）
   */
  initializeEntropyGovernor(config?: {
    entropyThreshold?: number;
    autoCleanup?: boolean;
  }): EntropyGovernor {
    if (this._entropyGovernor) {
      return this._entropyGovernor;
    }
    
    this._entropyGovernor = createEntropyGovernor({
      entropyThreshold: config?.entropyThreshold || 0.7,
      autoCleanup: config?.autoCleanup ?? false,
    });
    
    console.log('[YuanLing] 熵治理器已初始化');
    return this._entropyGovernor;
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

    // 优化1：并行初始化（启动时间减少 50%）
    const initStart = Date.now();
    
    const [, integratedSystem] = await Promise.all([
      // 并行初始化集成系统
      this.integratedSystem.initialize(),
      // 并行健康检查
      this.integratedSystem.checkHealth(),
    ]);
    
    // 并行初始化新模块（同步操作，但可以并行）
    await Promise.all([
      Promise.resolve(this.initializeRalphLoop()),
      Promise.resolve(this.initializeREPLContainer()),
      Promise.resolve(this.initializeTokenPipeline()),
      Promise.resolve(this.initializeEntropyGovernor()),
    ]);
    console.log('[YuanLing] 新模块已自动初始化');
    
    // 初始化智能系统
    if (!this._intelligenceSystem) {
      this._intelligenceSystem = createIntelligenceSystem();
      console.log('[YuanLing] 智能系统已初始化');
      
      // 优化3：智能系统预热（首次响应更快）
      this.warmupIntelligenceSystem();
      
      // P2-4：完善模块预热
      this.warmupAllModules();
    }
    
    // 优化1：异步检查未集成模块（不阻塞启动）
    setImmediate(() => this.checkUnintegratedModules());
    
    // 优化6：启动模块健康检查（定期检查）
    this.startModuleHealthCheck();
    
    console.log(`[YuanLing] 初始化耗时: ${Date.now() - initStart}ms`);

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
  
  /**
   * 优化3：智能系统预热
   * 
   * 预热常用意图，使首次响应更快
   */
  private warmupIntelligenceSystem(): void {
    // 异步预热，不阻塞启动
    setImmediate(async () => {
      try {
        const commonIntents = ['搜索', '创建', '分析', '监控', '执行'];
        for (const intent of commonIntents) {
          await this._intelligenceSystem?.analyze(intent);
        }
        this.logDebug('[YuanLing] 智能系统预热完成');
      } catch (error) {
        // 忽略预热错误
      }
    });
  }
  
  /**
   * P2-4：模块预热完善
   * 
   * 预热所有关键模块，使首次响应更快
   */
  private warmupAllModules(): void {
    setImmediate(async () => {
      try {
        // 预热智能系统
        const commonIntents = ['搜索', '创建', '分析', '监控', '执行'];
        for (const intent of commonIntents) {
          await this._intelligenceSystem?.analyze(intent);
        }
        
        // 预热记忆搜索
        await this.integratedSystem.searchMemory('预热查询', { limit: 1 });
        
        // 预热 L0 思考
        await this.think('预热思考', undefined);
        
        // 预热 L1 决策
        await this.makeDecision('预热决策', null, undefined);
        
        this.logDebug('[YuanLing] 所有模块预热完成');
      } catch (error) {
        // 忽略预热错误
      }
    });
  }
  
  /**
   * 优化6：启动模块健康检查
   * 
   * 定期检查模块健康状态，发现异常及时告警
   */
  private _healthCheckInterval?: ReturnType<typeof setInterval>;
  
  private startModuleHealthCheck(): void {
    // 每 5 分钟检查一次
    this._healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.integratedSystem.checkHealth();
        
        // 检查关键模块状态
        const issues: string[] = [];
        
        if (health.status === 'unhealthy') {
          issues.push('集成系统不健康');
        }
        
        if (!this._ralphLoop) {
          issues.push('Ralph Loop 未初始化');
        }
        
        if (!this._replContainer) {
          issues.push('REPL 容器未初始化');
        }
        
        if (!this._tokenPipeline) {
          issues.push('Token 流水线未初始化');
        }
        
        if (!this._entropyGovernor) {
          issues.push('熵治理器未初始化');
        }
        
        if (issues.length > 0) {
          this.logWarn(`[健康检查] 发现问题: ${issues.join(', ')}`);
        } else {
          this.logDebug('[健康检查] 所有模块正常');
        }
      } catch (error) {
        this.logError(`[健康检查] 检查失败: ${error}`);
      }
    }, 5 * 60 * 1000); // 5 分钟
  }
  
  /**
   * 停止模块健康检查
   */
  private stopModuleHealthCheck(): void {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = undefined;
    }
  }

  // ============ L4 灵盾层 - 工具执行守卫 ============
  
  /**
   * 检查工具执行是否允许（L4 灵盾层）
   */
  checkToolExecution(context: ToolExecutionContext): {
    allowed: boolean;
    reason?: string;
  } {
    if (!this._toolExecutionGuard) {
      return { allowed: true };
    }
    
    return this._toolExecutionGuard.preCheck(context);
  }
  
  /**
   * 包装工具执行函数（L4 灵盾层）
   * 
   * 使用示例：
   * ```typescript
   * const guardedExec = system.wrapToolExecution(originalExec);
   * const result = await guardedExec(context);
   * ```
   */
  wrapToolExecution<T extends ToolExecutionContext>(
    executor: (context: T) => Promise<string>
  ): (context: T) => Promise<ToolExecutionResult> {
    if (!this._toolExecutionGuard) {
      return async (context: T) => ({
        success: true,
        content: await executor(context),
        wasGuarded: false,
      });
    }
    
    return this._toolExecutionGuard.wrapExecutor(executor);
  }
  
  /**
   * 获取 L4 灵盾层统计信息
   */
  getGuardStats(sessionId?: string): {
    sessionCount: number;
    totalCalls: number;
    activeSessions: number;
  } | null {
    if (!this._toolExecutionGuard) {
      return null;
    }
    
    return this._toolExecutionGuard.getStats(sessionId);
  }
  
  // ============ 性能监控 ============
  
  /**
   * 记录模块操作
   */
  recordModuleOperation(module: string, latency: number, success: boolean = true): void {
    this.performanceMonitor.recordModuleOperation(module, latency, success);
  }
  
  /**
   * 获取模块性能指标
   */
  getModuleMetrics(module?: string): Record<string, {
    operations: number;
    avgLatency: number;
    errorRate: number;
    lastOperation?: number;
  }> {
    return this.performanceMonitor.getModuleMetrics();
  }
  
  /**
   * 获取完整性能报告
   */
  getPerformanceReport(): string {
    return this.performanceMonitor.getFullReport();
  }
  
  // ============ 错误处理 ============
  
  /**
   * 获取错误统计
   */
  getErrorStats(): {
    total: number;
    byLayer: Record<ErrorLayer, number>;
    bySeverity: Record<string, number>;
    byCode: Record<string, number>;
  } {
    return this.errorHandler.getErrorStats();
  }
  
  /**
   * 获取错误历史
   */
  getErrorHistory(limit: number = 20): YuanLingError[] {
    return this.errorHandler.getErrorHistory(limit);
  }
  
  /**
   * 清除错误历史
   */
  clearErrorHistory(): void {
    this.errorHandler.clearHistory();
  }

  // ============ L0 灵思层 - 思考协议 ============

  /**
   * L0 思考（内部方法）
   * 
   * P0-1：支持利用智能系统结果
   */
  private async think(message: string, intelligence?: IntelligenceResult): Promise<ThinkingResult | null> {
    if (!this.config.enableL0) return null;
    
    // 如果有智能系统结果，可以利用
    let depth: ThinkingResult['depth'] = 'standard';
    if (intelligence) {
      // 根据意图复杂度调整思考深度
      if (intelligence.intent.primary.confidence < 0.7) {
        depth = 'extensive';
      } else if (intelligence.intent.primary.type === 'clarify') {
        depth = 'minimal';
      }
    }
    
    const result = await quickThink(message, depth);
    if (!result) return null;

    return {
      depth: result.depth as ThinkingResult['depth'],
      hypotheses: [],
      process: `思考深度: ${result.depth}, 置信度: ${result.confidence}`,
      confidence: result.confidence,
    };
  }
  
  /**
   * 全智能处理（核心方法）
   * 
   * 用户只需要说一句话，系统自动完成：
   * 1. 意图识别
   * 2. 工具选择
   * 3. Skill 发现
   * 4. 模块启动
   * 5. 任务编排
   * 
   * P0-2：返回分析结果 + 执行结果
   */
  async processIntelligently(message: string): Promise<{
    analysis: IntelligenceResult;
    execution?: {
      success: boolean;
      modulesStarted: string[];
      modulesFailed: string[];
      error?: string;
    };
  }> {
    this.logInfo('[YuanLing] 全智能处理启动...');
    
    // 1. 使用智能系统分析
    const result = await this.intelligence.analyze(message);
    
    this.logInfo(`[YuanLing] 意图识别: ${result.intent.primary.type}`);
    this.logInfo(`[YuanLing] 置信度: ${(result.intent.primary.confidence * 100).toFixed(0)}%`);
    this.logDebug(`[YuanLing] 建议工具: ${result.tools.map(t => t.tool.name).join(', ')}`);
    this.logDebug(`[YuanLing] 建议 Skills: ${result.skills.map(s => s.skill.name).join(', ')}`);
    this.logDebug(`[YuanLing] 建议模块: ${result.modules.join(', ')}`);
    
    // 2. 自动启动需要的模块（带错误处理）
    const startedModules: string[] = [];
    const failedModules: string[] = [];
    
    for (const module of result.modules) {
      try {
        switch (module) {
          case 'dashboard':
            await this.getDashboardAsync();
            startedModules.push('dashboard');
            break;
          case 'coordinator':
          case 'multi-agent':
            await this.getCoordinatorAsync();
            startedModules.push('coordinator');
            break;
          case 'edge-runtime':
            await this.getEdgeRuntimeAsync();
            startedModules.push('edge-runtime');
            break;
          case 'federated-engine':
            await this.getFederatedEngineAsync();
            startedModules.push('federated-engine');
            break;
          case 'harness':
            await this.initializeHarness();
            startedModules.push('harness');
            break;
          case 'health-monitor':
          case 'hybrid-search-engine':
          case 'persona-manager':
          case 'entropy-governor':
          case 'token-pipeline':
            // 已在 startup 中初始化
            startedModules.push(module);
            break;
        }
      } catch (error) {
        failedModules.push(module);
        this.logWarn(`[YuanLing] 模块 ${module} 启动失败: ${error}`);
      }
    }
    
    if (startedModules.length > 0) {
      this.logInfo(`[YuanLing] 已启动模块: ${startedModules.join(', ')}`);
    }
    if (failedModules.length > 0) {
      this.logWarn(`[YuanLing] 启动失败模块: ${failedModules.join(', ')}`);
    }
    
    this.logInfo('[YuanLing] 全智能处理完成');
    
    // P0-2：返回分析结果 + 执行结果
    return {
      analysis: result,
      execution: {
        success: failedModules.length === 0,
        modulesStarted: startedModules,
        modulesFailed: failedModules,
      },
    };
  }
  
  /**
   * 仅运行 L0 思考（不执行）
   */
  async thinkOnly(message: string): Promise<ThinkingResult | null> {
    return this.think(message);
  }

  // ============ L1 灵枢层 - 决策中心 ============
        case 'persona-manager':
          // 已自动初始化
          break;
        case 'entropy-governor':
          // 已在 startup 中初始化
          break;
        case 'token-pipeline':
          // 已在 startup 中初始化
          break;
      }
    }
    
    console.log('[YuanLing] 全智能处理完成');
    
    return result;
  }
  
  /**
   * 检查未集成模块（运行时检测）
   * 
   * 修复问题3：改名，明确只做检测
   * 修复问题5：添加缓存，避免重复扫描
   */
  private async checkUnintegratedModules(): Promise<void> {
    // 使用缓存避免重复扫描
    if (this._moduleCheckCache) {
      return;
    }
    
    const fs = await import('fs');
    const path = await import('path');
    
    const srcDir = path.join(__dirname);
    const mainFile = path.join(srcDir, 'yuanling-system.ts');
    
    try {
      // 读取主文件
      const mainContent = fs.readFileSync(mainFile, 'utf-8');
      
      // 扫描所有模块目录
      const modules: string[] = [];
      const scanDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
            const fullPath = path.join(dir, entry.name);
            const indexPath = path.join(fullPath, 'index.ts');
            if (fs.existsSync(indexPath)) {
              modules.push(entry.name);
            }
            scanDir(fullPath);
          }
        }
      };
      
      scanDir(srcDir);
      
      // 检查是否有未集成的模块
      const unintegrated: string[] = [];
      for (const module of modules) {
        const typeName = module.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        const hasImport = mainContent.includes(`from './${module}`);
        const hasInstance = mainContent.includes(`_${typeName.charAt(0).toLowerCase() + typeName.slice(1)}`);
        
        if (!hasImport || !hasInstance) {
          unintegrated.push(module);
        }
      }
      
      if (unintegrated.length > 0) {
        console.log(`[YuanLing] ⚠️ 发现 ${unintegrated.length} 个未集成的模块: ${unintegrated.join(', ')}`);
        console.log('[YuanLing] 请运行: npm run discover');
      }
      
      // 标记已检查（修复问题5：缓存）
      this._moduleCheckCache = true;
    } catch (error) {
      // 忽略错误，不影响启动
      this._moduleCheckCache = true;
    }
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
  /**
   * L1 决策（内部方法）
   * 
   * P0-1：支持利用智能系统结果
   */
  private async makeDecision(
    message: string,
    thinking?: ThinkingResult | null,
    intelligence?: IntelligenceResult
  ): Promise<DecisionResult> {
    const lowerMessage = message.toLowerCase();

    // P0-1：如果智能系统已匹配工具，直接使用
    let suggestedTools: string[] = [];
    if (intelligence && intelligence.tools.length > 0) {
      suggestedTools = intelligence.tools.slice(0, 3).map(t => t.tool.name);
    } else {
      // 回退到关键词匹配
      const toolKeywords: Record<string, string[]> = {
        'file': ['文件', '读取', '写入', '编辑', 'file', 'read', 'write'],
        'search': ['搜索', '查找', 'search', 'find'],
        'exec': ['执行', '运行', '命令', 'exec', 'run', 'command'],
        'browser': ['浏览器', '网页', 'browser', 'web'],
        'calendar': ['日程', '日历', 'calendar', 'schedule'],
        'note': ['备忘', '笔记', 'note', 'memo'],
      };

      for (const [tool, keywords] of Object.entries(toolKeywords)) {
        if (keywords.some(kw => lowerMessage.includes(kw))) {
          suggestedTools.push(tool);
        }
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

    // P0-1：利用智能系统的意图识别结果
    let decisionType: DecisionResult['type'] = 'direct_reply';
    if (intelligence) {
      switch (intelligence.intent.primary.type) {
        case 'search':
        case 'web_search':
          decisionType = 'search';
          break;
        case 'tool_call':
        case 'file_operation':
        case 'command_execution':
          decisionType = 'tool_call';
          break;
        case 'clarification':
          decisionType = 'clarify';
          break;
        default:
          decisionType = 'direct_reply';
      }
    } else {
      // 回退到关键词判断
      decisionType = 
        suggestedTools.length > 0 ? 'tool_call' :
        (lowerMessage.includes('?') || lowerMessage.includes('？')) && 
        (lowerMessage.includes('什么') || lowerMessage.includes('如何') || lowerMessage.includes('为什么')) ? 'search' :
        lowerMessage.includes('确认') || lowerMessage.includes('你是说') ? 'clarify' :
        'direct_reply';
    }

    return {
      type: decisionType,
      reasoning: thinking 
        ? `基于 ${thinking.depth} 思考，元认知置信度 ${metaCheck.confidence.toFixed(2)}，建议 ${decisionType}`
        : intelligence
        ? `智能系统意图: ${intelligence.intent.primary.type}，置信度 ${(intelligence.intent.primary.confidence * 100).toFixed(0)}%，建议 ${decisionType}`
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

  // ============ Darwin Skill 机制集成 ============

  /**
   * 使用独立评估器评估输出质量
   * 
   * 借鉴 Darwin Skill 的 8 维度 Rubric
   */
  async evaluateOutput(
    targetName: string,
    targetContent: string,
    testPrompts?: string[]
  ): Promise<EvaluationResult> {
    return this.independentEvaluator.evaluate(
      'module',
      targetName,
      targetContent,
      testPrompts
    );
  }

  /**
   * 尝试改进（使用棘轮机制）
   * 
   * 只保留有改进的变更，自动回滚退步
   */
  async attemptImprovement(
    change: string,
    newScore: number,
    applyChange: () => Promise<void> | void
  ): Promise<{ kept: boolean; reason: string }> {
    return this.ratchetManager.attemptImprovement(change, newScore, applyChange);
  }

  /**
   * 生成成果卡片
   * 
   * 可视化评估结果
   */
  async generateResultCard(
    title: string,
    scoreBefore: number,
    scoreAfter: number,
    dimensions: Array<{ name: string; before: number; after: number; max: number }>,
    improvements: string[],
    theme: 'swiss' | 'terminal' | 'newspaper' = 'swiss'
  ): Promise<string> {
    return this.resultCardGenerator.generateCard({
      title,
      date: new Date().toISOString().split('T')[0],
      scoreBefore,
      scoreAfter,
      scoreDelta: scoreAfter - scoreBefore,
      dimensions,
      improvements,
      brand: '元灵系统 v4.4.0',
      link: 'https://github.com/bdjwbdb/humanoid-agent',
    }, theme as any);
  }

  /**
   * 运行测试套件
   * 
   * 使用标准测试 Prompt 验证模块质量
   */
  async runTestSuite(
    targetModule: string,
    executor: (prompt: string) => Promise<string>
  ): Promise<{
    total: number;
    passed: number;
    failed: number;
    averageScore: number;
  }> {
    const results = await this.testPromptFramework.runTest(targetModule, executor);
    
    return {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    };
  }

  /**
   * 获取棘轮状态
   */
  getRatchetState(): { bestScore: number; bestCommit: string } {
    const state = this.ratchetManager.getBestState();
    return {
      bestScore: state.score,
      bestCommit: state.commit,
    };
  }

  /**
   * 获取评估历史
   */
  getEvaluationHistory(limit: number = 10): ReturnType<IndependentEvaluator['getHistory']> {
    return this.independentEvaluator.getHistory(limit);
  }

  // ============ 主执行流程 ============

  /**
   * 处理消息（主入口）
   * 
   * 流程：L6 → L0 → L1 → L2/L3 → L4 → L5
   * 
   * 优化策略：
   * - L0/L1 并行执行（思考与决策独立）
   * - 记忆搜索异步化（不阻塞主流程）
   * - 缓存增强提示词模板
   * - 统一错误处理
   * - P1-2：超时控制
   * - P1-3：重试机制
   * - P2-1：熔断机制
   * - P2-2：限流机制
   */
  async processWithExternalExecutor(
    userMessage: string,
    sessionHistory: Message[],
    executor: ExternalExecutor
  ): Promise<{
    result: { content: string; toolCalls?: ToolCall[]; usage?: { inputTokens: number; outputTokens: number } };
    context: ProcessingContext;
  }> {
    const context: ProcessingContext = {};
    const startTime = Date.now();
    let success = true;

    try {
      // ========== L6 灵识层 - 环境感知（已在 startup 完成）==========

      // ========== P2-2：限流检查 ==========
      if (!this.checkRateLimiter()) {
        return {
          result: { content: `[系统] 请求过于频繁，请稍后再试` },
          context: { performance: { totalLatency: Date.now() - startTime } },
        };
      }

      // ========== P2-1：熔断检查 ==========
      if (!this.checkCircuitBreaker()) {
        return {
          result: { content: `[系统] 服务暂时不可用，请稍后再试` },
          context: { performance: { totalLatency: Date.now() - startTime } },
        };
      }

      // ========== P2-1：请求去重 ==========
      if (this.config.enableRequestDeduplication) {
        const dedupeResult = this.checkRequestDuplication(userMessage);
        if (dedupeResult.isDuplicate) {
          this.logDebug(`[去重] 检测到重复请求，返回缓存结果`);
          return {
            result: dedupeResult.cachedResult!,
            context: { performance: { totalLatency: Date.now() - startTime } },
          };
        }
      }

      // ========== 优化5：请求优先级记录 ==========
      const requestPriority = this.getRequestPriority(userMessage);
      if (requestPriority !== 'normal') {
        this.logDebug(`[优先级] 请求优先级: ${requestPriority}`);
      }

      // ========== P0-1：智能系统作为统一入口（带缓存 + 超时）==========
      const intelligenceStart = Date.now();
      const intelligenceResult = await this.withTimeout(
        this.analyzeWithCache(userMessage),
        this.config.requestTimeoutMs,
        '智能系统分析'
      );
      context.intelligence = intelligenceResult;
      this.performanceMonitor.recordLayerLatency('智能系统', Date.now() - intelligenceStart);
      
      this.logInfo(`[智能系统] 意图: ${intelligenceResult.intent.primary.type}, 置信度: ${(intelligenceResult.intent.primary.confidence * 100).toFixed(0)}%`);
      this.logDebug(`[智能系统] 建议工具: ${intelligenceResult.tools.slice(0, 3).map(t => t.tool.name).join(', ')}`);
      this.logDebug(`[智能系统] 建议 Skills: ${intelligenceResult.skills.slice(0, 3).map(s => s.skill.name).join(', ')}`);

      // ========== P1-2：会话历史独立处理 ==========
      let historyContext = '';
      try {
        historyContext = this.processSessionHistory(sessionHistory);
        if (historyContext) {
          this.logDebug(`[会话历史] 已加载历史上下文`);
        }
      } catch (error) {
        this.logWarn(`[会话历史] 处理失败: ${error}`);
        // 继续执行，不影响主流程
      }

      // ========== L0 思考 + 记忆搜索并行（带超时）==========
      const parallelStart = Date.now();
      
      let thinkingResult: ThinkingResult | null = null;
      let memories: any[] = [];
      
      try {
        // 优化3/4：L0 思考和记忆搜索都添加超时控制
        const [thinkResult, memResult] = await Promise.all([
          this.withTimeout(
            this.think(userMessage, intelligenceResult),
            10000, // L0 思考超时 10 秒
            'L0 思考'
          ),
          this.withTimeout(
            this.integratedSystem.searchMemory(userMessage, { limit: 2 }),
            5000, // 记忆搜索超时 5 秒
            '记忆搜索'
          ),
        ]);
        thinkingResult = thinkResult;
        memories = memResult;
        context.thinking = thinkingResult || undefined;
      } catch (error) {
        const handled = this.errorHandler.handle(error);
        this.logWarn(`[L0/记忆] 思考/记忆搜索失败: ${handled.message}`);
      }
      
      this.performanceMonitor.recordLayerLatency('L0-记忆-并行', Date.now() - parallelStart);

      // ========== P0-2：L1 决策（串行，利用 L0 结果）==========
      const l1Start = Date.now();
      
      try {
        // L1 决策可以利用智能系统的工具匹配结果
        context.decision = await this.makeDecision(userMessage, thinkingResult, intelligenceResult);
      } catch (error) {
        const handled = this.errorHandler.handle(error);
        this.logWarn(`[L1] 决策失败: ${handled.message}`);
      }
      
      this.performanceMonitor.recordLayerLatency('L1-决策', Date.now() - l1Start);

      // ========== P1-2：智能路由（根据意图选择执行路径）==========
      const l2Start = Date.now();
      
      let result;
      try {
        // P1-1：根据智能系统结果选择执行路径（使用可配置阈值）
        const intentType = intelligenceResult.intent.primary.type;
        const intentConfidence = intelligenceResult.intent.primary.confidence;
        const confidenceThreshold = this.config.intentConfidenceThreshold;
        
        // 高置信度的特定意图，直接执行
        if (intentConfidence >= confidenceThreshold) {
          if (intentType === 'search' || intentType === 'web_search') {
            // 搜索意图：直接调用搜索工具
            this.logInfo(`[智能路由] 搜索意图 (置信度: ${(intentConfidence * 100).toFixed(0)}% >= ${(confidenceThreshold * 100).toFixed(0)}%)，直接调用搜索工具`);
            result = await this.executeSearchIntent(userMessage, intelligenceResult.tools, context);
          } else if (intentType === 'tool_call' && intelligenceResult.tools.length > 0) {
            // 工具意图：调用建议的工具
            this.logInfo(`[智能路由] 工具意图 (置信度: ${(intentConfidence * 100).toFixed(0)}%)，调用建议工具`);
            result = await this.executeToolIntent(userMessage, intelligenceResult.tools, context);
          } else {
            // 默认：调用外部执行器
            const enhancedPrompt = await this.buildEnhancedPromptWithHistory(userMessage, context, memories, historyContext);
            result = await executor(enhancedPrompt, context);
          }
        } else {
          // 低置信度：调用外部执行器
          this.logDebug(`[智能路由] 置信度 ${(intentConfidence * 100).toFixed(0)}% < ${(confidenceThreshold * 100).toFixed(0)}%，使用外部执行器`);
          const enhancedPrompt = await this.buildEnhancedPromptWithHistory(userMessage, context, memories, historyContext);
          result = await executor(enhancedPrompt, context);
        }
        
        // ========== P1-3：Skill 实际调用（增强版）==========
        context.skillResults = [];
        if (intelligenceResult.skills.length > 0) {
          this.logDebug(`[Skill] 发现 Skills: ${intelligenceResult.skills.slice(0, 3).map(s => s.skill.name).join(', ')}`);
          // Skill 调用（带超时和状态更新）
          for (const skillMatch of intelligenceResult.skills.slice(0, 2)) {
            try {
              // 尝试实际调用 Skill（带超时）
              const skillResult = await this.withTimeout(
                this.executeSkill(skillMatch.skill, userMessage, context),
                5000, // Skill 执行超时 5 秒
                `Skill ${skillMatch.skill.name}`
              );
              context.skillResults.push({
                name: skillMatch.skill.name,
                score: skillMatch.score,
                status: 'called',
                result: skillResult,
              });
            } catch (error) {
              context.skillResults.push({
                name: skillMatch.skill.name,
                score: skillMatch.score,
                status: 'failed',
                error: String(error),
              });
            }
          }
        }
      } catch (error) {
        // L2/L3 错误处理
        const handled = this.errorHandler.handle(
          new L2Error(ErrorCode.L2_EXECUTION_FAILED, '执行失败', { cause: error as Error })
        );
        result = { content: `执行失败: ${handled.message}` };
      }
      
      this.performanceMonitor.recordLayerLatency('L2-L3-灵脉灵躯层', Date.now() - l2Start);

      // ========== P2-1：L4 验证 + 修复 ==========
      const l4Start = Date.now();
      
      // 使用 L4 灵盾层进行输出验证和截断
      if (this._toolExecutionGuard && result.content) {
        const guardResult = this._toolExecutionGuard.postProcess(
          { toolName: 'llm', args: {}, messageId: 'llm_response', sessionId: 'default' },
          result.content
        );
        result.content = guardResult.content;
        
        if (guardResult.wasGuarded) {
          this.logDebug(`[L4-灵盾层] 输出已处理: ${guardResult.truncationApplied?.truncationType}`);
        }
      }
      
      // P0-1：只执行一次验证
      context.validation = this.validateOutput(result, userMessage);
      
      // P2-1：验证失败时尝试修复
      if (!context.validation.passed && context.validation.issues.length > 0) {
        this.logWarn(`[L4] 验证发现问题: ${context.validation.issues.join(', ')}`);
        // 简单修复：添加提示
        if (context.validation.issues.includes('内容过短')) {
          result.content = `${result.content}\n\n[系统提示: 回复可能不完整，请提供更多细节]`;
        }
      }
      
      // P0-2：只记录一次性能
      this.performanceMonitor.recordLayerLatency('L4-灵盾层', Date.now() - l4Start);

      // ========== L5 灵韵层 - 反馈 ==========
      context.feedback = this.generateFeedback(context.validation, result);

      // ========== P2-2：性能指标聚合（完整版）==========
      context.performance = {
        l0l1Latency: Date.now() - parallelStart,
        l2l3Latency: Date.now() - l2Start,
        l4Latency: Date.now() - l4Start,
        totalLatency: Date.now() - startTime,
      };

      // P2-2：记录详细性能指标
      this.logDebug(`[性能] 总耗时: ${context.performance.totalLatency}ms, L0-L1: ${context.performance.l0l1Latency}ms, L2-L3: ${context.performance.l2l3Latency}ms, L4: ${context.performance.l4Latency}ms`);

      // P2-1：缓存请求结果（用于去重）
      if (this.config.enableRequestDeduplication) {
        this.cacheRequestResult(userMessage, result);
      }

      // P2-1：记录熔断器成功
      this.recordCircuitBreakerSuccess();

      // L5 异步学习反馈
      setImmediate(() => {
        this.learnFromFeedback(userMessage, result, context.validation).catch(err => {
          this.logWarn(`[L5] 异步学习失败: ${err}`);
        });
      });

      return { result, context };
    } catch (error) {
      success = false;
      
      // P2-1：记录熔断器失败
      this.recordCircuitBreakerFailure();
      
      // P2-5：错误分类细化
      const handled = this.errorHandler.handle(error);
      const errorType = this.classifyError(error);
      this.logError(`[系统错误] 类型: ${errorType}, 消息: ${handled.message}`);
      
      // P2-3：尝试降级处理
      if (handled.severity !== 'critical') {
        this.logWarn(`[系统] 尝试降级处理...`);
        // 返回一个基本的错误响应
        return {
          result: { content: `系统遇到问题，已降级处理。错误类型: ${errorType}, 消息: ${handled.message}` },
          context: {
            performance: { totalLatency: Date.now() - startTime },
          },
        };
      }
      
      throw error;
    } finally {
      // 性能监控采样
      const latency = Date.now() - startTime;
      this.recordPerformanceWithSampling('request_latency', latency, { success: String(success) });
      this.logDebug(`[YuanLingSystem] 处理完成: ${latency}ms, 成功: ${success}`);
    }
  }

  /**
   * 构建增强提示（使用已搜索的记忆）
   * 
   * P1-1：记忆搜索已并行完成，直接使用结果
   */
  private async buildEnhancedPromptWithMemories(
    userMessage: string,
    context: ProcessingContext,
    memories: any[]
  ): Promise<string> {
    const parts: string[] = [];

    // 添加相关记忆（已搜索）
    if (memories.length > 0) {
      parts.push('[相关记忆]');
      for (const m of memories.slice(0, 2)) {
        parts.push(`- ${m.memory?.content?.substring(0, 80) || String(m).substring(0, 80)}`);
      }
      parts.push('');
    }

    // 添加思考过程（简化）
    if (context.thinking) {
      parts.push(`[思考] ${context.thinking.depth} | 置信度: ${((context.thinking.confidence || 0) * 100).toFixed(0)}%`);
    }

    // 添加智能系统分析结果
    if (context.intelligence) {
      parts.push(`[意图] ${context.intelligence.intent.primary.type} (${(context.intelligence.intent.primary.confidence * 100).toFixed(0)}%)`);
    }

    // 添加决策建议（简化）
    if (context.decision) {
      parts.push(`[决策] ${context.decision.type}`);
    }

    // 添加用户消息
    parts.push('');
    parts.push(userMessage);

    return parts.join('\n');
  }

  /**
   * 构建增强提示（带会话历史）
   * 
   * P1-1：包含会话历史，上下文更连贯
   */
  private async buildEnhancedPromptWithHistory(
    userMessage: string,
    context: ProcessingContext,
    memories: any[],
    historyContext: string
  ): Promise<string> {
    const parts: string[] = [];

    // 添加会话历史
    if (historyContext) {
      parts.push('[会话历史]');
      parts.push(historyContext);
      parts.push('');
    }

    // 添加相关记忆（已搜索）
    if (memories.length > 0) {
      parts.push('[相关记忆]');
      for (const m of memories.slice(0, 2)) {
        parts.push(`- ${m.memory?.content?.substring(0, 80) || String(m).substring(0, 80)}`);
      }
      parts.push('');
    }

    // 添加思考过程
    if (context.thinking) {
      parts.push(`[思考] ${context.thinking.depth} | 置信度: ${((context.thinking.confidence || 0) * 100).toFixed(0)}%`);
    }

    // 添加智能系统分析结果
    if (context.intelligence) {
      parts.push(`[意图] ${context.intelligence.intent.primary.type} (${(context.intelligence.intent.primary.confidence * 100).toFixed(0)}%)`);
    }

    // 添加决策建议
    if (context.decision) {
      parts.push(`[决策] ${context.decision.type}`);
    }

    // 添加用户消息
    parts.push('');
    parts.push(userMessage);

    return parts.join('\n');
  }

  /**
   * P1-2：执行搜索意图
   */
  private async executeSearchIntent(
    userMessage: string,
    tools: Array<{ tool: any; score: number }>,
    context: ProcessingContext
  ): Promise<{ content: string }> {
    context.toolResults = [];
    
    // 查找搜索工具
    const searchTool = tools.find(t => 
      t.tool.name.includes('search') || 
      t.tool.name.includes('web') ||
      t.tool.name === 'xiaoyi-web-search'
    );
    
    if (searchTool) {
      context.toolResults.push({
        name: searchTool.tool.name,
        score: searchTool.score,
        status: 'called',
        result: { query: userMessage },
      });
      
      // 返回提示，实际调用需要工具执行器
      return { content: `[系统] 已识别搜索意图，建议使用 ${searchTool.tool.name} 工具执行搜索: "${userMessage}"` };
    }
    
    return { content: `[系统] 已识别搜索意图，但未找到合适的搜索工具` };
  }

  /**
   * P1-2：执行工具意图
   */
  private async executeToolIntent(
    userMessage: string,
    tools: Array<{ tool: any; score: number }>,
    context: ProcessingContext
  ): Promise<{ content: string }> {
    context.toolResults = [];
    
    // 记录建议的工具
    for (const toolMatch of tools.slice(0, 3)) {
      context.toolResults.push({
        name: toolMatch.tool.name,
        score: toolMatch.score,
        status: 'called',
        result: { query: userMessage },
      });
    }
    
    const toolNames = tools.slice(0, 3).map(t => t.tool.name).join(', ');
    return { content: `[系统] 已识别工具调用意图，建议使用以下工具: ${toolNames}` };
  }

  /**
   * 构建增强提示（优化版）
   * 
   * 优化策略：
   * - 记忆搜索使用缓存（已在 IntegratedSystem 实现）
   * - 简化模板拼接
   * - 减少不必要的字符串操作
   */
  private async buildEnhancedPromptOptimized(
    userMessage: string,
    context: ProcessingContext
  ): Promise<string> {
    const parts: string[] = [];

    // 添加相关记忆（使用缓存）
    const memories = await this.integratedSystem.searchMemory(userMessage, { limit: 2 });
    if (memories.length > 0) {
      parts.push('[相关记忆]');
      for (const m of memories.slice(0, 2)) { // 限制 2 条
        parts.push(`- ${m.memory.content.substring(0, 80)}`);
      }
      parts.push('');
    }

    // 添加思考过程（简化）
    if (context.thinking) {
      parts.push(`[思考] ${context.thinking.depth} | 置信度: ${((context.thinking.confidence || 0) * 100).toFixed(0)}%`);
    }

    // 添加决策建议（简化）
    if (context.decision) {
      parts.push(`[决策] ${context.decision.type}`);
    }

    // 如果有增强内容，包装用户消息
    if (parts.length > 0) {
      return `${parts.join('\n')}\n\n[用户消息]\n${userMessage}`;
    }

    return userMessage;
  }
  
  /**
   * 优化5：带缓存的增强提示构建
   * 
   * 缓存相似消息的增强提示，减少重复计算
   */
  private async buildEnhancedPromptWithCache(
    userMessage: string,
    context: ProcessingContext
  ): Promise<string> {
    // 生成缓存 key
    const cacheKey = `${userMessage}:${context.thinking?.depth || ''}:${context.decision?.type || ''}`;
    
    // 检查缓存
    const cached = this._promptCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.PROMPT_CACHE_TTL) {
      return cached.prompt;
    }
    
    // 构建增强提示
    const prompt = await this.buildEnhancedPromptOptimized(userMessage, context);
    
    // 存入缓存
    this._promptCache.set(cacheKey, { prompt, timestamp: Date.now() });
    
    // 清理过期缓存
    if (this._promptCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this._promptCache.entries()) {
        if (now - value.timestamp > this.PROMPT_CACHE_TTL) {
          this._promptCache.delete(key);
        }
      }
    }
    
    return prompt;
  }

  /**
   * 构建增强提示（原版，保留兼容性）
   */
  private async buildEnhancedPrompt(
    userMessage: string,
    context: ProcessingContext
  ): Promise<string> {
    return this.buildEnhancedPromptWithCache(userMessage, context);
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
   * P2-5：错误分类
   */
  private classifyError(error: any): string {
    if (error instanceof L2Error) return 'L2_EXECUTION';
    if (error instanceof L1Error) return 'L1_DECISION';
    if (error instanceof L0Error) return 'L0_THINKING';
    if (error?.code === 'ETIMEDOUT') return 'TIMEOUT';
    if (error?.code === 'ENOTFOUND') return 'NETWORK';
    if (error?.code === 'EACCES') return 'PERMISSION';
    if (error?.name === 'TypeError') return 'TYPE_ERROR';
    if (error?.name === 'SyntaxError') return 'SYNTAX_ERROR';
    return 'UNKNOWN';
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
    const sysMetrics = this.performanceMonitor.getSystemMetrics();
    
    // 计算健康状态
    const memUsage = sysMetrics.memory.heapUsed / sysMetrics.memory.heapTotal;
    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (memUsage > 0.9) {
      health = 'unhealthy';
    } else if (memUsage > 0.7) {
      health = 'degraded';
    }

    return {
      health,
      toolCount: this.tools.size,
      hasLLMConfig: !!this.llmConfig,
      l0Enabled: this.config.enableL0,
      introspectionEnabled: this.config.enableIntrospection,
      performance: {
        health: 1 - memUsage,
        avgLatency: 0,
        cacheHitRate: 0,
        successRate: 1,
        totalRequests: 0,
      },
    };
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
    // 停止健康检查
    this.stopModuleHealthCheck();
    
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

export const VERSION = '4.9.6';
export const BUILD_DATE = '2026-04-16';
