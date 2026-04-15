/**
 * 工作流编排器
 *
 * 基于 qiushi-skill 的 workflows
 * 标准化工作流组合，解决"应该先用哪个 skill、怎么衔接"的问题
 */

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  name: string;
  skill: string;
  description: string;
  outputFormat: string;
  terminationCondition: string;
}

/**
 * 工作流定义
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  triggerSignals: string[];
  steps: WorkflowStep[];
  dataTransferRules: string[];
}

/**
 * 工作流执行结果
 */
export interface WorkflowResult {
  workflowId: string;
  currentStep: number;
  completedSteps: string[];
  outputs: Record<string, unknown>;
  status: "running" | "completed" | "blocked" | "failed";
  nextAction?: string;
}

/**
 * 预定义工作流
 */
const WORKFLOWS: Workflow[] = [
  {
    id: "new_project",
    name: "新项目启动",
    description: "从零开始面对一个新任务/项目/领域，目标已知但路径未知",
    triggerSignals: ["新项目", "新领域", "MVP", "从零开始", "不知道从哪里下手"],
    steps: [
      {
        name: "调查研究",
        skill: "investigation-first",
        description: "摸清现状，占有第一手材料",
        outputFormat: "调查结论：现状是...；关键约束是...；主要未知项是...",
        terminationCondition: "能够回答'现在是什么情况'",
      },
      {
        name: "矛盾分析",
        skill: "contradiction-analysis",
        description: "识别主要矛盾，找到切入点",
        outputFormat: "主要矛盾：[A] vs [B]；切入点：...",
        terminationCondition: "找到一个明确的主要矛盾和切入点",
      },
      {
        name: "星火燎原",
        skill: "spark-prairie-fire",
        description: "以切入点为根据地，制定发展路线",
        outputFormat: "根据地：...；发展路线：第1步...第2步...",
        terminationCondition: "有一条清晰的发展路线",
      },
      {
        name: "持久战略",
        skill: "protracted-strategy",
        description: "纳入阶段性战略框架",
        outputFormat: "当前阶段：...；核心任务：...；转换条件：...",
        terminationCondition: "有明确的阶段定位和转换条件",
      },
    ],
    dataTransferRules: [
      "每个步骤结束时，写出格式化的'传递给下一步的信息'",
      "下一步开始时，确认收到并引用上一步的输出",
      "不得跳步骤执行",
    ],
  },
  {
    id: "problem_solving",
    name: "复杂问题攻坚",
    description: "面对一个已知存在但难以解决的具体问题",
    triggerSignals: ["疑难", "bug", "瓶颈", "反复失败", "根因不明"],
    steps: [
      {
        name: "调查研究",
        skill: "investigation-first",
        description: "弄清问题的真实面目",
        outputFormat: "问题现象是...；出现条件是...；已排除原因是...",
        terminationCondition: "能够精确描述问题",
      },
      {
        name: "矛盾分析",
        skill: "contradiction-analysis",
        description: "找到问题中的主要矛盾",
        outputFormat: "主要矛盾：...；假说：...；验证方式：...",
        terminationCondition: "有一个可以验证的假说",
      },
      {
        name: "集中兵力",
        skill: "concentrate-forces",
        description: "围绕验证假说，集中全部力量",
        outputFormat: "主攻目标：...；验证方法：...；暂缓方向：...",
        terminationCondition: "假说被验证（证实或证伪）",
      },
      {
        name: "实践认识论",
        skill: "practice-cognition",
        description: "根据验证结果，更新认识",
        outputFormat: "本轮学到的是：...；下轮将：...",
        terminationCondition: "问题被彻底解决",
      },
      {
        name: "批评与自我批评",
        skill: "criticism-self-criticism",
        description: "审视攻坚过程中的方法论失误",
        outputFormat: "工作审视报告",
        terminationCondition: "输出结构化审视报告",
      },
    ],
    dataTransferRules: [
      "假说被证伪则返回矛盾分析步骤",
      "每轮循环必须输出学习总结",
    ],
  },
  {
    id: "iteration",
    name: "方案迭代优化",
    description: "已有基础方案，需要迭代改进",
    triggerSignals: ["迭代", "优化", "反馈", "改进", "效果不理想"],
    steps: [
      {
        name: "群众路线",
        skill: "mass-line",
        description: "从多个信息源收集反馈",
        outputFormat: "收集到的多源反馈：...；共同指向的问题：...",
        terminationCondition: "有来自至少2个信息源的反馈",
      },
      {
        name: "矛盾分析",
        skill: "contradiction-analysis",
        description: "识别需要优先解决的主要矛盾",
        outputFormat: "本轮主要矛盾：...；改进假说：...",
        terminationCondition: "有明确的改进假说",
      },
      {
        name: "实践认识论",
        skill: "practice-cognition",
        description: "实施改进并验证效果",
        outputFormat: "验证结果：...",
        terminationCondition: "达到预设指标",
      },
      {
        name: "批评与自我批评",
        skill: "criticism-self-criticism",
        description: "审视本轮迭代的过程质量",
        outputFormat: "工作审视报告",
        terminationCondition: "输出审视报告",
      },
    ],
    dataTransferRules: [
      "循环执行直到反馈显示'没有新的重要问题'",
      "每轮迭代必须输出审视报告",
    ],
  },
];

/**
 * 工作流编排器
 */
export class WorkflowOrchestrator {
  private workflows: Map<string, Workflow> = new Map();
  private activeExecutions: Map<string, WorkflowResult> = new Map();

  constructor() {
    for (const workflow of WORKFLOWS) {
      this.workflows.set(workflow.id, workflow);
    }
  }

  /**
   * 选择工作流
   */
  selectWorkflow(task: string): Workflow | null {
    const lower = task.toLowerCase();

    for (const workflow of this.workflows.values()) {
      for (const signal of workflow.triggerSignals) {
        if (lower.includes(signal)) {
          return workflow;
        }
      }
    }

    return null;
  }

  /**
   * 开始工作流
   */
  startWorkflow(workflowId: string): WorkflowResult {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`工作流 ${workflowId} 不存在`);
    }

    const executionId = `${workflowId}_${Date.now()}`;
    const result: WorkflowResult = {
      workflowId,
      currentStep: 0,
      completedSteps: [],
      outputs: {},
      status: "running",
      nextAction: workflow.steps[0].description,
    };

    this.activeExecutions.set(executionId, result);
    return result;
  }

  /**
   * 获取当前步骤
   */
  getCurrentStep(result: WorkflowResult): WorkflowStep | null {
    const workflow = this.workflows.get(result.workflowId);
    if (!workflow) return null;

    if (result.currentStep >= workflow.steps.length) {
      return null;
    }

    return workflow.steps[result.currentStep];
  }

  /**
   * 推进到下一步
   */
  advanceStep(result: WorkflowResult, output: Record<string, unknown>): WorkflowResult {
    const workflow = this.workflows.get(result.workflowId);
    if (!workflow) {
      result.status = "failed";
      return result;
    }

    const currentStep = workflow.steps[result.currentStep];
    result.completedSteps.push(currentStep.name);
    result.outputs[currentStep.name] = output;

    result.currentStep++;

    if (result.currentStep >= workflow.steps.length) {
      result.status = "completed";
      result.nextAction = undefined;
    } else {
      const nextStep = workflow.steps[result.currentStep];
      result.nextAction = nextStep.description;
    }

    return result;
  }

  /**
   * 获取工作流列表
   */
  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * 获取工作流详情
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }
}

// 导出单例
export const workflowOrchestrator = new WorkflowOrchestrator();
