/**
 * 性能基准测试框架
 * 
 * 功能：
 * 1. 组件性能测试
 * 2. 内存使用监控
 * 3. 吞吐量测试
 * 4. 延迟测试
 * 5. 对比基准
 * 6. 报告生成
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

type BenchmarkStatus = "pass" | "fail" | "warning";

interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  timeout: number;
  memoryLimit: number; // MB
  baselineFile?: string;
}

interface BenchmarkResult {
  name: string;
  status: BenchmarkStatus;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  opsPerSecond: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  baseline?: {
    avgTime: number;
    diff: number;
    diffPercent: number;
  };
  error?: string;
}

interface BenchmarkSuite {
  name: string;
  description: string;
  results: BenchmarkResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    avgTime: number;
    totalTime: number;
  };
  timestamp: Date;
}

interface BenchmarkRunner {
  name: string;
  description: string;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  run: () => Promise<void>;
}

// ============================================================
// PerformanceBenchmark 类
// ============================================================

export class PerformanceBenchmark {
  private config: BenchmarkConfig;
  private runners: Map<string, BenchmarkRunner> = new Map();
  private baselines: Map<string, { avgTime: number }> = new Map();
  
  constructor(config?: Partial<BenchmarkConfig>) {
    this.config = {
      iterations: 100,
      warmupIterations: 10,
      timeout: 60000,
      memoryLimit: 512,
      ...config,
    };
    
    if (this.config.baselineFile) {
      this.loadBaselines(this.config.baselineFile);
    }
  }
  
  // ============================================================
  // 注册测试
  // ============================================================
  
  register(runner: BenchmarkRunner): void {
    this.runners.set(runner.name, runner);
  }
  
  registerBatch(runners: BenchmarkRunner[]): void {
    for (const runner of runners) {
      this.register(runner);
    }
  }
  
  // ============================================================
  // 运行测试
  // ============================================================
  
  async run(name?: string): Promise<BenchmarkSuite> {
    const suite: BenchmarkSuite = {
      name: name || "Performance Benchmark",
      description: "元灵系统性能基准测试",
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        avgTime: 0,
        totalTime: 0,
      },
      timestamp: new Date(),
    };
    
    const runnersToRun = name 
      ? [this.runners.get(name)].filter(Boolean) as BenchmarkRunner[]
      : Array.from(this.runners.values());
    
    for (const runner of runnersToRun) {
      const result = await this.runBenchmark(runner);
      suite.results.push(result);
      
      // 更新统计
      suite.summary.total++;
      if (result.status === "pass") suite.summary.passed++;
      else if (result.status === "fail") suite.summary.failed++;
      else suite.summary.warnings++;
      
      suite.summary.totalTime += result.totalTime;
    }
    
    suite.summary.avgTime = suite.summary.total > 0 
      ? suite.summary.totalTime / suite.summary.total 
      : 0;
    
    return suite;
  }
  
  private async runBenchmark(runner: BenchmarkRunner): Promise<BenchmarkResult> {
    const result: BenchmarkResult = {
      name: runner.name,
      status: "pass",
      iterations: this.config.iterations,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      opsPerSecond: 0,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
      },
    };
    
    try {
      // Setup
      if (runner.setup) {
        await runner.setup();
      }
      
      // Warmup
      for (let i = 0; i < this.config.warmupIterations; i++) {
        await runner.run();
      }
      
      // 正式测试
      const times: number[] = [];
      const startMemory = process.memoryUsage();
      
      for (let i = 0; i < this.config.iterations; i++) {
        const start = process.hrtime.bigint();
        await runner.run();
        const end = process.hrtime.bigint();
        
        const timeNs = Number(end - start);
        const timeMs = timeNs / 1_000_000;
        
        times.push(timeMs);
        result.totalTime += timeMs;
        result.minTime = Math.min(result.minTime, timeMs);
        result.maxTime = Math.max(result.maxTime, timeMs);
      }
      
      const endMemory = process.memoryUsage();
      
      // 计算统计值
      times.sort((a, b) => a - b);
      
      result.avgTime = result.totalTime / this.config.iterations;
      result.p50 = times[Math.floor(times.length * 0.5)];
      result.p95 = times[Math.floor(times.length * 0.95)];
      result.p99 = times[Math.floor(times.length * 0.99)];
      result.opsPerSecond = 1000 / result.avgTime;
      
      result.memoryUsage = {
        heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
        heapTotal: endMemory.heapTotal / 1024 / 1024,
        external: endMemory.external / 1024 / 1024,
        rss: endMemory.rss / 1024 / 1024,
      };
      
      // 对比基线
      const baseline = this.baselines.get(runner.name);
      if (baseline) {
        result.baseline = {
          avgTime: baseline.avgTime,
          diff: result.avgTime - baseline.avgTime,
          diffPercent: ((result.avgTime - baseline.avgTime) / baseline.avgTime) * 100,
        };
        
        // 性能退化检测
        if (result.baseline.diffPercent > 20) {
          result.status = "warning";
        } else if (result.baseline.diffPercent > 50) {
          result.status = "fail";
        }
      }
      
      // 内存限制检测
      if (result.memoryUsage.heapUsed > this.config.memoryLimit) {
        result.status = "warning";
      }
      
      // Teardown
      if (runner.teardown) {
        await runner.teardown();
      }
      
    } catch (error: any) {
      result.status = "fail";
      result.error = error.message;
    }
    
    return result;
  }
  
  // ============================================================
  // 基线管理
  // ============================================================
  
  saveBaselines(filePath: string): void {
    const baselines: Record<string, { avgTime: number }> = {};
    
    // 从最近一次运行结果中提取基线
    // 实际使用时应该传入结果
    fs.writeFileSync(filePath, JSON.stringify(baselines, null, 2));
  }
  
  loadBaselines(filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      
      for (const [name, value] of Object.entries(data)) {
        this.baselines.set(name, value as { avgTime: number });
      }
    } catch (e) {
      // 忽略加载错误
    }
  }
  
  setBaseline(name: string, avgTime: number): void {
    this.baselines.set(name, { avgTime });
  }
  
  // ============================================================
  // 报告生成
  // ============================================================
  
  generateReport(suite: BenchmarkSuite): string {
    const lines: string[] = [];
    
    lines.push(`# ${suite.name}`);
    lines.push("");
    lines.push(`> ${suite.description}`);
    lines.push("");
    lines.push(`**时间**: ${suite.timestamp.toISOString()}`);
    lines.push("");
    
    // 摘要
    lines.push("## 摘要");
    lines.push("");
    lines.push("| 指标 | 值 |");
    lines.push("|------|------|");
    lines.push(`| 总测试数 | ${suite.summary.total} |`);
    lines.push(`| 通过 | ${suite.summary.passed} |`);
    lines.push(`| 失败 | ${suite.summary.failed} |`);
    lines.push(`| 警告 | ${suite.summary.warnings} |`);
    lines.push(`| 平均耗时 | ${suite.summary.avgTime.toFixed(2)} ms |`);
    lines.push(`| 总耗时 | ${suite.summary.totalTime.toFixed(2)} ms |`);
    lines.push("");
    
    // 详细结果
    lines.push("## 详细结果");
    lines.push("");
    lines.push("| 测试名称 | 状态 | 平均耗时 | P95 | P99 | OPS | 内存 |");
    lines.push("|----------|------|----------|-----|-----|-----|------|");
    
    for (const result of suite.results) {
      const statusEmoji = result.status === "pass" ? "✅" : 
                          result.status === "fail" ? "❌" : "⚠️";
      
      lines.push(
        `| ${result.name} | ${statusEmoji} | ` +
        `${result.avgTime.toFixed(2)} ms | ` +
        `${result.p95.toFixed(2)} ms | ` +
        `${result.p99.toFixed(2)} ms | ` +
        `${result.opsPerSecond.toFixed(0)} | ` +
        `${result.memoryUsage.heapUsed.toFixed(1)} MB |`
      );
    }
    lines.push("");
    
    // 性能对比
    const withBaseline = suite.results.filter(r => r.baseline);
    if (withBaseline.length > 0) {
      lines.push("## 性能对比");
      lines.push("");
      lines.push("| 测试名称 | 基线 | 当前 | 变化 |");
      lines.push("|----------|------|------|------|");
      
      for (const result of withBaseline) {
        const diff = result.baseline!.diffPercent;
        const diffStr = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
        const diffEmoji = diff > 20 ? "🔴" : diff < -10 ? "🟢" : "⚪";
        
        lines.push(
          `| ${result.name} | ` +
          `${result.baseline!.avgTime.toFixed(2)} ms | ` +
          `${result.avgTime.toFixed(2)} ms | ` +
          `${diffEmoji} ${diffStr} |`
        );
      }
      lines.push("");
    }
    
    // 错误信息
    const withErrors = suite.results.filter(r => r.error);
    if (withErrors.length > 0) {
      lines.push("## 错误信息");
      lines.push("");
      
      for (const result of withErrors) {
        lines.push(`### ${result.name}`);
        lines.push("```");
        lines.push(result.error || "Unknown error");
        lines.push("```");
        lines.push("");
      }
    }
    
    return lines.join("\n");
  }
  
  generateJsonReport(suite: BenchmarkSuite): string {
    return JSON.stringify(suite, null, 2);
  }
}

// ============================================================
// 预定义测试
// ============================================================

export const defaultBenchmarks: BenchmarkRunner[] = [
  {
    name: "TokenEstimator.estimate",
    description: "Token 估算性能",
    run: async () => {
      const { TokenEstimator } = await import("./core/infrastructure");
      const estimator = new TokenEstimator();
      const text = "这是一段测试文本，用于测试 Token 估算器的性能。".repeat(100);
      estimator.estimate(text);
    },
  },
  {
    name: "CacheSystem.set/get",
    description: "缓存读写性能",
    run: async () => {
      const { CacheSystem } = await import("./core/infrastructure");
      const cache = new CacheSystem();
      const key = cache.generateKey("test-key") || "default-key";
      cache.set(key, { data: "test-value" });
      cache.get(key);
    },
  },
  {
    name: "DecisionCenter.decide",
    description: "决策中心性能",
    run: async () => {
      const { DecisionCenter } = await import("./core/decision");
      const dc = new DecisionCenter();
      await dc.decide("plan", "测试任务");
    },
  },
  {
    name: "MemoryCenter.remember",
    description: "记忆存储性能",
    run: async () => {
      const { MemoryCenter } = await import("./core/decision");
      const mc = new MemoryCenter();
      mc.remember("测试记忆内容", "short_term", 0.5);
    },
  },
  {
    name: "MemoryCenter.recall",
    description: "记忆检索性能",
    run: async () => {
      const { MemoryCenter } = await import("./core/decision");
      const mc = new MemoryCenter();
      mc.remember("测试记忆", "short_term", 0.5);
      mc.recall("测试");
    },
  },
  {
    name: "ContentUnderstanding.analyze",
    description: "内容分析性能",
    run: async () => {
      const { ContentUnderstanding } = await import("./core/perception");
      const cu = new ContentUnderstanding();
      cu.analyze("这是一段需要分析的测试文本内容。");
    },
  },
  {
    name: "SecurityAssessment.assess",
    description: "安全评估性能",
    run: async () => {
      const { SecurityAssessment } = await import("./core/decision");
      const sa = new SecurityAssessment();
      sa.assess("rm -rf / ; echo done");
    },
  },
  {
    name: "OneWayValve.check",
    description: "单向阀门性能",
    run: async () => {
      const { OneWayValve } = await import("./core/execution");
      const valve = new OneWayValve();
      valve.initFromJSON('{"item1": "desc1", "item2": "desc2"}');
      valve.markComplete("item1");
      valve.allComplete();
    },
  },
];

// ============================================================
// 导出
// ============================================================

export type {
  BenchmarkStatus,
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkSuite,
  BenchmarkRunner,
};
