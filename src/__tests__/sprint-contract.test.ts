/**
 * SprintContractManager 测试
 */

import { SprintContractManager, StructuredLogger } from '../infrastructure/index';

describe('SprintContractManager', () => {
  let manager: SprintContractManager;

  beforeEach(() => {
    const logger = new StructuredLogger();
    manager = new SprintContractManager(logger);
  });

  describe('createContract', () => {
    it('应该创建 Contract', () => {
      const contract = manager.createContract('测试任务', ['标准1', '标准2'], ['约束1']);

      expect(contract).toBeDefined();
      expect(contract.id).toMatch(/^contract-/);
      expect(contract.goal).toBe('测试任务');
      expect(contract.acceptanceCriteria.length).toBe(2);
      expect(contract.status).toBe('draft');
    });

    it('应该支持默认约束', () => {
      const contract = manager.createContract('测试任务', ['标准1']);

      expect(contract.constraints.length).toBe(0);
    });
  });

  describe('validateCriterion', () => {
    it('应该验证标准', () => {
      const result = manager.validateCriterion('标准1', true);

      expect(result).toBe(true);
    });
  });

  describe('activateContract', () => {
    it('应该激活 Contract', () => {
      const contract = manager.createContract('测试任务', ['标准1']);

      const result = manager.activateContract(contract.id);

      expect(result).toBe(true);
    });

    it('不存在的 Contract 应该返回 false', () => {
      const result = manager.activateContract('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('completeContract', () => {
    it('应该完成 Contract', () => {
      const contract = manager.createContract('测试任务', ['标准1']);
      manager.activateContract(contract.id);

      const result = manager.completeContract(contract.id);

      expect(result).toBe(true);
    });
  });

  describe('failContract', () => {
    it('应该标记 Contract 为失败', () => {
      const contract = manager.createContract('测试任务', ['标准1']);
      manager.activateContract(contract.id);

      const result = manager.failContract(contract.id, '测试失败');

      expect(result).toBe(true);
    });
  });

  describe('completeWithValidation', () => {
    it('应该完成并验证 Contract', () => {
      const contract = manager.createContract('测试任务', ['标准1']);
      manager.activateContract(contract.id);

      const result = manager.completeWithValidation(contract.id);

      expect(result).toBe(true);
      expect(manager.getValidationProgress(contract.id)).toBe(100);
    });
  });

  describe('getValidationProgress', () => {
    it('新 Contract 进度应该为 0', () => {
      const contract = manager.createContract('测试任务', ['标准1']);

      const progress = manager.getValidationProgress(contract.id);

      expect(progress).toBe(0);
    });
  });

  describe('静态工厂方法', () => {
    it('应该通过静态方法创建', () => {
      const newManager = SprintContractManager.create('测试任务', ['标准1'], []);

      expect(newManager).toBeInstanceOf(SprintContractManager);
    });
  });
});
