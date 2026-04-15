/**
 * @file auto-tuner.test.ts
 * @brief 自动调优测试
 */

import { AutoTuner } from '../src/infrastructure/auto-tuner';

describe('AutoTuner', () => {
  let tuner: AutoTuner;

  beforeEach(() => {
    tuner = new AutoTuner();
  });

  test('应该正确初始化', () => {
    expect(tuner).toBeDefined();
  });

  test('应该能注册参数', () => {
    tuner.registerParameter('test', {
      type: 'float',
      min: 0,
      max: 1,
      default: 0.5
    });
    expect(tuner.getParameter('test')).toBeDefined();
  });

  test('应该能获取当前值', () => {
    tuner.registerParameter('test', {
      type: 'float',
      min: 0,
      max: 1,
      default: 0.5
    });
    expect(tuner.getValue('test')).toBe(0.5);
  });
});
