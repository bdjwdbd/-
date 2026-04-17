/**
 * 元灵系统 v5.0 - 统一导出
 * 
 * 新增模块：
 * - L0 灵思层：思考协议引擎
 * - L7 沙箱层：隔离执行环境
 * - Session 日志：追加式日志系统
 * - 三层记忆：L0/L1/L2 分级存储
 * - 双存储：向量 + 图存储
 * - 知识图谱：实体关系管理
 * - HOPE 分块：语义分块系统
 * - 主流程控制器：统一编排
 */

// ============================================================================
// 主流程控制器
// ============================================================================

export {
  MainFlowController,
  MainFlowConfig,
  MainFlowResult,
  QueryAnalyzer,
  QueryType,
  RetrievalStrategy,
  RetrievalStrategySelector,
  CRAGEvaluator,
  SemanticCache
} from './main-flow-controller';

// ============================================================================
// L0 灵思层
// ============================================================================

export {
  ThinkingLayer,
  ThinkingProtocolEngine,
  AdaptiveDepthController,
  MultiHypothesisManager,
  ThinkingDepth,
  ThinkingPhase,
  type ThinkingResult,
  type ThinkingContext,
  type Hypothesis,
  type ThinkingStep
} from './ling-si-0/thinking-layer';

// ============================================================================
// L7 沙箱层
// ============================================================================

export {
  SandboxLayer,
  SandboxManager,
  CredentialManager,
  IsolationLevel,
  type Sandbox,
  type SandboxConfig,
  type ResourceLimits,
  type ExecutionResult
} from './ling-sha-7/sandbox-layer';

// ============================================================================
// Session 日志
// ============================================================================

export {
  SessionController,
  SessionLogManager,
  SessionState,
  EventType,
  type Session,
  type Event,
  type Checkpoint
} from './session-log';

// ============================================================================
// 三层记忆
// ============================================================================

export {
  ThreeLayerMemory,
  SessionMemory,
  WorkingMemory,
  LongTermMemory,
  MemoryLevel,
  type Memory,
  type MemoryQuery,
  type MemorySearchResult
} from './ling-mai/three-layer-memory';

// ============================================================================
// 双存储
// ============================================================================

export {
  DualStorage,
  VectorStore,
  GraphStore,
  type VectorRecord,
  type VectorSearchResult,
  type GraphNode,
  type GraphEdge,
  type GraphPath
} from './ling-mai/dual-storage';

// ============================================================================
// 知识图谱
// ============================================================================

export {
  KnowledgeGraph,
  EntityExtractor,
  RelationExtractor,
  CommunityDetector,
  CommunitySummarizer,
  EntityType,
  RelationType,
  type Entity,
  type Relation,
  type Community,
  type KnowledgeGraphStats
} from './ling-mai/knowledge-graph';

// ============================================================================
// HOPE 分块
// ============================================================================

export {
  SemanticChunker,
  HOPEEvaluator,
  HybridSearch,
  type Chunk,
  type ChunkingConfig,
  type HOPEMetrics
} from './ling-mai/semantic-chunker';

// ============================================================================
// 版本信息
// ============================================================================

export const VERSION = '5.0.0';

export const FEATURES = {
  L0_THINKING_LAYER: true,
  L7_SANDBOX_LAYER: true,
  SESSION_LOG: true,
  THREE_LAYER_MEMORY: true,
  DUAL_STORAGE: true,
  KNOWLEDGE_GRAPH: true,
  HOPE_CHUNKING: true,
  HYBRID_SEARCH: true
};
