/**
 * 智能记忆升级器 - TypeScript 原生实现
 * 
 * 功能：
 * 1. L0 → L1 升级（对话 → 结构化记忆）
 * 2. L1 → L2 升级（记忆 → 场景块）
 * 3. L2 → L3 升级（场景块 → 用户画像）
 * 
 * 升级规则：
 * - 基于访问次数
 * - 基于时间跨度
 * - 基于重要性分数
 * - 基于关键词匹配
 */

import { DatabaseSync } from "node:sqlite";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// ============================================================
// 类型定义
// ============================================================

export interface UpgradeRule {
  minConversations?: number;
  minDays?: number;
  minImportance?: number;
  minAccessCount?: number;
  minRelevance?: number;
  keywords?: string[];
  isCorePreference?: boolean;
}

export interface MemoryUpgradeConfig {
  l0ToL1: UpgradeRule;
  l1ToL2: UpgradeRule;
  l2ToL3: UpgradeRule;
  autoUpgrade: boolean;
  upgradeInterval: number;
}

export interface UpgradeResult {
  success: boolean;
  upgraded: number;
  details?: {
    l0ToL1?: number;
    l1ToL2?: number;
    l2ToL3?: number;
  };
  error?: string;
}

export interface MemoryCandidate {
  id: string;
  content: string;
  timestamp: string;
  accessCount: number;
  importanceScore: number;
  type?: string;
  scene?: string;
}

// ============================================================
// SmartMemoryUpgrader 类
// ============================================================

export class SmartMemoryUpgrader {
  private db: DatabaseSync | null = null;
  private config: MemoryUpgradeConfig;
  private dbPath: string;
  
  constructor(config: Partial<MemoryUpgradeConfig> = {}) {
    this.dbPath = path.join(os.homedir(), ".openclaw/memory-tdai/vectors.db");
    
    this.config = {
      l0ToL1: {
        minConversations: 5,
        minDays: 3,
        minImportance: 0.6,
        keywords: ["重要", "记住", "以后", "偏好", "规则", "配置"],
        ...config.l0ToL1,
      },
      l1ToL2: {
        minAccessCount: 3,
        minDays: 7,
        minRelevance: 0.7,
        ...config.l1ToL2,
      },
      l2ToL3: {
        minAccessCount: 10,
        minDays: 30,
        isCorePreference: true,
        ...config.l2ToL3,
      },
      autoUpgrade: config.autoUpgrade || false,
      upgradeInterval: config.upgradeInterval || 86400,
    };
  }
  
  // ============================================================
  // 初始化
  // ============================================================
  
  async initialize(): Promise<boolean> {
    if (!fs.existsSync(this.dbPath)) {
      console.warn("[SmartMemoryUpgrader] 数据库文件不存在");
      return false;
    }
    
    try {
      this.db = new DatabaseSync(this.dbPath);
      // console.log("[SmartMemoryUpgrader] ✅ 初始化完成");
      return true;
    } catch (error) {
      console.error("[SmartMemoryUpgrader] 初始化失败:", error);
      return false;
    }
  }
  
  // ============================================================
  // L0 → L1 升级
  // ============================================================
  
  async upgradeL0ToL1(): Promise<number> {
    if (!this.db) await this.initialize();
    if (!this.db) return 0;
    
    const rule = this.config.l0ToL1;
    const candidates = this.getL0Candidates(rule);
    
    let upgraded = 0;
    
    for (const candidate of candidates) {
      try {
        // 检查关键词匹配
        const hasKeyword = rule.keywords?.some((kw) =>
          candidate.content.includes(kw)
        );
        
        // 检查时间跨度
        const daysSinceCreation = this.getDaysSince(candidate.timestamp);
        const meetsTimeRequirement = rule.minDays ? daysSinceCreation >= rule.minDays : true;
        
        // 检查重要性
        const meetsImportance = rule.minImportance
          ? candidate.importanceScore >= rule.minImportance
          : true;
        
        // 决定是否升级
        if (hasKeyword || (meetsTimeRequirement && meetsImportance)) {
          await this.upgradeMemory(candidate, "L0", "L1");
          upgraded++;
        }
      } catch (error) {
        console.error(`[SmartMemoryUpgrader] 升级失败: ${candidate.id}`, error);
      }
    }
    
    // console.log(`[SmartMemoryUpgrader] L0 → L1 升级: ${upgraded} 条`);
    return upgraded;
  }
  
  private getL0Candidates(rule: UpgradeRule): MemoryCandidate[] {
    try {
      const stmt = this.db!.prepare(`
        SELECT 
          conversation_id as id,
          content,
          timestamp,
          access_count as accessCount,
          importance_score as importanceScore
        FROM l0_conversations
        WHERE upgraded = 0
        ORDER BY timestamp DESC
        LIMIT 100
      `);
      
      return stmt.all() as unknown as MemoryCandidate[];
    } catch (error) {
      console.error("[SmartMemoryUpgrader] 获取 L0 候选失败:", error);
      return [];
    }
  }
  
  // ============================================================
  // L1 → L2 升级
  // ============================================================
  
  async upgradeL1ToL2(): Promise<number> {
    if (!this.db) await this.initialize();
    if (!this.db) return 0;
    
    const rule = this.config.l1ToL2;
    const candidates = this.getL1Candidates(rule);
    
    let upgraded = 0;
    
    for (const candidate of candidates) {
      try {
        const daysSinceCreation = this.getDaysSince(candidate.timestamp);
        const meetsAccessCount = rule.minAccessCount
          ? candidate.accessCount >= rule.minAccessCount
          : true;
        const meetsTimeRequirement = rule.minDays ? daysSinceCreation >= rule.minDays : true;
        
        if (meetsAccessCount && meetsTimeRequirement) {
          await this.upgradeMemory(candidate, "L1", "L2");
          upgraded++;
        }
      } catch (error) {
        console.error(`[SmartMemoryUpgrader] 升级失败: ${candidate.id}`, error);
      }
    }
    
    // console.log(`[SmartMemoryUpgrader] L1 → L2 升级: ${upgraded} 条`);
    return upgraded;
  }
  
  private getL1Candidates(rule: UpgradeRule): MemoryCandidate[] {
    try {
      const stmt = this.db!.prepare(`
        SELECT 
          record_id as id,
          content,
          created_at as timestamp,
          access_count as accessCount,
          importance_score as importanceScore,
          type,
          scene_name as scene
        FROM l1_records
        WHERE upgraded = 0 OR upgraded IS NULL
        ORDER BY access_count DESC
        LIMIT 100
      `);
      
      return stmt.all() as unknown as MemoryCandidate[];
    } catch (error) {
      console.error("[SmartMemoryUpgrader] 获取 L1 候选失败:", error);
      return [];
    }
  }
  
  // ============================================================
  // L2 → L3 升级
  // ============================================================
  
  async upgradeL2ToL3(): Promise<number> {
    if (!this.db) await this.initialize();
    if (!this.db) return 0;
    
    const rule = this.config.l2ToL3;
    const candidates = this.getL2Candidates(rule);
    
    let upgraded = 0;
    
    for (const candidate of candidates) {
      try {
        const daysSinceCreation = this.getDaysSince(candidate.timestamp);
        const meetsAccessCount = rule.minAccessCount
          ? candidate.accessCount >= rule.minAccessCount
          : true;
        const meetsTimeRequirement = rule.minDays ? daysSinceCreation >= rule.minDays : true;
        
        if (meetsAccessCount && meetsTimeRequirement) {
          await this.upgradeMemory(candidate, "L2", "L3");
          upgraded++;
        }
      } catch (error) {
        console.error(`[SmartMemoryUpgrader] 升级失败: ${candidate.id}`, error);
      }
    }
    
    // console.log(`[SmartMemoryUpgrader] L2 → L3 升级: ${upgraded} 条`);
    return upgraded;
  }
  
  private getL2Candidates(rule: UpgradeRule): MemoryCandidate[] {
    try {
      const stmt = this.db!.prepare(`
        SELECT 
          scene_id as id,
          description as content,
          created_at as timestamp,
          access_count as accessCount,
          0 as importanceScore
        FROM l2_scene_blocks
        WHERE upgraded = 0 OR upgraded IS NULL
        ORDER BY access_count DESC
        LIMIT 50
      `);
      
      return stmt.all() as unknown as MemoryCandidate[];
    } catch (error) {
      console.error("[SmartMemoryUpgrader] 获取 L2 候选失败:", error);
      return [];
    }
  }
  
  // ============================================================
  // 执行升级
  // ============================================================
  
  private async upgradeMemory(
    candidate: MemoryCandidate,
    fromLevel: string,
    toLevel: string
  ): Promise<void> {
    // 标记为已升级
    const tableMap: Record<string, string> = {
      L0: "l0_conversations",
      L1: "l1_records",
      L2: "l2_scene_blocks",
    };
    
    const idColumnMap: Record<string, string> = {
      L0: "conversation_id",
      L1: "record_id",
      L2: "scene_id",
    };
    
    const table = tableMap[fromLevel];
    const idColumn = idColumnMap[fromLevel];
    
    if (table && idColumn) {
      const stmt = this.db!.prepare(`
        UPDATE ${table}
        SET upgraded = 1, updated_at = datetime('now')
        WHERE ${idColumn} = ?
      `);
      
      stmt.run(candidate.id);
    }
    
    // 将内容插入到目标层级
    this.insertToTargetLevel(candidate, toLevel);
  }
  
  private insertToTargetLevel(candidate: MemoryCandidate, toLevel: string): void {
    try {
      if (toLevel === "L1") {
        // 插入到 L1 记录表
        const stmt = this.db!.prepare(`
          INSERT OR IGNORE INTO l1_records 
          (record_id, content, type, scene_name, created_at, updated_at)
          VALUES (?, ?, 'auto_upgraded', 'memory_upgrade', datetime('now'), datetime('now'))
        `);
        stmt.run(`l1_${candidate.id}`, candidate.content);
      } else if (toLevel === "L2") {
        // 插入到 L2 场景块表
        const stmt = this.db!.prepare(`
          INSERT OR IGNORE INTO l2_scene_blocks 
          (scene_id, description, created_at, updated_at)
          VALUES (?, ?, datetime('now'), datetime('now'))
        `);
        stmt.run(`l2_${candidate.id}`, candidate.content);
      } else if (toLevel === "L3") {
        // L3 是用户画像，更新 USER.md
        // 这里只记录，实际画像更新由 PersonaManager 处理
        // console.log(`[SmartMemoryUpgrader] L3 升级: ${candidate.id}`);
      }
    } catch (error) {
      console.error(`[SmartMemoryUpgrader] 插入目标层级失败:`, error);
    }
  }
  
  // ============================================================
  // 执行所有升级
  // ============================================================
  
  async runUpgrade(): Promise<UpgradeResult> {
    try {
      const l0ToL1 = await this.upgradeL0ToL1();
      const l1ToL2 = await this.upgradeL1ToL2();
      const l2ToL3 = await this.upgradeL2ToL3();
      
      const total = l0ToL1 + l1ToL2 + l2ToL3;
      
      return {
        success: true,
        upgraded: total,
        details: {
          l0ToL1,
          l1ToL2,
          l2ToL3,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        upgraded: 0,
        error: error.message,
      };
    }
  }
  
  // ============================================================
  // 工具方法
  // ============================================================
  
  private getDaysSince(timestamp: string): number {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ============================================================
// 导出
// ============================================================

export default SmartMemoryUpgrader;
