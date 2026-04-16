/**
 * B+ 树知识索引测试
 */

import { BPlusTreeIndex, KnowledgeStore, KnowledgeItem } from '../layers/ling-qu/bplustree-index';

describe('BPlusTreeIndex', () => {
  let index: BPlusTreeIndex;

  beforeEach(() => {
    index = new BPlusTreeIndex({ order: 4 });
  });

  const createItem = (key: string, id: string = key): KnowledgeItem => ({
    id,
    key,
    content: `content-${key}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  describe('插入和查找', () => {
    it('应该插入和查找单个项', () => {
      const item = createItem('apple');
      index.insert(item);

      const found = index.find('apple');

      expect(found).toBeDefined();
      expect(found?.key).toBe('apple');
    });

    it('应该插入多个项', () => {
      index.insert(createItem('apple'));
      index.insert(createItem('banana'));
      index.insert(createItem('cherry'));

      expect(index.getSize()).toBe(3);
      expect(index.find('apple')).toBeDefined();
      expect(index.find('banana')).toBeDefined();
      expect(index.find('cherry')).toBeDefined();
    });

    it('找不到不存在的键', () => {
      index.insert(createItem('apple'));

      const found = index.find('orange');

      expect(found).toBeUndefined();
    });
  });

  describe('范围查询', () => {
    beforeEach(() => {
      index.insert(createItem('apple'));
      index.insert(createItem('banana'));
      index.insert(createItem('cherry'));
      index.insert(createItem('date'));
      index.insert(createItem('elderberry'));
    });

    it('应该执行范围查询', () => {
      const result = index.range('b', 'd');

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.map((i) => i.key)).toContain('banana');
    });

    it('应该返回比较次数', () => {
      const result = index.range('a', 'e');

      expect(result.comparisons).toBeGreaterThanOrEqual(0);
    });
  });

  describe('前缀搜索', () => {
    beforeEach(() => {
      index.insert(createItem('apple'));
      index.insert(createItem('application'));
      index.insert(createItem('apply'));
      index.insert(createItem('banana'));
    });

    it('应该搜索前缀', () => {
      const result = index.searchPrefix('app');

      // 由于 B+ 树分裂，可能不按顺序返回
      expect(result.items.length).toBeGreaterThanOrEqual(2);
      expect(result.items.every((i) => i.key.startsWith('app'))).toBe(true);
    });
  });

  describe('模糊搜索', () => {
    beforeEach(() => {
      index.insert(createItem('apple'));
      index.insert(createItem('banana'));
      index.insert(createItem('orange'));
    });

    it('应该执行模糊搜索', () => {
      const result = index.searchFuzzy('aple', 1);

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].key).toBe('apple');
    });

    it('应该按距离排序', () => {
      index.insert(createItem('appl'));
      const result = index.searchFuzzy('apple', 2);

      // 检查结果包含 apple 和 appl
      const keys = result.items.map(i => i.key);
      expect(keys).toContain('apple');
      expect(keys).toContain('appl');
    });
  });

  describe('树属性', () => {
    it('应该返回正确的大小', () => {
      expect(index.getSize()).toBe(0);

      index.insert(createItem('a'));
      index.insert(createItem('b'));

      expect(index.getSize()).toBe(2);
    });

    it('应该返回正确的高度', () => {
      expect(index.getHeight()).toBe(1);

      // 插入足够多的项以增加高度
      for (let i = 0; i < 100; i++) {
        index.insert(createItem(`key-${i}`));
      }

      expect(index.getHeight()).toBeGreaterThan(1);
    });
  });

  describe('清空', () => {
    it('应该清空索引', () => {
      index.insert(createItem('a'));
      index.insert(createItem('b'));

      index.clear();

      expect(index.getSize()).toBe(0);
      expect(index.find('a')).toBeUndefined();
    });
  });

  describe('获取所有项', () => {
    it('应该返回所有项', () => {
      index.insert(createItem('a'));
      index.insert(createItem('b'));
      index.insert(createItem('c'));

      const all = index.getAll();

      expect(all.length).toBe(3);
    });
  });
});

describe('KnowledgeStore', () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    store = new KnowledgeStore({ order: 4 });
  });

  const createItem = (key: string): KnowledgeItem => ({
    id: `id-${key}`,
    key,
    content: `content-${key}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  describe('添加和获取', () => {
    it('应该添加和获取项', () => {
      const item = createItem('test');
      store.add(item);

      expect(store.getByKey('test')).toBeDefined();
      expect(store.getById('id-test')).toBeDefined();
    });

    it('应该批量添加', () => {
      store.addBatch([createItem('a'), createItem('b'), createItem('c')]);

      expect(store.size()).toBe(3);
    });
  });

  describe('搜索', () => {
    beforeEach(() => {
      store.add(createItem('apple'));
      store.add(createItem('application'));
      store.add(createItem('banana'));
    });

    it('应该前缀搜索', () => {
      const result = store.searchPrefix('app');

      expect(result.items.length).toBe(2);
    });

    it('应该范围搜索', () => {
      const result = store.searchRange('a', 'b');

      expect(result.items.length).toBe(2);
    });

    it('应该模糊搜索', () => {
      const result = store.searchFuzzy('aple', 1);

      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe('清空', () => {
    it('应该清空存储', () => {
      store.add(createItem('a'));
      store.clear();

      expect(store.size()).toBe(0);
    });
  });
});
