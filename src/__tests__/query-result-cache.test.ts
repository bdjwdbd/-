/**
 * 查询结果缓存测试
 */

import { QueryCache, VectorSearchCache, CachedSearchEngine } from '../infrastructure/query-result-cache';

describe('QueryCache', () => {
  let cache: QueryCache<string>;

  beforeEach(() => {
    cache = new QueryCache({ maxSize: 100, defaultTTL: 60000 });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('set and get', () => {
    it('应该能设置和获取缓存', () => {
      const query = new Float32Array([1, 2, 3, 4, 5]);
      
      cache.set(query, 5, 'test-data');
      const result = cache.get(query, 5);
      
      expect(result).toBe('test-data');
    });

    it('不存在的缓存应该返回 null', () => {
      const query = new Float32Array([1, 2, 3]);
      const result = cache.get(query, 5);
      
      expect(result).toBeNull();
    });

    it('相同的查询应该返回相同的缓存', () => {
      const query = new Float32Array([1, 2, 3, 4, 5]);
      
      cache.set(query, 5, 'data-1');
      cache.set(query, 5, 'data-2'); // 覆盖
      
      const result = cache.get(query, 5);
      expect(result).toBe('data-2');
    });
  });

  describe('TTL', () => {
    it('过期的缓存应该返回 null', (done) => {
      const cache = new QueryCache({ defaultTTL: 100 }); // 100ms
      const query = new Float32Array([1, 2, 3]);
      
      cache.set(query, 5, 'test');
      
      // 立即获取应该成功
      expect(cache.get(query, 5)).toBe('test');
      
      // 等待过期
      setTimeout(() => {
        expect(cache.get(query, 5)).toBeNull();
        done();
      }, 150);
    });
  });

  describe('LRU 淘汰', () => {
    it('超过最大条目数应该淘汰条目', () => {
      const cache = new QueryCache({ maxSize: 3 });
      
      const q1 = new Float32Array([1]);
      const q2 = new Float32Array([2]);
      const q3 = new Float32Array([3]);
      const q4 = new Float32Array([4]);
      
      cache.set(q1, 5, 'data-1');
      cache.set(q2, 5, 'data-2');
      cache.set(q3, 5, 'data-3');
      
      // 添加新条目，应该淘汰一个
      cache.set(q4, 5, 'data-4');
      
      // 验证缓存大小
      expect(cache.size).toBe(3);
      
      // 验证新条目存在
      expect(cache.get(q4, 5)).toBe('data-4');
    });
  });

  describe('delete', () => {
    it('应该能删除缓存', () => {
      const query = new Float32Array([1, 2, 3]);
      
      cache.set(query, 5, 'test');
      expect(cache.get(query, 5)).toBe('test');
      
      cache.delete(query, 5);
      expect(cache.get(query, 5)).toBeNull();
    });
  });

  describe('clear', () => {
    it('应该能清空缓存', () => {
      cache.set(new Float32Array([1]), 5, 'a');
      cache.set(new Float32Array([2]), 5, 'b');
      
      cache.clear();
      
      expect(cache.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('应该能获取统计信息', () => {
      const query = new Float32Array([1, 2, 3]);
      
      cache.set(query, 5, 'test');
      cache.get(query, 5); // hit
      cache.get(new Float32Array([9]), 5); // miss
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('cleanup', () => {
    it('应该能清理过期条目', () => {
      const cache = new QueryCache({ defaultTTL: 100 });
      
      cache.set(new Float32Array([1]), 5, 'a');
      
      // 等待过期
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cleaned = cache.cleanup();
          expect(cleaned).toBe(1);
          expect(cache.size).toBe(0);
          resolve();
        }, 150);
      });
    });
  });
});

describe('VectorSearchCache', () => {
  let cache: VectorSearchCache;

  beforeEach(() => {
    cache = new VectorSearchCache({ maxSize: 100 });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('getSearchResult and setSearchResult', () => {
    it('应该能缓存搜索结果', () => {
      const query = new Float32Array([1, 2, 3]);
      const results = [
        { id: '1', score: 0.9 },
        { id: '2', score: 0.8 },
      ];
      
      cache.setSearchResult(query, 5, results);
      const cached = cache.getSearchResult(query, 5);
      
      expect(cached).toEqual(results);
    });
  });
});

describe('CachedSearchEngine', () => {
  it('应该能缓存搜索结果', async () => {
    const mockEngine = {
      search: jest.fn().mockResolvedValue([
        { id: '1', score: 0.9 },
      ]),
    };

    const cachedEngine = new CachedSearchEngine(mockEngine, { maxSize: 100 });
    const query = new Float32Array([1, 2, 3]);

    // 第一次搜索
    const result1 = await cachedEngine.search(query, 5);
    expect(mockEngine.search).toHaveBeenCalledTimes(1);

    // 第二次搜索（应该命中缓存）
    const result2 = await cachedEngine.search(query, 5);
    expect(mockEngine.search).toHaveBeenCalledTimes(1); // 没有增加

    expect(result1).toEqual(result2);
  });

  it('应该能获取缓存统计', async () => {
    const mockEngine = {
      search: jest.fn().mockResolvedValue([{ id: '1', score: 0.9 }]),
    };

    const cachedEngine = new CachedSearchEngine(mockEngine);
    const query = new Float32Array([1, 2, 3]);

    await cachedEngine.search(query, 5);
    await cachedEngine.search(query, 5); // hit

    const stats = cachedEngine.getCacheStats();
    expect(stats.hits).toBe(1);
  });
});
