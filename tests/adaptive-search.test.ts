/**
 * @file adaptive-search.test.ts
 * @brief 自适应搜索测试
 */

import { AdaptiveSearchEngine } from '../src/infrastructure/adaptive-search';

describe('AdaptiveSearchEngine', () => {
  let engine: AdaptiveSearchEngine;

  beforeEach(() => {
    engine = new AdaptiveSearchEngine({ dimensions: 128 });
  });

  test('应该正确初始化', () => {
    expect(engine).toBeDefined();
  });

  test('应该能添加向量', () => {
    const vector = new Float32Array(128).fill(0.1);
    engine.add('test-1', vector);
    expect(engine.size()).toBe(1);
  });

  test('应该能搜索向量', () => {
    const vector = new Float32Array(128).fill(0.1);
    engine.add('test-1', vector);
    const results = engine.search(vector, 1);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('test-1');
  });

  test('应该能删除向量', () => {
    const vector = new Float32Array(128).fill(0.1);
    engine.add('test-1', vector);
    engine.remove('test-1');
    expect(engine.size()).toBe(0);
  });
});
