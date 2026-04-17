/**
 * 记忆持久化存储
 * 
 * 使用 SQLite 实现五层记忆的持久化存储
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export interface MemoryRecord {
  id: string;
  layer: number;
  content: string;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export interface MemoryQuery {
  text?: string;
  layer?: number;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
}

// ============================================================================
// 简单的 JSON 文件存储（无需 SQLite 依赖）
// ============================================================================

export class MemoryPersistence {
  private dataDir: string;
  private memories: Map<number, MemoryRecord[]> = new Map();
  private initialized: boolean = false;

  constructor(dataDir: string = './data/memory') {
    this.dataDir = dataDir;
    
    // 初始化五层记忆
    for (let i = 0; i < 5; i++) {
      this.memories.set(i, []);
    }
  }

  /**
   * 初始化存储
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // 确保目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // 加载已有数据
    for (let layer = 0; layer < 5; layer++) {
      const filePath = this.getLayerFilePath(layer);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.memories.set(layer, data);
          console.log(`   ✅ 加载 L${layer} 记忆: ${data.length} 条`);
        } catch (e) {
          console.log(`   ⚠️ 加载 L${layer} 记忆失败，使用空存储`);
        }
      }
    }

    this.initialized = true;
    console.log('   ✅ 记忆持久化存储初始化完成');
  }

  /**
   * 获取层文件路径
   */
  private getLayerFilePath(layer: number): string {
    return path.join(this.dataDir, `layer-${layer}.json`);
  }

  /**
   * 添加记忆
   */
  async add(layer: number, content: string, metadata: Record<string, any> = {}): Promise<MemoryRecord> {
    await this.init();

    const record: MemoryRecord = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      layer,
      content,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now()
    };

    const memories = this.memories.get(layer) || [];
    memories.push(record);
    this.memories.set(layer, memories);

    // 持久化
    await this.persist(layer);

    return record;
  }

  /**
   * 搜索记忆
   */
  async search(query: MemoryQuery): Promise<MemoryRecord[]> {
    await this.init();

    let results: MemoryRecord[] = [];

    // 确定搜索范围
    const layers = query.layer !== undefined ? [query.layer] : [0, 1, 2, 3, 4];

    for (const layer of layers) {
      const memories = this.memories.get(layer) || [];
      results.push(...memories);
    }

    // 文本搜索
    if (query.text) {
      const searchText = query.text.toLowerCase();
      results = results.filter(m => 
        m.content.toLowerCase().includes(searchText) ||
        JSON.stringify(m.metadata).toLowerCase().includes(searchText)
      );
    }

    // 时间范围过滤
    if (query.startTime) {
      results = results.filter(m => m.createdAt >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter(m => m.createdAt <= query.endTime!);
    }

    // 按时间倒序排序
    results.sort((a, b) => b.createdAt - a.createdAt);

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || 10;
    results = results.slice(offset, offset + limit);

    // 更新访问计数
    for (const record of results) {
      record.accessCount++;
      record.lastAccessedAt = Date.now();
    }

    return results;
  }

  /**
   * 获取记忆
   */
  async get(id: string): Promise<MemoryRecord | undefined> {
    await this.init();

    for (const [layer, memories] of this.memories) {
      const record = memories.find(m => m.id === id);
      if (record) {
        record.accessCount++;
        record.lastAccessedAt = Date.now();
        return record;
      }
    }

    return undefined;
  }

  /**
   * 更新记忆
   */
  async update(id: string, updates: Partial<MemoryRecord>): Promise<MemoryRecord | undefined> {
    await this.init();

    for (const [layer, memories] of this.memories) {
      const index = memories.findIndex(m => m.id === id);
      if (index !== -1) {
        const record = memories[index];
        Object.assign(record, updates, { updatedAt: Date.now() });
        await this.persist(layer);
        return record;
      }
    }

    return undefined;
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    await this.init();

    for (const [layer, memories] of this.memories) {
      const index = memories.findIndex(m => m.id === id);
      if (index !== -1) {
        memories.splice(index, 1);
        await this.persist(layer);
        return true;
      }
    }

    return false;
  }

  /**
   * 记忆晋升（从低层移动到高层）
   */
  async promote(id: string): Promise<MemoryRecord | undefined> {
    await this.init();

    for (let layer = 0; layer < 4; layer++) {
      const memories = this.memories.get(layer) || [];
      const index = memories.findIndex(m => m.id === id);
      
      if (index !== -1) {
        const record = memories.splice(index, 1)[0];
        record.layer = layer + 1;
        record.updatedAt = Date.now();
        
        const targetMemories = this.memories.get(layer + 1) || [];
        targetMemories.push(record);
        this.memories.set(layer + 1, targetMemories);
        
        await this.persist(layer);
        await this.persist(layer + 1);
        
        return record;
      }
    }

    return undefined;
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<Record<string, { count: number; oldestAt?: number; newestAt?: number }>> {
    await this.init();

    const stats: Record<string, { count: number; oldestAt?: number; newestAt?: number }> = {};
    const layerNames = ['l0', 'l1', 'l2', 'l3', 'l4'];

    for (let layer = 0; layer < 5; layer++) {
      const memories = this.memories.get(layer) || [];
      stats[layerNames[layer]] = {
        count: memories.length,
        oldestAt: memories.length > 0 ? Math.min(...memories.map(m => m.createdAt)) : undefined,
        newestAt: memories.length > 0 ? Math.max(...memories.map(m => m.createdAt)) : undefined
      };
    }

    return stats;
  }

  /**
   * 持久化到文件
   */
  private async persist(layer: number): Promise<void> {
    const filePath = this.getLayerFilePath(layer);
    const memories = this.memories.get(layer) || [];
    
    fs.writeFileSync(filePath, JSON.stringify(memories, null, 2), 'utf-8');
  }

  /**
   * 清空所有记忆
   */
  async clear(): Promise<void> {
    for (let layer = 0; layer < 5; layer++) {
      this.memories.set(layer, []);
      await this.persist(layer);
    }
  }

  /**
   * 关闭存储
   */
  async close(): Promise<void> {
    // 持久化所有层
    for (let layer = 0; layer < 5; layer++) {
      await this.persist(layer);
    }
    console.log('   ✅ 记忆持久化存储已关闭');
  }
}

// ============================================================================
// 导出
// ============================================================================

export default MemoryPersistence;
