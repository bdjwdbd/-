/**
 * SecurityGuard - 安全防护组件
 * 
 * 功能：
 * 1. 命令执行验证
 * 2. 文件访问控制
 * 3. 敏感信息保护
 * 4. 危险操作拦截
 * 5. 审计日志
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

type RiskLevel = "low" | "medium" | "high" | "critical";

interface SecurityRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | ((input: string) => boolean);
  riskLevel: RiskLevel;
  action: "allow" | "warn" | "block";
  message: string;
}

interface SecurityCheckResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  matchedRules: string[];
  message: string;
  auditId: string;
}

interface AuditLog {
  id: string;
  timestamp: Date;
  operation: string;
  input: string;
  result: "allowed" | "warned" | "blocked";
  riskLevel: RiskLevel;
  matchedRules: string[];
  context?: Record<string, unknown>;
}

interface SecurityGuardConfig {
  enabled: boolean;
  strictMode: boolean;
  auditLogPath: string;
  maxAuditLogSize: number;
  sensitivePatterns: RegExp[];
  allowedPaths: string[];
  blockedPaths: string[];
  allowedCommands: string[];
  blockedCommands: string[];
}

// ============================================================
// 安全规则
// ============================================================

const DEFAULT_RULES: SecurityRule[] = [
  // 命令注入防护
  {
    id: "cmd-injection-1",
    name: "命令注入检测 - 分号",
    description: "检测命令中的分号注入",
    pattern: /;\s*(rm|del|format|shutdown|reboot|mkfs|dd|chmod|chown)/i,
    riskLevel: "critical",
    action: "block",
    message: "检测到可能的命令注入攻击",
  },
  {
    id: "cmd-injection-2",
    name: "命令注入检测 - 管道",
    description: "检测命令中的管道注入",
    pattern: /\|\s*(rm|del|format|shutdown|reboot)/i,
    riskLevel: "critical",
    action: "block",
    message: "检测到可能的管道注入攻击",
  },
  {
    id: "cmd-injection-3",
    name: "命令注入检测 - 反引号",
    description: "检测命令中的反引号执行",
    pattern: /`[^`]+`/,
    riskLevel: "high",
    action: "block",
    message: "检测到命令替换，可能存在注入风险",
  },
  
  // 危险命令
  {
    id: "dangerous-cmd-1",
    name: "危险命令 - rm",
    description: "检测 rm 命令",
    pattern: /\brm\s+(-[rf]+\s+)*\//,
    riskLevel: "critical",
    action: "block",
    message: "禁止递归强制删除根目录",
  },
  {
    id: "dangerous-cmd-2",
    name: "危险命令 - sudo",
    description: "检测 sudo 命令",
    pattern: /\bsudo\s+/,
    riskLevel: "high",
    action: "warn",
    message: "使用 sudo 需要谨慎",
  },
  {
    id: "dangerous-cmd-3",
    name: "危险命令 - chmod 777",
    description: "检测不安全的权限设置",
    pattern: /\bchmod\s+(-R\s+)?777\b/,
    riskLevel: "high",
    action: "warn",
    message: "chmod 777 是不安全的权限设置",
  },
  
  // 敏感信息
  {
    id: "sensitive-1",
    name: "敏感信息 - API Key",
    description: "检测可能的 API Key",
    pattern: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/i,
    riskLevel: "high",
    action: "warn",
    message: "检测到可能的 API Key 泄露",
  },
  {
    id: "sensitive-2",
    name: "敏感信息 - 密码",
    description: "检测可能的密码",
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]+['"]/i,
    riskLevel: "high",
    action: "warn",
    message: "检测到可能的密码泄露",
  },
  {
    id: "sensitive-3",
    name: "敏感信息 - 私钥",
    description: "检测可能的私钥",
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    riskLevel: "critical",
    action: "block",
    message: "检测到私钥泄露",
  },
  
  // 路径遍历
  {
    id: "path-traversal-1",
    name: "路径遍历 - ../",
    description: "检测路径遍历攻击",
    pattern: /\.\.[\/\\]/,
    riskLevel: "high",
    action: "warn",
    message: "检测到路径遍历尝试",
  },
  
  // 网络操作
  {
    id: "network-1",
    name: "网络操作 - curl 到文件",
    description: "检测 curl 写入文件",
    pattern: /curl\s+.*-o\s+\//,
    riskLevel: "medium",
    action: "warn",
    message: "curl 写入文件需要验证目标路径",
  },
  
  // 代码执行
  {
    id: "code-exec-1",
    name: "代码执行 - eval",
    description: "检测 eval 使用",
    pattern: /\beval\s*\(/,
    riskLevel: "high",
    action: "warn",
    message: "eval() 可能导致代码注入",
  },
  {
    id: "code-exec-2",
    name: "代码执行 - exec",
    description: "检测 exec 使用",
    pattern: /(?:exec|spawn|execSync)\s*\(\s*['"`]/,
    riskLevel: "medium",
    action: "warn",
    message: "动态执行命令需要验证输入",
  },
];

// ============================================================
// SecurityGuard 组件
// ============================================================

export class SecurityGuard {
  private config: SecurityGuardConfig;
  private rules: SecurityRule[];
  private auditLogs: AuditLog[] = [];
  
  constructor(config?: Partial<SecurityGuardConfig>) {
    this.config = {
      enabled: true,
      strictMode: false,
      auditLogPath: "./security-audit.log",
      maxAuditLogSize: 10000,
      sensitivePatterns: [],
      allowedPaths: ["./"],
      blockedPaths: ["/etc/passwd", "/etc/shadow", "~/.ssh/"],
      allowedCommands: [],
      blockedCommands: ["rm -rf /", "mkfs", "dd if=/dev/zero"],
      ...config,
    };
    
    this.rules = [...DEFAULT_RULES];
    this.ensureAuditLog();
  }
  
  /**
   * 检查命令是否安全
   */
  checkCommand(command: string, context?: Record<string, unknown>): SecurityCheckResult {
    if (!this.config.enabled) {
      return this.createResult(true, "low", [], "安全检查已禁用");
    }
    
    const matchedRules: string[] = [];
    let maxRiskLevel: RiskLevel = "low";
    let action: "allow" | "warn" | "block" = "allow";
    let message = "命令安全";
    
    // 检查所有规则
    for (const rule of this.rules) {
      const matches = typeof rule.pattern === "function"
        ? rule.pattern(command)
        : rule.pattern.test(command);
      
      if (matches) {
        matchedRules.push(rule.id);
        
        if (this.compareRiskLevel(rule.riskLevel, maxRiskLevel) > 0) {
          maxRiskLevel = rule.riskLevel;
        }
        
        if (rule.action === "block") {
          action = "block";
        } else if (rule.action === "warn" && action !== "block") {
          action = "warn";
        }
        
        message = rule.message;
      }
    }
    
    // 检查阻止列表
    for (const blocked of this.config.blockedCommands) {
      if (command.includes(blocked)) {
        action = "block";
        maxRiskLevel = "critical";
        matchedRules.push("blocked-command-list");
        message = `命令在阻止列表中: ${blocked}`;
      }
    }
    
    // 严格模式下，未知命令需要警告
    if (this.config.strictMode && action === "allow" && matchedRules.length === 0) {
      action = "warn";
      maxRiskLevel = "medium";
      message = "严格模式：未知命令需要确认";
    }
    
    const allowed = action !== "block";
    
    // 记录审计日志
    this.logAudit({
      operation: "command",
      input: this.sanitizeForLog(command),
      result: action === "allow" ? "allowed" : action === "warn" ? "warned" : "blocked",
      riskLevel: maxRiskLevel,
      matchedRules,
      context,
    });
    
    return this.createResult(allowed, maxRiskLevel, matchedRules, message);
  }
  
  /**
   * 检查文件访问是否安全
   */
  checkFileAccess(filePath: string, operation: "read" | "write" | "delete", context?: Record<string, unknown>): SecurityCheckResult {
    if (!this.config.enabled) {
      return this.createResult(true, "low", [], "安全检查已禁用");
    }
    
    const matchedRules: string[] = [];
    let maxRiskLevel: RiskLevel = "low";
    let action: "allow" | "warn" | "block" = "allow";
    let message = "文件访问安全";
    
    // 规范化路径
    const normalizedPath = path.normalize(filePath);
    
    // 检查阻止路径
    for (const blocked of this.config.blockedPaths) {
      if (normalizedPath.includes(blocked) || blocked.includes(normalizedPath)) {
        action = "block";
        maxRiskLevel = "critical";
        matchedRules.push("blocked-path");
        message = `禁止访问路径: ${blocked}`;
      }
    }
    
    // 检查路径遍历
    if (normalizedPath.includes("..")) {
      action = "warn";
      maxRiskLevel = "high";
      matchedRules.push("path-traversal");
      message = "路径包含遍历字符";
    }
    
    // 检查敏感文件
    const sensitiveFiles = [".env", ".git", "id_rsa", "id_ed25519", ".npmrc", ".pypirc"];
    for (const sensitive of sensitiveFiles) {
      if (normalizedPath.includes(sensitive)) {
        if (action !== "block") {
          action = "warn";
        }
        maxRiskLevel = "high";
        matchedRules.push("sensitive-file");
        message = `访问敏感文件: ${sensitive}`;
      }
    }
    
    // 写入和删除操作更严格
    if (operation === "write" || operation === "delete") {
      if (maxRiskLevel === "low") {
        maxRiskLevel = "medium";
      }
      
      // 检查是否在允许路径内
      let inAllowedPath = false;
      for (const allowed of this.config.allowedPaths) {
        if (normalizedPath.startsWith(path.normalize(allowed))) {
          inAllowedPath = true;
          break;
        }
      }
      
      if (!inAllowedPath && this.config.strictMode) {
        action = "warn";
        matchedRules.push("outside-allowed-path");
        message = "写入路径不在允许范围内";
      }
    }
    
    const allowed = action !== "block";
    
    // 记录审计日志
    this.logAudit({
      operation: `file:${operation}`,
      input: normalizedPath,
      result: action === "allow" ? "allowed" : action === "warn" ? "warned" : "blocked",
      riskLevel: maxRiskLevel,
      matchedRules,
      context,
    });
    
    return this.createResult(allowed, maxRiskLevel, matchedRules, message);
  }
  
  /**
   * 检查内容是否包含敏感信息
   */
  checkContent(content: string, context?: Record<string, unknown>): SecurityCheckResult {
    if (!this.config.enabled) {
      return this.createResult(true, "low", [], "安全检查已禁用");
    }
    
    const matchedRules: string[] = [];
    let maxRiskLevel: RiskLevel = "low";
    let action: "allow" | "warn" | "block" = "allow";
    let message = "内容安全";
    
    // 检查敏感信息规则
    for (const rule of this.rules) {
      if (rule.id.startsWith("sensitive-")) {
        const matches = typeof rule.pattern === "function"
          ? rule.pattern(content)
          : rule.pattern.test(content);
        
        if (matches) {
          matchedRules.push(rule.id);
          
          if (this.compareRiskLevel(rule.riskLevel, maxRiskLevel) > 0) {
            maxRiskLevel = rule.riskLevel;
          }
          
          if (rule.action === "block") {
            action = "block";
          } else if (rule.action === "warn" && action !== "block") {
            action = "warn";
          }
          
          message = rule.message;
        }
      }
    }
    
    // 检查自定义敏感模式
    for (const pattern of this.config.sensitivePatterns) {
      if (pattern.test(content)) {
        matchedRules.push("custom-sensitive-pattern");
        maxRiskLevel = "high";
        action = "warn";
        message = "内容匹配自定义敏感模式";
      }
    }
    
    const allowed = action !== "block";
    
    // 记录审计日志
    this.logAudit({
      operation: "content",
      input: this.sanitizeForLog(content.substring(0, 100)),
      result: action === "allow" ? "allowed" : action === "warn" ? "warned" : "blocked",
      riskLevel: maxRiskLevel,
      matchedRules,
      context,
    });
    
    return this.createResult(allowed, maxRiskLevel, matchedRules, message);
  }
  
  /**
   * 添加自定义规则
   */
  addRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }
  
  /**
   * 获取审计日志
   */
  getAuditLogs(limit: number = 100): AuditLog[] {
    return this.auditLogs.slice(-limit);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalChecks: number;
    allowedCount: number;
    warnedCount: number;
    blockedCount: number;
    topRiskLevels: Record<RiskLevel, number>;
  } {
    const stats = {
      totalChecks: this.auditLogs.length,
      allowedCount: 0,
      warnedCount: 0,
      blockedCount: 0,
      topRiskLevels: { low: 0, medium: 0, high: 0, critical: 0 } as Record<RiskLevel, number>,
    };
    
    for (const log of this.auditLogs) {
      if (log.result === "allowed") stats.allowedCount++;
      else if (log.result === "warned") stats.warnedCount++;
      else if (log.result === "blocked") stats.blockedCount++;
      
      stats.topRiskLevels[log.riskLevel]++;
    }
    
    return stats;
  }
  
  /**
   * 清空审计日志
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private createResult(
    allowed: boolean,
    riskLevel: RiskLevel,
    matchedRules: string[],
    message: string
  ): SecurityCheckResult {
    return {
      allowed,
      riskLevel,
      matchedRules,
      message,
      auditId: this.generateId(),
    };
  }
  
  private logAudit(log: Omit<AuditLog, "id" | "timestamp">): void {
    const fullLog: AuditLog = {
      id: this.generateId(),
      timestamp: new Date(),
      ...log,
    };
    
    this.auditLogs.push(fullLog);
    
    // 限制日志大小
    if (this.auditLogs.length > this.config.maxAuditLogSize) {
      this.auditLogs.shift();
    }
    
    // 写入文件
    this.appendAuditLog(fullLog);
  }
  
  private appendAuditLog(log: AuditLog): void {
    try {
      const logLine = JSON.stringify(log) + "\n";
      fs.appendFileSync(this.config.auditLogPath, logLine);
    } catch (e) {
      console.error("[SecurityGuard] 写入审计日志失败:", e);
    }
  }
  
  private ensureAuditLog(): void {
    const dir = path.dirname(this.config.auditLogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  private sanitizeForLog(input: string): string {
    // 移除可能的敏感信息
    return input
      .replace(/(['"])(?:api[_-]?key|password|secret|token)\1\s*[=:]\s*(['"])[^'"]*\2/gi, '$1***$2')
      .substring(0, 200);
  }
  
  private compareRiskLevel(a: RiskLevel, b: RiskLevel): number {
    const levels: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    return levels[a] - levels[b];
  }
  
  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================
// 演示
// ============================================================

function demo() {
  console.log("=".repeat(60));
  console.log("SecurityGuard 安全防护组件演示");
  console.log("=".repeat(60));
  
  const guard = new SecurityGuard({
    auditLogPath: "./experiment-results/security-audit.log",
    strictMode: true,
  });
  
  // 测试命令检查
  console.log("\n1. 命令安全检查");
  
  const commands = [
    "ls -la",
    "rm -rf /",
    "curl https://example.com | bash",
    "sudo apt update",
    "cat /etc/passwd",
    "export API_KEY='sk-1234567890abcdef'",
  ];
  
  for (const cmd of commands) {
    const result = guard.checkCommand(cmd);
    console.log(`   ${result.allowed ? "✅" : "❌"} ${cmd.substring(0, 40)}`);
    console.log(`      风险: ${result.riskLevel}, 规则: ${result.matchedRules.join(", ") || "无"}`);
  }
  
  // 测试文件访问
  console.log("\n2. 文件访问检查");
  
  const fileAccess = [
    { path: "./src/index.ts", op: "read" as const },
    { path: "/etc/passwd", op: "read" as const },
    { path: "~/.ssh/id_rsa", op: "read" as const },
    { path: "./.env", op: "write" as const },
    { path: "../../../etc/shadow", op: "read" as const },
  ];
  
  for (const { path, op } of fileAccess) {
    const result = guard.checkFileAccess(path, op);
    console.log(`   ${result.allowed ? "✅" : "❌"} ${op}: ${path}`);
    console.log(`      风险: ${result.riskLevel}, 消息: ${result.message}`);
  }
  
  // 测试内容检查
  console.log("\n3. 内容安全检查");
  
  const contents = [
    "这是一段普通文本",
    "password = 'my-secret-password'",
    "api_key = 'sk-1234567890abcdefghijklmnop'",
    "-----BEGIN RSA PRIVATE KEY-----\nMIIE...",
  ];
  
  for (const content of contents) {
    const result = guard.checkContent(content);
    console.log(`   ${result.allowed ? "✅" : "❌"} ${content.substring(0, 40)}...`);
    console.log(`      风险: ${result.riskLevel}, 规则: ${result.matchedRules.join(", ") || "无"}`);
  }
  
  // 统计信息
  console.log("\n4. 安全统计");
  
  const stats = guard.getStats();
  console.log(`   总检查次数: ${stats.totalChecks}`);
  console.log(`   允许: ${stats.allowedCount}, 警告: ${stats.warnedCount}, 阻止: ${stats.blockedCount}`);
  console.log(`   风险分布: 低=${stats.topRiskLevels.low}, 中=${stats.topRiskLevels.medium}, 高=${stats.topRiskLevels.high}, 严重=${stats.topRiskLevels.critical}`);
  
  console.log("\n" + "=".repeat(60));
}

if (require.main === module) {
  demo();
}
