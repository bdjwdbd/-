/**
 * 六层架构统一导出
 * 
 * L6 灵识层 → L0 灵思层 → L1 灵枢层 → L2 灵脉层 → L3 灵躯层 → L4 灵盾层 → L5 灵韵层
 */

// 统一接口
export {
  LayerId,
  LayerName,
  type ILayer,
  type LayerConfig,
  type LayerContext,
  type LayerResult,
  type LayerState,
  BaseLayer,
  LayerManager,
  LayerFactory,
} from './unified-interface';

// L6 灵识层
export * from './ling-shi';

// L0 灵思层
export * from './ling-si';

// L1 灵枢层
export * from './ling-shu';

// L2 灵脉层
export * from './ling-mai';

// L3 灵躯层
export * from './ling-qu';

// L4 灵盾层
export * from './ling-dun';

// L5 灵韵层（使用别名避免命名冲突）
export * from './ling-yun';
