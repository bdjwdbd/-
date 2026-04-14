/**
 * 实验 2：Generator-Evaluator 对抗效果
 * 
 * 目的：验证对抗验证的有效性
 * 
 * 方法：
 * 1. 准备 50 个生成任务
 * 2. 对比：无验证 / 简单验证 / 对抗验证
 * 3. 记录最终质量评分
 * 
 * 预期结果：
 * - 对抗验证显著提升质量 → 保持
 * - 效果不明显 → 调整对抗策略
 * - 成本过高 → 考虑简化
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

interface GenerationTask {
  id: string;
  type: "code" | "text" | "analysis" | "planning";
  prompt: string;
  criteria: EvaluationCriteria[];
  difficulty: "easy" | "medium" | "hard";
}

interface EvaluationCriteria {
  name: string;
  description: string;
  weight: number;
  required: boolean;
}

interface ValidationResult {
  taskId: string;
  validationType: "none" | "simple" | "adversarial";
  passed: boolean;
  qualityScore: number;       // 0-1
  issuesFound: string[];
  iterationsRequired: number;
  totalCost: number;          // 相对成本
  timeMs: number;
}

interface AggregatedValidationResult {
  validationType: string;
  totalTasks: number;
  passedCount: number;
  passRate: number;
  avgQualityScore: number;
  avgIterations: number;
  avgCost: number;
  avgTimeMs: number;
  issuesPerTask: number;
}

// ============================================================
// 任务生成器
// ============================================================

class TaskGenerator {
  static generateTasks(count: number = 50): GenerationTask[] {
    const tasks: GenerationTask[] = [];
    
    // 代码任务 (30%)
    for (let i = 0; i < count * 0.3; i++) {
      tasks.push(this.generateCodeTask(i));
    }
    
    // 文本任务 (30%)
    for (let i = 0; i < count * 0.3; i++) {
      tasks.push(this.generateTextTask(i));
    }
    
    // 分析任务 (20%)
    for (let i = 0; i < count * 0.2; i++) {
      tasks.push(this.generateAnalysisTask(i));
    }
    
    // 规划任务 (20%)
    for (let i = 0; i < count * 0.2; i++) {
      tasks.push(this.generatePlanningTask(i));
    }
    
    return tasks;
  }
  
  private static generateCodeTask(index: number): GenerationTask {
    const tasks = [
      {
        prompt: "实现一个快速排序算法",
        criteria: [
          { name: "正确性", description: "排序结果正确", weight: 0.5, required: true },
          { name: "效率", description: "时间复杂度 O(n log n)", weight: 0.3, required: false },
          { name: "代码质量", description: "可读性好，有注释", weight: 0.2, required: false },
        ],
        difficulty: "medium" as const,
      },
      {
        prompt: "实现一个 LRU 缓存",
        criteria: [
          { name: "正确性", description: "get/set 操作正确", weight: 0.4, required: true },
          { name: "淘汰策略", description: "LRU 淘汰正确实现", weight: 0.4, required: true },
          { name: "边界处理", description: "处理空缓存、满缓存", weight: 0.2, required: false },
        ],
        difficulty: "hard" as const,
      },
      {
        prompt: "实现一个简单的 HTTP 服务器",
        criteria: [
          { name: "功能", description: "能响应 GET 请求", weight: 0.4, required: true },
          { name: "错误处理", description: "处理异常请求", weight: 0.3, required: false },
          { name: "性能", description: "支持并发连接", weight: 0.3, required: false },
        ],
        difficulty: "medium" as const,
      },
    ];
    
    const task = tasks[index % tasks.length];
    return {
      id: `code-${index}`,
      type: "code",
      ...task,
    };
  }
  
  private static generateTextTask(index: number): GenerationTask {
    const tasks = [
      {
        prompt: "写一篇关于 AI Agent 的技术博客",
        criteria: [
          { name: "内容质量", description: "信息准确，逻辑清晰", weight: 0.4, required: true },
          { name: "可读性", description: "语言流畅，结构合理", weight: 0.3, required: false },
          { name: "原创性", description: "有独特见解", weight: 0.3, required: false },
        ],
        difficulty: "medium" as const,
      },
      {
        prompt: "写一份项目技术文档",
        criteria: [
          { name: "完整性", description: "覆盖所有模块", weight: 0.4, required: true },
          { name: "准确性", description: "技术细节正确", weight: 0.4, required: true },
          { name: "易用性", description: "有示例和说明", weight: 0.2, required: false },
        ],
        difficulty: "hard" as const,
      },
    ];
    
    const task = tasks[index % tasks.length];
    return {
      id: `text-${index}`,
      type: "text",
      ...task,
    };
  }
  
  private static generateAnalysisTask(index: number): GenerationTask {
    const tasks = [
      {
        prompt: "分析这段代码的性能瓶颈",
        criteria: [
          { name: "准确性", description: "正确识别瓶颈", weight: 0.5, required: true },
          { name: "深度", description: "分析根因", weight: 0.3, required: false },
          { name: "建议", description: "给出优化建议", weight: 0.2, required: false },
        ],
        difficulty: "medium" as const,
      },
      {
        prompt: "分析系统架构的优缺点",
        criteria: [
          { name: "全面性", description: "覆盖主要方面", weight: 0.4, required: true },
          { name: "深度", description: "有深入分析", weight: 0.4, required: true },
          { name: "建议", description: "给出改进建议", weight: 0.2, required: false },
        ],
        difficulty: "hard" as const,
      },
    ];
    
    const task = tasks[index % tasks.length];
    return {
      id: `analysis-${index}`,
      type: "analysis",
      ...task,
    };
  }
  
  private static generatePlanningTask(index: number): GenerationTask {
    const tasks = [
      {
        prompt: "制定一个项目开发计划",
        criteria: [
          { name: "可行性", description: "计划可执行", weight: 0.4, required: true },
          { name: "完整性", description: "覆盖所有阶段", weight: 0.3, required: true },
          { name: "风险考虑", description: "识别潜在风险", weight: 0.3, required: false },
        ],
        difficulty: "medium" as const,
      },
      {
        prompt: "设计一个系统迁移方案",
        criteria: [
          { name: "可行性", description: "方案可执行", weight: 0.4, required: true },
          { name: "风险控制", description: "有回滚方案", weight: 0.3, required: true },
          { name: "时间规划", description: "时间线合理", weight: 0.3, required: false },
        ],
        difficulty: "hard" as const,
      },
    ];
    
    const task = tasks[index % tasks.length];
    return {
      id: `planning-${index}`,
      type: "planning",
      ...task,
    };
  }
}

// ============================================================
// 模拟生成器
// ============================================================

class SimulatedGenerator {
  /**
   * 模拟生成输出
   */
  generate(task: GenerationTask): { output: string; quality: number; issues: string[] } {
    // 基础质量（根据难度）
    let baseQuality: number;
    switch (task.difficulty) {
      case "easy": baseQuality = 0.85; break;
      case "medium": baseQuality = 0.70; break;
      case "hard": baseQuality = 0.55; break;
    }
    
    // 随机波动
    const variance = 0.15;
    const quality = Math.max(0.3, Math.min(1, baseQuality + (Math.random() - 0.5) * variance));
    
    // 生成问题列表
    const issues: string[] = [];
    if (quality < 0.9) {
      const possibleIssues = [
        "缺少边界情况处理",
        "代码注释不完整",
        "性能可以优化",
        "缺少错误处理",
        "文档不够详细",
        "测试覆盖不足",
      ];
      const issueCount = Math.floor((1 - quality) * 5);
      for (let i = 0; i < issueCount; i++) {
        const issue = possibleIssues[Math.floor(Math.random() * possibleIssues.length)];
        if (!issues.includes(issue)) {
          issues.push(issue);
        }
      }
    }
    
    return {
      output: `Generated output for task: ${task.prompt}`,
      quality,
      issues,
    };
  }
  
  /**
   * 根据反馈改进
   */
  improve(task: GenerationTask, feedback: string[], previousQuality: number): { output: string; quality: number; issues: string[] } {
    // 改进幅度
    const improvement = 0.1 + Math.random() * 0.15;
    const newQuality = Math.min(1, previousQuality + improvement);
    
    // 减少问题
    const remainingIssues = feedback.slice(0, Math.floor(feedback.length * (1 - improvement)));
    
    return {
      output: `Improved output for task: ${task.prompt}`,
      quality: newQuality,
      issues: remainingIssues,
    };
  }
}

// ============================================================
// 验证器
// ============================================================

class NoValidator {
  validate(task: GenerationTask, output: { quality: number; issues: string[] }): { passed: boolean; issues: string[] } {
    // 无验证，直接通过
    return { passed: true, issues: [] };
  }
}

class SimpleValidator {
  validate(task: GenerationTask, output: { quality: number; issues: string[] }): { passed: boolean; issues: string[] } {
    // 简单验证：检查必需条件
    const requiredCriteria = task.criteria.filter(c => c.required);
    const passed = output.quality >= 0.7 && output.issues.length <= 2;
    return { passed, issues: output.issues };
  }
}

class AdversarialValidator {
  private strictness: number = 0.8;
  
  validate(task: GenerationTask, output: { quality: number; issues: string[] }): { passed: boolean; issues: string[] } {
    // 对抗验证：严格检查所有条件
    const allIssues: string[] = [...output.issues];
    
    // 检查每个标准
    for (const criteria of task.criteria) {
      const threshold = criteria.required ? 0.8 : 0.6;
      if (output.quality < threshold) {
        allIssues.push(`${criteria.name} 未达标 (要求: ${threshold})`);
      }
    }
    
    // 额外的严格检查
    if (output.quality < this.strictness) {
      allIssues.push(`整体质量低于严格标准 (${this.strictness})`);
    }
    
    // 随机发现额外问题（模拟对抗性）
    if (Math.random() < 0.3) {
      const additionalIssues = [
        "潜在的安全风险",
        "边界情况未覆盖",
        "代码风格不一致",
        "缺少单元测试",
        "文档与实现不符",
      ];
      const issue = additionalIssues[Math.floor(Math.random() * additionalIssues.length)];
      if (!allIssues.includes(issue)) {
        allIssues.push(issue);
      }
    }
    
    const passed = allIssues.length === 0;
    return { passed, issues: allIssues };
  }
  
  setStrictness(level: number): void {
    this.strictness = Math.max(0.5, Math.min(1, level));
  }
}

// ============================================================
// 实验运行器
// ============================================================

class Experiment2Runner {
  private tasks: GenerationTask[];
  private generator: SimulatedGenerator;
  private noValidator: NoValidator;
  private simpleValidator: SimpleValidator;
  private adversarialValidator: AdversarialValidator;
  private results: ValidationResult[] = [];
  private outputDir: string;
  
  constructor(config?: { taskCount?: number; outputDir?: string }) {
    this.tasks = TaskGenerator.generateTasks(config?.taskCount || 50);
    this.generator = new SimulatedGenerator();
    this.noValidator = new NoValidator();
    this.simpleValidator = new SimpleValidator();
    this.adversarialValidator = new AdversarialValidator();
    this.outputDir = config?.outputDir || "./experiment-results";
  }
  
  async run(): Promise<AggregatedValidationResult[]> {
    console.log("=".repeat(60));
    console.log("实验 2：Generator-Evaluator 对抗效果");
    console.log("=".repeat(60));
    console.log(`任务数: ${this.tasks.length}`);
    console.log("");
    
    const aggregatedResults: AggregatedValidationResult[] = [];
    
    // 测试三种验证方式
    const validationTypes: Array<"none" | "simple" | "adversarial"> = ["none", "simple", "adversarial"];
    
    for (const validationType of validationTypes) {
      console.log(`\n--- 测试验证方式: ${validationType} ---`);
      
      const typeResults: ValidationResult[] = [];
      
      for (const task of this.tasks) {
        const result = await this.runTask(task, validationType);
        typeResults.push(result);
        this.results.push(result);
        
        if (typeResults.length % 10 === 0) {
          console.log(`  进度: ${typeResults.length}/${this.tasks.length}`);
        }
      }
      
      const aggregated = this.aggregateResults(validationType, typeResults);
      aggregatedResults.push(aggregated);
      
      console.log(`\n  通过率: ${(aggregated.passRate * 100).toFixed(1)}%`);
      console.log(`  平均质量: ${(aggregated.avgQualityScore * 100).toFixed(1)}%`);
      console.log(`  平均迭代: ${aggregated.avgIterations.toFixed(2)}`);
      console.log(`  平均成本: ${aggregated.avgCost.toFixed(2)}`);
    }
    
    // 保存结果
    await this.saveResults(aggregatedResults);
    
    // 生成报告
    this.generateReport(aggregatedResults);
    
    return aggregatedResults;
  }
  
  private async runTask(
    task: GenerationTask,
    validationType: "none" | "simple" | "adversarial"
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    let iterations = 0;
    let totalCost = 1; // 基础成本
    let currentOutput = this.generator.generate(task);
    let passed = false;
    let finalIssues: string[] = [];
    const maxIterations = 5;
    
    while (!passed && iterations < maxIterations) {
      iterations++;
      
      // 选择验证器
      let validation: { passed: boolean; issues: string[] };
      switch (validationType) {
        case "none":
          validation = this.noValidator.validate(task, currentOutput);
          break;
        case "simple":
          validation = this.simpleValidator.validate(task, currentOutput);
          break;
        case "adversarial":
          validation = this.adversarialValidator.validate(task, currentOutput);
          totalCost += 0.5; // 对抗验证额外成本
          break;
      }
      
      passed = validation.passed;
      finalIssues = validation.issues;
      
      // 如果未通过，尝试改进
      if (!passed && iterations < maxIterations) {
        currentOutput = this.generator.improve(task, finalIssues, currentOutput.quality);
        totalCost += 0.3; // 改进成本
      }
    }
    
    return {
      taskId: task.id,
      validationType,
      passed,
      qualityScore: currentOutput.quality,
      issuesFound: finalIssues,
      iterationsRequired: iterations,
      totalCost,
      timeMs: Date.now() - startTime,
    };
  }
  
  private aggregateResults(
    validationType: string,
    results: ValidationResult[]
  ): AggregatedValidationResult {
    const passedCount = results.filter(r => r.passed).length;
    
    return {
      validationType,
      totalTasks: results.length,
      passedCount,
      passRate: passedCount / results.length,
      avgQualityScore: results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length,
      avgIterations: results.reduce((sum, r) => sum + r.iterationsRequired, 0) / results.length,
      avgCost: results.reduce((sum, r) => sum + r.totalCost, 0) / results.length,
      avgTimeMs: results.reduce((sum, r) => sum + r.timeMs, 0) / results.length,
      issuesPerTask: results.reduce((sum, r) => sum + r.issuesFound.length, 0) / results.length,
    };
  }
  
  private async saveResults(aggregatedResults: AggregatedValidationResult[]): Promise<void> {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    const detailPath = path.join(this.outputDir, `experiment-2-detail-${timestamp}.json`);
    fs.writeFileSync(detailPath, JSON.stringify(this.results, null, 2));
    
    const aggregatedPath = path.join(this.outputDir, `experiment-2-aggregated-${timestamp}.json`);
    fs.writeFileSync(aggregatedPath, JSON.stringify(aggregatedResults, null, 2));
    
    console.log(`\n结果已保存到 ${this.outputDir}`);
  }
  
  private generateReport(results: AggregatedValidationResult[]): void {
    console.log("\n" + "=".repeat(60));
    console.log("实验报告");
    console.log("=".repeat(60));
    
    console.log("\n| 验证方式 | 通过率 | 平均质量 | 平均迭代 | 平均成本 | 问题/任务 |");
    console.log("|----------|--------|----------|----------|----------|-----------|");
    
    for (const r of results) {
      console.log(
        `| ${r.validationType.padEnd(8)} | ` +
        `${(r.passRate * 100).toFixed(1).padStart(5)}% | ` +
        `${(r.avgQualityScore * 100).toFixed(1).padStart(6)}% | ` +
        `${r.avgIterations.toFixed(2).padStart(8)} | ` +
        `${r.avgCost.toFixed(2).padStart(8)} | ` +
        `${r.issuesPerTask.toFixed(2).padStart(9)} |`
      );
    }
    
    // 分析
    console.log("\n--- 分析结论 ---");
    
    const noneResult = results.find(r => r.validationType === "none")!;
    const simpleResult = results.find(r => r.validationType === "simple")!;
    const adversarialResult = results.find(r => r.validationType === "adversarial")!;
    
    // 质量提升
    const simpleImprovement = simpleResult.avgQualityScore - noneResult.avgQualityScore;
    const adversarialImprovement = adversarialResult.avgQualityScore - noneResult.avgQualityScore;
    
    console.log(`\n质量提升:`);
    console.log(`  简单验证: +${(simpleImprovement * 100).toFixed(1)}%`);
    console.log(`  对抗验证: +${(adversarialImprovement * 100).toFixed(1)}%`);
    
    // 成本分析
    const simpleCostRatio = simpleResult.avgCost / noneResult.avgCost;
    const adversarialCostRatio = adversarialResult.avgCost / noneResult.avgCost;
    
    console.log(`\n成本增加:`);
    console.log(`  简单验证: ${simpleCostRatio.toFixed(2)}x`);
    console.log(`  对抗验证: ${adversarialCostRatio.toFixed(2)}x`);
    
    // ROI 分析
    const simpleROI = simpleImprovement / (simpleResult.avgCost - noneResult.avgCost);
    const adversarialROI = adversarialImprovement / (adversarialResult.avgCost - noneResult.avgCost);
    
    console.log(`\nROI (质量提升/成本增加):`);
    console.log(`  简单验证: ${simpleROI.toFixed(3)}`);
    console.log(`  对抗验证: ${adversarialROI.toFixed(3)}`);
    
    // 结论
    console.log("\n--- 最终结论 ---");
    
    if (adversarialImprovement > 0.1 && adversarialROI > simpleROI) {
      console.log("✓ 对抗验证显著提升质量且 ROI 更高，建议保持");
    } else if (adversarialImprovement > 0.1 && adversarialROI < simpleROI) {
      console.log("⚠ 对抗验证提升质量但 ROI 较低，建议优化策略");
    } else if (adversarialImprovement < 0.05) {
      console.log("✗ 对抗验证效果不明显，建议简化或移除");
    } else {
      console.log("→ 对抗验证有一定效果，根据场景选择使用");
    }
    
    console.log("\n" + "=".repeat(60));
  }
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  const runner = new Experiment2Runner({
    taskCount: 50,
    outputDir: "./experiment-results",
  });
  
  await runner.run();
}

if (require.main === module) {
  main().catch(console.error);
}
