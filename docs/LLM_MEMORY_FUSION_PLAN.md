# LLM Memory Integration 融合计划

## 源技能分析

### 核心功能模块

| 模块 | 功能 | 元灵系统对应 |
|------|------|-------------|
| **P0 核心优化** | router + weights + rrf + dedup | 需新增 |
| **P1 查询增强** | understand + rewriter | 需新增 |
| **P2 学习优化** | feedback + history | 部分已有 |
| **P3 结果增强** | explainer + summarizer | 需新增 |

### 技术特性

| 特性 | 说明 | 优先级 |
|------|------|--------|
| 向量搜索 | SQLite vec0 + FTS5 混合 | P0 |
| 智能路由 | fast/balanced/full 模式 | P0 |
| RRF 融合 | 向量 + FTS + LLM 混合排序 | P0 |
| 查询理解 | 意图识别 + 实体提取 | P1 |
| 查询改写 | 拼写纠正 + 同义词扩展 | P1 |
| 反馈学习 | 点击记录 + 权重优化 | P2 |
| 结果解释 | LLM 生成解释 | P3 |
| 结果摘要 | LLM 生成摘要 | P3 |

### 配置体系

```json
{
  "progressive": {
    "P0": { "modules": ["router", "weights", "rrf", "dedup"], "enabled": true },
    "P1": { "modules": ["understand", "rewriter"], "enabled": true },
    "P2": { "modules": ["feedback", "history"], "enabled": true },
    "P3": { "modules": ["explainer", "summarizer"], "enabled": true }
  },
  "vector_search": { "top_k": 20, "max_distance": 0.8 },
  "cache": { "ttl": 3600, "compression": true }
}
```

---

## 融合计划

### 阶段一：P0 核心优化（新增）

| 模块 | 文件 | 功能 |
|------|------|------|
| QueryRouter | query-router.ts | 智能路由（fast/balanced/full） |
| DynamicWeights | dynamic-weights.ts | 向量/FTS 权重自适应 |
| RRFFusion | rrf-fusion.ts | RRF 混合排序算法 |
| SemanticDedup | semantic-dedup.ts | 语义去重 |

### 阶段二：P1 查询增强（新增）

| 模块 | 文件 | 功能 |
|------|------|------|
| QueryUnderstand | query-understand.ts | 意图识别 + 实体提取 |
| QueryRewriter | query-rewriter.ts | 拼写纠正 + 同义词扩展 |

### 阶段三：P2 学习优化（增强）

| 模块 | 文件 | 功能 |
|------|------|------|
| FeedbackLearner | feedback-learner.ts | 点击记录 + 权重优化（已有，增强） |
| QueryHistory | query-history.ts | 高频查询缓存 |

### 阶段四：P3 结果增强（新增）

| 模块 | 文件 | 功能 |
|------|------|------|
| ResultExplainer | result-explainer.ts | LLM 生成结果解释 |
| ResultSummarizer | result-summarizer.ts | LLM 生成结果摘要 |

### 阶段五：配置体系（新增）

| 文件 | 功能 |
|------|------|
| search-config.json | 搜索配置统一管理 |
| progressive-config.ts | 渐进式启用管理 |

---

## 实现优先级

| 顺序 | 阶段 | 模块数 | 预计代码量 |
|------|------|--------|-----------|
| 1 | P0 核心优化 | 4 | ~2000 行 |
| 2 | P1 查询增强 | 2 | ~1000 行 |
| 3 | P2 学习优化 | 2 | ~800 行 |
| 4 | P3 结果增强 | 2 | ~800 行 |
| 5 | 配置体系 | 2 | ~500 行 |

**总计**：12 个模块，约 5100 行代码

---

## 融合后架构

```
┌─────────────────────────────────────────────────────────────┐
│                    元灵系统 v4.3.0                           │
├─────────────────────────────────────────────────────────────┤
│  搜索系统（新增）                                            │
│  ├── QueryRouter      - 智能路由                            │
│  ├── DynamicWeights   - 动态权重                            │
│  ├── RRFFusion        - RRF 融合                            │
│  ├── SemanticDedup    - 语义去重                            │
│  ├── QueryUnderstand  - 查询理解                            │
│  ├── QueryRewriter    - 查询改写                            │
│  ├── FeedbackLearner  - 反馈学习                            │
│  ├── QueryHistory     - 查询历史                            │
│  ├── ResultExplainer  - 结果解释                            │
│  └── ResultSummarizer - 结果摘要                            │
├─────────────────────────────────────────────────────────────┤
│  记忆系统（已有）                                            │
│  ├── MemoryStore      - 记忆存储                            │
│  ├── VectorStore      - 向量搜索                            │
│  ├── ForgetDetector   - 遗忘检测                            │
│  └── ...                                                    │
├─────────────────────────────────────────────────────────────┤
│  学习系统（已有）                                            │
│  ├── KnowledgeGraph   - 知识图谱                            │
│  ├── MetaCognition    - 元认知                              │
│  └── ...                                                    │
└─────────────────────────────────────────────────────────────┘
```

---

*创建时间：2026-04-15*
