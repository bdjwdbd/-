/**
 * 组件自动调优
 * 
 * 功能：
 * 1. 收集运行时指标
 * 2. A/B 测试验证
 * 3. 自动选择最优参数
 */

import { StructuredLogger, PerformanceMonitor } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface TunableParameter {
  name: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  step: number;
  description: string;
}

export interface TuningExperiment {
  id: string;
  parameterName: string;
  testValue: number;
  controlValue: number;
  startTime: number;
  endTime?: number;
  results: {
    testScore: number;
    controlScore: number;
    improvement: number;
  } | null;
  status: 'running' | 'completed' | 'failed';
}

export interface TuningResult {
  parameterName: string;
  optimalValue: number;
  previousValue: number;
  improvement: number;
  confidence: number;
}

export interface TuningReport {
  generatedAt: number;
  experiments: TuningExperiment[];
  results: TuningResult[];
  recommendations: string[];
}

// ============ 组件自动调优器 ============

export class AutoTuner {
  private logger: StructuredLogger;
  private performanceMonitor: PerformanceMonitor;
  private reportDir: string;
  
  // 可调参数
  private parameters: Map<string, TunableParameter> = new Map();
  
  // 实验记录
  private experiments: TuningExperiment[] = [];
  
  // 历史数据
  private history: Map<string, { value: number; score: number }[]> = new Map();
  
  // 调优配置
  private static MIN_SAMPLES = 10;        // 最少样本数
  private static IMPROVEMENT_THRESHOLD = 0.05; // 5% 改进阈值
  private static CONFIDENCE_THRESHOLD = 0.8;   // 80% 置信度阈值
  
  constructor(
    logger: StructuredLogger,
    performanceMonitor: PerformanceMonitor,
    reportDir: string = './reports/tuning'
  ) {
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.reportDir = reportDir;
    this.ensureDir(reportDir);
    
    // 初始化可调参数
    this.initializeParameters();
  }
  
  /**
   * 初始化可调参数
   */
  private initializeParameters(): void {
    const defaultParams = [
      {
        name: 'contextResetThreshold',
        currentValue: 0.55,
        minValue: 0.3,
        maxValue: 0.9,
        step: 0.05,
        description: '上下文重置阈值',
      },
      {
        name: 'cacheTTL',
        currentValue: 60000,
        minValue: 10000,
        maxValue: 300000,
        step: 10000,
        description: '缓存过期时间 (ms)',
      },
      {
        name: 'maxRetries',
        currentValue: 2,
        minValue: 0,
        maxValue: 5,
        step: 1,
        description: '最大重试次数',
      },
      {
        name: 'validationThreshold',
        currentValue: 0.6,
        minValue: 0.3,
        maxValue: 0.9,
        step: 0.1,
        description: '验证通过阈值',
      },
    ];
    
    for (const param of defaultParams) {
      this.parameters.set(param.name, param);
      this.history.set(param.name, []);
    }
  }
  
  /**
   * 收集运行数据
   */
  collectData(): void {
    const metrics = this.performanceMonitor.getSystemMetrics();
    
    // 记录当前参数下的性能
    for (const [name, param] of this.parameters) {
      const historyData = this.history.get(name) || [];
      historyData.push({
        value: param.currentValue,
        score: metrics.health,
      });
      
      // 限制历史记录
      if (historyData.length > 100) {
        historyData.shift();
      }
      
      this.history.set(name, historyData);
    }
  }
  
  /**
   * 运行调优实验
   */
  async runExperiment(parameterName: string): Promise<TuningExperiment> {
    const param = this.parameters.get(parameterName);
    if (!param) {
      throw new Error(`参数不存在: ${parameterName}`);
    }
    
    // 计算测试值（向最优方向移动）
    const testValue = this.calculateTestValue(parameterName);
    
    const experiment: TuningExperiment = {
      id: `exp-${Date.now()}`,
      parameterName,
      testValue,
      controlValue: param.currentValue,
      startTime: Date.now(),
      results: null,
      status: 'running',
    };
    
    this.experiments.push(experiment);
    
    this.logger.info('AutoTuner', 
      `开始实验: ${parameterName} (测试值: ${testValue}, 对照值: ${param.currentValue})`
    );
    
    return experiment;
  }
  
  /**
   * 计算测试值
   */
  private calculateTestValue(parameterName: string): number {
    const param = this.parameters.get(parameterName)!;
    const history = this.history.get(parameterName) || [];
    
    if (history.length < AutoTuner.MIN_SAMPLES) {
      // 数据不足，随机探索
      const direction = Math.random() > 0.5 ? 1 : -1;
      return Math.max(
        param.minValue,
        Math.min(param.maxValue, param.currentValue + direction * param.step)
      );
    }
    
    // 分析历史趋势
    const recentHistory = history.slice(-20);
    const avgScore = recentHistory.reduce((sum, h) => sum + h.score, 0) / recentHistory.length;
    
    // 找到最佳历史值
    const bestRecord = recentHistory.reduce((best, h) => 
      h.score > best.score ? h : best
    );
    
    // 向最佳值方向移动
    const direction = bestRecord.value > param.currentValue ? 1 : -1;
    return Math.max(
      param.minValue,
      Math.min(param.maxValue, param.currentValue + direction * param.step)
    );
  }
  
  /**
   * 完成实验
   */
  completeExperiment(
    experimentId: string,
    testScore: number,
    controlScore: number
  ): TuningResult | null {
    const experiment = this.experiments.find(e => e.id === experimentId);
    if (!experiment) return null;
    
    experiment.endTime = Date.now();
    experiment.results = {
      testScore,
      controlScore,
      improvement: (testScore - controlScore) / controlScore,
    };
    experiment.status = 'completed';
    
    const param = this.parameters.get(experiment.parameterName);
    if (!param) return null;
    
    // 判断是否采用新值
    const improvement = experiment.results.improvement;
    const shouldAdopt = improvement > AutoTuner.IMPROVEMENT_THRESHOLD;
    
    const result: TuningResult = {
      parameterName: experiment.parameterName,
      optimalValue: shouldAdopt ? experiment.testValue : param.currentValue,
      previousValue: param.currentValue,
      improvement,
      confidence: this.calculateConfidence(experiment.parameterName),
    };
    
    // 更新参数值
    if (shouldAdopt) {
      param.currentValue = experiment.testValue;
      this.logger.info('AutoTuner', 
        `参数已更新: ${experiment.parameterName} = ${experiment.testValue} (改进: ${(improvement * 100).toFixed(1)}%)`
      );
    }
    
    return result;
  }
  
  /**
   * 计算置信度
   */
  private calculateConfidence(parameterName: string): number {
    const history = this.history.get(parameterName) || [];
    if (history.length < AutoTuner.MIN_SAMPLES) {
      return 0.5;
    }
    
    // 基于历史数据的一致性计算置信度
    const recentHistory = history.slice(-20);
    const scores = recentHistory.map(h => h.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // 计算标准差
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // 标准差越小，置信度越高
    return Math.max(0, Math.min(1, 1 - stdDev * 2));
  }
  
  /**
   * 获取最优参数
   */
  getOptimalParameters(): Map<string, number> {
    const optimal = new Map<string, number>();
    
    for (const [name, param] of this.parameters) {
      optimal.set(name, param.currentValue);
    }
    
    return optimal;
  }
  
  /**
   * 手动设置参数
   */
  setParameter(name: string, value: number): void {
    const param = this.parameters.get(name);
    if (param) {
      param.currentValue = Math.max(param.minValue, Math.min(param.maxValue, value));
      this.logger.info('AutoTuner', `手动设置参数: ${name} = ${param.currentValue}`);
    }
  }
  
  /**
   * 生成调优报告
   */
  generateReport(): TuningReport {
    const results: TuningResult[] = [];
    const recommendations: string[] = [];
    
    // 分析每个参数
    for (const [name, param] of this.parameters) {
      const history = this.history.get(name) || [];
      
      if (history.length >= AutoTuner.MIN_SAMPLES) {
        const recentHistory = history.slice(-20);
        const bestRecord = recentHistory.reduce((best, h) => 
          h.score > best.score ? h : best
        );
        
        results.push({
          parameterName: name,
          optimalValue: bestRecord.value,
          previousValue: param.currentValue,
          improvement: (bestRecord.score - recentHistory[0].score) / recentHistory[0].score,
          confidence: this.calculateConfidence(name),
        });
        
        // 生成建议
        if (Math.abs(bestRecord.value - param.currentValue) > param.step) {
          recommendations.push(
            `${name}: 建议从 ${param.currentValue} 调整为 ${bestRecord.value}`
          );
        }
      }
    }
    
    const report: TuningReport = {
      generatedAt: Date.now(),
      experiments: this.experiments.slice(-10),
      results,
      recommendations,
    };
    
    // 保存报告
    this.saveReport(report);
    
    return report;
  }
  
  /**
   * 保存报告
   */
  private saveReport(report: TuningReport): void {
    const filename = `tuning-report-${Date.now()}.json`;
    const filePath = path.join(this.reportDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    
    this.logger.info('AutoTuner', `报告已保存: ${filePath}`);
  }
  
  /**
   * 获取所有可调参数
   */
  getParameters(): TunableParameter[] {
    return Array.from(this.parameters.values());
  }
  
  /**
   * 添加自定义参数
   */
  addParameter(param: TunableParameter): void {
    this.parameters.set(param.name, param);
    this.history.set(param.name, []);
    this.logger.info('AutoTuner', `添加参数: ${param.name}`);
  }
  
  // ============ 辅助方法 ============
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
