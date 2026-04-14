/**
 * 一键配置向导
 * 
 * 融合自 llm-memory-integration v5.2.17
 * 
 * 功能：
 * 1. 一键配置所有组件
 * 2. 配置向导
 * 3. 配置验证
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface SetupResult {
  success: boolean;
  configuredComponents: string[];
  errors: string[];
  warnings: string[];
}

export interface ConfigWizardOptions {
  llmProvider?: string;
  llmModel?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  autoUpdate?: boolean;
  enableExtensions?: boolean;
}

// ============ 一键配置向导 ============

export class SetupWizard {
  private logger: StructuredLogger;
  private configDir: string;
  
  constructor(logger: StructuredLogger, configDir: string = './config') {
    this.logger = logger;
    this.configDir = configDir;
    this.ensureDir(configDir);
  }
  
  /**
   * 一键配置
   */
  async oneClickSetup(options?: ConfigWizardOptions): Promise<SetupResult> {
    const result: SetupResult = {
      success: true,
      configuredComponents: [],
      errors: [],
      warnings: [],
    };
    
    this.logger.info('SetupWizard', '开始一键配置...');
    
    // 1. 配置 LLM
    try {
      this.setupLLM(options);
      result.configuredComponents.push('LLM');
    } catch (error: unknown) {
      result.errors.push(`LLM 配置失败: ${(error as Error).message}`);
      result.success = false;
    }
    
    // 2. 配置 Embedding
    try {
      this.setupEmbedding(options);
      result.configuredComponents.push('Embedding');
    } catch (error: unknown) {
      result.errors.push(`Embedding 配置失败: ${(error as Error).message}`);
      result.success = false;
    }
    
    // 3. 配置用户画像
    try {
      this.setupPersona(options);
      result.configuredComponents.push('Persona');
    } catch (error: unknown) {
      result.warnings.push(`Persona 配置失败: ${(error as Error).message}`);
    }
    
    // 4. 配置扩展
    try {
      this.setupExtensions(options);
      result.configuredComponents.push('Extensions');
    } catch (error: unknown) {
      result.warnings.push(`Extensions 配置失败: ${(error as Error).message}`);
    }
    
    // 5. 配置优化参数
    try {
      this.setupOptimization();
      result.configuredComponents.push('Optimization');
    } catch (error: unknown) {
      result.warnings.push(`Optimization 配置失败: ${(error as Error).message}`);
    }
    
    // 6. 配置渐进式启用
    try {
      this.setupProgressive();
      result.configuredComponents.push('Progressive');
    } catch (error: unknown) {
      result.warnings.push(`Progressive 配置失败: ${(error as Error).message}`);
    }
    
    this.logger.info('SetupWizard', 
      `配置完成: ${result.configuredComponents.length} 个组件, 错误: ${result.errors.length}`
    );
    
    return result;
  }
  
  /**
   * 配置 LLM
   */
  private setupLLM(options?: ConfigWizardOptions): void {
    const config = {
      llm: {
        provider: options?.llmProvider || 'openai-compatible',
        base_url: 'https://api.example.com/v1',
        api_key: 'your-api-key',
        model: options?.llmModel || 'gpt-4',
        max_tokens: 150,
        temperature: 0.5,
      },
    };
    
    this.saveConfig('llm_config.json', config);
  }
  
  /**
   * 配置 Embedding
   */
  private setupEmbedding(options?: ConfigWizardOptions): void {
    const config = {
      embedding: {
        provider: options?.embeddingProvider || 'openai-compatible',
        base_url: 'https://api.example.com/v1',
        api_key: 'your-api-key',
        model: options?.embeddingModel || 'text-embedding-3-small',
        dimensions: 1536,
      },
    };
    
    this.saveConfig('embedding_config.json', config);
  }
  
  /**
   * 配置用户画像
   */
  private setupPersona(options?: ConfigWizardOptions): void {
    const config = {
      auto_update: options?.autoUpdate || false,
      require_confirmation: true,
      backup_before_update: true,
    };
    
    this.saveConfig('persona_update.json', config);
  }
  
  /**
   * 配置扩展
   */
  private setupExtensions(options?: ConfigWizardOptions): void {
    const config = {
      auto_load: options?.enableExtensions || false,
      require_confirmation: true,
      allowed_extensions: ['vec0.so'],
      trusted_hashes_file: '~/.openclaw/extensions/.trusted_hashes.json',
    };
    
    this.saveConfig('extension_config.json', config);
  }
  
  /**
   * 配置优化参数
   */
  private setupOptimization(): void {
    const config = {
      vector_search: {
        top_k: 20,
        max_distance: 0.8,
      },
      rrf: {
        k: 60,
      },
      llm_expansion: {
        max_tokens: 150,
        temperature: 0.5,
      },
      cache: {
        ttl_ms: 60000,
        max_size: 1000,
      },
    };
    
    this.saveConfig('optimization_v5.json', config);
  }
  
  /**
   * 配置渐进式启用
   */
  private setupProgressive(): void {
    const config = {
      stages: {
        P0: { name: '核心优化', modules: ['router', 'weights', 'rrf', 'dedup'], enabled: true },
        P1: { name: '查询增强', modules: ['understand', 'rewriter'], enabled: true },
        P2: { name: '学习优化', modules: ['feedback', 'history'], enabled: true },
        P3: { name: '结果增强', modules: ['explainer', 'summarizer'], enabled: true },
      },
    };
    
    this.saveConfig('progressive_config.json', config);
  }
  
  /**
   * 运行配置向导
   */
  async runWizard(): Promise<ConfigWizardOptions> {
    // 模拟向导交互
    const options: ConfigWizardOptions = {
      llmProvider: 'openai-compatible',
      llmModel: 'gpt-4',
      embeddingProvider: 'openai-compatible',
      embeddingModel: 'text-embedding-3-small',
      autoUpdate: false,
      enableExtensions: false,
    };
    
    this.logger.info('SetupWizard', '配置向导完成');
    
    return options;
  }
  
  /**
   * 验证配置
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 检查必要配置文件
    const requiredFiles = [
      'llm_config.json',
      'embedding_config.json',
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(this.configDir, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`缺少配置文件: ${file}`);
      }
    }
    
    // 检查 API 密钥
    const llmConfig = this.loadConfig('llm_config.json') as Record<string, Record<string, string>> | null;
    if (llmConfig?.llm?.api_key === 'your-api-key') {
      errors.push('LLM API 密钥未配置');
    }
    
    const embeddingConfig = this.loadConfig('embedding_config.json') as Record<string, Record<string, string>> | null;
    if (embeddingConfig?.embedding?.api_key === 'your-api-key') {
      errors.push('Embedding API 密钥未配置');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  // ============ 辅助方法 ============
  
  private saveConfig(filename: string, config: Record<string, unknown>): void {
    const filePath = path.join(this.configDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  }
  
  private loadConfig(filename: string): Record<string, unknown> | null {
    const filePath = path.join(this.configDir, filename);
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (error) {
      return null;
    }
    return null;
  }
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
