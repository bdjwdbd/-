/**
 * TokenEstimator v2 - 精确 Token 估算器
 * 
 * 优化内容：
 * 1. 更精确的中英文混合估算
 * 2. 代码 token 特殊处理
 * 3. 工具调用开销精确计算
 * 4. 支持不同模型的 tokenizer 差异
 */

// ============================================================
// 类型定义
// ============================================================

interface TokenizerConfig {
  model: string;
  maxContext: number;
  charsPerToken: {
    english: number;
    chinese: number;
    code: number;
    json: number;
  };
  overhead: {
    perMessage: number;
    perToolCall: number;
    systemPrompt: number;
  };
}

interface TokenEstimationResult {
  total: number;
  breakdown: {
    content: number;
    overhead: number;
    toolCalls: number;
  };
  contextUsage: number;
  remaining: number;
}

// ============================================================
// 预定义配置
// ============================================================

const MODEL_CONFIGS: Record<string, TokenizerConfig> = {
  "gpt-4": {
    model: "gpt-4",
    maxContext: 8192,
    charsPerToken: { english: 4, chinese: 1.5, code: 3, json: 2.5 },
    overhead: { perMessage: 4, perToolCall: 10, systemPrompt: 10 },
  },
  "gpt-4-turbo": {
    model: "gpt-4-turbo",
    maxContext: 128000,
    charsPerToken: { english: 4, chinese: 1.5, code: 3, json: 2.5 },
    overhead: { perMessage: 4, perToolCall: 10, systemPrompt: 10 },
  },
  "claude-3": {
    model: "claude-3",
    maxContext: 200000,
    charsPerToken: { english: 3.5, chinese: 1.3, code: 2.8, json: 2.2 },
    overhead: { perMessage: 5, perToolCall: 12, systemPrompt: 15 },
  },
  "qwen": {
    model: "qwen",
    maxContext: 32000,
    charsPerToken: { english: 4, chinese: 1.2, code: 3, json: 2.5 },
    overhead: { perMessage: 4, perToolCall: 10, systemPrompt: 10 },
  },
  "glm": {
    model: "glm",
    maxContext: 128000,
    charsPerToken: { english: 4, chinese: 1.1, code: 3, json: 2.5 },
    overhead: { perMessage: 4, perToolCall: 10, systemPrompt: 10 },
  },
};

// ============================================================
// TokenEstimator v2
// ============================================================

export class TokenEstimatorV2 {
  private config: TokenizerConfig;
  
  constructor(model: string = "gpt-4-turbo") {
    this.config = MODEL_CONFIGS[model] || MODEL_CONFIGS["gpt-4-turbo"];
  }
  
  /**
   * 设置模型
   */
  setModel(model: string): void {
    this.config = MODEL_CONFIGS[model] || this.config;
  }
  
  /**
   * 精确估算文本 token 数量
   */
  estimateText(text: string): number {
    if (!text) return 0;
    
    // 分析文本组成
    const analysis = this.analyzeText(text);
    
    // 分别计算不同类型的 token
    let tokens = 0;
    
    // 英文部分
    tokens += Math.ceil(analysis.englishChars / this.config.charsPerToken.english);
    
    // 中文部分
    tokens += Math.ceil(analysis.chineseChars / this.config.charsPerToken.chinese);
    
    // 代码部分
    tokens += Math.ceil(analysis.codeChars / this.config.charsPerToken.code);
    
    // JSON 部分
    tokens += Math.ceil(analysis.jsonChars / this.config.charsPerToken.json);
    
    // 特殊字符和空白
    tokens += Math.ceil(analysis.specialChars / 10);
    tokens += Math.ceil(analysis.whitespace / 8);
    
    // 最小值
    return Math.max(1, tokens);
  }
  
  /**
   * 估算消息数组的 token 数量
   */
  estimateMessages(messages: Array<{ role: string; content: string; toolCalls?: any[] }>): TokenEstimationResult {
    let contentTokens = 0;
    let overheadTokens = 0;
    let toolCallTokens = 0;
    
    // 系统提示开销
    overheadTokens += this.config.overhead.systemPrompt;
    
    for (const msg of messages) {
      // 消息开销
      overheadTokens += this.config.overhead.perMessage;
      
      // 内容 token
      contentTokens += this.estimateText(msg.content);
      
      // 角色标记
      overheadTokens += 1;
      
      // 工具调用
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          toolCallTokens += this.config.overhead.perToolCall;
          toolCallTokens += this.estimateText(tc.name || "");
          toolCallTokens += this.estimateText(JSON.stringify(tc.arguments || {}));
        }
      }
    }
    
    // 对话固定开销
    overheadTokens += 3;
    
    const total = contentTokens + overheadTokens + toolCallTokens;
    
    return {
      total,
      breakdown: {
        content: contentTokens,
        overhead: overheadTokens,
        toolCalls: toolCallTokens,
      },
      contextUsage: total / this.config.maxContext,
      remaining: this.config.maxContext - total,
    };
  }
  
  /**
   * 分析文本组成
   */
  private analyzeText(text: string): {
    englishChars: number;
    chineseChars: number;
    codeChars: number;
    jsonChars: number;
    specialChars: number;
    whitespace: number;
  } {
    let englishChars = 0;
    let chineseChars = 0;
    let codeChars = 0;
    let jsonChars = 0;
    let specialChars = 0;
    let whitespace = 0;
    
    // 检测代码块
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks = text.match(codeBlockRegex) || [];
    let textWithoutCode = text.replace(codeBlockRegex, "");
    
    // 代码块字符
    for (const block of codeBlocks) {
      codeChars += block.length;
    }
    
    // 检测 JSON 块
    const jsonRegex = /\{[\s\S]*?\}/g;
    const jsonBlocks = textWithoutCode.match(jsonRegex) || [];
    textWithoutCode = textWithoutCode.replace(jsonRegex, "");
    
    // JSON 字符
    for (const block of jsonBlocks) {
      if (this.isValidJson(block)) {
        jsonChars += block.length;
      }
    }
    
    // 分析剩余字符
    for (const char of textWithoutCode) {
      if (/[\u4e00-\u9fa5]/.test(char)) {
        chineseChars++;
      } else if (/[a-zA-Z0-9]/.test(char)) {
        englishChars++;
      } else if (/\s/.test(char)) {
        whitespace++;
      } else {
        specialChars++;
      }
    }
    
    return {
      englishChars,
      chineseChars,
      codeChars,
      jsonChars,
      specialChars,
      whitespace,
    };
  }
  
  /**
   * 检测是否为有效 JSON
   */
  private isValidJson(text: string): boolean {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 获取配置信息
   */
  getConfig(): TokenizerConfig {
    return { ...this.config };
  }
  
  /**
   * 计算上下文使用率
   */
  calculateContextUsage(currentTokens: number): number {
    return currentTokens / this.config.maxContext;
  }
  
  /**
   * 检查是否需要重置上下文
   */
  shouldResetContext(currentTokens: number, threshold: number = 0.5): boolean {
    return this.calculateContextUsage(currentTokens) >= threshold;
  }
}

// ============================================================
// 测试和验证
// ============================================================

function testTokenEstimator() {
  const estimator = new TokenEstimatorV2("gpt-4-turbo");
  
  console.log("=".repeat(60));
  console.log("TokenEstimator v2 测试");
  console.log("=".repeat(60));
  
  // 测试用例
  const testCases = [
    {
      name: "纯英文",
      text: "Hello, this is a test of the token estimator. It should accurately count tokens for English text.",
    },
    {
      name: "纯中文",
      text: "这是一个中文测试文本。我们需要准确估算中文字符的 token 数量。",
    },
    {
      name: "中英混合",
      text: "This is a mixed text. 这是一段中英文混合的文本，用于测试 token 估算的准确性。",
    },
    {
      name: "代码块",
      text: "Here is some code:\n```typescript\nfunction hello() {\n  console.log('Hello, World!');\n}\n```",
    },
    {
      name: "JSON 数据",
      text: 'Configuration: {"name": "test", "value": 123, "enabled": true}',
    },
    {
      name: "复杂混合",
      text: `# 项目说明

这是一个 AI Agent 项目。

## 代码示例

\`\`\`typescript
const agent = new Agent({
  model: "gpt-4",
  tools: ["read", "write", "execute"]
});
\`\`\`

## 配置

\`\`\`json
{
  "maxTokens": 4096,
  "temperature": 0.7
}
\`\`\`

中文说明：这个项目使用了最新的 AI 技术。`,
    },
  ];
  
  console.log("\n--- 单文本测试 ---\n");
  
  for (const tc of testCases) {
    const tokens = estimator.estimateText(tc.text);
    const charsPerToken = tc.text.length / tokens;
    console.log(`${tc.name}:`);
    console.log(`  字符数: ${tc.text.length}`);
    console.log(`  Token 数: ${tokens}`);
    console.log(`  字符/Token: ${charsPerToken.toFixed(2)}`);
    console.log("");
  }
  
  // 测试消息数组
  console.log("\n--- 消息数组测试 ---\n");
  
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "请帮我分析这段代码的性能问题。" },
    { role: "assistant", content: "好的，我来分析一下。首先需要看代码...", toolCalls: [
      { name: "read_file", arguments: { path: "/src/main.ts" } }
    ]},
    { role: "user", content: "分析结果如何？" },
  ];
  
  const result = estimator.estimateMessages(messages);
  
  console.log("消息数组估算结果:");
  console.log(`  总 Token: ${result.total}`);
  console.log(`  内容 Token: ${result.breakdown.content}`);
  console.log(`  开销 Token: ${result.breakdown.overhead}`);
  console.log(`  工具调用 Token: ${result.breakdown.toolCalls}`);
  console.log(`  上下文使用率: ${(result.contextUsage * 100).toFixed(2)}%`);
  console.log(`  剩余 Token: ${result.remaining}`);
  
  console.log("\n" + "=".repeat(60));
}

// 运行测试
if (require.main === module) {
  testTokenEstimator();
}

export { MODEL_CONFIGS };
