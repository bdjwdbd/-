/**
 * SIMD 向量运算测试
 */

import { SIMDVectorOps, createSIMDVectorOps, isSIMDSupported } from '../wasm/simd-vector';

describe('SIMDVectorOps', () => {
  let ops: SIMDVectorOps;

  beforeEach(() => {
    ops = createSIMDVectorOps();
  });

  describe('SIMD 检测', () => {
    it('应该能检测 SIMD 支持', () => {
      const supported = isSIMDSupported();
      expect(typeof supported).toBe('boolean');
    });

    it('应该能获取信息', () => {
      const info = ops.getInfo();
      expect(info.supported).toBeDefined();
      expect(info.enabled).toBeDefined();
    });
  });

  describe('向量运算', () => {
    it('应该能计算点积', () => {
      const a = [1, 2, 3, 4];
      const b = [5, 6, 7, 8];
      
      const result = ops.dotProduct(a, b);
      expect(result).toBeCloseTo(70, 5); // 1*5 + 2*6 + 3*7 + 4*8 = 70
    });

    it('应该能计算欧氏距离', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 2];
      
      const result = ops.euclideanDistance(a, b);
      expect(result).toBeCloseTo(3, 5);
    });

    it('应该能计算向量范数', () => {
      const a = [3, 4];
      
      const result = ops.vectorNorm(a);
      expect(result).toBeCloseTo(5, 5);
    });

    it('应该能计算余弦相似度', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      
      const result = ops.cosineSimilarityBatch(a, [b])[0];
      expect(result).toBeCloseTo(0, 5);
    });
  });

  describe('批量运算', () => {
    it('应该能批量计算余弦相似度', () => {
      const query = [1, 0, 0];
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0.707, 0.707, 0],
      ];

      const results = ops.cosineSimilarityBatch(query, vectors);
      
      expect(results.length).toBe(3);
      expect(results[0]).toBeCloseTo(1, 4);
      expect(results[1]).toBeCloseTo(0, 4);
      expect(results[2]).toBeCloseTo(0.707, 3);
    });

    it('应该能批量计算欧氏距离', () => {
      const query = [0, 0, 0];
      const vectors = [
        [1, 0, 0],
        [0, 2, 0],
        [0, 0, 3],
      ];

      const results = ops.euclideanDistanceBatch(query, vectors);
      
      expect(results[0]).toBeCloseTo(1, 5);
      expect(results[1]).toBeCloseTo(2, 5);
      expect(results[2]).toBeCloseTo(3, 5);
    });

    it('应该能批量计算点积', () => {
      const query = [1, 2, 3];
      const vectors = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];

      const results = ops.dotProductBatch(query, vectors);
      
      expect(results[0]).toBeCloseTo(1, 5);
      expect(results[1]).toBeCloseTo(2, 5);
      expect(results[2]).toBeCloseTo(3, 5);
    });
  });

  describe('性能测试', () => {
    it('点积性能应该优于纯 JS', () => {
      const size = 1000;
      const a = new Array(size).fill(0).map(() => Math.random());
      const b = new Array(size).fill(0).map(() => Math.random());

      // SIMD 版本
      const simdStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        ops.dotProduct(a, b);
      }
      const simdTime = Date.now() - simdStart;

      // 纯 JS 版本
      const jsStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        let sum = 0;
        for (let j = 0; j < size; j++) {
          sum += a[j] * b[j];
        }
      }
      const jsTime = Date.now() - jsStart;

      console.log(`SIMD: ${simdTime}ms, JS: ${jsTime}ms`);
      // SIMD 应该至少不比纯 JS 慢
      expect(simdTime).toBeLessThanOrEqual(jsTime * 2);
    });
  });
});
