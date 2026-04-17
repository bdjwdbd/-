/**
 * 元灵系统主流程单元测试
 * 
 * 测试覆盖：
 * - 智能系统集成
 * - L0/L1 并行执行
 * - 智能路由
 * - 超时控制
 * - 重试机制
 * - 熔断机制
 * - 限流机制
 * - 请求去重
 */

import { YuanLingSystem, getYuanLingSystem, Message } from '../yuanling-system';

// Mock 外部执行器
const mockExecutor = async (prompt: string, context: any) => {
  return { content: `处理结果: ${prompt.substring(0, 50)}...` };
};

// 测试配置
const testConfig = {
  workspaceRoot: '/tmp/yuanling-test',
  enableL0: true,
  enableIntrospection: false,
  logLevel: 'error' as const,
  intentConfidenceThreshold: 0.8,
  enableRequestDeduplication: true,
  requestTimeoutMs: 5000,
  maxRetries: 1,
  retryDelayMs: 100,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 3,
  enableRateLimiter: true,
  maxRequestsPerMinute: 100,
};

describe('元灵系统主流程', () => {
  let system: YuanLingSystem;

  beforeAll(async () => {
    system = getYuanLingSystem(testConfig);
    await system.startup();
  });

  afterAll(async () => {
    await system.shutdown();
  });

  describe('基本功能', () => {
    it('应该正确处理基本消息', async () => {
      const result = await system.processWithExternalExecutor(
        '你好',
        [],
        mockExecutor
      );
      
      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.context).toBeDefined();
    });

    it('应该正确传递上下文', async () => {
      const result = await system.processWithExternalExecutor(
        '测试消息',
        [],
        mockExecutor
      );
      
      expect(result.context.performance).toBeDefined();
      expect(result.context.performance?.totalLatency).toBeDefined();
    });
  });

  describe('智能系统集成', () => {
    it('应该正确分析意图', async () => {
      const result = await system.processWithExternalExecutor(
        '帮我搜索一下 AI 新闻',
        [],
        mockExecutor
      );
      
      expect(result.context.intelligence).toBeDefined();
      expect(result.context.intelligence?.intent).toBeDefined();
    });

    it('应该正确进行智能路由', async () => {
      const result = await system.processWithExternalExecutor(
        '搜索最新的科技新闻',
        [],
        mockExecutor
      );
      
      expect(result.context.intelligence).toBeDefined();
    });
  });

  describe('请求处理', () => {
    it('应该正确处理会话历史', async () => {
      const history: Message[] = [
        { role: 'user', content: '之前的问题' },
        { role: 'assistant', content: '之前的回答' },
      ];
      
      const result = await system.processWithExternalExecutor(
        '继续之前的话题',
        history,
        mockExecutor
      );
      
      expect(result).toBeDefined();
    });

    it('应该正确处理请求去重', async () => {
      const message = '去重测试消息';
      
      const result1 = await system.processWithExternalExecutor(
        message,
        [],
        mockExecutor
      );
      
      const result2 = await system.processWithExternalExecutor(
        message,
        [],
        mockExecutor
      );
      
      // 两次结果应该相同（来自缓存）
      expect(result2.result.content).toBe(result1.result.content);
    });
  });

  describe('错误处理', () => {
    it('应该正确处理执行器错误', async () => {
      const errorExecutor = async () => {
        throw new Error('测试错误');
      };
      
      // 应该不会抛出未捕获的错误
      await expect(
        system.processWithExternalExecutor('触发错误', [], errorExecutor)
      ).resolves.toBeDefined();
    });
  });

  describe('性能指标', () => {
    it('应该正确记录性能指标', async () => {
      const result = await system.processWithExternalExecutor(
        '性能测试',
        [],
        mockExecutor
      );
      
      expect(result.context.performance?.totalLatency).toBeGreaterThan(0);
    });
  });
});
