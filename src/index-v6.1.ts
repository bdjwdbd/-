/**
 * 元灵系统 v6.1 - 唯一统一入口
 *
 * 原则：
 * 1. YuanLingSystem 是唯一主入口
 * 2. OpenClawBridge 只是薄适配器，不再承载决策/验证/反馈主逻辑
 * 3. 旧兼容层保留，但不再作为主执行链暴露
 */

// ============================================================================
// 主入口：YuanLingSystem
// ============================================================================

export {
  YuanLingSystem,
  getYuanLingSystem,
  processWithYuanLing,
  type YuanLingRunContext,
  type YuanLingRunResult,
  type ExternalExecutor,
  type LLMConfig,
  type SystemStatus,
  type OpenClawCompatibleMessage,
  type YuanLingThinking,
  type YuanLingDecision,
  type YuanLingValidation,
  type YuanLingFeedback,
} from './yuanling-system-v6';

// ============================================================================
// 薄适配器：OpenClawBridge
// ============================================================================

export {
  OpenClawBridge,
  getOpenClawBridge,
  processWithBridge,
  type OpenClawMessage,
  type OpenClawToolCall,
  type OpenClawResult,
  type YuanLingContext,
} from './openclaw-bridge-v6';

// ============================================================================
// v6.0 核心模块（保留能力）
// ============================================================================

// 只导出架构模块的核心类型，避免冲突
export {
  ThreeLayerArchitecture,
  SessionLayer,
  HarnessLayer,
  SandboxLayer,
  IsolationLevel
} from './layers/architecture';

// 只导出记忆模块的核心类型
export {
  FiveLayerMemoryManager,
  MemoryLayer
} from './layers/memory';

// 只导出工具模块的核心类型
export {
  ToolRegistry,
  ToolExecutorService,
  ToolRiskLevel,
  ToolState
} from './layers/tools';

// 只导出知识图谱的核心类型
export {
  KnowledgeGraph,
  EntityType,
  RelationType
} from './layers/knowledge';

// 只导出 Middleware 的核心类型
export {
  MiddlewareLayers
} from './layers/middleware';

// ============================================================================
// 版本信息
// ============================================================================

export const VERSION = '6.1.0';
export const BUILD_DATE = '2026-04-17';
export const PRIMARY_ENTRY = 'YuanLingSystem';

// ============================================================================
// 兼容旧版导出
// ============================================================================

// 保留旧版接口，但委托给新版
export { YuanLingSystem as YuanLingSystemV6 } from './yuanling-system-v6';
export { OpenClawBridge as OpenClawBridgeV6 } from './openclaw-bridge-v6';
