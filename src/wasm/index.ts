/**
 * WASM/SIMD 模块导出
 */

export {
  SIMDVectorOps,
  createSIMDVectorOps,
  isSIMDSupported,
  type SIMDConfig,
  type SIMDInfo,
} from './simd-vector';

export {
  WasmSimdLoader,
  getWasmSimdLoader,
  loadWasmSimd,
  getWasmExports,
  isWasmAvailable,
  type WasmExports,
  type WasmInfo,
  type WasmLoadResult,
} from './wasm-simd-loader';
