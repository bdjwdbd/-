/**
 * HNSW 自动调参系统
 * 
 * 职责：
 * - 自动寻找最优参数
 * - 基于贝叶斯优化
 * - 平衡延迟和召回率
 */

// ============================================================
// 类型定义
// ============================================================

export interface HNSWTuningParams {
  /** 每层最大连接数 (M) */
  maxConnections: number;
  /** 构建时的候选数 */
  efConstruction: number;
  /** 搜索时的候选数 */
  efSearch: number;
}

export interface TuningConfig {
  /** 参数范围 */
  paramRanges: {
    maxConnections: [number, number];
    efConstruction: [number, number];
    efSearch: [number, number];
  };
  /** 迭代次数 */
  iterations: number;
  /** 测试查询数 */
  testQueryCount: number;
  /** 目标召回率 */
  targetRecall: number;
  /** 延迟权重 (0-1) */
  latencyWeight: number;
}

export interface TuningResult {
  /** 最优参数 */
  bestParams: HNSWTuningParams;
  /** 最优得分 */
  bestScore: number;
  /** 召回率 */
  recall: number;
  /** 延迟 */
  latency: number;
  /** 历史记录 */
  history: Array<{
    params: HNSWTuningParams;
    score: number;
    recall: number;
    latency: number;
  }>;
}

export interface BenchmarkResult {
  recall: number;
  latency: number;
  score: number;
}

// ============================================================
// 自动调参系统
// ============================================================

export class HNSWAutoTuner {
  private config: Required<TuningConfig>;
  private history: Array<{
    params: HNSWTuningParams;
    score: number;
    recall: number;
    latency: number;
  }> = [];
  private bestParams: HNSWTuningParams | null = null;
  private bestScore: number = -Infinity;

  constructor(config: Partial<TuningConfig> = {}) {
    this.config = {
      paramRanges: config.paramRanges ?? {
        maxConnections: [8, 32],
        efConstruction: [100, 400],
        efSearch: [20, 200],
      },
      iterations: config.iterations ?? 20,
      testQueryCount: config.testQueryCount ?? 100,
      targetRecall: config.targetRecall ?? 0.95,
      latencyWeight: config.latencyWeight ?? 0.3,
    };
  }

  /**
   * 自动调参
   */
  async tune(
    indexBuilder: (params: HNSWTuningParams) => Promise<any>,
    searcher: (index: any, query: Float32Array, k: number) => Promise<any[]>,
    testQueries: Float32Array[],
    groundTruth: string[][]
  ): Promise<TuningResult> {
    console.log(`[AutoTuner] 开始调参，迭代次数: ${this.config.iterations}`);

    // 初始化贝叶斯优化器
    const optimizer = new BayesianOptimizer(this.config.paramRanges);

    for (let iter = 0; iter < this.config.iterations; iter++) {
      console.log(`[AutoTuner] 迭代 ${iter + 1}/${this.config.iterations}`);

      // 获取下一组参数
      const params = optimizer.suggest();

      // 构建索引
      const index = await indexBuilder(params);

      // 基准测试
      const benchmark = await this.benchmark(
        index,
        searcher,
        testQueries,
        groundTruth
      );

      // 记录结果
      this.history.push({
        params,
        score: benchmark.score,
        recall: benchmark.recall,
        latency: benchmark.latency,
      });

      // 更新最优
      if (benchmark.score > this.bestScore) {
        this.bestScore = benchmark.score;
        this.bestParams = params;
        console.log(
          `[AutoTuner] 新最优: score=${benchmark.score.toFixed(4)}, ` +
          `recall=${benchmark.recall.toFixed(4)}, ` +
          `latency=${benchmark.latency.toFixed(2)}ms`
        );
      }

      // 更新优化器
      optimizer.observe(params, benchmark.score);
    }

    return {
      bestParams: this.bestParams!,
      bestScore: this.bestScore,
      recall: this.history.find(h => h.params === this.bestParams)?.recall ?? 0,
      latency: this.history.find(h => h.params === this.bestParams)?.latency ?? 0,
      history: this.history,
    };
  }

  /**
   * 基准测试
   */
  private async benchmark(
    index: any,
    searcher: (index: any, query: Float32Array, k: number) => Promise<any[]>,
    testQueries: Float32Array[],
    groundTruth: string[][]
  ): Promise<BenchmarkResult> {
    const k = groundTruth[0]?.length ?? 10;
    let totalRecall = 0;
    let totalLatency = 0;

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      const expected = groundTruth[i];

      // 测量延迟
      const start = Date.now();
      const results = await searcher(index, query, k);
      const latency = Date.now() - start;

      // 计算召回率
      const resultIds = new Set(results.map(r => r.id));
      const expectedSet = new Set(expected);
      let hits = 0;
      for (const id of resultIds) {
        if (expectedSet.has(id)) hits++;
      }
      const recall = hits / k;

      totalRecall += recall;
      totalLatency += latency;
    }

    const avgRecall = totalRecall / testQueries.length;
    const avgLatency = totalLatency / testQueries.length;

    // 计算综合得分
    const recallScore = Math.min(1, avgRecall / this.config.targetRecall);
    const latencyScore = 1 / (1 + avgLatency / 100); // 归一化延迟
    const score =
      (1 - this.config.latencyWeight) * recallScore +
      this.config.latencyWeight * latencyScore;

    return {
      recall: avgRecall,
      latency: avgLatency,
      score,
    };
  }

  /**
   * 获取历史记录
   */
  getHistory(): TuningResult['history'] {
    return [...this.history];
  }
}

// ============================================================
// 贝叶斯优化器（简化实现）
// ============================================================

class BayesianOptimizer {
  private paramRanges: TuningConfig['paramRanges'];
  private observations: Array<{ params: HNSWTuningParams; score: number }> = [];

  constructor(paramRanges: TuningConfig['paramRanges']) {
    this.paramRanges = paramRanges;
  }

  /**
   * 建议下一组参数
   */
  suggest(): HNSWTuningParams {
    // 前几次随机探索
    if (this.observations.length < 5) {
      return this.randomParams();
    }

    // 使用采集函数选择下一组参数
    // 简化实现：在已知最优点附近探索
    const best = this.observations.reduce((a, b) =>
      a.score > b.score ? a : b
    );

    // 在最优点附近随机扰动
    return {
      maxConnections: this.perturb(
        best.params.maxConnections,
        this.paramRanges.maxConnections
      ),
      efConstruction: this.perturb(
        best.params.efConstruction,
        this.paramRanges.efConstruction
      ),
      efSearch: this.perturb(
        best.params.efSearch,
        this.paramRanges.efSearch
      ),
    };
  }

  /**
   * 记录观察结果
   */
  observe(params: HNSWTuningParams, score: number): void {
    this.observations.push({ params, score });
  }

  /**
   * 随机参数
   */
  private randomParams(): HNSWTuningParams {
    return {
      maxConnections: this.randomInRange(this.paramRanges.maxConnections),
      efConstruction: this.randomInRange(this.paramRanges.efConstruction),
      efSearch: this.randomInRange(this.paramRanges.efSearch),
    };
  }

  /**
   * 随机范围值
   */
  private randomInRange(range: [number, number]): number {
    return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  }

  /**
   * 扰动参数
   */
  private perturb(value: number, range: [number, number]): number {
    const delta = Math.floor((range[1] - range[0]) * 0.2);
    const newValue = value + Math.floor(Math.random() * (2 * delta + 1)) - delta;
    return Math.max(range[0], Math.min(range[1], newValue));
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createHNSWAutoTuner(config?: Partial<TuningConfig>): HNSWAutoTuner {
  return new HNSWAutoTuner(config);
}
