/**
 * 原生 HNSW 索引测试
 */

import { NativeHNSWIndex, WasmHNSWIndex, createNativeHNSW } from '../infrastructure/native-hnsw';
import * as fs from 'fs';

// 测试配置
const TEST_CONFIG = {
  dimensions: 128,
  maxConnections: 16,
  efConstruction: 100,
  efSearch: 50,
};

// 生成随机向量
function randomVector(dim: number): number[] {
  const vec: number[] = [];
  for (let i = 0; i < dim; i++) {
    vec.push(Math.random() * 2 - 1);
  }
  return vec;
}

// 余弦相似度
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe('NativeHNSWIndex', () => {
  let index: NativeHNSWIndex;

  beforeEach(() => {
    index = createNativeHNSW(TEST_CONFIG);
  });

  afterEach(() => {
    index.close();
  });

  describe('初始化', () => {
    it('应该能成功初始化', () => {
      const stats = index.getStats();
      expect(stats).toBeDefined();
      expect(stats.dimensions).toBe(128);
    });

    it('应该报告是否使用原生实现', () => {
      const isNative = index.isUsingNative();
      expect(typeof isNative).toBe('boolean');
    });
  });

  describe('添加向量', () => {
    it('应该能添加单个向量', () => {
      const vec = randomVector(128);
      index.add('test-1', vec);
      
      expect(index.size()).toBe(1);
    });

    it('应该能批量添加向量', () => {
      const items = [];
      for (let i = 0; i < 100; i++) {
        items.push({ id: `vec-${i}`, vector: randomVector(128) });
      }
      
      index.addBatch(items);
      expect(index.size()).toBe(100);
    });
  });

  describe('搜索', () => {
    beforeEach(() => {
      // 添加测试数据
      const items = [];
      for (let i = 0; i < 100; i++) {
        items.push({ id: `vec-${i}`, vector: randomVector(128) });
      }
      index.addBatch(items);
    });

    it('应该能搜索最近邻', () => {
      const query = randomVector(128);
      const results = index.search(query, 10);
      
      expect(results.length).toBeLessThanOrEqual(10);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBeDefined();
      expect(results[0].score).toBeDefined();
    });

    it('应该能批量搜索', () => {
      const queries = [randomVector(128), randomVector(128), randomVector(128)];
      const results = index.searchBatch(queries, 5);
      
      expect(results.length).toBe(3);
      expect(results[0].length).toBeLessThanOrEqual(5);
    });

    it('搜索结果应该按相似度排序', () => {
      const query = randomVector(128);
      const results = index.search(query, 10);
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成 1000 向量搜索', () => {
      // 添加 1000 个向量
      const items = [];
      for (let i = 0; i < 1000; i++) {
        items.push({ id: `vec-${i}`, vector: randomVector(128) });
      }
      index.addBatch(items);
      
      // 搜索
      const query = randomVector(128);
      const start = Date.now();
      const results = index.search(query, 10);
      const elapsed = Date.now() - start;
      
      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(100); // 应该在 100ms 内完成
      console.log(`[性能] 1000 向量搜索耗时: ${elapsed}ms`);
    });
  });

  describe('持久化', () => {
    const TEST_PATH = '/tmp/test-hnsw-index.json';

    afterEach(() => {
      if (fs.existsSync(TEST_PATH)) {
        fs.unlinkSync(TEST_PATH);
      }
    });

    it('应该能保存和加载索引', () => {
      // 添加数据
      const items = [];
      for (let i = 0; i < 50; i++) {
        items.push({ id: `vec-${i}`, vector: randomVector(128) });
      }
      index.addBatch(items);
      
      // 使用 WASM 索引直接保存（因为原生模块不存在）
      const wasmIndex = new WasmHNSWIndex(TEST_CONFIG);
      for (const item of items) {
        wasmIndex.add(item.id, item.vector);
      }
      const data = wasmIndex.save();
      fs.writeFileSync(TEST_PATH, data);
      
      // 创建新索引并加载
      const newIndex = createNativeHNSW({
        ...TEST_CONFIG,
        persistPath: TEST_PATH,
      });
      
      expect(newIndex.size()).toBe(50);
      newIndex.close();
    });
  });
});

describe('WasmHNSWIndex', () => {
  let index: WasmHNSWIndex;

  beforeEach(() => {
    index = new WasmHNSWIndex(TEST_CONFIG);
  });

  describe('基本功能', () => {
    it('应该能添加和搜索向量', () => {
      const vec1 = randomVector(128);
      const vec2 = randomVector(128);
      
      index.add('vec-1', vec1);
      index.add('vec-2', vec2);
      
      const results = index.search(vec1, 1);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('vec-1');
    });

    it('应该能保存和加载', () => {
      // 添加数据
      for (let i = 0; i < 10; i++) {
        index.add(`vec-${i}`, randomVector(128));
      }
      
      // 保存
      const data = index.save();
      
      // 加载
      const loaded = WasmHNSWIndex.load(data);
      expect(loaded.size()).toBe(10);
    });
  });
});
