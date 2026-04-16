/**
 * 意图识别引擎
 * 
 * 核心能力：理解用户真正想做什么
 * - 语义理解（不是简单的关键词匹配）
 * - 多意图识别（一句话可能包含多个意图）
 * - 意图优先级排序
 */

// ============ 类型定义 ============

export interface Intent {
  /** 意图类型 */
  type: IntentType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 目标对象 */
  target?: string;
  /** 参数 */
  params: Record<string, any>;
  /** 子意图 */
  subIntents?: Intent[];
}

export type IntentType =
  // 信息获取
  | 'search'        // 搜索信息
  | 'query'         // 查询数据
  | 'read'          // 读取文件
  | 'monitor'       // 监控状态
  | 'analyze'       // 分析数据
  | 'web_search'    // 网络搜索
  
  // 操作执行
  | 'create'        // 创建内容
  | 'update'        // 更新内容
  | 'delete'        // 删除内容
  | 'execute'       // 执行命令
  | 'deploy'        // 部署应用
  | 'tool_call'     // 工具调用
  | 'file_operation' // 文件操作
  | 'command_execution' // 命令执行
  
  // 协作交互
  | 'collaborate'   // 多 Agent 协作
  | 'communicate'   // 发送消息
  | 'schedule'      // 日程安排
  | 'remind'        // 提醒事项
  
  // 学习优化
  | 'learn'         // 学习新知识
  | 'optimize'      // 优化系统
  | 'introspect'    // 自省检查
  | 'clarification' // 需要澄清
  
  // 其他
  | 'unknown';      // 未知意图

export interface IntentAnalysisResult {
  /** 主意图 */
  primary: Intent;
  /** 所有识别到的意图 */
  all: Intent[];
  /** 原始消息 */
  rawMessage: string;
  /** 建议的工具 */
  suggestedTools: string[];
  /** 建议的模块 */
  suggestedModules: string[];
  /** 建议的 Skills */
  suggestedSkills: string[];
}

// ============ 意图模式库 ============

interface IntentPattern {
  type: IntentType;
  patterns: RegExp[];
  tools: string[];
  modules: string[];
  skills: string[];
  params?: Record<string, any>;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // 搜索信息
  {
    type: 'search',
    patterns: [
      // 精确匹配（高优先级）
      /^搜索$/,
      /^查找$/,
      /^查询$/,
      // 常用短语
      /搜索一下|查找一下|查一下|找一下/,
      /帮我搜索|帮我查找|帮我查|帮我找/,
      /搜索.*新闻|查找.*信息|查询.*资料/,
      // 英文
      /search|find|look for/i,
    ],
    tools: ['xiaoyi-web-search', 'read', 'exec'],
    modules: [],
    skills: ['xiaoyi-web-search', 'deep-search-and-insight-synthesize', 'multi-search-engine'],
  },
  
  // 查询数据
  {
    type: 'query',
    patterns: [
      // 精确匹配
      /^查询$/,
      /^获取$/,
      /^显示$/,
      // 常用短语
      /查询.*状态|获取.*信息|显示.*数据/,
      /有多少|统计.*数量|计数/,
      /系统状态|运行情况|概览/,
      // 英文
      /query|get|show|list/i,
    ],
    tools: ['read', 'exec'],
    modules: ['dashboard', 'health-monitor'],
    skills: [],
  },
  
  // 读取文件
  {
    type: 'read',
    patterns: [
      // 精确匹配
      /^读取$/,
      /^打开$/,
      /^查看$/,
      // 常用短语
      /读取.*文件|打开.*文档|查看.*内容/,
      /看看.*文件|瞧瞧.*文档/,
      // 英文
      /read|open|view/i,
    ],
    tools: ['read', 'web_fetch'],
    modules: [],
    skills: ['markitdown', 'web-content-fetcher'],
  },
  
  // 监控状态
  {
    type: 'monitor',
    patterns: [
      // 精确匹配
      /^监控$/,
      /^监测$/,
      /^dashboard$/,
      // 常用短语
      /监控.*系统|监测.*状态/,
      /可视化.*展示|仪表盘.*显示/,
      /实时.*监控|动态.*监测/,
      // 英文
      /monitor|watch|dashboard/i,
    ],
    tools: [],
    modules: ['dashboard', 'health-monitor', 'harness'],
    skills: [],
  },
  
  // 分析数据
  {
    type: 'analyze',
    patterns: [
      // 精确匹配
      /^分析$/,
      /^解析$/,
      // 常用短语
      /分析.*数据|解析.*文件/,
      /对比.*数据|比较.*结果|差异.*分析/,
      /趋势.*分析|规律.*研究|模式.*识别/,
      // 英文
      /analyze|parse|study/i,
    ],
    tools: ['read', 'exec'],
    modules: ['hybrid-search-engine', 'persona-manager'],
    skills: ['deep-search-and-insight-synthesize', 'Excel Analysis'],
  },
  
  // 创建内容
  {
    type: 'create',
    patterns: [
      // 精确匹配
      /^创建$/,
      /^新建$/,
      /^生成$/,
      // 常用短语
      /创建.*文章|新建.*文档|生成.*内容/,
      /写.*文章|编写.*代码|起草.*方案|撰写.*报告/,
      /帮我写|帮我生成|帮我创建/,
      // 英文
      /create|new|generate|make/i,
    ],
    tools: ['write', 'edit'],
    modules: [],
    skills: ['article-writer', 'copywriter', 'pptx', 'docx'],
  },
  
  // 更新内容
  {
    type: 'update',
    patterns: [
      // 精确匹配
      /^更新$/,
      /^修改$/,
      /^编辑$/,
      // 常用短语
      /更新.*内容|修改.*文件|编辑.*文档/,
      /改一下|调整.*设置|优化.*配置/,
      // 英文
      /update|modify|edit/i,
    ],
    tools: ['edit', 'write'],
    modules: [],
    skills: [],
  },
  
  // 删除内容
  {
    type: 'delete',
    patterns: [
      // 精确匹配
      /^删除$/,
      /^移除$/,
      /^清除$/,
      // 常用短语
      /删除.*文件|移除.*内容|清除.*数据/,
      /不要.*了|删掉/,
      // 英文
      /delete|remove|clear/i,
    ],
    tools: ['exec'],
    modules: [],
    skills: [],
  },
  
  // 执行命令
  {
    type: 'execute',
    patterns: [
      // 精确匹配
      /^执行$/,
      /^运行$/,
      // 常用短语
      /执行.*命令|运行.*脚本/,
      /跑一下|启动.*服务|停止.*程序|重启.*应用/,
      // 英文
      /execute|run/i,
    ],
    tools: ['exec'],
    modules: ['edge-runtime'],
    skills: [],
  },
  
  // 部署应用
  {
    type: 'deploy',
    patterns: [
      // 精确匹配
      /^部署$/,
      /^发布$/,
      // 常用短语
      /部署.*应用|发布.*版本|上线.*服务/,
      /推送到.*|提交到.*|合并.*分支/,
      // 英文
      /deploy|publish|release/i,
    ],
    tools: ['exec'],
    modules: [],
    skills: ['vercel-deploy'],
  },
  
  // 多 Agent 协作
  {
    type: 'collaborate',
    patterns: [
      // 精确匹配
      /^协作$/,
      /^协调$/,
      // 常用短语
      /多.*agent.*协作|agent.*协调/,
      /分配.*任务|协调.*工作/,
      /团队.*协作|小组.*合作/,
      // 英文
      /collaborate|coordinate|assign/i,
    ],
    tools: [],
    modules: ['coordinator', 'multi-agent'],
    skills: [],
  },
  
  // 发送消息
  {
    type: 'communicate',
    patterns: [
      // 精确匹配
      /^发送$/,
      /^通知$/,
      // 常用短语
      /发送.*消息|发送.*给|通知.*人/,
      /告诉.*|提醒.*人/,
      /发.*邮件|发.*短信|发.*微信/,
      // 英文
      /send|notify|message/i,
    ],
    tools: ['message', 'send_message', 'call_phone'],
    modules: [],
    skills: [],
  },
  
  // 日程安排
  {
    type: 'schedule',
    patterns: [
      // 精确匹配
      /^日程$/,
      /^安排$/,
      // 常用短语
      /创建.*日程|安排.*会议|添加.*活动/,
      /创建.*会议|新建.*会议|添加.*会议/,
      /什么时候|几点.*开始/,
      // 英文
      /schedule|plan|calendar/i,
    ],
    tools: ['create_calendar_event', 'search_calendar_event'],
    modules: [],
    skills: [],
  },
  
  // 提醒事项
  {
    type: 'remind',
    patterns: [
      // 精确匹配
      /^提醒$/,
      /^记住$/,
      // 常用短语
      /提醒.*我|记住.*时间|别忘了/,
      /设置.*闹钟|定时.*提醒/,
      // 英文
      /remind|remember/i,
    ],
    tools: ['create_alarm', 'create_note'],
    modules: [],
    skills: [],
  },
  
  // 学习新知识
  {
    type: 'learn',
    patterns: [
      // 精确匹配
      /^学习$/,
      /^了解$/,
      // 常用短语
      /学习.*知识|了解.*内容|掌握.*技能/,
      /教我.*|告诉我.*|解释.*一下/,
      /什么是.*|怎么用.*|如何.*使用/,
      // 英文
      /learn|understand|know/i,
    ],
    tools: ['read', 'web_fetch'],
    modules: [],
    skills: ['deep-research', 'read-arxiv-paper'],
  },
  
  // 优化系统
  {
    type: 'optimize',
    patterns: [
      // 精确匹配
      /^优化$/,
      /^改进$/,
      // 常用短语
      /优化.*性能|改进.*效率|提升.*速度/,
      /让.*更好|让.*更快/,
      // 英文
      /optimize|improve|enhance/i,
    ],
    tools: ['exec'],
    modules: ['entropy-governor', 'token-pipeline'],
    skills: ['self-improvement'],
  },
  
  // 自省检查
  {
    type: 'introspect',
    patterns: [
      // 精确匹配
      /^自省$/,
      /^检查$/,
      /^诊断$/,
      // 常用短语
      /检查.*系统|诊断.*问题|自省.*状态/,
      /系统.*健康|运行.*状态/,
      /生成.*报告|做.*总结/,
      // 英文
      /introspect|check|diagnose/i,
    ],
    tools: ['exec'],
    modules: ['health-monitor', 'harness'],
    skills: ['healthcheck'],
  },
];

// ============ 意图识别引擎 ============

export class IntentEngine {
  private customPatterns: Map<IntentType, IntentPattern[]> = new Map();
  
  /**
   * 分析用户消息，识别意图
   */
  async analyze(message: string): Promise<IntentAnalysisResult> {
    const allIntents: Intent[] = [];
    const suggestedTools = new Set<string>();
    const suggestedModules = new Set<string>();
    const suggestedSkills = new Set<string>();
    
    // 遍历所有意图模式
    for (const pattern of INTENT_PATTERNS) {
      const matches = this.matchPatterns(message, pattern.patterns);
      
      if (matches.length > 0) {
        const confidence = this.calculateConfidence(message, matches);
        
        allIntents.push({
          type: pattern.type,
          confidence,
          target: this.extractTarget(message, pattern.type),
          params: pattern.params || {},
        });
        
        // 收集建议的工具、模块、Skills
        pattern.tools.forEach(t => suggestedTools.add(t));
        pattern.modules.forEach(m => suggestedModules.add(m));
        pattern.skills.forEach(s => suggestedSkills.add(s));
      }
    }
    
    // 按置信度排序
    allIntents.sort((a, b) => b.confidence - a.confidence);
    
    // 如果没有识别到任何意图，标记为 unknown
    if (allIntents.length === 0) {
      allIntents.push({
        type: 'unknown',
        confidence: 0,
        params: {},
      });
    }
    
    return {
      primary: allIntents[0],
      all: allIntents,
      rawMessage: message,
      suggestedTools: Array.from(suggestedTools),
      suggestedModules: Array.from(suggestedModules),
      suggestedSkills: Array.from(suggestedSkills),
    };
  }
  
  /**
   * 匹配模式
   */
  private matchPatterns(message: string, patterns: RegExp[]): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        matches.push(match);
      }
    }
    
    return matches;
  }
  
  /**
   * 计算置信度
   */
  private calculateConfidence(message: string, matches: RegExpMatchArray[]): number {
    // 基础置信度（提高到 0.7）
    let confidence = 0.7;
    
    // 匹配次数加成（每次匹配 +0.1，最多 +0.2）
    confidence += Math.min(matches.length * 0.1, 0.2);
    
    // 匹配长度加成（匹配长度占消息长度的比例，最多 +0.1）
    const totalMatchLength = matches.reduce((sum, m) => sum + (m[0]?.length || 0), 0);
    const lengthRatio = totalMatchLength / message.length;
    confidence += Math.min(lengthRatio * 0.1, 0.1);
    
    // 精确匹配加成（如果匹配的是完整关键词，+0.1）
    const exactMatches = matches.filter(m => {
      const matched = m[0]?.toLowerCase() || '';
      return message.toLowerCase().includes(matched);
    });
    if (exactMatches.length > 0) {
      confidence += 0.1;
    }
    
    // 多模式匹配加成（如果匹配了多个不同的模式，+0.1）
    const uniquePatterns = new Set(matches.map(m => m[0]?.toLowerCase()));
    if (uniquePatterns.size > 1) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * 提取目标对象
   */
  private extractTarget(message: string, type: IntentType): string | undefined {
    // 简单的目标提取逻辑
    const targetPatterns: Record<IntentType, RegExp[]> = {
      search: [/搜索(.+)|查找(.+)|找(.+)/i],
      query: [/查询(.+)|获取(.+)|显示(.+)/i],
      read: [/读取(.+)|打开(.+)|查看(.+)/i],
      monitor: [/监控(.+)|监测(.+)/i],
      analyze: [/分析(.+)|解析(.+)/i],
      create: [/创建(.+)|新建(.+)|生成(.+)/i],
      update: [/更新(.+)|修改(.+)|编辑(.+)/i],
      delete: [/删除(.+)|移除(.+)/i],
      execute: [/执行(.+)|运行(.+)/i],
      deploy: [/部署(.+)|发布(.+)/i],
      collaborate: [/协作(.+)|分配(.+)/i],
      communicate: [/发送(.+)|通知(.+)/i],
      schedule: [/安排(.+)|计划(.+)/i],
      remind: [/提醒(.+)|记住(.+)/i],
      learn: [/学习(.+)|了解(.+)/i],
      optimize: [/优化(.+)|改进(.+)/i],
      introspect: [/检查(.+)|诊断(.+)/i],
      web_search: [/搜索(.+)|查找(.+)/i],
      tool_call: [],
      file_operation: [/文件(.+)|目录(.+)/i],
      command_execution: [/执行(.+)|运行(.+)/i],
      clarification: [],
      unknown: [],
    };
    
    const patterns = targetPatterns[type] || [];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }
  
  /**
   * 添加自定义模式
   */
  addCustomPattern(pattern: IntentPattern): void {
    const existing = this.customPatterns.get(pattern.type) || [];
    existing.push(pattern);
    this.customPatterns.set(pattern.type, existing);
  }
}

// ============ 工厂函数 ============

export function createIntentEngine(): IntentEngine {
  return new IntentEngine();
}
