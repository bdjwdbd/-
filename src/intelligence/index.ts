/**
 * 智能系统 - 统一入口
 * 
 * 整合所有智能组件：
 * - 意图识别引擎
 * - 工具匹配器
 * - Skill 发现器
 * - 任务编排器
 * 
 * 实现全智能：用户只需要说一句话，系统自动完成所有事情
 */

import { IntentEngine, IntentAnalysisResult, createIntentEngine } from './intent-engine';
import { ToolMatcher, ToolMatchResult, createToolMatcher } from './tool-matcher';
import { SkillDiscovery, SkillMatchResult, createSkillDiscovery } from './skill-discovery';
import { TaskOrchestrator, ExecutionPlan, createTaskOrchestrator } from './task-orchestrator';

// ============ 类型定义 ============

export interface IntelligenceResult {
  /** 意图分析结果 */
  intent: IntentAnalysisResult;
  /** 工具匹配结果 */
  tools: ToolMatchResult[];
  /** Skill 匹配结果 */
  skills: SkillMatchResult[];
  /** 执行计划 */
  plan: ExecutionPlan;
  /** 建议的模块 */
  modules: string[];
}

// ============ 智能系统 ============

export class IntelligenceSystem {
  private intentEngine: IntentEngine;
  private toolMatcher: ToolMatcher;
  private skillDiscovery: SkillDiscovery;
  private taskOrchestrator: TaskOrchestrator;
  
  constructor() {
    this.intentEngine = createIntentEngine();
    this.toolMatcher = createToolMatcher();
    this.skillDiscovery = createSkillDiscovery();
    this.taskOrchestrator = createTaskOrchestrator();
  }
  
  /**
   * 分析用户消息，生成完整的执行方案
   * 
   * 这是核心方法：用户只需要说一句话，系统自动完成：
   * 1. 意图识别
   * 2. 工具选择
   * 3. Skill 发现
   * 4. 任务编排
   */
  async analyze(message: string): Promise<IntelligenceResult> {
    // 1. 意图识别
    const intent = await this.intentEngine.analyze(message);
    
    // 2. 工具匹配
    const tools = this.toolMatcher.match(intent.primary);
    
    // 3. Skill 发现
    const skills = this.skillDiscovery.discover(intent.primary);
    
    // 4. 任务编排
    const plan = this.taskOrchestrator.createPlan(intent, tools, skills);
    
    // 5. 收集建议的模块
    const modules = [...new Set(intent.suggestedModules)];
    
    return {
      intent,
      tools,
      skills,
      plan,
      modules,
    };
  }
  
  /**
   * 快速分析（仅返回意图和建议）
   */
  async quickAnalyze(message: string): Promise<{
    intent: string;
    confidence: number;
    suggestedTools: string[];
    suggestedSkills: string[];
    suggestedModules: string[];
  }> {
    const intent = await this.intentEngine.analyze(message);
    
    return {
      intent: intent.primary.type,
      confidence: intent.primary.confidence,
      suggestedTools: intent.suggestedTools,
      suggestedSkills: intent.suggestedSkills,
      suggestedModules: intent.suggestedModules,
    };
  }
  
  /**
   * 获取意图引擎
   */
  getIntentEngine(): IntentEngine {
    return this.intentEngine;
  }
  
  /**
   * 获取工具匹配器
   */
  getToolMatcher(): ToolMatcher {
    return this.toolMatcher;
  }
  
  /**
   * 获取 Skill 发现器
   */
  getSkillDiscovery(): SkillDiscovery {
    return this.skillDiscovery;
  }
  
  /**
   * 获取任务编排器
   */
  getTaskOrchestrator(): TaskOrchestrator {
    return this.taskOrchestrator;
  }
}

// ============ 工厂函数 ============

export function createIntelligenceSystem(): IntelligenceSystem {
  return new IntelligenceSystem();
}

// ============ 导出所有类型和组件 ============

export { IntentEngine, Intent, IntentType, IntentAnalysisResult, createIntentEngine } from './intent-engine';
export { ToolMatcher, Tool, ToolMatchResult, createToolMatcher } from './tool-matcher';
export { SkillDiscovery, Skill, SkillMatchResult, createSkillDiscovery } from './skill-discovery';
export { TaskOrchestrator, TaskStep, ExecutionPlan, ExecutionResult, createTaskOrchestrator } from './task-orchestrator';
