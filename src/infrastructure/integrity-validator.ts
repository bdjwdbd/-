/**
 * 完整性验证器 - SHA256 校验机制
 * 
 * 职责：
 * - 原生模块完整性验证
 * - 防止恶意替换
 * - 与 llm-memory-integration 对齐
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 类型定义
// ============================================================

export interface IntegrityCheckResult {
  valid: boolean;
  file: string;
  expectedHash: string;
  actualHash: string;
  error?: string;
}

export interface BinaryInfo {
  platform: string;
  arch: string;
  fileName: string;
  expectedHash: string;
}

export interface IntegrityReport {
  passed: boolean;
  results: IntegrityCheckResult[];
  timestamp: Date;
  totalChecked: number;
  totalPassed: number;
  totalFailed: number;
}

// ============================================================
// 已知安全的哈希值
// ============================================================

// 这些哈希值将在 GitHub Actions 构建后更新
const KNOWN_HASHES: Record<string, string> = {
  // Linux x64
  'linux-x64/vector_ops.node': 'sha256:PENDING_BUILD',
  
  // Linux ARM64
  'linux-arm64/vector_ops.node': 'sha256:PENDING_BUILD',
  
  // macOS x64
  'darwin-x64/vector_ops.node': 'sha256:PENDING_BUILD',
  
  // macOS ARM64 (Apple Silicon)
  'darwin-arm64/vector_ops.node': 'sha256:PENDING_BUILD',
  
  // Windows x64
  'win32-x64/vector_ops.node': 'sha256:PENDING_BUILD',
};

// 允许的文件路径模式
const ALLOWED_PATTERNS = [
  /^native\/build\/Release\/.*\.node$/,
  /^native\/build\/Debug\/.*\.node$/,
];

// 禁止的文件路径模式
const BLOCKED_PATTERNS = [
  /\.\./,  // 防止路径遍历
  /node_modules/,
  /\.git/,
];

// ============================================================
// 完整性验证器
// ============================================================

export class IntegrityValidator {
  private hashes: Record<string, string>;
  private strictMode: boolean;
  private auditLog: IntegrityCheckResult[] = [];

  constructor(options: { strictMode?: boolean; customHashes?: Record<string, string> } = {}) {
    this.hashes = { ...KNOWN_HASHES, ...options.customHashes };
    this.strictMode = options.strictMode ?? true;
  }

  /**
   * 计算文件 SHA256 哈希
   */
  calculateHash(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return `sha256:${hash}`;
  }

  /**
   * 验证单个文件
   */
  validateFile(filePath: string): IntegrityCheckResult {
    // 规范化路径
    const normalizedPath = path.normalize(filePath);
    
    // 安全检查
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        return {
          valid: false,
          file: filePath,
          expectedHash: 'BLOCKED',
          actualHash: 'BLOCKED',
          error: 'Path contains blocked pattern',
        };
      }
    }

    // 检查文件是否存在
    if (!fs.existsSync(normalizedPath)) {
      return {
        valid: false,
        file: filePath,
        expectedHash: 'N/A',
        actualHash: 'N/A',
        error: 'File not found',
      };
    }

    // 计算实际哈希
    let actualHash: string;
    try {
      actualHash = this.calculateHash(normalizedPath);
    } catch (error) {
      return {
        valid: false,
        file: filePath,
        expectedHash: 'N/A',
        actualHash: 'N/A',
        error: `Hash calculation failed: ${error}`,
      };
    }

    // 获取相对路径用于查找预期哈希
    const relativePath = this.getRelativePath(normalizedPath);
    const expectedHash = this.hashes[relativePath];

    // 如果没有预期哈希
    if (!expectedHash) {
      if (this.strictMode) {
        return {
          valid: false,
          file: filePath,
          expectedHash: 'UNKNOWN',
          actualHash,
          error: 'No expected hash found for this file',
        };
      } else {
        // 非严格模式，允许未知文件
        return {
          valid: true,
          file: filePath,
          expectedHash: 'UNKNOWN',
          actualHash,
        };
      }
    }

    // 待构建状态
    if (expectedHash === 'sha256:PENDING_BUILD') {
      console.warn(`[Integrity] 文件 ${filePath} 的哈希值尚未设置（等待构建）`);
      return {
        valid: true, // 允许通过，但记录警告
        file: filePath,
        expectedHash,
        actualHash,
      };
    }

    // 比较哈希
    const valid = actualHash === expectedHash;

    const result: IntegrityCheckResult = {
      valid,
      file: filePath,
      expectedHash,
      actualHash,
    };

    // 记录审计日志
    this.auditLog.push(result);

    return result;
  }

  /**
   * 验证所有原生模块
   */
  validateAllBinaries(): IntegrityReport {
    const nativeDir = this.getNativeDir();
    const results: IntegrityCheckResult[] = [];

    if (!fs.existsSync(nativeDir)) {
      console.log('[Integrity] 原生模块目录不存在，跳过校验');
      return {
        passed: true,
        results: [],
        timestamp: new Date(),
        totalChecked: 0,
        totalPassed: 0,
        totalFailed: 0,
      };
    }

    // 查找所有 .node 文件
    const nodeFiles = this.findNodeFiles(nativeDir);

    for (const file of nodeFiles) {
      const result = this.validateFile(file);
      results.push(result);

      if (result.valid) {
        console.log(`[Integrity] ✅ ${path.basename(file)}`);
      } else {
        console.error(`[Integrity] ❌ ${path.basename(file)}: ${result.error}`);
      }
    }

    const totalPassed = results.filter(r => r.valid).length;
    const totalFailed = results.filter(r => !r.valid).length;

    return {
      passed: totalFailed === 0,
      results,
      timestamp: new Date(),
      totalChecked: results.length,
      totalPassed,
      totalFailed,
    };
  }

  /**
   * 验证下载的二进制文件
   */
  validateDownloadedBinary(
    filePath: string,
    expectedHash: string
  ): IntegrityCheckResult {
    // 临时添加哈希
    const relativePath = this.getRelativePath(filePath);
    this.hashes[relativePath] = expectedHash;

    return this.validateFile(filePath);
  }

  /**
   * 更新哈希值
   */
  updateHash(platform: string, arch: string, hash: string): void {
    const key = `${platform}-${arch}/vector_ops.node`;
    this.hashes[key] = hash;
    console.log(`[Integrity] 更新哈希: ${key} = ${hash}`);
  }

  /**
   * 批量更新哈希值
   */
  updateHashes(hashes: Record<string, string>): void {
    for (const [key, hash] of Object.entries(hashes)) {
      this.hashes[key] = hash;
    }
    console.log(`[Integrity] 更新了 ${Object.keys(hashes).length} 个哈希值`);
  }

  /**
   * 获取审计日志
   */
  getAuditLog(): IntegrityCheckResult[] {
    return [...this.auditLog];
  }

  /**
   * 清空审计日志
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * 导出当前哈希配置
   */
  exportHashes(): Record<string, string> {
    return { ...this.hashes };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private getNativeDir(): string {
    return path.join(__dirname, '../../native/build/Release');
  }

  private getRelativePath(absolutePath: string): string {
    const nativeDir = path.join(__dirname, '../../native');
    const relative = path.relative(nativeDir, absolutePath);
    
    // 提取平台和架构信息
    const parts = relative.split(path.sep);
    if (parts.length >= 3) {
      // 例如: build/Release/vector_ops.node
      // 需要从文件名推断平台
      return this.inferPlatformKey(absolutePath);
    }
    
    return relative;
  }

  private inferPlatformKey(filePath: string): string {
    const platform = process.platform;
    const arch = process.arch;
    const fileName = path.basename(filePath);
    return `${platform}-${arch}/${fileName}`;
  }

  private findNodeFiles(dir: string): string[] {
    const files: string[] = [];

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.node')) {
          // 检查是否在允许的路径
          const relativePath = path.relative(dir, fullPath);
          const isAllowed = ALLOWED_PATTERNS.some(p => p.test(relativePath));

          if (isAllowed || !this.strictMode) {
            files.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return files;
  }
}

// ============================================================
// 单例实例
// ============================================================

let defaultValidator: IntegrityValidator | null = null;

export function getIntegrityValidator(
  options?: { strictMode?: boolean; customHashes?: Record<string, string> }
): IntegrityValidator {
  if (!defaultValidator) {
    defaultValidator = new IntegrityValidator(options);
  }
  return defaultValidator;
}

/**
 * 快速校验所有原生模块
 */
export function quickValidate(): boolean {
  const validator = getIntegrityValidator();
  const report = validator.validateAllBinaries();
  return report.passed;
}

/**
 * 校验单个文件
 */
export function validateFile(filePath: string): IntegrityCheckResult {
  const validator = getIntegrityValidator();
  return validator.validateFile(filePath);
}

// ============================================================
// 命令行入口
// ============================================================

if (require.main === module) {
  const validator = new IntegrityValidator();
  const report = validator.validateAllBinaries();

  console.log('\n========================================');
  console.log('完整性验证报告');
  console.log('========================================');
  console.log(`时间: ${report.timestamp.toISOString()}`);
  console.log(`检查文件: ${report.totalChecked}`);
  console.log(`通过: ${report.totalPassed}`);
  console.log(`失败: ${report.totalFailed}`);
  console.log(`状态: ${report.passed ? '✅ 通过' : '❌ 失败'}`);
  console.log('========================================\n');

  if (!report.passed) {
    console.log('失败的文件:');
    for (const result of report.results.filter(r => !r.valid)) {
      console.log(`  - ${result.file}`);
      console.log(`    预期: ${result.expectedHash}`);
      console.log(`    实际: ${result.actualHash}`);
      if (result.error) {
        console.log(`    错误: ${result.error}`);
      }
    }
    process.exit(1);
  }
}
