/**
 * 扩展配置管理器
 * 
 * 融合自 llm-memory-integration v5.2.17
 * 
 * 功能：
 * 1. SQLite 扩展加载
 * 2. 安全验证
 * 3. 信任列表管理
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============ 类型定义 ============

export interface ExtensionConfig {
  autoLoad: boolean;
  requireConfirmation: boolean;
  allowedExtensions: string[];
  trustedHashesFile: string;
}

export interface TrustedExtension {
  name: string;
  hash: string;
  path: string;
  loadedAt?: number;
}

// ============ 扩展配置管理器 ============

export class ExtensionManager {
  private logger: StructuredLogger;
  private config: ExtensionConfig;
  private trustedHashes: Map<string, string> = new Map();
  private loadedExtensions: Map<string, TrustedExtension> = new Map();
  
  // 默认配置
  private static DEFAULT_CONFIG: ExtensionConfig = {
    autoLoad: false,
    requireConfirmation: true,
    allowedExtensions: ['vec0.so'],
    trustedHashesFile: '~/.openclaw/extensions/.trusted_hashes.json',
  };
  
  constructor(
    logger: StructuredLogger,
    config?: Partial<ExtensionConfig>
  ) {
    this.logger = logger;
    this.config = { ...ExtensionManager.DEFAULT_CONFIG, ...config };
    this.loadTrustedHashes();
  }
  
  /**
   * 加载扩展
   */
  async loadExtension(extensionPath: string): Promise<boolean> {
    // 1. 检查是否允许自动加载
    if (!this.config.autoLoad) {
      this.logger.warn('ExtensionManager', '自动加载已禁用');
      return false;
    }
    
    // 2. 验证路径
    if (!this.validatePath(extensionPath)) {
      this.logger.error('ExtensionManager', `路径验证失败: ${extensionPath}`);
      return false;
    }
    
    // 3. 验证扩展名
    const extName = path.basename(extensionPath);
    if (!this.config.allowedExtensions.includes(extName)) {
      this.logger.error('ExtensionManager', `扩展不在允许列表: ${extName}`);
      return false;
    }
    
    // 4. 验证哈希
    if (!await this.verifyHash(extensionPath)) {
      this.logger.error('ExtensionManager', `哈希验证失败: ${extensionPath}`);
      return false;
    }
    
    // 5. 检查文件权限
    if (!this.checkPermissions(extensionPath)) {
      this.logger.error('ExtensionManager', `权限检查失败: ${extensionPath}`);
      return false;
    }
    
    // 6. 需要确认
    if (this.config.requireConfirmation) {
      this.logger.info('ExtensionManager', `需要用户确认加载: ${extensionPath}`);
      // 实际实现中应该请求用户确认
      return false;
    }
    
    // 7. 加载扩展
    try {
      // 模拟加载
      this.loadedExtensions.set(extName, {
        name: extName,
        hash: this.calculateHash(extensionPath),
        path: extensionPath,
        loadedAt: Date.now(),
      });
      
      this.logger.info('ExtensionManager', `扩展加载成功: ${extName}`);
      return true;
    } catch (error: any) {
      this.logger.error('ExtensionManager', `扩展加载失败: ${error.message}`);
      return false;
    }
  }
  
  /**
   * 验证路径
   */
  private validatePath(extensionPath: string): boolean {
    const allowedDir = path.join(process.env.HOME || '', '.openclaw', 'extensions');
    const resolvedPath = path.resolve(extensionPath);
    
    return resolvedPath.startsWith(allowedDir);
  }
  
  /**
   * 验证哈希
   */
  private async verifyHash(extensionPath: string): Promise<boolean> {
    const extName = path.basename(extensionPath);
    const trustedHash = this.trustedHashes.get(extName);
    
    if (!trustedHash) {
      this.logger.warn('ExtensionManager', `扩展不在信任列表: ${extName}`);
      return false;
    }
    
    const actualHash = this.calculateHash(extensionPath);
    
    return actualHash === trustedHash;
  }
  
  /**
   * 计算哈希
   */
  private calculateHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return '';
    }
  }
  
  /**
   * 检查文件权限
   */
  private checkPermissions(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      const mode = stats.mode & 0o777;
      
      // 仅允许 644 (rw-r--r--) 或 755 (rwxr-xr-x)
      return mode === 0o644 || mode === 0o755;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 加载信任哈希
   */
  private loadTrustedHashes(): void {
    const hashFile = this.config.trustedHashesFile.replace('~', process.env.HOME || '');
    
    try {
      if (fs.existsSync(hashFile)) {
        const data = JSON.parse(fs.readFileSync(hashFile, 'utf-8'));
        for (const [name, hash] of Object.entries(data)) {
          this.trustedHashes.set(name, hash as string);
        }
        this.logger.info('ExtensionManager', `加载信任列表: ${this.trustedHashes.size} 个`);
      }
    } catch (error) {
      this.logger.warn('ExtensionManager', `加载信任列表失败: ${error}`);
    }
  }
  
  /**
   * 添加信任哈希
   */
  addTrustedHash(name: string, hash: string): void {
    this.trustedHashes.set(name, hash);
    this.saveTrustedHashes();
    this.logger.info('ExtensionManager', `添加信任哈希: ${name}`);
  }
  
  /**
   * 保存信任哈希
   */
  private saveTrustedHashes(): void {
    const hashFile = this.config.trustedHashesFile.replace('~', process.env.HOME || '');
    const dir = path.dirname(hashFile);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const data: Record<string, string> = {};
    for (const [name, hash] of this.trustedHashes) {
      data[name] = hash;
    }
    
    fs.writeFileSync(hashFile, JSON.stringify(data, null, 2));
  }
  
  /**
   * 获取已加载扩展
   */
  getLoadedExtensions(): TrustedExtension[] {
    return Array.from(this.loadedExtensions.values());
  }
  
  /**
   * 获取配置
   */
  getConfig(): ExtensionConfig {
    return { ...this.config };
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExtensionConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('ExtensionManager', '配置已更新');
  }
}
