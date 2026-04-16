/**
 * 测试 Prompt 框架
 * 
 * 借鉴 Darwin Skill 的测试 Prompt 设计机制
 * 为每个模块设计标准测试用例，验证改进是否真的有效
 */

import * as fs from "fs";
import * as path from "path";

// ==================== 类型定义 ====================

/**
 * 测试 Prompt
 */
export interface TestPrompt {
  /** ID */
  id: string;
  /** Prompt 内容 */
  prompt: string;
  /** 期望输出描述 */
  expected: string;
  /** 难度：easy / medium / hard */
  difficulty: "easy" | "medium" | "hard";
  /** 分类 */
  category: string;
  /** 标签 */
  tags?: string[];
}

/**
 * 测试结果
 */
export interface TestResult {
  /** 测试 ID */
  testId: string;
  /** 是否通过 */
  passed: boolean;
  /** 实际输出 */
  actualOutput: string;
  /** 期望输出 */
  expectedOutput: string;
  /** 分数（0-10） */
  score: number;
  /** 执行时间（ms） */
  duration: number;
  /** 备注 */
  note?: string;
}

/**
 * 测试套件
 */
export interface TestSuite {
  /** 目标模块 */
  targetModule: string;
  /** 测试 Prompt 列表 */
  prompts: TestPrompt[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 测试配置
 */
export interface TestFrameworkConfig {
  /** 测试套件目录 */
  suiteDir: string;
  /** 结果目录 */
  resultDir: string;
  /** 默认测试数量 */
  defaultPromptCount: number;
}

/**
 * 默认配置
 */
export const DEFAULT_TEST_CONFIG: TestFrameworkConfig = {
  suiteDir: ".test-suites",
  resultDir: ".test-results",
  defaultPromptCount: 3,
};

// ==================== 预定义测试 Prompt ====================

/**
 * L0 灵思层测试 Prompt
 */
export const L0_TEST_PROMPTS: TestPrompt[] = [
  {
    id: "l0_001",
    prompt: "如何设计一个高性能的分布式系统？",
    expected: "应该进行深度思考，分析多个维度（架构、性能、可用性等），生成多个假设",
    difficulty: "medium",
    category: "architecture",
    tags: ["thinking", "analysis"],
  },
  {
    id: "l0_002",
    prompt: "这段代码有什么问题？function add(a, b) { return a + b }",
    expected: "应该识别潜在问题（类型检查、边界条件），提出改进建议",
    difficulty: "easy",
    category: "code-review",
    tags: ["thinking", "code"],
  },
  {
    id: "l0_003",
    prompt: "用户反馈系统响应慢，如何排查？",
    expected: "应该系统化分析（前端、后端、数据库、网络），提出排查步骤",
    difficulty: "medium",
    category: "problem-diagnosis",
    tags: ["thinking", "debugging"],
  },
];

/**
 * L1 灵枢层测试 Prompt
 */
export const L1_TEST_PROMPTS: TestPrompt[] = [
  {
    id: "l1_001",
    prompt: "帮我写一个 Python 脚本处理 CSV 文件",
    expected: "应该识别任务类型（代码生成），选择合适的工具，规划执行步骤",
    difficulty: "easy",
    category: "task-planning",
    tags: ["decision", "planning"],
  },
  {
    id: "l1_002",
    prompt: "分析这个系统的性能瓶颈",
    expected: "应该识别需要分析工具，规划分析步骤，可能需要多轮交互",
    difficulty: "medium",
    category: "analysis",
    tags: ["decision", "analysis"],
  },
];

/**
 * L3 灵躯层测试 Prompt
 */
export const L3_TEST_PROMPTS: TestPrompt[] = [
  {
    id: "l3_001",
    prompt: "读取 /etc/config.json 文件内容",
    expected: "应该调用文件读取工具，正确处理文件路径，返回文件内容",
    difficulty: "easy",
    category: "file-operation",
    tags: ["tool", "file"],
  },
  {
    id: "l3_002",
    prompt: "搜索关于 React Hooks 的最新文章",
    expected: "应该调用搜索工具，使用合适的关键词，返回相关结果",
    difficulty: "easy",
    category: "search",
    tags: ["tool", "search"],
  },
];

/**
 * L5 灵韵层测试 Prompt
 */
export const L5_TEST_PROMPTS: TestPrompt[] = [
  {
    id: "l5_001",
    prompt: "评估上次任务执行的效果",
    expected: "应该分析执行结果，识别成功/失败点，提出改进建议",
    difficulty: "medium",
    category: "evaluation",
    tags: ["feedback", "learning"],
  },
  {
    id: "l5_002",
    prompt: "根据用户反馈优化响应策略",
    expected: "应该分析反馈内容，识别问题，生成优化方案",
    difficulty: "hard",
    category: "optimization",
    tags: ["feedback", "optimization"],
  },
];

// ==================== 测试 Prompt 框架 ====================

export class TestPromptFramework {
  private config: TestFrameworkConfig;
  private workDir: string;
  private suites: Map<string, TestSuite> = new Map();

  constructor(config: Partial<TestFrameworkConfig> = {}, workDir: string = process.cwd()) {
    this.config = { ...DEFAULT_TEST_CONFIG, ...config };
    this.workDir = workDir;
    this.loadSuites();
    this.initializeDefaultSuites();
  }

  /**
   * 加载测试套件
   */
  private loadSuites(): void {
    const suiteDir = path.join(this.workDir, this.config.suiteDir);
    
    if (!fs.existsSync(suiteDir)) {
      return;
    }

    const files = fs.readdirSync(suiteDir).filter(f => f.endsWith(".json"));
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(suiteDir, file), "utf-8");
        const suite: TestSuite = JSON.parse(content);
        this.suites.set(suite.targetModule, suite);
      } catch (e) {
        console.warn(`Failed to load test suite: ${file}`);
      }
    }
  }

  /**
   * 初始化默认测试套件
   */
  private initializeDefaultSuites(): void {
    if (!this.suites.has("L0")) {
      this.createSuite("L0", L0_TEST_PROMPTS);
    }
    if (!this.suites.has("L1")) {
      this.createSuite("L1", L1_TEST_PROMPTS);
    }
    if (!this.suites.has("L3")) {
      this.createSuite("L3", L3_TEST_PROMPTS);
    }
    if (!this.suites.has("L5")) {
      this.createSuite("L5", L5_TEST_PROMPTS);
    }
  }

  /**
   * 创建测试套件
   */
  createSuite(targetModule: string, prompts: TestPrompt[]): TestSuite {
    const suite: TestSuite = {
      targetModule,
      prompts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.suites.set(targetModule, suite);
    this.saveSuite(suite);

    return suite;
  }

  /**
   * 保存测试套件
   */
  private saveSuite(suite: TestSuite): void {
    const suiteDir = path.join(this.workDir, this.config.suiteDir);
    
    if (!fs.existsSync(suiteDir)) {
      fs.mkdirSync(suiteDir, { recursive: true });
    }

    const filepath = path.join(suiteDir, `${suite.targetModule}.json`);
    fs.writeFileSync(filepath, JSON.stringify(suite, null, 2));
  }

  /**
   * 获取测试套件
   */
  getSuite(targetModule: string): TestSuite | undefined {
    return this.suites.get(targetModule);
  }

  /**
   * 获取所有测试套件
   */
  getAllSuites(): TestSuite[] {
    return [...this.suites.values()];
  }

  /**
   * 添加测试 Prompt
   */
  addPrompt(targetModule: string, prompt: TestPrompt): void {
    const suite = this.suites.get(targetModule);
    
    if (suite) {
      suite.prompts.push(prompt);
      suite.updatedAt = new Date().toISOString();
      this.saveSuite(suite);
    } else {
      this.createSuite(targetModule, [prompt]);
    }
  }

  /**
   * 运行测试
   */
  async runTest(
    targetModule: string,
    executor: (prompt: string) => Promise<string>
  ): Promise<TestResult[]> {
    const suite = this.suites.get(targetModule);
    
    if (!suite) {
      console.warn(`No test suite found for: ${targetModule}`);
      return [];
    }

    const results: TestResult[] = [];

    for (const testPrompt of suite.prompts) {
      const startTime = Date.now();
      
      try {
        const actualOutput = await executor(testPrompt.prompt);
        const duration = Date.now() - startTime;
        
        // 简化的评分逻辑
        const score = this.evaluateOutput(actualOutput, testPrompt.expected);
        const passed = score >= 6;

        results.push({
          testId: testPrompt.id,
          passed,
          actualOutput,
          expectedOutput: testPrompt.expected,
          score,
          duration,
          note: passed ? "通过" : "未达到期望",
        });
      } catch (e) {
        results.push({
          testId: testPrompt.id,
          passed: false,
          actualOutput: "",
          expectedOutput: testPrompt.expected,
          score: 0,
          duration: Date.now() - startTime,
          note: `执行失败: ${e}`,
        });
      }
    }

    // 保存结果
    this.saveResults(targetModule, results);

    return results;
  }

  /**
   * 评估输出
   */
  private evaluateOutput(actual: string, expected: string): number {
    // 简化的评估：基于关键词匹配
    const expectedKeywords = expected.toLowerCase().split(/[\s,，、]+/);
    const actualLower = actual.toLowerCase();
    
    let matchCount = 0;
    for (const keyword of expectedKeywords) {
      if (keyword.length > 2 && actualLower.includes(keyword)) {
        matchCount++;
      }
    }

    const score = (matchCount / expectedKeywords.length) * 10;
    return Math.min(10, Math.max(1, score));
  }

  /**
   * 保存测试结果
   */
  private saveResults(targetModule: string, results: TestResult[]): void {
    const resultDir = path.join(this.workDir, this.config.resultDir);
    
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }

    const filename = `${targetModule}_${Date.now()}.json`;
    const filepath = path.join(resultDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify({
      targetModule,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      },
    }, null, 2));
  }

  /**
   * 生成测试报告
   */
  generateReport(targetModule: string, results: TestResult[]): string {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

    const lines: string[] = [
      `# 测试报告: ${targetModule}`,
      "",
      "## 总览",
      `| 指标 | 值 |`,
      `|------|-----|`,
      `| 总测试数 | ${results.length} |`,
      `| 通过数 | ${passed} |`,
      `| 失败数 | ${failed} |`,
      `| 通过率 | ${((passed / results.length) * 100).toFixed(1)}% |`,
      `| 平均分数 | ${avgScore.toFixed(1)} / 10 |`,
      "",
      "## 详细结果",
      `| ID | 结果 | 分数 | 耗时 |`,
      `|------|------|------|------|`,
    ];

    for (const result of results) {
      const status = result.passed ? "✅" : "❌";
      lines.push(`| ${result.testId} | ${status} | ${result.score.toFixed(1)} | ${result.duration}ms |`);
    }

    return lines.join("\n");
  }

  /**
   * 为 Skill 生成测试 Prompt
   */
  generatePromptsForSkill(skillContent: string): TestPrompt[] {
    const prompts: TestPrompt[] = [];
    
    // 分析 Skill 内容，提取关键功能
    const lines = skillContent.split("\n");
    let currentSection = "";
    
    for (const line of lines) {
      if (line.startsWith("# ")) {
        currentSection = line.substring(2).trim();
      } else if (line.includes("触发词") || line.includes("trigger")) {
        // 提取触发词作为测试 Prompt
        const triggers = line.match(/["']([^"']+)["']/g) || [];
        for (const trigger of triggers.slice(0, 2)) {
          const prompt = trigger.replace(/["']/g, "");
          prompts.push({
            id: `skill_${Date.now()}_${prompts.length}`,
            prompt,
            expected: `应该正确执行 ${currentSection} 功能`,
            difficulty: "medium",
            category: currentSection,
          });
        }
      }
    }

    // 确保至少有 2 个测试 Prompt
    if (prompts.length < 2) {
      prompts.push({
        id: `skill_${Date.now()}_default`,
        prompt: "执行这个 Skill 的主要功能",
        expected: "应该按照 Skill 定义的工作流执行",
        difficulty: "medium",
        category: "general",
      });
    }

    return prompts.slice(0, this.config.defaultPromptCount);
  }
}

// 导出单例
export const testPromptFramework = new TestPromptFramework();
