/**
 * 智能标签系统
 * 
 * 自动标签、合并、清理
 * 融合自 yaoyao-memory-v2
 */

import { StructuredLogger } from './index';
import { Memory } from './memory-store';

// ============ 类型定义 ============

export interface TagRule {
  name: string;
  patterns: string[];
  priority: number;
  autoApply: boolean;
}

export interface TagStats {
  name: string;
  count: number;
  avgImportance: number;
  lastUsed: number;
}

export interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: string;
}

// ============ 预定义标签规则 ============

const DEFAULT_TAG_RULES: TagRule[] = [
  // 主题标签
  { name: '技术', patterns: ['代码', '编程', '开发', 'API', '框架', '系统'], priority: 8, autoApply: true },
  { name: '工作', patterns: ['项目', '任务', '会议', '报告', '计划'], priority: 7, autoApply: true },
  { name: '学习', patterns: ['学习', '教程', '课程', '知识', '理解'], priority: 7, autoApply: true },
  { name: '生活', patterns: ['生活', '日常', '习惯', '健康', '运动'], priority: 6, autoApply: true },
  
  // 重要性标签
  { name: '重要', patterns: ['重要', '关键', '必须', '紧急', '优先'], priority: 10, autoApply: true },
  { name: '待办', patterns: ['待办', 'TODO', '需要', '计划'], priority: 9, autoApply: true },
  
  // 情感标签
  { name: '积极', patterns: ['成功', '完成', '满意', '开心', '喜欢'], priority: 5, autoApply: true },
  { name: '消极', patterns: ['失败', '问题', '错误', '不满', '讨厌'], priority: 5, autoApply: true },
  
  // 类型标签
  { name: '问答', patterns: ['?', '？', '如何', '为什么', '什么'], priority: 4, autoApply: true },
  { name: '决策', patterns: ['决定', '选择', '方案', '结论'], priority: 6, autoApply: true },
];

// ============ 智能标签系统类 ============

export class SmartTagger {
  private logger: StructuredLogger;
  private tagRules: TagRule[];
  private tagStats: Map<string, TagStats>;

  constructor(logger: StructuredLogger, customRules?: TagRule[]) {
    this.logger = logger;
    this.tagRules = customRules || DEFAULT_TAG_RULES;
    this.tagStats = new Map();
  }

  // ============ 自动标签 ============

  autoTag(content: string): string[] {
    const tags: Set<string> = new Set();
    const lowerContent = content.toLowerCase();

    // 应用标签规则
    for (const rule of this.tagRules) {
      if (!rule.autoApply) continue;

      for (const pattern of rule.patterns) {
        if (lowerContent.includes(pattern.toLowerCase())) {
          tags.add(rule.name);
          break;
        }
      }
    }

    // 更新统计
    for (const tag of tags) {
      this.updateTagStats(tag, 0.5);
    }

    return Array.from(tags);
  }

  // ============ 标签建议 ============

  suggestTags(content: string, existingTags: string[] = []): TagSuggestion[] {
    const suggestions: TagSuggestion[] = [];
    const lowerContent = content.toLowerCase();

    for (const rule of this.tagRules) {
      if (existingTags.includes(rule.name)) continue;

      let matchCount = 0;
      for (const pattern of rule.patterns) {
        if (lowerContent.includes(pattern.toLowerCase())) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const confidence = Math.min(1, matchCount / rule.patterns.length);
        suggestions.push({
          tag: rule.name,
          confidence,
          reason: `匹配 ${matchCount} 个模式`
        });
      }
    }

    // 按置信度排序
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  // ============ 标签合并 ============

  mergeTags(tags1: string[], tags2: string[]): string[] {
    const merged = new Set([...tags1, ...tags2]);
    
    // 合并相似标签
    const similarPairs: [string, string][] = [
      ['技术', '编程'],
      ['工作', '任务'],
      ['重要', '紧急'],
    ];

    for (const [tag1, tag2] of similarPairs) {
      if (merged.has(tag1) && merged.has(tag2)) {
        // 保留优先级更高的标签
        const rule1 = this.tagRules.find(r => r.name === tag1);
        const rule2 = this.tagRules.find(r => r.name === tag2);
        
        if (rule1 && rule2) {
          if (rule1.priority >= rule2.priority) {
            merged.delete(tag2);
          } else {
            merged.delete(tag1);
          }
        }
      }
    }

    return Array.from(merged);
  }

  // ============ 标签清理 ============

  cleanTags(tags: string[]): string[] {
    const cleaned: string[] = [];
    const seen = new Set<string>();

    for (const tag of tags) {
      // 标准化标签
      const normalized = this.normalizeTag(tag);
      
      // 去重
      if (seen.has(normalized)) continue;
      
      // 过滤无效标签
      if (this.isValidTag(normalized)) {
        cleaned.push(normalized);
        seen.add(normalized);
      }
    }

    return cleaned;
  }

  private normalizeTag(tag: string): string {
    // 去除空格和特殊字符
    return tag
      .trim()
      .replace(/[\\s\\-_:]/g, '')
      .toLowerCase();
  }

  private isValidTag(tag: string): boolean {
    // 检查标签有效性
    if (tag.length < 1 || tag.length > 20) return false;
    if (/^\\d+$/.test(tag)) return false; // 纯数字
    return true;
  }

  // ============ 批量操作 ============

  tagMemories(memories: Memory[]): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const memory of memories) {
      const newTags = this.autoTag(memory.content);
      const mergedTags = this.mergeTags(memory.tags, newTags);
      const cleanedTags = this.cleanTags(mergedTags);
      
      result.set(memory.id, cleanedTags);
    }

    this.logger.info('SmartTagger', `批量标签完成: ${memories.length} 条记忆`);
    return result;
  }

  // ============ 统计分析 ============

  getTagStats(): TagStats[] {
    return Array.from(this.tagStats.values())
      .sort((a, b) => b.count - a.count);
  }

  getPopularTags(limit: number = 10): string[] {
    return this.getTagStats()
      .slice(0, limit)
      .map(s => s.name);
  }

  private updateTagStats(tag: string, importance: number): void {
    const existing = this.tagStats.get(tag);
    
    if (existing) {
      existing.count++;
      existing.avgImportance = (existing.avgImportance + importance) / 2;
      existing.lastUsed = Date.now();
    } else {
      this.tagStats.set(tag, {
        name: tag,
        count: 1,
        avgImportance: importance,
        lastUsed: Date.now()
      });
    }
  }

  // ============ 规则管理 ============

  addRule(rule: TagRule): void {
    this.tagRules.push(rule);
    this.tagRules.sort((a, b) => b.priority - a.priority);
    this.logger.info('SmartTagger', `添加标签规则: ${rule.name}`);
  }

  removeRule(name: string): boolean {
    const index = this.tagRules.findIndex(r => r.name === name);
    if (index !== -1) {
      this.tagRules.splice(index, 1);
      this.logger.info('SmartTagger', `移除标签规则: ${name}`);
      return true;
    }
    return false;
  }

  getRules(): TagRule[] {
    return [...this.tagRules];
  }

  // ============ 导入导出 ============

  exportStats(): Record<string, TagStats> {
    const result: Record<string, TagStats> = {};
    for (const [name, stats] of this.tagStats) {
      result[name] = stats;
    }
    return result;
  }

  importStats(stats: Record<string, TagStats>): void {
    for (const [name, stat] of Object.entries(stats)) {
      this.tagStats.set(name, stat);
    }
    this.logger.info('SmartTagger', `导入标签统计: ${Object.keys(stats).length} 个`);
  }
}
