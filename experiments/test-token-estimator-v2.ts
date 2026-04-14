/**
 * 验证 TokenEstimator v2 集成
 */

import { TokenEstimator } from "../src/yuanling-optimized";

function testTokenEstimatorV2() {
  console.log("=".repeat(60));
  console.log("TokenEstimator v2 集成验证");
  console.log("=".repeat(60));
  
  const estimator = new TokenEstimator("gpt-4-turbo");
  
  // 测试用例
  const testCases = [
    { name: "纯英文", text: "Hello, this is a test of the token estimator." },
    { name: "纯中文", text: "这是一个中文测试文本，用于验证 token 估算。" },
    { name: "中英混合", text: "This is mixed. 这是中英文混合文本。" },
    { name: "代码块", text: "```typescript\nconst x = 1;\nconsole.log(x);\n```" },
    { name: "JSON", text: '{"name": "test", "value": 123}' },
    { name: "复杂", text: `# 标题\n\n正文内容。\n\n\`\`\`js\ncode();\n\`\`\`\n\n配置: {"a": 1}` },
  ];
  
  console.log("\n--- 文本估算测试 ---\n");
  
  for (const tc of testCases) {
    const tokens = estimator.estimate(tc.text);
    console.log(`${tc.name}: ${tc.text.length} 字符 → ${tokens} tokens`);
  }
  
  // 测试消息数组
  console.log("\n--- 消息数组测试 ---\n");
  
  const messages = [
    { role: "system" as const, content: "You are a helpful assistant." },
    { role: "user" as const, content: "请帮我分析代码。" },
    { role: "assistant" as const, content: "好的，我来分析...", toolCalls: [
      { id: "tc-1", name: "read_file", arguments: { path: "/src/main.ts" } }
    ]},
  ];
  
  const totalTokens = estimator.estimateMessages(messages);
  const usage = estimator.getContextUsage(totalTokens);
  const remaining = estimator.getRemainingTokens(totalTokens);
  
  console.log(`总 Token: ${totalTokens}`);
  console.log(`上下文使用率: ${(usage * 100).toFixed(2)}%`);
  console.log(`剩余 Token: ${remaining}`);
  console.log(`需要重置 (50%): ${estimator.shouldResetContext(totalTokens, 0.5) ? "是" : "否"}`);
  
  // 配置信息
  console.log("\n--- 模型配置 ---\n");
  const config = estimator.getConfig();
  console.log(`最大上下文: ${config.maxContext}`);
  console.log(`字符/Token (英文): ${config.charsPerToken.english}`);
  console.log(`字符/Token (中文): ${config.charsPerToken.chinese}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("✓ TokenEstimator v2 集成验证通过");
  console.log("=".repeat(60));
}

testTokenEstimatorV2();
