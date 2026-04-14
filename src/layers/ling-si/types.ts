/**
 * 灵思层（L0）- 类型定义
 * 
 * 基于 Thinking Claude 协议设计的思考类型系统
 */

// ==================== 思考深度 ====================

/**
 * 思考深度枚举
 * - MINIMAL: 简单问题，1-2 句思考
 * - STANDARD: 标准问题，3-5 句思考
 * - EXTENSIVE: 复杂问题，完整意识流
 * - DEEP: 深度问题，递归思考
 */
export enum ThinkingDepth {
  MINIMAL = "minimal",
  STANDARD = "standard",
  EXTENSIVE = "extensive",
  DEEP = "deep",
}

// ==================== 深度评估 ====================

/**
 * 深度评估维度
 */
export interface DepthAssessment {
  /** 问题复杂度 (0-1) */
  complexity: number;
  /** 风险级别 (0-1) */
  stakes: number;
  /** 时间敏感性 (0-1) */
  timeSensitivity: number;
  /** 信息可用性 (0-1) */
  informationAvailable: number;
  /** 用户需求强度 (0-1) */
  humanNeeds: number;
  /** 技术内容程度 (0-1) */
  technicalLevel: number;
  /** 情感内容程度 (0-1) */
  emotionalLevel: number;
}

/**
 * 深度评估结果
 */
export interface DepthAssessmentResult {
  /** 评估的深度 */
  depth: ThinkingDepth;
  /** 评估分数 */
  score: number;
  /** 评估详情 */
  assessment: DepthAssessment;
  /** 推荐的 token 预算 */
  tokenBudget: number;
}

// ==================== 思考步骤 ====================

/**
 * 思考步骤名称枚举
 */
export enum ThinkingStepName {
  INITIAL_ENGAGEMENT = "initial_engagement",
  PROBLEM_ANALYSIS = "problem_analysis",
  MULTIPLE_HYPOTHESES = "multiple_hypotheses",
  NATURAL_DISCOVERY = "natural_discovery",
  TESTING_VERIFICATION = "testing_verification",
  ERROR_CORRECTION = "error_correction",
  KNOWLEDGE_SYNTHESIS = "knowledge_synthesis",
  PATTERN_RECOGNITION = "pattern_recognition",
  PROGRESS_TRACKING = "progress_tracking",
  RECURSIVE_THINKING = "recursive_thinking",
}

/**
 * 思考步骤结果
 */
export interface ThinkingStepResult {
  /** 步骤名称 */
  stepName: ThinkingStepName;
  /** 思考内容 */
  thoughts: string[];
  /** 是否完成 */
  completed: boolean;
  /** 下一步骤 */
  nextStep?: ThinkingStepName;
  /** 发现的问题 */
  issues?: string[];
  /** 生成的假设 */
  hypotheses?: Hypothesis[];
  /** 置信度变化 */
  confidenceDelta?: number;
}

/**
 * 思考上下文
 */
export interface ThinkingContext {
  /** 原始消息 */
  message: HumanMessage;
  /** 当前深度 */
  depth: ThinkingDepth;
  /** 已完成的步骤 */
  completedSteps: ThinkingStepName[];
  /** 当前假设 */
  hypotheses: Hypothesis[];
  /** 已建立的事实 */
  establishedFacts: string[];
  /** 待解决的问题 */
  openQuestions: string[];
  /** 当前置信度 */
  confidence: number;
  /** Token 预算 */
  tokenBudget: number;
  /** 已使用的 token */
  tokensUsed: number;
  /** 用户上下文 */
  userContext?: UserContext;
  /** 历史记忆 */
  memories?: Memory[];
}

// ==================== 假设管理 ====================

/**
 * 假设状态
 */
export enum HypothesisStatus {
  ACTIVE = "active",
  REJECTED = "rejected",
  CONFIRMED = "confirmed",
  PENDING = "pending",
}

/**
 * 假设定义
 */
export interface Hypothesis {
  /** 假设 ID */
  id: string;
  /** 假设内容 */
  content: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 支持证据 */
  evidence: string[];
  /** 反对证据 */
  counterEvidence: string[];
  /** 状态 */
  status: HypothesisStatus;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 来源步骤 */
  sourceStep: ThinkingStepName;
}

/**
 * 假设更新操作
 */
export interface HypothesisUpdate {
  /** 假设 ID */
  id: string;
  /** 置信度变化 */
  confidenceDelta?: number;
  /** 新证据 */
  newEvidence?: string[];
  /** 新反对证据 */
  newCounterEvidence?: string[];
  /** 新状态 */
  newStatus?: HypothesisStatus;
  /** 更新原因 */
  reason: string;
}

// ==================== 思考结果 ====================

/**
 * 思考结果
 */
export interface ThinkingResult {
  /** 思考 ID */
  id: string;
  /** 思考深度 */
  depth: ThinkingDepth;
  /** 完整思考内容 */
  content: string;
  /** 各步骤结果 */
  stepResults: ThinkingStepResult[];
  /** 最终假设 */
  hypotheses: Hypothesis[];
  /** 关键洞察 */
  insights: string[];
  /** 置信度 */
  confidence: number;
  /** 是否需要工具调用 */
  requiresToolUse: boolean;
  /** 推荐的工具调用 */
  recommendedTools?: ToolRecommendation[];
  /** 是否需要澄清 */
  needsClarification: boolean;
  /** 澄清问题 */
  clarificationQuestions?: string[];
  /** Token 使用 */
  tokensUsed: number;
  /** 思考耗时 (ms) */
  duration: number;
}

/**
 * 工具推荐
 */
export interface ToolRecommendation {
  /** 工具名称 */
  toolName: string;
  /** 推荐参数 */
  parameters: Record<string, unknown>;
  /** 推荐理由 */
  reason: string;
  /** 优先级 */
  priority: number;
}

// ==================== 消息与上下文 ====================

/**
 * 人类消息
 */
export interface HumanMessage {
  /** 消息 ID */
  id: string;
  /** 消息内容 */
  content: string;
  /** 消息类型 */
  type: "text" | "image" | "file" | "mixed";
  /** 附件 */
  attachments?: Attachment[];
  /** 时间戳 */
  timestamp: number;
  /** 会话 ID */
  sessionId: string;
}

/**
 * 附件
 */
export interface Attachment {
  /** 附件类型 */
  type: "image" | "file" | "link";
  /** 附件 URL */
  url: string;
  /** 附件名称 */
  name?: string;
  /** 附件大小 */
  size?: number;
}

/**
 * 用户上下文
 */
export interface UserContext {
  /** 用户 ID */
  userId: string;
  /** 用户偏好 */
  preferences: Record<string, unknown>;
  /** 历史交互 */
  recentInteractions: HumanMessage[];
  /** 当前任务 */
  currentTask?: string;
}

/**
 * 记忆
 */
export interface Memory {
  /** 记忆 ID */
  id: string;
  /** 记忆内容 */
  content: string;
  /** 记忆类型 */
  type: "short_term" | "long_term" | "working";
  /** 重要性 */
  importance: number;
  /** 创建时间 */
  createdAt: number;
}

// ==================== 配置 ====================

/**
 * 思考配置
 */
export interface ThinkingConfig {
  /** 是否对用户可见 */
  visible: boolean;
  /** 显示格式 */
  format: "hidden" | "collapsed" | "visible";
  /** 最大思考 token */
  maxThinkingTokens: number;
  /** 是否启用多假设 */
  enableMultiHypothesis: boolean;
  /** 最大假设数量 */
  maxHypotheses: number;
  /** 是否启用递归思考 */
  enableRecursiveThinking: boolean;
  /** 最大递归深度 */
  maxRecursionDepth: number;
  /** 是否启用自我验证 */
  enableSelfVerification: boolean;
  /** 思考超时 (ms) */
  timeout: number;
}

/**
 * 默认思考配置
 */
export const DEFAULT_THINKING_CONFIG: ThinkingConfig = {
  visible: false,
  format: "hidden",
  maxThinkingTokens: 1500,
  enableMultiHypothesis: true,
  maxHypotheses: 5,
  enableRecursiveThinking: true,
  maxRecursionDepth: 3,
  enableSelfVerification: true,
  timeout: 30000,
};

// ==================== 自然语言模板 ====================

/**
 * 自然语言过渡模板
 */
export const NATURAL_TRANSITIONS = {
  // 思考开始
  start: [
    "Hmm, let me think about this...",
    "Alright, let me consider this carefully...",
    "Okay, this is interesting...",
    "Let me work through this...",
  ],
  
  // 发现模式
  discovery: [
    "Actually, this reminds me of...",
    "Wait, I notice that...",
    "This is interesting because...",
    "Now that I look at it...",
  ],
  
  // 深入分析
  deeper: [
    "But looking deeper...",
    "On the surface this seems..., but...",
    "Let me think about this more carefully...",
    "There's something more here...",
  ],
  
  // 质疑假设
  questioning: [
    "Wait, let me reconsider...",
    "But then again...",
    "I wonder if...",
    "Let me check if this is right...",
  ],
  
  // 错误修正
  correction: [
    "Actually, I think I was wrong about...",
    "Let me correct myself...",
    "On second thought...",
    "I need to revise my understanding...",
  ],
  
  // 连接想法
  connection: [
    "This connects to...",
    "Speaking of which...",
    "That reminds me of...",
    "This relates back to...",
  ],
  
  // 总结
  synthesis: [
    "Putting this all together...",
    "So what I'm seeing is...",
    "The key insight here is...",
    "Let me summarize what I've found...",
  ],
  
  // 不确定性
  uncertainty: [
    "I'm not entirely sure about...",
    "There's some uncertainty here...",
    "This might be...",
    "I should verify...",
  ],
};

/**
 * 获取随机过渡语
 */
export function getRandomTransition(category: keyof typeof NATURAL_TRANSITIONS): string {
  const transitions = NATURAL_TRANSITIONS[category];
  return transitions[Math.floor(Math.random() * transitions.length)];
}
