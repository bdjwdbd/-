/**
 * 向量覆盖率监控器
 * 
 * 融合自 llm-memory-integration v5.2.17
 * 
 * 功能：
 * 1. 向量覆盖率检查
 * 2. 孤立向量检测
 * 3. 自动修复
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface CoverageReport {
  totalDocuments: number;
  vectorizedDocuments: number;
  coverage: number;
  missingVectors: string[];
  orphanVectors: string[];
  lastChecked: number;
  health: 'healthy' | 'warning' | 'critical';
}

export interface VectorStats {
  totalVectors: number;
  dimensions: number;
  avgMagnitude: number;
  nullVectors: number;
}

// ============ 向量覆盖率监控器 ============

export class VectorCoverageMonitor {
  private logger: StructuredLogger;
  private dataDir: string;
  
  // 阈值
  private static COVERAGE_WARNING = 0.8;  // 80% 以下警告
  private static COVERAGE_CRITICAL = 0.5; // 50% 以下严重
  
  constructor(logger: StructuredLogger, dataDir: string = './data/vectors') {
    this.logger = logger;
    this.dataDir = dataDir;
    this.ensureDir(dataDir);
  }
  
  /**
   * 检查覆盖率
   */
  check(): CoverageReport {
    const startTime = Date.now();
    
    // 加载文档
    const documents = this.loadDocuments();
    const vectors = this.loadVectors();
    
    const totalDocuments = documents.length;
    const vectorizedDocuments = vectors.size;
    
    // 计算覆盖率
    const coverage = totalDocuments > 0 ? vectorizedDocuments / totalDocuments : 0;
    
    // 找出缺失向量的文档
    const missingVectors: string[] = [];
    for (const docId of documents) {
      if (!vectors.has(docId)) {
        missingVectors.push(docId);
      }
    }
    
    // 找出孤立向量
    const orphanVectors: string[] = [];
    for (const [vecId] of vectors) {
      if (!documents.includes(vecId)) {
        orphanVectors.push(vecId);
      }
    }
    
    // 判断健康状态
    let health: 'healthy' | 'warning' | 'critical';
    if (coverage >= VectorCoverageMonitor.COVERAGE_WARNING) {
      health = 'healthy';
    } else if (coverage >= VectorCoverageMonitor.COVERAGE_CRITICAL) {
      health = 'warning';
    } else {
      health = 'critical';
    }
    
    const report: CoverageReport = {
      totalDocuments,
      vectorizedDocuments,
      coverage,
      missingVectors,
      orphanVectors,
      lastChecked: Date.now(),
      health,
    };
    
    this.logger.info('VectorCoverageMonitor', 
      `覆盖率检查: ${(coverage * 100).toFixed(1)}% (${vectorizedDocuments}/${totalDocuments}), 状态: ${health}, 耗时 ${Date.now() - startTime}ms`
    );
    
    return report;
  }
  
  /**
   * 修复缺失的向量
   */
  async fix(report?: CoverageReport): Promise<{ fixed: number; errors: string[] }> {
    const checkReport = report || this.check();
    const errors: string[] = [];
    let fixed = 0;
    
    // 删除孤立向量
    for (const orphanId of checkReport.orphanVectors) {
      try {
        this.deleteVector(orphanId);
        fixed++;
      } catch (error: any) {
        errors.push(`删除孤立向量 ${orphanId} 失败: ${error.message}`);
      }
    }
    
    // 为缺失向量的文档生成向量
    for (const docId of checkReport.missingVectors.slice(0, 100)) { // 限制每次修复数量
      try {
        await this.generateVector(docId);
        fixed++;
      } catch (error: any) {
        errors.push(`生成向量 ${docId} 失败: ${error.message}`);
      }
    }
    
    this.logger.info('VectorCoverageMonitor', `修复完成: ${fixed} 条, 错误: ${errors.length}`);
    
    return { fixed, errors };
  }
  
  /**
   * 获取向量统计
   */
  getStats(): VectorStats {
    const vectors = this.loadVectors();
    
    let totalMagnitude = 0;
    let nullCount = 0;
    let dimensions = 0;
    
    for (const [, vector] of vectors) {
      if (!vector || vector.length === 0) {
        nullCount++;
        continue;
      }
      
      dimensions = vector.length;
      const magnitude = Math.sqrt(vector.reduce((sum: number, v: number) => sum + v * v, 0));
      totalMagnitude += magnitude;
    }
    
    return {
      totalVectors: vectors.size,
      dimensions,
      avgMagnitude: vectors.size > 0 ? totalMagnitude / (vectors.size - nullCount) : 0,
      nullVectors: nullCount,
    };
  }
  
  /**
   * 启动守护进程
   */
  startDaemon(intervalMs: number = 3600000): NodeJS.Timeout {
    this.logger.info('VectorCoverageMonitor', `启动守护进程: 间隔 ${intervalMs}ms`);
    
    return setInterval(async () => {
      const report = this.check();
      
      if (report.health !== 'healthy') {
        this.logger.warn('VectorCoverageMonitor', 
          `检测到问题: 覆盖率 ${(report.coverage * 100).toFixed(1)}%, 开始修复`
        );
        await this.fix(report);
      }
    }, intervalMs);
  }
  
  // ============ 数据操作 ============
  
  private loadDocuments(): string[] {
    const docFile = path.join(this.dataDir, 'documents.json');
    
    try {
      if (fs.existsSync(docFile)) {
        return JSON.parse(fs.readFileSync(docFile, 'utf-8'));
      }
    } catch (error) {
      this.logger.warn('VectorCoverageMonitor', `加载文档失败: ${error}`);
    }
    
    return [];
  }
  
  private loadVectors(): Map<string, number[]> {
    const vectorFile = path.join(this.dataDir, 'vectors.json');
    const vectors = new Map<string, number[]>();
    
    try {
      if (fs.existsSync(vectorFile)) {
        const data = JSON.parse(fs.readFileSync(vectorFile, 'utf-8'));
        for (const [id, vector] of Object.entries(data)) {
          vectors.set(id, vector as number[]);
        }
      }
    } catch (error) {
      this.logger.warn('VectorCoverageMonitor', `加载向量失败: ${error}`);
    }
    
    return vectors;
  }
  
  private async generateVector(docId: string): Promise<void> {
    // 模拟向量生成
    const vector = new Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    
    const vectorFile = path.join(this.dataDir, 'vectors.json');
    const vectors = this.loadVectors();
    vectors.set(docId, vector);
    
    const data: Record<string, number[]> = {};
    for (const [id, v] of vectors) {
      data[id] = v;
    }
    
    fs.writeFileSync(vectorFile, JSON.stringify(data, null, 2));
  }
  
  private deleteVector(vecId: string): void {
    const vectorFile = path.join(this.dataDir, 'vectors.json');
    const vectors = this.loadVectors();
    vectors.delete(vecId);
    
    const data: Record<string, number[]> = {};
    for (const [id, v] of vectors) {
      data[id] = v;
    }
    
    fs.writeFileSync(vectorFile, JSON.stringify(data, null, 2));
  }
  
  // ============ 辅助方法 ============
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
