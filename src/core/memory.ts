import type { Message } from "../types";
import * as fs from "fs";
import * as path from "path";

/**
 * 记忆系统
 * 对应：OpenClaw 的 Memory System
 * 对应：Harness 的 L1/L2/L3 分层记忆
 */
export class Memory {
  // L1：工作记忆（当前上下文）
  private workingMemory: Message[] = [];
  
  // L2：短期记忆（会话记忆）
  private sessionMemory: Map<string, Message[]> = new Map();
  
  // L3：长期记忆（持久化存储）
  private storageDir: string;

  constructor(storageDir: string = "./memory") {
    this.storageDir = storageDir;
    this.ensureDir(storageDir);
  }

  /**
   * 加载工作记忆
   */
  load(sessionId: string): Message[] {
    // 优先从 L2 加载
    if (this.sessionMemory.has(sessionId)) {
      this.workingMemory = [...this.sessionMemory.get(sessionId)!];
    } else {
      // 尝试从 L3 加载
      const filePath = path.join(this.storageDir, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          this.workingMemory = data.messages || [];
          this.sessionMemory.set(sessionId, [...this.workingMemory]);
        } catch {
          this.workingMemory = [];
        }
      }
    }
    return this.workingMemory;
  }

  /**
   * 保存工作记忆
   */
  save(sessionId: string): void {
    // L1 → L2
    this.sessionMemory.set(sessionId, [...this.workingMemory]);
    
    // L2 → L3
    const filePath = path.join(this.storageDir, `${sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify({
      sessionId,
      messages: this.workingMemory,
      savedAt: new Date().toISOString(),
    }, null, 2));
  }

  /**
   * 添加消息
   */
  addMessage(message: Message): void {
    this.workingMemory.push(message);
  }

  /**
   * 获取所有消息
   */
  getMessages(): Message[] {
    return this.workingMemory;
  }

  /**
   * 清空工作记忆
   */
  clear(): void {
    this.workingMemory = [];
  }

  /**
   * 压缩记忆
   * 对应：OpenClaw 的 Compaction
   */
  async compact(): Promise<string> {
    if (this.workingMemory.length <= 10) {
      return "";
    }

    // 保留最近 10 条消息
    const recent = this.workingMemory.slice(-10);
    const old = this.workingMemory.slice(0, -10);

    // 生成摘要
    const summary = await this.summarize(old);

    // 替换为摘要
    this.workingMemory = [
      { role: "system", content: `历史摘要：${summary}` },
      ...recent,
    ];

    return summary;
  }

  /**
   * 生成摘要
   */
  private async summarize(messages: Message[]): Promise<string> {
    // 简单摘要：统计消息数量和角色
    const roleCounts: Record<string, number> = {};
    for (const msg of messages) {
      roleCounts[msg.role] = (roleCounts[msg.role] || 0) + 1;
    }
    return `共 ${messages.length} 条消息（${Object.entries(roleCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}）`;
  }

  /**
   * 获取记忆统计
   */
  getStats(): {
    workingMemorySize: number;
    sessionCount: number;
    persistedSessions: number;
  } {
    // 统计持久化的会话数
    let persistedSessions = 0;
    if (fs.existsSync(this.storageDir)) {
      const files = fs.readdirSync(this.storageDir);
      persistedSessions = files.filter(f => f.endsWith(".json")).length;
    }

    return {
      workingMemorySize: this.workingMemory.length,
      sessionCount: this.sessionMemory.size,
      persistedSessions,
    };
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
