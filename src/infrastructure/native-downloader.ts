/**
 * 原生模块下载器
 * 
 * 职责：
 * - 从 GitHub Release 下载预编译二进制
 * - 自动检测平台和架构
 * - 支持代理和镜像
 */

import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import { getIntegrityValidator, IntegrityCheckResult } from './integrity-validator';

// ============================================================
// 类型定义
// ============================================================

export interface DownloadOptions {
  version?: string;
  timeout?: number;
  retries?: number;
  proxy?: string;
  mirror?: string;
}

export interface DownloadResult {
  success: boolean;
  path?: string;
  error?: string;
  validated?: boolean;
}

export interface PlatformInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  abi: string;
}

export interface ReleaseInfo {
  version: string;
  assets: Array<{
    name: string;
    url: string;
    size: number;
    checksum?: string;
  }>;
}

// ============================================================
// 常量
// ============================================================

const GITHUB_REPO = 'bdjwdbd/humanoid-agent';
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_RELEASES_URL = 'https://github.com/bdjwdbd/humanoid-agent/releases';

const PLATFORM_MAP: Record<string, string> = {
  win32: 'win32',
  darwin: 'darwin',
  linux: 'linux',
  freebsd: 'linux',
};

const ARCH_MAP: Record<string, string> = {
  x64: 'x64',
  x86_64: 'x64',
  arm64: 'arm64',
  aarch64: 'arm64',
  arm: 'arm',
};

// ============================================================
// 原生模块下载器
// ============================================================

export class NativeDownloader {
  private options: Required<DownloadOptions>;
  private cacheDir: string;

  constructor(options: DownloadOptions = {}) {
    this.options = {
      version: options.version ?? 'latest',
      timeout: options.timeout ?? 60000,
      retries: options.retries ?? 3,
      proxy: options.proxy ?? process.env.HTTPS_PROXY ?? process.env.https_proxy ?? '',
      mirror: options.mirror ?? '',
    };

    this.cacheDir = path.join(os.homedir(), '.yuanling', 'native-cache');
  }

  /**
   * 获取当前平台信息
   */
  getPlatformInfo(): PlatformInfo {
    const platform = PLATFORM_MAP[os.platform()] || os.platform();
    const arch = ARCH_MAP[os.arch()] || os.arch();
    const nodeVersion = process.versions.node;
    const abi = this.getAbi(nodeVersion);

    return { platform, arch, nodeVersion, abi };
  }

  /**
   * 获取 Node ABI 版本
   */
  private getAbi(nodeVersion: string): string {
    const major = parseInt(nodeVersion.split('.')[0], 10);
    
    // Node ABI 映射
    const abiMap: Record<number, string> = {
      14: '83',
      15: '88',
      16: '93',
      17: '102',
      18: '108',
      19: '111',
      20: '115',
      21: '120',
      22: '127',
      23: '131',
      24: '136',
    };

    return abiMap[major] || 'unknown';
  }

  /**
   * 下载原生模块
   */
  async download(): Promise<DownloadResult> {
    const platformInfo = this.getPlatformInfo();
    const binaryName = this.getBinaryName(platformInfo);

    console.log(`[Native] 平台: ${platformInfo.platform}-${platformInfo.arch}`);
    console.log(`[Native] Node: ${platformInfo.nodeVersion} (ABI: ${platformInfo.abi})`);
    console.log(`[Native] 目标: ${binaryName}`);

    // 检查本地是否已存在
    const localPath = this.getLocalPath();
    if (fs.existsSync(path.join(localPath, 'vector_ops.node'))) {
      console.log('[Native] 本地模块已存在');
      
      // 验证完整性
      const validator = getIntegrityValidator();
      const result = validator.validateFile(path.join(localPath, 'vector_ops.node'));
      
      if (result.valid) {
        return {
          success: true,
          path: path.join(localPath, 'vector_ops.node'),
          validated: true,
        };
      } else {
        console.log('[Native] 本地模块校验失败，重新下载');
      }
    }

    // 获取下载 URL
    let downloadUrl: string;
    try {
      downloadUrl = await this.getDownloadUrl(binaryName);
    } catch (error) {
      return {
        success: false,
        error: `获取下载链接失败: ${error}`,
      };
    }

    console.log(`[Native] 下载: ${downloadUrl}`);

    // 下载文件
    const tempFile = path.join(os.tmpdir(), binaryName);
    try {
      await this.downloadFile(downloadUrl, tempFile);
    } catch (error) {
      return {
        success: false,
        error: `下载失败: ${error}`,
      };
    }

    // 解压文件
    try {
      await this.extractFile(tempFile, localPath);
    } catch (error) {
      return {
        success: false,
        error: `解压失败: ${error}`,
      };
    }

    // 清理临时文件
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // 忽略清理错误
    }

    // 验证下载的文件
    const validator = getIntegrityValidator();
    const result = validator.validateFile(path.join(localPath, 'vector_ops.node'));

    return {
      success: result.valid,
      path: result.valid ? path.join(localPath, 'vector_ops.node') : undefined,
      validated: result.valid,
      error: result.valid ? undefined : result.error,
    };
  }

  /**
   * 获取二进制文件名
   */
  private getBinaryName(info: PlatformInfo): string {
    const ext = info.platform === 'win32' ? 'zip' : 'tar.gz';
    return `native-${info.platform}-${info.arch}.${ext}`;
  }

  /**
   * 获取本地存储路径
   */
  private getLocalPath(): string {
    return path.join(__dirname, '../../native/build/Release');
  }

  /**
   * 获取下载 URL
   */
  private async getDownloadUrl(binaryName: string): Promise<string> {
    // 如果指定了镜像
    if (this.options.mirror) {
      return `${this.options.mirror}/${this.options.version}/${binaryName}`;
    }

    // 从 GitHub API 获取
    const version = this.options.version === 'latest' ? 'latest' : `tags/v${this.options.version}`;
    const apiUrl = `${GITHUB_API_URL}/repos/${GITHUB_REPO}/releases/${version}`;

    const releaseInfo = await this.fetchJson<ReleaseInfo>(apiUrl);

    if (!releaseInfo || !releaseInfo.assets) {
      throw new Error('无法获取 Release 信息');
    }

    const asset = releaseInfo.assets.find(a => a.name === binaryName);
    if (!asset) {
      throw new Error(`找不到 ${binaryName} 的下载资源`);
    }

    return asset.url;
  }

  /**
   * 下载文件
   */
  private async downloadFile(url: string, target: string): Promise<void> {
    // 确保目录存在
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(target);
      let retries = 0;

      const attempt = (currentUrl: string) => {
        const client = currentUrl.startsWith('https') ? https : http;

        const request = client.get(currentUrl, {
          timeout: this.options.timeout,
          headers: {
            'User-Agent': 'YuanLing-NativeDownloader/1.0',
            'Accept': 'application/octet-stream',
          },
        }, (response) => {
          // 处理重定向
          if (response.statusCode === 301 || response.statusCode === 302) {
            const location = response.headers.location;
            if (location) {
              attempt(location);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });
        });

        request.on('error', (error) => {
          retries++;
          if (retries < this.options.retries) {
            console.log(`[Native] 重试 ${retries}/${this.options.retries}`);
            attempt(currentUrl);
          } else {
            reject(error);
          }
        });

        request.on('timeout', () => {
          request.destroy();
          reject(new Error('下载超时'));
        });
      };

      attempt(url);
    });
  }

  /**
   * 解压文件
   */
  private async extractFile(archive: string, target: string): Promise<void> {
    // 确保目标目录存在
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const ext = path.extname(archive);

    if (ext === '.zip') {
      // Windows 使用 unzip
      child_process.execSync(`unzip -o "${archive}" -d "${target}"`, { stdio: 'inherit' });
    } else {
      // Linux/macOS 使用 tar
      child_process.execSync(`tar -xzf "${archive}" -C "${target}"`, { stdio: 'inherit' });
    }
  }

  /**
   * 获取 JSON 数据
   */
  private async fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'YuanLing-NativeDownloader/1.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      }, (response) => {
        let data = '';

        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true });
      console.log('[Native] 缓存已清理');
    }
  }
}

// ============================================================
// 单例实例
// ============================================================

let defaultDownloader: NativeDownloader | null = null;

export function getNativeDownloader(options?: DownloadOptions): NativeDownloader {
  if (!defaultDownloader) {
    defaultDownloader = new NativeDownloader(options);
  }
  return defaultDownloader;
}

/**
 * 快速下载原生模块
 */
export async function downloadNative(options?: DownloadOptions): Promise<DownloadResult> {
  const downloader = new NativeDownloader(options);
  return downloader.download();
}
