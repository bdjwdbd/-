/**
 * CodeValidator - 代码正确性验证组件
 * 
 * 功能：
 * 1. 语法检查
 * 2. 类型检查
 * 3. 单元测试执行
 * 4. 静态分析
 * 5. 安全漏洞检测
 * 6. 性能分析
 */

import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import * as util from "util";

const exec = util.promisify(childProcess.exec);

// ============================================================
// 类型定义
// ============================================================

type Language = "typescript" | "javascript" | "python";
type Severity = "error" | "warning" | "info";
type CheckStatus = "pass" | "fail" | "skip";

interface CodeInput {
  id: string;
  code: string;
  language: Language;
  filename?: string;
}

interface TestCase {
  name: string;
  input: unknown;
  expected: unknown;
  timeout?: number;
}

interface CheckResult {
  type: string;
  status: CheckStatus;
  message: string;
  details?: unknown;
  duration: number;
}

interface ValidationResult {
  inputId: string;
  overall: "valid" | "invalid" | "partial";
  checks: CheckResult[];
  testResults: TestResult[];
  issues: Issue[];
  score: number;
  timestamp: Date;
}

interface TestResult {
  name: string;
  passed: boolean;
  actual?: unknown;
  expected: unknown;
  error?: string;
  duration: number;
}

interface Issue {
  type: "syntax" | "type" | "logic" | "security" | "performance" | "style";
  severity: Severity;
  message: string;
  line?: number;
  column?: number;
  rule?: string;
  suggestion?: string;
}

interface ValidatorConfig {
  tempDir: string;
  timeout: number;
  enableTypeCheck: boolean;
  enableStaticAnalysis: boolean;
  enableSecurityCheck: boolean;
  enablePerformanceCheck: boolean;
  strictMode: boolean;
}

// ============================================================
// CodeValidator 组件
// ============================================================

export class CodeValidator {
  private config: ValidatorConfig;
  
  constructor(config?: Partial<ValidatorConfig>) {
    this.config = {
      tempDir: "./temp-validator",
      timeout: 30000,
      enableTypeCheck: true,
      enableStaticAnalysis: true,
      enableSecurityCheck: true,
      enablePerformanceCheck: true,
      strictMode: false,
      ...config,
    };
    
    this.ensureDir(this.config.tempDir);
  }
  
  /**
   * 验证代码
   */
  async validate(input: CodeInput, testCases?: TestCase[]): Promise<ValidationResult> {
    const result: ValidationResult = {
      inputId: input.id,
      overall: "valid",
      checks: [],
      testResults: [],
      issues: [],
      score: 100,
      timestamp: new Date(),
    };
    
    // 1. 语法检查
    const syntaxCheck = await this.checkSyntax(input);
    result.checks.push(syntaxCheck);
    
    if (syntaxCheck.status === "fail") {
      result.overall = "invalid";
      result.score = 0;
      return result;
    }
    
    // 2. 类型检查
    if (this.config.enableTypeCheck && input.language === "typescript") {
      const typeCheck = await this.checkTypes(input);
      result.checks.push(typeCheck);
      
      if (typeCheck.status === "fail") {
        result.issues.push({
          type: "type",
          severity: "error",
          message: typeCheck.message,
        });
      }
    }
    
    // 3. 静态分析
    if (this.config.enableStaticAnalysis) {
      const staticCheck = await this.runStaticAnalysis(input);
      result.checks.push(staticCheck);
      
      for (const issue of (staticCheck.details as { issues?: Issue[] })?.issues || []) {
        result.issues.push(issue);
      }
    }
    
    // 4. 安全检查
    if (this.config.enableSecurityCheck) {
      const securityCheck = await this.runSecurityCheck(input);
      result.checks.push(securityCheck);
      
      for (const issue of (securityCheck.details as { issues?: Issue[] })?.issues || []) {
        result.issues.push(issue);
      }
    }
    
    // 5. 运行测试
    if (testCases && testCases.length > 0) {
      for (const testCase of testCases) {
        const testResult = await this.runTest(input, testCase);
        result.testResults.push(testResult);
        
        if (!testResult.passed) {
          result.issues.push({
            type: "logic",
            severity: "error",
            message: `测试失败: ${testCase.name}`,
            suggestion: `期望: ${JSON.stringify(testCase.expected)}, 实际: ${JSON.stringify(testResult.actual)}`,
          });
        }
      }
    }
    
    // 6. 性能检查
    if (this.config.enablePerformanceCheck) {
      const perfCheck = await this.runPerformanceCheck(input);
      result.checks.push(perfCheck);
    }
    
    // 计算分数
    result.score = this.calculateScore(result);
    
    // 判定总体结果
    const errorCount = result.issues.filter(i => i.severity === "error").length;
    const warningCount = result.issues.filter(i => i.severity === "warning").length;
    
    if (errorCount > 0) {
      result.overall = "invalid";
    } else if (warningCount > 0) {
      result.overall = "partial";
    }
    
    return result;
  }
  
  /**
   * 批量验证
   */
  async validateBatch(inputs: Array<{ input: CodeInput; tests?: TestCase[] }>): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const { input, tests } of inputs) {
      results.push(await this.validate(input, tests));
    }
    
    return results;
  }
  
  // ============================================================
  // 检查方法
  // ============================================================
  
  private async checkSyntax(input: CodeInput): Promise<CheckResult> {
    const start = Date.now();
    const filePath = this.getTempPath(input);
    
    fs.writeFileSync(filePath, input.code);
    
    try {
      let cmd: string;
      
      switch (input.language) {
        case "typescript":
          cmd = `npx tsc --noEmit --skipLibCheck ${filePath}`;
          break;
        case "javascript":
          cmd = `node --check ${filePath}`;
          break;
        case "python":
          cmd = `python3 -m py_compile ${filePath}`;
          break;
        default:
          return {
            type: "syntax",
            status: "skip",
            message: "不支持的语言",
            duration: Date.now() - start,
          };
      }
      
      await exec(cmd, { timeout: this.config.timeout });
      
      return {
        type: "syntax",
        status: "pass",
        message: "语法正确",
        duration: Date.now() - start,
      };
    } catch (error: unknown) {
      return {
        type: "syntax",
        status: "fail",
        message: this.parseErrorMessage((error as Error).message),
        details: { raw: (error as Error).message },
        duration: Date.now() - start,
      };
    }
  }
  
  private async checkTypes(input: CodeInput): Promise<CheckResult> {
    const start = Date.now();
    
    if (input.language !== "typescript") {
      return {
        type: "type",
        status: "skip",
        message: "仅 TypeScript 支持类型检查",
        duration: Date.now() - start,
      };
    }
    
    const filePath = this.getTempPath(input);
    
    try {
      await exec(`npx tsc --noEmit --strict ${filePath}`, { timeout: this.config.timeout });
      
      return {
        type: "type",
        status: "pass",
        message: "类型检查通过",
        duration: Date.now() - start,
      };
    } catch (error: unknown) {
      return {
        type: "type",
        status: "fail",
        message: this.parseErrorMessage((error as Error).message),
        duration: Date.now() - start,
      };
    }
  }
  
  private async runStaticAnalysis(input: CodeInput): Promise<CheckResult> {
    const start = Date.now();
    const issues: Issue[] = [];
    const code = input.code;
    const lines = code.split("\n");
    
    // 未使用变量
    const unusedVarPattern = /(?:const|let|var)\s+(\w+)\s*=[^;]+;(?![\s\S]*\1)/g;
    let match;
    while ((match = unusedVarPattern.exec(code)) !== null) {
      const varName = match[1];
      // 简单检查：变量名是否在后续代码中出现
      const afterDeclaration = code.substring(match.index + match[0].length);
      if (!afterDeclaration.includes(varName)) {
        issues.push({
          type: "style",
          severity: "warning",
          message: `可能未使用的变量: ${varName}`,
          line: code.substring(0, match.index).split("\n").length,
          rule: "no-unused-vars",
        });
      }
    }
    
    // 空函数
    const emptyFuncPattern = /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/g;
    while ((match = emptyFuncPattern.exec(code)) !== null) {
      issues.push({
        type: "style",
        severity: "info",
        message: "空函数体",
        line: code.substring(0, match.index).split("\n").length,
        rule: "no-empty-function",
      });
    }
    
    // // console.log 残留
    const consolePattern = /console\.(log|debug|info)\(/g;
    while ((match = consolePattern.exec(code)) !== null) {
      issues.push({
        type: "style",
        severity: "info",
        message: "console 语句可能需要移除",
        line: code.substring(0, match.index).split("\n").length,
        rule: "no-console",
      });
    }
    
    // any 类型
    const anyPattern = /:\s*any\b/g;
    while ((match = anyPattern.exec(code)) !== null) {
      issues.push({
        type: "type",
        severity: "warning",
        message: "使用 any 类型会失去类型检查",
        line: code.substring(0, match.index).split("\n").length,
        rule: "no-explicit-any",
        suggestion: "考虑使用更具体的类型",
      });
    }
    
    return {
      type: "static",
      status: issues.filter(i => i.severity === "error").length > 0 ? "fail" : "pass",
      message: `发现 ${issues.length} 个问题`,
      details: { issues },
      duration: Date.now() - start,
    };
  }
  
  private async runSecurityCheck(input: CodeInput): Promise<CheckResult> {
    const start = Date.now();
    const issues: Issue[] = [];
    const code = input.code;
    
    // 安全模式
    const securityPatterns = [
      {
        pattern: /eval\s*\(/g,
        type: "security" as const,
        severity: "error" as Severity,
        message: "eval() 可能导致代码注入",
        rule: "no-eval",
      },
      {
        pattern: /Function\s*\(/g,
        type: "security" as const,
        severity: "error" as Severity,
        message: "动态创建函数可能导致代码注入",
        rule: "no-new-func",
      },
      {
        pattern: /innerHTML\s*=/g,
        type: "security" as const,
        severity: "warning" as Severity,
        message: "innerHTML 可能导致 XSS",
        rule: "no-innerhtml",
        suggestion: "使用 textContent 或 DOM API",
      },
      {
        pattern: /document\.write\s*\(/g,
        type: "security" as const,
        severity: "error" as Severity,
        message: "document.write 可能导致 XSS",
        rule: "no-document-write",
      },
      {
        pattern: /password\s*=\s*['"][^'"]+['"]/gi,
        type: "security" as const,
        severity: "error" as Severity,
        message: "硬编码密码",
        rule: "no-hardcoded-password",
      },
      {
        pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi,
        type: "security" as const,
        severity: "error" as Severity,
        message: "硬编码 API Key",
        rule: "no-hardcoded-api-key",
      },
      {
        pattern: /exec\s*\(\s*['"`]/g,
        type: "security" as const,
        severity: "warning" as Severity,
        message: "执行命令需要验证输入",
        rule: "no-exec",
      },
    ];
    
    for (const { pattern, type, severity, message, rule, suggestion } of securityPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        issues.push({
          type,
          severity,
          message,
          line: code.substring(0, match.index).split("\n").length,
          rule,
          suggestion,
        });
      }
    }
    
    return {
      type: "security",
      status: issues.filter(i => i.severity === "error").length > 0 ? "fail" : "pass",
      message: `发现 ${issues.length} 个安全问题`,
      details: { issues },
      duration: Date.now() - start,
    };
  }
  
  private async runPerformanceCheck(input: CodeInput): Promise<CheckResult> {
    const start = Date.now();
    const issues: Issue[] = [];
    const code = input.code;
    
    // 性能模式
    const perfPatterns = [
      {
        pattern: /while\s*\(\s*true\s*\)/g,
        message: "无限循环风险",
        severity: "warning" as Severity,
      },
      {
        pattern: /for\s*\([^)]*\)\s*\{[^}]{0,100}for\s*\([^)]*\)/g,
        message: "嵌套循环可能影响性能",
        severity: "info" as Severity,
      },
      {
        pattern: /\.forEach\s*\([^)]*\)\s*\.forEach/g,
        message: "链式 forEach 可能影响性能",
        severity: "info" as Severity,
      },
      {
        pattern: /JSON\.parse\s*\(\s*JSON\.stringify/g,
        message: "深拷贝可以使用更高效的方法",
        severity: "info" as Severity,
        suggestion: "考虑使用 structuredClone 或 lodash.cloneDeep",
      },
    ];
    
    for (const { pattern, message, severity } of perfPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        issues.push({
          type: "performance",
          severity,
          message,
          line: code.substring(0, match.index).split("\n").length,
        });
      }
    }
    
    return {
      type: "performance",
      status: "pass",
      message: `发现 ${issues.length} 个性能提示`,
      details: { issues },
      duration: Date.now() - start,
    };
  }
  
  private async runTest(input: CodeInput, testCase: TestCase): Promise<TestResult> {
    const start = Date.now();
    
    try {
      // 构建测试代码
      const testCode = this.buildTestCode(input, testCase);
      const testPath = this.getTempPath(input, "test");
      
      fs.writeFileSync(testPath, testCode);
      
      // 执行测试
      const { stdout } = await exec(
        input.language === "python" ? `python3 ${testPath}` : `node ${testPath}`,
        { timeout: testCase.timeout || 5000 }
      );
      
      const actual = JSON.parse(stdout.trim());
      const passed = JSON.stringify(actual) === JSON.stringify(testCase.expected);
      
      // 清理
      fs.unlinkSync(testPath);
      
      return {
        name: testCase.name,
        passed,
        actual,
        expected: testCase.expected,
        duration: Date.now() - start,
      };
    } catch (error: unknown) {
      return {
        name: testCase.name,
        passed: false,
        expected: testCase.expected,
        error: (error as Error).message,
        duration: Date.now() - start,
      };
    }
  }
  
  // ============================================================
  // 辅助方法
  // ============================================================
  
  private buildTestCode(input: CodeInput, testCase: TestCase): string {
    if (input.language === "python") {
      return `
${input.code}

import json
result = solution(${JSON.stringify(testCase.input)})
print(json.dumps(result))
`;
    }
    
    return `
${input.code}

const result = solution(${JSON.stringify(testCase.input)});
// console.log(JSON.stringify(result));
`;
  }
  
  private getTempPath(input: CodeInput, suffix: string = ""): string {
    const ext = input.language === "typescript" ? "ts" :
                input.language === "javascript" ? "js" : "py";
    
    return path.join(
      this.config.tempDir,
      `${input.id}${suffix ? "-" + suffix : ""}.${ext}`
    );
  }
  
  private parseErrorMessage(message: string): string {
    // 提取关键错误信息
    const lines = message.split("\n");
    const errorLine = lines.find(l => l.includes("error TS") || l.includes("SyntaxError"));
    
    return errorLine || message.substring(0, 200);
  }
  
  private calculateScore(result: ValidationResult): number {
    let score = 100;
    
    // 错误扣分
    const errors = result.issues.filter(i => i.severity === "error").length;
    const warnings = result.issues.filter(i => i.severity === "warning").length;
    const infos = result.issues.filter(i => i.severity === "info").length;
    
    score -= errors * 20;
    score -= warnings * 5;
    score -= infos * 1;
    
    // 测试失败扣分
    const failedTests = result.testResults.filter(t => !t.passed).length;
    score -= failedTests * 15;
    
    return Math.max(0, score);
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
    if (fs.existsSync(this.config.tempDir)) {
      const files = fs.readdirSync(this.config.tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.config.tempDir, file));
      }
    }
  }
  
  /**
   * 生成报告
   */
  generateReport(result: ValidationResult): string {
    const lines: string[] = [];
    
    lines.push(`# 代码验证报告`);
    lines.push(`输入 ID: ${result.inputId}`);
    lines.push(`时间: ${result.timestamp.toISOString()}`);
    lines.push(`总体: ${result.overall}`);
    lines.push(`分数: ${result.score}/100`);
    lines.push("");
    
    lines.push("## 检查结果");
    lines.push("");
    lines.push("| 类型 | 状态 | 消息 | 耗时 |");
    lines.push("|------|------|------|------|");
    
    for (const check of result.checks) {
      lines.push(`| ${check.type} | ${check.status} | ${check.message.substring(0, 50)} | ${check.duration}ms |`);
    }
    
    lines.push("");
    
    if (result.testResults.length > 0) {
      lines.push("## 测试结果");
      lines.push("");
      lines.push("| 测试 | 状态 | 耗时 |");
      lines.push("|------|------|------|");
      
      for (const test of result.testResults) {
        lines.push(`| ${test.name} | ${test.passed ? "✅" : "❌"} | ${test.duration}ms |`);
      }
      
      lines.push("");
    }
    
    if (result.issues.length > 0) {
      lines.push("## 问题列表");
      lines.push("");
      
      for (const issue of result.issues) {
        lines.push(`- **${issue.type}** (${issue.severity}): ${issue.message}`);
        if (issue.line) lines.push(`  - 行: ${issue.line}`);
        if (issue.suggestion) lines.push(`  - 建议: ${issue.suggestion}`);
      }
    }
    
    return lines.join("\n");
  }
}

// ============================================================
// 演示
// ============================================================

async function demo() {
  // console.log("=".repeat(60));
  // console.log("CodeValidator 代码正确性验证组件演示");
  // console.log("=".repeat(60));
  
  const validator = new CodeValidator({
    tempDir: "./experiment-results/temp-validator",
  });
  
  // 测试 1：正确代码
  // console.log("\n1. 验证正确代码");
  
  const validCode: CodeInput = {
    id: "valid-1",
    code: `
function solution(arr: number[]): number {
  return arr.reduce((sum, n) => sum + n, 0);
}
`,
    language: "typescript",
  };
  
  const result1 = await validator.validate(validCode, [
    { name: "正常数组", input: [1, 2, 3], expected: 6 },
    { name: "空数组", input: [], expected: 0 },
  ]);
  
  // console.log(`   总体: ${result1.overall}`);
  // console.log(`   分数: ${result1.score}`);
  // console.log(`   问题: ${result1.issues.length}`);
  
  // 测试 2：有问题的代码
  // console.log("\n2. 验证有问题的代码");
  
  const problematicCode: CodeInput = {
    id: "problematic-1",
    code: `
function solution(arr: any[]): any {
  // 使用 any 类型
  let result = eval("arr[0]");  // 使用 eval
  // console.log("debug", result);  // console 残留
  return result;
}
`,
    language: "typescript",
  };
  
  const result2 = await validator.validate(problematicCode);
  
  // console.log(`   总体: ${result2.overall}`);
  // console.log(`   分数: ${result2.score}`);
  // console.log(`   问题: ${result2.issues.length}`);
  
  for (const issue of result2.issues) {
    // console.log(`   - ${issue.type} (${issue.severity}): ${issue.message}`);
  }
  
  // 生成报告
  // console.log("\n3. 生成报告");
  
  const report = validator.generateReport(result2);
  const reportPath = "./experiment-results/code-validator-report.md";
  fs.writeFileSync(reportPath, report);
  // console.log(`   报告已保存: ${reportPath}`);
  
  // 清理
  validator.cleanup();
  
  // console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  demo();
}
