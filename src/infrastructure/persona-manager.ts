/**
 * 用户画像管理器
 * 
 * 融合自 llm-memory-integration v5.2.17
 * 
 * 功能：
 * 1. 用户偏好提取
 * 2. 画像自动更新
 * 3. 场景识别
 */

import { StructuredLogger } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface UserPersona {
  id: string;
  name?: string;
  preferences: Preference[];
  scenarios: Scenario[];
  behaviorPatterns: BehaviorPattern[];
  lastUpdated: number;
  version: string;
}

export interface Preference {
  category: string;
  value: string;
  confidence: number;
  source: string;
  timestamp: number;
}

export interface Scenario {
  name: string;
  description: string;
  keywords: string[];
  frequency: number;
  lastUsed: number;
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
}

export interface PersonaUpdateOptions {
  autoUpdate?: boolean;
  requireConfirmation?: boolean;
  backupBeforeUpdate?: boolean;
}

// ============ 用户画像管理器 ============

export class PersonaManager {
  private logger: StructuredLogger;
  private dataDir: string;
  private persona: UserPersona;
  private options: PersonaUpdateOptions;
  
  constructor(
    logger: StructuredLogger,
    dataDir: string = './data/persona',
    options: PersonaUpdateOptions = {}
  ) {
    this.logger = logger;
    this.dataDir = dataDir;
    this.options = {
      autoUpdate: false,
      requireConfirmation: true,
      backupBeforeUpdate: true,
      ...options,
    };
    
    this.ensureDir(dataDir);
    this.persona = this.loadPersona();
  }
  
  /**
   * 提取用户偏好
   */
  extractPreferences(content: string): Preference[] {
    const preferences: Preference[] = [];
    
    // 偏好关键词模式
    const patterns = [
      { pattern: /我喜欢(.{2,10})/g, category: 'preference' },
      { pattern: /我不喜欢(.{2,10})/g, category: 'dislike' },
      { pattern: /我习惯(.{2,10})/g, category: 'habit' },
      { pattern: /我常用(.{2,10})/g, category: 'tool' },
      { pattern: /我的(.{2,10})是/g, category: 'attribute' },
    ];
    
    for (const { pattern, category } of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        preferences.push({
          category,
          value: match[1].trim(),
          confidence: 0.7,
          source: 'conversation',
          timestamp: Date.now(),
        });
      }
    }
    
    return preferences;
  }
  
  /**
   * 提取场景
   */
  extractScenarios(content: string): Scenario[] {
    const scenarios: Scenario[] = [];
    
    // 场景关键词
    const scenarioPatterns = [
      { name: '工作', keywords: ['工作', '项目', '任务', '会议', '报告'] },
      { name: '学习', keywords: ['学习', '课程', '笔记', '考试', '作业'] },
      { name: '生活', keywords: ['生活', '购物', '旅行', '美食', '健康'] },
      { name: '技术', keywords: ['代码', '开发', '调试', '部署', '测试'] },
      { name: '创作', keywords: ['写作', '设计', '创作', '编辑', '发布'] },
    ];
    
    for (const scenario of scenarioPatterns) {
      const matchCount = scenario.keywords.filter(kw => content.includes(kw)).length;
      if (matchCount > 0) {
        scenarios.push({
          name: scenario.name,
          description: `涉及${scenario.name}相关内容`,
          keywords: scenario.keywords.filter(kw => content.includes(kw)),
          frequency: matchCount,
          lastUsed: Date.now(),
        });
      }
    }
    
    return scenarios;
  }
  
  /**
   * 更新用户画像
   */
  async updatePersona(content: string): Promise<UserPersona> {
    // 检查是否启用自动更新
    if (!this.options.autoUpdate) {
      this.logger.warn('PersonaManager', '自动更新已禁用');
      return this.persona;
    }
    
    // 备份
    if (this.options.backupBeforeUpdate) {
      this.backupPersona();
    }
    
    // 提取偏好
    const newPreferences = this.extractPreferences(content);
    
    // 提取场景
    const newScenarios = this.extractScenarios(content);
    
    // 合并偏好
    for (const pref of newPreferences) {
      const existing = this.persona.preferences.find(
        p => p.category === pref.category && p.value === pref.value
      );
      
      if (existing) {
        existing.confidence = Math.min(1, existing.confidence + 0.1);
        existing.timestamp = Date.now();
      } else {
        this.persona.preferences.push(pref);
      }
    }
    
    // 合并场景
    for (const scenario of newScenarios) {
      const existing = this.persona.scenarios.find(s => s.name === scenario.name);
      
      if (existing) {
        existing.frequency += scenario.frequency;
        existing.lastUsed = Date.now();
        existing.keywords = [...new Set([...existing.keywords, ...scenario.keywords])];
      } else {
        this.persona.scenarios.push(scenario);
      }
    }
    
    // 更新时间戳
    this.persona.lastUpdated = Date.now();
    
    // 保存
    this.savePersona();
    
    this.logger.info('PersonaManager', 
      `画像更新: ${newPreferences.length} 偏好, ${newScenarios.length} 场景`
    );
    
    return this.persona;
  }
  
  /**
   * 获取用户画像
   */
  getPersona(): UserPersona {
    return { ...this.persona };
  }
  
  /**
   * 获取偏好
   */
  getPreferences(category?: string): Preference[] {
    if (category) {
      return this.persona.preferences.filter(p => p.category === category);
    }
    return [...this.persona.preferences];
  }
  
  /**
   * 获取场景
   */
  getScenarios(): Scenario[] {
    return [...this.persona.scenarios];
  }
  
  /**
   * 分析行为模式
   */
  analyzeBehaviorPatterns(): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];
    
    // 分析高频偏好
    const topPreferences = this.persona.preferences
      .filter(p => p.confidence > 0.8)
      .slice(0, 5);
    
    for (const pref of topPreferences) {
      patterns.push({
        pattern: `偏好: ${pref.value}`,
        frequency: Math.round(pref.confidence * 10),
        impact: pref.confidence > 0.9 ? 'high' : 'medium',
      });
    }
    
    // 分析高频场景
    const topScenarios = this.persona.scenarios
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);
    
    for (const scenario of topScenarios) {
      patterns.push({
        pattern: `场景: ${scenario.name}`,
        frequency: scenario.frequency,
        impact: scenario.frequency > 5 ? 'high' : 'medium',
      });
    }
    
    return patterns;
  }
  
  // ============ 数据持久化 ============
  
  private loadPersona(): UserPersona {
    const filePath = path.join(this.dataDir, 'persona.json');
    
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.logger.info('PersonaManager', '画像加载成功');
        return data;
      }
    } catch (error) {
      this.logger.warn('PersonaManager', `画像加载失败: ${error}`);
    }
    
    // 返回默认画像
    return {
      id: `persona-${Date.now()}`,
      preferences: [],
      scenarios: [],
      behaviorPatterns: [],
      lastUpdated: Date.now(),
      version: '1.0.0',
    };
  }
  
  private savePersona(): void {
    const filePath = path.join(this.dataDir, 'persona.json');
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.persona, null, 2));
      this.logger.debug('PersonaManager', '画像保存成功');
    } catch (error) {
      this.logger.warn('PersonaManager', `画像保存失败: ${error}`);
    }
  }
  
  private backupPersona(): void {
    const backupDir = path.join(this.dataDir, 'backup');
    this.ensureDir(backupDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `persona-${timestamp}.json`);
    
    try {
      fs.writeFileSync(backupPath, JSON.stringify(this.persona, null, 2));
      this.logger.debug('PersonaManager', `画像备份: ${backupPath}`);
    } catch (error) {
      this.logger.warn('PersonaManager', `画像备份失败: ${error}`);
    }
  }
  
  // ============ 辅助方法 ============
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
