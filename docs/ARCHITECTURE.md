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
