# 自然语言编程接口

## 📊 概述

自然语言编程接口允许用户用自然语言定义 Harness 规则和策略，降低使用门槛。

---

## 🚀 快速开始

```typescript
import { createParser } from '@yuanling/nl-programming';

const parser = createParser();

// 解析规则
const rule = parser.parseRule('当任务失败时发送通知');
console.log(rule);

// 解析策略
const policy = parser.parsePolicy('定义一个轮询调度策略');
console.log(policy);

// 解析工作流
const workflow = parser.parseWorkflow('创建自动化流程：第一步验证输入，第二步处理数据');
console.log(workflow);
```

---

## 🎯 支持的意图

| 意图 | 说明 | 示例 |
|------|------|------|
| DEFINE_RULE | 定义规则 | "当任务失败时发送通知" |
| DEFINE_POLICY | 定义策略 | "创建轮询调度策略" |
| DEFINE_WORKFLOW | 定义工作流 | "创建自动化流程..." |
| QUERY_STATUS | 查询状态 | "显示所有规则" |
| EXECUTE_ACTION | 执行操作 | "执行健康检查" |
| CONFIGURE_SYSTEM | 配置系统 | "配置超时时间为30秒" |

---

## 📝 语法示例

### 规则定义

```
当任务失败时发送通知
如果状态变更就记录日志
每当有错误发生时，发送告警通知，优先级为高
定义一个规则，名为"健康检查"，每5分钟执行一次
```

### 策略定义

```
定义一个轮询调度策略
创建一个安全策略，高优先级任务需要审批
设置最少任务优先的调度策略
配置安全审计策略
```

### 工作流定义

```
定义一个工作流，首先检查状态，然后执行任务，最后发送通知
创建自动化流程：第一步验证输入，第二步处理数据，第三步保存结果
新建一个定时工作流，每天凌晨执行数据备份
```

---

## 🔧 解析结果

### 规则

```typescript
interface RuleDefinition {
  ruleId: string;
  name: string;
  trigger: {
    type: 'event' | 'condition' | 'schedule';
    pattern: string;
  };
  action: {
    type: string;
    params: Record<string, any>;
  };
  priority: number;
  enabled: boolean;
}
```

### 策略

```typescript
interface PolicyDefinition {
  policyId: string;
  name: string;
  type: 'routing' | 'scheduling' | 'security' | 'resource' | 'custom';
  rules: Array<{
    condition: string;
    action: string;
    priority: number;
  }>;
  defaultAction: string;
}
```

### 工作流

```typescript
interface WorkflowDefinition {
  workflowId: string;
  name: string;
  steps: Array<{
    stepId: string;
    name: string;
    action: string;
  }>;
  trigger: {
    type: 'manual' | 'event' | 'schedule';
  };
}
```

---

## 🎨 架构

```
自然语言输入
     │
     ▼
┌─────────────────┐
│   标准化处理     │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   意图识别       │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   实体提取       │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   模板匹配       │
└─────────────────┘
     │
     ▼
结构化输出
```

---

## 📁 文件结构

```
src/nl-programming/
├── types.ts    # 类型定义
├── parser.ts   # 解析器
├── index.ts    # 模块入口
└── test.ts     # 测试脚本
```

---

## 📚 更多资源

- [API 文档](./API.md)
- [使用指南](./GUIDE.md)

---

*版本：v1.0.0 | 更新时间：2026-04-16*
