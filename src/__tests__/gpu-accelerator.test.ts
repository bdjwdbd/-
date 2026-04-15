/**
 * GPU 加速器测试
 */

import { GPUAccelerator, createGPUAccelerator } from '../infrastructure/gpu-accelerator';

describe('GPUAccelerator', () => {
  let accelerator: GPUAccelerator;

  beforeEach(() => {
    accelerator = createGPUAccelerator({ mode: 'cpu' });
  });

  afterEach(() => {
    accelerator.destroy();
  });

  describe('初始化', () => {
    it('应该能成功初始化', () => {
      expect(accelerator).toBeDefined();
    });

    it('应该能获取信息', () => {
      const info = accelerator.getInfo();
      expect(info.mode).toBeDefined();
      expect(info.chunking).toBeDefined();
    });
  });

  describe('向量运算', () => {
    it('应该能计算余弦相似度', () => {
      const query = [1, 0, 0];
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const results = accelerator.cosineSimilarityBatch(query, vectors);
      
      expect(results[0]).toBeCloseTo(1, 5); // 相同向量
      expect(results[1]).toBeCloseTo(0, 5); // 正交向量
      expect(results[2]).toBeCloseTo(0, 5); // 正交向量
    });

    it('应该能计算欧氏距离', () => {
      const query = [0, 0, 0];
      const vectors = [
        [1, 0, 0],
        [0, 2, 0],
        [0, 0, 3],
      ];

      const results = accelerator.euclideanDistanceBatch(query, vectors);
      
      expect(results[0]).toBeCloseTo(1, 5);
      expect(results[1]).toBeCloseTo(2, 5);
      expect(results[2]).toBeCloseTo(3, 5);
    });

    it('应该能计算点积', () => {
      const query = [1, 2, 3];
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const results = accelerator.dotProductBatch(query, vectors);
      
      expect(results[0]).toBeCloseTo(1, 5);
      expect(results[1]).toBeCloseTo(2, 5);
      expect(results[2]).toBeCloseTo(3, 5);
    });
  });

  describe('搜索功能', () => {
    it('应该能搜索 Top-K', () => {
      const query = [1, 0, 0];
      const vectors = [
        [0.9, 0.1, 0],
        [0.1, 0.9, 0],
        [0.5, 0.5, 0],
      ];

      const results = accelerator.search(query, vectors, 2);
      
      expect(results.length).toBe(2);
      expect(results[0].index).toBe(0); // 最相似
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  describe('分块计算', () => {
    it('应该能处理大规模向量', () => {
      const size = 10000;
      const query = new Array(size).fill(0).map(() => Math.random());
      const vectors = [];
      
      for (let i = 0; i < 100; i++) {
        vectors.push(new Array(size).fill(0).map(() => Math.random()));
      }

      const results = accelerator.cosineSimilarityBatch(query, vectors);
      
      expect(results.length).toBe(100);
      results.forEach(r => {
        expect(r).toBeGreaterThanOrEqual(-1);
        expect(r).toBeLessThanOrEqual(1);
      });
    });
  });
});
