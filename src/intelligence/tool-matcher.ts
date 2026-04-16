/**
 * 工具匹配器
 * 
 * 核心能力：根据意图自动选择合适的工具
 * - 工具能力描述
 * - 工具匹配算法
 * - 工具优先级排序
 */

import { Intent, IntentType } from './intent-engine';

// ============ 类型定义 ============

export interface Tool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 支持的意图类型 */
  supportedIntents: IntentType[];
  /** 工具能力标签 */
  capabilities: string[];
  /** 优先级 (0-100) */
  priority: number;
  /** 是否需要参数 */
  requiresParams: boolean;
  /** 参数模板 */
  paramTemplate?: Record<string, any>;
}

export interface ToolMatchResult {
  /** 匹配的工具 */
  tool: Tool;
  /** 匹配分数 (0-1) */
  score: number;
  /** 匹配原因 */
  reason: string;
}

// ============ 工具库 ============

const TOOL_REGISTRY: Tool[] = [
  // 文件操作
  {
    name: 'read',
    description: '读取文件内容',
    supportedIntents: ['read', 'query', 'analyze', 'learn'],
    capabilities: ['file', 'text', 'image'],
    priority: 80,
    requiresParams: true,
    paramTemplate: { path: '' },
  },
  {
    name: 'write',
    description: '写入文件内容',
    supportedIntents: ['create', 'update'],
    capabilities: ['file', 'text'],
    priority: 80,
    requiresParams: true,
    paramTemplate: { path: '', content: '' },
  },
  {
    name: 'edit',
    description: '编辑文件内容',
    supportedIntents: ['update'],
    capabilities: ['file', 'text'],
    priority: 85,
    requiresParams: true,
    paramTemplate: { path: '', oldText: '', newText: '' },
  },
  
  // 执行操作
  {
    name: 'exec',
    description: '执行系统命令',
    supportedIntents: ['execute', 'deploy', 'delete', 'optimize'],
    capabilities: ['shell', 'command', 'process'],
    priority: 70,
    requiresParams: true,
    paramTemplate: { command: '' },
  },
  
  // 网络操作
  {
    name: 'web_fetch',
    description: '获取网页内容',
    supportedIntents: ['read', 'search', 'learn'],
    capabilities: ['web', 'http', 'html'],
    priority: 75,
    requiresParams: true,
    paramTemplate: { url: '' },
  },
  {
    name: 'browser',
    description: '浏览器自动化',
    supportedIntents: ['search', 'execute', 'deploy'],
    capabilities: ['browser', 'automation', 'web'],
    priority: 60,
    requiresParams: true,
  },
  
  // 消息操作
  {
    name: 'message',
    description: '发送消息',
    supportedIntents: ['communicate'],
    capabilities: ['message', 'notification', 'channel'],
    priority: 90,
    requiresParams: true,
    paramTemplate: { action: 'send', message: '' },
  },
  {
    name: 'send_message',
    description: '发送短信',
    supportedIntents: ['communicate', 'remind'],
    capabilities: ['sms', 'phone', 'notification'],
    priority: 85,
    requiresParams: true,
    paramTemplate: { phoneNumber: '', content: '' },
  },
  {
    name: 'call_phone',
    description: '拨打电话',
    supportedIntents: ['communicate'],
    capabilities: ['phone', 'call'],
    priority: 80,
    requiresParams: true,
    paramTemplate: { phoneNumber: '' },
  },
  
  // 日程操作
  {
    name: 'create_calendar_event',
    description: '创建日程',
    supportedIntents: ['schedule'],
    capabilities: ['calendar', 'event', 'schedule'],
    priority: 90,
    requiresParams: true,
    paramTemplate: { title: '', dtStart: '', dtEnd: '' },
  },
  {
    name: 'search_calendar_event',
    description: '搜索日程',
    supportedIntents: ['schedule', 'query'],
    capabilities: ['calendar', 'search', 'event'],
    priority: 85,
    requiresParams: true,
    paramTemplate: { startTime: '', endTime: '' },
  },
  
  // 提醒操作
  {
    name: 'create_alarm',
    description: '创建闹钟',
    supportedIntents: ['remind', 'schedule'],
    capabilities: ['alarm', 'reminder', 'notification'],
    priority: 90,
    requiresParams: true,
    paramTemplate: { alarmTime: '' },
  },
  {
    name: 'create_note',
    description: '创建备忘录',
    supportedIntents: ['remind', 'create'],
    capabilities: ['note', 'memo', 'reminder'],
    priority: 85,
    requiresParams: true,
    paramTemplate: { title: '', content: '' },
  },
  
  // 搜索操作
  {
    name: 'xiaoyi-web-search',
    description: '小艺联网搜索',
    supportedIntents: ['search', 'query', 'learn'],
    capabilities: ['search', 'web', 'information'],
    priority: 95,
    requiresParams: true,
    paramTemplate: { query: '' },
  },
  
  // 图像操作
  {
    name: 'image_reading',
    description: '图像理解',
    supportedIntents: ['analyze', 'read'],
    capabilities: ['image', 'vision', 'understanding'],
    priority: 90,
    requiresParams: true,
    paramTemplate: { localUrl: '', prompt: '' },
  },
  {
    name: 'search_photo_gallery',
    description: '搜索手机图库',
    supportedIntents: ['search', 'query'],
    capabilities: ['image', 'gallery', 'search'],
    priority: 85,
    requiresParams: true,
    paramTemplate: { query: '' },
  },
  
  // 联系人操作
  {
    name: 'search_contact',
    description: '搜索联系人',
    supportedIntents: ['search', 'query', 'communicate'],
    capabilities: ['contact', 'search', 'phone'],
    priority: 85,
    requiresParams: true,
    paramTemplate: { name: '' },
  },
  
  // 文件操作
  {
    name: 'search_file',
    description: '搜索文件',
    supportedIntents: ['search', 'query'],
    capabilities: ['file', 'search', 'filesystem'],
    priority: 80,
    requiresParams: true,
    paramTemplate: { query: '' },
  },
  {
    name: 'upload_file',
    description: '上传文件',
    supportedIntents: ['communicate', 'deploy'],
    capabilities: ['file', 'upload', 'share'],
    priority: 75,
    requiresParams: true,
    paramTemplate: { fileInfos: [] },
  },
  
  // 位置操作
  {
    name: 'get_user_location',
    description: '获取用户位置',
    supportedIntents: ['query', 'schedule'],
    capabilities: ['location', 'gps', 'position'],
    priority: 80,
    requiresParams: false,
  },
];

// ============ 工具匹配器 ============

export class ToolMatcher {
  private customTools: Map<string, Tool> = new Map();
  
  /**
   * 根据意图匹配工具
   */
  match(intent: Intent): ToolMatchResult[] {
    const results: ToolMatchResult[] = [];
    
    // 合并内置工具和自定义工具
    const allTools = [...TOOL_REGISTRY, ...Array.from(this.customTools.values())];
    
    for (const tool of allTools) {
      const matchResult = this.matchTool(intent, tool);
      if (matchResult) {
        results.push(matchResult);
      }
    }
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }
  
  /**
   * 匹配单个工具
   */
  private matchTool(intent: Intent, tool: Tool): ToolMatchResult | null {
    // 检查意图类型是否匹配
    if (!tool.supportedIntents.includes(intent.type)) {
      return null;
    }
    
    // 计算匹配分数
    let score = 0;
    const reasons: string[] = [];
    
    // 意图类型匹配 (基础分)
    score += 0.5;
    reasons.push(`意图类型匹配: ${intent.type}`);
    
    // 优先级加成
    score += (tool.priority / 100) * 0.3;
    reasons.push(`工具优先级: ${tool.priority}`);
    
    // 置信度加成
    score += intent.confidence * 0.2;
    reasons.push(`意图置信度: ${intent.confidence.toFixed(2)}`);
    
    return {
      tool,
      score: Math.min(score, 1),
      reason: reasons.join('; '),
    };
  }
  
  /**
   * 获取最佳匹配工具
   */
  getBestMatch(intent: Intent): ToolMatchResult | null {
    const results = this.match(intent);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * 获取所有可用工具
   */
  getAvailableTools(): Tool[] {
    return [...TOOL_REGISTRY, ...Array.from(this.customTools.values())];
  }
  
  /**
   * 注册自定义工具
   */
  registerTool(tool: Tool): void {
    this.customTools.set(tool.name, tool);
  }
  
  /**
   * 注销工具
   */
  unregisterTool(name: string): boolean {
    return this.customTools.delete(name);
  }
}

// ============ 工厂函数 ============

export function createToolMatcher(): ToolMatcher {
  return new ToolMatcher();
}
