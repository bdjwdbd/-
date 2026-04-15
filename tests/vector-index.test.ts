/**
 * @file vector-index.test.ts
 * @brief 向量索引测试
 */

import { VectorIndex } from '../src/infrastructure/vector-index';

describe('VectorIndex', () => {
  let index: VectorIndex;

  beforeEach(() => {
    index = new VectorIndex({ dimensions: 128 });
  });

  test('应该正确初始化', () => {
    expect(index).toBeDefined();
  });

  test('应该能添加向量', () => {
    const vector = new Float32Array(128).fill(0.1);
    index.add('test-1', vector);
    expect(index.size()).toBe(1);
  });

  test('应该能搜索最近邻', () => {
    const vector = new Float32Array(128).fill(0.1);
    index.add('test-1', vector);
    const results = index.search(vector, 1);
    expect(results.length).toBe(1);
  });
});
