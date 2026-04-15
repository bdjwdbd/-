/**
 * 验收标准推断引擎测试
 */

import { CriteriaInferenceEngine, inferCriteria } from '../infrastructure/criteria-inference-engine';

describe('CriteriaInferenceEngine', () => {
  let engine: CriteriaInferenceEngine;

  beforeEach(() => {
    engine = new CriteriaInferenceEngine();
  });

  describe('关键词匹配', () => {
    it('应该识别代码相关任务', () => {
      const result = engine.infer('帮我实现一个登录功能');
      expect(result.criteria.some(c => c.name === '代码可运行')).toBe(true);
      expect(result.criteria.some(c => c.name === '代码规范')).toBe(true);
    });

    it('应该识别解释相关任务', () => {
      const result = engine.infer('解释一下什么是闭包');
      expect(result.criteria.some(c => c.name === '解释清晰')).toBe(true);
      expect(result.criteria.some(c => c.name === '覆盖关键点')).toBe(true);
    });

    it('应该识别优化相关任务', () => {
      const result = engine.infer('优化这个查询的性能');
      expect(result.criteria.some(c => c.name === '效果可测量')).toBe(true);
    });

    it('应该识别测试相关任务', () => {
      const result = engine.infer('为这个函数写测试');
      expect(result.criteria.some(c => c.name === '测试覆盖')).toBe(true);
      expect(result.criteria.some(c => c.name === '测试通过')).toBe(true);
    });
  });

  describe('实体识别', () => {
    it('应该识别登录实体', () => {
      const result = engine.infer('实现用户登录功能');
      expect(result.entities).toContain('登录');
      expect(result.domains).toContain('登录');
    });

    it('应该识别支付实体', () => {
      const result = engine.infer('开发支付模块');
      expect(result.entities).toContain('支付');
      expect(result.domains).toContain('支付');
    });

    it('应该识别多个实体', () => {
      const result = engine.infer('实现登录和支付功能');
      expect(result.entities.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('领域知识匹配', () => {
    it('应该为登录任务提供领域标准', () => {
      const result = engine.infer('实现登录功能');
      expect(result.criteria.some(c => c.name === '密码加密存储')).toBe(true);
      expect(result.criteria.some(c => c.name === '错误提示清晰')).toBe(true);
      expect(result.criteria.some(c => c.name === '会话管理')).toBe(true);
    });

    it('应该为支付任务提供领域标准', () => {
      const result = engine.infer('实现支付功能');
      expect(result.criteria.some(c => c.name === '金额校验准确')).toBe(true);
      expect(result.criteria.some(c => c.name === '交易记录完整')).toBe(true);
    });

    it('应该为搜索任务提供领域标准', () => {
      const result = engine.infer('实现搜索功能');
      expect(result.criteria.some(c => c.name === '搜索结果准确')).toBe(true);
      expect(result.criteria.some(c => c.name === '分页显示')).toBe(true);
    });

    it('应该为API任务提供领域标准', () => {
      const result = engine.infer('开发用户API');
      expect(result.criteria.some(c => c.name === '接口文档完整')).toBe(true);
      expect(result.criteria.some(c => c.name === '参数校验完整')).toBe(true);
    });
  });

  describe('去重和排序', () => {
    it('应该去重相同名称的标准', () => {
      const result = engine.infer('实现登录代码');
      const names = result.criteria.map(c => c.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    it('应该将required标准排在前面', () => {
      const result = engine.infer('实现登录功能');
      const firstNonRequired = result.criteria.findIndex(c => !c.required);
      if (firstNonRequired > 0) {
        const beforeNonRequired = result.criteria.slice(0, firstNonRequired);
        expect(beforeNonRequired.every(c => c.required)).toBe(true);
      }
    });
  });

  describe('置信度计算', () => {
    it('无匹配时应该返回低置信度', () => {
      const result = engine.infer('随便聊聊');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('有领域匹配时应该返回较高置信度', () => {
      const result = engine.infer('实现登录功能');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('便捷函数', () => {
    it('inferCriteria 应该返回标准数组', () => {
      const criteria = inferCriteria('实现登录功能');
      expect(Array.isArray(criteria)).toBe(true);
      expect(criteria.length).toBeGreaterThan(0);
    });
  });

  describe('推理过程', () => {
    it('应该提供推理过程', () => {
      const result = engine.infer('实现登录功能');
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some(r => r.includes('关键词'))).toBe(true);
      expect(result.reasoning.some(r => r.includes('实体'))).toBe(true);
      expect(result.reasoning.some(r => r.includes('领域'))).toBe(true);
    });
  });

  describe('静态方法', () => {
    it('应该返回可用领域列表', () => {
      const domains = CriteriaInferenceEngine.getAvailableDomains();
      expect(domains).toContain('登录');
      expect(domains).toContain('支付');
      expect(domains).toContain('搜索');
    });

    it('应该返回领域知识', () => {
      const knowledge = CriteriaInferenceEngine.getDomainKnowledge('登录');
      expect(knowledge).toBeDefined();
      expect(knowledge?.criteria.length).toBeGreaterThan(0);
    });
  });
});
