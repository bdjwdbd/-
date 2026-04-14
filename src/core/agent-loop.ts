import type { Context, Message, ToolCall, ToolResult, Tool } from "../types";

/**
 * Agent Loop：核心执行循环
 * 对应：OpenClaw 的 Agent Loop
 * 对应：ReAct 的 Thought → Action → Observation
 * 对应：Harness 的 PPAF 闭环
 */
export class AgentLoop {
  private tools: Map<string, Tool> = new Map();
  private maxIterations: number = 100;
  private llmEndpoint?: string;
  private apiKey?: string;

  /**
   * 配置 LLM
   */
  configureLLM(endpoint: string, apiKey: string): void {
    this.llmEndpoint = endpoint;
    this.apiKey = apiKey;
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取所有工具
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 运行 Agent
   */
  async run(context: Context): Promise<Context> {
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      // 1. Thought：推理（调用 LLM）
      const response = await this.think(context);
      
      // 2. 添加助手消息
      context.messages.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });

      // 3. 检查是否完成
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return context;
      }

      // 4. Action：执行工具调用
      for (const toolCall of response.toolCalls) {
        const result = await this.execute(toolCall);
        context.messages.push({
          role: "tool",
          content: JSON.stringify(result.result),
          toolResult: result,
        });
      }

      // 5. 更新 Token 计数
      context.tokens = this.estimateTokens(context.messages);
    }

    return context;
  }

  /**
   * Thought：推理
   */
  private async think(context: Context): Promise<{
    content: string;
    toolCalls?: ToolCall[];
  }> {
    // 如果配置了 LLM，调用实际 API
    if (this.llmEndpoint && this.apiKey) {
      return this.callLLM(context);
    }

    // 否则返回模拟响应
    return {
      content: "我已完成任务。",
      toolCalls: [],
    };
  }

  /**
   * 调用 LLM API
   */
  private async callLLM(context: Context): Promise<{
    content: string;
    toolCalls?: ToolCall[];
  }> {
    try {
      const response = await fetch(this.llmEndpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          messages: context.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          tools: this.tools.size > 0 ? Array.from(this.tools.values()).map(t => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })) : undefined,
        }),
      });

      const data = await response.json() as any;
      
      // 解析响应
      const message = data.choices?.[0]?.message;
      if (!message) {
        return { content: "" };
      }

      // 解析工具调用
      const toolCalls: ToolCall[] = [];
      if (message.tool_calls) {
        for (const tc of message.tool_calls) {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          });
        }
      }

      return {
        content: message.content || "",
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      console.error("[AgentLoop] LLM 调用失败:", error);
      return { content: "" };
    }
  }

  /**
   * Action：执行工具
   */
  private async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        result: { error: `Unknown tool: ${toolCall.name}` },
        isError: true,
      };
    }

    try {
      const result = await tool.execute(toolCall.arguments);
      return {
        toolCallId: toolCall.id,
        result,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        result: { error: (error as Error).message },
        isError: true,
      };
    }
  }

  /**
   * 估算 Token 数量
   */
  private estimateTokens(messages: Message[]): number {
    // 简单估算：每字符约 0.25 token
    return messages.reduce((sum, msg) => {
      return sum + Math.ceil(msg.content.length * 0.25);
    }, 0);
  }
}
