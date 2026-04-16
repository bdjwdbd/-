/**
 * L0 灵思层集成
 * 
 * 将灵思层集成到主系统
 */

import {
  ThinkingProtocolEngine,
  ThinkingResult,
  ThinkingContext,
  ThinkingDepth,
  MultiHypothesisManager,
  AdaptiveDepthController,
} from './layers/ling-si';

// 导出集成接口
export {
  ThinkingProtocolEngine,
  ThinkingResult,
  ThinkingContext,
  ThinkingDepth,
  MultiHypothesisManager,
  AdaptiveDepthController,
};

// L0 管理器
export class L0Manager {
  private engine: ThinkingProtocolEngine;
  private manager: MultiHypothesisManager;
  private controller: AdaptiveDepthController;

  constructor() {
    this.engine = new ThinkingProtocolEngine();
    this.manager = new MultiHypothesisManager();
    this.controller = new AdaptiveDepthController();
  }

  async think(message: string): Promise<ThinkingResult> {
    return this.engine.execute({ id: '1', content: message, type: 'text', timestamp: Date.now(), sessionId: 'default' });
  }
}

// 配置类型
export interface L0Config {
  maxTokens?: number;
  depth?: ThinkingDepth;
}

// 单例
let l0Manager: L0Manager | null = null;

export function getL0Manager(): L0Manager {
  if (!l0Manager) {
    l0Manager = new L0Manager();
  }
  return l0Manager;
}

// 快速思考函数
export async function quickThink(message: string): Promise<ThinkingResult> {
  const manager = getL0Manager();
  return manager.think(message);
}

// 创建默认实例
export const defaultEngine = new ThinkingProtocolEngine();
export const defaultManager = new MultiHypothesisManager();
export const defaultController = new AdaptiveDepthController();
