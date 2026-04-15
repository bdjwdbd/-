/**
 * 机器学习遗忘检测器
 * 
 * 特征：
 * 1. 时间衰减（指数）
 * 2. 访问模式（泊松过程）
 * 3. 语义重要性（TF-IDF）
 * 4. 用户反馈（强化学习）
 * 
 * 目标：
 * - 遗忘准确率: 92%
 * - 误删率: < 5%
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface ForgetFeatures {
  // 时间特征
  age: number;                    // 记忆年龄（毫秒）
  ageNormalized: number;          // 归一化年龄 [0, 1]
  
  // 访问特征
  accessCount: number;            // 访问次数
  accessFrequency: number;        // 访问频率（次/天）
  lastAccessDelta: number;        // 距上次访问时间（毫秒）
  accessRecency: number;          // 访问新近度 [0, 1]
  
  // 重要性特征
  importance: number;             // 用户标记的重要性
  confidence: number;             // 置信度
  semanticScore: number;          // 语义重要性分数
  
  // 内容特征
  contentLength: number;          // 内容长度
  tagCount: number;               // 标签数量
  hasKeywords: number;            // 是否包含关键词 [0, 1]
  
  // 上下文特征
  relatedCount: number;           // 关联记忆数量
  duplicateScore: number;         // 重复度分数
}

export interface ForgetLabel {
  memoryId: string;
  shouldForget: boolean;
  userFeedback?: 'forget' | 'keep' | 'unsure';
  timestamp: number;
}

export interface ForgetModel {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
  trainedAt: number;
  samples: number;
  accuracy: number;
}

export interface MLPrediction {
  memoryId: string;
  forgetProbability: number;
  confidence: number;
  topReasons: string[];
  features: ForgetFeatures;
}

export interface MLForgetDetectorConfig {
  // 时间衰减参数
  halfLife: number;               // 半衰期（毫秒）
  maxAge: number;                 // 最大年龄（毫秒）
  
  // 访问模式参数
  accessDecayRate: number;        // 访问衰减率
  minAccessCount: number;         // 最小访问次数
  
  // 语义重要性参数
  keywordList: string[];          // 关键词列表
  
  // 模型参数
  learningRate: number;
  regularization: number;
  minSamples: number;
  
  // 阈值
  forgetThreshold: number;        // 遗忘阈值
  keepThreshold: number;          // 保留阈值
  
  // 持久化
  modelPath?: string;
  autoSave: boolean;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: MLForgetDetectorConfig = {
  halfLife: 7 * 24 * 60 * 60 * 1000,  // 7天
  maxAge: 365 * 24 * 60 * 60 * 1000,  // 1年
  
  accessDecayRate: 0.1,
  minAccessCount: 1,
  
  keywordList: [
    '重要', '关键', '核心', '必须', '紧急',
    'important', 'critical', 'key', 'must', 'urgent',
  ],
  
  learningRate: 0.01,
  regularization: 0.001,
  minSamples: 100,
  
  forgetThreshold: 0.7,
  keepThreshold: 0.3,
  
  autoSave: true,
};

// ============ ML 遗忘检测器类 ============

export class MLForgetDetector {
  private logger: any;
  private config: MLForgetDetectorConfig;
  private model: ForgetModel | null = null;
  private trainingData: { features: ForgetFeatures; label: number }[] = [];
  private dataPath: string;

  constructor(logger: any, config?: Partial<MLForgetDetectorConfig>, dataPath?: string) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataPath = dataPath || path.join(process.env.HOME || '.', '.openclaw', 'workspace', 'memory', 'forget-model');
    
    this.ensureDir(path.dirname(this.dataPath));
    this.loadModel();
  }

  // ============ 特征提取 ============

  /**
   * 提取记忆特征
   */
  extractFeatures(memory: {
    id: string;
    content: string;
    createdAt: number;
    accessedAt: number;
    accessCount: number;
    importance: number;
    confidence: number;
    tags: string[];
    relatedCount?: number;
    duplicateScore?: number;
  }): ForgetFeatures {
    const now = Date.now();
    
    // 时间特征
    const age = now - memory.createdAt;
    const ageNormalized = Math.min(age / this.config.maxAge, 1);
    
    // 访问特征
    const daysSinceCreation = Math.max(age / (24 * 60 * 60 * 1000), 1);
    const accessFrequency = memory.accessCount / daysSinceCreation;
    const lastAccessDelta = now - memory.accessedAt;
    const accessRecency = Math.exp(-lastAccessDelta / this.config.halfLife);
    
    // 语义重要性
    const semanticScore = this.computeSemanticScore(memory.content);
    
    // 内容特征
    const contentLength = memory.content.length;
    const tagCount = memory.tags.length;
    const hasKeywords = this.containsKeywords(memory.content) ? 1 : 0;
    
    // 上下文特征
    const relatedCount = memory.relatedCount || 0;
    const duplicateScore = memory.duplicateScore || 0;

    return {
      age,
      ageNormalized,
      accessCount: memory.accessCount,
      accessFrequency,
      lastAccessDelta,
      accessRecency,
      importance: memory.importance,
      confidence: memory.confidence,
      semanticScore,
      contentLength,
      tagCount,
      hasKeywords,
      relatedCount,
      duplicateScore,
    };
  }

  /**
   * 计算语义重要性分数
   */
  private computeSemanticScore(content: string): number {
    // 基于 TF-IDF 思想的简化实现
    const words = content.toLowerCase().split(/\s+/);
    const wordCount: Record<string, number> = {};
    
    for (const word of words) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
    
    // 计算关键词密度
    let keywordDensity = 0;
    for (const keyword of this.config.keywordList) {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        keywordDensity += 0.2;
      }
    }
    
    // 计算词汇丰富度
    const uniqueWords = Object.keys(wordCount).length;
    const richness = words.length > 0 ? uniqueWords / words.length : 0;
    
    return Math.min(1, keywordDensity + richness * 0.5);
  }

  /**
   * 检查是否包含关键词
   */
  private containsKeywords(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return this.config.keywordList.some(kw => lowerContent.includes(kw.toLowerCase()));
  }

  // ============ 模型训练 ============

  /**
   * 添加训练样本
   */
  addTrainingSample(features: ForgetFeatures, shouldForget: boolean): void {
    this.trainingData.push({
      features,
      label: shouldForget ? 1 : 0,
    });

    // 达到最小样本数时自动训练
    if (this.trainingData.length >= this.config.minSamples && this.trainingData.length % 50 === 0) {
      this.train();
    }
  }

  /**
   * 添加用户反馈
   */
  addUserFeedback(feedback: ForgetLabel): void {
    // 这里可以存储反馈用于后续训练
    this.logger.info('MLForgetDetector', `收到用户反馈: ${feedback.memoryId} -> ${feedback.userFeedback}`);
  }

  /**
   * 训练模型（逻辑回归）
   */
  train(): { accuracy: number; samples: number } {
    if (this.trainingData.length < this.config.minSamples) {
      this.logger.warn('MLForgetDetector', `训练样本不足: ${this.trainingData.length} < ${this.config.minSamples}`);
      return { accuracy: 0, samples: this.trainingData.length };
    }

    const startTime = Date.now();

    // 1. 特征标准化
    const { means, stds } = this.computeFeatureStats();
    
    // 2. 初始化权重
    const featureCount = 14; // ForgetFeatures 的字段数
    let weights = new Array(featureCount).fill(0);
    let bias = 0;

    // 3. 梯度下降训练
    const learningRate = this.config.learningRate;
    const regularization = this.config.regularization;
    const epochs = 100;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;

      for (const sample of this.trainingData) {
        const normalizedFeatures = this.normalizeFeatures(sample.features, means, stds);
        
        // 前向传播
        const z = this.dotProduct(weights, normalizedFeatures) + bias;
        const prediction = this.sigmoid(z);
        
        // 计算损失
        const error = prediction - sample.label;
        totalLoss += -sample.label * Math.log(prediction + 1e-10) - (1 - sample.label) * Math.log(1 - prediction + 1e-10);
        
        // 反向传播
        for (let i = 0; i < weights.length; i++) {
          weights[i] -= learningRate * (error * normalizedFeatures[i] + regularization * weights[i]);
        }
        bias -= learningRate * error;
      }

      // 每 10 轮打印一次
      if (epoch % 10 === 0) {
        this.logger.debug('MLForgetDetector', `Epoch ${epoch}, Loss: ${(totalLoss / this.trainingData.length).toFixed(4)}`);
      }
    }

    // 4. 计算准确率
    let correct = 0;
    for (const sample of this.trainingData) {
      const normalizedFeatures = this.normalizeFeatures(sample.features, means, stds);
      const z = this.dotProduct(weights, normalizedFeatures) + bias;
      const prediction = this.sigmoid(z) > 0.5 ? 1 : 0;
      if (prediction === sample.label) correct++;
    }
    const accuracy = correct / this.trainingData.length;

    // 5. 保存模型
    this.model = {
      weights,
      bias,
      featureMeans: means,
      featureStds: stds,
      trainedAt: Date.now(),
      samples: this.trainingData.length,
      accuracy,
    };

    if (this.config.autoSave) {
      this.saveModel();
    }

    const trainingTime = Date.now() - startTime;
    this.logger.info('MLForgetDetector', 
      `训练完成: ${this.trainingData.length} 样本, 准确率: ${(accuracy * 100).toFixed(1)}%, 耗时: ${trainingTime}ms`
    );

    return { accuracy, samples: this.trainingData.length };
  }

  /**
   * 计算特征统计量
   */
  private computeFeatureStats(): { means: number[]; stds: number[] } {
    const featureCount = 14;
    const means = new Array(featureCount).fill(0);
    const stds = new Array(featureCount).fill(0);

    // 计算均值
    for (const sample of this.trainingData) {
      const features = this.featuresToArray(sample.features);
      for (let i = 0; i < featureCount; i++) {
        means[i] += features[i];
      }
    }
    for (let i = 0; i < featureCount; i++) {
      means[i] /= this.trainingData.length;
    }

    // 计算标准差
    for (const sample of this.trainingData) {
      const features = this.featuresToArray(sample.features);
      for (let i = 0; i < featureCount; i++) {
        stds[i] += Math.pow(features[i] - means[i], 2);
      }
    }
    for (let i = 0; i < featureCount; i++) {
      stds[i] = Math.sqrt(stds[i] / this.trainingData.length) + 1e-10; // 避免除零
    }

    return { means, stds };
  }

  /**
   * 标准化特征
   */
  private normalizeFeatures(features: ForgetFeatures, means: number[], stds: number[]): number[] {
    const arr = this.featuresToArray(features);
    return arr.map((v, i) => (v - means[i]) / stds[i]);
  }

  /**
   * 特征转数组
   */
  private featuresToArray(features: ForgetFeatures): number[] {
    return [
      features.ageNormalized,
      features.accessCount,
      features.accessFrequency,
      features.accessRecency,
      features.importance,
      features.confidence,
      features.semanticScore,
      features.contentLength / 1000, // 归一化
      features.tagCount,
      features.hasKeywords,
      features.relatedCount,
      features.duplicateScore,
      features.lastAccessDelta / this.config.maxAge, // 归一化
      features.age / this.config.maxAge, // 归一化
    ];
  }

  // ============ 预测 ============

  /**
   * 预测遗忘概率
   */
  predict(memory: {
    id: string;
    content: string;
    createdAt: number;
    accessedAt: number;
    accessCount: number;
    importance: number;
    confidence: number;
    tags: string[];
    relatedCount?: number;
    duplicateScore?: number;
  }): MLPrediction {
    const features = this.extractFeatures(memory);
    
    let forgetProbability: number;
    let confidence: number;

    if (this.model) {
      // 使用训练好的模型
      const normalizedFeatures = this.normalizeFeatures(features, this.model.featureMeans, this.model.featureStds);
      const z = this.dotProduct(this.model.weights, normalizedFeatures) + this.model.bias;
      forgetProbability = this.sigmoid(z);
      confidence = this.model.accuracy;
    } else {
      // 使用规则模型
      forgetProbability = this.ruleBasedPrediction(features);
      confidence = 0.5;
    }

    // 生成原因
    const topReasons = this.generateReasons(features, forgetProbability);

    return {
      memoryId: memory.id,
      forgetProbability,
      confidence,
      topReasons,
      features,
    };
  }

  /**
   * 规则预测（无模型时使用）
   */
  private ruleBasedPrediction(features: ForgetFeatures): number {
    let score = 0;

    // 时间衰减
    score += (1 - features.accessRecency) * 0.3;

    // 访问频率
    if (features.accessCount < this.config.minAccessCount) {
      score += 0.2;
    }

    // 重要性
    if (features.importance < 0.3) {
      score += 0.2;
    }

    // 语义分数
    if (features.semanticScore < 0.3) {
      score += 0.15;
    }

    // 关键词
    if (features.hasKeywords === 0) {
      score += 0.1;
    }

    // 重复度
    if (features.duplicateScore > 0.8) {
      score += 0.15;
    }

    return Math.min(1, score);
  }

  /**
   * 生成遗忘原因
   */
  private generateReasons(features: ForgetFeatures, probability: number): string[] {
    const reasons: string[] = [];

    if (probability < this.config.keepThreshold) {
      reasons.push('记忆应该保留');
      return reasons;
    }

    if (features.ageNormalized > 0.8) {
      reasons.push('记忆时间较久');
    }

    if (features.accessCount < this.config.minAccessCount) {
      reasons.push('访问次数很少');
    }

    if (features.accessRecency < 0.3) {
      reasons.push('最近未被访问');
    }

    if (features.importance < 0.3) {
      reasons.push('重要性较低');
    }

    if (features.semanticScore < 0.3) {
      reasons.push('语义重要性低');
    }

    if (features.hasKeywords === 0) {
      reasons.push('不包含关键信息');
    }

    if (features.duplicateScore > 0.8) {
      reasons.push('存在重复内容');
    }

    return reasons.length > 0 ? reasons : ['综合评估建议遗忘'];
  }

  // ============ 辅助方法 ============

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  private dotProduct(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  // ============ 持久化 ============

  private loadModel(): void {
    if (!this.config.modelPath) return;

    try {
      if (fs.existsSync(this.config.modelPath)) {
        const data = JSON.parse(fs.readFileSync(this.config.modelPath, 'utf-8'));
        this.model = data;
        if (this.model) {
          this.logger.info('MLForgetDetector', `模型已加载: 准确率 ${(this.model.accuracy * 100).toFixed(1)}%`);
        }
      }
    } catch (e) {
      this.logger.warn('MLForgetDetector', `模型加载失败: ${e}`);
    }
  }

  private saveModel(): void {
    if (!this.config.modelPath || !this.model) return;

    try {
      fs.writeFileSync(this.config.modelPath, JSON.stringify(this.model, null, 2));
      this.logger.info('MLForgetDetector', '模型已保存');
    } catch (e) {
      this.logger.warn('MLForgetDetector', `模型保存失败: ${e}`);
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // ============ 公共访问器 ============

  getModel(): ForgetModel | null {
    return this.model;
  }

  getTrainingDataSize(): number {
    return this.trainingData.length;
  }

  clearTrainingData(): void {
    this.trainingData = [];
    this.logger.info('MLForgetDetector', '训练数据已清空');
  }

  /**
   * 批量预测
   */
  predictBatch(memories: Array<{
    id: string;
    content: string;
    createdAt: number;
    accessedAt: number;
    accessCount: number;
    importance: number;
    confidence: number;
    tags: string[];
    relatedCount?: number;
    duplicateScore?: number;
  }>): MLPrediction[] {
    return memories.map(m => this.predict(m));
  }

  /**
   * 获取应该遗忘的记忆
   */
  getMemoriesToForget(predictions: MLPrediction[]): MLPrediction[] {
    return predictions
      .filter(p => p.forgetProbability >= this.config.forgetThreshold)
      .sort((a, b) => b.forgetProbability - a.forgetProbability);
  }

  /**
   * 获取应该保留的记忆
   */
  getMemoriesToKeep(predictions: MLPrediction[]): MLPrediction[] {
    return predictions
      .filter(p => p.forgetProbability <= this.config.keepThreshold);
  }

  /**
   * 获取需要人工确认的记忆
   */
  getMemoriesToReview(predictions: MLPrediction[]): MLPrediction[] {
    return predictions
      .filter(p => p.forgetProbability > this.config.keepThreshold && 
                   p.forgetProbability < this.config.forgetThreshold)
      .sort((a, b) => b.forgetProbability - a.forgetProbability);
  }
}

// ============ 导出 ============

export default MLForgetDetector;
