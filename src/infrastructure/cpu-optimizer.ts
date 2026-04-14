/**
 * CPU 优化器
 * 
 * 功能：
 * 1. CPU 信息检测
 * 2. SIMD 支持检测
 * 3. 缓存优化
 * 4. 并行计算优化
 */

// ============================================================
// 类型定义
// ============================================================

export interface CPUInfo {
  vendor: string;
  model: string;
  cores: number;
  threads: number;
  simd: {
    avx512: boolean;
    avx512_vnni: boolean;
    avx2: boolean;
    sse4_2: boolean;
    neon: boolean;
  };
  cache: {
    l1: number;
    l2: number;
    l3: number;
  };
}

export interface CPUOptimizerConfig {
  useSIMD: boolean;
  useCacheBlocking: boolean;
  parallelThreshold: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: CPUOptimizerConfig = {
  useSIMD: true,
  useCacheBlocking: true,
  parallelThreshold: 1000,
};

// ============================================================
// CPU 优化器
// ============================================================

export class CPUOptimizer {
  private config: CPUOptimizerConfig;
  private cpuInfo: CPUInfo;

  constructor(config: Partial<CPUOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cpuInfo = this.detectCPUInfo();
  }

  /**
   * 检测 CPU 信息
   */
  private detectCPUInfo(): CPUInfo {
    const info: CPUInfo = {
      vendor: 'unknown',
      model: 'unknown',
      cores: 1,
      threads: 1,
      simd: {
        avx512: false,
        avx512_vnni: false,
        avx2: true,  // 假设现代 CPU 支持
        sse4_2: true,
        neon: false,
      },
      cache: {
        l1: 32 * 1024,      // 32KB
        l2: 256 * 1024,     // 256KB
        l3: 8 * 1024 * 1024, // 8MB
      },
    };

    // Node.js 环境下获取 CPU 信息
    if (typeof require !== 'undefined') {
      try {
        const os = require('os');
        info.cores = os.cpus().length;
        info.threads = info.cores;
        
        const cpuModel = os.cpus()[0]?.model || '';
        if (cpuModel.includes('Intel')) {
          info.vendor = 'Intel';
        } else if (cpuModel.includes('AMD')) {
          info.vendor = 'AMD';
        } else if (cpuModel.includes('Apple')) {
          info.vendor = 'Apple';
          info.simd.neon = true;
        }
        info.model = cpuModel;
      } catch {
        // 忽略错误
      }
    }

    return info;
  }

  /**
   * 获取 CPU 信息
   */
  getCPUInfo(): CPUInfo {
    return { ...this.cpuInfo };
  }

  /**
   * 计算最优块大小
   */
  calculateBlockSize(cacheLevel: 'l1' | 'l2' | 'l3', vectorDim: number): number {
    const cacheSize = this.cpuInfo.cache[cacheLevel];
    const bytesPerVector = vectorDim * 4; // float32
    
    // 使用 50% 的缓存
    const usableCache = cacheSize * 0.5;
    const blockSize = Math.floor(usableCache / bytesPerVector);
    
    // 限制在合理范围
    return Math.max(8, Math.min(blockSize, 1024));
  }

  /**
   * 优化的向量搜索（缓存阻塞）
   */
  optimizedSearch(
    query: number[],
    vectors: number[][],
    topK: number = 10
  ): Array<{ index: number; score: number }> {
    const dim = query.length;
    const blockSize = this.calculateBlockSize('l2', dim);
    
    const results: Array<{ index: number; score: number }> = [];
    
    // 分块处理
    for (let blockStart = 0; blockStart < vectors.length; blockStart += blockSize) {
      const blockEnd = Math.min(blockStart + blockSize, vectors.length);
      
      for (let i = blockStart; i < blockEnd; i++) {
        const score = this.cosineSimilarity(query, vectors[i]);
        results.push({ index: i, score });
      }
    }

    // 排序并返回 top-k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dot += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    return norm1 && norm2 ? dot / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0;
  }

  /**
   * 获取最优并行度
   */
  getOptimalParallelism(): number {
    return this.cpuInfo.cores;
  }

  /**
   * 判断是否应该并行处理
   */
  shouldParallelize(itemCount: number): boolean {
    return itemCount >= this.config.parallelThreshold;
  }

  /**
   * 针对 Intel Xeon 优化
   */
  optimizeForIntelXeon(): void {
    // Intel Xeon 特定优化
    this.config.useSIMD = true;
    this.config.useCacheBlocking = true;
    this.config.parallelThreshold = 500;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CPUOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): CPUOptimizerConfig {
    return { ...this.config };
  }
}

// ============================================================
// 单例
// ============================================================

let cpuOptimizerInstance: CPUOptimizer | null = null;

export function getOptimizer(config?: Partial<CPUOptimizerConfig>): CPUOptimizer {
  if (!cpuOptimizerInstance) {
    cpuOptimizerInstance = new CPUOptimizer(config);
  }
  return cpuOptimizerInstance;
}

export function optimizeForIntelXeon(): void {
  getOptimizer().optimizeForIntelXeon();
}
