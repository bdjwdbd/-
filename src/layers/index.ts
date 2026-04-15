/**
 * 元灵系统七层架构
 * 
 * 层级结构（从外到内）：
 * 
 * L6 灵识层 → 感知与唤醒
 * L5 灵韵层 → 反馈与调节
 * L4 灵盾层 → 防护与验证
 * L3 灵躯层 → 行动与工具
 * L2 灵脉层 → 执行与流转
 * L1 灵枢层 → 决策与协调
 * L0 灵思层 → 思考协议（新增）
 * 
 * 数据流：灵识层 → 灵思层 → 灵枢层 → 灵脉层 → 灵躯层 → 灵盾层 → 灵韵层
 * 
 * L0 灵思层基于 Thinking Claude 协议设计，在所有交互前执行深度思考
 */

// 导出所有层级（使用命名导出避免冲突）
export * from "./ling-si";    // L0 灵思层（新增）
export * from "./ling-shu";   // L1 灵枢层
export * from "./ling-mai";   // L2 灵脉层
export * from "./ling-qu";    // L3 灵躯层
export * from "./ling-dun";   // L4 灵盾层
export * from "./ling-yun";   // L5 灵韵层

// L6 灵识层（使用命名空间导出避免冲突）
export {
  EnvironmentAwareness,
  ThreeStepWakeup,
  StateManager,
  getEnvironmentAwareness,
  getThreeStepWakeup,
  LING_SHI_NAME,
  LING_SHI_LEVEL,
  LING_SHI_DESCRIPTION,
} from "./ling-shi";

// 重命名冲突的类型
export {
  ContextManager as SessionContextManager,
} from "./ling-shi";

export type {
  EnvironmentInfo,
  ResourceStatus,
  NetworkStatus,
  SessionContext,
  SystemContext,
  WakeupState,
} from "./ling-shi";

// 层级信息
export const LAYERS = [
  { name: "ling-si", level: 0, description: "思考协议层" },
  { name: "ling-shu", level: 1, description: "决策与协调层" },
  { name: "ling-mai", level: 2, description: "执行与流转层" },
  { name: "ling-qu", level: 3, description: "行动与工具层" },
  { name: "ling-dun", level: 4, description: "防护与验证层" },
  { name: "ling-yun", level: 5, description: "反馈与调节层" },
  { name: "ling-shi", level: 6, description: "感知与唤醒层" },
] as const;

// 层级数量
export const LAYER_COUNT = 7;

// 层级执行顺序（从外到内）
export const LAYER_EXECUTION_ORDER = [
  "ling-shi",  // L6: 感知
  "ling-si",   // L0: 思考（新增）
  "ling-shu",  // L1: 决策
  "ling-mai",  // L2: 执行
  "ling-qu",   // L3: 行动
  "ling-dun",  // L4: 验证
  "ling-yun",  // L5: 反馈
] as const;
