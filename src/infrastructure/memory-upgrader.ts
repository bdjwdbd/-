/**
 * 记忆升级系统
 * 
 * 融合自 llm-memory-integration v5.2.17
 * 
 * 功能：
 * 1. 记忆版本管理
 * 2. 自动升级规则
 * 3. 迁移脚本执行
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface MemoryVersion {
  version: string;
  schema: Record<string, any>;
  migrationScript?: string;
  description: string;
  releasedAt: number;
}

export interface UpgradeResult {
  fromVersion: string;
  toVersion: string;
  success: boolean;
  changes: string[];
  errors: string[];
  duration: number;
}

export interface UpgradeRule {
  fromVersion: string;
  toVersion: string;
  condition: (data: any) => boolean;
  transform: (data: any) => any;
  description: string;
}

// ============ 记忆升级器 ============

export class MemoryUpgrader {
  private logger: StructuredLogger;
  private dataDir: string;
  
  // 版本历史
  private versions: MemoryVersion[] = [
    {
      version: '1.0.0',
      schema: { id: 'string', content: 'string', timestamp: 'number' },
      description: '初始版本',
      releasedAt: 1700000000000,
    },
    {
      version: '1.1.0',
      schema: { id: 'string', content: 'string', timestamp: 'number', metadata: 'object' },
      migrationScript: 'add-metadata-field',
      description: '添加元数据字段',
      releasedAt: 1710000000000,
    },
    {
      version: '1.2.0',
      schema: { id: 'string', content: 'string', timestamp: 'number', metadata: 'object', embedding: 'array' },
      migrationScript: 'add-embedding-field',
      description: '添加向量嵌入字段',
      releasedAt: 1720000000000,
    },
    {
      version: '2.0.0',
      schema: { 
        id: 'string', 
        content: 'string', 
        timestamp: 'number', 
        metadata: 'object', 
        embedding: 'array',
        relations: 'array',
        importance: 'number',
      },
      migrationScript: 'add-relations-importance',
      description: '添加关系和重要性字段',
      releasedAt: 1730000000000,
    },
  ];
  
  // 升级规则
  private upgradeRules: UpgradeRule[] = [
    {
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      condition: (data) => !data.metadata,
      transform: (data) => ({ ...data, metadata: {} }),
      description: '添加空的 metadata 字段',
    },
    {
      fromVersion: '1.1.0',
      toVersion: '1.2.0',
      condition: (data) => !data.embedding,
      transform: (data) => ({ ...data, embedding: [] }),
      description: '添加空的 embedding 字段',
    },
    {
      fromVersion: '1.2.0',
      toVersion: '2.0.0',
      condition: (data) => !data.relations || !data.importance,
      transform: (data) => ({ 
        ...data, 
        relations: data.relations || [],
        importance: data.importance || 0.5,
      }),
      description: '添加 relations 和 importance 字段',
    },
  ];
  
  constructor(logger: StructuredLogger, dataDir: string = './data/memory') {
    this.logger = logger;
    this.dataDir = dataDir;
    this.ensureDir(dataDir);
  }
  
  /**
   * 检查当前版本
   */
  getCurrentVersion(): string {
    const versionFile = path.join(this.dataDir, 'version.json');
    
    try {
      if (fs.existsSync(versionFile)) {
        const data = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
        return data.version || '1.0.0';
      }
    } catch (error) {
      this.logger.warn('MemoryUpgrader', `版本检查失败: ${error}`);
    }
    
    return '1.0.0';
  }
  
  /**
   * 检查是否需要升级
   */
  needsUpgrade(): boolean {
    const currentVersion = this.getCurrentVersion();
    const latestVersion = this.getLatestVersion();
    
    return currentVersion !== latestVersion;
  }
  
  /**
   * 获取最新版本
   */
  getLatestVersion(): string {
    return this.versions[this.versions.length - 1].version;
  }
  
  /**
   * 执行升级
   */
  async upgrade(): Promise<UpgradeResult> {
    const startTime = Date.now();
    const fromVersion = this.getCurrentVersion();
    const toVersion = this.getLatestVersion();
    
    const result: UpgradeResult = {
      fromVersion,
      toVersion,
      success: false,
      changes: [],
      errors: [],
      duration: 0,
    };
    
    if (fromVersion === toVersion) {
      result.success = true;
      result.changes.push('已是最新版本，无需升级');
      return result;
    }
    
    this.logger.info('MemoryUpgrader', `开始升级: ${fromVersion} → ${toVersion}`);
    
    try {
      // 备份数据
      this.backupData();
      
      // 加载记忆数据
      const memories = this.loadMemories();
      
      // 逐步升级
      let currentData = memories;
      let currentVersion = fromVersion;
      
      while (currentVersion !== toVersion) {
        const nextVersion = this.getNextVersion(currentVersion);
        if (!nextVersion) break;
        
        const upgradeResult = this.applyUpgrade(currentData, currentVersion, nextVersion);
        
        if (upgradeResult.success) {
          currentData = upgradeResult.data;
          result.changes.push(`升级 ${currentVersion} → ${nextVersion}: ${upgradeResult.changes.length} 条记录`);
          currentVersion = nextVersion;
        } else {
          result.errors.push(`升级失败: ${upgradeResult.error}`);
          break;
        }
      }
      
      // 保存升级后的数据
      if (result.errors.length === 0) {
        this.saveMemories(currentData);
        this.saveVersion(toVersion);
        result.success = true;
      }
      
    } catch (error: unknown) {
      result.errors.push(`升级异常: ${(error as Error).message}`);
    }
    
    result.duration = Date.now() - startTime;
    
    this.logger.info('MemoryUpgrader', 
      `升级${result.success ? '成功' : '失败'}: ${result.duration}ms`
    );
    
    return result;
  }
  
  /**
   * 获取下一个版本
   */
  private getNextVersion(currentVersion: string): string | null {
    const currentIndex = this.versions.findIndex(v => v.version === currentVersion);
    if (currentIndex < 0 || currentIndex >= this.versions.length - 1) {
      return null;
    }
    return this.versions[currentIndex + 1].version;
  }
  
  /**
   * 应用升级
   */
  private applyUpgrade(
    data: any[],
    fromVersion: string,
    toVersion: string
  ): { success: boolean; data: any[]; changes: string[]; error?: string } {
    const rule = this.upgradeRules.find(
      r => r.fromVersion === fromVersion && r.toVersion === toVersion
    );
    
    if (!rule) {
      return { 
        success: false, 
        data, 
        changes: [], 
        error: `未找到升级规则: ${fromVersion} → ${toVersion}` 
      };
    }
    
    const changes: string[] = [];
    const transformedData = data.map((item, index) => {
      if (rule.condition(item)) {
        changes.push(`记录 ${index + 1}`);
        return rule.transform(item);
      }
      return item;
    });
    
    return { success: true, data: transformedData, changes };
  }
  
  /**
   * 获取升级路径
   */
  getUpgradePath(): string[] {
    const currentVersion = this.getCurrentVersion();
    const path: string[] = [currentVersion];
    
    let version = currentVersion;
    while (true) {
      const next = this.getNextVersion(version);
      if (!next) break;
      path.push(next);
      version = next;
    }
    
    return path;
  }
  
  // ============ 数据持久化 ============
  
  private loadMemories(): any[] {
    const memoryFile = path.join(this.dataDir, 'memories.json');
    
    try {
      if (fs.existsSync(memoryFile)) {
        return JSON.parse(fs.readFileSync(memoryFile, 'utf-8'));
      }
    } catch (error) {
      this.logger.warn('MemoryUpgrader', `加载记忆失败: ${error}`);
    }
    
    return [];
  }
  
  private saveMemories(memories: any[]): void {
    const memoryFile = path.join(this.dataDir, 'memories.json');
    fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
  }
  
  private saveVersion(version: string): void {
    const versionFile = path.join(this.dataDir, 'version.json');
    fs.writeFileSync(versionFile, JSON.stringify({ version, updatedAt: Date.now() }, null, 2));
  }
  
  private backupData(): void {
    const backupDir = path.join(this.dataDir, 'backup');
    this.ensureDir(backupDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const memoryFile = path.join(this.dataDir, 'memories.json');
    
    if (fs.existsSync(memoryFile)) {
      const backupPath = path.join(backupDir, `memories-${timestamp}.json`);
      fs.copyFileSync(memoryFile, backupPath);
      this.logger.debug('MemoryUpgrader', `备份: ${backupPath}`);
    }
  }
  
  // ============ 辅助方法 ============
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
