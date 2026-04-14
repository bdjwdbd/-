/**
 * 自动测试生成模块
 * 
 * 功能：
 * 1. 根据代码生成测试
 * 2. 测试用例模板
 * 3. 边界条件检测
 * 4. 测试覆盖率分析
 */

// ============================================================
// 类型定义
// ============================================================

interface FunctionInfo {
  name: string;
  params: Array<{ name: string; type: string; optional: boolean }>;
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
}

interface TestCase {
  id: string;
  functionName: string;
  description: string;
  input: any[];
  expectedOutput: any;
  type: 'normal' | 'edge' | 'error';
}

interface TestSuite {
  functionName: string;
  cases: TestCase[];
  coverage: number;
}

interface TestGeneratorConfig {
  includeEdgeCases: boolean;
  includeErrorCases: boolean;
  maxCasesPerFunction: number;
}

// ============================================================
// 代码分析器
// ============================================================

export class CodeAnalyzer {
  /**
   * 分析函数
   */
  analyzeFunction(code: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    // 简单的正则匹配
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?/g;
    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*(\w+))?\s*=>/g;

    let match;

    // 普通函数
    while ((match = functionRegex.exec(code)) !== null) {
      functions.push({
        name: match[1],
        params: this.parseParams(match[2]),
        returnType: match[3] || 'any',
        isAsync: code.substring(match.index - 10, match.index).includes('async'),
        isExported: code.substring(match.index - 10, match.index).includes('export'),
      });
    }

    // 箭头函数
    while ((match = arrowRegex.exec(code)) !== null) {
      functions.push({
        name: match[1],
        params: this.parseParams(match[2]),
        returnType: match[3] || 'any',
        isAsync: code.substring(match.index - 20, match.index).includes('async'),
        isExported: code.substring(match.index - 20, match.index).includes('export'),
      });
    }

    return functions;
  }

  /**
   * 解析参数
   */
  private parseParams(paramsStr: string): Array<{ name: string; type: string; optional: boolean }> {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(param => {
      const trimmed = param.trim();
      const optional = trimmed.includes('?');
      const [name, type] = trimmed.replace('?', '').split(':').map(s => s.trim());
      
      return {
        name: name || 'param',
        type: type || 'any',
        optional,
      };
    });
  }

  /**
   * 提取类方法
   */
  analyzeClass(code: string): Array<{ className: string; methods: FunctionInfo[] }> {
    const classes: Array<{ className: string; methods: FunctionInfo[] }> = [];

    const classRegex = /class\s+(\w+)\s*\{([^}]*)\}/g;
    let match;

    while ((match = classRegex.exec(code)) !== null) {
      const className = match[1];
      const classBody = match[2];
      
      const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?/g;
      const methods: FunctionInfo[] = [];
      
      let methodMatch;
      while ((methodMatch = methodRegex.exec(classBody)) !== null) {
        if (methodMatch[1] === 'constructor') continue;
        
        methods.push({
          name: methodMatch[1],
          params: this.parseParams(methodMatch[2]),
          returnType: methodMatch[3] || 'any',
          isAsync: classBody.substring(methodMatch.index - 10, methodMatch.index).includes('async'),
          isExported: false,
        });
      }

      classes.push({ className, methods });
    }

    return classes;
  }
}

// ============================================================
// 测试生成器
// ============================================================

export class TestGenerator {
  private analyzer: CodeAnalyzer;
  private config: TestGeneratorConfig;

  constructor(config?: Partial<TestGeneratorConfig>) {
    this.analyzer = new CodeAnalyzer();
    this.config = {
      includeEdgeCases: true,
      includeErrorCases: true,
      maxCasesPerFunction: 10,
      ...config,
    };
  }

  /**
   * 为函数生成测试
   */
  generateTestsForFunction(func: FunctionInfo): TestSuite {
    const cases: TestCase[] = [];

    // 正常用例
    cases.push(...this.generateNormalCases(func));

    // 边界用例
    if (this.config.includeEdgeCases) {
      cases.push(...this.generateEdgeCases(func));
    }

    // 错误用例
    if (this.config.includeErrorCases) {
      cases.push(...this.generateErrorCases(func));
    }

    return {
      functionName: func.name,
      cases: cases.slice(0, this.config.maxCasesPerFunction),
      coverage: this.calculateCoverage(func, cases),
    };
  }

  /**
   * 生成正常用例
   */
  private generateNormalCases(func: FunctionInfo): TestCase[] {
    const cases: TestCase[] = [];

    // 根据参数类型生成测试输入
    const input = func.params.map(p => this.generateDefaultValue(p.type));
    
    cases.push({
      id: `${func.name}-normal-1`,
      functionName: func.name,
      description: `正常调用 ${func.name}`,
      input,
      expectedOutput: this.generateDefaultValue(func.returnType),
      type: 'normal',
    });

    return cases;
  }

  /**
   * 生成边界用例
   */
  private generateEdgeCases(func: FunctionInfo): TestCase[] {
    const cases: TestCase[] = [];

    for (const param of func.params) {
      // 空值
      if (!param.optional) {
        const input = func.params.map(p => 
          p.name === param.name ? this.getEmptyValue(p.type) : this.generateDefaultValue(p.type)
        );
        
        cases.push({
          id: `${func.name}-edge-${param.name}-empty`,
          functionName: func.name,
          description: `${param.name} 为空值`,
          input,
          expectedOutput: null,
          type: 'edge',
        });
      }

      // 极值
      if (param.type === 'number') {
        const input = func.params.map(p =>
          p.name === param.name ? 0 : this.generateDefaultValue(p.type)
        );
        
        cases.push({
          id: `${func.name}-edge-${param.name}-zero`,
          functionName: func.name,
          description: `${param.name} 为 0`,
          input,
          expectedOutput: this.generateDefaultValue(func.returnType),
          type: 'edge',
        });
      }
    }

    return cases;
  }

  /**
   * 生成错误用例
   */
  private generateErrorCases(func: FunctionInfo): TestCase[] {
    const cases: TestCase[] = [];

    // 类型错误
    for (const param of func.params) {
      if (param.type !== 'any') {
        const input = func.params.map(p =>
          p.name === param.name ? this.getWrongTypeValue(p.type) : this.generateDefaultValue(p.type)
        );
        
        cases.push({
          id: `${func.name}-error-${param.name}-wrong-type`,
          functionName: func.name,
          description: `${param.name} 类型错误`,
          input,
          expectedOutput: new Error('TypeError'),
          type: 'error',
        });
      }
    }

    return cases;
  }

  /**
   * 生成默认值
   */
  private generateDefaultValue(type: string): any {
    switch (type) {
      case 'string': return 'test';
      case 'number': return 1;
      case 'boolean': return true;
      case 'object': return {};
      case 'array': return [];
      case 'any': return null;
      default: return null;
    }
  }

  /**
   * 获取空值
   */
  private getEmptyValue(type: string): any {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'object': return null;
      case 'array': return [];
      default: return null;
    }
  }

  /**
   * 获取错误类型值
   */
  private getWrongTypeValue(type: string): any {
    switch (type) {
      case 'string': return 123;
      case 'number': return 'not a number';
      case 'boolean': return 'not a boolean';
      case 'object': return 'not an object';
      case 'array': return {};
      default: return undefined;
    }
  }

  /**
   * 计算覆盖率
   */
  private calculateCoverage(func: FunctionInfo, cases: TestCase[]): number {
    const paramCount = func.params.length;
    if (paramCount === 0) return 100;

    const coveredParams = new Set<string>();
    
    for (const c of cases) {
      for (let i = 0; i < func.params.length; i++) {
        if (c.input[i] !== this.generateDefaultValue(func.params[i].type)) {
          coveredParams.add(func.params[i].name);
        }
      }
    }

    return (coveredParams.size / paramCount) * 100;
  }

  /**
   * 从代码生成测试
   */
  generateFromCode(code: string): TestSuite[] {
    const functions = this.analyzer.analyzeFunction(code);
    return functions.map(f => this.generateTestsForFunction(f));
  }
}

// ============================================================
// 测试代码生成器
// ============================================================

export class TestCodeGenerator {
  /**
   * 生成测试代码
   */
  generateTestCode(suite: TestSuite): string {
    const lines: string[] = [
      `// 自动生成的测试: ${suite.functionName}`,
      `import { ${suite.functionName} } from './module';`,
      '',
      `describe('${suite.functionName}', () => {`,
    ];

    for (const testCase of suite.cases) {
      lines.push('');
      lines.push(`  test('${testCase.description}', ${testCase.type === 'error' ? '' : 'async '}() => {`);
      
      if (testCase.type === 'error') {
        lines.push(`    expect(() => ${suite.functionName}(${this.formatInput(testCase.input)})).toThrow();`);
      } else {
        lines.push(`    const result = ${testCase.functionName}(${this.formatInput(testCase.input)});`);
        lines.push(`    expect(result).toBeDefined();`);
      }
      
      lines.push(`  });`);
    }

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 格式化输入
   */
  private formatInput(input: any[]): string {
    return input.map(i => JSON.stringify(i)).join(', ');
  }

  /**
   * 生成完整测试文件
   */
  generateTestFile(suites: TestSuite[]): string {
    const lines: string[] = [
      '/**',
      ' * 自动生成的测试文件',
      ` * 生成时间: ${new Date().toISOString()}`,
      ' */',
      '',
    ];

    for (const suite of suites) {
      lines.push(this.generateTestCode(suite));
    }

    return lines.join('\n');
  }
}

// ============================================================
// 单例
// ============================================================

let testGeneratorInstance: TestGenerator | null = null;
let testCodeGeneratorInstance: TestCodeGenerator | null = null;

export function getTestGenerator(): TestGenerator {
  if (!testGeneratorInstance) {
    testGeneratorInstance = new TestGenerator();
  }
  return testGeneratorInstance;
}

export function getTestCodeGenerator(): TestCodeGenerator {
  if (!testCodeGeneratorInstance) {
    testCodeGeneratorInstance = new TestCodeGenerator();
  }
  return testCodeGeneratorInstance;
}

// 导出 CodeAnalyzer 的便捷方法
export function analyzeCode(code: string): { functions: FunctionInfo[] } {
  const analyzer = new CodeAnalyzer();
  return { functions: analyzer.analyzeFunction(code) };
}
