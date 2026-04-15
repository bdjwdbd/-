/**
 * 向量搜索缓存测试
 */

import { VectorSearchCache, createVectorCache, LRUCache } from '../infrastructure/vector-cache';

describe('LRUCache', () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache({ maxSize: 3, ttl: 60000 });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('基本操作', () => {
    it('应该能设置和获取缓存', () => {
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);
    });

    it('应该能检查是否存在', () => {
      cache.set('a', 1);
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });

    it('应该能删除缓存', () => {
      cache.set('a', 1);
      cache.delete('a');
      expect(cache.has('a')).toBe(false);
    });

    it('应该能清空缓存', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe('LRU 淘汰', () => {
    it('应该在容量满时淘汰最旧的条目', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // 应该淘汰 'a'

      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(true);
      expect(cache.has('d')).toBe(true);
    });

    it('应该在访问时更新顺序', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      
      cache.get('a'); // 访问 'a'，使其变为最新
      
      cache.set('d', 4); // 应该淘汰 'b' 而不是 'a'

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });
  });

  describe('统计信息', () => {
    it('应该能获取统计信息', () => {
      cache.set('a', 1);
      cache.get('a'); // 命中
      cache.get('b'); // 未命中

      const stats = cache.getStats();
      
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5, 2);
    });
  });
});

describe('VectorSearchCache', () => {
  let cache: VectorSearchCache;

  beforeEach(() => {
    cache = createVectorCache({ maxSize: 10, ttl: 60000 });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('搜索结果缓存', () => {
    it('应该能缓存搜索结果', () => {
      const query = [1, 2, 3];
      const result = [0.1, 0.2, 0.3];

      cache.setSearchResult(query, 'cosine', result);
      const cached = cache.getSearchResult(query, 'cosine');

      expect(cached).toEqual(result);
    });

    it('应该能缓存查询范数', () => {
      const query = [3, 4];
      const norm = 5;

      cache.setQueryNorm(query, norm);
      
      // 相同前缀的查询应该命中
      const cached = cache.getQueryNorm(query);
      expect(cached).toBe(norm);
    });
  });

  describe('统计信息', () => {
    it('应该能获取统计信息', () => {
      const query = [1, 2, 3];
      
      cache.setSearchResult(query, 'cosine', [0.1]);
      cache.getSearchResult(query, 'cosine'); // 命中
      cache.getSearchResult([4, 5, 6], 'cosine'); // 未命中

      const stats = cache.getStats();
      
      expect(stats.search.hits).toBe(1);
      expect(stats.search.misses).toBe(1);
    });
  });

  describe('清理功能', () => {
    it('应该能清理过期条目', () => {
      const shortCache = createVectorCache({ maxSize: 10, ttl: 100 });
      
      shortCache.setSearchResult([1, 2, 3], 'cosine', [0.1]);
      
      // 等待过期
      return new Promise<void>(resolve => {
        setTimeout(() => {
          const result = shortCache.getSearchResult([1, 2, 3], 'cosine');
          expect(result).toBeUndefined();
          resolve();
        }, 150);
      });
    });
  });
});
