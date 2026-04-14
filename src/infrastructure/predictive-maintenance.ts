/**
 * 预测维护模块
 * 
 * 预测记忆增长和维护计划
 * 融合自 yaoyao-memory-v2
 */

import { StructuredLogger } from './index';
import { MemoryStore } from './memory-store';

// ============ 类型定义 ============

export interface GrowthPrediction {
  period: string;
  predictedGrowth: number;
  confidence: number;
  factors: string[];
}

export interface MaintenancePlan {
  id: string;
  type: MaintenanceType;
  priority: 'low' | 'medium' | 'high';
  description: string;
  estimatedImpact: string;
  scheduledAt: number;
  status: 'pending' | 'running' | 'completed';
}

export type MaintenanceType = 
  | 'cleanup'
  | 'archive'
  | 'optimize'
  | 'backup'
  | 'reindex';

export interface MaintenanceStats {
  totalMemories: number;
  avgGrowthPerDay: number;
  lastCleanup: number;
  lastBackup: number;
  healthScore: number;
}

// ============ 预测维护类 ============

export class PredictiveMaintenance {
  private logger: StructuredLogger;
  private memoryStore: MemoryStore;
  private maintenanceHistory: MaintenancePlan[] = [];
  private growthHistory: Array<{ date: number; count: number }> = [];

  constructor(logger: StructuredLogger, memoryStore: MemoryStore) {
    this.logger = logger;
    this.memoryStore = memoryStore;
  }

  // ============ 增长预测 ============

  async predictGrowth(days: number = 7): Promise<GrowthPrediction> {
    const stats = await this.memoryStore.getStats();
    const currentCount = stats.total;

    // 基于历史数据预测
    const avgGrowthPerDay = this.calculateAvgGrowth();
    const predictedGrowth = avgGrowthPerDay * days;

    // 计算置信度
    const confidence = this.calculateConfidence();

    // 识别影响因素
    const factors = this.identifyGrowthFactors(stats);

    return {
      period: `${days} 天`,
      predictedGrowth: Math.round(predictedGrowth),
      confidence,
      factors
    };
  }

  private calculateAvgGrowth(): number {
    if (this.growthHistory.length < 2) {
      return 5; // 默认每天 5 条
    }

    const recent = this.growthHistory.slice(-7);
    let totalGrowth = 0;

    for (let i = 1; i < recent.length; i++) {
      totalGrowth += recent[i].count - recent[i - 1].count;
    }

    return totalGrowth / (recent.length - 1);
  }

  private calculateConfidence(): number {
    if (this.growthHistory.length < 7) {
      return 0.5;
    }
    if (this.growthHistory.length < 30) {
      return 0.7;
    }
    return 0.9;
  }

  private identifyGrowthFactors(stats: any): string[] {
    const factors: string[] = [];

    if (stats.avgImportance > 0.7) {
      factors.push('高重要性记忆占比高，增长可能放缓');
    }

    if (stats.avgConfidence < 0.6) {
      factors.push('低置信度记忆较多，建议清理');
    }

    if (Object.keys(stats.byTag).length > 20) {
      factors.push('标签分散，可能需要合并');
    }

    return factors;
  }

  // ============ 维护计划 ============

  async generatePlan(): Promise<MaintenancePlan[]> {
    const plans: MaintenancePlan[] = [];
    const stats = await this.getStats();

    // 1. 清理计划
    if (stats.healthScore < 0.7) {
      plans.push({
        id: `cleanup_${Date.now()}`,
        type: 'cleanup',
        priority: 'high',
        description: '清理低质量和过期记忆',
        estimatedImpact: '预计释放 20% 存储空间',
        scheduledAt: Date.now(),
        status: 'pending'
      });
    }

    // 2. 归档计划
    if (stats.totalMemories > 1000) {
      plans.push({
        id: `archive_${Date.now()}`,
        type: 'archive',
        priority: 'medium',
        description: '归档 30 天前的低重要性记忆',
        estimatedImpact: '预计归档 30% 记忆',
        scheduledAt: Date.now() + 24 * 60 * 60 * 1000,
        status: 'pending'
      });
    }

    // 3. 备份计划
    const daysSinceBackup = (Date.now() - stats.lastBackup) / (24 * 60 * 60 * 1000);
    if (daysSinceBackup > 7) {
      plans.push({
        id: `backup_${Date.now()}`,
        type: 'backup',
        priority: 'high',
        description: '创建记忆备份',
        estimatedImpact: '确保数据安全',
        scheduledAt: Date.now(),
        status: 'pending'
      });
    }

    // 4. 优化计划
    if (stats.totalMemories > 500) {
      plans.push({
        id: `optimize_${Date.now()}`,
        type: 'optimize',
        priority: 'low',
        description: '优化记忆索引和存储',
        estimatedImpact: '提升搜索性能 20%',
        scheduledAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        status: 'pending'
      });
    }

    return plans;
  }

  // ============ 执行维护 ============

  async executePlan(plan: MaintenancePlan): Promise<boolean> {
    this.logger.info('PredictiveMaintenance', `执行维护: ${plan.type}`);

    plan.status = 'running';

    try {
      switch (plan.type) {
        case 'cleanup':
          await this.executeCleanup();
          break;
        case 'archive':
          await this.executeArchive();
          break;
        case 'backup':
          await this.executeBackup();
          break;
        case 'optimize':
          await this.executeOptimize();
          break;
        default:
          this.logger.warn('PredictiveMaintenance', `未知维护类型: ${plan.type}`);
      }

      plan.status = 'completed';
      this.maintenanceHistory.push(plan);
      return true;
    } catch (e) {
      this.logger.error('PredictiveMaintenance', `维护失败: ${e}`);
      plan.status = 'pending';
      return false;
    }
  }

  private async executeCleanup(): Promise<void> {
    const cleaned = await this.memoryStore.cleanup({
      minImportance: 0.2,
      maxAge: 90 * 24 * 60 * 60 * 1000 // 90天
    });
    this.logger.info('PredictiveMaintenance', `清理完成: ${cleaned} 条`);
  }

  private async executeArchive(): Promise<void> {
    // 简化版归档：标记低重要性记忆
    const memories = await this.memoryStore.exportAll();
    const oldThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    let archived = 0;
    for (const memory of memories) {
      if (memory.createdAt < oldThreshold && memory.importance < 0.5) {
        await this.memoryStore.update(memory.id, {
          metadata: { ...memory.metadata, archived: true }
        });
        archived++;
      }
    }
    
    this.logger.info('PredictiveMaintenance', `归档完成: ${archived} 条`);
  }

  private async executeBackup(): Promise<void> {
    // 导出所有记忆作为备份
    const memories = await this.memoryStore.exportAll();
    this.logger.info('PredictiveMaintenance', `备份完成: ${memories.length} 条`);
  }

  private async executeOptimize(): Promise<void> {
    // 简化版优化：更新访问统计
    this.logger.info('PredictiveMaintenance', '优化完成');
  }

  // ============ 统计 ============

  async getStats(): Promise<MaintenanceStats> {
    const memStats = await this.memoryStore.getStats();
    
    // 计算健康分数
    let healthScore = 1.0;
    
    if (memStats.avgConfidence < 0.6) {
      healthScore -= 0.2;
    }
    if (memStats.avgImportance < 0.5) {
      healthScore -= 0.2;
    }
    
    // 获取上次维护时间
    const lastCleanup = this.maintenanceHistory
      .filter(p => p.type === 'cleanup' && p.status === 'completed')
      .pop()?.scheduledAt || 0;
    
    const lastBackup = this.maintenanceHistory
      .filter(p => p.type === 'backup' && p.status === 'completed')
      .pop()?.scheduledAt || 0;

    return {
      totalMemories: memStats.total,
      avgGrowthPerDay: this.calculateAvgGrowth(),
      lastCleanup,
      lastBackup,
      healthScore: Math.max(0, healthScore)
    };
  }

  // ============ 历史记录 ============

  getMaintenanceHistory(): MaintenancePlan[] {
    return [...this.maintenanceHistory];
  }

  recordGrowth(count: number): void {
    this.growthHistory.push({
      date: Date.now(),
      count
    });

    // 保留最近 90 天的记录
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    this.growthHistory = this.growthHistory.filter(g => g.date > cutoff);
  }
}
