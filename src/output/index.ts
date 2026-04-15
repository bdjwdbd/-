/**
 * 输出层
 *
 * 负责输出质量控制
 */

// 去 AI 味过滤器
export { DeAIFilter, deAIFilter } from "./DeAIFilter";
export type { FilterResult } from "./DeAIFilter";

// 观点表达框架
export { OpinionFramework, opinionFramework } from "./OpinionFramework";
export type { DomainType, OpinionResult } from "./OpinionFramework";
