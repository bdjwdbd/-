/**
 * WAL (Write-Ahead Logging) 优化器
 * 
 * 功能：
 * 1. 预写日志管理
 * 2. 检查点优化
 * 3. 崩溃恢复
 */

// ============================================================
// 类型定义
// ============================================================

export interface WALConfig {
  maxLogSize: number;        // 最大日志大小（字节）
  checkpointInterval: number; // 检查点间隔（毫秒）
  syncMode: 'sync' | 'async' | 'none'; // 同步模式
  compression: boolean;       // 是否压缩
}

export interface WALEntry {
  sequence: number;          // 序列号
  timestamp: number;         // 时间戳
  operation: 'insert' | 'update' | 'delete' | 'checkpoint';
  data: unknown;             // 操作数据
  checksum: number;          // 校验和
}

export interface Checkpoint {
  sequence: number;          // 检查点序列号
  timestamp: number;         // 检查点时间
  entries: WALEntry[];       // 检查点条目
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: WALConfig = {
  maxLogSize: 100 * 1024 * 1024, // 100MB
  checkpointInterval: 60000,     // 1分钟
  syncMode: 'async',
  compression: true,
};

// ============================================================
// WAL 优化器
// ============================================================

export class WALOptimizer {
  private config: WALConfig;
  private entries: WALEntry[] = [];
  private currentSequence: number = 0;
  private lastCheckpoint: number = 0;
  private checkpoints: Checkpoint[] = [];
  private isRunning: boolean = false;
  private checkpointTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<WALConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动 WAL
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // 启动检查点定时器
    this.checkpointTimer = setInterval(() => {
      this.createCheckpoint();
    }, this.config.checkpointInterval);
  }

  /**
   * 停止 WAL
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // 停止定时器
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    
    // 创建最终检查点
    this.createCheckpoint();
  }

  /**
   * 写入日志
   */
  write(operation: WALEntry['operation'], data: unknown): number {
    const entry: WALEntry = {
      sequence: ++this.currentSequence,
      timestamp: Date.now(),
      operation,
      data,
      checksum: this.computeChecksum(data),
    };
    
    this.entries.push(entry);
    
    // 检查是否需要创建检查点
    if (this.shouldCheckpoint()) {
      this.createCheckpoint();
    }
    
    // 同步模式
    if (this.config.syncMode === 'sync') {
      this.sync();
    }
    
    return entry.sequence;
  }

  /**
   * 批量写入
   */
  writeBatch(operations: Array<{ operation: WALEntry['operation']; data: unknown }>): number[] {
    const sequences: number[] = [];
    
    for (const { operation, data } of operations) {
      sequences.push(this.write(operation, data));
    }
    
    return sequences;
  }

  /**
   * 创建检查点
   */
  createCheckpoint(): Checkpoint {
    const checkpoint: Checkpoint = {
      sequence: this.currentSequence,
      timestamp: Date.now(),
      entries: [...this.entries],
    };
    
    this.checkpoints.push(checkpoint);
    this.lastCheckpoint = checkpoint.sequence;
    
    // 清理旧日志
    this.entries = [];
    
    // 限制检查点数量
    if (this.checkpoints.length > 10) {
      this.checkpoints.shift();
    }
    
    return checkpoint;
  }

  /**
   * 恢复
   */
  recover(): WALEntry[] {
    const allEntries: WALEntry[] = [];
    
    // 从最近的检查点恢复
    if (this.checkpoints.length > 0) {
      const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
      allEntries.push(...lastCheckpoint.entries);
    }
    
    // 应用后续日志
    allEntries.push(...this.entries);
    
    // 验证校验和
    return allEntries.filter(entry => {
      const checksum = this.computeChecksum(entry.data);
      return checksum === entry.checksum;
    });
  }

  /**
   * 同步到磁盘
   */
  sync(): void {
    // 在实际实现中，这里会调用 fsync
    // 这里只是模拟
    // console.log(`WAL sync: ${this.entries.length} entries`);
  }

  /**
   * 压缩日志
   */
  compact(): void {
    if (!this.config.compression) return;
    
    // 移除重复操作
    const seen = new Set<string>();
    const compacted: WALEntry[] = [];
    
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      const key = this.getEntryKey(entry);
      
      if (!seen.has(key)) {
        seen.add(key);
        compacted.unshift(entry);
      }
    }
    
    this.entries = compacted;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalEntries: number;
    totalSize: number;
    lastCheckpoint: number;
    checkpointCount: number;
  } {
    return {
      totalEntries: this.entries.length,
      totalSize: this.estimateSize(),
      lastCheckpoint: this.lastCheckpoint,
      checkpointCount: this.checkpoints.length,
    };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private shouldCheckpoint(): boolean {
    return this.estimateSize() >= this.config.maxLogSize;
  }

  private estimateSize(): number {
    // 估算日志大小
    return this.entries.length * 100; // 简化估算
  }

  private computeChecksum(data: unknown): number {
    // 简单校验和
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  private getEntryKey(entry: WALEntry): string {
    // 生成条目键（用于去重）
    return `${entry.operation}:${JSON.stringify(entry.data)}`;
  }
}

// ============================================================
// 导出
// ============================================================

export function createWALOptimizer(config?: Partial<WALConfig>): WALOptimizer {
  return new WALOptimizer(config);
}
