/**
 * MemoryCenterV2 测试
 */

import { MemoryCenterV2 } from "../core";

describe('MemoryCenterV2', () => {
  let memory: MemoryCenterV2;

  beforeEach(async () => {
    memory = new MemoryCenterV2({ backendType: "memory" });
    await memory.initialize();
  });

  describe('初始化', () => {
    it('应该能成功初始化', async () => {
      const mem = new MemoryCenterV2({ backendType: "memory" });
      await mem.initialize();
      expect(mem).toBeDefined();
    });
  });

  describe('记忆操作', () => {
    it('应该能记住内容', async () => {
      const mem = await memory.remember("测试内容", { type: "episodic" });
      expect(mem).toBeDefined();
      expect(mem.id).toBeDefined();
      expect(mem.content).toBe("测试内容");
    });

    it('应该能回忆内容', async () => {
      await memory.remember("元灵系统测试", { type: "episodic" });
      const results = await memory.recall("元灵");
      expect(results).toBeDefined();
      expect(results.memories).toBeDefined();
    });

    it('应该能忘记内容', async () => {
      const mem = await memory.remember("待删除内容", { type: "episodic" });
      const result = await memory.forget(mem.id);
      expect(result).toBe(true);
    });
  });

  describe('统计功能', () => {
    it('应该能获取统计信息', async () => {
      await memory.remember("统计测试1", { type: "episodic" });
      await memory.remember("统计测试2", { type: "semantic" });
      
      const stats = await memory.getStats();
      expect(stats).toBeDefined();
    });
  });
});
