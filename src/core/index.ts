/**
 * 核心模块统一导出
 * 
 * 元灵系统七层架构：
 * - 灵思层：思考协议（新增）
 * - 灵枢层：决策与协调（decision, memory-center-v2）
 * - 灵脉层：执行与流转（execution）
 * - 灵躯层：行动与工具（execution）
 * - 灵盾层：防护与验证（security）
 * - 灵韵层：反馈与调节（feedback）
 * - 灵识层：感知与唤醒（perception）
 */

// 基础设施
export * from "./infrastructure";

// 向量与嵌入
export * from "./embedding";

// 决策中心
export * from "./decision";

// 执行与工具
export * from "./execution";

// 安全与验证
export * from "./security";

// 反馈与调节
export * from "./feedback";

// 感知与唤醒
export * from "./perception";

// 记忆后端（新增）
export {
  // 类型
  type MemoryType as MemoryBackendType,
  type MemoryPriority,
  type Memory as MemoryRecord,
  type Persona,
  type SceneBlock,
  type SearchResult,
  type SearchOptions,
  type StoreOptions,
  type BackendStats,
  type MemoryBackend,
  type BackendType,
  type BackendConfig,
  // 类
  InMemoryBackend,
  BackendFactory,
} from "./memory-backend";

// TencentDB 后端（新增）
export { TencentDBBackend } from "./tencentdb-backend";

// 记忆中心 v2（新增，重命名避免冲突）
export {
  MemoryCenter as MemoryCenterV2,
  type MemoryCenterConfig,
  type RememberOptions,
  type RecallOptions,
  type RecallResult,
} from "./memory-center-v2";
