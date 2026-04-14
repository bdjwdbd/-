/**
 * 元灵系统核心测试
 */

import { YuanLingSystem } from '../yuanling-system';
import { IntegratedSystem } from '../integrated-system';

describe('YuanLingSystem', () => {
  let system: YuanLingSystem;

  beforeAll(async () => {
    system = new YuanLingSystem({
      enableIntrospection: false,
      enableL0: false
    });
    await system.startup();
  });

  afterAll(async () => {
    await system.shutdown();
  });

  describe('记忆系统', () => {
    it('应该能添加记忆', async () => {
      const id = await system.addMemory('测试记忆内容', 'fact');
      expect(id).toBeDefined();
      expect(id).toMatch(/^mem_/);
    });

    it('应该能搜索记忆', async () => {
      await system.addMemory('搜索测试内容', 'fact');
      const results = await system.searchMemory('搜索');
      expect(results.length).toBeGreaterThan(0);
    });

    it('应该能获取记忆', async () => {
      const id = await system.addMemory('获取测试', 'fact');
      const memory = await system.getMemory(id);
      expect(memory).toBeDefined();
      expect(memory.content).toBe('获取测试');
    });

    it('应该能删除记忆', async () => {
      const id = await system.addMemory('删除测试', 'fact');
      const deleted = await system.deleteMemory(id);
      expect(deleted).toBe(true);
    });
  });

  describe('学习系统', () => {
    it('应该能进行元认知检查', async () => {
      const result = await system.metaCheck('测试问题');
      expect(result).toHaveProperty('known');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('gaps');
    });

    it('应该能进行推理', async () => {
      const result = await system.infer(['所有测试都应该通过']);
      expect(result).toHaveProperty('conclusions');
      expect(result).toHaveProperty('confidence');
    });
  });

  describe('健康检查', () => {
    it('应该能检查系统健康', async () => {
      const health = await system.checkHealth();
      expect(health).toHaveProperty('memory');
      expect(health).toHaveProperty('vector');
      expect(health).toHaveProperty('learning');
      expect(health).toHaveProperty('overall');
      expect(health.overall).toBeGreaterThanOrEqual(0);
      expect(health.overall).toBeLessThanOrEqual(1);
    });
  });

  describe('系统状态', () => {
    it('应该能获取系统状态', () => {
      const status = system.getStatus();
      expect(status).toHaveProperty('health');
      expect(status).toHaveProperty('toolCount');
      expect(status).toHaveProperty('l0Enabled');
    });

    it('应该能获取补偿统计', () => {
      const stats = system.getCompensationStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('active');
    });
  });
});

describe('IntegratedSystem', () => {
  let integrated: IntegratedSystem;

  beforeAll(async () => {
    integrated = new IntegratedSystem();
    await integrated.initialize();
  });

  afterAll(async () => {
    await integrated.shutdown();
  });

  describe('记忆操作', () => {
    it('应该能添加和搜索记忆', async () => {
      const id = await integrated.addMemory('集成测试', 'fact');
      expect(id).toBeDefined();

      const results = await integrated.searchMemory('集成');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('对话处理', () => {
    it('应该能处理对话', async () => {
      const result = await integrated.processConversation([
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！有什么可以帮助你的？' }
      ]);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('keyPoints');
      expect(result).toHaveProperty('memories');
    });
  });

  describe('权限检查', () => {
    it('应该能检查权限', () => {
      const allowed = integrated.checkPermission('default', 'read', 'memory');
      expect(typeof allowed).toBe('boolean');
    });
  });
});
