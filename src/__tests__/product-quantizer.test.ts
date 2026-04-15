/**
 * 产品量化器测试
 */

import { ProductQuantizer, createProductQuantizer, quickQuantize } from '../infrastructure/product-quantizer';

describe('ProductQuantizer', () => {
  const dim = 128;
  const M = 8;
  const K = 256;
  const numVectors = 100;

  // 生成测试向量
  const generateVectors = (count: number, dimension: number): Float32Array[] => {
    return Array.from({ length: count }, () => {
      const v = new Float32Array(dimension);
      for (let i = 0; i < dimension; i++) {
        v[i] = Math.random() * 2 - 1; // [-1, 1]
      }
      return v;
    });
  };

  let quantizer: ProductQuantizer;
  let vectors: Float32Array[];

  beforeEach(() => {
    quantizer = new ProductQuantizer({ M, K, dim });
    vectors = generateVectors(numVectors, dim);
  });

  describe('constructor', () => {
    it('应该能创建量化器', () => {
      expect(quantizer).toBeDefined();
    });

    it('维度不能被子向量数整除时应该抛出错误', () => {
      expect(() => new ProductQuantizer({ M: 7, dim: 128 })).toThrow();
    });
  });

  describe('train', () => {
    it('应该能训练码本', () => {
      quantizer.train(vectors);
      
      // 训练后应该有 M 个码本
      const stats = quantizer.getStats();
      expect(stats.numVectors).toBe(0); // 还没添加向量
    });
  });

  describe('quantize', () => {
    it('训练前应该抛出错误', () => {
      const v = new Float32Array(dim);
      expect(() => quantizer.quantize(v)).toThrow('量化器未训练');
    });

    it('训练后应该能量化向量', () => {
      quantizer.train(vectors);
      
      const codes = quantizer.quantize(vectors[0]);
      
      expect(codes).toBeInstanceOf(Uint8Array);
      expect(codes.length).toBe(M);
    });

    it('量化编码应该在有效范围内', () => {
      quantizer.train(vectors);
      
      const codes = quantizer.quantize(vectors[0]);
      
      for (let i = 0; i < codes.length; i++) {
        expect(codes[i]).toBeLessThan(K);
      }
    });
  });

  describe('add', () => {
    it('应该能添加向量', () => {
      quantizer.train(vectors);
      
      quantizer.add('test-1', vectors[0]);
      
      const stats = quantizer.getStats();
      expect(stats.numVectors).toBe(1);
    });

    it('维度不匹配时应该抛出错误', () => {
      quantizer.train(vectors);
      
      const wrongDim = new Float32Array(64);
      expect(() => quantizer.add('test', wrongDim)).toThrow('向量维度不匹配');
    });
  });

  describe('search', () => {
    it('应该能搜索最近邻', () => {
      quantizer.train(vectors);
      
      // 添加向量
      for (let i = 0; i < vectors.length; i++) {
        quantizer.add(`vec-${i}`, vectors[i]);
      }
      
      // 搜索
      const query = vectors[0];
      const results = quantizer.search(query, 5);
      
      expect(results.length).toBe(5);
      expect(results[0].id).toBe('vec-0'); // 应该找到自己
    });
  });

  describe('getStats', () => {
    it('应该能获取统计信息', () => {
      quantizer.train(vectors);
      
      for (let i = 0; i < 10; i++) {
        quantizer.add(`vec-${i}`, vectors[i]);
      }
      
      const stats = quantizer.getStats();
      
      expect(stats.numVectors).toBe(10);
      expect(stats.compressionRatio).toBeGreaterThan(1);
    });
  });

  describe('reconstruct', () => {
    it('应该能重构向量', () => {
      quantizer.train(vectors);
      
      const original = vectors[0];
      const codes = quantizer.quantize(original);
      const reconstructed = quantizer.reconstruct(codes);
      
      expect(reconstructed.length).toBe(dim);
      
      // 重构向量应该与原向量接近（但不完全相同）
      let sumSqDiff = 0;
      for (let i = 0; i < dim; i++) {
        const diff = original[i] - reconstructed[i];
        sumSqDiff += diff * diff;
      }
      const rmse = Math.sqrt(sumSqDiff / dim);
      expect(rmse).toBeLessThan(1); // 误差应该小于 1
    });
  });

  describe('serialize/deserialize', () => {
    it('应该能序列化和反序列化', () => {
      quantizer.train(vectors);
      
      for (let i = 0; i < 10; i++) {
        quantizer.add(`vec-${i}`, vectors[i]);
      }
      
      const buffer = quantizer.serialize();
      
      const newQuantizer = new ProductQuantizer({ M, K, dim });
      newQuantizer.deserialize(buffer);
      
      const stats = newQuantizer.getStats();
      expect(stats.numVectors).toBe(10);
    });
  });
});

describe('createProductQuantizer', () => {
  it('应该能创建量化器', () => {
    const pq = createProductQuantizer({ M: 4, dim: 64 });
    expect(pq).toBeDefined();
  });
});

describe('quickQuantize', () => {
  it('应该能快速量化', () => {
    const vectors: Float32Array[] = [];
    for (let i = 0; i < 50; i++) {
      const v = new Float32Array(64);
      for (let j = 0; j < 64; j++) {
        v[j] = Math.random();
      }
      vectors.push(v);
    }
    
    const { quantizer, codes } = quickQuantize(vectors, { M: 4, dim: 64 });
    
    expect(quantizer).toBeDefined();
    expect(codes.length).toBe(50);
    expect(codes[0].length).toBe(4);
  });
});
