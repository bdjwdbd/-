/**
 * 语义压缩器测试
 */

import { SemanticCompressor, CompressibleMemory } from '../infrastructure/semantic-compressor';
import * as fs from 'fs';

// 测试日志器
const testLogger = {
  info: (...args: any[]) => {},
  debug: (...args: any[]) => {},
  warn: (...args: any[]) => {},
  error: (...args: any[]) => {},
};

// 生成测试记忆
function generateTestMemory(id: string, content: string, options?: Partial<CompressibleMemory>): CompressibleMemory {
  return {
    id,
    content,
    type: 'fact',
    tags: ['test'],
    importance: 0.5,
    createdAt: Date.now(),
    accessedAt: Date.now(),
    accessCount: 1,
    ...options,
  };
}

describe('SemanticCompressor', () => {
  let compressor: SemanticCompressor;
  const testDataPath = '/tmp/test-compressed';

  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDataPath)) {
      fs.rmSync(testDataPath, { recursive: true });
    }

    compressor = new SemanticCompressor(testLogger, {
      similarityThreshold: 0.5,
      minClusterSize: 2,
      maxClusterSize: 10,
    }, testDataPath);
  });

  afterEach(() => {
    compressor.close();
  });

  describe('压缩功能', () => {
    it('应该能压缩空记忆列表', async () => {
      const result = await compressor.compress([]);
      
      expect(result.compressed).toEqual([]);
      expect(result.stats.originalCount).toBe(0);
      expect(result.stats.compressedCount).toBe(0);
    });

    it('应该能压缩单个记忆', async () => {
      const memories = [
        generateTestMemory('mem-1', '这是一条测试记忆'),
      ];

      const result = await compressor.compress(memories);
      
      expect(result.compressed.length).toBe(1);
      expect(result.compressed[0].memberCount).toBe(1);
      expect(result.compressed[0].summary).toContain('测试记忆');
    });

    it('应该能压缩相似记忆', async () => {
      const memories = [
        generateTestMemory('mem-1', '元灵系统是一个多Agent协作框架'),
        generateTestMemory('mem-2', '元灵系统支持六层架构'),
        generateTestMemory('mem-3', '元灵系统使用TypeScript开发'),
      ];

      const result = await compressor.compress(memories);
      
      expect(result.compressed.length).toBeGreaterThan(0);
      expect(result.stats.compressionRatio).toBeGreaterThanOrEqual(0);
    });

    it('应该能处理大量记忆', async () => {
      const memories: CompressibleMemory[] = [];
      for (let i = 0; i < 100; i++) {
        memories.push(generateTestMemory(`mem-${i}`, `测试记忆内容 ${i}，包含一些随机文本`));
      }

      const result = await compressor.compress(memories);
      
      expect(result.compressed.length).toBeGreaterThan(0);
      expect(result.stats.processingTime).toBeLessThan(10000); // 10秒内完成
    });
  });

  describe('分层管理', () => {
    it('应该能正确分层热数据', async () => {
      const memories = [
        generateTestMemory('mem-1', '热数据记忆', { createdAt: Date.now() }),
      ];

      const result = await compressor.compress(memories);
      
      expect(result.compressed[0].tier).toBe('hot');
    });

    it('应该能正确分层冷数据', async () => {
      const coldDate = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60天前
      const memories = [
        generateTestMemory('mem-1', '冷数据记忆', { createdAt: coldDate }),
      ];

      const result = await compressor.compress(memories);
      
      expect(result.compressed[0].tier).toBe('cold');
    });
  });

  describe('搜索功能', () => {
    beforeEach(async () => {
      const memories = [
        generateTestMemory('mem-1', '元灵系统架构设计'),
        generateTestMemory('mem-2', '向量搜索技术'),
        generateTestMemory('mem-3', '记忆存储优化'),
      ];
      await compressor.compress(memories);
    });

    it('应该能搜索压缩记忆', () => {
      const results = compressor.search('元灵系统');
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('应该能限制搜索结果数量', () => {
      const results = compressor.search('记忆', { limit: 1 });
      
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('统计功能', () => {
    it('应该能获取统计信息', async () => {
      const memories = [
        generateTestMemory('mem-1', '测试记忆1'),
        generateTestMemory('mem-2', '测试记忆2'),
      ];
      await compressor.compress(memories);

      const stats = compressor.getStats();
      
      expect(stats.totalCompressed).toBeGreaterThan(0);
      expect(stats.byTier).toBeDefined();
      expect(stats.avgClusterSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('关键词提取', () => {
    it('应该能提取关键词', async () => {
      const memories = [
        generateTestMemory('mem-1', '元灵系统是一个强大的多Agent协作框架，支持六层架构'),
      ];

      const result = await compressor.compress(memories);
      
      expect(result.compressed[0].keywords.length).toBeGreaterThan(0);
    });
  });
});
