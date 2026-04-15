/**
 * 验收标准推断引擎
 * 
 * 功能：
 * 1. 关键词匹配 - 基于任务描述关键词推断标准
 * 2. 实体识别 - 提取任务中的关键实体
 * 3. 领域知识 - 根据实体匹配领域知识库
 * 4. 动态生成 - 组合生成定制验收标准
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export interface InferredCriteria {
  name: string;
  description: string;
  required: boolean;
  source: 'keyword' | 'entity' | 'domain' | 'template';
  confidence: number;
}

export interface InferenceResult {
  criteria: InferredCriteria[];
  entities: string[];
  domains: string[];
  confidence: number;
  reasoning: string[];
}

export interface DomainKnowledge {
  entities: string[];
  criteria: string[];
  relatedDomains: string[];
}

// ============ 领域知识库 ============

const DOMAIN_KNOWLEDGE: Record<string, DomainKnowledge> = {
  // 认证相关
  '登录': {
    entities: ['用户', '密码', '会话'],
    criteria: [
      '密码加密存储',
      '错误提示清晰',
      '会话管理',
      '记住密码选项',
      '登录失败次数限制',
      '退出登录功能',
    ],
    relatedDomains: ['注册', '权限'],
  },
  '注册': {
    entities: ['用户', '表单', '验证'],
    criteria: [
      '表单验证完整',
      '密码强度检查',
      '邮箱/手机验证',
      '重复账号检测',
      '注册成功提示',
    ],
    relatedDomains: ['登录', '验证'],
  },
  '权限': {
    entities: ['角色', '资源', '操作'],
    criteria: [
      '角色分配功能',
      '权限校验完整',
      '越权访问拦截',
      '权限变更日志',
    ],
    relatedDomains: ['登录', '用户管理'],
  },

  // 支付相关
  '支付': {
    entities: ['订单', '金额', '交易'],
    criteria: [
      '金额校验准确',
      '交易记录完整',
      '支付安全加密',
      '超时自动取消',
      '支付状态同步',
      '退款功能',
    ],
    relatedDomains: ['订单', '通知'],
  },
  '订单': {
    entities: ['商品', '用户', '状态'],
    criteria: [
      '订单状态流转正确',
      '订单号唯一',
      '订单详情完整',
      '订单查询功能',
      '订单取消功能',
    ],
    relatedDomains: ['支付', '库存'],
  },

  // 搜索相关
  '搜索': {
    entities: ['关键词', '结果', '筛选'],
    criteria: [
      '搜索结果准确',
      '结果排序合理',
      '分页显示',
      '空结果提示',
      '搜索历史记录',
      '高级筛选功能',
    ],
    relatedDomains: ['推荐', '分类'],
  },

  // 内容相关
  '文章': {
    entities: ['标题', '内容', '作者'],
    criteria: [
      '标题不为空',
      '内容格式正确',
      '作者信息完整',
      '发布时间记录',
      '编辑功能',
      '删除功能',
    ],
    relatedDomains: ['评论', '分类'],
  },
  '评论': {
    entities: ['用户', '内容', '对象'],
    criteria: [
      '评论内容不为空',
      '评论关联正确',
      '评论时间记录',
      '评论删除功能',
      '敏感词过滤',
    ],
    relatedDomains: ['文章', '用户'],
  },

  // 数据相关
  '报表': {
    entities: ['数据', '图表', '导出'],
    criteria: [
      '数据准确',
      '图表展示清晰',
      '导出功能正常',
      '筛选条件有效',
      '实时更新',
    ],
    relatedDomains: ['统计', '导出'],
  },
  '导入': {
    entities: ['文件', '数据', '格式'],
    criteria: [
      '格式校验完整',
      '错误提示清晰',
      '重复数据处理',
      '导入进度显示',
      '导入结果统计',
    ],
    relatedDomains: ['导出', '数据'],
  },
  '导出': {
    entities: ['数据', '文件', '格式'],
    criteria: [
      '导出格式正确',
      '数据完整',
      '大文件分片',
      '导出进度显示',
    ],
    relatedDomains: ['导入', '报表'],
  },

  // 通知相关
  '通知': {
    entities: ['消息', '用户', '状态'],
    criteria: [
      '消息发送成功',
      '已读/未读状态',
      '通知列表展示',
      '通知删除功能',
      '实时推送',
    ],
    relatedDomains: ['用户', '消息'],
  },
  '邮件': {
    entities: ['收件人', '主题', '内容'],
    criteria: [
      '邮件格式正确',
      '附件支持',
      '发送状态记录',
      '发送失败重试',
    ],
    relatedDomains: ['通知', '模板'],
  },

  // 文件相关
  '上传': {
    entities: ['文件', '类型', '大小'],
    criteria: [
      '文件类型校验',
      '文件大小限制',
      '上传进度显示',
      '重复文件处理',
      '病毒扫描',
    ],
    relatedDomains: ['下载', '存储'],
  },
  '下载': {
    entities: ['文件', '权限', '速度'],
    criteria: [
      '下载权限校验',
      '断点续传',
      '下载速度限制',
      '下载记录',
    ],
    relatedDomains: ['上传', '权限'],
  },

  // API 相关
  'API': {
    entities: ['接口', '参数', '响应'],
    criteria: [
      '接口文档完整',
      '参数校验完整',
      '错误码规范',
      '响应格式统一',
      '接口鉴权',
      '限流保护',
    ],
    relatedDomains: ['文档', '安全'],
  },

  // 性能相关
  '优化': {
    entities: ['性能', '指标', '瓶颈'],
    criteria: [
      '性能指标可测量',
      '优化效果可对比',
      '无副作用',
      '优化方案文档',
    ],
    relatedDomains: ['监控', '测试'],
  },
  '缓存': {
    entities: ['数据', '过期', '更新'],
    criteria: [
      '缓存命中率监控',
      '缓存更新策略',
      '缓存穿透防护',
      '缓存雪崩防护',
    ],
    relatedDomains: ['优化', '数据库'],
  },

  // 开发动作相关
  '代码': {
    entities: ['代码', '逻辑', '结构'],
    criteria: [
      '代码可运行',
      '代码规范',
      '代码有注释',
      '无语法错误',
      '逻辑正确',
    ],
    relatedDomains: ['测试'],
  },
  '调试': {
    entities: ['问题', '错误', '原因'],
    criteria: [
      '问题定位准确',
      '修复方案合理',
      '无副作用',
      '添加测试用例',
      '问题记录文档',
    ],
    relatedDomains: ['测试', '代码'],
  },
};

// 关键词到领域的映射
const KEYWORD_TO_DOMAIN: Record<string, string[]> = {
  // 认证
  '登录': ['登录'],
  '注册': ['注册'],
  '登出': ['登录'],
  '注销': ['登录'],
  '权限': ['权限'],
  '认证': ['登录', '权限'],
  '授权': ['权限'],

  // 支付
  '支付': ['支付'],
  '付款': ['支付'],
  '退款': ['支付'],
  '订单': ['订单'],
  '购买': ['订单', '支付'],

  // 搜索
  '搜索': ['搜索'],
  '查询': ['搜索'],
  '检索': ['搜索'],
  '筛选': ['搜索'],
  '过滤': ['搜索'],

  // 内容
  '文章': ['文章'],
  '帖子': ['文章'],
  '博客': ['文章'],
  '评论': ['评论'],
  '回复': ['评论'],

  // 数据
  '报表': ['报表'],
  '统计': ['报表'],
  '图表': ['报表'],
  '导入': ['导入'],
  '导出': ['导出'],

  // 通知
  '通知': ['通知'],
  '消息': ['通知'],
  '提醒': ['通知'],
  '邮件': ['邮件'],
  '发送': ['通知'],

  // 文件
  '上传': ['上传'],
  '下载': ['下载'],
  '文件': ['上传', '下载'],

  // 技术
  'API': ['API'],
  '接口': ['API'],
  '优化': ['优化'],
  '性能': ['优化'],
  '缓存': ['缓存'],

  // 开发动作
  '写': ['代码'],
  '编写': ['代码'],
  '实现': ['代码'],
  '开发': ['代码'],
  '重构': ['代码'],
  '修改': ['代码'],
  '改': ['代码'],
  '修复': ['调试'],
  '修': ['调试'],
  'bug': ['调试'],
  'Bug': ['调试'],
  '错误': ['调试'],
  '问题': ['调试'],
  '调试': ['调试'],
  'hello world': ['代码'],
  '模块': ['代码'],
  '功能': ['代码'],
  '函数': ['代码'],
  '类': ['代码'],
  '组件': ['代码'],
};

// ============ 推断引擎 ============

export class CriteriaInferenceEngine {
  private logger: StructuredLogger;

  constructor(logger?: StructuredLogger) {
    this.logger = logger || new StructuredLogger();
  }

  /**
   * 推断验收标准（主入口）
   */
  infer(taskDescription: string): InferenceResult {
    const reasoning: string[] = [];
    const allCriteria: InferredCriteria[] = [];
    const allEntities = new Set<string>();
    const allDomains = new Set<string>();

    // 1. 关键词匹配
    const keywordCriteria = this.keywordMatch(taskDescription);
    reasoning.push(`关键词匹配: 找到 ${keywordCriteria.length} 条标准`);
    allCriteria.push(...keywordCriteria);

    // 2. 实体识别
    const { entities, domains } = this.extractEntities(taskDescription);
    reasoning.push(`实体识别: ${entities.join(', ') || '无'}`);
    reasoning.push(`领域识别: ${domains.join(', ') || '无'}`);
    entities.forEach(e => allEntities.add(e));
    domains.forEach(d => allDomains.add(d));

    // 3. 领域知识匹配
    const domainCriteria = this.domainKnowledgeMatch(domains);
    reasoning.push(`领域知识: 找到 ${domainCriteria.length} 条标准`);
    allCriteria.push(...domainCriteria);

    // 4. 去重和排序
    const uniqueCriteria = this.deduplicateAndSort(allCriteria);
    reasoning.push(`去重后: ${uniqueCriteria.length} 条标准`);

    // 5. 计算置信度
    const confidence = this.calculateConfidence(uniqueCriteria, domains);

    this.logger.info('CriteriaInference', `推断完成: ${uniqueCriteria.length} 条标准, 置信度: ${(confidence * 100).toFixed(1)}%`);

    return {
      criteria: uniqueCriteria,
      entities: Array.from(allEntities),
      domains: Array.from(allDomains),
      confidence,
      reasoning,
    };
  }

  /**
   * 关键词匹配
   */
  private keywordMatch(taskDescription: string): InferredCriteria[] {
    const criteria: InferredCriteria[] = [];
    const lowerDesc = taskDescription.toLowerCase();

    // 代码相关
    if (lowerDesc.includes('代码') || lowerDesc.includes('code') || lowerDesc.includes('实现')) {
      criteria.push({
        name: '代码可运行',
        description: '代码能够成功执行，无语法错误',
        required: true,
        source: 'keyword',
        confidence: 0.9,
      });
      criteria.push({
        name: '代码规范',
        description: '代码符合编码规范，有适当注释',
        required: false,
        source: 'keyword',
        confidence: 0.8,
      });
    }

    // 解释相关
    if (lowerDesc.includes('解释') || lowerDesc.includes('explain') || lowerDesc.includes('说明')) {
      criteria.push({
        name: '解释清晰',
        description: '解释内容清晰易懂',
        required: true,
        source: 'keyword',
        confidence: 0.9,
      });
      criteria.push({
        name: '覆盖关键点',
        description: '解释覆盖所有关键概念',
        required: true,
        source: 'keyword',
        confidence: 0.85,
      });
    }

    // 优化相关
    if (lowerDesc.includes('优化') || lowerDesc.includes('optimize') || lowerDesc.includes('改进')) {
      criteria.push({
        name: '效果可测量',
        description: '优化效果可以通过指标量化',
        required: true,
        source: 'keyword',
        confidence: 0.85,
      });
      criteria.push({
        name: '权衡说明',
        description: '说明优化的权衡和副作用',
        required: false,
        source: 'keyword',
        confidence: 0.75,
      });
    }

    // 测试相关
    if (lowerDesc.includes('测试') || lowerDesc.includes('test')) {
      criteria.push({
        name: '测试覆盖',
        description: '测试用例覆盖主要场景',
        required: true,
        source: 'keyword',
        confidence: 0.9,
      });
      criteria.push({
        name: '测试通过',
        description: '所有测试用例通过',
        required: true,
        source: 'keyword',
        confidence: 0.95,
      });
    }

    // 文档相关
    if (lowerDesc.includes('文档') || lowerDesc.includes('document') || lowerDesc.includes('readme')) {
      criteria.push({
        name: '格式正确',
        description: '文档格式符合规范',
        required: true,
        source: 'keyword',
        confidence: 0.85,
      });
      criteria.push({
        name: '内容完整',
        description: '文档包含所有必要信息',
        required: true,
        source: 'keyword',
        confidence: 0.9,
      });
    }

    return criteria;
  }

  /**
   * 实体识别
   */
  private extractEntities(taskDescription: string): { entities: string[]; domains: string[] } {
    const entities: string[] = [];
    const domains = new Set<string>();

    // 遍历关键词映射
    for (const [keyword, matchedDomains] of Object.entries(KEYWORD_TO_DOMAIN)) {
      if (taskDescription.includes(keyword)) {
        entities.push(keyword);
        matchedDomains.forEach(d => domains.add(d));
      }
    }

    return { entities, domains: Array.from(domains) };
  }

  /**
   * 领域知识匹配
   */
  private domainKnowledgeMatch(domains: string[]): InferredCriteria[] {
    const criteria: InferredCriteria[] = [];
    const processedDomains = new Set<string>();

    const processDomain = (domain: string, depth: number = 0) => {
      if (processedDomains.has(domain) || depth > 1) return;
      processedDomains.add(domain);

      const knowledge = DOMAIN_KNOWLEDGE[domain];
      if (!knowledge) return;

      // 添加领域标准
      for (const criterion of knowledge.criteria) {
        criteria.push({
          name: criterion,
          description: `${domain}相关: ${criterion}`,
          required: true,
          source: 'domain',
          confidence: 0.8 - depth * 0.1, // 关联领域置信度降低
        });
      }

      // 处理关联领域
      for (const related of knowledge.relatedDomains) {
        processDomain(related, depth + 1);
      }
    };

    for (const domain of domains) {
      processDomain(domain);
    }

    return criteria;
  }

  /**
   * 去重和排序
   */
  private deduplicateAndSort(criteria: InferredCriteria[]): InferredCriteria[] {
    const uniqueMap = new Map<string, InferredCriteria>();

    for (const c of criteria) {
      const existing = uniqueMap.get(c.name);
      if (!existing || c.confidence > existing.confidence) {
        uniqueMap.set(c.name, c);
      }
    }

    // 按置信度排序，required 优先
    return Array.from(uniqueMap.values()).sort((a, b) => {
      if (a.required !== b.required) {
        return a.required ? -1 : 1;
      }
      return b.confidence - a.confidence;
    });
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(criteria: InferredCriteria[], domains: string[]): number {
    if (criteria.length === 0) return 0.3; // 无标准，低置信度

    // 基于标准数量和来源计算
    const avgConfidence = criteria.reduce((sum, c) => sum + c.confidence, 0) / criteria.length;
    const domainBonus = domains.length > 0 ? 0.1 : 0;
    const countBonus = Math.min(criteria.length * 0.02, 0.1); // 最多 +0.1

    return Math.min(avgConfidence + domainBonus + countBonus, 1.0);
  }

  /**
   * 获取可用的领域列表
   */
  static getAvailableDomains(): string[] {
    return Object.keys(DOMAIN_KNOWLEDGE);
  }

  /**
   * 获取领域知识
   */
  static getDomainKnowledge(domain: string): DomainKnowledge | undefined {
    return DOMAIN_KNOWLEDGE[domain];
  }

  /**
   * 添加自定义领域知识
   */
  static addDomainKnowledge(domain: string, knowledge: DomainKnowledge): void {
    DOMAIN_KNOWLEDGE[domain] = knowledge;
  }
}

// ============ 便捷函数 ============

/**
 * 快速推断验收标准
 */
export function inferCriteria(taskDescription: string): InferredCriteria[] {
  const engine = new CriteriaInferenceEngine();
  const result = engine.infer(taskDescription);
  return result.criteria;
}

/**
 * 推断并生成 Sprint Contract
 */
export function inferAndCreateContract(
  taskDescription: string,
  sprintContractManager: any
): any {
  const engine = new CriteriaInferenceEngine();
  const result = engine.infer(taskDescription);

  const criteria = result.criteria.map(c => ({
    name: c.name,
    description: c.description,
    required: c.required,
  }));

  return sprintContractManager.create(taskDescription, criteria);
}

/**
 * 推断验收标准并格式化为 Markdown 表格
 */
export function inferCriteriaAsTable(taskDescription: string): string {
  const engine = new CriteriaInferenceEngine();
  const result = engine.infer(taskDescription);

  if (result.criteria.length === 0) {
    return `**任务**: ${taskDescription}\n\n⚠️ 无法推断验收标准，请手动定义。`;
  }

  const lines: string[] = [];
  lines.push(`**任务**: ${taskDescription}`);
  lines.push('');
  lines.push(`**置信度**: ${(result.confidence * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('| 序号 | 验收标准 | 必填 | 来源 |');
  lines.push('|------|----------|------|------|');

  result.criteria.forEach((c, i) => {
    const required = c.required ? '✅' : '⚠️';
    const source = {
      keyword: '关键词',
      entity: '实体',
      domain: '领域',
      template: '模板',
    }[c.source] || c.source;
    lines.push(`| ${i + 1} | ${c.name} | ${required} | ${source} |`);
  });

  return lines.join('\n');
}

/**
 * 推断验收标准并返回结构化数据（用于表格展示）
 */
export function inferCriteriaForTable(taskDescription: string): {
  task: string;
  entities: string[];
  domains: string[];
  confidence: number;
  criteria: Array<{
    index: number;
    name: string;
    description: string;
    required: boolean;
    source: string;
  }>;
  markdown: string;
} {
  const engine = new CriteriaInferenceEngine();
  const result = engine.infer(taskDescription);

  return {
    task: taskDescription,
    entities: result.entities,
    domains: result.domains,
    confidence: result.confidence,
    criteria: result.criteria.map((c, i) => ({
      index: i + 1,
      name: c.name,
      description: c.description,
      required: c.required,
      source: c.source,
    })),
    markdown: inferCriteriaAsTable(taskDescription),
  };
}
