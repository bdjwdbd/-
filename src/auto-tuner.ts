/**
 * 组件自动调优系统
 * 
 * 功能：
 * 1. 自动检测性能瓶颈
 * 2. 动态调整组件参数
 * 3. A/B 测试验证
 * 4. 自适应优化策略
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

interface TunableParameter {
  name: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  step: number;
  unit: string;
  description: string;
  impact: "high" | "medium" | "low";
}

interface ComponentMetrics {
  componentId: string;
  timestamp: Date;
  latency: number;
  throughput: number;
  errorRate: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    tokens?: number;
  };
  customMetrics: Record<string, number>;
}

interface OptimizationGoal {
  name: string;
  target: "minimize" | "maximize";
  weight: number;
  threshold?: number;
}

interface TuningResult {
  componentId: string;
  timestamp: Date;
  parameter: string;
  previousValue: number;
  newValue: number;
  expectedImprovement: number;
  actualImprovement?: number;
  status: "pending" | "applied" | "validated" | "rolled_back";
  validationMetrics?: ComponentMetrics;
}

interface ABTestConfig {
  testId: string;
  componentId: string;
  parameter: string;
  controlValue: number;
  treatmentValue: number;
  sampleSize: number;
  currentSamples: number;
  controlMetrics: ComponentMetrics[];
  treatmentMetrics: ComponentMetrics[];
  status: "running" | "completed" | "aborted";
  startTime: Date;
  endTime?: Date;
  result?: {
    winner: "control" | "treatment" | "none";
    confidence: number;
    improvement: number;
  };
}

interface AutoTunerConfig {
  tunerDir: string;
  minSamplesForTuning: number;
  confidenceLevel: number;
  maxConcurrentTests: number;
  autoApply: boolean;
  rollbackThreshold: number; // 性能下降超过此值回滚
}

// ============================================================
// 性能分析器
// ============================================================

class PerformanceAnalyzer {
  private metricsHistory: Map<string, ComponentMetrics[]> = new Map();
  private maxHistorySize: number = 1000;
  
  /**
   * 记录指标
   */
  recordMetrics(metrics: ComponentMetrics): void {
    const history = this.metricsHistory.get(metrics.componentId) || [];
    history.push(metrics);
    
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
    
    this.metricsHistory.set(metrics.componentId, history);
  }
  
  /**
   * 分析性能趋势
   */
  analyzeTrend(componentId: string): {
    latencyTrend: "improving" | "stable" | "degrading";
    errorTrend: "improving" | "stable" | "degrading";
    throughputTrend: "improving" | "stable" | "degrading";
    recommendation: string;
  } {
    const history = this.metricsHistory.get(componentId) || [];
    
    if (history.length < 10) {
      return {
        latencyTrend: "stable",
        errorTrend: "stable",
        throughputTrend: "stable",
        recommendation: "数据不足，继续收集",
      };
    }
    
    const recent = history.slice(-10);
    const previous = history.slice(-20, -10);
    
    const recentAvgLatency = this.average(recent.map(m => m.latency));
    const previousAvgLatency = previous.length > 0 
      ? this.average(previous.map(m => m.latency)) 
      : recentAvgLatency;
    
    const recentAvgError = this.average(recent.map(m => m.errorRate));
    const previousAvgError = previous.length > 0 
      ? this.average(previous.map(m => m.errorRate)) 
      : recentAvgError;
    
    const recentAvgThroughput = this.average(recent.map(m => m.throughput));
    const previousAvgThroughput = previous.length > 0 
      ? this.average(previous.map(m => m.throughput)) 
      : recentAvgThroughput;
    
    const latencyChange = (recentAvgLatency - previousAvgLatency) / previousAvgLatency;
    const errorChange = (recentAvgError - previousAvgError) / (previousAvgError || 0.01);
    const throughputChange = (recentAvgThroughput - previousAvgThroughput) / previousAvgThroughput;
    
    const latencyTrend = latencyChange < -0.1 ? "improving" : latencyChange > 0.1 ? "degrading" : "stable";
    const errorTrend = errorChange < -0.1 ? "improving" : errorChange > 0.1 ? "degrading" : "stable";
    const throughputTrend = throughputChange > 0.1 ? "improving" : throughputChange < -0.1 ? "degrading" : "stable";
    
    let recommendation = "";
    if (latencyTrend === "degrading") {
      recommendation += "延迟上升，考虑优化或增加资源。";
    }
    if (errorTrend === "degrading") {
      recommendation += "错误率上升，需要检查组件健康。";
    }
    if (throughputTrend === "degrading") {
      recommendation += "吞吐量下降，考虑扩容或优化。";
    }
    if (!recommendation) {
      recommendation = "性能稳定，继续监控。";
    }
    
    return { latencyTrend, errorTrend, throughputTrend, recommendation };
  }
  
  /**
   * 检测瓶颈
   */
  detectBottlenecks(componentId: string): Array<{
    type: string;
    severity: "high" | "medium" | "low";
    value: number;
    threshold: number;
    suggestion: string;
  }> {
    const history = this.metricsHistory.get(componentId) || [];
    const bottlenecks: Array<{
      type: string;
      severity: "high" | "medium" | "low";
      value: number;
      threshold: number;
      suggestion: string;
    }> = [];
    
    if (history.length === 0) return bottlenecks;
    
    const recent = history.slice(-20);
    const avgLatency = this.average(recent.map(m => m.latency));
    const avgErrorRate = this.average(recent.map(m => m.errorRate));
    const avgCpu = this.average(recent.map(m => m.resourceUsage.cpu));
    const avgMemory = this.average(recent.map(m => m.resourceUsage.memory));
    
    // 延迟瓶颈
    if (avgLatency > 1000) {
      bottlenecks.push({
        type: "latency",
        severity: avgLatency > 5000 ? "high" : "medium",
        value: avgLatency,
        threshold: 1000,
        suggestion: "考虑缓存、并行化或算法优化",
      });
    }
    
    // 错误率瓶颈
    if (avgErrorRate > 0.05) {
      bottlenecks.push({
        type: "error_rate",
        severity: avgErrorRate > 0.1 ? "high" : "medium",
        value: avgErrorRate,
        threshold: 0.05,
        suggestion: "检查错误日志，增加重试或降级策略",
      });
    }
    
    // CPU 瓶颈
    if (avgCpu > 0.8) {
      bottlenecks.push({
        type: "cpu",
        severity: avgCpu > 0.95 ? "high" : "medium",
        value: avgCpu,
        threshold: 0.8,
        suggestion: "考虑异步处理或增加计算资源",
      });
    }
    
    // 内存瓶颈
    if (avgMemory > 0.8) {
      bottlenecks.push({
        type: "memory",
        severity: avgMemory > 0.95 ? "high" : "medium",
        value: avgMemory,
        threshold: 0.8,
        suggestion: "考虑内存优化或增加内存限制",
      });
    }
    
    return bottlenecks;
  }
  
  /**
   * 获取统计摘要
   */
  getSummary(componentId: string): {
    avgLatency: number;
    p95Latency: number;
    avgThroughput: number;
    avgErrorRate: number;
    sampleCount: number;
  } {
    const history = this.metricsHistory.get(componentId) || [];
    
    if (history.length === 0) {
      return {
        avgLatency: 0,
        p95Latency: 0,
        avgThroughput: 0,
        avgErrorRate: 0,
        sampleCount: 0,
      };
    }
    
    const latencies = history.map(m => m.latency).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    
    return {
      avgLatency: this.average(latencies),
      p95Latency: latencies[p95Index] || 0,
      avgThroughput: this.average(history.map(m => m.throughput)),
      avgErrorRate: this.average(history.map(m => m.errorRate)),
      sampleCount: history.length,
    };
  }
  
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

// ============================================================
// 参数优化器
// ============================================================

class ParameterOptimizer {
  private parameters: Map<string, TunableParameter> = new Map();
  private optimizationHistory: TuningResult[] = [];
  
  /**
   * 注册可调参数
   */
  registerParameter(componentId: string, param: TunableParameter): void {
    const key = `${componentId}:${param.name}`;
    this.parameters.set(key, param);
  }
  
  /**
   * 获取参数
   */
  getParameter(componentId: string, paramName: string): TunableParameter | undefined {
    return this.parameters.get(`${componentId}:${paramName}`);
  }
  
  /**
   * 计算优化建议
   */
  calculateOptimization(
    componentId: string,
    paramName: string,
    currentMetrics: ComponentMetrics,
    goals: OptimizationGoal[]
  ): TuningResult | null {
    const param = this.getParameter(componentId, paramName);
    if (!param) return null;
    
    // 简单的梯度下降策略
    let direction = 0;
    
    for (const goal of goals) {
      if (goal.name === "latency") {
        direction += goal.target === "minimize" ? -1 : 1;
      } else if (goal.name === "throughput") {
        direction += goal.target === "maximize" ? 1 : -1;
      } else if (goal.name === "error_rate") {
        direction += goal.target === "minimize" ? -1 : 1;
      }
    }
    
    // 根据当前性能调整步长
    let step = param.step;
    if (currentMetrics.errorRate > 0.1) {
      step *= 0.5; // 高错误率时减小步长
    }
    if (currentMetrics.latency > 2000) {
      step *= 1.5; // 高延迟时增大步长
    }
    
    let newValue = param.currentValue + direction * step;
    newValue = Math.max(param.minValue, Math.min(param.maxValue, newValue));
    
    // 估算改进
    const expectedImprovement = Math.abs(newValue - param.currentValue) / param.currentValue * 10;
    
    const result: TuningResult = {
      componentId,
      timestamp: new Date(),
      parameter: paramName,
      previousValue: param.currentValue,
      newValue,
      expectedImprovement,
      status: "pending",
    };
    
    this.optimizationHistory.push(result);
    
    return result;
  }
  
  /**
   * 应用优化
   */
  applyOptimization(result: TuningResult): boolean {
    const param = this.getParameter(result.componentId, result.parameter);
    if (!param) return false;
    
    param.currentValue = result.newValue;
    result.status = "applied";
    
    return true;
  }
  
  /**
   * 验证优化效果
   */
  validateOptimization(
    result: TuningResult,
    beforeMetrics: ComponentMetrics,
    afterMetrics: ComponentMetrics
  ): boolean {
    const latencyImprovement = (beforeMetrics.latency - afterMetrics.latency) / beforeMetrics.latency;
    const errorImprovement = (beforeMetrics.errorRate - afterMetrics.errorRate) / (beforeMetrics.errorRate || 0.01);
    
    const actualImprovement = (latencyImprovement + errorImprovement) / 2;
    result.actualImprovement = actualImprovement * 100;
    result.validationMetrics = afterMetrics;
    
    if (actualImprovement > 0) {
      result.status = "validated";
      return true;
    } else {
      result.status = "rolled_back";
      return false;
    }
  }
  
  /**
   * 获取优化历史
   */
  getOptimizationHistory(componentId?: string): TuningResult[] {
    if (componentId) {
      return this.optimizationHistory.filter(r => r.componentId === componentId);
    }
    return [...this.optimizationHistory];
  }
}

// ============================================================
// A/B 测试框架
// ============================================================

class ABTestFramework {
  private activeTests: Map<string, ABTestConfig> = new Map();
  private completedTests: ABTestConfig[] = [];
  private maxCompletedTests: number = 100;
  
  /**
   * 创建 A/B 测试
   */
  createTest(config: Omit<ABTestConfig, "currentSamples" | "controlMetrics" | "treatmentMetrics" | "status" | "startTime">): string {
    const fullConfig: ABTestConfig = {
      ...config,
      currentSamples: 0,
      controlMetrics: [],
      treatmentMetrics: [],
      status: "running",
      startTime: new Date(),
    };
    
    this.activeTests.set(config.testId, fullConfig);
    
    console.log(`[ABTest] 创建测试: ${config.testId}`);
    console.log(`  参数: ${config.parameter}`);
    console.log(`  对照组: ${config.controlValue}, 实验组: ${config.treatmentValue}`);
    
    return config.testId;
  }
  
  /**
   * 记录样本
   */
  recordSample(testId: string, isTreatment: boolean, metrics: ComponentMetrics): void {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== "running") return;
    
    if (isTreatment) {
      test.treatmentMetrics.push(metrics);
    } else {
      test.controlMetrics.push(metrics);
    }
    
    test.currentSamples++;
    
    // 检查是否达到样本量
    if (test.currentSamples >= test.sampleSize * 2) {
      this.completeTest(testId);
    }
  }
  
  /**
   * 完成测试
   */
  completeTest(testId: string): ABTestConfig | null {
    const test = this.activeTests.get(testId);
    if (!test) return null;
    
    test.status = "completed";
    test.endTime = new Date();
    
    // 计算结果
    const controlAvg = this.calculateAverageMetrics(test.controlMetrics);
    const treatmentAvg = this.calculateAverageMetrics(test.treatmentMetrics);
    
    // 简单的 t 检验近似
    const latencyDiff = (controlAvg.latency - treatmentAvg.latency) / controlAvg.latency;
    const errorDiff = (controlAvg.errorRate - treatmentAvg.errorRate) / (controlAvg.errorRate || 0.01);
    
    const improvement = (latencyDiff + errorDiff) / 2;
    
    // 计算置信度（简化版）
    const controlVariance = this.calculateVariance(test.controlMetrics.map(m => m.latency));
    const treatmentVariance = this.calculateVariance(test.treatmentMetrics.map(m => m.latency));
    const pooledVariance = (controlVariance + treatmentVariance) / 2;
    const standardError = Math.sqrt(pooledVariance / test.sampleSize);
    const zScore = Math.abs(improvement) / (standardError || 0.01);
    const confidence = Math.min(99, Math.max(50, 50 + zScore * 20));
    
    let winner: "control" | "treatment" | "none";
    if (improvement > 0.05 && confidence > 80) {
      winner = "treatment";
    } else if (improvement < -0.05 && confidence > 80) {
      winner = "control";
    } else {
      winner = "none";
    }
    
    test.result = {
      winner,
      confidence,
      improvement: improvement * 100,
    };
    
    this.completedTests.push(test);
    this.activeTests.delete(testId);
    
    // 限制历史记录
    if (this.completedTests.length > this.maxCompletedTests) {
      this.completedTests.shift();
    }
    
    console.log(`[ABTest] 测试完成: ${testId}`);
    console.log(`  胜者: ${winner}`);
    console.log(`  置信度: ${confidence.toFixed(1)}%`);
    console.log(`  改进: ${(improvement * 100).toFixed(1)}%`);
    
    return test;
  }
  
  /**
   * 获取活跃测试
   */
  getActiveTests(): ABTestConfig[] {
    return Array.from(this.activeTests.values());
  }
  
  /**
   * 获取已完成测试
   */
  getCompletedTests(): ABTestConfig[] {
    return [...this.completedTests];
  }
  
  private calculateAverageMetrics(metrics: ComponentMetrics[]): {
    latency: number;
    errorRate: number;
    throughput: number;
  } {
    if (metrics.length === 0) {
      return { latency: 0, errorRate: 0, throughput: 0 };
    }
    
    return {
      latency: metrics.reduce((s, m) => s + m.latency, 0) / metrics.length,
      errorRate: metrics.reduce((s, m) => s + m.errorRate, 0) / metrics.length,
      throughput: metrics.reduce((s, m) => s + m.throughput, 0) / metrics.length,
    };
  }
  
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
  }
}

// ============================================================
// 自动调优器
// ============================================================

export class AutoTuner {
  private config: AutoTunerConfig;
  private analyzer: PerformanceAnalyzer;
  private optimizer: ParameterOptimizer;
  private abTestFramework: ABTestFramework;
  private components: Map<string, {
    name: string;
    parameters: TunableParameter[];
    goals: OptimizationGoal[];
  }> = new Map();
  
  constructor(config?: Partial<AutoTunerConfig>) {
    this.config = {
      tunerDir: "./auto-tuner",
      minSamplesForTuning: 100,
      confidenceLevel: 0.95,
      maxConcurrentTests: 3,
      autoApply: false,
      rollbackThreshold: -0.1,
      ...config,
    };
    
    this.analyzer = new PerformanceAnalyzer();
    this.optimizer = new ParameterOptimizer();
    this.abTestFramework = new ABTestFramework();
    
    this.ensureDir(this.config.tunerDir);
  }
  
  /**
   * 注册组件
   */
  registerComponent(
    componentId: string,
    name: string,
    parameters: TunableParameter[],
    goals: OptimizationGoal[]
  ): void {
    this.components.set(componentId, { name, parameters, goals });
    
    for (const param of parameters) {
      this.optimizer.registerParameter(componentId, param);
    }
    
    console.log(`[AutoTuner] 注册组件: ${name} (${componentId})`);
  }
  
  /**
   * 记录指标
   */
  recordMetrics(metrics: ComponentMetrics): void {
    this.analyzer.recordMetrics(metrics);
  }
  
  /**
   * 运行自动调优
   */
  runTuning(componentId: string): TuningResult[] {
    const component = this.components.get(componentId);
    if (!component) return [];
    
    const results: TuningResult[] = [];
    const summary = this.analyzer.getSummary(componentId);
    
    if (summary.sampleCount < this.config.minSamplesForTuning) {
      console.log(`[AutoTuner] 样本不足 (${summary.sampleCount}/${this.config.minSamplesForTuning})`);
      return results;
    }
    
    // 检测瓶颈
    const bottlenecks = this.analyzer.detectBottlenecks(componentId);
    
    if (bottlenecks.length > 0) {
      console.log(`[AutoTuner] 检测到瓶颈:`);
      bottlenecks.forEach(b => {
        console.log(`  - ${b.type}: ${b.value.toFixed(2)} (阈值: ${b.threshold})`);
      });
    }
    
    // 为每个参数计算优化建议
    const currentMetrics: ComponentMetrics = {
      componentId,
      timestamp: new Date(),
      latency: summary.avgLatency,
      throughput: summary.avgThroughput,
      errorRate: summary.avgErrorRate,
      resourceUsage: { cpu: 0, memory: 0 },
      customMetrics: {},
    };
    
    for (const param of component.parameters) {
      const result = this.optimizer.calculateOptimization(
        componentId,
        param.name,
        currentMetrics,
        component.goals
      );
      
      if (result && result.newValue !== result.previousValue) {
        results.push(result);
        
        if (this.config.autoApply) {
          this.optimizer.applyOptimization(result);
        }
      }
    }
    
    return results;
  }
  
  /**
   * 创建 A/B 测试
   */
  createABTest(
    componentId: string,
    parameterName: string,
    treatmentValue: number,
    sampleSize: number = 100
  ): string | null {
    const param = this.optimizer.getParameter(componentId, parameterName);
    if (!param) return null;
    
    // 检查并发测试数
    if (this.abTestFramework.getActiveTests().length >= this.config.maxConcurrentTests) {
      console.log(`[AutoTuner] 已达到最大并发测试数 (${this.config.maxConcurrentTests})`);
      return null;
    }
    
    const testId = `test-${componentId}-${parameterName}-${Date.now()}`;
    
    return this.abTestFramework.createTest({
      testId,
      componentId,
      parameter: parameterName,
      controlValue: param.currentValue,
      treatmentValue,
      sampleSize,
    });
  }
  
  /**
   * 记录 A/B 测试样本
   */
  recordABTestSample(testId: string, isTreatment: boolean, metrics: ComponentMetrics): void {
    this.abTestFramework.recordSample(testId, isTreatment, metrics);
  }
  
  /**
   * 获取性能报告
   */
  getPerformanceReport(componentId: string): string {
    const component = this.components.get(componentId);
    if (!component) return "组件未注册";
    
    const summary = this.analyzer.getSummary(componentId);
    const trend = this.analyzer.analyzeTrend(componentId);
    const bottlenecks = this.analyzer.detectBottlenecks(componentId);
    const optimizationHistory = this.optimizer.getOptimizationHistory(componentId);
    
    const lines: string[] = [];
    
    lines.push(`# ${component.name} 性能报告`);
    lines.push(`生成时间: ${new Date().toISOString()}`);
    lines.push("");
    
    lines.push("## 性能摘要");
    lines.push("");
    lines.push(`- 平均延迟: ${summary.avgLatency.toFixed(2)}ms`);
    lines.push(`- P95 延迟: ${summary.p95Latency.toFixed(2)}ms`);
    lines.push(`- 平均吞吐量: ${summary.avgThroughput.toFixed(2)}/s`);
    lines.push(`- 平均错误率: ${(summary.avgErrorRate * 100).toFixed(2)}%`);
    lines.push(`- 样本数: ${summary.sampleCount}`);
    lines.push("");
    
    lines.push("## 性能趋势");
    lines.push("");
    lines.push(`- 延迟: ${trend.latencyTrend}`);
    lines.push(`- 错误率: ${trend.errorTrend}`);
    lines.push(`- 吞吐量: ${trend.throughputTrend}`);
    lines.push(`- 建议: ${trend.recommendation}`);
    lines.push("");
    
    if (bottlenecks.length > 0) {
      lines.push("## 性能瓶颈");
      lines.push("");
      for (const b of bottlenecks) {
        lines.push(`- **${b.type}** (${b.severity}): ${b.value.toFixed(2)} > ${b.threshold}`);
        lines.push(`  - 建议: ${b.suggestion}`);
      }
      lines.push("");
    }
    
    if (optimizationHistory.length > 0) {
      lines.push("## 优化历史");
      lines.push("");
      for (const h of optimizationHistory.slice(-5)) {
        lines.push(`- ${h.timestamp.toISOString()}: ${h.parameter} ${h.previousValue.toFixed(2)} → ${h.newValue.toFixed(2)}`);
        lines.push(`  - 预期改进: ${h.expectedImprovement.toFixed(1)}%`);
        if (h.actualImprovement !== undefined) {
          lines.push(`  - 实际改进: ${h.actualImprovement.toFixed(1)}%`);
        }
      }
    }
    
    return lines.join("\n");
  }
  
  /**
   * 获取所有组件状态
   */
  getAllComponentsStatus(): Array<{
    componentId: string;
    name: string;
    sampleCount: number;
    avgLatency: number;
    avgErrorRate: number;
  }> {
    const status: Array<{
      componentId: string;
      name: string;
      sampleCount: number;
      avgLatency: number;
      avgErrorRate: number;
    }> = [];
    
    for (const [componentId, component] of this.components) {
      const summary = this.analyzer.getSummary(componentId);
      status.push({
        componentId,
        name: component.name,
        sampleCount: summary.sampleCount,
        avgLatency: summary.avgLatency,
        avgErrorRate: summary.avgErrorRate,
      });
    }
    
    return status;
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ============================================================
// 演示
// ============================================================

function demo() {
  console.log("=".repeat(60));
  console.log("组件自动调优系统演示");
  console.log("=".repeat(60));
  
  const tuner = new AutoTuner({
    tunerDir: "./experiment-results/auto-tuner",
    autoApply: false,
    minSamplesForTuning: 50,
  });
  
  // 注册组件
  console.log("\n1. 注册组件");
  
  tuner.registerComponent(
    "cache-system",
    "缓存系统",
    [
      {
        name: "maxSize",
        currentValue: 1000,
        minValue: 100,
        maxValue: 10000,
        step: 500,
        unit: "条目",
        description: "最大缓存条目数",
        impact: "high",
      },
      {
        name: "ttl",
        currentValue: 3600,
        minValue: 300,
        maxValue: 86400,
        step: 600,
        unit: "秒",
        description: "缓存过期时间",
        impact: "medium",
      },
    ],
    [
      { name: "latency", target: "minimize", weight: 0.5 },
      { name: "error_rate", target: "minimize", weight: 0.3 },
      { name: "throughput", target: "maximize", weight: 0.2 },
    ]
  );
  
  // 模拟记录指标
  console.log("\n2. 记录性能指标");
  
  for (let i = 0; i < 100; i++) {
    tuner.recordMetrics({
      componentId: "cache-system",
      timestamp: new Date(),
      latency: 50 + Math.random() * 100,
      throughput: 100 + Math.random() * 50,
      errorRate: Math.random() * 0.05,
      resourceUsage: {
        cpu: 0.3 + Math.random() * 0.3,
        memory: 0.4 + Math.random() * 0.2,
      },
      customMetrics: {},
    });
  }
  
  console.log("   已记录 100 个样本");
  
  // 运行自动调优
  console.log("\n3. 运行自动调优");
  
  const results = tuner.runTuning("cache-system");
  
  if (results.length === 0) {
    console.log("   无优化建议");
  } else {
    for (const r of results) {
      console.log(`   - ${r.parameter}: ${r.previousValue.toFixed(0)} → ${r.newValue.toFixed(0)}`);
      console.log(`     预期改进: ${r.expectedImprovement.toFixed(1)}%`);
    }
  }
  
  // 创建 A/B 测试
  console.log("\n4. 创建 A/B 测试");
  
  const testId = tuner.createABTest("cache-system", "maxSize", 2000, 50);
  
  if (testId) {
    console.log(`   测试 ID: ${testId}`);
    
    // 模拟 A/B 测试样本
    console.log("   记录测试样本...");
    
    for (let i = 0; i < 100; i++) {
      const isTreatment = i % 2 === 0;
      tuner.recordABTestSample(testId, isTreatment, {
        componentId: "cache-system",
        timestamp: new Date(),
        latency: isTreatment ? 40 + Math.random() * 60 : 50 + Math.random() * 100,
        throughput: isTreatment ? 120 + Math.random() * 40 : 100 + Math.random() * 50,
        errorRate: Math.random() * 0.03,
        resourceUsage: { cpu: 0.3, memory: 0.4 },
        customMetrics: {},
      });
    }
  }
  
  // 生成性能报告
  console.log("\n5. 性能报告");
  
  const report = tuner.getPerformanceReport("cache-system");
  console.log(report);
  
  // 组件状态
  console.log("\n6. 所有组件状态");
  
  const allStatus = tuner.getAllComponentsStatus();
  for (const s of allStatus) {
    console.log(`   - ${s.name}: 延迟 ${s.avgLatency.toFixed(0)}ms, 错误率 ${(s.avgErrorRate * 100).toFixed(1)}%`);
  }
  
  console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  demo();
}
