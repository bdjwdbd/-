/**
 * 自主学习模块
 * 
 * 功能：
 * 1. 自驱学习目标设定
 * 2. 学习路径规划
 * 3. 自我评估与调整
 * 4. 学习成果固化
 */

import { StructuredLogger } from './index';
import { KnowledgeGraph } from './knowledge-graph';
import { MetaCognition } from './meta-cognition';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface LearningGoal {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  subGoals: string[];
  dependencies: string[];
  deadline?: number;
  createdAt: number;
  updatedAt: number;
}

export interface LearningPath {
  id: string;
  goalId: string;
  steps: LearningStep[];
  currentStep: number;
  estimatedTime: number;
  actualTime: number;
  status: 'planned' | 'active' | 'completed' | 'abandoned';
}

export interface LearningStep {
  id: string;
  name: string;
  type: 'knowledge' | 'skill' | 'practice' | 'assessment';
  content: string;
  resources: string[];
  prerequisites: string[];
  estimatedDuration: number;
  completed: boolean;
  score?: number;
}

export interface SelfAssessment {
  id: string;
  goalId: string;
  timestamp: number;
  metrics: AssessmentMetric[];
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface AssessmentMetric {
  name: string;
  value: number;
  target: number;
  weight: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface LearningSession {
  id: string;
  goalId: string;
  startTime: number;
  endTime?: number;
  activities: LearningActivity[];
  insights: string[];
  outcomes: string[];
}

export interface LearningActivity {
  type: 'read' | 'practice' | 'test' | 'reflect';
  content: string;
  duration: number;
  result?: any;
}

// ============ 自主学习器 ============

export class AutonomousLearner {
  private logger: StructuredLogger;
  private knowledgeGraph: KnowledgeGraph;
  private metaCognition: MetaCognition;
  private dataDir: string;
  
  // 学习目标
  private goals: Map<string, LearningGoal> = new Map();
  
  // 学习路径
  private paths: Map<string, LearningPath> = new Map();
  
  // 评估历史
  private assessments: SelfAssessment[] = [];
  
  // 学习会话
  private currentSession: LearningSession | null = null;
  
  constructor(
    logger: StructuredLogger,
    knowledgeGraph: KnowledgeGraph,
    metaCognition: MetaCognition,
    dataDir: string = './data/autonomous'
  ) {
    this.logger = logger;
    this.knowledgeGraph = knowledgeGraph;
    this.metaCognition = metaCognition;
    this.dataDir = dataDir;
    
    this.ensureDir(dataDir);
    this.loadData();
  }
  
  /**
   * 设定学习目标
   */
  setGoal(goal: Omit<LearningGoal, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'status'>): LearningGoal {
    const id = `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newGoal: LearningGoal = {
      ...goal,
      id,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.goals.set(id, newGoal);
    this.saveData();
    
    this.logger.info('AutonomousLearner', `设定学习目标: ${goal.name} (${goal.priority})`);
    
    return newGoal;
  }
  
  /**
   * 规划学习路径
   */
  planPath(goalId: string): LearningPath {
    const goal = this.goals.get(goalId);
    
    if (!goal) {
      throw new Error(`目标不存在: ${goalId}`);
    }
    
    // 分析目标，生成学习步骤
    const steps = this.generateLearningSteps(goal);
    
    const path: LearningPath = {
      id: `path-${Date.now()}`,
      goalId,
      steps,
      currentStep: 0,
      estimatedTime: steps.reduce((sum, s) => sum + s.estimatedDuration, 0),
      actualTime: 0,
      status: 'planned',
    };
    
    this.paths.set(path.id, path);
    this.saveData();
    
    this.logger.info('AutonomousLearner', 
      `规划学习路径: ${steps.length} 个步骤, 预计 ${path.estimatedTime} 分钟`
    );
    
    return path;
  }
  
  /**
   * 开始学习会话
   */
  startSession(goalId: string): LearningSession {
    const goal = this.goals.get(goalId);
    
    if (!goal) {
      throw new Error(`目标不存在: ${goalId}`);
    }
    
    // 更新目标状态
    goal.status = 'in_progress';
    goal.updatedAt = Date.now();
    
    // 创建学习会话
    this.currentSession = {
      id: `session-${Date.now()}`,
      goalId,
      startTime: Date.now(),
      activities: [],
      insights: [],
      outcomes: [],
    };
    
    this.logger.info('AutonomousLearner', `开始学习会话: ${goal.name}`);
    
    return this.currentSession;
  }
  
  /**
   * 执行学习活动
   */
  performActivity(
    type: LearningActivity['type'],
    content: string,
    duration: number
  ): LearningActivity {
    if (!this.currentSession) {
      throw new Error('没有活跃的学习会话');
    }
    
    const activity: LearningActivity = {
      type,
      content,
      duration,
    };
    
    // 根据活动类型执行
    switch (type) {
      case 'read':
        activity.result = this.performReading(content);
        break;
      case 'practice':
        activity.result = this.performPractice(content);
        break;
      case 'test':
        activity.result = this.performTest(content);
        break;
      case 'reflect':
        activity.result = this.performReflection(content);
        break;
    }
    
    this.currentSession.activities.push(activity);
    
    this.logger.debug('AutonomousLearner', 
      `执行学习活动: ${type}, 耗时 ${duration} 分钟`
    );
    
    return activity;
  }
  
  /**
   * 结束学习会话
   */
  endSession(): LearningSession {
    if (!this.currentSession) {
      throw new Error('没有活跃的学习会话');
    }
    
    this.currentSession.endTime = Date.now();
    
    // 生成洞察
    this.currentSession.insights = this.generateInsights(this.currentSession);
    
    // 生成成果
    this.currentSession.outcomes = this.generateOutcomes(this.currentSession);
    
    // 更新目标进度
    const goal = this.goals.get(this.currentSession.goalId);
    if (goal) {
      goal.progress = this.calculateProgress(this.currentSession);
      goal.updatedAt = Date.now();
      
      if (goal.progress >= 100) {
        goal.status = 'completed';
      }
    }
    
    const session = this.currentSession;
    this.currentSession = null;
    
    this.saveData();
    
    this.logger.info('AutonomousLearner', 
      `结束学习会话: ${session.activities.length} 个活动, ${session.insights.length} 个洞察`
    );
    
    return session;
  }
  
  /**
   * 自我评估
   */
  selfAssess(goalId: string): SelfAssessment {
    const goal = this.goals.get(goalId);
    
    if (!goal) {
      throw new Error(`目标不存在: ${goalId}`);
    }
    
    // 获取元认知报告
    const metaReport = this.metaCognition.generateReport();
    
    // 计算各项指标
    const metrics: AssessmentMetric[] = [
      {
        name: '知识掌握度',
        value: this.calculateKnowledgeMastery(goal),
        target: 0.8,
        weight: 0.3,
        trend: this.determineTrend('knowledge', goalId),
      },
      {
        name: '技能熟练度',
        value: this.calculateSkillProficiency(goal),
        target: 0.7,
        weight: 0.25,
        trend: this.determineTrend('skill', goalId),
      },
      {
        name: '应用能力',
        value: this.calculateApplicationAbility(goal),
        target: 0.6,
        weight: 0.25,
        trend: this.determineTrend('application', goalId),
      },
      {
        name: '学习效率',
        value: this.calculateLearningEfficiency(goal),
        target: 0.7,
        weight: 0.2,
        trend: this.determineTrend('efficiency', goalId),
      },
    ];
    
    // 计算总分
    const overallScore = metrics.reduce(
      (sum, m) => sum + m.value * m.weight,
      0
    );
    
    // 识别优势和劣势
    const strengths = metrics
      .filter(m => m.value >= m.target)
      .map(m => m.name);
    
    const weaknesses = metrics
      .filter(m => m.value < m.target)
      .map(m => m.name);
    
    // 生成建议
    const recommendations = this.generateRecommendations(metrics, goal);
    
    const assessment: SelfAssessment = {
      id: `assess-${Date.now()}`,
      goalId,
      timestamp: Date.now(),
      metrics,
      overallScore,
      strengths,
      weaknesses,
      recommendations,
    };
    
    this.assessments.push(assessment);
    this.saveData();
    
    this.logger.info('AutonomousLearner', 
      `自我评估完成: 总分 ${(overallScore * 100).toFixed(1)}%`
    );
    
    return assessment;
  }
  
  /**
   * 调整学习计划
   */
  adjustPlan(goalId: string, assessment: SelfAssessment): LearningPath {
    const goal = this.goals.get(goalId);
    const existingPath = Array.from(this.paths.values()).find(
      p => p.goalId === goalId && p.status === 'active'
    );
    
    if (!goal || !existingPath) {
      throw new Error('目标或路径不存在');
    }
    
    // 根据评估结果调整步骤
    const adjustedSteps = [...existingPath.steps];
    
    for (const metric of assessment.metrics) {
      if (metric.value < metric.target) {
        // 添加强化步骤
        adjustedSteps.push({
          id: `step-${Date.now()}`,
          name: `强化: ${metric.name}`,
          type: 'practice',
          content: `针对 ${metric.name} 的强化练习`,
          resources: [],
          prerequisites: [],
          estimatedDuration: 30,
          completed: false,
        });
      }
    }
    
    // 更新路径
    existingPath.steps = adjustedSteps;
    existingPath.estimatedTime = adjustedSteps.reduce(
      (sum, s) => sum + s.estimatedDuration,
      0
    );
    
    this.saveData();
    
    this.logger.info('AutonomousLearner', 
      `调整学习计划: 新增 ${adjustedSteps.length - existingPath.steps.length} 个步骤`
    );
    
    return existingPath;
  }
  
  // ============ 私有方法 ============
  
  private generateLearningSteps(goal: LearningGoal): LearningStep[] {
    const steps: LearningStep[] = [];
    
    // 基础知识学习
    steps.push({
      id: `step-${Date.now()}-1`,
      name: `学习 ${goal.name} 基础知识`,
      type: 'knowledge',
      content: `掌握 ${goal.name} 的核心概念和原理`,
      resources: [],
      prerequisites: [],
      estimatedDuration: 60,
      completed: false,
    });
    
    // 技能练习
    steps.push({
      id: `step-${Date.now()}-2`,
      name: `练习 ${goal.name} 相关技能`,
      type: 'skill',
      content: `通过实践掌握 ${goal.name} 的应用技能`,
      resources: [],
      prerequisites: [steps[0].id],
      estimatedDuration: 90,
      completed: false,
    });
    
    // 实践应用
    steps.push({
      id: `step-${Date.now()}-3`,
      name: `应用 ${goal.name} 解决问题`,
      type: 'practice',
      content: `在实际场景中应用 ${goal.name}`,
      resources: [],
      prerequisites: [steps[1].id],
      estimatedDuration: 120,
      completed: false,
    });
    
    // 评估测试
    steps.push({
      id: `step-${Date.now()}-4`,
      name: `评估 ${goal.name} 掌握程度`,
      type: 'assessment',
      content: `测试对 ${goal.name} 的理解和应用能力`,
      resources: [],
      prerequisites: [steps[2].id],
      estimatedDuration: 30,
      completed: false,
    });
    
    return steps;
  }
  
  private performReading(content: string): any {
    // 模拟阅读学习
    return {
      understood: true,
      keyPoints: ['要点1', '要点2', '要点3'],
      questions: [],
    };
  }
  
  private performPractice(content: string): any {
    // 模拟实践练习
    return {
      completed: true,
      score: 0.85,
      feedback: '练习完成，表现良好',
    };
  }
  
  private performTest(content: string): any {
    // 模拟测试评估
    return {
      score: 0.8,
      correctRate: 0.8,
      areas: {
        strength: ['理解', '应用'],
        weakness: ['创新'],
      },
    };
  }
  
  private performReflection(content: string): any {
    // 模拟反思总结
    return {
      insights: ['洞察1', '洞察2'],
      improvements: ['改进点1', '改进点2'],
      nextSteps: ['下一步1', '下一步2'],
    };
  }
  
  private generateInsights(session: LearningSession): string[] {
    const insights: string[] = [];
    
    for (const activity of session.activities) {
      if (activity.result?.insights) {
        insights.push(...activity.result.insights);
      }
    }
    
    return insights;
  }
  
  private generateOutcomes(session: LearningSession): string[] {
    const outcomes: string[] = [];
    
    for (const activity of session.activities) {
      if (activity.type === 'test' && activity.result?.score) {
        outcomes.push(`测试得分: ${(activity.result.score * 100).toFixed(1)}%`);
      }
    }
    
    return outcomes;
  }
  
  private calculateProgress(session: LearningSession): number {
    const path = Array.from(this.paths.values()).find(
      p => p.goalId === session.goalId
    );
    
    if (!path) return 0;
    
    const completedSteps = path.steps.filter(s => s.completed).length;
    return (completedSteps / path.steps.length) * 100;
  }
  
  private calculateKnowledgeMastery(goal: LearningGoal): number {
    // 基于知识图谱计算
    const stats = this.knowledgeGraph.getStats();
    return Math.min(1, stats.totalEntities / 100);
  }
  
  private calculateSkillProficiency(goal: LearningGoal): number {
    // 基于学习进度计算
    return goal.progress / 100;
  }
  
  private calculateApplicationAbility(goal: LearningGoal): number {
    // 基于元认知置信度计算
    const report = this.metaCognition.generateReport();
    return report.overallScore;
  }
  
  private calculateLearningEfficiency(goal: LearningGoal): number {
    // 基于时间效率计算
    const path = Array.from(this.paths.values()).find(
      p => p.goalId === goal.id
    );
    
    if (!path || path.estimatedTime === 0) return 0.5;
    
    return Math.min(1, path.estimatedTime / (path.actualTime || 1));
  }
  
  private determineTrend(
    metric: string,
    goalId: string
  ): AssessmentMetric['trend'] {
    const goalAssessments = this.assessments
      .filter(a => a.goalId === goalId)
      .slice(-3);
    
    if (goalAssessments.length < 2) return 'stable';
    
    const recent = goalAssessments[goalAssessments.length - 1];
    const previous = goalAssessments[goalAssessments.length - 2];
    
    const recentMetric = recent.metrics.find(m => m.name.includes(metric));
    const previousMetric = previous.metrics.find(m => m.name.includes(metric));
    
    if (!recentMetric || !previousMetric) return 'stable';
    
    if (recentMetric.value > previousMetric.value + 0.05) return 'improving';
    if (recentMetric.value < previousMetric.value - 0.05) return 'declining';
    return 'stable';
  }
  
  private generateRecommendations(
    metrics: AssessmentMetric[],
    goal: LearningGoal
  ): string[] {
    const recommendations: string[] = [];
    
    for (const metric of metrics) {
      if (metric.value < metric.target) {
        if (metric.trend === 'declining') {
          recommendations.push(`紧急加强 ${metric.name}，当前呈下降趋势`);
        } else if (metric.trend === 'stable') {
          recommendations.push(`重点提升 ${metric.name}，增加练习时间`);
        } else {
          recommendations.push(`继续努力提升 ${metric.name}，保持当前进度`);
        }
      }
    }
    
    return recommendations;
  }
  
  // ============ 数据持久化 ============
  
  private loadData(): void {
    try {
      const goalsFile = path.join(this.dataDir, 'goals.json');
      if (fs.existsSync(goalsFile)) {
        const goalsData = JSON.parse(fs.readFileSync(goalsFile, 'utf-8'));
        this.goals = new Map(Object.entries(goalsData));
      }
      
      const pathsFile = path.join(this.dataDir, 'paths.json');
      if (fs.existsSync(pathsFile)) {
        const pathsData = JSON.parse(fs.readFileSync(pathsFile, 'utf-8'));
        this.paths = new Map(Object.entries(pathsData));
      }
      
      const assessmentsFile = path.join(this.dataDir, 'assessments.json');
      if (fs.existsSync(assessmentsFile)) {
        this.assessments = JSON.parse(fs.readFileSync(assessmentsFile, 'utf-8'));
      }
    } catch (error) {
      this.logger.warn('AutonomousLearner', `数据加载失败: ${error}`);
    }
  }
  
  private saveData(): void {
    try {
      const goalsFile = path.join(this.dataDir, 'goals.json');
      fs.writeFileSync(goalsFile, JSON.stringify(Object.fromEntries(this.goals), null, 2));
      
      const pathsFile = path.join(this.dataDir, 'paths.json');
      fs.writeFileSync(pathsFile, JSON.stringify(Object.fromEntries(this.paths), null, 2));
      
      const assessmentsFile = path.join(this.dataDir, 'assessments.json');
      fs.writeFileSync(assessmentsFile, JSON.stringify(this.assessments.slice(-100), null, 2));
    } catch (error) {
      this.logger.warn('AutonomousLearner', `数据保存失败: ${error}`);
    }
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  // ============ 公共访问器 ============
  
  getGoals(): LearningGoal[] {
    return Array.from(this.goals.values());
  }
  
  getGoal(id: string): LearningGoal | undefined {
    return this.goals.get(id);
  }
  
  getPaths(): LearningPath[] {
    return Array.from(this.paths.values());
  }
  
  getAssessments(): SelfAssessment[] {
    return this.assessments;
  }
}
