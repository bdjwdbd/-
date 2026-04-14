/**
 * 核心决策组件
 * 
 * 包含：
 * - DecisionCenter: 决策中心
 * - MemoryCenter: 记忆中心
 * - SecurityAssessment: 安全评估
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

type DecisionType = "plan" | "act" | "reflect" | "learn";
type MemoryType = "short_term" | "long_term" | "episodic" | "semantic";

interface Decision {
  id: string;
  type: DecisionType;
  input: string;
  reasoning: string;
  output: any;
  confidence: number;
  timestamp: Date;
}

interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  importance: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

interface SecurityRisk {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  mitigation?: string;
}

interface DecisionConfig {
  maxHistory: number;
  confidenceThreshold: number;
}

interface MemoryConfig {
  maxShortTerm: number;
  maxLongTerm: number;
  compressionThreshold: number;
}

// ============================================================
// DecisionCenter - 决策中心
// ============================================================

export class DecisionCenter {
  private history: Decision[] = [];
  private config: DecisionConfig;
  
  constructor(config?: Partial<DecisionConfig>) {
    this.config = {
      maxHistory: 1000,
      confidenceThreshold: 0.7,
      ...config,
    };
  }
  
  async decide(type: DecisionType, input: string): Promise<Decision> {
    const reasoning = this.generateReasoning(type, input);
    const output = this.generateOutput(type, input);
    const confidence = this.calculateConfidence(type, input);
    
    const decision: Decision = {
      id: `decision-${Date.now()}`,
      type,
      input,
      reasoning,
      output,
      confidence,
      timestamp: new Date(),
    };
    
    this.history.push(decision);
    
    if (this.history.length > this.config.maxHistory) {
      this.history.shift();
    }
    
    return decision;
  }
  
  private generateReasoning(type: DecisionType, input: string): string {
    const templates: Record<DecisionType, string> = {
      plan: `分析任务 "${input}"，制定执行计划`,
      act: `基于输入 "${input}"，选择最佳行动`,
      reflect: `回顾执行结果，评估 "${input}" 的完成情况`,
      learn: `从经验中学习，总结 "${input}" 的教训`,
    };
    
    return templates[type];
  }
  
  private generateOutput(type: DecisionType, input: string): any {
    switch (type) {
      case "plan":
        return {
          steps: [
            { id: 1, action: "理解需求", status: "pending" },
            { id: 2, action: "制定方案", status: "pending" },
            { id: 3, action: "执行验证", status: "pending" },
          ],
        };
      case "act":
        return { action: "execute", params: { input } };
      case "reflect":
        return { assessment: "completed", score: 0.85 };
      case "learn":
        return { lesson: "优化执行流程", improvement: "增加缓存" };
      default:
        return {};
    }
  }
  
  private calculateConfidence(type: DecisionType, input: string): number {
    // 基于输入长度和类型计算置信度
    const baseConfidence = {
      plan: 0.8,
      act: 0.9,
      reflect: 0.7,
      learn: 0.6,
    };
    
    const lengthFactor = Math.min(input.length / 100, 1) * 0.1;
    
    return Math.min(1, baseConfidence[type] + lengthFactor);
  }
  
  getHistory(type?: DecisionType): Decision[] {
    if (type) {
      return this.history.filter(d => d.type === type);
    }
    return [...this.history];
  }
  
  getRecent(count: number = 10): Decision[] {
    return this.history.slice(-count);
  }
  
  clear(): void {
    this.history = [];
  }
}

// ============================================================
// MemoryCenter - 记忆中心
// ============================================================

export class MemoryCenter {
  private shortTerm: Map<string, Memory> = new Map();
  private longTerm: Map<string, Memory> = new Map();
  private config: MemoryConfig;
  
  constructor(config?: Partial<MemoryConfig>) {
    this.config = {
      maxShortTerm: 100,
      maxLongTerm: 1000,
      compressionThreshold: 0.7,
      ...config,
    };
  }
  
  remember(content: string, type: MemoryType = "short_term", importance: number = 0.5): Memory {
    const memory: Memory = {
      id: `memory-${Date.now()}`,
      type,
      content,
      importance,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
    };
    
    if (type === "short_term") {
      this.shortTerm.set(memory.id, memory);
      
      // 限制短期记忆
      if (this.shortTerm.size > this.config.maxShortTerm) {
        this.compressShortTerm();
      }
    } else {
      this.longTerm.set(memory.id, memory);
      
      // 限制长期记忆
      if (this.longTerm.size > this.config.maxLongTerm) {
        this.evictLeastImportant();
      }
    }
    
    return memory;
  }
  
  recall(query: string, limit: number = 10): Memory[] {
    const results: Memory[] = [];
    
    // 搜索短期记忆
    for (const memory of this.shortTerm.values()) {
      if (this.matchesQuery(memory, query)) {
        memory.lastAccessed = new Date();
        memory.accessCount++;
        results.push(memory);
      }
    }
    
    // 搜索长期记忆
    for (const memory of this.longTerm.values()) {
      if (this.matchesQuery(memory, query)) {
        memory.lastAccessed = new Date();
        memory.accessCount++;
        results.push(memory);
      }
    }
    
    // 按重要性和访问时间排序
    results.sort((a, b) => {
      const scoreA = a.importance * 0.5 + (a.accessCount / 10) * 0.3 + (a.lastAccessed.getTime() / Date.now()) * 0.2;
      const scoreB = b.importance * 0.5 + (b.accessCount / 10) * 0.3 + (b.lastAccessed.getTime() / Date.now()) * 0.2;
      return scoreB - scoreA;
    });
    
    return results.slice(0, limit);
  }
  
  forget(memoryId: string): boolean {
    return this.shortTerm.delete(memoryId) || this.longTerm.delete(memoryId);
  }
  
  private matchesQuery(memory: Memory, query: string): boolean {
    const queryLower = query.toLowerCase();
    return memory.content.toLowerCase().includes(queryLower);
  }
  
  private compressShortTerm(): void {
    // 将不重要的短期记忆移除或转为长期记忆
    const entries = Array.from(this.shortTerm.entries());
    entries.sort((a, b) => a[1].importance - b[1].importance);
    
    const toRemove = Math.floor(this.shortTerm.size * 0.2);
    
    for (let i = 0; i < toRemove; i++) {
      const [id, memory] = entries[i];
      
      if (memory.importance > this.config.compressionThreshold) {
        // 转为长期记忆
        memory.type = "long_term";
        this.longTerm.set(id, memory);
      }
      
      this.shortTerm.delete(id);
    }
  }
  
  private evictLeastImportant(): void {
    const entries = Array.from(this.longTerm.entries());
    entries.sort((a, b) => a[1].importance - b[1].importance);
    
    const toRemove = Math.floor(this.longTerm.size * 0.1);
    
    for (let i = 0; i < toRemove; i++) {
      this.longTerm.delete(entries[i][0]);
    }
  }
  
  getStats(): {
    shortTermCount: number;
    longTermCount: number;
    totalAccessCount: number;
  } {
    let totalAccess = 0;
    
    for (const memory of this.shortTerm.values()) {
      totalAccess += memory.accessCount;
    }
    
    for (const memory of this.longTerm.values()) {
      totalAccess += memory.accessCount;
    }
    
    return {
      shortTermCount: this.shortTerm.size,
      longTermCount: this.longTerm.size,
      totalAccessCount: totalAccess,
    };
  }
  
  clear(): void {
    this.shortTerm.clear();
    this.longTerm.clear();
  }
}

// ============================================================
// SecurityAssessment - 安全评估
// ============================================================

export class SecurityAssessment {
  private risks: SecurityRisk[] = [];
  
  assess(input: string): SecurityRisk[] {
    this.risks = [];
    
    // 检查危险模式
    this.checkCommandInjection(input);
    this.checkPathTraversal(input);
    this.checkSensitiveData(input);
    this.checkCodeExecution(input);
    
    return this.risks;
  }
  
  private checkCommandInjection(input: string): void {
    const patterns = [
      /;\s*(rm|del|format|shutdown)/i,
      /\|\s*(rm|del|format)/i,
      /`[^`]+`/,
      /\$\([^)]+\)/,
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        this.risks.push({
          type: "command_injection",
          severity: "critical",
          description: "检测到可能的命令注入",
          mitigation: "使用参数化命令或白名单验证",
        });
        break;
      }
    }
  }
  
  private checkPathTraversal(input: string): void {
    if (/\.\.[\/\\]/.test(input)) {
      this.risks.push({
        type: "path_traversal",
        severity: "high",
        description: "检测到路径遍历尝试",
        mitigation: "验证并规范化路径",
      });
    }
  }
  
  private checkSensitiveData(input: string): void {
    const patterns = [
      /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]+['"]/i,
      /(?:api[_-]?key|apikey)\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/i,
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        this.risks.push({
          type: "sensitive_data",
          severity: "high",
          description: "检测到可能的敏感数据",
          mitigation: "使用环境变量或密钥管理服务",
        });
        break;
      }
    }
  }
  
  private checkCodeExecution(input: string): void {
    if (/\beval\s*\(/.test(input)) {
      this.risks.push({
        type: "code_execution",
        severity: "critical",
        description: "检测到 eval() 调用",
        mitigation: "避免动态代码执行",
      });
    }
  }
  
  hasRisks(): boolean {
    return this.risks.length > 0;
  }
  
  getCriticalRisks(): SecurityRisk[] {
    return this.risks.filter(r => r.severity === "critical");
  }
  
  getHighRisks(): SecurityRisk[] {
    return this.risks.filter(r => r.severity === "high");
  }
  
  getRiskScore(): number {
    if (this.risks.length === 0) return 1;
    
    const weights = { low: 0.1, medium: 0.3, high: 0.6, critical: 1.0 };
    const totalWeight = this.risks.reduce((sum, r) => sum + weights[r.severity], 0);
    
    return Math.max(0, 1 - totalWeight / this.risks.length);
  }
}

export type {
  DecisionType,
  MemoryType,
  Decision,
  Memory,
  SecurityRisk,
  DecisionConfig,
  MemoryConfig,
};
