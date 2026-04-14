/**
 * 灵思层配置系统
 * 
 * 统一管理所有配置选项
 */

import {
  ThinkingConfig,
  DEFAULT_THINKING_CONFIG,
} from "./types";

// ============================================================
// 配置类型定义
// ============================================================

/**
 * 灵思层完整配置
 */
export interface LingSiConfig {
  /** 思考协议配置 */
  thinking: ThinkingConfig;
  
  /** Token 预算配置 */
  token: TokenBudgetConfig;
  
  /** 缓存配置 */
  cache: CacheConfig;
  
  /** 压缩配置 */
  compression: CompressionConfig;
  
  /** 上下文配置 */
  context: ContextConfig;
  
  /** 模板配置 */
  template: TemplateConfig;
  
  /** 可视化配置 */
  visualization: VisualizationConfig;
  
  /** 性能配置 */
  performance: PerformanceConfig;
}

/**
 * Token 预算配置
 */
export interface TokenBudgetConfig {
  /** 最大 token 数 */
  maxTokens: number;
  /** 思考占比 */
  thinkingRatio: number;
  /** 响应占比 */
  responseRatio: number;
  /** 缓冲占比 */
  bufferRatio: number;
  /** 上下文阈值 */
  contextThreshold: number;
  /** 是否启用动态调整 */
  enableDynamicAdjustment: boolean;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 最大缓存条目数 */
  maxSize: number;
  /** 缓存 TTL (ms) */
  ttl: number;
}

/**
 * 压缩配置
 */
export interface CompressionConfig {
  /** 是否启用压缩 */
  enabled: boolean;
  /** 压缩级别 */
  level: "light" | "medium" | "aggressive";
  /** 目标 token 数 */
  targetTokens: number;
  /** 是否保留洞察 */
  keepInsights: boolean;
  /** 是否保留假设 */
  keepHypotheses: boolean;
}

/**
 * 上下文配置
 */
export interface ContextConfig {
  /** 最大 token 数 */
  maxTokens: number;
  /** 重置阈值 */
  resetThreshold: number;
  /** 警告阈值 */
  warningThreshold: number;
  /** 是否自动压缩 */
  autoCompress: boolean;
  /** 是否保留重要信息 */
  preserveImportant: boolean;
  /** 重要性阈值 */
  importanceThreshold: number;
}

/**
 * 模板配置
 */
export interface TemplateConfig {
  /** 是否启用模板匹配 */
  enabled: boolean;
  /** 自定义模板路径 */
  customTemplatesPath?: string;
  /** 模板优先级 */
  priority: "domain" | "general";
}

/**
 * 可视化配置
 */
export interface VisualizationConfig {
  /** 默认格式 */
  defaultFormat: "ascii" | "mermaid" | "json" | "markdown";
  /** 是否显示详细内容 */
  detailed: boolean;
  /** 是否显示假设 */
  showHypotheses: boolean;
  /** 是否显示洞察 */
  showInsights: boolean;
  /** 最大内容长度 */
  maxContentLength: number;
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  /** 是否启用监控 */
  enableMonitoring: boolean;
  /** 是否记录详细日志 */
  verboseLogging: boolean;
  /** 超时时间 (ms) */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
}

// ============================================================
// 预设配置
// ============================================================

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: LingSiConfig = {
  thinking: {
    ...DEFAULT_THINKING_CONFIG,
  },
  
  token: {
    maxTokens: 4096,
    thinkingRatio: 0.3,
    responseRatio: 0.6,
    bufferRatio: 0.1,
    contextThreshold: 0.55,
    enableDynamicAdjustment: true,
  },
  
  cache: {
    enabled: true,
    maxSize: 100,
    ttl: 3600000, // 1 hour
  },
  
  compression: {
    enabled: true,
    level: "medium",
    targetTokens: 500,
    keepInsights: true,
    keepHypotheses: true,
  },
  
  context: {
    maxTokens: 4096,
    resetThreshold: 0.8,
    warningThreshold: 0.6,
    autoCompress: true,
    preserveImportant: true,
    importanceThreshold: 0.7,
  },
  
  template: {
    enabled: true,
    priority: "domain",
  },
  
  visualization: {
    defaultFormat: "markdown",
    detailed: false,
    showHypotheses: true,
    showInsights: true,
    maxContentLength: 100,
  },
  
  performance: {
    enableMonitoring: true,
    verboseLogging: false,
    timeout: 30000,
    maxRetries: 1,
  },
};

/**
 * 高性能配置（适合生产环境）
 */
export const PRODUCTION_CONFIG: LingSiConfig = {
  thinking: {
    visible: false,
    format: "hidden",
    maxThinkingTokens: 1000,
    enableMultiHypothesis: true,
    maxHypotheses: 3,
    enableRecursiveThinking: false,
    maxRecursionDepth: 2,
    enableSelfVerification: true,
    timeout: 15000,
  },
  
  token: {
    maxTokens: 4096,
    thinkingRatio: 0.25,
    responseRatio: 0.65,
    bufferRatio: 0.1,
    contextThreshold: 0.5,
    enableDynamicAdjustment: true,
  },
  
  cache: {
    enabled: true,
    maxSize: 200,
    ttl: 7200000, // 2 hours
  },
  
  compression: {
    enabled: true,
    level: "medium",
    targetTokens: 400,
    keepInsights: true,
    keepHypotheses: false,
  },
  
  context: {
    maxTokens: 4096,
    resetThreshold: 0.75,
    warningThreshold: 0.55,
    autoCompress: true,
    preserveImportant: true,
    importanceThreshold: 0.8,
  },
  
  template: {
    enabled: true,
    priority: "domain",
  },
  
  visualization: {
    defaultFormat: "json",
    detailed: false,
    showHypotheses: false,
    showInsights: true,
    maxContentLength: 50,
  },
  
  performance: {
    enableMonitoring: true,
    verboseLogging: false,
    timeout: 15000,
    maxRetries: 1,
  },
};

/**
 * 高质量配置（适合复杂任务）
 */
export const QUALITY_CONFIG: LingSiConfig = {
  thinking: {
    visible: false,
    format: "hidden",
    maxThinkingTokens: 2000,
    enableMultiHypothesis: true,
    maxHypotheses: 5,
    enableRecursiveThinking: true,
    maxRecursionDepth: 3,
    enableSelfVerification: true,
    timeout: 60000,
  },
  
  token: {
    maxTokens: 8192,
    thinkingRatio: 0.35,
    responseRatio: 0.55,
    bufferRatio: 0.1,
    contextThreshold: 0.6,
    enableDynamicAdjustment: true,
  },
  
  cache: {
    enabled: true,
    maxSize: 50,
    ttl: 1800000, // 30 minutes
  },
  
  compression: {
    enabled: true,
    level: "light",
    targetTokens: 1000,
    keepInsights: true,
    keepHypotheses: true,
  },
  
  context: {
    maxTokens: 8192,
    resetThreshold: 0.85,
    warningThreshold: 0.65,
    autoCompress: true,
    preserveImportant: true,
    importanceThreshold: 0.6,
  },
  
  template: {
    enabled: true,
    priority: "domain",
  },
  
  visualization: {
    defaultFormat: "markdown",
    detailed: true,
    showHypotheses: true,
    showInsights: true,
    maxContentLength: 200,
  },
  
  performance: {
    enableMonitoring: true,
    verboseLogging: true,
    timeout: 60000,
    maxRetries: 2,
  },
};

/**
 * 快速响应配置（适合简单任务）
 */
export const FAST_CONFIG: LingSiConfig = {
  thinking: {
    visible: false,
    format: "hidden",
    maxThinkingTokens: 300,
    enableMultiHypothesis: false,
    maxHypotheses: 2,
    enableRecursiveThinking: false,
    maxRecursionDepth: 1,
    enableSelfVerification: false,
    timeout: 5000,
  },
  
  token: {
    maxTokens: 2048,
    thinkingRatio: 0.2,
    responseRatio: 0.7,
    bufferRatio: 0.1,
    contextThreshold: 0.5,
    enableDynamicAdjustment: true,
  },
  
  cache: {
    enabled: true,
    maxSize: 300,
    ttl: 1800000, // 30 minutes
  },
  
  compression: {
    enabled: true,
    level: "aggressive",
    targetTokens: 200,
    keepInsights: true,
    keepHypotheses: false,
  },
  
  context: {
    maxTokens: 2048,
    resetThreshold: 0.7,
    warningThreshold: 0.5,
    autoCompress: true,
    preserveImportant: false,
    importanceThreshold: 0.8,
  },
  
  template: {
    enabled: false,
    priority: "general",
  },
  
  visualization: {
    defaultFormat: "json",
    detailed: false,
    showHypotheses: false,
    showInsights: false,
    maxContentLength: 30,
  },
  
  performance: {
    enableMonitoring: false,
    verboseLogging: false,
    timeout: 5000,
    maxRetries: 0,
  },
};

// ============================================================
// 配置管理器
// ============================================================

/**
 * 配置管理器
 */
export class ConfigManager {
  private config: LingSiConfig;
  private presets: Map<string, LingSiConfig> = new Map();

  constructor(initialConfig?: Partial<LingSiConfig>) {
    // 注册预设
    this.presets.set("default", DEFAULT_CONFIG);
    this.presets.set("production", PRODUCTION_CONFIG);
    this.presets.set("quality", QUALITY_CONFIG);
    this.presets.set("fast", FAST_CONFIG);

    // 应用初始配置
    this.config = initialConfig
      ? this.mergeConfig(DEFAULT_CONFIG, initialConfig)
      : DEFAULT_CONFIG;
  }

  /**
   * 获取当前配置
   */
  getConfig(): LingSiConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(partial: Partial<LingSiConfig>): void {
    this.config = this.mergeConfig(this.config, partial);
  }

  /**
   * 使用预设配置
   */
  usePreset(name: string): boolean {
    const preset = this.presets.get(name);
    if (preset) {
      this.config = { ...preset };
      return true;
    }
    return false;
  }

  /**
   * 注册自定义预设
   */
  registerPreset(name: string, config: LingSiConfig): void {
    this.presets.set(name, config);
  }

  /**
   * 获取所有预设名称
   */
  getPresetNames(): string[] {
    return Array.from(this.presets.keys());
  }

  /**
   * 重置为默认配置
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * 合并配置
   */
  private mergeConfig(
    base: LingSiConfig,
    partial: Partial<LingSiConfig>
  ): LingSiConfig {
    return {
      thinking: { ...base.thinking, ...(partial.thinking || {}) },
      token: { ...base.token, ...(partial.token || {}) },
      cache: { ...base.cache, ...(partial.cache || {}) },
      compression: { ...base.compression, ...(partial.compression || {}) },
      context: { ...base.context, ...(partial.context || {}) },
      template: { ...base.template, ...(partial.template || {}) },
      visualization: { ...base.visualization, ...(partial.visualization || {}) },
      performance: { ...base.performance, ...(partial.performance || {}) },
    };
  }

  /**
   * 验证配置
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证 token 配置
    const { token } = this.config;
    if (token.maxTokens < 100) {
      errors.push("maxTokens must be at least 100");
    }
    if (token.thinkingRatio + token.responseRatio + token.bufferRatio !== 1) {
      errors.push("thinkingRatio + responseRatio + bufferRatio must equal 1");
    }
    if (token.contextThreshold < 0 || token.contextThreshold > 1) {
      errors.push("contextThreshold must be between 0 and 1");
    }

    // 验证缓存配置
    const { cache } = this.config;
    if (cache.maxSize < 1) {
      errors.push("cache.maxSize must be at least 1");
    }
    if (cache.ttl < 1000) {
      errors.push("cache.ttl must be at least 1000ms");
    }

    // 验证上下文配置
    const { context } = this.config;
    if (context.resetThreshold <= context.warningThreshold) {
      errors.push("resetThreshold must be greater than warningThreshold");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 导出配置为 JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 从 JSON 导入配置
   */
  fromJSON(json: string): void {
    try {
      const config = JSON.parse(json);
      this.config = this.mergeConfig(DEFAULT_CONFIG, config);
    } catch (error) {
      throw new Error(`Failed to parse config JSON: ${error}`);
    }
  }
}

// 导出单例
export const configManager = new ConfigManager();
