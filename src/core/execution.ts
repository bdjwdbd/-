/**
 * 执行与工具组件
 * 
 * 包含：
 * - ExecutionEngine: 执行引擎
 * - MessageChannel: 消息通道
 * - OneWayValve: 单向阀门
 * - ToolExecutor: 工具执行器
 * - ToolFramework: 工具框架
 * 
 * 安全集成：
 * - 所有命令执行前经过 SecurityGuard 检查
 * - 所有文件访问前经过 SecurityGuard 检查
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { SecurityGuard } from "../security-guard";

// ============================================================
// 类型定义
// ============================================================

type ExecutionStatus = "pending" | "running" | "completed" | "failed";
type MessagePriority = "low" | "normal" | "high" | "urgent";

interface Execution {
  id: string;
  command: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  priority: MessagePriority;
  timestamp: Date;
  read: boolean;
}

interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
}

// ============================================================
// 类型定义（增强）
// ============================================================

interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required?: boolean;
  enum?: string[];
  default?: string | number | boolean;
}

interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameter>;
  required?: string[];
}

interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

// ============================================================
// ExecutionEngine - 执行引擎
// ============================================================

export class ExecutionEngine {
  private executions: Map<string, Execution> = new Map();
  private maxConcurrent: number = 10;
  private activeCount: number = 0;
  private securityGuard: SecurityGuard;
  
  constructor(securityGuard?: SecurityGuard) {
    this.securityGuard = securityGuard || new SecurityGuard();
  }
  
  async execute(command: string): Promise<Execution> {
    const execution: Execution = {
      id: `exec-${Date.now()}`,
      command,
      status: "pending",
      startTime: new Date(),
    };
    
    this.executions.set(execution.id, execution);
    
    // 🔒 安全检查：命令执行前验证
    const securityResult = this.securityGuard.checkCommand(command);
    if (!securityResult.allowed) {
      execution.status = "failed";
      execution.error = `安全拦截: ${securityResult.message}`;
      execution.endTime = new Date();
      return execution;
    }
    
    // 记录安全警告
    if (securityResult.riskLevel !== "low") {
      console.warn(`[SecurityGuard] ${securityResult.message} (risk: ${securityResult.riskLevel})`);
    }
    
    // 等待执行槽
    while (this.activeCount >= this.maxConcurrent) {
      await new Promise(r => setTimeout(r, 100));
    }
    
    this.activeCount++;
    execution.status = "running";
    
    try {
      // 模拟执行
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
      execution.output = `执行完成: ${command}`;
      execution.status = "completed";
    } catch (error: any) {
      execution.error = error.message;
      execution.status = "failed";
    } finally {
      this.activeCount--;
      execution.endTime = new Date();
    }
    
    return execution;
  }
  
  getExecution(id: string): Execution | undefined {
    return this.executions.get(id);
  }
  
  getActiveExecutions(): Execution[] {
    return Array.from(this.executions.values()).filter(e => e.status === "running");
  }
  
  getRecentExecutions(count: number = 20): Execution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, count);
  }
  
  clear(): void {
    this.executions.clear();
  }
}

// ============================================================
// MessageChannel - 消息通道
// ============================================================

export class MessageChannel {
  private messages: Message[] = [];
  private maxMessages: number = 1000;
  
  send(from: string, to: string, content: string, priority: MessagePriority = "normal"): Message {
    const message: Message = {
      id: `msg-${Date.now()}`,
      from,
      to,
      content,
      priority,
      timestamp: new Date(),
      read: false,
    };
    
    this.messages.push(message);
    
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
    
    return message;
  }
  
  receive(to: string, unreadOnly: boolean = true): Message[] {
    let messages = this.messages.filter(m => m.to === to);
    
    if (unreadOnly) {
      messages = messages.filter(m => !m.read);
    }
    
    // 标记为已读
    messages.forEach(m => m.read = true);
    
    // 按优先级排序
    const priorityOrder: Record<MessagePriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    
    messages.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return messages;
  }
  
  broadcast(from: string, content: string, recipients: string[]): Message[] {
    return recipients.map(to => this.send(from, to, content, "normal"));
  }
  
  getUnreadCount(to: string): number {
    return this.messages.filter(m => m.to === to && !m.read).length;
  }
  
  clear(): void {
    this.messages = [];
  }
}

// ============================================================
// OneWayValve - 单向阀门
// ============================================================

export class OneWayValve {
  private checklist: Map<string, ChecklistItem> = new Map();
  private enabled: boolean = true;
  private locked: boolean = false;
  private originalJson: string = "";
  
  initFromJSON(jsonContent: string): void {
    try {
      const features = JSON.parse(jsonContent);
      this.checklist.clear();
      this.originalJson = jsonContent;
      
      for (const [key, value] of Object.entries(features)) {
        this.checklist.set(key, {
          id: key,
          description: String(value),
          completed: false,
        });
      }
    } catch (e) {
      throw new Error("无效的 JSON 内容");
    }
  }
  
  markComplete(itemId: string): boolean {
    if (!this.enabled || this.locked) return false;
    
    const item = this.checklist.get(itemId);
    if (!item) return false;
    
    item.completed = true;
    item.completedAt = new Date();
    
    return true;
  }
  
  isComplete(itemId: string): boolean {
    const item = this.checklist.get(itemId);
    return item?.completed || false;
  }
  
  allComplete(): boolean {
    if (this.checklist.size === 0) return true;
    return Array.from(this.checklist.values()).every(item => item.completed);
  }
  
  getCompletionRate(): number {
    if (this.checklist.size === 0) return 1;
    const completed = Array.from(this.checklist.values()).filter(item => item.completed).length;
    return completed / this.checklist.size;
  }
  
  getPendingItems(): ChecklistItem[] {
    return Array.from(this.checklist.values()).filter(item => !item.completed);
  }
  
  lock(): void {
    this.locked = true;
  }
  
  unlock(): void {
    this.locked = false;
  }
  
  disable(): void {
    this.enabled = false;
  }
  
  enable(): void {
    this.enabled = true;
  }
  
  verifyIntegrity(): boolean {
    if (!this.originalJson) return true;
    
    try {
      const current = JSON.stringify(this.exportToJson());
      const original = JSON.stringify(JSON.parse(this.originalJson));
      return current === original;
    } catch {
      return false;
    }
  }
  
  private exportToJson(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, item] of this.checklist) {
      result[key] = item.description;
    }
    return result;
  }
}

// ============================================================
// ToolExecutor - 工具执行器
// ============================================================

export class ToolExecutor {
  private tools: Map<string, Tool> = new Map();
  private callHistory: ToolCall[] = [];
  private maxHistory: number = 1000;
  private securityGuard: SecurityGuard;
  
  constructor(securityGuard?: SecurityGuard) {
    this.securityGuard = securityGuard || new SecurityGuard();
  }
  
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
  
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }
  
  async execute(name: string, args: Record<string, unknown>): Promise<ToolCall> {
    const tool = this.tools.get(name);
    
    const call: ToolCall = { name, args };
    
    // 🔒 安全检查：工具执行前验证参数
    const argsStr = JSON.stringify(args);
    const securityResult = this.securityGuard.checkCommand(`${name} ${argsStr}`);
    if (!securityResult.allowed) {
      call.error = `安全拦截: ${securityResult.message}`;
      this.recordCall(call);
      return call;
    }
    
    // 检查文件访问（如果参数中包含路径）
    if (args.path || args.filePath || args.file || args.dir) {
      const filePath = args.path || args.filePath || args.file || args.dir;
      const operation = name.includes('write') || name.includes('save') || name.includes('delete') ? 'write' : 'read';
      // @ts-ignore
      const fileSecurity = this.securityGuard.checkFileAccess(filePath, operation);
      // @ts-ignore
      // @ts-ignore
        // @ts-ignore
        // @ts-ignore
        // @ts-ignore
      if (!fileSecurity.allowed) {
        call.error = `安全拦截: ${fileSecurity.message}`;
        this.recordCall(call);
        return call;
      }
    }
    
    if (!tool) {
      call.error = `工具不存在: ${name}`;
      this.recordCall(call);
      return call;
    }
    
    try {
      call.result = await tool.execute(args);
    } catch (error: any) {
      call.error = error.message;
    }
    
    this.recordCall(call);
    return call;
  }
  
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
  
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
  
  getCallHistory(limit: number = 50): ToolCall[] {
    return this.callHistory.slice(-limit);
  }
  
  private recordCall(call: ToolCall): void {
    this.callHistory.push(call);
    
    if (this.callHistory.length > this.maxHistory) {
      this.callHistory.shift();
    }
  }
}

// ============================================================
// ToolFramework - 工具框架
// ============================================================

export class ToolFramework {
  private executor: ToolExecutor;
  
  constructor() {
    this.executor = new ToolExecutor();
  }
  
  defineTool(
    name: string,
    description: string,
    parameters: ToolParameters,
    handler: (args: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.executor.registerTool({
      name,
      description,
      parameters,
      execute: handler,
    });
  }
  
  async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.executor.execute(name, args);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.result;
  }
  
  getToolSchema(name: string): { name: string; description: string; parameters: ToolParameters } | null {
    const tool = this.executor.getTool(name);
    if (!tool) return null;
    
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };
  }
  
  getAllSchemas(): Array<{ name: string; description: string; parameters: ToolParameters }> {
    return this.executor.getToolNames()
      .map(name => this.getToolSchema(name))
      .filter((schema): schema is { name: string; description: string; parameters: ToolParameters } => schema !== null);
  }
  
  getExecutor(): ToolExecutor {
    return this.executor;
  }
}

export type {
  ExecutionStatus,
  MessagePriority,
  Execution,
  Message,
  ChecklistItem,
  Tool,
  ToolCall,
  ToolParameters,
  ToolParameter,
};
