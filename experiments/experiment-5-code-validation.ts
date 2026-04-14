/**
 * 实验 5：代码正确性验证
 * 
 * 目的：验证 H-004（模型无法区分"看起来对"和"真的对"）
 * 
 * 假设：模型生成的代码可能：
 * 1. 语法正确但逻辑错误
 * 2. 边界条件处理不当
 * 3. 类型错误
 * 4. 性能问题
 * 5. 安全漏洞
 */

import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import * as util from "util";

const exec = util.promisify(childProcess.exec);

// ============================================================
// 类型定义
// ============================================================

interface CodeSample {
  id: string;
  description: string;
  code: string;
  language: "typescript" | "javascript" | "python";
  category: "correct" | "syntax_error" | "logic_error" | "edge_case" | "security" | "performance";
  expectedBehavior: string;
  actualBehavior?: string;
  testCases: TestCase[];
}

interface TestCase {
  input: any;
  expectedOutput: any;
  description: string;
}

interface ValidationResult {
  sampleId: string;
  category: string;
  syntaxCheck: "pass" | "fail";
  typeCheck: "pass" | "fail" | "skip";
  testResults: TestResult[];
  staticAnalysis: StaticAnalysisResult[];
  overallVerdict: "correct" | "incorrect" | "partial";
  issues: Issue[];
}

interface TestResult {
  testCase: string;
  passed: boolean;
  actualOutput?: any;
  error?: string;
}

interface StaticAnalysisResult {
  tool: string;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
}

interface Issue {
  type: "syntax" | "type" | "logic" | "security" | "performance";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  detected: boolean;
  detectionMethod: string;
}

interface ExperimentResult {
  totalSamples: number;
  correctSamples: number;
  incorrectSamples: number;
  partialSamples: number;
  detectionRate: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  categoryBreakdown: Record<string, { total: number; detected: number }>;
  conclusion: string;
}

// ============================================================
// 代码验证器
// ============================================================

class CodeValidator {
  private tempDir: string;
  
  constructor(tempDir: string = "./temp-code-validation") {
    this.tempDir = tempDir;
    this.ensureDir(tempDir);
  }
  
  /**
   * 验证代码样本
   */
  async validate(sample: CodeSample): Promise<ValidationResult> {
    const result: ValidationResult = {
      sampleId: sample.id,
      category: sample.category,
      syntaxCheck: "pass",
      typeCheck: "skip",
      testResults: [],
      staticAnalysis: [],
      overallVerdict: "correct",
      issues: [],
    };
    
    // 1. 语法检查
    const syntaxResult = await this.checkSyntax(sample);
    result.syntaxCheck = syntaxResult.passed ? "pass" : "fail";
    
    if (!syntaxResult.passed) {
      result.issues.push({
        type: "syntax",
        severity: "critical",
        description: syntaxResult.error || "语法错误",
        detected: true,
        detectionMethod: "syntax_check",
      });
      result.overallVerdict = "incorrect";
      return result;
    }
    
    // 2. 类型检查（TypeScript）
    if (sample.language === "typescript") {
      const typeResult = await this.checkTypes(sample);
      result.typeCheck = typeResult.passed ? "pass" : "fail";
      
      if (!typeResult.passed) {
        result.issues.push({
          type: "type",
          severity: "high",
          description: typeResult.error || "类型错误",
          detected: true,
          detectionMethod: "type_check",
        });
      }
    }
    
    // 3. 运行测试用例
    for (const testCase of sample.testCases) {
      const testResult = await this.runTest(sample, testCase);
      result.testResults.push(testResult);
      
      if (!testResult.passed) {
        result.issues.push({
          type: "logic",
          severity: "high",
          description: `测试失败: ${testCase.description}`,
          detected: true,
          detectionMethod: "unit_test",
        });
      }
    }
    
    // 4. 静态分析
    const staticResults = await this.runStaticAnalysis(sample);
    result.staticAnalysis = staticResults;
    
    for (const analysis of staticResults) {
      if (analysis.severity === "error") {
        result.issues.push({
          type: "security",
          severity: "high",
          description: analysis.message,
          detected: true,
          detectionMethod: analysis.tool,
        });
      }
    }
    
    // 5. 判断最终结果
    if (sample.category !== "correct") {
      // 应该检测到问题
      const expectedIssueDetected = result.issues.some(
        i => i.type === this.mapCategoryToType(sample.category)
      );
      
      if (!expectedIssueDetected) {
        result.issues.push({
          type: this.mapCategoryToType(sample.category),
          severity: "high",
          description: `预期问题未被检测: ${sample.category}`,
          detected: false,
          detectionMethod: "expected",
        });
      }
    }
    
    // 计算总体判定
    const criticalIssues = result.issues.filter(i => i.severity === "critical");
    const highIssues = result.issues.filter(i => i.severity === "high");
    
    if (criticalIssues.length > 0) {
      result.overallVerdict = "incorrect";
    } else if (highIssues.length > 0) {
      result.overallVerdict = "partial";
    }
    
    return result;
  }
  
  /**
   * 语法检查
   */
  private async checkSyntax(sample: CodeSample): Promise<{ passed: boolean; error?: string }> {
    const filePath = path.join(this.tempDir, `sample-${sample.id}.${this.getExtension(sample.language)}`);
    
    fs.writeFileSync(filePath, sample.code);
    
    try {
      if (sample.language === "typescript") {
        await exec(`npx tsc --noEmit --skipLibCheck ${filePath}`, { timeout: 10000 });
      } else if (sample.language === "javascript") {
        await exec(`node --check ${filePath}`, { timeout: 5000 });
      } else if (sample.language === "python") {
        await exec(`python3 -m py_compile ${filePath}`, { timeout: 5000 });
      }
      
      return { passed: true };
    } catch (error: any) {
      return { passed: false, error: error.message };
    }
  }
  
  /**
   * 类型检查
   */
  private async checkTypes(sample: CodeSample): Promise<{ passed: boolean; error?: string }> {
    if (sample.language !== "typescript") {
      return { passed: true };
    }
    
    const filePath = path.join(this.tempDir, `sample-${sample.id}.ts`);
    
    try {
      await exec(`npx tsc --noEmit --strict ${filePath}`, { timeout: 10000 });
      return { passed: true };
    } catch (error: any) {
      return { passed: false, error: error.message };
    }
  }
  
  /**
   * 运行测试用例
   */
  private async runTest(sample: CodeSample, testCase: TestCase): Promise<TestResult> {
    const result: TestResult = {
      testCase: testCase.description,
      passed: false,
    };
    
    try {
      // 构建测试代码
      const testCode = this.buildTestCode(sample, testCase);
      const testFilePath = path.join(this.tempDir, `test-${sample.id}-${Date.now()}.${this.getExtension(sample.language)}`);
      
      fs.writeFileSync(testFilePath, testCode);
      
      // 执行测试
      const { stdout, stderr } = await exec(
        sample.language === "python" ? `python3 ${testFilePath}` : `node ${testFilePath}`,
        { timeout: 5000 }
      );
      
      // 解析输出
      const output = JSON.parse(stdout.trim());
      result.actualOutput = output;
      result.passed = JSON.stringify(output) === JSON.stringify(testCase.expectedOutput);
      
      // 清理
      fs.unlinkSync(testFilePath);
      
    } catch (error: any) {
      result.error = error.message;
      result.passed = false;
    }
    
    return result;
  }
  
  /**
   * 静态分析
   */
  private async runStaticAnalysis(sample: CodeSample): Promise<StaticAnalysisResult[]> {
    const results: StaticAnalysisResult[] = [];
    
    // 简单的模式匹配分析
    const code = sample.code;
    
    // 检查常见安全问题
    const securityPatterns = [
      { pattern: /eval\s*\(/, message: "使用 eval() 可能导致代码注入", severity: "error" as const },
      { pattern: /innerHTML\s*=/, message: "直接设置 innerHTML 可能导致 XSS", severity: "warning" as const },
      { pattern: /password\s*=\s*['"]/, message: "硬编码密码", severity: "error" as const },
      { pattern: /sql\s*\+/, message: "SQL 拼接可能导致注入", severity: "error" as const },
    ];
    
    for (const { pattern, message, severity } of securityPatterns) {
      if (pattern.test(code)) {
        const match = code.match(pattern);
        const line = match ? code.substring(0, match.index).split("\n").length : undefined;
        
        results.push({
          tool: "pattern_match",
          severity,
          message,
          line,
        });
      }
    }
    
    // 检查性能问题
    const performancePatterns = [
      { pattern: /while\s*\(\s*true\s*\)/, message: "无限循环风险", severity: "warning" as const },
      { pattern: /for\s*\([^)]*\)\s*\{[^}]*for\s*\(/, message: "嵌套循环可能影响性能", severity: "info" as const },
    ];
    
    for (const { pattern, message, severity } of performancePatterns) {
      if (pattern.test(code)) {
        results.push({
          tool: "pattern_match",
          severity,
          message,
        });
      }
    }
    
    return results;
  }
  
  /**
   * 构建测试代码
   */
  private buildTestCode(sample: CodeSample, testCase: TestCase): string {
    if (sample.language === "python") {
      return `
${sample.code}

import json
result = solution(${JSON.stringify(testCase.input)})
print(json.dumps(result))
`;
    }
    
    return `
${sample.code}

const result = solution(${JSON.stringify(testCase.input)});
console.log(JSON.stringify(result));
`;
  }
  
  private getExtension(language: string): string {
    switch (language) {
      case "typescript": return "ts";
      case "javascript": return "js";
      case "python": return "py";
      default: return "txt";
    }
  }
  
  private mapCategoryToType(category: string): Issue["type"] {
    switch (category) {
      case "syntax_error": return "syntax";
      case "logic_error": return "logic";
      case "edge_case": return "logic";
      case "security": return "security";
      case "performance": return "performance";
      default: return "logic";
    }
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  /**
   * 清理临时文件
   */
  cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.tempDir, file));
      }
    }
  }
}

// ============================================================
// 测试样本
// ============================================================

const codeSamples: CodeSample[] = [
  // 正确代码
  {
    id: "correct-1",
    description: "正确的数组求和函数",
    code: `
function solution(arr: number[]): number {
  return arr.reduce((sum, n) => sum + n, 0);
}
`,
    language: "typescript",
    category: "correct",
    expectedBehavior: "返回数组元素之和",
    testCases: [
      { input: [1, 2, 3], expectedOutput: 6, description: "正常数组" },
      { input: [], expectedOutput: 0, description: "空数组" },
      { input: [-1, 1], expectedOutput: 0, description: "包含负数" },
    ],
  },
  
  // 语法错误
  {
    id: "syntax-1",
    description: "缺少括号",
    code: `
function solution(arr: number[]): number {
  return arr.reduce((sum, n) => sum + n, 0
}
`,
    language: "typescript",
    category: "syntax_error",
    expectedBehavior: "应该报语法错误",
    testCases: [],
  },
  
  // 逻辑错误
  {
    id: "logic-1",
    description: "错误的比较逻辑",
    code: `
function solution(arr: number[]): number {
  let max = arr[0];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < max) {  // 错误：应该是 >
      max = arr[i];
    }
  }
  return max;
}
`,
    language: "typescript",
    category: "logic_error",
    expectedBehavior: "应该返回最大值，但实际返回最小值",
    testCases: [
      { input: [1, 2, 3], expectedOutput: 3, description: "应该返回 3" },
    ],
  },
  
  // 边界条件
  {
    id: "edge-1",
    description: "未处理空数组",
    code: `
function solution(arr: number[]): number {
  let max = arr[0];  // 空数组时会报错
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}
`,
    language: "typescript",
    category: "edge_case",
    expectedBehavior: "空数组时应该返回 undefined 或抛出错误",
    testCases: [
      { input: [], expectedOutput: undefined, description: "空数组" },
    ],
  },
  
  // 安全问题
  {
    id: "security-1",
    description: "使用 eval()",
    code: `
function solution(expr: string): any {
  return eval(expr);  // 危险！
}
`,
    language: "typescript",
    category: "security",
    expectedBehavior: "应该避免使用 eval",
    testCases: [
      { input: "1 + 1", expectedOutput: 2, description: "简单表达式" },
    ],
  },
  
  // 性能问题
  {
    id: "performance-1",
    description: "O(n²) 查找重复",
    code: `
function solution(arr: number[]): number[] {
  const duplicates: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
        duplicates.push(arr[i]);
      }
    }
  }
  return duplicates;
}
`,
    language: "typescript",
    category: "performance",
    expectedBehavior: "可以使用 Set 优化到 O(n)",
    testCases: [
      { input: [1, 2, 1, 3, 2], expectedOutput: [1, 2], description: "查找重复" },
    ],
  },
];

// ============================================================
// 主实验
// ============================================================

async function runExperiment() {
  console.log("=".repeat(60));
  console.log("实验 5：代码正确性验证");
  console.log("=".repeat(60));
  
  const validator = new CodeValidator("./experiment-results/temp-code-validation");
  
  const results: ValidationResult[] = [];
  
  for (const sample of codeSamples) {
    console.log(`\n验证: ${sample.description} (${sample.category})`);
    
    const result = await validator.validate(sample);
    results.push(result);
    
    console.log(`  语法检查: ${result.syntaxCheck}`);
    console.log(`  类型检查: ${result.typeCheck}`);
    console.log(`  测试通过: ${result.testResults.filter(t => t.passed).length}/${result.testResults.length}`);
    console.log(`  检测到问题: ${result.issues.length}`);
    console.log(`  总体判定: ${result.overallVerdict}`);
  }
  
  // 统计结果
  console.log("\n" + "=".repeat(60));
  console.log("实验结论");
  console.log("=".repeat(60));
  
  const totalSamples = results.length;
  const correctSamples = results.filter(r => r.overallVerdict === "correct").length;
  const incorrectSamples = results.filter(r => r.overallVerdict === "incorrect").length;
  const partialSamples = results.filter(r => r.overallVerdict === "partial").length;
  
  // 计算检测率
  let expectedIssues = 0;
  let detectedIssues = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  
  for (const sample of codeSamples) {
    if (sample.category !== "correct") {
      expectedIssues++;
      
      const result = results.find(r => r.sampleId === sample.id);
      const expectedType = sample.category === "syntax_error" ? "syntax" :
                          sample.category === "logic_error" ? "logic" :
                          sample.category === "edge_case" ? "logic" :
                          sample.category === "security" ? "security" : "performance";
      
      const detected = result?.issues.some(i => i.type === expectedType);
      
      if (detected) {
        detectedIssues++;
      } else {
        falseNegatives++;
      }
    } else {
      const result = results.find(r => r.sampleId === sample.id);
      if (result && result.issues.length > 0) {
        falsePositives++;
      }
    }
  }
  
  const detectionRate = expectedIssues > 0 ? detectedIssues / expectedIssues : 0;
  const falsePositiveRate = codeSamples.filter(s => s.category === "correct").length > 0 
    ? falsePositives / codeSamples.filter(s => s.category === "correct").length 
    : 0;
  
  console.log(`\n总样本数: ${totalSamples}`);
  console.log(`正确: ${correctSamples}, 部分正确: ${partialSamples}, 错误: ${incorrectSamples}`);
  console.log(`\n问题检测率: ${(detectionRate * 100).toFixed(1)}%`);
  console.log(`误报率: ${(falsePositiveRate * 100).toFixed(1)}%`);
  console.log(`漏报数: ${falseNegatives}`);
  
  // 分类统计
  console.log("\n分类统计:");
  const categoryBreakdown: Record<string, { total: number; detected: number }> = {};
  
  for (const sample of codeSamples) {
    if (!categoryBreakdown[sample.category]) {
      categoryBreakdown[sample.category] = { total: 0, detected: 0 };
    }
    categoryBreakdown[sample.category].total++;
    
    const result = results.find(r => r.sampleId === sample.id);
    if (result && result.issues.length > 0) {
      categoryBreakdown[sample.category].detected++;
    }
  }
  
  for (const [category, stats] of Object.entries(categoryBreakdown)) {
    console.log(`  ${category}: ${stats.detected}/${stats.total} 检测`);
  }
  
  // 结论
  let conclusion = "";
  if (detectionRate >= 0.8) {
    conclusion = "✅ 假设 H-004 不成立：验证工具能有效检测代码问题";
  } else if (detectionRate >= 0.5) {
    conclusion = "⚠️ 假设 H-004 部分成立：验证工具能检测部分问题，但仍需改进";
  } else {
    conclusion = "❌ 假设 H-004 成立：模型生成的代码问题难以被自动检测";
  }
  
  console.log(`\n${conclusion}`);
  
  if (detectionRate < 0.8) {
    console.log("建议：实现 CodeValidator 组件，结合多种验证方法");
  }
  
  // 保存结果
  const reportPath = "./experiment-results/experiment-5-code-validation.json";
  const experimentResult: ExperimentResult = {
    totalSamples,
    correctSamples,
    incorrectSamples,
    partialSamples,
    detectionRate,
    falsePositiveRate,
    falseNegativeRate: falseNegatives,
    categoryBreakdown,
    conclusion,
  };
  
  fs.writeFileSync(reportPath, JSON.stringify({
    results,
    summary: experimentResult,
  }, null, 2));
  
  console.log(`\n结果已保存: ${reportPath}`);
  
  // 清理
  validator.cleanup();
}

if (require.main === module) {
  runExperiment();
}

export { CodeValidator, codeSamples };
export type { CodeSample, TestCase, ValidationResult, TestResult, StaticAnalysisResult, Issue, ExperimentResult };
