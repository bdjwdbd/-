/**
 * 遗忘检测器
 * 
 * 基于多维度衰减和矛盾检测的记忆遗忘机制
 * 融合自 yaoyao-memory-v2
 */

import { StructuredLogger } from './index';
import { Memory, MemoryStore } from './memory-store';

// ============ 类型定义 ============

export interface ForgetConfig {
  // 时间衰减
  timeDecayEnabled: boolean;
  halfLife: number; // 半衰期（毫秒）
  
  // 访问衰减
  accessDecayEnabled: boolean;
  accessBoost: number; // 每次访问的重要性提升
  
  // 矛盾检测
  contradictionEnabled: boolean;
  contradictionThreshold: number; // 矛盾阈值
  
  // 遗忘阈值
  forgetThreshold: number; // 低于此值则遗忘
  
  // 保护机制
  protectedTags: string[]; // 受保护的标签
  minConfidence: number; // 最小置信度保护
}

export interface ForgetResult {
  memoryId: string;
  reason: ForgetReason;
  oldImportance: number;
  newImportance: number;
  shouldForget: boolean;
}

export type ForgetReason = 
  | 'time_decay'
  | 'low_access'
  | 'contradiction'
  | 'duplicate'
  | 'manual';

export interface ContradictionPair {
  memory1: Memory;
  memory2: Memory;
  conflictScore: number;
  description: string;
}

// ============ 默认配置 ============

const DEFAULT_CONFIG: ForgetConfig = {
  timeDecayEnabled: true,
  halfLife: 7 * 24 * 60 * 60 * 1000, // 7天
  
  accessDecayEnabled: true,
  accessBoost: 0.1,
  
  contradictionEnabled: true,
  contradictionThreshold: 0.7,
  
  forgetThreshold: 0.1,
  
  protectedTags: ['important', 'pinned', 'user_preference'],
  minConfidence: 0.9
};

// ============ 遗忘检测器类 ============

export class ForgetDetector {
  private logger: StructuredLogger;
  private memoryStore: MemoryStore;
  private config: ForgetConfig;

  constructor(
    logger: StructuredLogger,
    memoryStore: MemoryStore,
    config?: Partial<ForgetConfig>
  ) {
    this.logger = logger;
    this.memoryStore = memoryStore;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============ 重要性计算 ============

  calculateImportance(memory: Memory): number {
    let importance = memory.importance;
    const now = Date.now();

    // 时间衰减
    if (this.config.timeDecayEnabled) {
      const age = now - memory.createdAt;
      const decayFactor = Math.pow(0.5, age / this.config.halfLife);
      importance *= decayFactor;
    }

    // 访问提升
    if (this.config.accessDecayEnabled) {
      const accessBoost = memory.accessCount * this.config.accessBoost;
      importance = Math.min(1, importance + accessBoost);
    }

    // 置信度影响
    importance *= memory.confidence;

    return Math.max(0, Math.min(1, importance));
  }

  // ============ 遗忘检测 ============

  async detect(): Promise<ForgetResult[]> {
    const memories = await this.memoryStore.exportAll();
    const results: ForgetResult[] = [];

    for (const memory of memories) {
      const result = await this.analyzeMemory(memory, memories);
      results.push(result);
    }

    // 检测矛盾
    if (this.config.contradictionEnabled) {
      const contradictions = await this.detectContradictions(memories);
      for (const pair of contradictions) {
        // 降低矛盾记忆的重要性
        if (pair.conflictScore > this.config.contradictionThreshold) {
          results.push({
            memoryId: pair.memory1.id,
            reason: 'contradiction',
            oldImportance: pair.memory1.importance,
            newImportance: pair.memory1.importance * 0.5,
            shouldForget: false
          });
        }
      }
    }

    this.logger.info('ForgetDetector', `检测完成: ${results.length} 条记忆`);
    return results;
  }

  private async analyzeMemory(memory: Memory, allMemories: Memory[]): Promise<ForgetResult> {
    const newImportance = this.calculateImportance(memory);
    
    // 检查保护
    const isProtected = this.isProtected(memory);
    
    // 检查重复
    const isDuplicate = await this.checkDuplicate(memory, allMemories);

    let reason: ForgetReason = 'time_decay';
    if (isDuplicate) {
      reason = 'duplicate';
    } else if (memory.accessCount < 2 && Date.now() - memory.createdAt > this.config.halfLife) {
      reason = 'low_access';
    }

    return {
      memoryId: memory.id,
      reason,
      oldImportance: memory.importance,
      newImportance,
      shouldForget: !isProtected && newImportance < this.config.forgetThreshold
    };
  }

  private isProtected(memory: Memory): boolean {
    // 检查受保护标签
    for (const tag of memory.tags) {
      if (this.config.protectedTags.includes(tag)) {
        return true;
      }
    }

    // 检查高置信度保护
    if (memory.confidence >= this.config.minConfidence) {
      return true;
    }

    return false;
  }

  private async checkDuplicate(memory: Memory, allMemories: Memory[]): Promise<boolean> {
    for (const other of allMemories) {
      if (other.id === memory.id) continue;
      
      // 简单的重复检测：内容相似度
      const similarity = this.calculateSimilarity(memory.content, other.content);
      if (similarity > 0.9 && other.createdAt < memory.createdAt) {
        return true;
      }
    }
    return false;
  }

  // ============ 矛盾检测 ============

  async detectContradictions(memories: Memory[]): Promise<ContradictionPair[]> {
    const contradictions: ContradictionPair[] = [];

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const conflict = this.detectConflict(memories[i], memories[j]);
        if (conflict) {
          contradictions.push(conflict);
        }
      }
    }

    return contradictions;
  }

  private detectConflict(mem1: Memory, mem2: Memory): ContradictionPair | null {
    // 检查类型相同的记忆
    if (mem1.type !== mem2.type) return null;

    // 检查内容矛盾
    const conflictScore = this.calculateConflictScore(mem1.content, mem2.content);
    
    if (conflictScore > 0.5) {
      return {
        memory1: mem1,
        memory2: mem2,
        conflictScore,
        description: `检测到 ${mem1.type} 类型记忆的潜在矛盾`
      };
    }

    return null;
  }

  private calculateConflictScore(content1: string, content2: string): number {
    // 简单的矛盾检测：检查否定词
    const negationWords = ['不', '没有', '无', '非', '不是', '并非'];
    
    const hasNegation1 = negationWords.some(w => content1.includes(w));
    const hasNegation2 = negationWords.some(w => content2.includes(w));

    // 如果一个有否定词，一个没有，且内容相似，则可能矛盾
    if (hasNegation1 !== hasNegation2) {
      const similarity = this.calculateSimilarity(
        content1.replace(/不|没有|无|非|不是|并非/g, ''),
        content2.replace(/不|没有|无|非|不是|并非/g, '')
      );
      if (similarity > 0.7) {
        return similarity;
      }
    }

    return 0;
  }

  // ============ 相似度计算 ============

  private calculateSimilarity(text1: string, text2: string): number {
    // Jaccard 相似度
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  // ============ 执行遗忘 ============

  async executeForget(results: ForgetResult[]): Promise<number> {
    let forgotten = 0;

    for (const result of results) {
      if (result.shouldForget) {
        await this.memoryStore.delete(result.memoryId);
        forgotten++;
        this.logger.debug('ForgetDetector', `遗忘记忆: ${result.memoryId} (${result.reason})`);
      } else if (result.newImportance !== result.oldImportance) {
        await this.memoryStore.update(result.memoryId, {
          importance: result.newImportance
        });
      }
    }

    this.logger.info('ForgetDetector', `执行完成: 遗忘 ${forgotten} 条记忆`);
    return forgotten;
  }

  // ============ 配置管理 ============

  updateConfig(config: Partial<ForgetConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('ForgetDetector', '配置已更新');
  }

  getConfig(): ForgetConfig {
    return { ...this.config };
  }
}
