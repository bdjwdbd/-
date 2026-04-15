/**
 * 感知与唤醒组件
 * 
 * 包含：
 * - EnvironmentAwareness: 环境感知
 * - ContentUnderstanding: 内容理解
 * - CommandParser: 命令解析
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================
// 类型定义
// ============================================================

type ContentType = "text" | "code" | "json" | "markdown" | "unknown";
type IntentType = "question" | "command" | "statement" | "request" | "unknown";

interface Environment {
  os: string;
  nodeVersion: string;
  cwd: string;
  home: string;
  hostname: string;
  platform: string;
  arch: string;
  gitBranch?: string;
  gitStatus?: string;
  soulMd?: string;
  userMd?: string;
  toolsMd?: string;
}

interface ContentAnalysis {
  type: ContentType;
  language?: string;
  intent: IntentType;
  keywords: string[];
  entities: Array<{ type: string; value: string }>;
  sentiment: "positive" | "negative" | "neutral";
  complexity: number;
}

interface ParsedCommand {
  action: string;
  params: Record<string, unknown>;
  options: Record<string, unknown>;
  raw: string;
}

// ============================================================
// EnvironmentAwareness - 环境感知
// ============================================================

export class EnvironmentAwareness {
  private environment: Environment | null = null;
  private lastUpdate: Date | null = null;
  private updateInterval: number = 60000; // 1分钟
  
  async sense(): Promise<Environment> {
    const now = new Date();
    
    // 检查是否需要更新
    if (this.environment && this.lastUpdate) {
      const elapsed = now.getTime() - this.lastUpdate.getTime();
      if (elapsed < this.updateInterval) {
        return this.environment;
      }
    }
    
    // 收集环境信息
    this.environment = {
      os: os.type(),
      nodeVersion: process.version,
      cwd: process.cwd(),
      home: os.homedir(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
    };
    
    // 获取 Git 信息
    try {
      const { execSync } = require("child_process");
      this.environment.gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
      this.environment.gitStatus = execSync("git status --short", { encoding: "utf-8" }).trim();
    } catch {
      // Git 不可用
    }
    
    // 读取配置文件
    this.environment.soulMd = this.readFileIfExists("./SOUL.md");
    this.environment.userMd = this.readFileIfExists("./USER.md");
    this.environment.toolsMd = this.readFileIfExists("./TOOLS.md");
    
    this.lastUpdate = now;
    
    return this.environment;
  }
  
  private readFileIfExists(filePath: string): string | undefined {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8").substring(0, 1000);
      }
    } catch {
      // 忽略错误
    }
    return undefined;
  }
  
  getEnvironment(): Environment | null {
    return this.environment;
  }
  
  getCwd(): string {
    return this.environment?.cwd || process.cwd();
  }
  
  hasGit(): boolean {
    return !!this.environment?.gitBranch;
  }
  
  hasSoul(): boolean {
    return !!this.environment?.soulMd;
  }
  
  hasUser(): boolean {
    return !!this.environment?.userMd;
  }
  
  hasTools(): boolean {
    return !!this.environment?.toolsMd;
  }
  
  async threeStepWakeup(): Promise<{
    step1: boolean;
    step2: boolean;
    step3: boolean;
    ready: boolean;
  }> {
    const env = await this.sense();
    
    const step1 = this.hasSoul();
    const step2 = this.hasUser();
    const step3 = this.hasTools();
    
    return {
      step1,
      step2,
      step3,
      ready: step1 && step2 && step3,
    };
  }
}

// ============================================================
// ContentUnderstanding - 内容理解
// ============================================================

export class ContentUnderstanding {
  analyze(content: string): ContentAnalysis {
    const type = this.detectType(content);
    const language = type === "code" ? this.detectLanguage(content) : undefined;
    const intent = this.detectIntent(content);
    const keywords = this.extractKeywords(content);
    const entities = this.extractEntities(content);
    const sentiment = this.analyzeSentiment(content);
    const complexity = this.calculateComplexity(content);
    
    return {
      type,
      language,
      intent,
      keywords,
      entities,
      sentiment,
      complexity,
    };
  }
  
  private detectType(content: string): ContentType {
    // 检测 JSON
    if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
      try {
        JSON.parse(content);
        return "json";
      } catch {}
    }
    
    // 检测代码
    const codePatterns = [
      /^(function|class|import|export|const|let|var)\s/m,
      /^(def|class|import|from)\s/m,
      /^(package|func|type)\s/m,
    ];
    
    for (const pattern of codePatterns) {
      if (pattern.test(content)) {
        return "code";
      }
    }
    
    // 检测 Markdown
    if (/^#{1,6}\s|^\*{1,2}[^*]+\*{1,2}|^```/m.test(content)) {
      return "markdown";
    }
    
    return "text";
  }
  
  private detectLanguage(content: string): string {
    const patterns: Record<string, RegExp> = {
      typescript: /^import.*from|^export\s|:\s*\w+\s*[;=]/m,
      javascript: /^const\s|^let\s|^var\s|^function\s/m,
      python: /^def\s|^class\s|^import\s/m,
      go: /^package\s|^func\s|^type\s/m,
      rust: /^fn\s|^let\s|^use\s/m,
    };
    
    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        return lang;
      }
    }
    
    return "unknown";
  }
  
  private detectIntent(content: string): IntentType {
    const lower = content.toLowerCase();
    
    if (lower.includes("?") || lower.startsWith("what") || lower.startsWith("how") || lower.startsWith("why")) {
      return "question";
    }
    
    if (lower.startsWith("please") || lower.startsWith("can you") || lower.startsWith("help me")) {
      return "request";
    }
    
    if (lower.startsWith("run") || lower.startsWith("execute") || lower.startsWith("create")) {
      return "command";
    }
    
    return "statement";
  }
  
  private extractKeywords(content: string): string[] {
    // 简单的关键词提取
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "under", "again", "further", "then", "once"]);
    
    return [...new Set(words.filter(w => w.length > 3 && !stopWords.has(w)))].slice(0, 10);
  }
  
  private extractEntities(content: string): Array<{ type: string; value: string }> {
    const entities: Array<{ type: string; value: string }> = [];
    
    // 提取 URL
    const urlPattern = /https?:\/\/[^\s]+/g;
    let match;
    while ((match = urlPattern.exec(content)) !== null) {
      entities.push({ type: "url", value: match[0] });
    }
    
    // 提取邮箱
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
    while ((match = emailPattern.exec(content)) !== null) {
      entities.push({ type: "email", value: match[0] });
    }
    
    // 提取数字
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    while ((match = numberPattern.exec(content)) !== null) {
      entities.push({ type: "number", value: match[0] });
    }
    
    return entities;
  }
  
  private analyzeSentiment(content: string): "positive" | "negative" | "neutral" {
    const positiveWords = ["good", "great", "excellent", "amazing", "wonderful", "fantastic", "love", "like", "happy", "pleased"];
    const negativeWords = ["bad", "terrible", "awful", "horrible", "hate", "dislike", "sad", "angry", "frustrated", "disappointed"];
    
    const lower = content.toLowerCase();
    
    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;
    
    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }
  
  private calculateComplexity(content: string): number {
    // 基于长度、嵌套深度、特殊字符等计算复杂度
    let complexity = 0;
    
    // 长度因素
    complexity += Math.min(content.length / 1000, 0.3);
    
    // 嵌套深度
    const nesting = (content.match(/[{\[\(]/g) || []).length;
    complexity += Math.min(nesting / 20, 0.3);
    
    // 特殊字符
    const special = (content.match(/[^\w\s]/g) || []).length;
    complexity += Math.min(special / 100, 0.2);
    
    // 行数
    const lines = content.split("\n").length;
    complexity += Math.min(lines / 50, 0.2);
    
    return Math.min(complexity, 1);
  }
}

// ============================================================
// CommandParser - 命令解析
// ============================================================

export class CommandParser {
  parse(input: string): ParsedCommand {
    const parts = input.trim().split(/\s+/);
    
    if (parts.length === 0) {
      return { action: "", params: {}, options: {}, raw: input };
    }
    
    const action = parts[0];
    const params: Record<string, unknown> = {};
    const options: Record<string, unknown> = {};
    
    let i = 1;
    while (i < parts.length) {
      const part = parts[i];
      
      // 选项（以 - 或 -- 开头）
      if (part.startsWith("--")) {
        const key = part.slice(2);
        const value = parts[i + 1] && !parts[i + 1].startsWith("-") ? parts[i + 1] : true;
        options[key] = value;
        if (value !== true) i++;
      } else if (part.startsWith("-")) {
        const key = part.slice(1);
        options[key] = true;
      } else {
        // 参数
        if (part.includes("=")) {
          const [key, value] = part.split("=", 2);
          params[key] = value;
        } else {
          params[`arg${Object.keys(params).length}`] = part;
        }
      }
      
      i++;
    }
    
    return { action, params, options, raw: input };
  }
}

export type {
  ContentType,
  IntentType,
  Environment,
  ContentAnalysis,
  ParsedCommand,
};
