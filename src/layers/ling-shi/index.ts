/**
 * 灵识层（L6）- 感知与唤醒
 * 
 * 职责：
 * - 环境感知：感知运行环境、获取上下文
 * - 内容理解：理解输入内容、分析意图
 * - 命令解析：解析用户命令、提取参数
 * - 唤醒机制：三步唤醒、环境初始化
 */

// 从 core/ 导入组件
export { EnvironmentAwareness, ContentUnderstanding, CommandParser } from "../../core/perception";

// 导出类型
export type {
  ContentType,
  IntentType,
  Environment,
  ContentAnalysis,
  ParsedCommand,
} from "../../core/perception";

// 层级标识
export const LING_SHI_NAME = "ling-shi";
export const LING_SHI_LEVEL = 6;
export const LING_SHI_DESCRIPTION = "感知与唤醒层";
