/**
 * Skill 发现器
 * 
 * 核心能力：自动发现和匹配 Skill
 * - Skill 能力描述
 * - Skill 匹配算法
 * - Skill 优先级排序
 */

import { Intent, IntentType } from './intent-engine';

// ============ 类型定义 ============

export interface Skill {
  /** Skill 名称 */
  name: string;
  /** Skill 描述 */
  description: string;
  /** 支持的意图类型 */
  supportedIntents: IntentType[];
  /** Skill 能力标签 */
  capabilities: string[];
  /** 优先级 (0-100) */
  priority: number;
  /** Skill 路径 */
  path: string;
}

export interface SkillMatchResult {
  /** 匹配的 Skill */
  skill: Skill;
  /** 匹配分数 (0-1) */
  score: number;
  /** 匹配原因 */
  reason: string;
}

// ============ Skill 库 ============

const SKILL_REGISTRY: Skill[] = [
  // 搜索类
  {
    name: 'xiaoyi-web-search',
    description: '小艺联网搜索',
    supportedIntents: ['search', 'query', 'learn'],
    capabilities: ['search', 'web', 'information', 'chinese'],
    priority: 95,
    path: '~/.openclaw/workspace/skills/xiaoyi-web-search/SKILL.md',
  },
  {
    name: 'deep-search-and-insight-synthesize',
    description: '深度搜索与洞察综合',
    supportedIntents: ['search', 'analyze', 'learn'],
    capabilities: ['search', 'deep', 'insight', 'synthesize'],
    priority: 85,
    path: '~/.openclaw/workspace/skills/deep-search-and-insight-synthesize/SKILL.md',
  },
  {
    name: 'multi-search-engine',
    description: '多搜索引擎',
    supportedIntents: ['search', 'query'],
    capabilities: ['search', 'multi', 'engine'],
    priority: 80,
    path: '~/.openclaw/workspace/skills/multi-search-engine/SKILL.md',
  },
  
  // 内容创作类
  {
    name: 'article-writer',
    description: '文章写作',
    supportedIntents: ['create'],
    capabilities: ['writing', 'article', 'content'],
    priority: 90,
    path: '~/.openclaw/workspace/skills/article-writer/SKILL.md',
  },
  {
    name: 'copywriter',
    description: '文案写作',
    supportedIntents: ['create'],
    capabilities: ['writing', 'copy', 'marketing'],
    priority: 85,
    path: '~/.openclaw/workspace/skills/copywriter/SKILL.md',
  },
  {
    name: 'pptx',
    description: 'PPT 制作',
    supportedIntents: ['create'],
    capabilities: ['presentation', 'ppt', 'slides'],
    priority: 90,
    path: '~/.openclaw/workspace/skills/anthropics-skills-pptx/SKILL.md',
  },
  {
    name: 'docx',
    description: 'Word 文档制作',
    supportedIntents: ['create', 'update'],
    capabilities: ['document', 'word', 'docx'],
    priority: 85,
    path: '~/.openclaw/workspace/skills/docx/SKILL.md',
  },
  
  // 分析类
  {
    name: 'Excel Analysis',
    description: 'Excel 数据分析',
    supportedIntents: ['analyze', 'query'],
    capabilities: ['excel', 'data', 'analysis'],
    priority: 90,
    path: '~/.openclaw/workspace/skills/excel-analysis/SKILL.md',
  },
  {
    name: 'deep-research',
    description: '深度研究',
    supportedIntents: ['analyze', 'learn', 'search'],
    capabilities: ['research', 'deep', 'analysis'],
    priority: 85,
    path: '~/.openclaw/workspace/skills/feiskyer-claude-code-settings-deep-research/SKILL.md',
  },
  
  // 学习类
  {
    name: 'read-arxiv-paper',
    description: '阅读 ArXiv 论文',
    supportedIntents: ['learn', 'read', 'analyze'],
    capabilities: ['arxiv', 'paper', 'research', 'academic'],
    priority: 90,
    path: '~/.openclaw/workspace/skills/read-arxiv-paper/SKILL.md',
  },
  
  // 部署类
  {
    name: 'vercel-deploy',
    description: 'Vercel 部署',
    supportedIntents: ['deploy'],
    capabilities: ['deploy', 'vercel', 'hosting'],
    priority: 95,
    path: '~/.openclaw/workspace/skills/bytedance-deer-flow-vercel-deploy-claimable/SKILL.md',
  },
  
  // 优化类
  {
    name: 'self-improvement',
    description: '自我改进',
    supportedIntents: ['optimize', 'introspect'],
    capabilities: ['improvement', 'optimization', 'self'],
    priority: 85,
    path: '~/.openclaw/workspace/skills/self-improving-agent/SKILL.md',
  },
  
  // 检查类
  {
    name: 'healthcheck',
    description: '健康检查',
    supportedIntents: ['introspect', 'monitor'],
    capabilities: ['health', 'check', 'monitor'],
    priority: 90,
    path: '~/openclaw/node_modules/openclaw/skills/healthcheck/SKILL.md',
  },
  
  // 文档类
  {
    name: 'markitdown',
    description: 'Markdown 转换',
    supportedIntents: ['read', 'create', 'update'],
    capabilities: ['markdown', 'convert', 'document'],
    priority: 80,
    path: '~/.openclaw/workspace/skills/markitdown/SKILL.md',
  },
  {
    name: 'web-content-fetcher',
    description: '网页内容获取',
    supportedIntents: ['read', 'search'],
    capabilities: ['web', 'fetch', 'content'],
    priority: 75,
    path: '~/.openclaw/workspace/skills/web-content-fetcher/SKILL.md',
  },
  
  // 图像类
  {
    name: 'xiaoyi-image-understanding',
    description: '小艺图像理解',
    supportedIntents: ['analyze', 'read'],
    capabilities: ['image', 'vision', 'understanding', 'chinese'],
    priority: 95,
    path: '~/.openclaw/workspace/skills/xiaoyi-image-understanding/SKILL.md',
  },
  
  // 视频类
  {
    name: 'remotion-video-toolkit',
    description: '视频制作工具',
    supportedIntents: ['create'],
    capabilities: ['video', 'remotion', 'production'],
    priority: 85,
    path: '~/.openclaw/workspace/skills/remotion-video-toolkit/SKILL.md',
  },
  
  // 设计类
  {
    name: 'canvas-design',
    description: 'Canvas 设计',
    supportedIntents: ['create'],
    capabilities: ['design', 'canvas', 'ui'],
    priority: 80,
    path: '~/.openclaw/workspace/skills/canvas-design/SKILL.md',
  },
  
  // 查找类
  {
    name: 'find-skills',
    description: '查找 Skills',
    supportedIntents: ['search', 'learn'],
    capabilities: ['find', 'discover', 'skills'],
    priority: 90,
    path: '~/.openclaw/workspace/skills/find-skills/SKILL.md',
  },
];

// ============ Skill 发现器 ============

export class SkillDiscovery {
  private customSkills: Map<string, Skill> = new Map();
  
  /**
   * 根据意图发现 Skill
   */
  discover(intent: Intent): SkillMatchResult[] {
    const results: SkillMatchResult[] = [];
    
    // 合并内置 Skill 和自定义 Skill
    const allSkills = [...SKILL_REGISTRY, ...Array.from(this.customSkills.values())];
    
    for (const skill of allSkills) {
      const matchResult = this.matchSkill(intent, skill);
      if (matchResult) {
        results.push(matchResult);
      }
    }
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }
  
  /**
   * 匹配单个 Skill
   */
  private matchSkill(intent: Intent, skill: Skill): SkillMatchResult | null {
    // 检查意图类型是否匹配
    if (!skill.supportedIntents.includes(intent.type)) {
      return null;
    }
    
    // 计算匹配分数
    let score = 0;
    const reasons: string[] = [];
    
    // 意图类型匹配 (基础分)
    score += 0.5;
    reasons.push(`意图类型匹配: ${intent.type}`);
    
    // 优先级加成
    score += (skill.priority / 100) * 0.3;
    reasons.push(`Skill 优先级: ${skill.priority}`);
    
    // 置信度加成
    score += intent.confidence * 0.2;
    reasons.push(`意图置信度: ${intent.confidence.toFixed(2)}`);
    
    return {
      skill,
      score: Math.min(score, 1),
      reason: reasons.join('; '),
    };
  }
  
  /**
   * 获取最佳匹配 Skill
   */
  getBestMatch(intent: Intent): SkillMatchResult | null {
    const results = this.discover(intent);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 获取所有可用 Skill
   */
  getAvailableSkills(): Skill[] {
    return [...SKILL_REGISTRY, ...Array.from(this.customSkills.values())];
  }
  
  /**
   * 注册自定义 Skill
   */
  registerSkill(skill: Skill): void {
    this.customSkills.set(skill.name, skill);
  }
  
  /**
   * 注销 Skill
   */
  unregisterSkill(name: string): boolean {
    return this.customSkills.delete(name);
  }
  
  /**
   * 按能力搜索 Skill
   */
  searchByCapability(capability: string): Skill[] {
    const allSkills = this.getAvailableSkills();
    return allSkills.filter(skill => 
      skill.capabilities.some(c => c.toLowerCase().includes(capability.toLowerCase()))
    );
  }
}

// ============ 工厂函数 ============

export function createSkillDiscovery(): SkillDiscovery {
  return new SkillDiscovery();
}
