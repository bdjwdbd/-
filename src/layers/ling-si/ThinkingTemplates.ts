/**
 * 领域特定思考模板
 * 
 * 为不同领域提供专门的思考模板
 * 包括：代码审查、架构设计、问题诊断、数据分析等
 */

import {
  ThinkingStepName,
  ThinkingStepResult,
  ThinkingContext,
  Hypothesis,
  HypothesisStatus,
  HumanMessage,
  getRandomTransition,
} from "./types";

/**
 * 思考模板接口
 */
export interface ThinkingTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 适用领域 */
  domain: string;
  /** 触发关键词 */
  triggers: string[];
  /** 自定义步骤 */
  customSteps: ThinkingStepName[];
  /** 领域特定分析 */
  domainAnalysis: (message: HumanMessage) => string[];
  /** 领域特定假设 */
  domainHypotheses: (message: HumanMessage) => Hypothesis[];
}

// ============================================================
// 代码审查模板
// ============================================================

export const codeReviewTemplate: ThinkingTemplate = {
  id: "code-review",
  name: "代码审查模板",
  domain: "programming",
  triggers: ["代码", "code", "审查", "review", "检查", "check"],

  customSteps: [
    ThinkingStepName.INITIAL_ENGAGEMENT,
    ThinkingStepName.PROBLEM_ANALYSIS,
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    ThinkingStepName.TESTING_VERIFICATION,
    ThinkingStepName.KNOWLEDGE_SYNTHESIS,
  ],

  domainAnalysis: (message: HumanMessage): string[] => {
    const analysis: string[] = [];
    const content = message.content.toLowerCase();

    // 代码质量维度
    analysis.push("=== 代码质量维度 ===");
    analysis.push("1. 正确性：代码是否实现了预期功能？");
    analysis.push("2. 可读性：代码是否易于理解？");
    analysis.push("3. 可维护性：代码是否易于修改和扩展？");
    analysis.push("4. 性能：代码是否高效？");
    analysis.push("5. 安全性：代码是否存在安全漏洞？");

    // 检测特定问题
    if (content.includes("bug") || content.includes("错误")) {
      analysis.push("\n=== Bug 检查点 ===");
      analysis.push("- 边界条件处理");
      analysis.push("- 空值/异常处理");
      analysis.push("- 逻辑错误");
      analysis.push("- 资源泄漏");
    }

    if (content.includes("性能") || content.includes("performance")) {
      analysis.push("\n=== 性能检查点 ===");
      analysis.push("- 时间复杂度");
      analysis.push("- 空间复杂度");
      analysis.push("- 循环优化");
      analysis.push("- 缓存使用");
    }

    return analysis;
  },

  domainHypotheses: (message: HumanMessage): Hypothesis[] => {
    const hypotheses: Hypothesis[] = [];
    const content = message.content.toLowerCase();

    if (content.includes("bug") || content.includes("错误")) {
      hypotheses.push({
        id: "hyp_bug_1",
        content: "Bug 可能由边界条件处理不当引起",
        confidence: 0.6,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });

      hypotheses.push({
        id: "hyp_bug_2",
        content: "Bug 可能由空值/异常未处理引起",
        confidence: 0.5,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });
    }

    if (content.includes("性能") || content.includes("慢")) {
      hypotheses.push({
        id: "hyp_perf_1",
        content: "性能问题可能由 O(n²) 或更高复杂度算法引起",
        confidence: 0.5,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });

      hypotheses.push({
        id: "hyp_perf_2",
        content: "性能问题可能由频繁的 I/O 操作引起",
        confidence: 0.4,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });
    }

    return hypotheses;
  },
};

// ============================================================
// 架构设计模板
// ============================================================

export const architectureDesignTemplate: ThinkingTemplate = {
  id: "architecture-design",
  name: "架构设计模板",
  domain: "architecture",
  triggers: ["架构", "architecture", "设计", "design", "系统", "system"],

  customSteps: [
    ThinkingStepName.INITIAL_ENGAGEMENT,
    ThinkingStepName.PROBLEM_ANALYSIS,
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    ThinkingStepName.NATURAL_DISCOVERY,
    ThinkingStepName.KNOWLEDGE_SYNTHESIS,
    ThinkingStepName.RECURSIVE_THINKING,
  ],

  domainAnalysis: (message: HumanMessage): string[] => {
    const analysis: string[] = [];
    const content = message.content.toLowerCase();

    // 架构质量属性
    analysis.push("=== 架构质量属性 ===");
    analysis.push("1. 可扩展性：系统是否能应对增长？");
    analysis.push("2. 可靠性：系统是否稳定可靠？");
    analysis.push("3. 可维护性：系统是否易于维护？");
    analysis.push("4. 安全性：系统是否安全？");
    analysis.push("5. 性能：系统是否满足性能要求？");

    // 架构决策点
    analysis.push("\n=== 架构决策点 ===");
    analysis.push("- 单体 vs 微服务");
    analysis.push("- 同步 vs 异步");
    analysis.push("- 关系型 vs NoSQL");
    analysis.push("- 自建 vs 云服务");

    if (content.includes("微服务") || content.includes("microservice")) {
      analysis.push("\n=== 微服务检查点 ===");
      analysis.push("- 服务边界划分");
      analysis.push("- 服务间通信");
      analysis.push("- 数据一致性");
      analysis.push("- 服务发现与负载均衡");
    }

    return analysis;
  },

  domainHypotheses: (message: HumanMessage): Hypothesis[] => {
    const hypotheses: Hypothesis[] = [];
    const content = message.content.toLowerCase();

    if (content.includes("扩展") || content.includes("scale")) {
      hypotheses.push({
        id: "hyp_arch_1",
        content: "水平扩展可能比垂直扩展更合适",
        confidence: 0.6,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });
    }

    if (content.includes("微服务")) {
      hypotheses.push({
        id: "hyp_arch_2",
        content: "当前规模可能不需要微服务架构",
        confidence: 0.4,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });
    }

    return hypotheses;
  },
};

// ============================================================
// 问题诊断模板
// ============================================================

export const problemDiagnosisTemplate: ThinkingTemplate = {
  id: "problem-diagnosis",
  name: "问题诊断模板",
  domain: "troubleshooting",
  triggers: ["问题", "problem", "错误", "error", "失败", "fail", "不工作", "not working"],

  customSteps: [
    ThinkingStepName.INITIAL_ENGAGEMENT,
    ThinkingStepName.PROBLEM_ANALYSIS,
    ThinkingStepName.MULTIPLE_HYPOTHESES,
    ThinkingStepName.NATURAL_DISCOVERY,
    ThinkingStepName.TESTING_VERIFICATION,
    ThinkingStepName.ERROR_CORRECTION,
  ],

  domainAnalysis: (message: HumanMessage): string[] => {
    const analysis: string[] = [];
    const content = message.content.toLowerCase();

    // 诊断框架
    analysis.push("=== 问题诊断框架 ===");
    analysis.push("1. 问题定义：确切的问题是什么？");
    analysis.push("2. 问题范围：问题影响哪些部分？");
    analysis.push("3. 问题时间：问题何时开始？");
    analysis.push("4. 问题条件：什么条件下出现？");
    analysis.push("5. 问题变化：最近有什么变化？");

    // 常见原因
    analysis.push("\n=== 常见原因检查 ===");
    analysis.push("- 配置错误");
    analysis.push("- 依赖版本冲突");
    analysis.push("- 资源不足");
    analysis.push("- 权限问题");
    analysis.push("- 网络问题");

    if (content.includes("数据库") || content.includes("database")) {
      analysis.push("\n=== 数据库问题检查 ===");
      analysis.push("- 连接池耗尽");
      analysis.push("- 查询超时");
      analysis.push("- 死锁");
      analysis.push("- 索引缺失");
    }

    return analysis;
  },

  domainHypotheses: (message: HumanMessage): Hypothesis[] => {
    const hypotheses: Hypothesis[] = [];
    const content = message.content.toLowerCase();

    // 基于问题类型生成假设
    hypotheses.push({
      id: "hyp_diag_1",
      content: "问题可能由最近的配置变更引起",
      confidence: 0.5,
      evidence: [],
      counterEvidence: [],
      status: HypothesisStatus.ACTIVE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
    });

    hypotheses.push({
      id: "hyp_diag_2",
      content: "问题可能由资源不足引起",
      confidence: 0.4,
      evidence: [],
      counterEvidence: [],
      status: HypothesisStatus.ACTIVE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
    });

    if (content.includes("间歇") || content.includes("偶尔")) {
      hypotheses.push({
        id: "hyp_diag_3",
        content: "间歇性问题可能由竞态条件或资源竞争引起",
        confidence: 0.6,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });
    }

    return hypotheses;
  },
};

// ============================================================
// 数据分析模板
// ============================================================

export const dataAnalysisTemplate: ThinkingTemplate = {
  id: "data-analysis",
  name: "数据分析模板",
  domain: "data",
  triggers: ["数据", "data", "分析", "analysis", "统计", "statistics", "报表", "report"],

  customSteps: [
    ThinkingStepName.INITIAL_ENGAGEMENT,
    ThinkingStepName.PROBLEM_ANALYSIS,
    ThinkingStepName.NATURAL_DISCOVERY,
    ThinkingStepName.PATTERN_RECOGNITION,
    ThinkingStepName.KNOWLEDGE_SYNTHESIS,
  ],

  domainAnalysis: (message: HumanMessage): string[] => {
    const analysis: string[] = [];
    const content = message.content.toLowerCase();

    // 分析框架
    analysis.push("=== 数据分析框架 ===");
    analysis.push("1. 数据理解：数据来源、格式、质量");
    analysis.push("2. 数据清洗：缺失值、异常值、重复值");
    analysis.push("3. 数据探索：分布、相关性、趋势");
    analysis.push("4. 数据建模：特征工程、模型选择");
    analysis.push("5. 结果解释：业务含义、可操作性");

    // 分析维度
    analysis.push("\n=== 分析维度 ===");
    analysis.push("- 时间维度：趋势、周期、季节性");
    analysis.push("- 空间维度：地区、位置分布");
    analysis.push("- 分类维度：类别、群体差异");
    analysis.push("- 关联维度：相关性、因果关系");

    return analysis;
  },

  domainHypotheses: (message: HumanMessage): Hypothesis[] => {
    const hypotheses: Hypothesis[] = [];
    const content = message.content.toLowerCase();

    if (content.includes("趋势") || content.includes("trend")) {
      hypotheses.push({
        id: "hyp_data_1",
        content: "数据可能存在上升趋势",
        confidence: 0.5,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });

      hypotheses.push({
        id: "hyp_data_2",
        content: "数据可能存在季节性波动",
        confidence: 0.4,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });
    }

    return hypotheses;
  },
};

// ============================================================
// 学习教学模板
// ============================================================

export const learningTeachingTemplate: ThinkingTemplate = {
  id: "learning-teaching",
  name: "学习教学模板",
  domain: "education",
  triggers: ["学习", "learn", "教程", "tutorial", "入门", "beginner", "理解", "understand"],

  customSteps: [
    ThinkingStepName.INITIAL_ENGAGEMENT,
    ThinkingStepName.PROBLEM_ANALYSIS,
    ThinkingStepName.KNOWLEDGE_SYNTHESIS,
  ],

  domainAnalysis: (message: HumanMessage): string[] => {
    const analysis: string[] = [];

    // 学习框架
    analysis.push("=== 学习框架 ===");
    analysis.push("1. 前置知识：需要什么基础知识？");
    analysis.push("2. 核心概念：关键概念是什么？");
    analysis.push("3. 实践应用：如何实际使用？");
    analysis.push("4. 常见误区：容易犯什么错误？");
    analysis.push("5. 进阶方向：下一步学什么？");

    // 教学策略
    analysis.push("\n=== 教学策略 ===");
    analysis.push("- 从简单到复杂");
    analysis.push("- 使用类比和示例");
    analysis.push("- 提供可运行的代码");
    analysis.push("- 解释'为什么'而非仅'怎么做'");

    return analysis;
  },

  domainHypotheses: (message: HumanMessage): Hypothesis[] => {
    const hypotheses: Hypothesis[] = [];
    const content = message.content.toLowerCase();

    // 判断用户水平
    if (content.includes("入门") || content.includes("基础")) {
      hypotheses.push({
        id: "hyp_learn_1",
        content: "用户是初学者，需要从基础概念开始",
        confidence: 0.7,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });
    }

    if (content.includes("深入") || content.includes("高级")) {
      hypotheses.push({
        id: "hyp_learn_2",
        content: "用户有基础，需要深入讲解",
        confidence: 0.6,
        evidence: [],
        counterEvidence: [],
        status: HypothesisStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceStep: ThinkingStepName.MULTIPLE_HYPOTHESES,
      });
    }

    return hypotheses;
  },
};

// ============================================================
// 模板注册表
// ============================================================

/**
 * 模板注册表
 */
export class TemplateRegistry {
  private templates: Map<string, ThinkingTemplate> = new Map();

  constructor() {
    // 注册默认模板
    this.register(codeReviewTemplate);
    this.register(architectureDesignTemplate);
    this.register(problemDiagnosisTemplate);
    this.register(dataAnalysisTemplate);
    this.register(learningTeachingTemplate);
  }

  /**
   * 注册模板
   */
  register(template: ThinkingTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 获取模板
   */
  get(id: string): ThinkingTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 匹配模板
   */
  match(message: HumanMessage): ThinkingTemplate | null {
    const content = message.content.toLowerCase();

    for (const template of this.templates.values()) {
      for (const trigger of template.triggers) {
        if (content.includes(trigger.toLowerCase())) {
          return template;
        }
      }
    }

    return null;
  }

  /**
   * 获取所有模板
   */
  getAll(): ThinkingTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 按领域获取模板
   */
  getByDomain(domain: string): ThinkingTemplate[] {
    return this.getAll().filter((t) => t.domain === domain);
  }
}

// 导出单例
export const templateRegistry = new TemplateRegistry();

// 导出所有模板
export const allTemplates = {
  codeReview: codeReviewTemplate,
  architectureDesign: architectureDesignTemplate,
  problemDiagnosis: problemDiagnosisTemplate,
  dataAnalysis: dataAnalysisTemplate,
  learningTeaching: learningTeachingTemplate,
};
