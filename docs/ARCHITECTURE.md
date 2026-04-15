# 元灵系统 v4.3.0 架构文档

## 概述

元灵系统采用六层架构设计，每层职责明确，层次分明。

---

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    元灵系统 v4.3.0                          │
│                      六层架构                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  L0 灵思层 - 思考协议引擎                                    │
│  ├── ThinkingProtocolEngine    思考协议引擎                 │
│  ├── AdaptiveDepthController   自适应深度控制               │
│  ├── MultiHypothesisManager    多假设管理                   │
│  └── TokenAwareThinkingController Token感知控制             │
├─────────────────────────────────────────────────────────────┤
│  L1 灵枢核心层 - 决策与记忆                                 │
│  ├── DecisionCenter            决策中心                     │
│  ├── MemoryCenter              记忆中心                     │
│  └── OneWayValve               单向阀（JSON物理锁）         │
├─────────────────────────────────────────────────────────────┤
│  L2 灵脉记忆层 - 记忆管理                                   │
│  ├── MemoryStore               记忆存储                     │
│  ├── ForgetDetector            遗忘检测                     │
│  ├── ConversationSummarizer    对话摘要                     │
│  └── SmartTagger               智能标签                     │
├─────────────────────────────────────────────────────────────┤
│  L3 灵躯编排层 - 工具执行                                   │
│  ├── ToolExecutor              工具执行器                   │
│  ├── MultiDimensionalRouter    多维路由                     │
│  └── QueryRouter               查询路由                     │
├─────────────────────────────────────────────────────────────┤
│  L4 灵盾执行层 - 安全验证                                   │
│  ├── CodeValidatorV2           代码验证器                   │
│  ├── SecurityGuard             安全守卫                     │
│  └── ContextGuard              上下文守卫                   │
├─────────────────────────────────────────────────────────────┤
│  L5 灵韵治理层 - 反馈与调优                                 │
│  ├── FeedbackCenter            反馈中心                     │
│  ├── AutoTuner                 自动调优                     │
│  └── CompensationTracker       补偿面追踪                   │
├─────────────────────────────────────────────────────────────┤
│  L6 灵识基建层 - 基础设施                                   │
│  ├── EnvironmentAwareness      环境感知                     │
│  ├── TokenEstimator            Token估算                    │
│  ├── CacheSystem               缓存系统                     │
│  └── PerformanceMonitor        性能监控                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 层级详解

### L0 灵思层

**职责**：深度思考、多假设分析

**核心组件**：

| 组件 | 功能 |
|------|------|
| ThinkingProtocolEngine | 执行 10 步思考协议 |
| AdaptiveDepthController | 根据问题复杂度调整思考深度 |
| MultiHypothesisManager | 管理多个工作假设 |
| TokenAwareThinkingController | 控制 Token 消耗 |

**思考步骤**：
1. Initial Engagement - 理解问题
2. Problem Analysis - 分解需求
3. Multiple Hypotheses - 生成假设
4. Natural Discovery - 探索验证
5. Testing Verification - 质疑验证
6. Error Correction - 修正理解
7. Knowledge Synthesis - 构建图景
8. Pattern Recognition - 发现模式
9. Progress Tracking - 追踪进展
10. Recursive Thinking - 递归分析

---

### L1 灵枢核心层

**职责**：决策路由、记忆管理

**核心组件**：

| 组件 | 功能 |
|------|------|
| DecisionCenter | 意图识别、路由选择 |
| MemoryCenter | 长期/短期记忆管理 |
| OneWayValve | JSON 格式物理锁 |

**决策类型**：
- `direct_reply` - 直接回答
- `tool_call` - 调用工具
- `search` - 搜索信息
- `clarify` - 需要澄清
- `multi_step` - 多步骤任务

---

### L2 灵脉记忆层

**职责**：记忆存储、检索、压缩

**核心组件**：

| 组件 | 功能 |
|------|------|
| MemoryStore | JSON 持久化存储 |
| ForgetDetector | 时间衰减、矛盾检测 |
| ConversationSummarizer | 对话摘要生成 |
| SmartTagger | 自动标签分类 |

**记忆类型**：
- `Persona` - 用户画像
- `Episodic` - 事件记忆
- `Instruction` - 指令记忆

---

### L3 灵躯编排层

**职责**：工具执行、任务编排

**核心组件**：

| 组件 | 功能 |
|------|------|
| ToolExecutor | 工具调用执行 |
| MultiDimensionalRouter | 多维度路由 |
| QueryRouter | 查询路由（fast/balanced/full） |

**工具类型**：
- `exec` - 执行命令
- `read/write` - 文件操作
- `browser` - 浏览器控制
- `web_fetch` - 网页抓取
- `xiaoyi-*` - 小艺工具集

---

### L4 灵盾执行层

**职责**：安全验证、权限控制

**核心组件**：

| 组件 | 功能 |
|------|------|
| CodeValidatorV2 | 代码安全验证 |
| SecurityGuard | 安全守卫 |
| ContextGuard | 上下文安全 |

**验证返回码**：
- `0` = PASS - 允许执行
- `1` = CONFIRM - 需要确认
- `2` = BLOCK - 阻止执行

---

### L5 灵韵治理层

**职责**：反馈收集、自动调优

**核心组件**：

| 组件 | 功能 |
|------|------|
| FeedbackCenter | 用户反馈收集 |
| AutoTuner | 参数自动调优 |
| CompensationTracker | 补偿面追踪 |

---

### L6 灵识基建层

**职责**：基础设施、性能监控

**核心组件**：

| 组件 | 功能 |
|------|------|
| EnvironmentAwareness | 环境感知 |
| TokenEstimator | Token 估算 |
| CacheSystem | LRU 缓存 |
| PerformanceMonitor | 性能监控 |

---

## 数据流

```
用户消息
    │
    ▼
┌─────────┐
│ L0 思考 │ ← 深度分析、多假设
└────┬────┘
     │
     ▼
┌─────────┐
│ L1 决策 │ ← 意图识别、路由选择
└────┬────┘
     │
     ▼
┌─────────┐
│ L2 记忆 │ ← 上下文检索、记忆压缩
└────┬────┘
     │
     ▼
┌─────────┐
│ L3 执行 │ ← 工具调用、任务编排
└────┬────┘
     │
     ▼
┌─────────┐
│ L4 验证 │ ← 安全检查、代码验证
└────┬────┘
     │
     ▼
┌─────────┐
│ L5 反馈 │ ← 结果评估、自动调优
└────┬────┘
     │
     ▼
返回结果
```

---

## 向量搜索架构

```
┌─────────────────────────────────────────────────────────────┐
│                    向量搜索流水线                            │
└─────────────────────────────────────────────────────────────┘

查询文本
    │
    ▼
┌─────────────┐
│ 嵌入模型    │ Qwen3-Embedding-8B (4096维)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Matryoshka  │ 降维到 1024/768
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 混合索引    │ IVF + 精排
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SIMD 加速   │ AVX2/FMA (17M QPS)
└──────┬──────┘
       │
       ▼
Top-K 结果
```

---

## 原生模块

| 模块 | 文件 | 功能 |
|------|------|------|
| SIMD | yuanling_native.node | AVX2 余弦相似度 |
| Parallel | parallel.node | OpenMP 多线程 |
| INT8 | int8.node | INT8 量化 |
| Memory | memory.node | 大页内存 |

---

## 性能优化

### 系统级优化

| 技术 | 效果 |
|------|------|
| NUMA 亲和性 | 延迟 -62% |
| 大页内存 | TLB Miss -90% |
| 缓存感知调度 | 性能 +44% |
| IRQ 中断隔离 | 抖动 -80% |

### 算法优化

| 技术 | 效果 |
|------|------|
| Top-K 堆选择 | 7x 提升 |
| 线程池复用 | 减少 Worker 创建开销 |
| 查询缓存 | 重复查询 100x |
| INT8 量化 | 4x 存储压缩 |

---

## 设计原则

### 1. 补偿面理论

每个 Harness 组件编码一条"模型做不到什么"的假设，当假设不再成立，组件就该移除。

### 2. Repo-as-truth

Agent 能读到的才是存在的，仓库即现实。

### 3. 从加法到减法

通往简单的路必须经过复杂，但要知道自己在经过复杂。

### 4. 验证闭环

规划比实现更重要，永远不要让 Agent 在批准计划前写代码。

---

*文档版本: v4.3.0*
*最后更新: 2026-04-15*
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
