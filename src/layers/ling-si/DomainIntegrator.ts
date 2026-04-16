/**
 * 领域集成器
 * 
 * 动态识别领域并应用专业知识
 * 基于涂津豪提示词的 domain_integration
 */

import { ThinkingContext } from "./types";

// ==================== 类型定义 ====================

/**
 * 领域类型
 */
export enum Domain {
  SOFTWARE_ENGINEERING = "software_engineering",
  DATA_SCIENCE = "data_science",
  PRODUCT_MANAGEMENT = "product_management",
  SYSTEM_DESIGN = "system_design",
  SECURITY = "security",
  PERFORMANCE = "performance",
  USER_EXPERIENCE = "user_experience",
  BUSINESS = "business",
  DEVOPS = "devops",
  TESTING = "testing",
  ARCHITECTURE = "architecture",
  ALGORITHM = "algorithm",
  DATABASE = "database",
  NETWORKING = "networking",
  AI_ML = "ai_ml",
}

/**
 * 领域知识
 */
export interface DomainKnowledge {
  domain: Domain;
  keywords: string[];
  heuristics: string[];
  constraints: string[];
  bestPractices: string[];
  commonPatterns: string[];
  antiPatterns: string[];
  tools: string[];
  metrics: string[];
}

/**
 * 领域检测结果
 */
export interface DomainDetectionResult {
  detectedDomains: Array<{
    domain: Domain;
    confidence: number;
    matchedKeywords: string[];
  }>;
  primaryDomain: Domain | null;
  secondaryDomains: Domain[];
  crossDomain: boolean;
}

/**
 * 领域启发式规则
 */
export interface DomainHeuristic {
  id: string;
  domain: Domain;
  name: string;
  description: string;
  condition: (context: ThinkingContext) => boolean;
  recommendation: string;
  priority: number;
}

/**
 * 领域约束
 */
export interface DomainConstraint {
  id: string;
  domain: Domain;
  name: string;
  description: string;
  type: "hard" | "soft";
  check: (context: ThinkingContext) => boolean;
  message: string;
}

/**
 * 领域综合结果
 */
export interface DomainSynthesis {
  domains: Domain[];
  integratedKnowledge: string[];
  crossDomainInsights: string[];
  recommendations: string[];
  constraints: string[];
}

// ==================== 领域知识库 ====================

/**
 * 领域知识库
 */
const DOMAIN_KNOWLEDGE_BASE: Record<Domain, DomainKnowledge> = {
  [Domain.SOFTWARE_ENGINEERING]: {
    domain: Domain.SOFTWARE_ENGINEERING,
    keywords: ["代码", "函数", "类", "模块", "重构", "code", "function", "class", "module", "refactor"],
    heuristics: [
      "单一职责原则：每个模块只做一件事",
      "DRY原则：不要重复自己",
      "KISS原则：保持简单",
      "YAGNI原则：不要过度设计",
    ],
    constraints: [
      "代码必须可编译",
      "必须通过单元测试",
      "遵循团队编码规范",
    ],
    bestPractices: [
      "编写可读性强的代码",
      "添加适当的注释",
      "进行代码审查",
      "保持函数短小",
    ],
    commonPatterns: [
      "工厂模式",
      "单例模式",
      "观察者模式",
      "策略模式",
    ],
    antiPatterns: [
      "上帝类",
      "面条代码",
      "过早优化",
      "复制粘贴编程",
    ],
    tools: ["IDE", "Linter", "Formatter", "Version Control"],
    metrics: ["代码行数", "圈复杂度", "测试覆盖率", "技术债务"],
  },
  [Domain.DATA_SCIENCE]: {
    domain: Domain.DATA_SCIENCE,
    keywords: ["数据", "分析", "统计", "模型", "特征", "data", "analysis", "statistics", "model", "feature"],
    heuristics: [
      "数据质量 > 模型复杂度",
      "先可视化，再建模",
      "验证假设前先检查数据分布",
    ],
    constraints: [
      "数据隐私保护",
      "避免数据泄露",
      "统计显著性检验",
    ],
    bestPractices: [
      "数据清洗优先",
      "特征工程是关键",
      "交叉验证",
      "模型可解释性",
    ],
    commonPatterns: [
      "EDA流程",
      "特征选择",
      "模型集成",
      "超参数调优",
    ],
    antiPatterns: [
      "数据泄露",
      "过拟合",
      "忽略异常值",
      "盲目追求准确率",
    ],
    tools: ["Pandas", "NumPy", "Scikit-learn", "Jupyter"],
    metrics: ["准确率", "精确率", "召回率", "F1分数", "AUC"],
  },
  [Domain.PRODUCT_MANAGEMENT]: {
    domain: Domain.PRODUCT_MANAGEMENT,
    keywords: ["产品", "用户", "需求", "功能", "迭代", "product", "user", "requirement", "feature", "iteration"],
    heuristics: [
      "用户价值优先",
      "MVP思维",
      "数据驱动决策",
    ],
    constraints: [
      "资源有限",
      "时间约束",
      "用户期望管理",
    ],
    bestPractices: [
      "用户调研",
      "A/B测试",
      "迭代发布",
      "反馈循环",
    ],
    commonPatterns: [
      "用户故事",
      "产品路线图",
      "优先级矩阵",
      "用户旅程图",
    ],
    antiPatterns: [
      "功能堆砌",
      "忽视用户反馈",
      "过度承诺",
      "竞品驱动开发",
    ],
    tools: ["Jira", "Confluence", "Figma", "Amplitude"],
    metrics: ["DAU", "留存率", "转化率", "NPS"],
  },
  [Domain.SYSTEM_DESIGN]: {
    domain: Domain.SYSTEM_DESIGN,
    keywords: ["架构", "系统", "分布式", "微服务", "扩展", "architecture", "system", "distributed", "microservice", "scale"],
    heuristics: [
      "CAP定理权衡",
      "设计可扩展性",
      "故障隔离",
    ],
    constraints: [
      "可用性要求",
      "一致性要求",
      "延迟要求",
    ],
    bestPractices: [
      "模块化设计",
      "服务拆分",
      "异步通信",
      "缓存策略",
    ],
    commonPatterns: [
      "负载均衡",
      "服务发现",
      "断路器",
      "事件溯源",
    ],
    antiPatterns: [
      "单体地狱",
      "分布式单体",
      "过度工程",
      "忽视故障模式",
    ],
    tools: ["Kubernetes", "Docker", "Redis", "Kafka"],
    metrics: ["吞吐量", "延迟", "可用性", "错误率"],
  },
  [Domain.SECURITY]: {
    domain: Domain.SECURITY,
    keywords: ["安全", "加密", "认证", "授权", "漏洞", "security", "encrypt", "auth", "permission", "vulnerability"],
    heuristics: [
      "最小权限原则",
      "深度防御",
      "永不信任用户输入",
    ],
    constraints: [
      "数据加密",
      "访问控制",
      "审计日志",
    ],
    bestPractices: [
      "输入验证",
      "参数化查询",
      "安全头配置",
      "定期安全审计",
    ],
    commonPatterns: [
      "认证授权分离",
      "JWT",
      "OAuth",
      "RBAC",
    ],
    antiPatterns: [
      "硬编码密钥",
      "明文存储密码",
      "SQL注入",
      "XSS漏洞",
    ],
    tools: ["OWASP ZAP", "Burp Suite", "SonarQube", "Vault"],
    metrics: ["漏洞数量", "修复时间", "安全评分", "合规率"],
  },
  [Domain.PERFORMANCE]: {
    domain: Domain.PERFORMANCE,
    keywords: ["性能", "优化", "速度", "延迟", "吞吐", "performance", "optimize", "speed", "latency", "throughput"],
    heuristics: [
      "先测量，再优化",
      "优化热点路径",
      "空间换时间",
    ],
    constraints: [
      "响应时间要求",
      "资源限制",
      "并发要求",
    ],
    bestPractices: [
      "性能基准测试",
      "缓存策略",
      "懒加载",
      "资源压缩",
    ],
    commonPatterns: [
      "缓存",
      "连接池",
      "异步处理",
      "批处理",
    ],
    antiPatterns: [
      "过早优化",
      "过度缓存",
      "N+1查询",
      "阻塞调用",
    ],
    tools: ["Profiler", "APM", "Load Tester", "Monitor"],
    metrics: ["响应时间", "吞吐量", "CPU使用率", "内存使用率"],
  },
  [Domain.USER_EXPERIENCE]: {
    domain: Domain.USER_EXPERIENCE,
    keywords: ["体验", "界面", "交互", "可用性", "设计", "UX", "UI", "interface", "interaction", "usability"],
    heuristics: [
      "用户中心设计",
      "一致性原则",
      "反馈及时性",
    ],
    constraints: [
      "可访问性",
      "响应式设计",
      "加载时间",
    ],
    bestPractices: [
      "用户测试",
      "原型设计",
      "渐进增强",
      "错误处理友好",
    ],
    commonPatterns: [
      "导航模式",
      "表单设计",
      "反馈机制",
      "引导流程",
    ],
    antiPatterns: [
      "复杂导航",
      "信息过载",
      "强制操作",
      "隐藏功能",
    ],
    tools: ["Figma", "Sketch", "Hotjar", "UserTesting"],
    metrics: ["任务完成率", "错误率", "满意度", "学习曲线"],
  },
  [Domain.BUSINESS]: {
    domain: Domain.BUSINESS,
    keywords: ["业务", "商业", "收入", "成本", "市场", "business", "revenue", "cost", "market", "strategy"],
    heuristics: [
      "ROI优先",
      "市场导向",
      "竞争分析",
    ],
    constraints: [
      "预算限制",
      "法规合规",
      "市场时机",
    ],
    bestPractices: [
      "市场调研",
      "竞品分析",
      "定价策略",
      "渠道优化",
    ],
    commonPatterns: [
      "商业模式画布",
      "SWOT分析",
      "增长黑客",
      "漏斗模型",
    ],
    antiPatterns: [
      "忽视竞品",
      "盲目扩张",
      "价格战",
      "忽视现金流",
    ],
    tools: ["Excel", "Tableau", "Salesforce", "HubSpot"],
    metrics: ["收入", "利润", "市场份额", "客户获取成本"],
  },
  [Domain.DEVOPS]: {
    domain: Domain.DEVOPS,
    keywords: ["部署", "运维", "CI/CD", "容器", "监控", "deploy", "devops", "pipeline", "container", "monitor"],
    heuristics: [
      "自动化优先",
      "基础设施即代码",
      "快速反馈",
    ],
    constraints: [
      "环境一致性",
      "回滚能力",
      "监控覆盖",
    ],
    bestPractices: [
      "持续集成",
      "持续部署",
      "蓝绿部署",
      "金丝雀发布",
    ],
    commonPatterns: [
      "Pipeline",
      "GitOps",
      "不可变基础设施",
      "自愈系统",
    ],
    antiPatterns: [
      "手动部署",
      "环境漂移",
      "缺乏监控",
      "忽视日志",
    ],
    tools: ["Jenkins", "GitHub Actions", "Terraform", "Prometheus"],
    metrics: ["部署频率", "变更失败率", "平均恢复时间", "交付周期"],
  },
  [Domain.TESTING]: {
    domain: Domain.TESTING,
    keywords: ["测试", "单元测试", "集成测试", "覆盖率", "QA", "test", "unit test", "integration", "coverage"],
    heuristics: [
      "测试金字塔",
      "测试左移",
      "快速反馈",
    ],
    constraints: [
      "测试覆盖率要求",
      "测试时间限制",
      "环境隔离",
    ],
    bestPractices: [
      "单元测试优先",
      "测试独立性",
      "有意义的断言",
      "测试数据管理",
    ],
    commonPatterns: [
      "AAA模式",
      "Mock/Stub",
      "测试夹具",
      "参数化测试",
    ],
    antiPatterns: [
      "脆弱测试",
      "测试依赖",
      "过度Mock",
      "忽视边缘情况",
    ],
    tools: ["Jest", "Mocha", "Cypress", "Playwright"],
    metrics: ["覆盖率", "测试通过率", "测试执行时间", "缺陷发现率"],
  },
  [Domain.ARCHITECTURE]: {
    domain: Domain.ARCHITECTURE,
    keywords: ["架构", "设计", "模式", "分层", "组件", "architecture", "design", "pattern", "layer", "component"],
    heuristics: [
      "关注点分离",
      "高内聚低耦合",
      "依赖倒置",
    ],
    constraints: [
      "技术栈限制",
      "团队能力",
      "演进能力",
    ],
    bestPractices: [
      "架构评审",
      "文档化",
      "演进式设计",
      "技术债务管理",
    ],
    commonPatterns: [
      "分层架构",
      "六边形架构",
      "CQRS",
      "事件驱动",
    ],
    antiPatterns: [
      "大泥球",
      "供应商锁定",
      "架构宇航员",
      "过度抽象",
    ],
    tools: ["UML", "C4 Model", "Archimate", "Structurizr"],
    metrics: ["耦合度", "内聚度", "复杂度", "技术债务"],
  },
  [Domain.ALGORITHM]: {
    domain: Domain.ALGORITHM,
    keywords: ["算法", "复杂度", "数据结构", "排序", "搜索", "algorithm", "complexity", "structure", "sort", "search"],
    heuristics: [
      "时间空间权衡",
      "渐进分析",
      "边界情况处理",
    ],
    constraints: [
      "时间复杂度限制",
      "空间复杂度限制",
      "正确性保证",
    ],
    bestPractices: [
      "复杂度分析",
      "边界测试",
      "代码简洁",
      "可读性优先",
    ],
    commonPatterns: [
      "分治",
      "动态规划",
      "贪心",
      "回溯",
    ],
    antiPatterns: [
      "暴力求解",
      "忽视边界",
      "过度优化",
      "复杂实现",
    ],
    tools: ["LeetCode", "Visualizer", "Profiler", "Benchmark"],
    metrics: ["时间复杂度", "空间复杂度", "正确性", "可读性"],
  },
  [Domain.DATABASE]: {
    domain: Domain.DATABASE,
    keywords: ["数据库", "SQL", "索引", "查询", "事务", "database", "SQL", "index", "query", "transaction"],
    heuristics: [
      "索引优化优先",
      "查询计划分析",
      "事务最小化",
    ],
    constraints: [
      "ACID保证",
      "并发控制",
      "存储限制",
    ],
    bestPractices: [
      "索引设计",
      "查询优化",
      "分库分表",
      "读写分离",
    ],
    commonPatterns: [
      "主从复制",
      "分片",
      "缓存层",
      "CQRS",
    ],
    antiPatterns: [
      "全表扫描",
      "N+1查询",
      "过度索引",
      "大事务",
    ],
    tools: ["MySQL", "PostgreSQL", "MongoDB", "Redis"],
    metrics: ["查询时间", "吞吐量", "连接数", "锁等待"],
  },
  [Domain.NETWORKING]: {
    domain: Domain.NETWORKING,
    keywords: ["网络", "HTTP", "API", "协议", "通信", "network", "HTTP", "API", "protocol", "communication"],
    heuristics: [
      "幂等性设计",
      "超时重试",
      "限流保护",
    ],
    constraints: [
      "网络延迟",
      "带宽限制",
      "协议兼容",
    ],
    bestPractices: [
      "API版本控制",
      "错误处理",
      "重试机制",
      "监控告警",
    ],
    commonPatterns: [
      "REST",
      "GraphQL",
      "gRPC",
      "WebSocket",
    ],
    antiPatterns: [
      "同步阻塞",
      "无限重试",
      "忽视超时",
      "API膨胀",
    ],
    tools: ["Postman", "cURL", "Wireshark", "Nginx"],
    metrics: ["延迟", "带宽", "错误率", "可用性"],
  },
  [Domain.AI_ML]: {
    domain: Domain.AI_ML,
    keywords: ["AI", "机器学习", "深度学习", "模型", "训练", "ML", "deep learning", "neural", "training", "inference"],
    heuristics: [
      "数据质量优先",
      "模型复杂度权衡",
      "可解释性考虑",
    ],
    constraints: [
      "计算资源",
      "训练时间",
      "推理延迟",
    ],
    bestPractices: [
      "数据增强",
      "正则化",
      "早停",
      "模型压缩",
    ],
    commonPatterns: [
      "迁移学习",
      "微调",
      "集成学习",
      "蒸馏",
    ],
    antiPatterns: [
      "过拟合",
      "数据泄露",
      "忽视偏差",
      "黑盒依赖",
    ],
    tools: ["PyTorch", "TensorFlow", "Hugging Face", "MLflow"],
    metrics: ["准确率", "损失", "推理时间", "模型大小"],
  },
};

// ==================== 领域集成器 ====================

export class DomainIntegrator {
  private knowledgeBase: Record<Domain, DomainKnowledge>;
  private customHeuristics: DomainHeuristic[] = [];
  private customConstraints: DomainConstraint[] = [];

  constructor() {
    this.knowledgeBase = DOMAIN_KNOWLEDGE_BASE;
  }

  /**
   * 检测领域
   */
  detectDomains(context: ThinkingContext): DomainDetectionResult {
    const content = context.message.content.toLowerCase();
    const detectedDomains: DomainDetectionResult["detectedDomains"] = [];

    for (const [domain, knowledge] of Object.entries(this.knowledgeBase)) {
      const matchedKeywords = knowledge.keywords.filter(k => 
        content.includes(k.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        const confidence = Math.min(1, matchedKeywords.length * 0.2 + 0.3);
        detectedDomains.push({
          domain: domain as Domain,
          confidence,
          matchedKeywords,
        });
      }
    }

    // 按置信度排序
    detectedDomains.sort((a, b) => b.confidence - a.confidence);

    // 确定主领域和次领域
    const primaryDomain = detectedDomains[0]?.domain || null;
    const secondaryDomains = detectedDomains.slice(1, 4).map(d => d.domain);
    const crossDomain = detectedDomains.length > 1;

    return {
      detectedDomains,
      primaryDomain,
      secondaryDomains,
      crossDomain,
    };
  }

  /**
   * 获取领域知识
   */
  getDomainKnowledge(domain: Domain): DomainKnowledge | null {
    return this.knowledgeBase[domain] || null;
  }

  /**
   * 应用领域启发式规则
   */
  applyDomainHeuristics(
    domain: Domain,
    context: ThinkingContext
  ): string[] {
    const knowledge = this.getDomainKnowledge(domain);
    if (!knowledge) return [];

    const recommendations: string[] = [];

    // 应用领域启发式规则
    for (const heuristic of knowledge.heuristics) {
      recommendations.push(`[${domain}] ${heuristic}`);
    }

    // 应用自定义启发式规则
    for (const customHeuristic of this.customHeuristics) {
      if (customHeuristic.domain === domain && customHeuristic.condition(context)) {
        recommendations.push(customHeuristic.recommendation);
      }
    }

    return recommendations;
  }

  /**
   * 检查领域约束
   */
  checkDomainConstraints(
    domain: Domain,
    context: ThinkingContext
  ): Array<{ constraint: string; type: "hard" | "soft"; message: string }> {
    const knowledge = this.getDomainKnowledge(domain);
    if (!knowledge) return [];

    const results: Array<{ constraint: string; type: "hard" | "soft"; message: string }> = [];

    // 检查领域约束
    for (const constraint of knowledge.constraints) {
      results.push({
        constraint,
        type: "hard",
        message: `必须满足: ${constraint}`,
      });
    }

    // 检查自定义约束
    for (const customConstraint of this.customConstraints) {
      if (customConstraint.domain === domain) {
        const passed = customConstraint.check(context);
        if (!passed) {
          results.push({
            constraint: customConstraint.name,
            type: customConstraint.type,
            message: customConstraint.message,
          });
        }
      }
    }

    return results;
  }

  /**
   * 获取最佳实践
   */
  getBestPractices(domain: Domain): string[] {
    const knowledge = this.getDomainKnowledge(domain);
    return knowledge?.bestPractices || [];
  }

  /**
   * 获取常见模式
   */
  getCommonPatterns(domain: Domain): string[] {
    const knowledge = this.getDomainKnowledge(domain);
    return knowledge?.commonPatterns || [];
  }

  /**
   * 获取反模式
   */
  getAntiPatterns(domain: Domain): string[] {
    const knowledge = this.getDomainKnowledge(domain);
    return knowledge?.antiPatterns || [];
  }

  /**
   * 跨领域综合
   */
  synthesizeCrossDomain(
    domains: Domain[],
    context: ThinkingContext
  ): DomainSynthesis {
    const integratedKnowledge: string[] = [];
    const crossDomainInsights: string[] = [];
    const recommendations: string[] = [];
    const constraints: string[] = [];

    // 收集各领域知识
    for (const domain of domains) {
      const knowledge = this.getDomainKnowledge(domain);
      if (knowledge) {
        integratedKnowledge.push(...knowledge.heuristics.slice(0, 2));
        recommendations.push(...knowledge.bestPractices.slice(0, 2));
        constraints.push(...knowledge.constraints.slice(0, 2));
      }
    }

    // 生成跨领域洞察
    if (domains.length > 1) {
      crossDomainInsights.push(
        `涉及 ${domains.length} 个领域的交叉问题`,
        `需要平衡 ${domains.map(d => this.getDomainName(d)).join(" 和 ")} 的考量`,
        `建议采用跨领域协作方式解决`
      );
    }

    return {
      domains,
      integratedKnowledge,
      crossDomainInsights,
      recommendations,
      constraints,
    };
  }

  /**
   * 获取领域名称
   */
  private getDomainName(domain: Domain): string {
    const names: Record<Domain, string> = {
      [Domain.SOFTWARE_ENGINEERING]: "软件工程",
      [Domain.DATA_SCIENCE]: "数据科学",
      [Domain.PRODUCT_MANAGEMENT]: "产品管理",
      [Domain.SYSTEM_DESIGN]: "系统设计",
      [Domain.SECURITY]: "安全",
      [Domain.PERFORMANCE]: "性能",
      [Domain.USER_EXPERIENCE]: "用户体验",
      [Domain.BUSINESS]: "商业",
      [Domain.DEVOPS]: "DevOps",
      [Domain.TESTING]: "测试",
      [Domain.ARCHITECTURE]: "架构",
      [Domain.ALGORITHM]: "算法",
      [Domain.DATABASE]: "数据库",
      [Domain.NETWORKING]: "网络",
      [Domain.AI_ML]: "AI/ML",
    };
    return names[domain] || domain;
  }

  /**
   * 添加自定义启发式规则
   */
  addCustomHeuristic(heuristic: DomainHeuristic): void {
    this.customHeuristics.push(heuristic);
  }

  /**
   * 添加自定义约束
   */
  addCustomConstraint(constraint: DomainConstraint): void {
    this.customConstraints.push(constraint);
  }

  /**
   * 获取领域指标
   */
  getDomainMetrics(domain: Domain): string[] {
    const knowledge = this.getDomainKnowledge(domain);
    return knowledge?.metrics || [];
  }

  /**
   * 获取领域工具
   */
  getDomainTools(domain: Domain): string[] {
    const knowledge = this.getDomainKnowledge(domain);
    return knowledge?.tools || [];
  }
}

// 导出单例
export const domainIntegrator = new DomainIntegrator();
