/**
 * 核心类型定义
 * 对应：OpenClaw 的类型系统
 * 对应：Harness 的概念体系
 */

/**
 * 消息类型
 * 对应：OpenClaw 的 Message
 */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResult?: ToolResult;
}

/**
 * 工具调用
 * 对应：ReAct 的 Action
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * 工具结果
 */
export interface ToolResult {
  toolCallId: string;
  result: unknown;
  isError?: boolean;
}

/**
 * 工具定义
 * 对应：OpenClaw 的 Tool
 */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * 上下文
 * 对应：OpenClaw 的 Context
 */
export interface Context {
  sessionId: string;
  messages: Message[];
  tokens: number;
  maxTokens: number;
}

/**
 * 失败记录
 * 对应：Harness 的失败模式
 */
export interface Failure {
  type: "early_exit" | "false_complete" | "amnesia" | "environment_blind" | "other";
  timestamp: Date;
  context: Record<string, unknown>;
  severity: "low" | "medium" | "high";
}

/**
 * 补偿组件
 * 对应：Harness 的补偿面
 */
export interface Compensation {
  id: string;
  name: string;
  assumption: string;  // "模型做不到什么"
  addedAt: Date;
  lastVerified: Date;
  status: "active" | "deprecated" | "removed";
}

/**
 * 熵项
 * 对应：Harness 的熵概念
 */
export interface EntropyItem {
  type: "code" | "architecture" | "knowledge" | "process";
  location: string;
  severity: "low" | "medium" | "high";
  description: string;
  detectedAt: Date;
}

/**
 * 失败模式
 */
export interface FailurePattern {
  type: string;
  frequency: number;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

/**
 * 向量嵌入配置
 */
export interface EmbeddingConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  dimensions: number;
  timeout?: number;
}

/**
 * 向量嵌入结果
 */
export interface EmbeddingResult {
  text: string;
  vector: number[];
  dimensions: number;
  model: string;
  tokens?: number;
}

/**
 * 向量存储条目
 */
export interface VectorEntry {
  id: string;
  text: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  entry: VectorEntry;
  score: number;
}

/**
 * 向量存储配置
 */
export interface VectorStoreConfig {
  persistDir?: string;
  maxEntries?: number;
  defaultTopK?: number;
}
