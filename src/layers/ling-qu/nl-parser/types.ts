/**
 * 自然语言编程接口
 * 
 * 用自然语言定义 Harness 规则和策略
 * 
 * @module nl-programming/types
 */

// ============ 类型定义 ============

/**
 * 解析结果类型
 */
export enum ParsedIntentType {
  /** 定义规则 */
  DEFINE_RULE = 'define_rule',
  
  /** 定义策略 */
  DEFINE_POLICY = 'define_policy',
  
  /** 定义工作流 */
  DEFINE_WORKFLOW = 'define_workflow',
  
  /** 查询状态 */
  QUERY_STATUS = 'query_status',
  
  /** 执行操作 */
  EXECUTE_ACTION = 'execute_action',
  
  /** 配置系统 */
  CONFIGURE_SYSTEM = 'configure_system',
  
  /** 未知意图 */
  UNKNOWN = 'unknown',
}

/**
 * 解析后的意图
 */
export interface ParsedIntent {
  /** 意图类型 */
  type: ParsedIntentType;
  
  /** 置信度 */
  confidence: number;
  
  /** 提取的实体 */
  entities: Record<string, any>;
  
  /** 原始文本 */
  rawText: string;
  
  /** 解析错误 */
  error?: string;
}

/**
 * 规则定义
 */
export interface RuleDefinition {
  /** 规则 ID */
  ruleId: string;
  
  /** 规则名称 */
  name: string;
  
  /** 触发条件 */
  trigger: {
    type: 'event' | 'condition' | 'schedule';
    pattern: string;
    params?: Record<string, any>;
  };
  
  /** 执行动作 */
  action: {
    type: string;
    params: Record<string, any>;
  };
  
  /** 优先级 */
  priority: number;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 元数据 */
  metadata: {
    description: string;
    createdAt: number;
    updatedAt: number;
  };
}

/**
 * 策略定义
 */
export interface PolicyDefinition {
  /** 策略 ID */
  policyId: string;
  
  /** 策略名称 */
  name: string;
  
  /** 策略类型 */
  type: 'routing' | 'scheduling' | 'security' | 'resource' | 'custom';
  
  /** 策略规则 */
  rules: Array<{
    condition: string;
    action: string;
    priority: number;
  }>;
  
  /** 默认行为 */
  defaultAction: string;
  
  /** 元数据 */
  metadata: {
    description: string;
    createdAt: number;
    updatedAt: number;
  };
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  /** 工作流 ID */
  workflowId: string;
  
  /** 工作流名称 */
  name: string;
  
  /** 步骤列表 */
  steps: Array<{
    stepId: string;
    name: string;
    action: string;
    condition?: string;
    onError?: 'continue' | 'stop' | 'retry';
  }>;
  
  /** 触发条件 */
  trigger: {
    type: 'manual' | 'event' | 'schedule';
    pattern?: string;
  };
  
  /** 元数据 */
  metadata: {
    description: string;
    createdAt: number;
    updatedAt: number;
  };
}

/**
 * 解析上下文
 */
export interface ParseContext {
  /** 已定义的规则 */
  definedRules: Map<string, RuleDefinition>;
  
  /** 已定义的策略 */
  definedPolicies: Map<string, PolicyDefinition>;
  
  /** 已定义的工作流 */
  definedWorkflows: Map<string, WorkflowDefinition>;
  
  /** 系统配置 */
  systemConfig: Record<string, any>;
  
  /** 用户偏好 */
  userPreferences: Record<string, any>;
}

// ============ 关键词定义 ============

/**
 * 意图关键词
 */
export const INTENT_KEYWORDS: Record<ParsedIntentType, string[]> = {
  [ParsedIntentType.DEFINE_RULE]: [
    '定义规则', '创建规则', '添加规则', '新建规则',
    '当...时', '如果...就', '每当', '一旦',
    '当', '如果', '每当', '一旦', '当...发生',
    '发送通知', '记录日志', '告警',
    'define rule', 'create rule', 'add rule',
  ],
  [ParsedIntentType.DEFINE_POLICY]: [
    '定义策略', '创建策略', '设置策略', '配置策略',
    '调度策略', '路由策略', '安全策略',
    '定义一个策略', '创建一个策略',
    'define policy', 'create policy', 'set policy',
  ],
  [ParsedIntentType.DEFINE_WORKFLOW]: [
    '定义工作流', '创建工作流', '新建流程', '自动化流程',
    '工作流程', '执行流程',
    'define workflow', 'create workflow',
  ],
  [ParsedIntentType.QUERY_STATUS]: [
    '查询状态', '查看状态', '状态如何', '当前状态',
    '显示', '列出', '获取',
    'query status', 'show status', 'get status',
  ],
  [ParsedIntentType.EXECUTE_ACTION]: [
    '执行', '运行', '启动', '停止', '重启',
    'execute', 'run', 'start', 'stop', 'restart',
  ],
  [ParsedIntentType.CONFIGURE_SYSTEM]: [
    '配置', '设置', '修改配置', '更新配置',
    'configure', 'set', 'update config',
  ],
  [ParsedIntentType.UNKNOWN]: [],
};

/**
 * 实体关键词
 */
export const ENTITY_PATTERNS = {
  // 时间模式
  time: /(\d+)(秒|分钟|小时|天|周|月|年)|每天|每周|每月|每小时|每分钟/,
  
  // 数字模式
  number: /\d+/,
  
  // 优先级
  priority: /(高|中|低|最高|最低|urgent|high|medium|low)/i,
  
  // 布尔值
  boolean: /(是|否|开启|关闭|启用|禁用|true|false|yes|no|on|off)/i,
  
  // 路径
  path: /(\/[\w\/.-]+|[\w\\.-]+)/,
  
  // 事件类型
  eventType: /(任务完成|任务失败|状态变更|错误|警告|信息|task_complete|task_fail|state_change|error|warning|info)/i,
  
  // 动作类型
  actionType: /(发送通知|记录日志|执行命令|调用API|创建任务|更新状态|send_notification|log|execute|call_api|create_task|update_state)/i,
};

// ============ 模板定义 ============

/**
 * 规则模板
 */
export const RULE_TEMPLATES: Record<string, Partial<RuleDefinition>> = {
  '任务失败通知': {
    trigger: { type: 'event', pattern: 'task_fail' },
    action: { type: 'send_notification', params: { channel: 'default' } },
    priority: 10,
  },
  '状态变更日志': {
    trigger: { type: 'event', pattern: 'state_change' },
    action: { type: 'log', params: { level: 'info' } },
    priority: 5,
  },
  '定时检查': {
    trigger: { type: 'schedule', pattern: '*/5 * * * *' },
    action: { type: 'health_check', params: {} },
    priority: 5,
  },
  // 新增模板
  '错误告警': {
    trigger: { type: 'condition', pattern: '有错误发生' },
    action: { type: 'send_notification', params: { channel: 'alert', priority: 'high' } },
    priority: 10,
  },
  '任务失败': {
    trigger: { type: 'condition', pattern: '任务失败' },
    action: { type: 'send_notification', params: { channel: 'default' } },
    priority: 10,
  },
  '状态变更': {
    trigger: { type: 'condition', pattern: '状态变更' },
    action: { type: 'log', params: { level: 'info' } },
    priority: 5,
  },
  '错误发生': {
    trigger: { type: 'condition', pattern: '错误发生' },
    action: { type: 'send_notification', params: { channel: 'alert' } },
    priority: 10,
  },
  '告警通知': {
    trigger: { type: 'condition', pattern: '告警' },
    action: { type: 'send_notification', params: { channel: 'alert' } },
    priority: 8,
  },
};

/**
 * 策略模板
 */
export const POLICY_TEMPLATES: Record<string, Partial<PolicyDefinition>> = {
  '轮询调度': {
    type: 'scheduling',
    rules: [
      { condition: 'true', action: 'round_robin', priority: 1 },
    ],
    defaultAction: 'round_robin',
  },
  '最少任务优先': {
    type: 'scheduling',
    rules: [
      { condition: 'agent.tasks < threshold', action: 'assign_to_agent', priority: 10 },
    ],
    defaultAction: 'round_robin',
  },
  '安全审计': {
    type: 'security',
    rules: [
      { condition: 'action.risk_level >= HIGH', action: 'require_approval', priority: 20 },
      { condition: 'action.risk_level >= MEDIUM', action: 'log_and_alert', priority: 10 },
    ],
    defaultAction: 'allow',
  },
  // 新增模板
  '轮询': {
    type: 'scheduling',
    rules: [
      { condition: 'true', action: 'round_robin', priority: 1 },
    ],
    defaultAction: 'round_robin',
  },
  '安全': {
    type: 'security',
    rules: [
      { condition: 'action.risk_level >= HIGH', action: 'require_approval', priority: 20 },
    ],
    defaultAction: 'allow',
  },
  '审计': {
    type: 'security',
    rules: [
      { condition: 'action.type == sensitive', action: 'log', priority: 10 },
    ],
    defaultAction: 'allow',
  },
};
