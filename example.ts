import { HumanoidAgent } from "./src";

/**
 * 使用示例
 */
async function main() {
  console.log("=== 人体 Agent 系统示例 ===\n");

  // 创建 Agent
  const agent = new HumanoidAgent("demo-session");

  // 注册工具
  agent.registerTool({
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
        return fs.readFileSync(path, "utf-8");
      }
      return { error: `文件不存在: ${path}` };
    },
  });

  agent.registerTool({
    name: "write_file",
    description: "写入文件内容",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径" },
        content: { type: "string", description: "文件内容" },
      },
      required: ["path", "content"],
    },
    execute: async (args) => {
      const fs = await import("fs");
      fs.writeFileSync(args.path as string, args.content as string);
      return { success: true, path: args.path };
    },
  });

  agent.registerTool({
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
        return fs.readdirSync(path);
      }
      return { error: `目录不存在: ${path}` };
    },
  });

  // 运行 Agent（模拟模式，因为没有配置 LLM）
  console.log("运行 Agent...");
  const result = await agent.run("帮我查看当前目录的文件");
  console.log("结果:", result || "(无输出 - 需要配置 LLM)");

  // 查看状态
  agent.status();

  // 获取详细报告
  console.log("\n=== 详细报告 ===\n");
  console.log(agent.getReport());

  // 获取统计信息
  console.log("\n=== 统计信息 ===\n");
  console.log("记忆统计:", agent.getMemoryStats());
  console.log("补偿组件统计:", agent.getCompensationStats());
  console.log("失败统计:", agent.getFailureStats());

  // 进化
  console.log("\n=== 进化 ===\n");
  const evolution = await agent.evolve();
  console.log("进化结果:", evolution);

  // 熵治理
  console.log("\n=== 熵治理 ===\n");
  const governance = await agent.govern();
  console.log("熵治理结果:", governance);

  console.log("\n=== 示例完成 ===");
}

main().catch(console.error);
