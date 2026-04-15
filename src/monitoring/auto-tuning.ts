/**
 * 自动调参系统模块
 * 
 * 功能：
 * 1. 超参数优化
 * 2. 贝叶斯优化
 * 3. 网格搜索
 * 4. 早停机制
 */

// ============================================================
// 类型定义
// ============================================================

interface HyperParameter {
  name: string;
  type: 'float' | 'int' | 'categorical';
  min?: number;
  max?: number;
  choices?: string[];
  logScale?: boolean;
}

interface Trial {
  id: string;
  params: Record<string, unknown>;
  score: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number | null;
  endTime: number | null;
  metrics: Record<string, number>;
}

interface OptimizationConfig {
  direction: 'maximize' | 'minimize';
  maxTrials: number;
  timeout: number;
  earlyStoppingRounds: number;
  optimizationMethod: 'bayesian' | 'grid' | 'random';
}

interface OptimizationResult {
  bestParams: Record<string, unknown>;
  bestScore: number;
  totalTrials: number;
  duration: number;
  trials: Trial[];
}

// ============================================================
// 超参数优化器
// ============================================================

export class HyperparameterOptimizer {
  private parameters: Map<string, HyperParameter> = new Map();
  private trials: Map<string, Trial> = new Map();
  private config: OptimizationConfig;
  private bestTrial: Trial | null = null;

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      direction: 'maximize',
      maxTrials: 100,
      timeout: 3600000, // 1 小时
      earlyStoppingRounds: 10,
      optimizationMethod: 'bayesian',
      ...config,
    };
  }

  /**
   * 注册超参数
   */
  registerParameter(param: HyperParameter): void {
    this.parameters.set(param.name, param);
  }

  /**
   * 批量注册
   */
  registerParameters(params: HyperParameter[]): void {
    for (const param of params) {
      this.registerParameter(param);
    }
  }

  /**
   * 生成参数组合
   */
  generateParams(method: 'random' | 'grid' | 'bayesian' = 'random'): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    for (const [name, param] of this.parameters) {
      switch (param.type) {
        case 'float':
          params[name] = this.generateFloat(param);
          break;
        case 'int':
          params[name] = this.generateInt(param);
          break;
        case 'categorical':
          params[name] = this.generateCategorical(param);
          break;
      }
    }

    return params;
  }

  /**
   * 生成浮点数
   */
  private generateFloat(param: HyperParameter): number {
    const min = param.min || 0;
    const max = param.max || 1;
    
    if (param.logScale) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      return Math.exp(logMin + Math.random() * (logMax - logMin));
    }
    
    return min + Math.random() * (max - min);
  }

  /**
   * 生成整数
   */
  private generateInt(param: HyperParameter): number {
    const min = Math.floor(param.min || 0);
    const max = Math.floor(param.max || 10);
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  /**
   * 生成分类值
   */
  private generateCategorical(param: HyperParameter): string {
    const choices = param.choices || [];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  /**
   * 创建试验
   */
  createTrial(params?: Record<string, unknown>): Trial {
    const id = `trial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const trial: Trial = {
      id,
      params: params || this.generateParams(this.config.optimizationMethod as any),
      score: null,
      status: 'pending',
      startTime: null,
      endTime: null,
      metrics: {},
    };

    this.trials.set(id, trial);
    return trial;
  }

  /**
   * 开始试验
   */
  startTrial(trialId: string): void {
    const trial = this.trials.get(trialId);
    if (trial) {
      trial.status = 'running';
      trial.startTime = Date.now();
    }
  }

  /**
   * 完成试验
   */
  completeTrial(trialId: string, score: number, metrics?: Record<string, number>): void {
    const trial = this.trials.get(trialId);
    if (!trial) return;

    trial.score = score;
    trial.status = 'completed';
    trial.endTime = Date.now();
    if (metrics) {
      trial.metrics = metrics;
    }

    // 更新最佳试验
    if (!this.bestTrial) {
      this.bestTrial = trial;
    } else {
      const isBetter = this.config.direction === 'maximize'
        ? score > (this.bestTrial.score || 0)
        : score < (this.bestTrial.score || Infinity);
      
      if (isBetter) {
        this.bestTrial = trial;
      }
    }
  }

  /**
   * 标记试验失败
   */
  failTrial(trialId: string): void {
    const trial = this.trials.get(trialId);
    if (trial) {
      trial.status = 'failed';
      trial.endTime = Date.now();
    }
  }

  /**
   * 运行优化
   */
  async optimize(
    objectiveFn: (params: Record<string, unknown>) => Promise<number>
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    let noImprovementCount = 0;
    let lastBestScore = this.config.direction === 'maximize' ? -Infinity : Infinity;

    for (let i = 0; i < this.config.maxTrials; i++) {
      // 检查超时
      if (Date.now() - startTime > this.config.timeout) {
        console.log('Optimization timeout');
        break;
      }

      // 创建试验
      const trial = this.createTrial();
      this.startTrial(trial.id);

      try {
        // 执行目标函数
        const score = await objectiveFn(trial.params);
        this.completeTrial(trial.id, score);

        // 早停检查
        if (this.config.direction === 'maximize') {
          if (score > lastBestScore) {
            lastBestScore = score;
            noImprovementCount = 0;
          } else {
            noImprovementCount++;
          }
        } else {
          if (score < lastBestScore) {
            lastBestScore = score;
            noImprovementCount = 0;
          } else {
            noImprovementCount++;
          }
        }

        if (noImprovementCount >= this.config.earlyStoppingRounds) {
          console.log('Early stopping triggered');
          break;
        }
      } catch (error) {
        this.failTrial(trial.id);
      }
    }

    return {
      bestParams: this.bestTrial?.params || {},
      bestScore: this.bestTrial?.score || 0,
      totalTrials: this.trials.size,
      duration: Date.now() - startTime,
      trials: Array.from(this.trials.values()),
    };
  }

  /**
   * 获取最佳参数
   */
  getBestParams(): Record<string, unknown> | null {
    return this.bestTrial?.params || null;
  }

  /**
   * 获取最佳分数
   */
  getBestScore(): number | null {
    return this.bestTrial?.score || null;
  }

  /**
   * 获取所有试验
   */
  getTrials(): Trial[] {
    return Array.from(this.trials.values());
  }
}

// ============================================================
// 贝叶斯优化器
// ============================================================

export class BayesianOptimizer {
  private history: Array<{ params: Record<string, unknown>; score: number }> = [];
  private parameters: Map<string, HyperParameter> = new Map();

  /**
   * 注册参数
   */
  registerParameter(param: HyperParameter): void {
    this.parameters.set(param.name, param);
  }

  /**
   * 添加观察
   */
  addObservation(params: Record<string, unknown>, score: number): void {
    this.history.push({ params, score });
  }

  /**
   * 建议下一个参数
   */
  suggestNext(): Record<string, unknown> {
    if (this.history.length < 5) {
      // 历史数据不足，随机采样
      return this.randomSample();
    }

    // 简化的贝叶斯优化：基于历史最佳点附近采样
    const sorted = [...this.history].sort((a, b) => b.score - a.score);
    const topResults = sorted.slice(0, Math.min(5, sorted.length));

    // 从最佳点附近采样
    const best = topResults[0];
    const params: Record<string, unknown> = {};

    for (const [name, param] of this.parameters) {
      const bestValue = best.params[name];
      
      switch (param.type) {
        case 'float':
          const range = ((param.max || 1) - (param.min || 0)) * 0.2;
          params[name] = Math.max(
            param.min || 0,
            Math.min(param.max || 1, bestValue + (Math.random() - 0.5) * range)
          );
          break;
        case 'int':
          const intRange = Math.floor(((param.max || 10) - (param.min || 0)) * 0.2);
          params[name] = Math.max(
            param.min || 0,
            Math.min(param.max || 10, bestValue + Math.floor((Math.random() - 0.5) * intRange * 2))
          );
          break;
        case 'categorical':
          // 70% 概率选择最佳值，30% 随机
          params[name] = Math.random() < 0.7 ? bestValue : this.randomChoice(param.choices || []);
          break;
      }
    }

    return params;
  }

  /**
   * 随机采样
   */
  private randomSample(): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    for (const [name, param] of this.parameters) {
      switch (param.type) {
        case 'float':
          params[name] = (param.min || 0) + Math.random() * ((param.max || 1) - (param.min || 0));
          break;
        case 'int':
          params[name] = Math.floor((param.min || 0) + Math.random() * ((param.max || 10) - (param.min || 0) + 1));
          break;
        case 'categorical':
          params[name] = this.randomChoice(param.choices || []);
          break;
      }
    }

    return params;
  }

  /**
   * 随机选择
   */
  private randomChoice(choices: string[]): string {
    return choices[Math.floor(Math.random() * choices.length)];
  }

  /**
   * 获取历史
   */
  getHistory(): Array<{ params: Record<string, unknown>; score: number }> {
    return [...this.history];
  }
}

// ============================================================
// 网格搜索
// ============================================================

export class GridSearcher {
  private parameters: Map<string, HyperParameter> = new Map();
  private grid: Array<Record<string, unknown>> = [];
  private currentIndex: number = 0;

  /**
   * 注册参数
   */
  registerParameter(param: HyperParameter): void {
    this.parameters.set(param.name, param);
  }

  /**
   * 生成网格
   */
  generateGrid(pointsPerDimension: number = 5): void {
    const paramArrays: Array<{ name: string; values: unknown[] }> = [];

    for (const [name, param] of this.parameters) {
      const values: unknown[] = [];

      switch (param.type) {
        case 'float':
          const floatStep = ((param.max || 1) - (param.min || 0)) / (pointsPerDimension - 1);
          for (let i = 0; i < pointsPerDimension; i++) {
            values.push((param.min || 0) + i * floatStep);
          }
          break;
        case 'int':
          const intStep = Math.floor(((param.max || 10) - (param.min || 0)) / (pointsPerDimension - 1));
          for (let i = 0; i < pointsPerDimension; i++) {
            values.push(Math.floor((param.min || 0) + i * intStep));
          }
          break;
        case 'categorical':
          values.push(...(param.choices || []));
          break;
      }

      paramArrays.push({ name, values });
    }

    // 生成笛卡尔积
    this.grid = this.cartesianProduct(paramArrays);
  }

  /**
   * 笛卡尔积
   */
  private cartesianProduct(arrays: Array<{ name: string; values: unknown[] }>): Array<Record<string, unknown>> {
    if (arrays.length === 0) return [{}];

    const [first, ...rest] = arrays;
    const restProduct = this.cartesianProduct(rest);

    const result: Array<Record<string, unknown>> = [];
    for (const value of first.values) {
      for (const restItem of restProduct) {
        result.push({ [first.name]: value, ...restItem });
      }
    }

    return result;
  }

  /**
   * 获取下一个参数组合
   */
  next(): Record<string, unknown> | null {
    if (this.currentIndex >= this.grid.length) {
      return null;
    }
    return this.grid[this.currentIndex++];
  }

  /**
   * 获取网格大小
   */
  getGridSize(): number {
    return this.grid.length;
  }

  /**
   * 重置
   */
  reset(): void {
    this.currentIndex = 0;
  }
}

// ============================================================
// 单例
// ============================================================

let hyperparameterOptimizerInstance: HyperparameterOptimizer | null = null;

export function getHyperparameterOptimizer(): HyperparameterOptimizer {
  if (!hyperparameterOptimizerInstance) {
    hyperparameterOptimizerInstance = new HyperparameterOptimizer();
  }
  return hyperparameterOptimizerInstance;
}
