import { YuanLingSystem } from "./src/yuanling";
import type { Tool, Context } from "./src/types";

/**
 * 元灵系统示例
 */
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    元灵系统 v1.0                              ║");
  console.log("║              YuanLing System - Core Data Flow                ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 创建元灵系统
  const yuanling = new YuanLingSystem();

  // 注册工具
  const readFileTool: Tool = {
    name: "read_file",
    description: "读取文件内容",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径" },
      },
      required: ["path"],
    },
    execute: async (args) => {
      const fs = await import("fs");
      const path = args.path as string;
      if (fs.existsSync(path)) {
        return { content: fs.readFileSync(path, "utf-8") };
      }
      return { error: `文件不存在: ${path}` };
    },
  };

  const listFilesTool: Tool = {
    name: "list_files",
    description: "列出目录下的文件",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "目录路径" },
      },
      required: ["path"],
    },
    execute: async (args) => {
      const fs = await import("fs");
      const path = args.path as string;
      if (fs.existsSync(path)) {
        return { files: fs.readdirSync(path) };
      }
      return { error: `目录不存在: ${path}` };
    },
  };

  const writeNoteTool: Tool = {
    name: "write_note",
    description: "写入笔记",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "笔记内容" },
      },
      required: ["content"],
    },
    execute: async (args) => {
      console.log(`[笔记] ${args.content}`);
      return { success: true };
    },
  };

  yuanling.registerTool(readFileTool);
  yuanling.registerTool(listFilesTool);
  yuanling.registerTool(writeNoteTool);

  console.log(`[灵躯层] 已注册 ${yuanling.toolFramework.list().length} 个工具\n`);

  // 创建上下文
  const context: Context = {
    sessionId: "demo-session",
    messages: [],
    tokens: 0,
    maxTokens: 100000,
  };

  console.log("=== 开始核心数据流 ===\n");
  console.log("数据流: 灵识层 → 灵枢层 → 灵脉层 → 灵躯层 → 灵盾层 → 灵韵层\n");

  // 运行
  const result = await yuanling.run("帮我读取当前目录的 package.json", context);

  console.log("\n=== 核心数据流完成 ===\n");

  // 获取系统状态
  const status = yuanling.getStatus();

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    系统状态                                   ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  健康状态: ${status.health.padEnd(48)}║`);
  console.log(`║  失败次数: ${String(status.failureCount).padEnd(48)}║`);
  console.log(`║  记忆大小: ${String(status.memorySize).padEnd(48)}║`);
  console.log(`║  工具数量: ${String(status.toolCount).padEnd(48)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 补偿面追踪
  console.log("=== 补偿面追踪 ===\n");
  const migration = await yuanling.trackCompensation();
  console.log(`保留组件: ${migration.toKeep.length} 个`);
  console.log(`待拆除组件: ${migration.toRemove.length} 个\n`);

  // 详细报告
  console.log("=== 详细报告 ===\n");
  console.log(yuanling.getDetailedReport());
}

main().catch(console.error);
