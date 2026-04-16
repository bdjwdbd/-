/**
 * 任务编排器
 * 
 * 核心能力：自动编排执行步骤
 * - 任务分解
 * - 依赖分析
 * - 执行计划生成
 * - 并行/串行执行
 */

import { Intent, IntentAnalysisResult } from './intent-engine';
import { Tool, ToolMatchResult } from './tool-matcher';
import { Skill, SkillMatchResult } from './skill-discovery';

// ============ 类型定义 ============

export interface TaskStep {
  /** 步骤 ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤描述 */
  description: string;
  /** 使用的工具 */
  tool?: Tool;
  /** 使用的 Skill */
  skill?: Skill;
  /** 参数 */
  params: Record<string, any>;
  /** 依赖的步骤 */
  dependencies: string[];
  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** 执行结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
}

export interface ExecutionPlan {
  /** 计划 ID */
  id: string;
  /** 计划名称 */
  name: string;
  /** 原始意图 */
  intent: Intent;
  /** 执行步骤 */
  steps: TaskStep[];
  /** 是否可并行 */
  parallelizable: boolean;
  /** 预计耗时 (ms) */
  estimatedDuration: number;
}

export interface ExecutionResult {
  /** 计划 ID */
  planId: string;
  /** 是否成功 */
  success: boolean;
  /** 执行结果 */
  results: Map<string, any>;
  /** 错误信息 */
  errors: Map<string, string>;
  /** 实际耗时 (ms) */
  actualDuration: number;
}

// ============ 任务编排器 ============

export class TaskOrchestrator {
  private stepCounter = 0;
  
  /**
   * 创建执行计划
   */
  createPlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    skillMatches: SkillMatchResult[]
  ): ExecutionPlan {
    const steps: TaskStep[] = [];
    const intent = intentResult.primary;
    
    // 根据意图类型生成不同的执行计划
    switch (intent.type) {
      case 'search':
        steps.push(...this.createSearchPlan(intentResult, toolMatches, skillMatches));
        break;
      case 'create':
        steps.push(...this.createCreatePlan(intentResult, toolMatches, skillMatches));
        break;
      case 'analyze':
        steps.push(...this.createAnalyzePlan(intentResult, toolMatches, skillMatches));
        break;
      case 'monitor':
        steps.push(...this.createMonitorPlan(intentResult, toolMatches, skillMatches));
        break;
      case 'communicate':
        steps.push(...this.createCommunicatePlan(intentResult, toolMatches, skillMatches));
        break;
      case 'schedule':
        steps.push(...this.createSchedulePlan(intentResult, toolMatches, skillMatches));
        break;
      case 'remind':
        steps.push(...this.createRemindPlan(intentResult, toolMatches, skillMatches));
        break;
      case 'execute':
        steps.push(...this.createExecutePlan(intentResult, toolMatches, skillMatches));
        break;
      case 'deploy':
        steps.push(...this.createDeployPlan(intentResult, toolMatches, skillMatches));
        break;
      case 'optimize':
        steps.push(...this.createOptimizePlan(intentResult, toolMatches, skillMatches));
        break;
      case 'introspect':
        steps.push(...this.createIntrospectPlan(intentResult, toolMatches, skillMatches));
        break;
      default:
        steps.push(...this.createDefaultPlan(intentResult, toolMatches, skillMatches));
    }
    
    // 分析依赖关系
    this.analyzeDependencies(steps);
    
    // 检查是否可并行
    const parallelizable = this.checkParallelizable(steps);
    
    // 估算耗时
    const estimatedDuration = this.estimateDuration(steps);
    
    return {
      id: `plan_${Date.now()}`,
      name: `${intent.type} 任务`,
      intent,
      steps,
      parallelizable,
      estimatedDuration,
    };
  }
  
  /**
   * 创建搜索计划
   */
  private createSearchPlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    // 步骤 1: 使用搜索工具
    if (toolMatches.length > 0) {
      const bestTool = toolMatches[0].tool;
      steps.push({
        id: this.generateStepId(),
        name: '执行搜索',
        description: `使用 ${bestTool.name} 搜索信息`,
        tool: bestTool,
        params: { query: intentResult.primary.target || intentResult.rawMessage },
        dependencies: [],
        status: 'pending',
      });
    }
    
    // 步骤 2: 使用 Skill 增强（如果有）
    if (skillMatches.length > 0) {
      const bestSkill = skillMatches[0].skill;
      steps.push({
        id: this.generateStepId(),
        name: '深度分析',
        description: `使用 ${bestSkill.name} 深度分析搜索结果`,
        skill: bestSkill,
        params: {},
        dependencies: steps.length > 0 ? [steps[0].id] : [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建创作计划
   */
  private createCreatePlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    // 步骤 1: 使用创作 Skill
    if (skillMatches.length > 0) {
      const bestSkill = skillMatches[0].skill;
      steps.push({
        id: this.generateStepId(),
        name: '内容创作',
        description: `使用 ${bestSkill.name} 创作内容`,
        skill: bestSkill,
        params: { topic: intentResult.primary.target || intentResult.rawMessage },
        dependencies: [],
        status: 'pending',
      });
    }
    
    // 步骤 2: 保存结果
    if (toolMatches.length > 0) {
      const writeTool = toolMatches.find(m => m.tool.name === 'write');
      if (writeTool) {
        steps.push({
          id: this.generateStepId(),
          name: '保存内容',
          description: '保存创作的内容到文件',
          tool: writeTool.tool,
          params: {},
          dependencies: steps.length > 0 ? [steps[0].id] : [],
          status: 'pending',
        });
      }
    }
    
    return steps;
  }
  
  /**
   * 创建分析计划
   */
  private createAnalyzePlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    // 步骤 1: 读取数据
    const readTool = toolMatches.find(m => m.tool.name === 'read');
    if (readTool) {
      steps.push({
        id: this.generateStepId(),
        name: '读取数据',
        description: '读取需要分析的数据',
        tool: readTool.tool,
        params: { path: intentResult.primary.target || '' },
        dependencies: [],
        status: 'pending',
      });
    }
    
    // 步骤 2: 分析数据
    if (skillMatches.length > 0) {
      const bestSkill = skillMatches[0].skill;
      steps.push({
        id: this.generateStepId(),
        name: '数据分析',
        description: `使用 ${bestSkill.name} 分析数据`,
        skill: bestSkill,
        params: {},
        dependencies: steps.length > 0 ? [steps[0].id] : [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建监控计划
   */
  private createMonitorPlan(
    intentResult: IntentAnalysisResult,
    _toolMatches: ToolMatchResult[],
    _skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    return [{
      id: this.generateStepId(),
      name: '启动监控',
      description: '启动系统监控面板',
      params: { target: intentResult.primary.target || 'system' },
      dependencies: [],
      status: 'pending',
    }];
  }
  
  /**
   * 创建通信计划
   */
  private createCommunicatePlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    _skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    if (toolMatches.length > 0) {
      const bestTool = toolMatches[0].tool;
      steps.push({
        id: this.generateStepId(),
        name: '发送消息',
        description: `使用 ${bestTool.name} 发送消息`,
        tool: bestTool,
        params: { 
          message: intentResult.primary.target || intentResult.rawMessage,
        },
        dependencies: [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建日程计划
   */
  private createSchedulePlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    _skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    if (toolMatches.length > 0) {
      const bestTool = toolMatches[0].tool;
      steps.push({
        id: this.generateStepId(),
        name: '创建日程',
        description: `使用 ${bestTool.name} 创建日程`,
        tool: bestTool,
        params: { 
          title: intentResult.primary.target || '新日程',
        },
        dependencies: [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建提醒计划
   */
  private createRemindPlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    _skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    if (toolMatches.length > 0) {
      const bestTool = toolMatches[0].tool;
      steps.push({
        id: this.generateStepId(),
        name: '创建提醒',
        description: `使用 ${bestTool.name} 创建提醒`,
        tool: bestTool,
        params: { 
          content: intentResult.primary.target || intentResult.rawMessage,
        },
        dependencies: [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建执行计划
   */
  private createExecutePlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    _skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    if (toolMatches.length > 0) {
      const bestTool = toolMatches[0].tool;
      steps.push({
        id: this.generateStepId(),
        name: '执行命令',
        description: `使用 ${bestTool.name} 执行命令`,
        tool: bestTool,
        params: { 
          command: intentResult.primary.target || '',
        },
        dependencies: [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建部署计划
   */
  private createDeployPlan(
    intentResult: IntentAnalysisResult,
    _toolMatches: ToolMatchResult[],
    skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    if (skillMatches.length > 0) {
      const bestSkill = skillMatches[0].skill;
      steps.push({
        id: this.generateStepId(),
        name: '部署应用',
        description: `使用 ${bestSkill.name} 部署应用`,
        skill: bestSkill,
        params: { 
          target: intentResult.primary.target || '',
        },
        dependencies: [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建优化计划
   */
  private createOptimizePlan(
    intentResult: IntentAnalysisResult,
    _toolMatches: ToolMatchResult[],
    skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    if (skillMatches.length > 0) {
      const bestSkill = skillMatches[0].skill;
      steps.push({
        id: this.generateStepId(),
        name: '系统优化',
        description: `使用 ${bestSkill.name} 优化系统`,
        skill: bestSkill,
        params: { 
          target: intentResult.primary.target || 'system',
        },
        dependencies: [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建自省计划
   */
  private createIntrospectPlan(
    intentResult: IntentAnalysisResult,
    _toolMatches: ToolMatchResult[],
    skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    if (skillMatches.length > 0) {
      const bestSkill = skillMatches[0].skill;
      steps.push({
        id: this.generateStepId(),
        name: '系统检查',
        description: `使用 ${bestSkill.name} 检查系统`,
        skill: bestSkill,
        params: { 
          target: intentResult.primary.target || 'system',
        },
        dependencies: [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 创建默认计划
   */
  private createDefaultPlan(
    intentResult: IntentAnalysisResult,
    toolMatches: ToolMatchResult[],
    skillMatches: SkillMatchResult[]
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    
    // 优先使用 Skill
    if (skillMatches.length > 0) {
      const bestSkill = skillMatches[0].skill;
      steps.push({
        id: this.generateStepId(),
        name: '执行任务',
        description: `使用 ${bestSkill.name} 执行任务`,
        skill: bestSkill,
        params: { 
          message: intentResult.rawMessage,
        },
        dependencies: [],
        status: 'pending',
      });
    } else if (toolMatches.length > 0) {
      // 使用工具
      const bestTool = toolMatches[0].tool;
      steps.push({
        id: this.generateStepId(),
        name: '执行任务',
        description: `使用 ${bestTool.name} 执行任务`,
        tool: bestTool,
        params: { 
          message: intentResult.rawMessage,
        },
        dependencies: [],
        status: 'pending',
      });
    }
    
    return steps;
  }
  
  /**
   * 分析依赖关系
   */
  private analyzeDependencies(steps: TaskStep[]): void {
    // 简单的依赖分析：后续步骤依赖前一步骤
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].dependencies.length === 0) {
        steps[i].dependencies.push(steps[i - 1].id);
      }
    }
  }
  
  /**
   * 检查是否可并行
   */
  private checkParallelizable(steps: TaskStep[]): boolean {
    // 如果所有步骤都没有依赖，则可并行
    return steps.every(step => step.dependencies.length === 0);
  }
  
  /**
   * 估算耗时
   */
  private estimateDuration(steps: TaskStep[]): number {
    // 简单估算：每个步骤 100ms
    return steps.length * 100;
  }
  
  /**
   * 生成步骤 ID
   */
  private generateStepId(): string {
    return `step_${++this.stepCounter}_${Date.now()}`;
  }
}

// ============ 工厂函数 ============

export function createTaskOrchestrator(): TaskOrchestrator {
  return new TaskOrchestrator();
}
