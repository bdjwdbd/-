/**
 * DecisionCenter 测试
 */

import { DecisionCenter } from "../core/decision";

describe('DecisionCenter', () => {
  let dc: DecisionCenter;

  beforeEach(() => {
    dc = new DecisionCenter();
  });

  describe('初始化', () => {
    it('应该能成功初始化', () => {
      expect(dc).toBeDefined();
    });
  });

  describe('决策功能', () => {
    it('应该能做出计划决策', async () => {
      const decision = await dc.decide("plan", "测试任务");
      expect(decision).toBeDefined();
      expect(decision.id).toBeDefined();
      expect(decision.type).toBe("plan");
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it('应该能做出执行决策', async () => {
      const decision = await dc.decide("act", "执行任务");
      expect(decision).toBeDefined();
      expect(decision.type).toBe("act");
    });
  });
});
