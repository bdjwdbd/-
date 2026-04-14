/**
 * 上下文守卫
 * 
 * 防止记忆内容被当作指令执行
 * 融合自 yaoyao-memory-v2
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export interface GuardResult {
  safe: boolean;
  reason: string;
  sanitizedContent?: string;
  detectedPatterns: string[];
}

export interface GuardConfig {
  // 检测模式
  detectPromptInjection: boolean;
  detectSystemOverride: boolean;
  detectCommandExecution: boolean;
  
  // 处理方式
  sanitizeContent: boolean;
  blockOnDetection: boolean;
  
  // 自定义模式
  customPatterns: string[];
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: GuardConfig = {
  detectPromptInjection: true,
  detectSystemOverride: true,
  detectCommandExecution: true,
  sanitizeContent: true,
  blockOnDetection: false,
  customPatterns: []
};

// ============ 危险模式 ============

const DANGEROUS_PATTERNS = {
  promptInjection: [
    /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    /forget\s+(everything|all|previous)/gi,
    /disregard\s+(all|previous)/gi,
    /you\s+are\s+now/gi,
    /act\s+as\s+(if|a|an)/gi,
    /pretend\s+(to\s+be|you\s+are)/gi,
    /role[\s-]?play/gi,
    /jailbreak/gi,
    /DAN\s*:/gi,
  ],
  systemOverride: [
    /system\s*:\s*$/gim,
    /<\s*system\s*>/gi,
    /\[\s*system\s*\]/gi,
    /override\s+system/gi,
    /modify\s+(your|the)\s+(instructions?|behavior)/gi,
    /change\s+your\s+(instructions?|rules?)/gi,
  ],
  commandExecution: [
    /```(bash|shell|python|javascript|exec)/gi,
    /!\[.*?\]\(.*?\)/g,  // Markdown 图片可能包含恶意链接
    /\$\([^)]+\)/g,       // Shell 命令替换
    /`[^`]+`/g,           // 反引号命令
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /system\s*\(/gi,
  ]
};

// ============ 上下文守卫类 ============

export class ContextGuard {
  private logger: StructuredLogger;
  private config: GuardConfig;
  private detectionLog: Array<{ timestamp: number; content: string; patterns: string[] }>;

  constructor(logger: StructuredLogger, config?: Partial<GuardConfig>) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.detectionLog = [];
  }

  // ============ 内容检查 ============

  check(content: string): GuardResult {
    const detectedPatterns: string[] = [];

    // 检测 Prompt 注入
    if (this.config.detectPromptInjection) {
      for (const pattern of DANGEROUS_PATTERNS.promptInjection) {
        if (pattern.test(content)) {
          detectedPatterns.push(`prompt_injection:${pattern.source}`);
        }
      }
    }

    // 检测系统覆盖
    if (this.config.detectSystemOverride) {
      for (const pattern of DANGEROUS_PATTERNS.systemOverride) {
        if (pattern.test(content)) {
          detectedPatterns.push(`system_override:${pattern.source}`);
        }
      }
    }

    // 检测命令执行
    if (this.config.detectCommandExecution) {
      for (const pattern of DANGEROUS_PATTERNS.commandExecution) {
        if (pattern.test(content)) {
          detectedPatterns.push(`command_execution:${pattern.source}`);
        }
      }
    }

    // 检测自定义模式
    for (const customPattern of this.config.customPatterns) {
      try {
        const regex = new RegExp(customPattern, 'gi');
        if (regex.test(content)) {
          detectedPatterns.push(`custom:${customPattern}`);
        }
      } catch (e) {
        this.logger.warn('ContextGuard', `无效的正则表达式: ${customPattern}`);
      }
    }

    // 记录检测结果
    if (detectedPatterns.length > 0) {
      this.detectionLog.push({
        timestamp: Date.now(),
        content: content.substring(0, 100),
        patterns: detectedPatterns
      });
      this.logger.warn('ContextGuard', `检测到危险模式: ${detectedPatterns.length} 个`);
    }

    // 生成结果
    const safe = detectedPatterns.length === 0;
    let sanitizedContent: string | undefined;

    if (!safe && this.config.sanitizeContent) {
      sanitizedContent = this.sanitize(content, detectedPatterns);
    }

    return {
      safe: this.config.blockOnDetection ? safe : true,
      reason: safe ? '内容安全' : `检测到 ${detectedPatterns.length} 个危险模式`,
      sanitizedContent,
      detectedPatterns
    };
  }

  // ============ 内容清理 ============

  private sanitize(content: string, patterns: string[]): string {
    let sanitized = content;

    // 移除危险模式
    for (const patternStr of patterns) {
      const patternSource = patternStr.split(':')[1];
      try {
        const regex = new RegExp(patternSource, 'gi');
        sanitized = sanitized.replace(regex, '[REDACTED]');
      } catch (e) {}
    }

    // 包装在隔离标签中
    return `<memory_block>\n${sanitized}\n</memory_block>`;
  }

  // ============ 隔离标签 ============

  wrap(content: string): string {
    return `<memory_block>\n${content}\n</memory_block>`;
  }

  unwrap(content: string): string {
    const match = content.match(/<memory_block>\n?([\s\S]*?)\n?<\/memory_block>/);
    return match ? match[1] : content;
  }

  isWrapped(content: string): boolean {
    return /<memory_block>[\s\S]*?<\/memory_block>/.test(content);
  }

  // ============ 日志管理 ============

  getDetectionLog(): Array<{ timestamp: number; content: string; patterns: string[] }> {
    return [...this.detectionLog];
  }

  clearLog(): void {
    this.detectionLog = [];
    this.logger.info('ContextGuard', '检测日志已清空');
  }

  // ============ 配置管理 ============

  updateConfig(config: Partial<GuardConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('ContextGuard', '配置已更新');
  }

  getConfig(): GuardConfig {
    return { ...this.config };
  }

  addCustomPattern(pattern: string): void {
    if (!this.config.customPatterns.includes(pattern)) {
      this.config.customPatterns.push(pattern);
      this.logger.info('ContextGuard', `添加自定义模式: ${pattern}`);
    }
  }

  removeCustomPattern(pattern: string): void {
    const index = this.config.customPatterns.indexOf(pattern);
    if (index !== -1) {
      this.config.customPatterns.splice(index, 1);
      this.logger.info('ContextGuard', `移除自定义模式: ${pattern}`);
    }
  }

  // ============ 统计 ============

  getStats(): {
    totalDetections: number;
    byPatternType: Record<string, number>;
  } {
    const byPatternType: Record<string, number> = {};

    for (const entry of this.detectionLog) {
      for (const pattern of entry.patterns) {
        const type = pattern.split(':')[0];
        byPatternType[type] = (byPatternType[type] || 0) + 1;
      }
    }

    return {
      totalDetections: this.detectionLog.length,
      byPatternType
    };
  }
}
