# 元灵系统 (YuanLing System) v4.3.0

一个基于六层架构的多 Agent 协作框架，融合了思考协议、记忆系统、学习系统和安全验证。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    元灵系统六层架构                          │
├─────────────────────────────────────────────────────────────┤
│  L0 灵思层 - 思考协议（强制思考、自适应深度）                  │
│  L1 灵枢层 - 决策中心（任务规划、工具选择）                    │
│  L2 灵脉层 - 执行引擎（记忆管理、上下文控制）                  │
│  L3 灵躯层 - 工具执行（OpenClaw 桥接）                        │
│  L4 灵盾层 - 安全验证（代码验证、权限控制）                    │
│  L5 灵韵层 - 反馈调节（学习反馈、自动调优）                    │
│  L6 灵识层 - 环境感知（系统监控、健康检查）                    │
└─────────────────────────────────────────────────────────────┘
```

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

```typescript
import { YuanLingSystem } from './yuanling-system';

// 创建系统实例
const system = new YuanLingSystem();

// 启动系统
await system.startup();

// 添加记忆
const memId = await system.addMemory('重要信息', 'fact');

// 搜索记忆
const results = await system.searchMemory('关键词');

// 健康检查
const health = await system.checkHealth();

// 关闭系统
await system.shutdown();
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
