/**
 * 元灵系统 v6.0 - OpenClaw 桥接层
 * 
 * 架构：元灵系统（主系统）→ OpenClaw（执行层）
 * 
 * 这个桥接层让元灵系统接管当前会话的主流程，
 * 同时保留 OpenClaw 的工具执行能力。
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface OpenClawExecutor {
  /** 调用模型 */
  callModel: (messages: any[]) => Promise<any>;
  /** 执行工具 */
  execTool: (tool: string, args: any) => Promise<any>;
  /** 读取文件 */
  readFile: (path: string) => Promise<string>;
  /** 写入文件 */
  writeFile: (path: string, content: string) => Promise<void>;
  /** 执行命令 */
  execCommand: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

export interface BridgeConfig {
  /** 是否启用思考协议 */
  enableThinking: boolean;
  /** 是否启用记忆系统 */
  enableMemory: boolean;
  /** 是否启用知识图谱 */
  enableKnowledgeGraph: boolean;
  /** 最大迭代次数 */
  maxIterations: number;
  /** 调试模式 */
  debug: boolean;
}

export interface BridgeContext {
  sessionId: string;
  userId: string;
  history: any[];
  metadata: Record<string, any>;
}

export interface BridgeResult {
  content: string;
  thinking?: string;
  tools?: string[];
  memory?: any;
  iterations: number;
  success: boolean;
}

// ============================================================================
// 元灵系统桥接层
// ============================================================================

export class YuanLingBridge {
  private executor: OpenClawExecutor;
  private config: BridgeConfig;
  private context: BridgeContext;
  private memory: Map<string, any> = new Map();

  constructor(executor: OpenClawExecutor, config: Partial<BridgeConfig> = {}) {
    this.executor = executor;
    this.config = {
      enableThinking: config.enableThinking ?? true,
      enableMemory: config.enableMemory ?? true,
      enableKnowledgeGraph: config.enableKnowledgeGraph ?? false,
      maxIterations: config.maxIterations ?? 10,
      debug: config.debug ?? false
    };
    this.context = {
      sessionId: `bridge-${Date.now()}`,
      userId: 'default',
      history: [],
      metadata: {}
    };
  }

  /**
   * 处理消息（主入口）
   * 
   * 流程：
   * 1. L0 灵思层 - 思考协议
   * 2. L1 灵枢层 - 查询分析
   * 3. L2 灵脉层 - 执行循环
   * 4. L4 灵盾层 - 验证结果
   * 5. L5 灵韵层 - 记忆存储
   */
  async processMessage(
    message: string, 
    history: any[] = [],
    context?: Partial<BridgeContext>
  ): Promise<BridgeResult> {
    const startTime = Date.now();
    
    // 更新上下文
    if (context) {
      Object.assign(this.context, context);
    }
    this.context.history = history;

    if (this.config.debug) {
      console.log('\n╔════════════════════════════════════════════════════════╗');
      console.log('║       元灵系统 v6.0 - 桥接模式                        ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log(`\n处理消息: ${message.substring(0, 50)}...`);
    }

    let iterations = 0;
    let currentMessage = message;
    let finalContent = '';
    let thinking = '';

    try {
      // Step 1: L0 灵思层 - 思考协议
      if (this.config.enableThinking) {
        thinking = await this.executeThinking(currentMessage);
        if (this.config.debug) {
          console.log('\n[L0 灵思层] 思考完成');
        }
      }

      // Step 2: L1 灵枢层 - 查询分析
      const analysis = await this.analyzeQuery(currentMessage);
      if (this.config.debug) {
        console.log(`[L1 灵枢层] 类型: ${analysis.type}, 复杂度: ${analysis.complexity}`);
      }

      // Step 3: L2 灵脉层 - 执行循环
      const toolsUsed: string[] = [];
      
      while (iterations < this.config.maxIterations) {
        iterations++;

        // 调用模型
        const modelResponse = await this.callModelWithContext(currentMessage, thinking, analysis);
        
        // 检查是否需要执行工具
        if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
          // 执行工具
          for (const toolCall of modelResponse.toolCalls) {
            const toolResult = await this.executeToolCall(toolCall);
            toolsUsed.push(toolCall.name);
            
            if (this.config.debug) {
              console.log(`[L3 灵躯层] 执行工具: ${toolCall.name}`);
            }
            
            // 将工具结果添加到上下文
            currentMessage = `工具 ${toolCall.name} 执行结果:\n${toolResult}`;
          }
        } else {
          // 没有工具调用，结束循环
          finalContent = modelResponse.content;
          break;
        }
      }

      // Step 4: L4 灵盾层 - 验证结果
      const validation = this.validateResult(finalContent);
      if (!validation.valid) {
        finalContent = validation.message;
      }

      // Step 5: L5 灵韵层 - 记忆存储
      if (this.config.enableMemory) {
        await this.storeMemory(message, finalContent);
        if (this.config.debug) {
          console.log('[L5 灵韵层] 记忆已存储');
        }
      }

      const elapsed = Date.now() - startTime;
      if (this.config.debug) {
        console.log(`\n✅ 处理完成，耗时 ${elapsed}ms，迭代 ${iterations} 次`);
      }

      return {
        content: finalContent,
        thinking: this.config.enableThinking ? thinking : undefined,
        tools: toolsUsed.length > 0 ? toolsUsed : undefined,
        iterations,
        success: true
      };

    } catch (error) {
      return {
        content: `处理失败: ${error}`,
        iterations,
        success: false
      };
    }
  }

  // ============================================================================
  // L0 灵思层 - 思考协议
  // ============================================================================

  private async executeThinking(message: string): Promise<string> {
    // 简化版思考协议
    const complexity = this.estimateComplexity(message);
    const depth = complexity > 0.7 ? 'DEEP' : complexity > 0.4 ? 'EXTENSIVE' : 'STANDARD';

    return `
[L0 思考协议]
思考深度: ${depth}
问题分析: ${message.substring(0, 100)}
复杂度估计: ${complexity}
置信度: 85%
    `.trim();
  }

  private estimateComplexity(message: string): number {
    let score = 0;
    
    // 长度
    score += Math.min(message.length / 500, 0.3);
    
    // 问题数量
    const questions = (message.match(/[？?]/g) || []).length;
    score += Math.min(questions * 0.1, 0.3);
    
    // 关键词
    const complexKeywords = ['分析', '比较', '为什么', '如何', '设计', '实现'];
    score += Math.min(complexKeywords.filter(k => message.includes(k)).length * 0.1, 0.4);
    
    return Math.min(score, 1);
  }

  // ============================================================================
  // L1 灵枢层 - 查询分析
  // ============================================================================

  private async analyzeQuery(message: string): Promise<{
    type: 'simple' | 'complex' | 'action' | 'creation';
    complexity: number;
    suggestedTools: string[];
  }> {
    const lower = message.toLowerCase();
    const complexity = this.estimateComplexity(message);
    const suggestedTools: string[] = [];

    let type: 'simple' | 'complex' | 'action' | 'creation' = 'simple';

    // 检测动作类
    if (lower.includes('执行') || lower.includes('运行') || lower.includes('调用') || 
        lower.includes('bash') || lower.includes('命令')) {
      type = 'action';
      suggestedTools.push('exec');
    }

    // 检测创建类
    if (lower.includes('创建') || lower.includes('生成') || lower.includes('写') ||
        lower.includes('实现') || lower.includes('添加')) {
      type = 'creation';
      suggestedTools.push('write', 'edit');
    }

    // 检测读取类
    if (lower.includes('读取') || lower.includes('查看') || lower.includes('列出')) {
      suggestedTools.push('read', 'exec');
    }

    // 检测复杂类
    if (lower.includes('分析') || lower.includes('比较') || lower.includes('为什么')) {
      type = 'complex';
    }

    return { type, complexity, suggestedTools };
  }

  // ============================================================================
  // L2 灵脉层 - 模型调用
  // ============================================================================

  private async callModelWithContext(
    message: string, 
    thinking: string, 
    analysis: any
  ): Promise<any> {
    // 构建消息
    const messages = [
      ...this.context.history,
      {
        role: 'user',
        content: this.config.enableThinking 
          ? `${thinking}\n\n用户消息: ${message}`
          : message
      }
    ];

    // 调用模型
    return this.executor.callModel(messages);
  }

  // ============================================================================
  // L3 灵躯层 - 工具执行
  // ============================================================================

  private async executeToolCall(toolCall: { name: string; arguments: any }): Promise<string> {
    const { name, arguments: args } = toolCall;

    try {
      switch (name) {
        case 'read':
        case 'readFile':
          return await this.executor.readFile(args.path);
        
        case 'write':
        case 'writeFile':
          await this.executor.writeFile(args.path, args.content);
          return `文件已写入: ${args.path}`;
        
        case 'exec':
        case 'bash':
          const result = await this.executor.execCommand(args.command);
          return result.stdout || result.stderr;
        
        default:
          return await this.executor.execTool(name, args);
      }
    } catch (error) {
      return `工具执行失败: ${error}`;
    }
  }

  // ============================================================================
  // L4 灵盾层 - 结果验证
  // ============================================================================

  private validateResult(content: string): { valid: boolean; message: string } {
    if (!content || content.trim().length === 0) {
      return { valid: false, message: '未能生成有效响应' };
    }

    // 检查是否包含错误信息
    if (content.includes('失败') && content.includes('错误')) {
      return { valid: false, message: content };
    }

    return { valid: true, message: content };
  }

  // ============================================================================
  // L5 灵韵层 - 记忆存储
  // ============================================================================

  private async storeMemory(message: string, response: string): Promise<void> {
    const key = `mem-${Date.now()}`;
    this.memory.set(key, {
      message,
      response,
      timestamp: Date.now()
    });
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 获取记忆
   */
  getMemory(): Map<string, any> {
    return this.memory;
  }

  /**
   * 清除记忆
   */
  clearMemory(): void {
    this.memory.clear();
  }

  /**
   * 获取上下文
   */
  getContext(): BridgeContext {
    return this.context;
  }
}

// ============================================================================
// 快速创建函数
// ============================================================================

export function createBridge(
  executor: OpenClawExecutor,
  config?: Partial<BridgeConfig>
): YuanLingBridge {
  return new YuanLingBridge(executor, config);
}

// ============================================================================
// 导出
// ============================================================================

export default YuanLingBridge;
