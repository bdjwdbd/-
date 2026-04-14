/**
 * 元灵系统统一配置 v3.0
 * 
 * 融合了：
 * - 原有元灵系统配置
 * - llm-memory-integration 配置
 * - memory-tencentdb 配置
 */

// ============================================================
// 类型定义
// ============================================================

export interface EmbeddingConfig {
  provider: "openai-compatible" | "local" | "none";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
}

export interface LLMConfig {
  provider: "openai-compatible" | "local" | "none";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface VectorSearchConfig {
  topK: number;
  maxDistance: number;
  scoreThreshold: number;
  useHNSW?: boolean;
  useQuantization?: boolean;
}

export interface HybridSearchConfig {
  mode: "fast" | "balanced" | "full";
  useVector: boolean;
  useKeyword: boolean;
  useLLM: boolean;
  rrfK?: number;
}

export interface PersonaConfig {
  autoUpdate: boolean;
  updateInterval: number;
  minMemoriesForUpdate: number;
  maxPersonaLength: number;
  requireConfirmation: boolean;
  backupBeforeUpdate: boolean;
}

export interface MemoryUpgradeConfig {
  l0ToL1: {
    minConversations: number;
    minDays: number;
    minImportance: number;
    keywords: string[];
  };
  l1ToL2: {
    minAccessCount: number;
    minDays: number;
    minRelevance: number;
  };
  l2ToL3: {
    minAccessCount: number;
    minDays: number;
    isCorePreference: boolean;
  };
  autoUpgrade: boolean;
  upgradeInterval: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  compression: boolean;
}

export interface BackupConfig {
  enabled: boolean;
  interval: number;
  maxBackups: number;
  path: string;
}

export interface HealthMonitorConfig {
  enabled: boolean;
  checkInterval: number;
  alertOnLow: boolean;
  coverageThreshold: number;
}

export interface YuanLingUnifiedConfig {
  version: string;
  
  // 嵌入配置
  embedding: EmbeddingConfig;
  
  // LLM 配置
  llm: LLMConfig;
  
  // 向量搜索配置
  vectorSearch: VectorSearchConfig;
  
  // 混合搜索配置
  hybridSearch: HybridSearchConfig;
  
  // 用户画像配置
  persona: PersonaConfig;
  
  // 记忆升级配置
  memoryUpgrade: MemoryUpgradeConfig;
  
  // 缓存配置
  cache: CacheConfig;
  
  // 备份配置
  backup: BackupConfig;
  
  // 健康监控配置
  healthMonitor: HealthMonitorConfig;
}

// ============================================================
// 默认配置
// ============================================================

export const DEFAULT_YUANLING_CONFIG: YuanLingUnifiedConfig = {
  version: "3.0.0",
  
  embedding: {
    provider: "openai-compatible",
    apiKey: process.env.EMBEDDING_API_KEY,
    baseUrl: process.env.EMBEDDING_BASE_URL || "https://ai.gitee.com/v1",
    model: process.env.EMBEDDING_MODEL || "Qwen3-Embedding-8B",
    dimensions: 4096,
  },
  
  llm: {
    provider: "openai-compatible",
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL || "https://ai.gitee.com/v1",
    model: process.env.LLM_MODEL || "Qwen3-235B-A22B",
    maxTokens: 150,
    temperature: 0.5,
  },
  
  vectorSearch: {
    topK: 20,
    maxDistance: 0.8,
    scoreThreshold: 0.2,
    useHNSW: true,
    useQuantization: false,
  },
  
  hybridSearch: {
    mode: "balanced",
    useVector: true,
    useKeyword: true,
    useLLM: false,
    rrfK: 60,
  },
  
  persona: {
    autoUpdate: false,
    updateInterval: 86400,
    minMemoriesForUpdate: 5,
    maxPersonaLength: 2000,
    requireConfirmation: true,
    backupBeforeUpdate: true,
  },
  
  memoryUpgrade: {
    l0ToL1: {
      minConversations: 5,
      minDays: 3,
      minImportance: 0.6,
      keywords: ["重要", "记住", "以后", "偏好", "规则", "配置"],
    },
    l1ToL2: {
      minAccessCount: 3,
      minDays: 7,
      minRelevance: 0.7,
    },
    l2ToL3: {
      minAccessCount: 10,
      minDays: 30,
      isCorePreference: true,
    },
    autoUpgrade: false,
    upgradeInterval: 86400,
  },
  
  cache: {
    enabled: true,
    ttl: 3600,
    maxSize: 1000,
    compression: true,
  },
  
  backup: {
    enabled: true,
    interval: 86400,
    maxBackups: 5,
    path: "~/.openclaw/memory-tdai/backups",
  },
  
  healthMonitor: {
    enabled: true,
    checkInterval: 3600,
    alertOnLow: true,
    coverageThreshold: 0.8,
  },
};

// ============================================================
// 配置管理类
// ============================================================

export class ConfigManager {
  private config: YuanLingUnifiedConfig;
  private configPath: string;
  
  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.loadConfig();
  }
  
  private getDefaultConfigPath(): string {
    const home = process.env.HOME || "";
    return `${home}/.openclaw/workspace/humanoid-agent/config/yuanling-unified.json`;
  }
  
  private loadConfig(): YuanLingUnifiedConfig {
    try {
      const fs = require("fs");
      if (fs.existsSync(this.configPath)) {
        const loaded = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
        return { ...DEFAULT_YUANLING_CONFIG, ...loaded };
      }
    } catch (error) {
      console.warn("[ConfigManager] 配置加载失败，使用默认配置");
    }
    return { ...DEFAULT_YUANLING_CONFIG };
  }
  
  saveConfig(): void {
    try {
      const fs = require("fs");
      const path = require("path");
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error("[ConfigManager] 配置保存失败:", error);
    }
  }
  
  getConfig(): YuanLingUnifiedConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<YuanLingUnifiedConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }
  
  getEmbeddingConfig(): EmbeddingConfig {
    return { ...this.config.embedding };
  }
  
  getLLMConfig(): LLMConfig {
    return { ...this.config.llm };
  }
  
  getVectorSearchConfig(): VectorSearchConfig {
    return { ...this.config.vectorSearch };
  }
  
  getHybridSearchConfig(): HybridSearchConfig {
    return { ...this.config.hybridSearch };
  }
}

// ============================================================
// 导出
// ============================================================

export default ConfigManager;
