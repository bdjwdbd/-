/**
 * L0 灵思层集成模块
 * 
 * 在每次对话前自动运行思考过程
 */

import { ThinkingProtocolEngine, ThinkingDepth, ThinkingResult, HumanMessage } from './layers/ling-si';

export interface L0Config {
  enabled: boolean;
  defaultDepth: ThinkingDepth;
  maxThinkingTime: number; // 毫秒
}

const DEFAULT_CONFIG: L0Config = {
  enabled: true,
  defaultDepth: ThinkingDepth.STANDARD,
  maxThinkingTime: 5000, // 5秒
};

/**
 * L0 灵思层管理器
 */
export class L0Manager {
  private engine: ThinkingProtocolEngine;
  private config: L0Config;
  private lastThinking: ThinkingResult | null = null;

  constructor(config: Partial<L0Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.engine = new ThinkingProtocolEngine();
  }

  /**
   * 在对话前运行思考
   * 
   * @param message 用户消息
   * @returns 思考结果
   */
  async thinkBeforeReply(message: string): Promise<ThinkingResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const startTime = Date.now();
      
      // 分析消息复杂度，决定思考深度
      const depth = this.analyzeComplexity(message);
      
      // 构建人类消息
      const humanMessage: HumanMessage = {
        id: `msg_${Date.now()}`,
        content: message,
        type: 'text',
        timestamp: Date.now(),
        sessionId: 'default',
      };

      // 运行思考
      const result = await this.engine.execute(humanMessage);

      const elapsed = Date.now() - startTime;
      
      console.log(`[L0] 思考完成: 深度=${result.depth}, 耗时=${elapsed}ms, 假设=${result.hypotheses?.length || 0}个`);

      this.lastThinking = result;
      return result;
      
    } catch (error) {
      console.error('[L0] 思考过程出错:', error);
      return null;
    }
  }

  /**
   * 分析消息复杂度
   */
  private analyzeComplexity(message: string): ThinkingDepth {
    // 简单规则判断复杂度
    const len = message.length;
    const hasQuestion = message.includes('?') || message.includes('？');
    const hasComplexWords = /如何|为什么|分析|设计|优化|实现|架构/.test(message);
    const hasMultipleQuestions = (message.match(/[?？]/g) || []).length > 1;

    if (len > 200 || hasMultipleQuestions || hasComplexWords) {
      return ThinkingDepth.EXTENSIVE;
    } else if (len > 50 || hasQuestion) {
      return ThinkingDepth.STANDARD;
    } else {
      return ThinkingDepth.MINIMAL;
    }
  }

  /**
   * 获取上次思考结果
   */
  getLastThinking(): ThinkingResult | null {
    return this.lastThinking;
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============ 全局实例 ============

let globalL0Manager: L0Manager | null = null;

/**
 * 获取全局 L0 管理器
 */
export function getL0Manager(config?: Partial<L0Config>): L0Manager {
  if (!globalL0Manager) {
    globalL0Manager = new L0Manager(config);
  }
  return globalL0Manager;
}

/**
 * 快速思考（用于每次对话）
 */
export async function quickThink(message: string): Promise<{
  depth: string;
  hypotheses: number;
  confidence: number;
} | null> {
  const manager = getL0Manager();
  const result = await manager.thinkBeforeReply(message);
  
  if (!result) {
    return null;
  }

  return {
    depth: result.depth,
    hypotheses: result.hypotheses?.length || 0,
    confidence: result.confidence || 0,
  };
}
