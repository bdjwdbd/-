#!/usr/bin/env node
/**
 * 灵思层命令行工具
 * 
 * 提供交互式的思考过程演示和测试
 */

import * as readline from "readline";
import {
  TokenAwareThinkingEngine,
  configManager,
  thinkingVisualizer,
  templateRegistry,
  ThinkingDepth,
  HumanMessage,
} from "../index";

// ============================================================
// 命令行界面
// ============================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function print(message: string): void {
  console.log(message);
}

function printHeader(title: string): void {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60) + "\n");
}

function printHelp(): void {
  print(`
可用命令:
  think <message>  - 执行思考
  config <preset>  - 切换配置预设 (default/production/quality/fast)
  template         - 显示所有模板
  stats            - 显示性能统计
  help             - 显示帮助
  exit             - 退出程序

示例:
  think 如何优化数据库查询性能？
  config quality
  stats
`);
}

// ============================================================
// 主程序
// ============================================================

async function main(): Promise<void> {
  printHeader("灵思层（L0）命令行工具");

  // 创建引擎
  const engine = new TokenAwareThinkingEngine();

  print("🧠 灵思层已启动，基于 Thinking Claude v5.1-extensive");
  print("📝 输入 'help' 查看可用命令\n");

  // 主循环
  const loop = async (): Promise<void> => {
    rl.question(">>> ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        loop();
        return;
      }

      const [command, ...args] = trimmed.split(/\s+/);

      try {
        switch (command.toLowerCase()) {
          case "think": {
            const messageContent = args.join(" ");
            if (!messageContent) {
              print("❌ 请输入要思考的内容");
              break;
            }

            print("\n🔄 正在思考...\n");

            const message: HumanMessage = {
              id: `cli-${Date.now()}`,
              content: messageContent,
              type: "text",
              timestamp: Date.now(),
              sessionId: "cli",
            };

            const startTime = Date.now();
            const { result, allocation, wasCompressed } = 
              await engine.executeWithTokenAwareness(message, 0);
            const totalTime = Date.now() - startTime;

            // 显示结果
            print("📊 思考结果:");
            print(`   深度: ${result.depth}`);
            print(`   置信度: ${(result.confidence * 100).toFixed(1)}%`);
            print(`   步骤数: ${result.stepResults.length}`);
            print(`   假设数: ${result.hypotheses.length}`);
            print(`   洞察数: ${result.insights.length}`);
            print(`   Token: ${result.tokensUsed} / ${allocation.thinking}`);
            print(`   压缩: ${wasCompressed ? "是" : "否"}`);
            print(`   耗时: ${totalTime}ms`);

            // 显示洞察
            if (result.insights.length > 0) {
              print("\n💡 关键洞察:");
              result.insights.forEach((insight, i) => {
                print(`   ${i + 1}. ${insight}`);
              });
            }

            // 显示假设
            if (result.hypotheses.length > 0) {
              print("\n💭 假设:");
              result.hypotheses.slice(0, 3).forEach((h, i) => {
                const status = h.status === "confirmed" ? "✓" : 
                              h.status === "rejected" ? "✗" : "○";
                print(`   ${status} [${(h.confidence * 100).toFixed(0)}%] ${h.content.substring(0, 50)}`);
              });
            }

            print("");
            break;
          }

          case "config": {
            const preset = args[0];
            if (!preset) {
              print("❌ 请指定配置预设: default, production, quality, fast");
              print(`   当前预设: ${configManager.getPresetNames().join(", ")}`);
              break;
            }

            if (configManager.usePreset(preset)) {
              print(`✅ 已切换到 '${preset}' 配置`);
              const config = configManager.getConfig();
              print(`   最大思考 Token: ${config.thinking.maxThinkingTokens}`);
              print(`   压缩级别: ${config.compression.level}`);
              print(`   缓存: ${config.cache.enabled ? "启用" : "禁用"}`);
            } else {
              print(`❌ 未知预设: ${preset}`);
              print(`   可用预设: ${configManager.getPresetNames().join(", ")}`);
            }
            break;
          }

          case "template": {
            const templates = templateRegistry.getAll();
            print("📚 已注册模板:\n");
            templates.forEach((template) => {
              print(`   📁 ${template.name}`);
              print(`      领域: ${template.domain}`);
              print(`      触发词: ${template.triggers.slice(0, 3).join(", ")}`);
              print("");
            });
            break;
          }

          case "stats": {
            const metrics = engine.getPerformanceMetrics();
            print("📈 性能统计:\n");
            print(`   平均思考时间: ${metrics.avgThinkingTime.toFixed(0)}ms`);
            print(`   平均 Token: ${metrics.avgTokensUsed.toFixed(0)}`);
            print(`   缓存命中率: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
            print(`   压缩率: ${(metrics.compressionRatio * 100).toFixed(1)}%`);
            print("\n   深度分布:");
            Object.entries(metrics.depthDistribution).forEach(([depth, count]) => {
              print(`      ${depth}: ${count}`);
            });
            break;
          }

          case "help": {
            printHelp();
            break;
          }

          case "exit":
          case "quit":
          case "q": {
            print("\n👋 再见！\n");
            rl.close();
            return;
          }

          default:
            print(`❌ 未知命令: ${command}`);
            print("   输入 'help' 查看可用命令");
        }
      } catch (error) {
        print(`❌ 错误: ${error}`);
      }

      loop();
    });
  };

  loop();
}

// 运行
main().catch(console.error);
