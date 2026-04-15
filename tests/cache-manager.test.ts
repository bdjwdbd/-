/**
 * @file cache-manager.test.ts
 * @brief 缓存管理测试
 */

import { CacheManager } from '../src/infrastructure/cache-manager';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ maxSize: 100 });
  });

  test('应该正确初始化', () => {
    expect(cache).toBeDefined();
  });

  test('应该能设置和获取缓存', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('应该能删除缓存', () => {
    cache.set('key1', 'value1');
    cache.delete('key1');
    expect(cache.get('key1')).toBeUndefined();
  });

  test('应该能清空缓存', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
