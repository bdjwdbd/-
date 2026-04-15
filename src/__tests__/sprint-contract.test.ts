/**
 * SprintContractManager 和 ContractValidator 测试
 */

import { SprintContractManager, StructuredLogger } from '../infrastructure/index';
import { ContractValidator, DecisionReasoningEngine } from '../layers/ling-shu/DecisionCenter';

describe('SprintContractManager', () => {
  let manager: SprintContractManager;

  beforeEach(() => {
    const logger = new StructuredLogger();
    manager = new SprintContractManager(logger);
  });

  describe('create', () => {
    it('应该创建 Contract', () => {
      const contract = manager.create('测试任务', [
        { name: '标准1', description: '描述1', required: true },
        { name: '标准2', description: '描述2', required: false },
      ]);

      expect(contract).toBeDefined();
      expect(contract.id).toMatch(/^contract-/);
      expect(contract.goal).toBe('测试任务');
      expect(contract.criteria.length).toBe(2);
      expect(contract.status).toBe('draft');
    });

    it('应该支持从模板创建', () => {
      const contract = manager.createFromTemplate('code-review', '代码审查');
      expect(contract.criteria.length).toBeGreaterThan(0);
    });

    it('应该支持快速创建', () => {
      const contract = manager.quickCreate('快速任务');
      expect(contract).toBeDefined();
    });
  });

  describe('startExecution', () => {
    it('应该开始执行', () => {
      const contract = manager.create('测试', [{ name: '标准', required: true }]);
      manager.startExecution(contract.id);
      
      const updated = manager.get(contract.id);
      expect(updated.status).toBe('executing');
      expect(updated.startedAt).toBeDefined();
    });
  });

  describe('validateCriterion', () => {
    it('应该验证单个标准', () => {
      const contract = manager.create('测试', [
        { name: '标准1', required: true },
        { name: '标准2', required: true },
      ]);

      const result = manager.validateCriterion(contract.id, '标准1', true, '证据');
      expect(result.success).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('应该记录验证结果', () => {
      const contract = manager.create('测试', [{ name: '标准', required: true }]);
      manager.validateCriterion(contract.id, '标准', true, '证据');

      const updated = manager.get(contract.id);
      expect(updated.validationResults['标准']).toBeDefined();
      expect(updated.validationResults['标准'].passed).toBe(true);
    });
  });

  describe('getValidationProgress', () => {
    it('应该返回验证进度', () => {
      const contract = manager.create('测试', [
        { name: '标准1', required: true },
        { name: '标准2', required: true },
        { name: '标准3', required: true },
      ]);

      manager.validateCriterion(contract.id, '标准1', true);
      manager.validateCriterion(contract.id, '标准2', false);

      const progress = manager.getValidationProgress(contract.id);
      expect(progress.total).toBe(3);
      expect(progress.validated).toBe(2);
      expect(progress.passed).toBe(1);
      expect(progress.failed).toBe(1);
      expect(progress.pending).toBe(1);
    });
  });

  describe('completeWithValidation', () => {
    it('全部通过时应该成功', () => {
      const contract = manager.create('测试', [
        { name: '标准1', required: true },
        { name: '标准2', required: true },
      ]);

      manager.validateCriterion(contract.id, '标准1', true);
      manager.validateCriterion(contract.id, '标准2', true);

      const result = manager.completeWithValidation(contract.id);
      expect(result.success).toBe(true);
      expect(result.summary.passRate).toBe(100);
    });

    it('有未通过时应该失败', () => {
      const contract = manager.create('测试', [
        { name: '标准1', required: true },
        { name: '标准2', required: true },
      ]);

      manager.validateCriterion(contract.id, '标准1', true);
      manager.validateCriterion(contract.id, '标准2', false);

      const result = manager.completeWithValidation(contract.id);
      expect(result.success).toBe(false);
      expect(result.summary.passRate).toBe(50);
    });

    it('应该生成报告', () => {
      const contract = manager.create('测试', [{ name: '标准', required: true }]);
      manager.validateCriterion(contract.id, '标准', true, '证据');

      const result = manager.completeWithValidation(contract.id);
      expect(result.report).toContain('Sprint Contract 验收报告');
      expect(result.report).toContain('测试');
    });
  });
});

describe('ContractValidator', () => {
  let validator: ContractValidator;

  beforeEach(() => {
    validator = new ContractValidator();
  });

  describe('validateBatch', () => {
    it('应该批量验证', () => {
      const contract = validator.getManager().create('测试', [
        { name: '标准1', required: true },
        { name: '标准2', required: true },
        { name: '标准3', required: true },
      ]);

      const result = validator.validateBatch(contract.id, [
        { criterionName: '标准1', passed: true },
        { criterionName: '标准2', passed: false },
        { criterionName: '标准3', passed: true },
      ]);

      expect(result.validated).toBe(3);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('generateProgressTable', () => {
    it('应该生成进度表格', () => {
      const contract = validator.getManager().create('测试', [
        { name: '标准1', required: true },
        { name: '标准2', required: false },
      ]);

      validator.validateCriterion(contract.id, '标准1', true);

      const table = validator.generateProgressTable(contract.id);
      expect(table).toContain('| 序号 | 验收标准 |');
      expect(table).toContain('标准1');
      expect(table).toContain('✅ 通过');
    });
  });
});

describe('DecisionCenter Sprint Contract 集成', () => {
  let engine: DecisionReasoningEngine;

  beforeEach(() => {
    engine = new DecisionReasoningEngine();
  });

  describe('shouldUseSprintContract', () => {
    it('创建类任务应该启用', () => {
      const decision = engine.makeDecision('实现登录功能');
      expect(decision.sprintContract).toBeDefined();
      expect(decision.sprintContract?.criteria.length).toBeGreaterThan(0);
    });

    it('对话类任务不应该启用', () => {
      const decision = engine.makeDecision('今天天气怎么样');
      expect(decision.sprintContract).toBeUndefined();
    });

    it('开发关键词任务应该启用', () => {
      const decision = engine.makeDecision('修复这个bug');
      expect(decision.sprintContract).toBeDefined();
    });
  });

  describe('getContractValidator', () => {
    it('应该返回验证器', () => {
      const decision = engine.makeDecision('实现登录功能');
      const validator = engine.getContractValidator();

      expect(validator).toBeDefined();
      expect(validator.getManager()).toBeDefined();
    });
  });
});
