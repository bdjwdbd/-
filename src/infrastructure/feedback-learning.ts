/**
 * @file feedback-learning.ts
 * @brief 反馈学习系统
 * 
 * 功能：
 * 1. 用户点击记录
 * 2. 排序权重优化
 * 3. A/B 测试
 * 4. 效果评估
 * 
 * 参考：llm-memory-integration v5.2.25
 */

// ============================================================
// 类型定义
// ============================================================

export interface ClickRecord {
    queryId: string;
    query: string;
    resultId: string;
    position: number;
    score: number;
    clicked: boolean;
    timestamp: number;
}

export interface QueryStats {
    query: string;
    count: number;
    avgClickPosition: number;
    ctr: number; // Click-through rate
    lastQueried: number;
}

export interface ResultStats {
    resultId: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
}

export interface WeightAdjustment {
    vectorWeight: number;
    ftsWeight: number;
    llmWeight: number;
    reason: string;
}

export interface FeedbackConfig {
    enableLearning: boolean;
    minSamplesForAdjustment: number;
    learningRate: number;
    maxWeightChange: number;
}

// ============================================================
// 反馈学习系统
// ============================================================

export class FeedbackLearningSystem {
    private clickRecords: ClickRecord[] = [];
    private queryStats: Map<string, QueryStats> = new Map();
    private resultStats: Map<string, ResultStats> = new Map();
    private weights: WeightAdjustment = {
        vectorWeight: 0.4,
        ftsWeight: 0.3,
        llmWeight: 0.3,
        reason: '初始权重',
    };
    private config: FeedbackConfig;

    constructor(config: Partial<FeedbackConfig> = {}) {
        this.config = {
            enableLearning: config.enableLearning ?? true,
            minSamplesForAdjustment: config.minSamplesForAdjustment ?? 10,
            learningRate: config.learningRate ?? 0.1,
            maxWeightChange: config.maxWeightChange ?? 0.1,
        };
    }

    // ============================================================
    // 记录反馈
    // ============================================================

    /**
     * 记录搜索结果展示
     */
    recordImpression(queryId: string, query: string, results: Array<{ id: string; score: number }>): void {
        results.forEach((result, position) => {
            const record: ClickRecord = {
                queryId,
                query,
                resultId: result.id,
                position,
                score: result.score,
                clicked: false,
                timestamp: Date.now(),
            };
            this.clickRecords.push(record);

            // 更新结果统计
            const stats = this.resultStats.get(result.id) || {
                resultId: result.id,
                impressions: 0,
                clicks: 0,
                ctr: 0,
                avgPosition: 0,
            };
            stats.impressions++;
            stats.avgPosition = (stats.avgPosition * (stats.impressions - 1) + position) / stats.impressions;
            this.resultStats.set(result.id, stats);
        });

        // 更新查询统计
        const queryStats = this.queryStats.get(query) || {
            query,
            count: 0,
            avgClickPosition: 0,
            ctr: 0,
            lastQueried: 0,
        };
        queryStats.count++;
        queryStats.lastQueried = Date.now();
        this.queryStats.set(query, queryStats);
    }

    /**
     * 记录用户点击
     */
    recordClick(queryId: string, resultId: string): void {
        // 找到对应的记录
        const record = this.clickRecords.find(
            r => r.queryId === queryId && r.resultId === resultId && !r.clicked
        );

        if (record) {
            record.clicked = true;

            // 更新结果统计
            const stats = this.resultStats.get(resultId);
            if (stats) {
                stats.clicks++;
                stats.ctr = stats.clicks / stats.impressions;
            }

            // 更新查询统计
            const queryStats = this.queryStats.get(record.query);
            if (queryStats) {
                const clickRecords = this.clickRecords.filter(
                    r => r.query === record.query && r.clicked
                );
                queryStats.avgClickPosition = clickRecords.reduce((sum, r) => sum + r.position, 0) / clickRecords.length;
                queryStats.ctr = clickRecords.length / this.clickRecords.filter(r => r.query === record.query).length;
            }

            // 触发学习
            if (this.config.enableLearning) {
                this.learn(record);
            }
        }
    }

    // ============================================================
    // 学习优化
    // ============================================================

    /**
     * 从点击中学习
     */
    private learn(record: ClickRecord): void {
        // 检查样本数量
        const recentRecords = this.clickRecords.filter(
            r => r.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000 // 最近 7 天
        );

        if (recentRecords.length < this.config.minSamplesForAdjustment) {
            return;
        }

        // 分析点击位置分布
        const clickedRecords = recentRecords.filter(r => r.clicked);
        if (clickedRecords.length < this.config.minSamplesForAdjustment) {
            return;
        }

        // 计算平均点击位置
        const avgClickPosition = clickedRecords.reduce((sum, r) => sum + r.position, 0) / clickedRecords.length;

        // 根据点击位置调整权重
        // 如果用户经常点击靠后的结果，说明排序需要优化
        if (avgClickPosition > 3) {
            // 用户倾向于点击后面的结果，可能需要增加语义权重
            this.adjustWeights({
                vectorWeight: this.weights.vectorWeight + this.config.learningRate * 0.5,
                ftsWeight: this.weights.ftsWeight - this.config.learningRate * 0.25,
                llmWeight: this.weights.llmWeight - this.config.learningRate * 0.25,
                reason: `平均点击位置 ${avgClickPosition.toFixed(1)} > 3，增加语义权重`,
            });
        } else if (avgClickPosition < 2) {
            // 用户倾向于点击前面的结果，排序效果良好
            // 保持当前权重
        }
    }

    /**
     * 调整权重
     */
    private adjustWeights(newWeights: WeightAdjustment): void {
        // 限制权重变化范围
        const maxChange = this.config.maxWeightChange;

        newWeights.vectorWeight = this.clamp(
            newWeights.vectorWeight,
            this.weights.vectorWeight - maxChange,
            this.weights.vectorWeight + maxChange
        );
        newWeights.ftsWeight = this.clamp(
            newWeights.ftsWeight,
            this.weights.ftsWeight - maxChange,
            this.weights.ftsWeight + maxChange
        );
        newWeights.llmWeight = this.clamp(
            newWeights.llmWeight,
            this.weights.llmWeight - maxChange,
            this.weights.llmWeight + maxChange
        );

        // 归一化
        const total = newWeights.vectorWeight + newWeights.ftsWeight + newWeights.llmWeight;
        newWeights.vectorWeight /= total;
        newWeights.ftsWeight /= total;
        newWeights.llmWeight /= total;

        this.weights = newWeights;
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    // ============================================================
    // 获取信息
    // ============================================================

    /**
     * 获取当前权重
     */
    getWeights(): WeightAdjustment {
        return { ...this.weights };
    }

    /**
     * 获取查询统计
     */
    getQueryStats(query: string): QueryStats | undefined {
        return this.queryStats.get(query);
    }

    /**
     * 获取热门查询
     */
    getTopQueries(limit: number = 10): QueryStats[] {
        return Array.from(this.queryStats.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * 获取高点击率结果
     */
    getTopResults(limit: number = 10): ResultStats[] {
        return Array.from(this.resultStats.values())
            .filter(s => s.impressions >= 5) // 至少展示 5 次
            .sort((a, b) => b.ctr - a.ctr)
            .slice(0, limit);
    }

    /**
     * 获取统计报告
     */
    getReport(): {
        totalQueries: number;
        totalClicks: number;
        avgCtr: number;
        weights: WeightAdjustment;
        topQueries: QueryStats[];
        topResults: ResultStats[];
    } {
        const totalClicks = this.clickRecords.filter(r => r.clicked).length;
        const totalImpressions = this.clickRecords.length;

        return {
            totalQueries: this.queryStats.size,
            totalClicks,
            avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
            weights: this.getWeights(),
            topQueries: this.getTopQueries(5),
            topResults: this.getTopResults(5),
        };
    }

    /**
     * 打印报告
     */
    printReport(): void {
        const report = this.getReport();

        console.log('========================================');
        console.log('  反馈学习报告');
        console.log('========================================\n');

        console.log(`总查询数: ${report.totalQueries}`);
        console.log(`总点击数: ${report.totalClicks}`);
        console.log(`平均点击率: ${(report.avgCtr * 100).toFixed(1)}%`);

        console.log('\n当前权重:');
        console.log(`  向量: ${(report.weights.vectorWeight * 100).toFixed(1)}%`);
        console.log(`  FTS: ${(report.weights.ftsWeight * 100).toFixed(1)}%`);
        console.log(`  LLM: ${(report.weights.llmWeight * 100).toFixed(1)}%`);
        console.log(`  原因: ${report.weights.reason}`);

        console.log('\n热门查询:');
        report.topQueries.forEach((q, i) => {
            console.log(`  ${i + 1}. "${q.query}" - ${q.count} 次, CTR: ${(q.ctr * 100).toFixed(1)}%`);
        });

        console.log('\n高点击率结果:');
        report.topResults.forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.resultId} - CTR: ${(r.ctr * 100).toFixed(1)}%, 展示: ${r.impressions} 次`);
        });
    }

    // ============================================================
    // 持久化
    // ============================================================

    /**
     * 导出数据
     */
    export(): string {
        return JSON.stringify({
            clickRecords: this.clickRecords.slice(-1000), // 最近 1000 条
            queryStats: Array.from(this.queryStats.entries()),
            resultStats: Array.from(this.resultStats.entries()),
            weights: this.weights,
        });
    }

    /**
     * 导入数据
     */
    import(data: string): void {
        try {
            const parsed = JSON.parse(data);
            this.clickRecords = parsed.clickRecords || [];
            this.queryStats = new Map(parsed.queryStats || []);
            this.resultStats = new Map(parsed.resultStats || []);
            this.weights = parsed.weights || this.weights;
        } catch (error) {
            console.error('导入反馈数据失败:', error);
        }
    }
}

// ============================================================
// 单例
// ============================================================

let defaultFeedbackSystem: FeedbackLearningSystem | null = null;

export function getFeedbackSystem(): FeedbackLearningSystem {
    if (!defaultFeedbackSystem) {
        defaultFeedbackSystem = new FeedbackLearningSystem();
    }
    return defaultFeedbackSystem;
}

// ============================================================
// 导出
// ============================================================

export default {
    FeedbackLearningSystem,
    getFeedbackSystem,
};
