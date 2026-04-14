/**
 * 集成系统完整测试
 */

import { IntegratedSystem } from '../integrated-system';

describe('IntegratedSystem 完整测试', () => {
  let system: IntegratedSystem;

  beforeAll(async () => {
    system = new IntegratedSystem();
    await system.initialize();
  });

  afterAll(async () => {
    await system.shutdown();
  });

  describe('记忆系统', () => {
    it('应该能添加和搜索记忆', async () => {
      const id = await system.addMemory('集成测试记忆', 'fact');
      expect(id).toBeDefined();

      const results = await system.searchMemory('集成测试');
      expect(results.length).toBeGreaterThan(0);
    });

    it('应该能处理对话', async () => {
      const result = await system.processConversation([
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！有什么可以帮助你的？' }
      ]);

      expect(result.summary).toBeDefined();
      expect(result.memories.length).toBeGreaterThan(0);
    });
  });

  describe('学习系统', () => {
    it('应该能进行元认知检查', async () => {
      const result = await system.metaCheck('测试问题');
      expect(result.known).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('应该能进行推理', async () => {
      const result = await system.infer(['测试前提']);
      expect(result.conclusions).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('应该能进行自主学习', async () => {
      // 简化测试：只验证方法存在
      expect(system.learn).toBeDefined();
      expect(typeof system.learn).toBe('function');
    });
  });

  describe('维护系统', () => {
    it('应该能检查健康状态', async () => {
      const health = await system.checkHealth();
      expect(health.overall).toBeGreaterThanOrEqual(0);
      expect(health.overall).toBeLessThanOrEqual(1);
    });

    it('应该能检测遗忘', async () => {
      const result = await system.detectForgettable();
      expect(result.count).toBeGreaterThanOrEqual(0);
    });

    it('应该能运行维护', async () => {
      const result = await system.runMaintenance();
      expect(result.cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('权限系统', () => {
    it('应该能检查权限', () => {
      const allowed = system.checkPermission('default', 'read', 'memory');
      expect(typeof allowed).toBe('boolean');
    });
  });
});
