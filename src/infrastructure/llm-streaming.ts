/**
 * LLM 流式输出模块
 * 
 * 功能：
 * 1. 流式响应
 * 2. SSE 支持
 * 3. WebSocket 支持
 */

// ============================================================
// 类型定义
// ============================================================

export interface StreamChunk {
  content: string;
  finish: boolean;
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface StreamerConfig {
  chunkSize: number;
  timeout: number;
  maxTokens: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: StreamerConfig = {
  chunkSize: 10,
  timeout: 30000,
  maxTokens: 500,
};

// ============================================================
// 流式块
// ============================================================

export class StreamChunkImpl implements StreamChunk {
  content: string;
  finish: boolean;
  metadata: Record<string, unknown>;
  timestamp: number;

  constructor(content: string, finish: boolean = false, metadata: Record<string, unknown> = {}) {
    this.content = content;
    this.finish = finish;
    this.metadata = metadata;
    this.timestamp = Date.now();
  }

  /**
   * 转换为 SSE 格式
   */
  toSSE(): string {
    const data = {
      content: this.content,
      finish: this.finish,
      timestamp: this.timestamp,
    };
    return `data: ${JSON.stringify(data)}\n\n`;
  }

  /**
   * 转换为 JSON
   */
  toJSON(): string {
    return JSON.stringify({
      content: this.content,
      finish: this.finish,
      timestamp: this.timestamp,
    });
  }
}

// ============================================================
// LLM 流式输出器
// ============================================================

export class LLMStreamer {
  private config: StreamerConfig;
  private llmClient: ((prompt: string, options: Record<string, unknown>) => Promise<string>) | null = null;

  constructor(config: Partial<StreamerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 设置 LLM 客户端
   */
  setLLMClient(client: (prompt: string, options: Record<string, unknown>) => Promise<string>): void {
    this.llmClient = client;
  }

  /**
   * 流式生成
   */
  async *stream(
    prompt: string,
    options: { maxTokens?: number; temperature?: number } = {}
  ): AsyncGenerator<StreamChunk> {
    const maxTokens = options.maxTokens || this.config.maxTokens;

    if (this.llmClient) {
      // 使用真实 LLM
      try {
        const response = await this.llmClient(prompt, { maxTokens, temperature: options.temperature || 0.7 });
        
        // 模拟流式输出
        for (let i = 0; i < response.length; i += this.config.chunkSize) {
          const chunk = response.slice(i, i + this.config.chunkSize);
          yield new StreamChunkImpl(chunk, false);
        }
        
        yield new StreamChunkImpl('', true);
      } catch (error) {
        yield new StreamChunkImpl('', true, { error: String(error) });
      }
    } else {
      // 模拟流式输出
      const mockResponse = `这是对 "${prompt.slice(0, 50)}..." 的模拟响应。`;
      
      for (let i = 0; i < mockResponse.length; i += this.config.chunkSize) {
        const chunk = mockResponse.slice(i, i + this.config.chunkSize);
        yield new StreamChunkImpl(chunk, false);
        await this.delay(50);
      }
      
      yield new StreamChunkImpl('', true);
    }
  }

  /**
   * 收集所有流式输出
   */
  async collect(stream: AsyncGenerator<StreamChunk>): Promise<string> {
    let result = '';
    for await (const chunk of stream) {
      result += chunk.content;
    }
    return result;
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// SSE 服务器
// ============================================================

export class SSEServer {
  private clients: Set<{ write: (data: string) => void; end: () => void }> = new Set();

  /**
   * 添加客户端
   */
  addClient(client: { write: (data: string) => void; end: () => void }): void {
    this.clients.add(client);
  }

  /**
   * 移除客户端
   */
  removeClient(client: { write: (data: string) => void; end: () => void }): void {
    this.clients.delete(client);
  }

  /**
   * 发送事件
   */
  sendEvent(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.write(message);
    }
  }

  /**
   * 广播消息
   */
  broadcast(message: string): void {
    for (const client of this.clients) {
      client.write(`data: ${message}\n\n`);
    }
  }

  /**
   * 关闭所有客户端
   */
  closeAll(): void {
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
  }

  /**
   * 获取客户端数量
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// ============================================================
// WebSocket 处理器
// ============================================================

export class WebSocketHandler {
  private connections: Set<unknown> = new Set();
  private messageHandlers: Map<string, (data: unknown) => void> = new Map();

  /**
   * 添加连接
   */
  addConnection(connection: unknown): void {
    this.connections.add(connection);
  }

  /**
   * 移除连接
   */
  removeConnection(connection: unknown): void {
    this.connections.delete(connection);
  }

  /**
   * 注册消息处理器
   */
  onMessage(type: string, handler: (data: unknown) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 处理消息
   */
  handleMessage(type: string, data: unknown): void {
    const handler = this.messageHandlers.get(type);
    if (handler) {
      handler(data);
    }
  }

  /**
   * 广播消息
   */
  broadcast(message: unknown): void {
    // 实际实现需要 WebSocket 库
    console.log('Broadcast:', message);
  }

  /**
   * 获取连接数
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
