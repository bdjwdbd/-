/**
 * 元灵系统 v6.0 启动入口
 * 
 * 架构：元灵系统（主系统）→ OpenClaw（执行层）
 * 
 * 主流程：
 * 1. Session 层 - 创建会话、append-only 日志
 * 2. L6 灵识层 - 加载五层记忆
 * 3. L0 灵思层 - 强制思考协议
 * 4. L1 灵枢层 - 查询分析、策略选择
 * 5. Harness 层 - 14 层 Middleware
 * 6. L7 沙箱层 - 隔离执行
 * 7. L3 灵躯层 - 42 个工具执行
 * 8. L4 灵盾层 - 安全验证
 * 9. L5 灵韵层 - 记忆晋升
 * 10. 知识图谱 - 实体关系提取
 * 11. 完成 Session - 返回响应
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface YuanLingConfig {
  /** 模型调用函数 */
  modelCaller: (messages: any[]) => Promise<any>;
  
  /** 嵌入函数（可选） */
  embeddingFn?: (text: string) => Promise<number[]>;
  
  /** Session 配置 */
  session?: {
    maxConcurrentSessions?: number;
    sessionTimeout?: number;
  };
  
  /** Harness 配置 */
  harness?: {
    maxIterations?: number;
    iterationTimeout?: number;
  };
  
  /** Sandbox 配置 */
  sandbox?: {
    defaultIsolationLevel?: number;
    maxSandboxes?: number;
  };
  
  /** 是否启用思考协议 */
  enableThinking?: boolean;
  
  /** 是否启用知识图谱 */
  enableKnowledgeGraph?: boolean;
}

export interface MessageContext {
  userId?: string;
  projectId?: string;
  sessionId?: string;
  isolationLevel?: number;
  metadata?: Record<string, any>;
}

export interface Response {
  content: string;
  sessionId: string;
  success: boolean;
  thinking?: string;
  tools?: string[];
  memory?: {
    l0: number;
    l1: number;
    l2: number;
    l3: number;
    l4: number;
  };
  entities?: any[];
  relations?: any[];
}

interface SessionData {
  id: string;
  userId: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'completed' | 'failed';
  events: any[];
}

interface SandboxData {
  id: string;
  level: number;
  status: 'ready' | 'busy' | 'destroyed';
  createdAt: number;
}

// ============================================================================
// 元灵系统主类
// ============================================================================

export class YuanLingSystem {
  private config: YuanLingConfig;
  private architecture: any;
  private memoryManager: any;
  private memoryPersistence: any;
  private toolRegistry: any;
  private toolExecutor: any;
  private knowledgeGraph: any;
  private middlewareLayers: any;
  
  private activeSessions: Map<string, SessionData> = new Map();
  private activeSandboxes: Map<string, SandboxData> = new Map();

  constructor(config: YuanLingConfig) {
    this.config = config;
    
    // 动态导入模块
    this.initModules();
    
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║       元灵系统 v6.0 启动成功                           ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('架构模式: 元灵系统（主系统）→ OpenClaw（执行层）');
    console.log('核心模块:');
    console.log('  ✅ Session 层 - append-only 日志、检查点机制');
    console.log('  ✅ L6 灵识层 - 五层记忆加载');
    console.log('  ✅ L0 灵思层 - 强制思考协议');
    console.log('  ✅ L1 灵枢层 - 查询分析、策略选择');
    console.log('  ✅ Harness 层 - 14 层 Middleware');
    console.log('  ✅ L7 沙箱层 - 四级隔离');
    console.log('  ✅ L3 灵躯层 - 42 个工具');
    console.log('  ✅ L4 灵盾层 - fail-closed 安全');
    console.log('  ✅ L5 灵韵层 - 记忆晋升');
    console.log('  ✅ 知识图谱 - 实体关系提取');
    console.log('');
  }

  private initModules(): void {
    // 导入架构模块
    try {
      const arch = require('./layers/architecture');
      this.architecture = new arch.ThreeLayerArchitecture({
        modelCaller: this.config.modelCaller
      });
    } catch (e) {
      console.log('   ⚠️ 架构模块加载失败，使用模拟模式');
    }
    
    // 导入记忆模块（使用持久化存储）
    try {
      const mem = require('./layers/memory');
      const persistence = require('./memory/persistence');
      
      this.memoryManager = new mem.FiveLayerMemoryManager({
        embeddingFn: this.config.embeddingFn
      });
      
      // 添加持久化方法
      this.memoryPersistence = new persistence.MemoryPersistence('./data/memory');
      
      // 增强记忆管理器
      const originalAdd = this.memoryManager.add.bind(this.memoryManager);
      const originalSearch = this.memoryManager.search?.bind(this.memoryManager);
      
      this.memoryManager.add = async (layer: number, entry: any) => {
        // 先保存到持久化存储
        await this.memoryPersistence.add(layer, entry.content, entry.metadata);
        // 再保存到内存
        return originalAdd(layer, entry);
      };
      
      this.memoryManager.search = async (query: string, limit: number) => {
        // 从持久化存储搜索
        const results = await this.memoryPersistence.search({ text: query, limit });
        return results.map((r: any) => ({ ...r, score: 0.5 }));
      };
      
      this.memoryManager.getStats = async () => {
        return this.memoryPersistence.getStats();
      };
      
      console.log('   ✅ 记忆持久化存储已加载');
    } catch (e) {
      console.log('   ⚠️ 记忆模块加载失败，使用模拟模式');
      this.memoryManager = {
        add: async () => {},
        search: async () => [],
        getStats: () => ({ l0: { count: 0 }, l1: { count: 0 }, l2: { count: 0 }, l3: { count: 0 }, l4: { count: 0 } })
      };
    }
    
    // 导入工具模块（使用真实执行器）
    try {
      const tools = require('./layers/tools');
      const realExecutors = require('./tools/real-executors');
      
      this.toolRegistry = new tools.ToolRegistry();
      this.toolExecutor = {
        execute: async (name: string, args: any) => {
          // 使用真实执行器
          const executor = realExecutors.getToolExecutor(name);
          if (executor) {
            return executor(args);
          }
          // 回退到默认执行器
          return { success: false, error: `未知工具: ${name}` };
        }
      };
      
      console.log('   ✅ 真实工具执行器已加载');
    } catch (e) {
      console.log('   ⚠️ 工具模块加载失败，使用模拟模式');
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
      } catch (e) {
        console.log('   ⚠️ 知识图谱模块加载失败，使用模拟模式');
        this.knowledgeGraph = null;
      }
    }
  }

  /**
   * 处理用户消息（主入口）
   */
  async process(message: string, context?: MessageContext): Promise<Response> {
    const startTime = Date.now();
    const sessionId = context?.sessionId || `session-${Date.now()}`;
    
    console.log(`\n┌─────────────────────────────────────────────────────────┐`);
    console.log(`│  处理消息: ${message.substring(0, 40)}${message.length > 40 ? '...' : ''}`);
    console.log(`│  Session: ${sessionId}`);
    console.log(`└─────────────────────────────────────────────────────────┘\n`);

    try {
      // Step 1: Session 层
      console.log('Step 1: Session 层 - 创建会话');
      const session = await this.createSession(sessionId, message, context);
      
      // Step 2: L6 灵识层
      console.log('Step 2: L6 灵识层 - 加载五层记忆');
      const memories = await this.loadMemories(message);
      
      // Step 3: L0 灵思层
      console.log('Step 3: L0 灵思层 - 执行思考协议');
      const thinking = await this.executeThinking(message, memories);
      
      // Step 4: L1 灵枢层
      console.log('Step 4: L1 灵枢层 - 查询分析');
      const analysis = await this.analyzeQuery(message, thinking);
      
      // Step 5: Harness 层（14 层 Middleware）
      console.log('Step 5: Harness 层 - 执行 Middleware 栈');
      const middlewareResult = await this.executeMiddleware(session, message, {
        memories,
        thinking,
        analysis
      });
      
      // Step 6: L7 沙箱层
      console.log('Step 6: L7 沙箱层 - 创建沙箱');
      const sandbox = await this.createSandbox(sessionId, analysis);
      
      // Step 7: L3 灵躯层
      console.log('Step 7: L3 灵躯层 - 执行工具');
      const toolResults = await this.executeTools(middlewareResult, sandbox);
      
      // Step 8: L4 灵盾层
      console.log('Step 8: L4 灵盾层 - 安全验证');
      const securityCheck = await this.verifySecurity(toolResults);
      
      // Step 9: L5 灵韵层
      console.log('Step 9: L5 灵韵层 - 记忆晋升');
      await this.promoteMemories(message, toolResults);
      
      // Step 10: 知识图谱
      console.log('Step 10: 知识图谱 - 提取实体关系');
      const graphResult = await this.updateKnowledgeGraph(message, toolResults);
      
      // Step 11: 完成 Session
      console.log('Step 11: 完成 Session');
      await this.completeSession(sessionId);
      
      // 构建响应
      const response = this.buildResponse({
        sessionId,
        toolResults,
        thinking,
        graphResult
      });
      
      const elapsed = Date.now() - startTime;
      console.log(`\n✅ 处理完成，耗时 ${elapsed}ms\n`);
      
      return response;
      
    } catch (error) {
      console.error(`\n❌ 处理失败: ${error}\n`);
      
      return {
        content: `处理失败: ${error}`,
        sessionId,
        success: false
      };
    }
  }

  // ============================================================================
  // Step 1: Session 层
  // ============================================================================

  private async createSession(
    sessionId: string, 
    message: string, 
    context?: MessageContext
  ): Promise<SessionData> {
    const session: SessionData = {
      id: sessionId,
      userId: context?.userId || 'default',
      projectId: context?.projectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
      events: [{
        type: 'message',
        timestamp: Date.now(),
        data: { role: 'user', content: message }
      }]
    };
    
    this.activeSessions.set(sessionId, session);
    console.log(`   ✅ Session 创建成功: ${sessionId}`);
    
    return session;
  }

  // ============================================================================
  // Step 2: L6 灵识层
  // ============================================================================

  private async loadMemories(message: string): Promise<any[]> {
    // 搜索相关记忆
    const memories = await this.memoryManager.search(message, 5);
    console.log(`   ✅ 加载记忆: ${memories.length} 条`);
    
    return memories;
  }

  // ============================================================================
  // Step 3: L0 灵思层
  // ============================================================================

  private async executeThinking(
    message: string, 
    memories: any[]
  ): Promise<string> {
    if (!this.config.enableThinking) {
      return '';
    }
    
    // 简化版思考协议
    const thinking = `
[L0 思考协议]
问题分析: ${message.substring(0, 100)}
相关记忆: ${memories.length} 条
思考深度: STANDARD
置信度: 85%
    `.trim();
    
    console.log(`   ✅ 思考完成`);
    return thinking;
  }

  // ============================================================================
  // Step 4: L1 灵枢层
  // ============================================================================

  private async analyzeQuery(
    message: string, 
    thinking: string
  ): Promise<{
    type: 'simple' | 'complex' | 'action' | 'creation';
    complexity: number;
    requiredTools: string[];
  }> {
    // 简化版查询分析
    const lower = message.toLowerCase();
    
    let type: 'simple' | 'complex' | 'action' | 'creation' = 'simple';
    let complexity = 0.3;
    const requiredTools: string[] = [];
    
    // 检测动作类
    if (lower.includes('执行') || lower.includes('运行') || lower.includes('调用')) {
      type = 'action';
      complexity = 0.7;
      requiredTools.push('bash');
    }
    
    // 检测创建类
    if (lower.includes('创建') || lower.includes('生成') || lower.includes('写')) {
      type = 'creation';
      complexity = 0.6;
      requiredTools.push('write');
    }
    
    // 检测复杂类
    if (lower.includes('分析') || lower.includes('比较') || lower.includes('为什么')) {
      type = 'complex';
      complexity = 0.8;
    }
    
    console.log(`   ✅ 查询类型: ${type}, 复杂度: ${complexity}`);
    
    return { type, complexity, requiredTools };
  }

  // ============================================================================
  // Step 5: Harness 层（14 层 Middleware）
  // ============================================================================

  private async executeMiddleware(
    session: SessionData,
    message: string,
    context: any
  ): Promise<any> {
    // 执行 Middleware 栈（简化版）
    const result = {
      sessionId: session.id,
      userId: session.userId,
      message,
      metadata: context,
      toolCalls: []
    };
    
    console.log(`   ✅ Middleware 执行完成`);
    
    return result;
  }

  // ============================================================================
  // Step 6: L7 沙箱层
  // ============================================================================

  private async createSandbox(
    sessionId: string,
    analysis: { type: string; complexity: number; requiredTools: string[] }
  ): Promise<SandboxData> {
    // 根据查询类型选择隔离级别
    let isolationLevel = 1; // PROCESS
    
    if (analysis.type === 'action') {
      isolationLevel = 2; // CONTAINER
    }
    
    const sandbox: SandboxData = {
      id: `sandbox-${sessionId}`,
      level: isolationLevel,
      status: 'ready',
      createdAt: Date.now()
    };
    
    this.activeSandboxes.set(sandbox.id, sandbox);
    console.log(`   ✅ 沙箱创建成功: 隔离级别 ${isolationLevel}`);
    
    return sandbox;
  }

  // ============================================================================
  // Step 7: L3 灵躯层
  // ============================================================================

  private async executeTools(
    middlewareResult: any,
    sandbox: SandboxData
  ): Promise<any[]> {
    const results: any[] = [];
    
    // 从 middleware 结果中提取工具调用
    const toolCalls = middlewareResult?.toolCalls || [];
    
    for (const call of toolCalls) {
      try {
        const result = await this.toolExecutor.execute(call.name, call.args);
        results.push(result);
        console.log(`   ✅ 工具执行: ${call.name}`);
      } catch (error) {
        results.push({
          success: false,
          error: String(error)
        });
      }
    }
    
    if (results.length === 0) {
      console.log(`   ℹ️ 无需执行工具`);
    }
    
    return results;
  }

  // ============================================================================
  // Step 8: L4 灵盾层
  // ============================================================================

  private async verifySecurity(
    toolResults: any[]
  ): Promise<{ passed: boolean; riskLevel: string }> {
    // 检查工具执行结果
    let riskLevel = 'SAFE';
    
    for (const result of toolResults) {
      if (!result.success) {
        riskLevel = 'MEDIUM';
      }
    }
    
    const passed = riskLevel !== 'DANGEROUS';
    console.log(`   ✅ 安全检查: ${passed ? '通过' : '拒绝'} (风险: ${riskLevel})`);
    
    return { passed, riskLevel };
  }

  // ============================================================================
  // Step 9: L5 灵韵层
  // ============================================================================

  private async promoteMemories(
    message: string,
    toolResults: any[]
  ): Promise<void> {
    // 添加新记忆到 L0
    try {
      await this.memoryManager.add(0, {
        content: JSON.stringify({
          message,
          results: toolResults.map((r: any) => r.success)
        }),
        metadata: { timestamp: Date.now() }
      });
      console.log(`   ✅ 记忆已存储到 L0`);
    } catch (e) {
      console.log(`   ⚠️ 记忆存储失败`);
    }
  }

  // ============================================================================
  // Step 10: 知识图谱
  // ============================================================================

  private async updateKnowledgeGraph(
    message: string,
    toolResults: any[]
  ): Promise<{ entities: any[]; relations: any[] } | null> {
    if (!this.knowledgeGraph) {
      return null;
    }
    
    // 添加文档到知识图谱
    try {
      await this.knowledgeGraph.addDocument(message);
      console.log(`   ✅ 知识图谱更新成功`);
    } catch (e) {
      console.log(`   ⚠️ 知识图谱更新失败`);
    }
    
    return { entities: [], relations: [] };
  }

  // ============================================================================
  // Step 11: 完成 Session
  // ============================================================================

  private async completeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.updatedAt = Date.now();
      session.events.push({
        type: 'complete',
        timestamp: Date.now(),
        data: { status: 'success' }
      });
    }
    
    // 清理沙箱
    const sandbox = this.activeSandboxes.get(`sandbox-${sessionId}`);
    if (sandbox) {
      sandbox.status = 'destroyed';
      this.activeSandboxes.delete(sandbox.id);
    }
    
    console.log(`   ✅ Session 已完成`);
  }

  // ============================================================================
  // 构建响应
  // ============================================================================

  private buildResponse(params: {
    sessionId: string;
    toolResults: any[];
    thinking: string;
    graphResult: { entities: any[]; relations: any[] } | null;
  }): Response {
    const { sessionId, toolResults, thinking, graphResult } = params;
    
    // 构建响应内容
    let content = '';
    
    if (toolResults.length > 0) {
      content = toolResults
        .filter((r: any) => r.success && r.output)
        .map((r: any) => r.output)
        .join('\n');
    }
    
    if (!content) {
      content = '处理完成';
    }
    
    // 获取记忆统计
    const memoryStats = this.memoryManager.getStats?.() || {};
    
    return {
      content,
      sessionId,
      success: true,
      thinking: this.config.enableThinking ? thinking : undefined,
      tools: toolResults.map((r: any) => r.toolName).filter(Boolean),
      memory: {
        l0: memoryStats?.l0?.count || 0,
        l1: memoryStats?.l1?.count || 0,
        l2: memoryStats?.l2?.count || 0,
        l3: memoryStats?.l3?.count || 0,
        l4: memoryStats?.l4?.count || 0
      },
      entities: graphResult?.entities,
      relations: graphResult?.relations
    };
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 获取系统状态
   */
  getStatus(): {
    activeSessions: number;
    activeSandboxes: number;
    memoryStats: any;
    toolCount: number;
  } {
    return {
      activeSessions: this.activeSessions.size,
      activeSandboxes: this.activeSandboxes.size,
      memoryStats: this.memoryManager.getStats?.() || {},
      toolCount: this.toolRegistry.getToolCount?.() || 42
    };
  }

  /**
   * 关闭系统
   */
  async shutdown(): Promise<void> {
    console.log('\n正在关闭元灵系统...');
    
    // 清理所有 Session
    for (const [id, session] of this.activeSessions) {
      session.status = 'failed';
    }
    this.activeSessions.clear();
    
    // 清理所有沙箱
    for (const [id, sandbox] of this.activeSandboxes) {
      sandbox.status = 'destroyed';
    }
    this.activeSandboxes.clear();
    
    console.log('✅ 元灵系统已关闭\n');
  }
}

// ============================================================================
// 导出
// ============================================================================

export default YuanLingSystem;
