/**
 * 自然语言解析器
 * 
 * 将自然语言转换为结构化指令
 * 
 * @module nl-programming/parser
 */

import * as crypto from 'crypto';
import {
  ParsedIntent,
  ParsedIntentType,
  RuleDefinition,
  PolicyDefinition,
  WorkflowDefinition,
  ParseContext,
  INTENT_KEYWORDS,
  ENTITY_PATTERNS,
  RULE_TEMPLATES,
  POLICY_TEMPLATES,
} from './types';

// ============ 解析器 ============

/**
 * 自然语言解析器
 */
export class NaturalLanguageParser {
  private context: ParseContext;

  constructor(context?: Partial<ParseContext>) {
    this.context = {
      definedRules: new Map(),
      definedPolicies: new Map(),
      definedWorkflows: new Map(),
      systemConfig: {},
      userPreferences: {},
      ...context,
    };
  }

  /**
   * 解析自然语言
   */
  parse(text: string): ParsedIntent {
    // 预处理
    const normalizedText = this.normalize(text);
    
    // 识别意图
    const intentType = this.recognizeIntent(normalizedText);
    
    // 提取实体
    const entities = this.extractEntities(normalizedText, intentType);
    
    // 计算置信度
    const confidence = this.calculateConfidence(normalizedText, intentType, entities);

    return {
      type: intentType,
      confidence,
      entities,
      rawText: text,
    };
  }

  /**
   * 解析为规则
   */
  parseRule(text: string): RuleDefinition | null {
    const intent = this.parse(text);
    
    if (intent.type !== ParsedIntentType.DEFINE_RULE) {
      return null;
    }

    const ruleId = `rule_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();

    // 尝试匹配模板
    const template = this.matchTemplate(text, RULE_TEMPLATES);

    return {
      ruleId,
      name: intent.entities.name || `规则_${ruleId.slice(0, 8)}`,
      trigger: intent.entities.trigger || template?.trigger || {
        type: 'event',
        pattern: 'unknown',
      },
      action: intent.entities.action || template?.action || {
        type: 'unknown',
        params: {},
      },
      priority: intent.entities.priority || template?.priority || 5,
      enabled: true,
      metadata: {
        description: text,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /**
   * 解析为策略
   */
  parsePolicy(text: string): PolicyDefinition | null {
    const intent = this.parse(text);
    
    if (intent.type !== ParsedIntentType.DEFINE_POLICY) {
      return null;
    }

    const policyId = `policy_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();

    // 尝试匹配模板
    const template = this.matchTemplate(text, POLICY_TEMPLATES);

    return {
      policyId,
      name: intent.entities.name || `策略_${policyId.slice(0, 8)}`,
      type: intent.entities.policyType || template?.type || 'custom',
      rules: intent.entities.rules || template?.rules || [],
      defaultAction: intent.entities.defaultAction || template?.defaultAction || 'default',
      metadata: {
        description: text,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /**
   * 解析为工作流
   */
  parseWorkflow(text: string): WorkflowDefinition | null {
    const intent = this.parse(text);
    
    if (intent.type !== ParsedIntentType.DEFINE_WORKFLOW) {
      return null;
    }

    const workflowId = `workflow_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();

    return {
      workflowId,
      name: intent.entities.name || `工作流_${workflowId.slice(0, 8)}`,
      steps: intent.entities.steps || [],
      trigger: intent.entities.trigger || {
        type: 'manual',
      },
      metadata: {
        description: text,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  // ============ 内部方法 ============

  /**
   * 标准化文本
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[，。！？、；：""''（）【】]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 识别意图
   */
  private recognizeIntent(text: string): ParsedIntentType {
    const scores: Record<ParsedIntentType, number> = {
      [ParsedIntentType.DEFINE_RULE]: 0,
      [ParsedIntentType.DEFINE_POLICY]: 0,
      [ParsedIntentType.DEFINE_WORKFLOW]: 0,
      [ParsedIntentType.QUERY_STATUS]: 0,
      [ParsedIntentType.EXECUTE_ACTION]: 0,
      [ParsedIntentType.CONFIGURE_SYSTEM]: 0,
      [ParsedIntentType.UNKNOWN]: 0,
    };

    // 计算每个意图的得分
    for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          scores[intentType as ParsedIntentType] += 1;
        }
      }
    }

    // 特殊模式匹配（增强规则识别）
    // 模式1: "当...时" 或 "如果...就"
    if (/当.+时/.test(text) || /如果.+就/.test(text)) {
      scores[ParsedIntentType.DEFINE_RULE] += 3;
    }
    
    // 模式2: "发送通知" + 触发条件
    if (text.includes('发送通知') && (text.includes('当') || text.includes('如果') || text.includes('失败'))) {
      scores[ParsedIntentType.DEFINE_RULE] += 2;
    }
    
    // 模式3: "记录日志" + 触发条件
    if (text.includes('记录日志') && (text.includes('当') || text.includes('如果') || text.includes('变更'))) {
      scores[ParsedIntentType.DEFINE_RULE] += 2;
    }
    
    // 模式4: "告警" + 触发条件
    if ((text.includes('告警') || text.includes('警告')) && (text.includes('当') || text.includes('如果') || text.includes('错误'))) {
      scores[ParsedIntentType.DEFINE_RULE] += 2;
    }
    
    // 模式5: "任务失败"
    if (text.includes('任务失败') || text.includes('任务 失败')) {
      scores[ParsedIntentType.DEFINE_RULE] += 2;
    }
    
    // 模式6: "状态变更"
    if (text.includes('状态变更') || text.includes('状态 变更')) {
      scores[ParsedIntentType.DEFINE_RULE] += 2;
    }
    
    // 模式7: "错误发生"
    if (text.includes('错误发生') || text.includes('有错误') || text.includes('发生错误')) {
      scores[ParsedIntentType.DEFINE_RULE] += 2;
    }
    
    // 模式8: "定义一个规则"
    if (text.includes('定义一个规则') || text.includes('定义规则') || text.includes('创建规则')) {
      scores[ParsedIntentType.DEFINE_RULE] += 3;
    }
    
    // 模式9: "定义一个策略" 或 "创建一个策略"
    if (text.includes('定义一个策略') || text.includes('定义策略') || 
        text.includes('创建一个策略') || text.includes('创建策略')) {
      scores[ParsedIntentType.DEFINE_POLICY] += 3;
    }
    
    // 模式10: "安全审计策略"
    if (text.includes('安全审计') || text.includes('安全 策略') || text.includes('审计策略')) {
      scores[ParsedIntentType.DEFINE_POLICY] += 2;
    }
    
    // 模式11: "调度策略"
    if (text.includes('调度策略') || text.includes('轮询') || text.includes('最少任务')) {
      scores[ParsedIntentType.DEFINE_POLICY] += 2;
    }

    // 找出最高得分的意图
    let maxScore = 0;
    let bestIntent = ParsedIntentType.UNKNOWN;

    for (const [intentType, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intentType as ParsedIntentType;
      }
    }

    return bestIntent;
  }

  /**
   * 提取实体
   */
  private extractEntities(text: string, intentType: ParsedIntentType): Record<string, any> {
    const entities: Record<string, any> = {};

    // 提取时间
    const timeMatch = text.match(ENTITY_PATTERNS.time);
    if (timeMatch) {
      entities.time = timeMatch[0];
    }

    // 提取数字
    const numberMatch = text.match(ENTITY_PATTERNS.number);
    if (numberMatch) {
      entities.number = parseInt(numberMatch[0], 10);
    }

    // 提取优先级
    const priorityMatch = text.match(ENTITY_PATTERNS.priority);
    if (priorityMatch) {
      entities.priority = this.parsePriority(priorityMatch[0]);
    }

    // 提取布尔值
    const booleanMatch = text.match(ENTITY_PATTERNS.boolean);
    if (booleanMatch) {
      entities.boolean = this.parseBoolean(booleanMatch[0]);
    }

    // 提取事件类型
    const eventMatch = text.match(ENTITY_PATTERNS.eventType);
    if (eventMatch) {
      entities.eventType = eventMatch[0];
    }

    // 提取动作类型
    const actionMatch = text.match(ENTITY_PATTERNS.actionType);
    if (actionMatch) {
      entities.actionType = actionMatch[0];
    }

    // 根据意图类型提取特定实体
    switch (intentType) {
      case ParsedIntentType.DEFINE_RULE:
        Object.assign(entities, this.extractRuleEntities(text));
        break;
      case ParsedIntentType.DEFINE_POLICY:
        Object.assign(entities, this.extractPolicyEntities(text));
        break;
      case ParsedIntentType.DEFINE_WORKFLOW:
        Object.assign(entities, this.extractWorkflowEntities(text));
        break;
    }

    return entities;
  }

  /**
   * 提取规则实体
   */
  private extractRuleEntities(text: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // 提取触发条件
    if (text.includes('当') || text.includes('如果') || text.includes('when')) {
      const triggerMatch = text.match(/当(.+?)时|如果(.+?)就|when\s+(.+?)(?:\s+then)?/i);
      if (triggerMatch) {
        entities.trigger = {
          type: 'condition',
          pattern: (triggerMatch[1] || triggerMatch[2] || triggerMatch[3] || '').trim(),
        };
      }
    }

    // 提取动作
    if (text.includes('发送') || text.includes('通知') || text.includes('send')) {
      entities.action = {
        type: 'send_notification',
        params: { channel: 'default' },
      };
    } else if (text.includes('记录') || text.includes('日志') || text.includes('log')) {
      entities.action = {
        type: 'log',
        params: { level: 'info' },
      };
    } else if (text.includes('执行') || text.includes('运行') || text.includes('execute')) {
      entities.action = {
        type: 'execute',
        params: {},
      };
    }

    // 提取名称
    const nameMatch = text.match(/名为["'](.+?)["']|名称是["'](.+?)["']|叫["'](.+?)["']/);
    if (nameMatch) {
      entities.name = (nameMatch[1] || nameMatch[2] || nameMatch[3] || '').trim();
    }

    return entities;
  }

  /**
   * 提取策略实体
   */
  private extractPolicyEntities(text: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // 提取策略类型
    if (text.includes('调度') || text.includes('scheduling')) {
      entities.policyType = 'scheduling';
    } else if (text.includes('路由') || text.includes('routing')) {
      entities.policyType = 'routing';
    } else if (text.includes('安全') || text.includes('security')) {
      entities.policyType = 'security';
    } else if (text.includes('资源') || text.includes('resource')) {
      entities.policyType = 'resource';
    }

    // 提取规则
    const rules: Array<{ condition: string; action: string; priority: number }> = [];
    
    // 简单规则提取
    if (text.includes('高优先级') || text.includes('高风险')) {
      rules.push({
        condition: 'priority >= HIGH',
        action: 'require_approval',
        priority: 20,
      });
    }
    
    if (rules.length > 0) {
      entities.rules = rules;
    }

    return entities;
  }

  /**
   * 提取工作流实体
   */
  private extractWorkflowEntities(text: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // 提取步骤
    const steps: Array<{ stepId: string; name: string; action: string }> = [];
    
    // 简单步骤提取
    const stepPatterns = [
      /第一步[：:]\s*(.+?)(?:，|然后|$)/,
      /第二步[：:]\s*(.+?)(?:，|然后|$)/,
      /第三步[：:]\s*(.+?)(?:，|然后|$)/,
      /首先\s*(.+?)(?:，|然后|$)/,
      /然后\s*(.+?)(?:，|最后|$)/,
      /最后\s*(.+?)$/,
    ];

    let stepIndex = 0;
    for (const pattern of stepPatterns) {
      const match = text.match(pattern);
      if (match) {
        steps.push({
          stepId: `step_${stepIndex}`,
          name: match[1].trim(),
          action: match[1].trim(),
        });
        stepIndex++;
      }
    }

    if (steps.length > 0) {
      entities.steps = steps;
    }

    // 提取触发类型
    if (text.includes('自动') || text.includes('定时')) {
      entities.trigger = { type: 'schedule' };
    } else if (text.includes('事件') || text.includes('触发')) {
      entities.trigger = { type: 'event' };
    } else {
      entities.trigger = { type: 'manual' };
    }

    return entities;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    text: string,
    intentType: ParsedIntentType,
    entities: Record<string, any>
  ): number {
    if (intentType === ParsedIntentType.UNKNOWN) {
      return 0;
    }

    let confidence = 0.5; // 基础置信度

    // 根据匹配的关键词数量增加置信度
    const keywords = INTENT_KEYWORDS[intentType] || [];
    const matchedKeywords = keywords.filter(k => text.includes(k.toLowerCase()));
    confidence += Math.min(matchedKeywords.length * 0.1, 0.3);

    // 根据提取的实体数量增加置信度
    const entityCount = Object.keys(entities).length;
    confidence += Math.min(entityCount * 0.05, 0.2);

    return Math.min(confidence, 1.0);
  }

  /**
   * 匹配模板
   */
  private matchTemplate<T>(
    text: string,
    templates: Record<string, Partial<T>>
  ): Partial<T> | null {
    for (const [name, template] of Object.entries(templates)) {
      if (text.includes(name.toLowerCase())) {
        return template;
      }
    }
    return null;
  }

  /**
   * 解析优先级
   */
  private parsePriority(text: string): number {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('最高') || lowerText.includes('urgent')) return 20;
    if (lowerText.includes('高') || lowerText.includes('high')) return 10;
    if (lowerText.includes('中') || lowerText.includes('medium')) return 5;
    if (lowerText.includes('低') || lowerText.includes('low')) return 1;
    return 5;
  }

  /**
   * 解析布尔值
   */
  private parseBoolean(text: string): boolean {
    const lowerText = text.toLowerCase();
    return ['是', '开启', '启用', 'true', 'yes', 'on'].includes(lowerText);
  }
}

// ============ 工厂函数 ============

/**
 * 创建解析器
 */
export function createParser(context?: Partial<ParseContext>): NaturalLanguageParser {
  return new NaturalLanguageParser(context);
}
