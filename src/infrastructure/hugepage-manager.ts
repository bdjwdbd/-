/**
 * 大页内存管理
 * 
 * 在 Node.js 中，我们可以通过以下方式优化内存：
 * 1. Buffer 池化
 * 2. SharedArrayBuffer
 * 3. 内存对齐分配
 * 
 * 注意：真正的大页内存需要系统级权限
 */

// ============================================================
// 类型定义
// ============================================================

export interface HugePageInfo {
  supported: boolean;
  pageSize: number;
  totalPages: number;
  freePages: number;
  canConfigure: boolean;
}

export interface MemoryPoolConfig {
  initialSize: number;
  maxSize: number;
  alignment: number;
  useSharedBuffer: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: MemoryPoolConfig = {
  initialSize: 1024 * 1024,      // 1MB
  maxSize: 100 * 1024 * 1024,    // 100MB
  alignment: 64,                  // 64 字节对齐
  useSharedBuffer: true,
};

// ============================================================
// 大页内存管理器
// ============================================================

export class HugePageManager {
  private info: HugePageInfo;

  constructor() {
    this.info = this.detectHugePages();
  }

  /**
   * 检测大页内存
   */
  private detectHugePages(): HugePageInfo {
    const info: HugePageInfo = {
      supported: false,
      pageSize: 2 * 1024 * 1024,  // 默认 2MB
      totalPages: 0,
      freePages: 0,
      canConfigure: false,
    };

    // Node.js 无法直接访问大页内存
    // 但我们可以使用 SharedArrayBuffer 作为替代
    try {
      // 检测 SharedArrayBuffer 支持
      const test = new SharedArrayBuffer(1024);
      if (test) {
        info.supported = true;
        info.canConfigure = true;
      }
    } catch {
      // SharedArrayBuffer 不可用
    }

    return info;
  }

  /**
   * 是否可用
   */
  isAvailable(): boolean {
    return this.info.supported;
  }

  /**
   * 获取信息
   */
  getInfo(): HugePageInfo {
    return { ...this.info };
  }

  /**
   * 分配对齐内存
   */
  allocateAligned(size: number): Buffer | SharedArrayBuffer {
    if (this.info.supported && this.info.canConfigure) {
      return new SharedArrayBuffer(size);
    }
    return Buffer.alloc(size);
  }

  /**
   * 打印状态
   */
  printStatus(): void {
    // console.log('大页内存管理器状态:');
    // console.log(`  支持大页: ${this.info.supported ? '✅' : '❌'}`);
    // console.log(`  页大小: ${this.info.pageSize / 1024} KB`);
    // console.log(`  可配置: ${this.info.canConfigure ? '✅' : '❌'}`);
  }
}

// ============================================================
// 高性能内存池
// ============================================================

export class HighPerformanceMemoryPool {
  private config: MemoryPoolConfig;
  private pools: Map<number, Array<Buffer>> = new Map();
  private allocated: number = 0;

  constructor(config: Partial<MemoryPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 分配内存
   */
  alloc(size: number): Buffer {
    // 对齐大小
    const alignedSize = this.alignSize(size);
    
    // 检查池中是否有可用内存
    const pool = this.pools.get(alignedSize);
    if (pool && pool.length > 0) {
      return pool.pop()!;
    }

    // 检查是否超过最大限制
    if (this.allocated + alignedSize > this.config.maxSize) {
      throw new Error('内存池已满');
    }

    // 分配新内存
    this.allocated += alignedSize;
    return Buffer.alloc(alignedSize);
  }

  /**
   * 释放内存
   */
  free(buffer: Buffer): void {
    const size = buffer.byteLength;
    const alignedSize = this.alignSize(size);

    if (!this.pools.has(alignedSize)) {
      this.pools.set(alignedSize, []);
    }

    const pool = this.pools.get(alignedSize)!;
    
    // 限制池大小
    if (pool.length < 100) {
      buffer.fill(0);
      pool.push(buffer);
    }
  }

  /**
   * 对齐大小
   */
  private alignSize(size: number): number {
    const alignment = this.config.alignment;
    return Math.ceil(size / alignment) * alignment;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    allocated: number;
    maxSize: number;
    poolCount: number;
    utilization: number;
  } {
    let pooledCount = 0;
    for (const pool of this.pools.values()) {
      pooledCount += pool.length;
    }

    return {
      allocated: this.allocated,
      maxSize: this.config.maxSize,
      poolCount: this.pools.size,
      utilization: this.allocated / this.config.maxSize,
    };
  }

  /**
   * 清空池
   */
  clear(): void {
    this.pools.clear();
    this.allocated = 0;
  }

  /**
   * 预分配
   */
  preAllocate(sizes: number[]): void {
    for (const size of sizes) {
      const alignedSize = this.alignSize(size);
      const buffer = this.alloc(alignedSize);
      this.free(buffer);
    }
  }
}

// ============================================================
// 向量内存管理器
// ============================================================

export class VectorMemoryManager {
  private pool: HighPerformanceMemoryPool;
  private vectorSize: number;
  private vectors: Map<string, Float32Array> = new Map();

  constructor(vectorDim: number, config?: Partial<MemoryPoolConfig>) {
    this.pool = new HighPerformanceMemoryPool(config);
    this.vectorSize = vectorDim * 4; // float32
  }

  /**
   * 分配向量
   */
  allocVector(id: string): Float32Array {
    const buffer = this.pool.alloc(this.vectorSize);
    const vec = new Float32Array(buffer.buffer, buffer.byteOffset, this.vectorSize / 4);
    this.vectors.set(id, vec);
    return vec;
  }

  /**
   * 获取向量
   */
  getVector(id: string): Float32Array | undefined {
    return this.vectors.get(id);
  }

  /**
   * 释放向量
   */
  freeVector(id: string): void {
    const vec = this.vectors.get(id);
    if (vec) {
      // 使用 Uint8Array 视图来清零
      new Uint8Array(vec.buffer).fill(0);
      this.vectors.delete(id);
    }
  }

  /**
   * 批量分配
   */
  allocBatch(count: number): Float32Array[] {
    const vectors: Float32Array[] = [];
    for (let i = 0; i < count; i++) {
      vectors.push(this.allocVector(`batch_${i}`));
    }
    return vectors;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    vectorCount: number;
    memoryUsed: number;
    poolStats: ReturnType<HighPerformanceMemoryPool['getStats']>;
  } {
    return {
      vectorCount: this.vectors.size,
      memoryUsed: this.vectors.size * this.vectorSize,
      poolStats: this.pool.getStats(),
    };
  }
}

// ============================================================
// 单例
// ============================================================

let hugePageManagerInstance: HugePageManager | null = null;

export function getHugePageManager(): HugePageManager {
  if (!hugePageManagerInstance) {
    hugePageManagerInstance = new HugePageManager();
  }
  return hugePageManagerInstance;
}
