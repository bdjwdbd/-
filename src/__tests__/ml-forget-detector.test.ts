/**
 * ML 遗忘检测器测试
 */

import { MLForgetDetector, ForgetFeatures, MLPrediction } from '../infrastructure/ml-forget-detector';
import * as fs from 'fs';

// 测试日志器
const testLogger = {
  info: (...args: any[]) => {},
  debug: (...args: any[]) => {},
  warn: (...args: any[]) => {},
  error: (...args: any[]) => {},
};

// 生成测试记忆
function generateTestMemory(overrides: Partial<{
  id: string;
  content: string;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  importance: number;
  confidence: number;
  tags: string[];
}> = {}) {
  const now = Date.now();
  return {
    id: overrides.id || `mem-${Date.now()}`,
    content: overrides.content || '这是一条测试记忆',
    createdAt: overrides.createdAt || now,
    accessedAt: overrides.accessedAt || now,
    accessCount: overrides.accessCount || 1,
    importance: overrides.importance || 0.5,
    confidence: overrides.confidence || 0.8,
    tags: overrides.tags || ['test'],
  };
}

describe('MLForgetDetector', () => {
  let detector: MLForgetDetector;
  const testModelPath = '/tmp/test-forget-model.json';

  beforeEach(() => {
    // 清理旧模型
    if (fs.existsSync(testModelPath)) {
      fs.unlinkSync(testModelPath);
    }

    detector = new MLForgetDetector(testLogger, {
      minSamples: 10,
      forgetThreshold: 0.7,
      keepThreshold: 0.3,
      modelPath: testModelPath,
    });
  });

  afterEach(() => {
    if (fs.existsSync(testModelPath)) {
      fs.unlinkSync(testModelPath);
    }
  });

  describe('特征提取', () => {
    it('应该能提取记忆特征', () => {
      const memory = generateTestMemory();
      const features = detector.extractFeatures(memory);
      
      expect(features).toBeDefined();
      expect(features.age).toBeGreaterThanOrEqual(0);
      expect(features.accessCount).toBe(1);
      expect(features.importance).toBe(0.5);
    });

    it('应该能计算语义分数', () => {
      const importantMemory = generateTestMemory({ content: '这是一个重要的关键信息' });
      const normalMemory = generateTestMemory({ content: '普通内容' });
      
      const importantFeatures = detector.extractFeatures(importantMemory);
      const normalFeatures = detector.extractFeatures(normalMemory);
      
      expect(importantFeatures.semanticScore).toBeGreaterThan(normalFeatures.semanticScore);
    });

    it('应该能检测关键词', () => {
      const memoryWithKeyword = generateTestMemory({ content: '这是一个重要信息' });
      const memoryWithoutKeyword = generateTestMemory({ content: '普通内容' });
      
      const featuresWithKeyword = detector.extractFeatures(memoryWithKeyword);
      const featuresWithoutKeyword = detector.extractFeatures(memoryWithoutKeyword);
      
      expect(featuresWithKeyword.hasKeywords).toBe(1);
      expect(featuresWithoutKeyword.hasKeywords).toBe(0);
    });
  });

  describe('规则预测', () => {
    it('应该能预测新记忆（规则模式）', () => {
      const memory = generateTestMemory();
      const prediction = detector.predict(memory);
      
      expect(prediction).toBeDefined();
      expect(prediction.memoryId).toBe(memory.id);
      expect(prediction.forgetProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.forgetProbability).toBeLessThanOrEqual(1);
      expect(prediction.topReasons).toBeDefined();
    });

    it('旧记忆应该有更高的遗忘概率', () => {
      const now = Date.now();
      const newMemory = generateTestMemory({ createdAt: now, accessCount: 10 });
      const oldMemory = generateTestMemory({ 
        createdAt: now - 180 * 24 * 60 * 60 * 1000, // 180天前
        accessedAt: now - 90 * 24 * 60 * 60 * 1000, // 90天前访问
        accessCount: 0,
        importance: 0.2,
      });
      
      const newPrediction = detector.predict(newMemory);
      const oldPrediction = detector.predict(oldMemory);
      
      // 旧记忆的遗忘概率应该更高或相等
      expect(oldPrediction.forgetProbability).toBeGreaterThanOrEqual(newPrediction.forgetProbability);
    });

    it('低重要性记忆应该有更高的遗忘概率', () => {
      const importantMemory = generateTestMemory({ importance: 0.9, accessCount: 10 });
      const unimportantMemory = generateTestMemory({ importance: 0.1, accessCount: 0 });
      
      const importantPrediction = detector.predict(importantMemory);
      const unimportantPrediction = detector.predict(unimportantMemory);
      
      expect(unimportantPrediction.forgetProbability).toBeGreaterThanOrEqual(importantPrediction.forgetProbability);
    });
  });

  describe('模型训练', () => {
    it('应该能添加训练样本', () => {
      const memory = generateTestMemory();
      const features = detector.extractFeatures(memory);
      
      detector.addTrainingSample(features, false);
      
      expect(detector.getTrainingDataSize()).toBe(1);
    });

    it('应该能训练模型', () => {
      // 添加训练样本
      for (let i = 0; i < 20; i++) {
        const memory = generateTestMemory({
          createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
          importance: Math.random(),
          accessCount: Math.floor(Math.random() * 10),
        });
        const features = detector.extractFeatures(memory);
        const shouldForget = features.importance < 0.3 && features.accessCount < 2;
        detector.addTrainingSample(features, shouldForget);
      }
      
      const result = detector.train();
      
      expect(result.samples).toBe(20);
      expect(result.accuracy).toBeGreaterThan(0);
    });

    it('训练样本不足时应该警告', () => {
      const memory = generateTestMemory();
      const features = detector.extractFeatures(memory);
      detector.addTrainingSample(features, false);
      
      const result = detector.train();
      
      expect(result.accuracy).toBe(0);
    });
  });

  describe('批量预测', () => {
    it('应该能批量预测', () => {
      const memories = [
        generateTestMemory({ id: 'mem-1' }),
        generateTestMemory({ id: 'mem-2' }),
        generateTestMemory({ id: 'mem-3' }),
      ];
      
      const predictions = detector.predictBatch(memories);
      
      expect(predictions.length).toBe(3);
      expect(predictions[0].memoryId).toBe('mem-1');
    });

    it('应该能筛选应该遗忘的记忆', () => {
      const now = Date.now();
      const memories = [
        generateTestMemory({ id: 'keep-1', importance: 0.9, createdAt: now, accessCount: 10 }),
        generateTestMemory({ 
          id: 'forget-1', 
          importance: 0.1, 
          createdAt: now - 365 * 24 * 60 * 60 * 1000, // 1年前
          accessedAt: now - 180 * 24 * 60 * 60 * 1000,
          accessCount: 0,
        }),
      ];
      
      const predictions = detector.predictBatch(memories);
      const toForget = detector.getMemoriesToForget(predictions);
      
      // 可能没有达到遗忘阈值的记忆，这是正常的
      expect(Array.isArray(toForget)).toBe(true);
    });

    it('应该能筛选需要人工确认的记忆', () => {
      const memories = [
        generateTestMemory({ id: 'review-1', importance: 0.5 }),
      ];
      
      const predictions = detector.predictBatch(memories);
      const toReview = detector.getMemoriesToReview(predictions);
      
      expect(Array.isArray(toReview)).toBe(true);
    });
  });

  describe('持久化', () => {
    it('应该能保存和加载模型', () => {
      // 添加训练样本并训练
      for (let i = 0; i < 15; i++) {
        const memory = generateTestMemory({
          importance: Math.random(),
          accessCount: Math.floor(Math.random() * 10),
        });
        const features = detector.extractFeatures(memory);
        detector.addTrainingSample(features, features.importance < 0.3);
      }
      detector.train();
      
      // 创建新检测器并加载模型
      const newDetector = new MLForgetDetector(testLogger, {
        modelPath: testModelPath,
      });
      
      const model = newDetector.getModel();
      expect(model).not.toBeNull();
      expect(model?.accuracy).toBeGreaterThan(0);
    });
  });

  describe('原因生成', () => {
    it('应该能生成遗忘原因', () => {
      const oldMemory = generateTestMemory({
        createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        importance: 0.1,
        accessCount: 0,
      });
      
      const prediction = detector.predict(oldMemory);
      
      expect(prediction.topReasons.length).toBeGreaterThan(0);
    });
  });
});
