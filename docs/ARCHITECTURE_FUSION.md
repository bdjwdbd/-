# 元灵系统架构融合文档

## 融合来源

本文档融合了两个六层架构体系：
1. **元灵系统 v2.1** - 原有架构
2. **xiaoyi-claw-omega-final V4.1.0** - 新融合架构

---

## 架构映射

### 层级对应关系

| 元灵系统 | xiaoyi-claw-omega | 融合后名称 | 职责 |
|---------|-------------------|-----------|------|
| **L0 灵思层** | - | **灵思思考层** | 思考协议、自适应深度、多假设管理 |
| L1 灵枢层 | L1 Core | **灵枢核心层** | 决策、协调、身份、规则 |
| L2 灵脉层 | L2 Memory | **灵脉记忆层** | 执行、流转、记忆上下文 |
| L3 灵躯层 | L3 Orchestration | **灵躯编排层** | 行动、工具、任务编排 |
| L4 灵盾层 | L4 Execution | **灵盾执行层** | 防护、验证、技能执行 |
| L5 灵韵层 | L5 Governance | **灵韵治理层** | 反馈、调节、安全审计 |
| L6 灵识层 | L6 Infrastructure | **灵识基建层** | 感知、唤醒、基础设施 |

---

## 融合后的七层架构

### L0 灵思思考层（Thinking）- 新增

**职责**：
- 强制思考：每次交互前必须思考
- 自适应深度：根据问题复杂度动态调整
- 多假设管理：保持多个工作假设
- 思维流合成：生成自然的意识流思考

**组件**：
- ThinkingProtocolEngine - 思考协议引擎
- AdaptiveDepthController - 自适应深度控制器
- MultiHypothesisManager - 多假设管理器
- ThoughtFlowSynthesizer - 思维流合成器
- ThinkingSteps - 思考步骤集合（10 个步骤）

**入口**：`layers/ling-si/index.ts`

**设计来源**：基于 Thinking Claude v5.1-extensive 协议设计

---

### L1 灵枢核心层（Core）

**职责**：
- 核心认知、身份定义
- 决策制定、规则引导
- 协调调度、资源分配

**组件**：
- DecisionCenter - 决策中心
- MemoryCenter - 记忆中心
- SecurityAssessment - 安全评估
- AgentCoordinator - Agent 协调器

**入口**：`layers/ling-shu/index.ts`

---

### L2 灵脉记忆层（Memory）

**职责**：
- 记忆存储与检索
- 上下文管理
- 日记系统
- 流程流转控制

**组件**：
- MemoryCenterV2 - 记忆中心 v2
- TencentDBBackend - TencentDB 后端
- OneWayValve - 单向阀门
- MessageChannel - 消息通道

**入口**：`layers/ling-mai/index.ts`

---

### L3 灵躯编排层（Orchestration）

**职责**：
- 任务编排与调度
- 工作流管理
- 技能路由
- 工具执行

**组件**：
- ToolExecutor - 工具执行器
- ToolFramework - 工具框架
- ExecutionEngine - 执行引擎
- MultiDimensionalRouter - 多维路由

**入口**：`layers/ling-qu/index.ts`

---

### L4 灵盾执行层（Execution）

**职责**：
- 技能执行与验证
- 代码验证
- 安全防护
- 结果验证

**组件**：
- CodeValidatorV2 - 代码验证器 v2
- SecurityGuard - 安全守卫
- HardConstraints - 硬约束
- LearningValidator - 学习验证器

**入口**：`layers/ling-dun/index.ts`

---

### L5 灵韵治理层（Governance）

**职责**：
- 治理审计
- 安全权限管理
- 反馈调节
- 自动优化

**组件**：
- FeedbackCenter - 反馈中心
- RegulationCenter - 调节中心
- StressResponse - 应激响应
- AutoTuner - 自动调优器

**入口**：`layers/ling-yun/index.ts`

---

### L6 灵识基建层（Infrastructure）

**职责**：
- 基础设施管理
- 环境感知
- 内容理解
- 命令解析

**组件**：
- EnvironmentAwareness - 环境感知
- ContentUnderstanding - 内容理解
- CommandParser - 命令解析
- StructuredLogger - 结构化日志
- TokenEstimator - Token 估算器
- CacheSystem - 缓存系统
- PerformanceMonitor - 性能监控

**入口**：`layers/ling-shi/index.ts`

---

## 唯一真源清单

### 主架构定义
- **本文档**: `ARCHITECTURE.md`
- **融合文档**: `docs/ARCHITECTURE_FUSION.md`

### 运行入口
- **统一入口**: `yuanling-v2.ts`
- **层级入口**: `layers/*/index.ts`

### 注册体系
- **组件注册**: `src/core/index.ts`
- **层级注册**: `src/layers/index.ts`

### 主运行时读取源
- `AGENTS.md` - 工作空间规则
- `SOUL.md` - 身份定义
- `TOOLS.md` - 工具规则
- `IDENTITY.md` - 身份标识
- `USER.md` - 用户信息
- `HEARTBEAT.md` - 心跳配置

---

## 兼容/废弃层

以下内容已废弃，仅作兼容保留：

- `yuanling-optimized.ts` → 已被 `yuanling-v2.ts` 替代
- `yuanling.ts` → 保留兼容
- `yuanling-system.ts` → 保留兼容

---

## 版本信息

- **元灵系统版本**: v2.2.0
- **xiaoyi-claw-omega 版本**: v4.1.0
- **Thinking Claude 版本**: v5.1-extensive
- **融合版本**: v2.3.0
- **更新日期**: 2026-04-13
- **状态**: 唯一真源

### 更新日志

**v2.3.0 (2026-04-13)**
- 新增 L0 灵思思考层
- 集成 Thinking Claude 思考协议
- 实现自适应深度控制器
- 实现多假设管理器
- 实现思维流合成器
- 实现 10 个思考步骤模块
