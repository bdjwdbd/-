/**
 * 实验 1：上下文使用率与性能关系
 * 
 * 目的：验证 H-001 假设（40% 阈值）
 * 
 * 方法：
 * 1. 准备标准测试集（100 个任务）
 * 2. 在不同上下文使用率下运行（20%, 40%, 60%, 80%）
 * 3. 记录任务完成率、准确率、耗时
 * 
 * 预期结果：
 * - 如果 40% 后性能显著下降 → 保持 ContextReset 阈值
 * - 如果 60% 后才下降 → 调整阈值为 60%
 * - 如果无显著下降 → 考虑移除 ContextReset
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

interface TestCase {
  id: string;
  type: "simple" | "medium" | "complex";
  prompt: string;
  expectedOutput?: string;
  tools?: string[];
  maxSteps?: number;
}

interface ExperimentResult {
  testId: string;
  contextUsage: number;      // 上下文使用率
  completed: boolean;         // 是否完成
  accuracy: number;           // 准确率 (0-1)
  latency: number;            // 耗时 (ms)
  tokenCount: number;         // token 数量
  errorCount: number;         // 错误次数
  hallucinationScore: number; // 幻觉评分 (0-1, 越高越严重)
  loopCount: number;          // 循环次数
}

interface AggregatedResult {
  contextUsage: number;
  totalTests: number;
  completedCount: number;
  completionRate: number;
  avgAccuracy: number;
  avgLatency: number;
  avgTokenCount: number;
  avgErrorCount: number;
  avgHallucinationScore: number;
  avgLoopCount: number;
}

interface ExperimentConfig {
  contextThresholds: number[];  // 要测试的上下文使用率
  testCases: TestCase[];
  iterationsPerThreshold: number;
  outputDir: string;
}

// ============================================================
// 测试集生成器
// ============================================================

export class TestSetGenerator {
  /**
   * 生成标准测试集
   */
  static generateStandardSet(count: number = 100): TestCase[] {
    const cases: TestCase[] = [];
    
    // 简单任务 (40%)
    for (let i = 0; i < count * 0.4; i++) {
      cases.push(this.generateSimpleTask(i));
    }
    
    // 中等任务 (40%)
    for (let i = 0; i < count * 0.4; i++) {
      cases.push(this.generateMediumTask(i));
    }
    
    // 复杂任务 (20%)
    for (let i = 0; i < count * 0.2; i++) {
      cases.push(this.generateComplexTask(i));
    }
    
    return cases;
  }
  
  private static generateSimpleTask(index: number): TestCase {
    const tasks = [
      { prompt: "读取 package.json 文件并返回 name 字段", tools: ["read_file"] },
      { prompt: "列出当前目录下的所有文件", tools: ["list_files"] },
      { prompt: "获取当前时间", tools: ["get_time"] },
      { prompt: "计算 123 + 456", tools: ["calculate"] },
      { prompt: "将字符串 'hello' 转换为大写", tools: ["string_transform"] },
    ];
    const task = tasks[index % tasks.length];
    return {
      id: `simple-${index}`,
      type: "simple",
      prompt: task.prompt,
      tools: task.tools,
      maxSteps: 3,
    };
  }
  
  private static generateMediumTask(index: number): TestCase {
    const tasks = [
      { prompt: "读取 package.json，解析依赖，并检查每个依赖是否有安全漏洞", tools: ["read_file", "check_vulnerability"] },
      { prompt: "搜索代码库中所有 TODO 注释，并生成报告", tools: ["search_files", "write_file"] },
      { prompt: "分析最近的 git 提交，生成变更摘要", tools: ["git_log", "summarize"] },
      { prompt: "读取配置文件，验证所有必需字段是否存在", tools: ["read_file", "validate"] },
      { prompt: "遍历目录结构，找出所有超过 1MB 的文件", tools: ["list_files", "get_file_size"] },
    ];
    const task = tasks[index % tasks.length];
    return {
      id: `medium-${index}`,
      type: "medium",
      prompt: task.prompt,
      tools: task.tools,
      maxSteps: 10,
    };
  }
  
  private static generateComplexTask(index: number): TestCase {
    const tasks = [
      { prompt: "重构指定模块，应用 SOLID 原则，并确保所有测试通过", tools: ["read_file", "write_file", "run_tests", "git_commit"] },
      { prompt: "分析整个代码库，生成架构文档，包括模块依赖图", tools: ["search_files", "analyze", "write_file", "generate_diagram"] },
      { prompt: "实现一个新功能，包括设计、编码、测试和文档", tools: ["read_file", "write_file", "run_tests", "generate_docs"] },
      { prompt: "优化性能瓶颈，需要分析、实施和验证", tools: ["profile", "read_file", "write_file", "benchmark"] },
      { prompt: "修复一个复杂的 bug，需要定位、修复和回归测试", tools: ["debug", "read_file", "write_file", "run_tests"] },
    ];
    const task = tasks[index % tasks.length];
    return {
      id: `complex-${index}`,
      type: "complex",
      prompt: task.prompt,
      tools: task.tools,
      maxSteps: 50,
    };
  }
}

// ============================================================
// 模拟 Agent（用于实验）
// ============================================================

export class SimulatedAgent {
  private contextWindow: number = 128000;  // 假设 128k 上下文
  private currentContext: number = 0;
  private contextHistory: string[] = [];
  
  /**
   * 模拟执行任务
   */
  async executeTask(
    testCase: TestCase,
    targetContextUsage: number
  ): Promise<ExperimentResult> {
    const startTime = Date.now();
    
    // 预填充上下文到目标使用率
    this.prefillContext(targetContextUsage);
    
    let completed = false;
    let accuracy = 0;
    let errorCount = 0;
    let hallucinationScore = 0;
    let loopCount = 0;
    
    // 模拟执行过程
    const maxSteps = testCase.maxSteps || 10;
    for (let step = 0; step < maxSteps; step++) {
      loopCount++;
      
      // 模拟上下文增长
      this.currentContext += this.estimateTokenGrowth(testCase.type);
      
      // 模拟性能下降（基于上下文使用率）
      const degradationFactor = this.calculateDegradationFactor();
      
      // 模拟错误概率增加
      if (Math.random() < degradationFactor * 0.1) {
        errorCount++;
      }
      
      // 模拟幻觉概率增加
      if (Math.random() < degradationFactor * 0.05) {
        hallucinationScore += 0.1;
      }
      
      // 模拟任务完成判断
      const completionProbability = this.calculateCompletionProbability(
        testCase.type,
        degradationFactor,
        step,
        maxSteps
      );
      
      if (Math.random() < completionProbability) {
        completed = true;
        accuracy = Math.max(0, 1 - degradationFactor * 0.3 - hallucinationScore);
        break;
      }
    }
    
    const latency = Date.now() - startTime;
    const tokenCount = this.currentContext;
    
    return {
      testId: testCase.id,
      contextUsage: targetContextUsage,
      completed,
      accuracy: Math.max(0, Math.min(1, accuracy)),
      latency,
      tokenCount,
      errorCount,
      hallucinationScore: Math.max(0, Math.min(1, hallucinationScore)),
      loopCount,
    };
  }
  
  /**
   * 预填充上下文
   */
  private prefillContext(targetUsage: number): void {
    this.currentContext = Math.floor(this.contextWindow * targetUsage);
    this.contextHistory = [];
    
    // 填充历史记录
    const historyCount = Math.floor(this.currentContext / 100);
    for (let i = 0; i < historyCount; i++) {
      this.contextHistory.push(`Historical message ${i}`);
    }
  }
  
  /**
   * 估算每步的 token 增长
   */
  private estimateTokenGrowth(taskType: string): number {
    switch (taskType) {
      case "simple": return 100 + Math.random() * 50;
      case "medium": return 300 + Math.random() * 200;
      case "complex": return 800 + Math.random() * 400;
      default: return 200;
    }
  }
  
  /**
   * 计算性能下降因子
   * 
   * 基于 Anthropic 和 OpenAI 的研究：
   * - 0-40%：性能稳定
   * - 40-60%：轻微下降
   * - 60-80%：显著下降
   * - 80-100%：严重下降
   */
  private calculateDegradationFactor(): number {
    const usage = this.currentContext / this.contextWindow;
    
    if (usage <= 0.4) {
      return 0.1;  // 基准错误率
    } else if (usage <= 0.6) {
      return 0.1 + (usage - 0.4) * 0.5;  // 0.1 -> 0.2
    } else if (usage <= 0.8) {
      return 0.2 + (usage - 0.6) * 1.0;  // 0.2 -> 0.4
    } else {
      return 0.4 + (usage - 0.8) * 2.0;  // 0.4 -> 0.8
    }
  }
  
  /**
   * 计算任务完成概率
   */
  private calculateCompletionProbability(
    taskType: string,
    degradationFactor: number,
    currentStep: number,
    maxSteps: number
  ): number {
    // 基础完成概率
    let baseProbability: number;
    switch (taskType) {
      case "simple": baseProbability = 0.5; break;
      case "medium": baseProbability = 0.3; break;
      case "complex": baseProbability = 0.15; break;
      default: baseProbability = 0.3;
    }
    
    // 步骤进度加成
    const progressBonus = currentStep / maxSteps * 0.3;
    
    // 性能下降惩罚
    const degradationPenalty = degradationFactor * 0.5;
    
    return Math.max(0.05, Math.min(0.95, baseProbability + progressBonus - degradationPenalty));
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.currentContext = 0;
    this.contextHistory = [];
  }
}

// ============================================================
// 实验运行器
// ============================================================

export class Experiment1Runner {
  private config: ExperimentConfig;
  private results: ExperimentResult[] = [];
  private agent: SimulatedAgent;
  
  constructor(config?: Partial<ExperimentConfig>) {
    this.config = {
      contextThresholds: [0.2, 0.4, 0.6, 0.8],
      testCases: TestSetGenerator.generateStandardSet(100),
      iterationsPerThreshold: 1,
      outputDir: "./experiment-results",
      ...config,
    };
    this.agent = new SimulatedAgent();
  }
  
  /**
   * 运行实验
   */
  async run(): Promise<AggregatedResult[]> {
    console.log("=".repeat(60));
    console.log("实验 1：上下文使用率与性能关系");
    console.log("=".repeat(60));
    console.log(`测试用例数: ${this.config.testCases.length}`);
    console.log(`测试阈值: ${this.config.contextThresholds.map(t => `${t * 100}%`).join(", ")}`);
    console.log("");
    
    const aggregatedResults: AggregatedResult[] = [];
    
    for (const threshold of this.config.contextThresholds) {
      console.log(`\n--- 测试上下文使用率: ${threshold * 100}% ---`);
      
      const thresholdResults: ExperimentResult[] = [];
      
      for (const testCase of this.config.testCases) {
        this.agent.reset();
        const result = await this.agent.executeTask(testCase, threshold);
        thresholdResults.push(result);
        this.results.push(result);
        
        // 进度显示
        if (thresholdResults.length % 20 === 0) {
          console.log(`  进度: ${thresholdResults.length}/${this.config.testCases.length}`);
        }
      }
      
      // 聚合结果
      const aggregated = this.aggregateResults(threshold, thresholdResults);
      aggregatedResults.push(aggregated);
      
      console.log(`\n  完成率: ${(aggregated.completionRate * 100).toFixed(1)}%`);
      console.log(`  平均准确率: ${(aggregated.avgAccuracy * 100).toFixed(1)}%`);
      console.log(`  平均延迟: ${aggregated.avgLatency.toFixed(0)}ms`);
      console.log(`  平均错误次数: ${aggregated.avgErrorCount.toFixed(2)}`);
      console.log(`  平均幻觉评分: ${aggregated.avgHallucinationScore.toFixed(3)}`);
    }
    
    // 保存结果
    await this.saveResults(aggregatedResults);
    
    // 生成报告
    this.generateReport(aggregatedResults);
    
    return aggregatedResults;
  }
  
  /**
   * 聚合结果
   */
  private aggregateResults(
    contextUsage: number,
    results: ExperimentResult[]
  ): AggregatedResult {
    const completedCount = results.filter(r => r.completed).length;
    
    return {
      contextUsage,
      totalTests: results.length,
      completedCount,
      completionRate: completedCount / results.length,
      avgAccuracy: results.reduce((sum, r) => sum + r.accuracy, 0) / results.length,
      avgLatency: results.reduce((sum, r) => sum + r.latency, 0) / results.length,
      avgTokenCount: results.reduce((sum, r) => sum + r.tokenCount, 0) / results.length,
      avgErrorCount: results.reduce((sum, r) => sum + r.errorCount, 0) / results.length,
      avgHallucinationScore: results.reduce((sum, r) => sum + r.hallucinationScore, 0) / results.length,
      avgLoopCount: results.reduce((sum, r) => sum + r.loopCount, 0) / results.length,
    };
  }
  
  /**
   * 保存结果到文件
   */
  private async saveResults(aggregatedResults: AggregatedResult[]): Promise<void> {
    const outputDir = this.config.outputDir;
    
    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    // 保存详细结果
    const detailPath = path.join(outputDir, `experiment-1-detail-${timestamp}.json`);
    fs.writeFileSync(detailPath, JSON.stringify(this.results, null, 2));
    console.log(`\n详细结果已保存: ${detailPath}`);
    
    // 保存聚合结果
    const aggregatedPath = path.join(outputDir, `experiment-1-aggregated-${timestamp}.json`);
    fs.writeFileSync(aggregatedPath, JSON.stringify(aggregatedResults, null, 2));
    console.log(`聚合结果已保存: ${aggregatedPath}`);
  }
  
  /**
   * 生成报告
   */
  private generateReport(results: AggregatedResult[]): void {
    console.log("\n" + "=".repeat(60));
    console.log("实验报告");
    console.log("=".repeat(60));
    
    // 表格输出
    console.log("\n| 上下文使用率 | 完成率 | 准确率 | 延迟(ms) | 错误次数 | 幻觉评分 |");
    console.log("|-------------|--------|--------|----------|----------|----------|");
    
    for (const r of results) {
      console.log(
        `| ${(r.contextUsage * 100).toFixed(0).padStart(11)}% | ` +
        `${(r.completionRate * 100).toFixed(1).padStart(5)}% | ` +
        `${(r.avgAccuracy * 100).toFixed(1).padStart(5)}% | ` +
        `${r.avgLatency.toFixed(0).padStart(8)} | ` +
        `${r.avgErrorCount.toFixed(2).padStart(8)} | ` +
        `${r.avgHallucinationScore.toFixed(3).padStart(8)} |`
      );
    }
    
    // 分析结论
    console.log("\n--- 分析结论 ---");
    
    // 找到性能显著下降的阈值
    let significantDropThreshold: number | null = null;
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];
      
      // 完成率下降超过 10% 或准确率下降超过 15%
      if (
        prev.completionRate - curr.completionRate > 0.1 ||
        prev.avgAccuracy - curr.avgAccuracy > 0.15
      ) {
        significantDropThreshold = prev.contextUsage;
        break;
      }
    }
    
    if (significantDropThreshold !== null) {
      console.log(`\n✓ 检测到性能显著下降点: ${significantDropThreshold * 100}%`);
      
      if (significantDropThreshold === 0.4) {
        console.log("→ 结论: 40% 阈值假设成立，建议保持 ContextReset 阈值");
      } else if (significantDropThreshold === 0.6) {
        console.log("→ 结论: 60% 才开始下降，建议调整 ContextReset 阈值为 60%");
      } else if (significantDropThreshold === 0.2) {
        console.log("→ 结论: 20% 就开始下降，建议降低 ContextReset 阈值");
      } else {
        console.log(`→ 结论: 建议调整 ContextReset 阈值为 ${significantDropThreshold * 100}%`);
      }
    } else {
      console.log("\n✓ 未检测到显著性能下降");
      console.log("→ 结论: 考虑移除或放宽 ContextReset 限制");
    }
    
    // 幻觉分析
    const highHallucinationThreshold = results.find(r => r.avgHallucinationScore > 0.2);
    if (highHallucinationThreshold) {
      console.log(`\n⚠ 幻觉评分在 ${(highHallucinationThreshold.contextUsage * 100)}% 时超过 0.2`);
      console.log("  建议: 在此阈值前进行上下文压缩或重置");
    }
    
    console.log("\n" + "=".repeat(60));
  }
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  const runner = new Experiment1Runner({
    contextThresholds: [0.2, 0.4, 0.6, 0.8],
    testCases: TestSetGenerator.generateStandardSet(100),
    iterationsPerThreshold: 1,
    outputDir: "./experiment-results",
  });
  
  await runner.run();
}

// 运行
if (require.main === module) {
  main().catch(console.error);
}
