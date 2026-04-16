# 元灵系统 (YuanLing System) v4.9.6

一个基于六层架构的多 Agent 协作框架，集成了 **Harness Engineering** 缰绳系统和 **全智能处理系统**。

[![Build Status](https://img.shields.io/github/actions/workflow/status/bdjwbdb/humanoid-agent/build.yml?branch=main)](https://github.com/bdjwbdb/humanoid-agent/actions)
[![npm version](https://img.shields.io/npm/v/humanoid-agent.svg)](https://www.npmjs.com/package/humanoid-agent)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    元灵系统六层架构                          │
├─────────────────────────────────────────────────────────────┤
│  L0 灵思层 - 思考协议（强制思考、自适应深度、高级思维技术）    │
│  L1 灵枢层 - 决策中心（任务规划、工具选择）                    │
│  L2 灵脉层 - 执行引擎（记忆管理、上下文控制）                  │
│  L3 灵躯层 - 工具执行（OpenClaw 桥接）                        │
│  L4 灵盾层 - 安全验证（代码验证、权限控制）                    │
│  L5 灵韵层 - 反馈调节（学习反馈、自动调优、Darwin机制）        │
│  L6 灵识层 - 环境感知（系统监控、健康检查）                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                Harness Engineering v1.3.6                    │
├─────────────────────────────────────────────────────────────┤
│  状态管理器  │  追踪系统  │  PPAF 闭环  │  沙盒隔离  │  度量演进  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  全智能处理系统 v1.0.0                        │
├─────────────────────────────────────────────────────────────┤
│  意图识别  │  工具匹配  │  Skill 发现  │  智能路由  │  任务编排  │
└─────────────────────────────────────────────────────────────┘
```

## v4.9.6 新特性

### 🚀 全智能处理系统
- **意图识别引擎**: 17 种意图类型，置信度 98.2%
- **工具匹配器**: 20+ 工具自动选择
- **Skill 发现器**: 20+ Skill 自动发现
- **智能路由**: 根据意图置信度自动选择执行路径
- **任务编排器**: 自动生成执行计划

### 🛡️ 健壮性增强
- **超时控制**: 智能系统 30s、L0 思考 10s、记忆搜索 5s、Skill 执行 5s
- **重试机制**: 默认最多重试 2 次，间隔 1 秒
- **熔断机制**: 连续 5 次失败后熔断，30 秒后半开
- **限流机制**: 每分钟最多 60 个请求（可配置）

### ⚡ 性能优化
- **并行执行**: L0 思考 + 记忆搜索并行
- **智能缓存**: 智能系统结果缓存 30 秒
- **请求去重**: 5 秒内重复请求返回缓存
- **性能采样**: 10% 采样率减少开销

### 🔧 Harness Engineering 集成
- **StateManager**: 6 种状态类别、检查点恢复、审计日志
- **TraceCollector**: 全链路追踪（L0-L6）、决策审计、异常检测
- **PPAFEngine**: Perception → Planning → Action → Feedback 完整闭环
- **SandboxManager**: 四级沙盒隔离（L1进程→L2容器→L3虚拟机→L4物理）
- **EvolutionEngine**: 度量收集、A/B 测试、灰度发布、自动优化

## 核心功能

### 记忆系统
- **MemoryStore**: JSON 持久化记忆存储
- **VectorStore**: 向量相似度搜索
- **ForgetDetector**: 多维度遗忘检测
- **ConversationSummarizer**: 对话摘要生成
- **SmartTagger**: 智能标签系统

### 学习系统
- **KnowledgeGraph**: 知识图谱
- **MetaCognition**: 元认知（知道自己不知道什么）
- **InferenceEngine**: 推理引擎（演绎/归纳/溯因）
- **OnlineLearner**: 在线学习
- **CausalReasoner**: 因果推理
- **AutonomousLearner**: 自主学习
- **KnowledgeTransfer**: 知识迁移

### 安全系统
- **RBACManager**: 基于角色的权限控制
- **ContextGuard**: 上下文安全守卫
- **HealthChecker**: 系统健康检查

## 快速开始

### 安装

```bash
npm install humanoid-agent
```

### 基本使用

```typescript
import { YuanLingSystem, getYuanLingSystem } from 'humanoid-agent';

// 创建系统实例
const system = getYuanLingSystem({
  workspaceRoot: './workspace',
  enableL0: true,
  enableIntrospection: true,
});

// 启动系统
await system.startup();

// 处理消息（全智能）
const result = await system.processIntelligently('帮我搜索一下 AI 新闻');
console.log(result.analysis.intent);  // 意图识别结果
console.log(result.execution);        // 执行结果

// 添加记忆
const memId = await system.addMemory('重要信息', 'fact');

// 搜索记忆
const results = await system.searchMemory('关键词');

// 健康检查
const health = await system.checkHealth();

// 关闭系统
await system.shutdown();
```

### 使用外部执行器

```typescript
import { getYuanLingSystem } from 'humanoid-agent';

const system = getYuanLingSystem();
await system.startup();

// 自定义执行器
const myExecutor = async (prompt: string, context: any) => {
  // 调用你的 LLM 或其他服务
  return { content: '处理结果...' };
};

// 处理消息
const { result, context } = await system.processWithExternalExecutor(
  '你好',
  [],  // 会话历史
  myExecutor
);

console.log(result.content);
console.log(context.performance);  // 性能指标
```

## 项目结构

```
humanoid-agent/
├── src/
│   ├── yuanling-system.ts    # 主入口
│   ├── integrated-system.ts  # 集成层
│   ├── infrastructure/       # 基础设施模块
│   ├── layers/              # 六层架构实现
│   │   └── ling-si/         # L0 灵思层
│   ├── introspection/       # 自省系统
│   └── __tests__/           # 测试文件
├── docs/                    # 文档
├── memory/                  # 记忆存储
└── dist/                    # 编译输出
```

## 开发

```bash
# 安装依赖
pnpm install

# 编译
pnpm run build

# 测试
pnpm test

# 类型检查
pnpm run typecheck
```

## 文档

- [架构文档](docs/ARCHITECTURE.md)
- [快速开始](docs/QUICK_START.md)
- [API 参考](docs/API_REFERENCE.md)
- [L0 灵思层实现](docs/LING-SI-IMPLEMENTATION.md)
- [yaoyao-memory 融合计划](docs/YAOYAO_FUSION_PLAN.md)

## 版本历史

- **v4.2.0**: 融合 yaoyao-memory-v2，完整记忆系统
- **v4.1.0**: 架构反转，元灵系统为主系统
- **v4.0.0**: 六层架构体系成型
- **v2.2.0**: L0 灵思层实现

## 许可证

MIT
