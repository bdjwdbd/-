/**
 * @file feedback-learning.test.ts
 * @brief 反馈学习系统单元测试
 */

import { FeedbackLearningSystem, getFeedbackSystem } from '../src/infrastructure/feedback-learning';

describe('FeedbackLearningSystem', () => {
    let feedback: FeedbackLearningSystem;

    beforeEach(() => {
        feedback = new FeedbackLearningSystem();
    });

    describe('展示记录', () => {
        it('应该正确记录展示', () => {
            feedback.recordImpression('q1', '测试查询', [
                { id: 'result1', score: 0.95 },
                { id: 'result2', score: 0.85 },
                { id: 'result3', score: 0.75 },
            ]);

            const report = feedback.getReport();
            expect(report.totalQueries).toBe(1);
        });

        it('应该正确更新结果统计', () => {
            feedback.recordImpression('q1', '测试查询', [
                { id: 'result1', score: 0.95 },
            ]);

            const topResults = feedback.getTopResults(1);
            expect(topResults.length).toBe(1);
            expect(topResults[0].impressions).toBe(1);
        });
    });

    describe('点击记录', () => {
        beforeEach(() => {
            feedback.recordImpression('q1', '测试查询', [
                { id: 'result1', score: 0.95 },
                { id: 'result2', score: 0.85 },
                { id: 'result3', score: 0.75 },
            ]);
        });

        it('应该正确记录点击', () => {
            feedback.recordClick('q1', 'result1');

            const report = feedback.getReport();
            expect(report.totalClicks).toBe(1);
        });

        it('应该正确更新点击率', () => {
            feedback.recordClick('q1', 'result1');

            const topResults = feedback.getTopResults(1);
            expect(topResults[0].clicks).toBe(1);
            expect(topResults[0].ctr).toBeCloseTo(1, 1);
        });

        it('应该正确更新查询统计', () => {
            feedback.recordClick('q1', 'result1');

            const queryStats = feedback.getQueryStats('测试查询');
            expect(queryStats?.ctr).toBeCloseTo(1/3, 2);
        });
    });

    describe('权重管理', () => {
        it('应该返回初始权重', () => {
            const weights = feedback.getWeights();

            expect(weights.vectorWeight).toBeCloseTo(0.4, 1);
            expect(weights.ftsWeight).toBeCloseTo(0.3, 1);
            expect(weights.llmWeight).toBeCloseTo(0.3, 1);
        });

        it('权重总和应该为 1', () => {
            const weights = feedback.getWeights();
            const total = weights.vectorWeight + weights.ftsWeight + weights.llmWeight;

            expect(total).toBeCloseTo(1, 5);
        });
    });

    describe('统计查询', () => {
        beforeEach(() => {
            // 记录多个查询
            for (let i = 0; i < 5; i++) {
                feedback.recordImpression(`q${i}`, `查询${i}`, [
                    { id: `result${i}_1`, score: 0.9 },
                    { id: `result${i}_2`, score: 0.8 },
                ]);
            }

            // 记录一些点击
            feedback.recordClick('q0', 'result0_1');
            feedback.recordClick('q1', 'result1_1');
            feedback.recordClick('q2', 'result2_2');
        });

        it('应该正确返回热门查询', () => {
            const topQueries = feedback.getTopQueries(3);
            expect(topQueries.length).toBe(3);
        });

        it('应该正确返回高点击率结果', () => {
            const topResults = feedback.getTopResults(3);
            expect(topResults.length).toBeGreaterThan(0);
        });

        it('应该正确计算平均点击率', () => {
            const report = feedback.getReport();
            expect(report.avgCtr).toBeGreaterThan(0);
        });
    });

    describe('持久化', () => {
        it('应该正确导出数据', () => {
            feedback.recordImpression('q1', '测试', [
                { id: 'r1', score: 0.9 },
            ]);
            feedback.recordClick('q1', 'r1');

            const exported = feedback.export();
            expect(exported).toContain('q1');
        });

        it('应该正确导入数据', () => {
            const data = JSON.stringify({
                clickRecords: [{
                    queryId: 'q1',
                    query: '测试',
                    resultId: 'r1',
                    position: 0,
                    score: 0.9,
                    clicked: true,
                    timestamp: Date.now(),
                }],
                queryStats: [],
                resultStats: [],
                weights: {
                    vectorWeight: 0.5,
                    ftsWeight: 0.3,
                    llmWeight: 0.2,
                    reason: '测试',
                },
            });

            feedback.import(data);
            const weights = feedback.getWeights();
            expect(weights.vectorWeight).toBeCloseTo(0.5, 1);
        });
    });
});

describe('getFeedbackSystem', () => {
    it('应该返回单例实例', () => {
        const f1 = getFeedbackSystem();
        const f2 = getFeedbackSystem();
        expect(f1).toBe(f2);
    });
});
