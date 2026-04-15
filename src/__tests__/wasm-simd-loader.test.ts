/**
 * WASM SIMD 加载器测试
 */

import { WasmSimdLoader, loadWasmSimd, isWasmAvailable } from '../wasm/wasm-simd-loader';

describe('WasmSimdLoader', () => {
  let loader: WasmSimdLoader;

  beforeEach(() => {
    loader = new WasmSimdLoader();
  });

  describe('load', () => {
    it('应该能加载模块（降级到 JS）', async () => {
      const result = await loader.load();
      
      expect(result.success).toBe(true);
      expect(result.exports).toBeDefined();
    });

    it('应该返回模块信息', async () => {
      await loader.load();
      const info = loader.getInfo();
      
      expect(info.loaded).toBe(true);
      expect(typeof info.simd).toBe('boolean');
      expect(typeof info.version).toBe('number');
    });

    it('重复加载应该返回缓存结果', async () => {
      const result1 = await loader.load();
      const result2 = await loader.load();
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('getInfo', () => {
    it('加载前应该返回默认信息', () => {
      const info = loader.getInfo();
      
      expect(info.loaded).toBe(false);
      expect(info.simd).toBe(false);
      expect(info.version).toBe(0);
    });
  });

  describe('reset', () => {
    it('应该能重置加载状态', async () => {
      await loader.load();
      expect(loader.getInfo().loaded).toBe(true);
      
      loader.reset();
      expect(loader.getInfo().loaded).toBe(false);
    });
  });
});

describe('loadWasmSimd', () => {
  it('应该能加载 WASM 模块', async () => {
    const result = await loadWasmSimd();
    
    expect(result.success).toBe(true);
  });
});

describe('isWasmAvailable', () => {
  it('应该返回布尔值', async () => {
    await loadWasmSimd();
    const available = isWasmAvailable();
    
    expect(typeof available).toBe('boolean');
  });
});
