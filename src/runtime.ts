/**
 * 元灵系统 v6.0 独立运行入口
 * 
 * 架构：元灵系统（主系统）
 * 
 * 元灵系统是大脑，负责：
 * - 思考（L0 灵思层）
 * - 决策（L1 灵枢层）
 * - 编排（L2 灵脉层）
 * - 记忆（五层记忆）
 * - 安全（L4 灵盾层）
 * - 学习（L5 灵韵层）
 * 
 * 工具执行可以委托给外部系统，但主控权在元灵系统
 */

import YuanLingSystem from './index';

// ============================================================================
// 配置
// ============================================================================

interface RuntimeConfig {
  /** 模型 API 配置 */
  model: {
    provider: 'openai' | 'anthropic' | 'deepseek' | 'local';
    apiKey?: string;
    baseUrl?: string;
    model: string;
  };
  
  /** 是否启用各层 */
  layers: {
    thinking: boolean;
    memory: boolean;
    knowledge: boolean;
    sandbox: boolean;
  };
  
  /** 服务配置 */
  server?: {
    port: number;
    host: string;
  };
}

// ============================================================================
// 模型调用器
// ============================================================================

class ModelCaller {
  private config: RuntimeConfig['model'];

  constructor(config: RuntimeConfig['model']) {
    this.config = config;
  }

  async call(messages: any[]): Promise<any> {
    switch (this.config.provider) {
      case 'openai':
        return this.callOpenAI(messages);
      case 'anthropic':
        return this.callAnthropic(messages);
      case 'deepseek':
        return this.callDeepSeek(messages);
      case 'local':
        return this.callLocal(messages);
      default:
        return this.callMock(messages);
    }
  }

  private async callOpenAI(messages: any[]): Promise<any> {
    // TODO: 实现 OpenAI API 调用
    return this.callMock(messages);
  }

  private async callAnthropic(messages: any[]): Promise<any> {
    // TODO: 实现 Anthropic API 调用
    return this.callMock(messages);
  }

  private async callDeepSeek(messages: any[]): Promise<any> {
    // TODO: 实现 DeepSeek API 调用
    return this.callMock(messages);
  }

  private async callLocal(messages: any[]): Promise<any> {
    // TODO: 实现本地模型调用
    return this.callMock(messages);
  }

  private async callMock(messages: any[]): Promise<any> {
    // 模拟响应
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '';

    return {
      content: `元灵系统已处理您的请求: "${content.substring(0, 50)}..."`,
      toolCalls: [],
      isComplete: true
    };
  }
}

// ============================================================================
// 元灵系统运行时
// ============================================================================

export class YuanLingRuntime {
  private system: YuanLingSystem;
  private modelCaller: ModelCaller;
  private config: RuntimeConfig;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.modelCaller = new ModelCaller(config.model);
    
    // 创建元灵系统
    this.system = new YuanLingSystem({
      modelCaller: async (messages) => this.modelCaller.call(messages),
      enableThinking: config.layers.thinking,
      enableKnowledgeGraph: config.layers.knowledge
    });
  }

  /**
   * 处理消息（主入口）
   */
  async process(message: string, context?: any): Promise<any> {
    console.log('\n' + '═'.repeat(60));
    console.log('  元灵系统 v6.0 - 独立运行模式');
    console.log('═'.repeat(60));
    console.log('');

    const response = await this.system.process(message, context);

    console.log('\n' + '─'.repeat(60));
    console.log('  响应');
    console.log('─'.repeat(60));
    console.log('');
    console.log(response.content);
    console.log('');

    if (response.thinking) {
      console.log('─'.repeat(60));
      console.log('  思考过程');
      console.log('─'.repeat(60));
      console.log(response.thinking);
      console.log('');
    }

    return response;
  }

  /**
   * 启动 HTTP 服务（可选）
   */
  async startServer(): Promise<void> {
    if (!this.config.server) {
      console.log('未配置 HTTP 服务');
      return;
    }

    const { port, host } = this.config.server;
    console.log(`\n启动 HTTP 服务: http://${host}:${port}`);
    
    // TODO: 实现 HTTP 服务
    console.log('（HTTP 服务待实现）');
  }

  /**
   * 获取系统状态
   */
  getStatus(): any {
    return this.system.getStatus();
  }

  /**
   * 关闭系统
   */
  async shutdown(): Promise<void> {
    await this.system.shutdown();
  }
}

// ============================================================================
// 默认配置
// ============================================================================

export const defaultConfig: RuntimeConfig = {
  model: {
    provider: 'local',
    model: 'default'
  },
  layers: {
    thinking: true,
    memory: true,
    knowledge: true,
    sandbox: true
  }
};

// ============================================================================
// 快速启动函数
// ============================================================================

export async function quickStart(
  message: string, 
  config: Partial<RuntimeConfig> = {}
): Promise<any> {
  const runtime = new YuanLingRuntime({
    ...defaultConfig,
    ...config,
    model: {
      ...defaultConfig.model,
      ...config.model
    },
    layers: {
      ...defaultConfig.layers,
      ...config.layers
    }
  });

  const response = await runtime.process(message);
  await runtime.shutdown();

  return response;
}

// ============================================================================
// 导出
// ============================================================================

export default YuanLingRuntime;
