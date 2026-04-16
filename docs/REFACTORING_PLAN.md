# 元灵系统架构重构计划

## 🎯 目标

将独立模块迁移到对应的六层架构中，实现真正的架构统一。

---

## 📊 迁移映射

### L6 灵识层（感知与唤醒）

| 模块 | 原位置 | 目标位置 | 功能 |
|------|--------|---------|------|
| HealthMonitor | `src/core/health-monitor.ts` | `src/layers/ling-shi/health-monitor.ts` | 健康监控 |

### L0 灵思层（思考协议）

| 模块 | 原位置 | 目标位置 | 功能 |
|------|--------|---------|------|
| HNSWIndex | `src/core/hnsw.ts` | `src/layers/ling-si/hnsw-index.ts` | 向量索引 |
| VectorQuantizer | `src/core/vector-quantizer.ts` | `src/layers/ling-si/vector-quantizer.ts` | 向量量化 |

### L1 灵枢层（决策与协调）

| 模块 | 原位置 | 目标位置 | 功能 |
|------|--------|---------|------|
| Coordinator | `src/multi-agent/coordinator.ts` | `src/layers/ling-shu/multi-agent-coordinator.ts` | 多 Agent 协调 |
| PersonaManager | `src/core/persona-manager.ts` | `src/layers/ling-shu/persona-manager.ts` | 用户画像 |

### L2 灵脉层（执行与流转）

| 模块 | 原位置 | 目标位置 | 功能 |
|------|--------|---------|------|
| StateManager | `src/harness/state-manager/` | `src/layers/ling-mai/state-manager/` | 状态管理 |
| TraceCollector | `src/harness/trace-system/` | `src/layers/ling-mai/trace-collector/` | 追踪收集 |
| PPAFEngine | `src/harness/ppaf/` | `src/layers/ling-mai/ppaf-engine/` | PPAF 闭环 |

### L3 灵躯层（行动与工具）

| 模块 | 原位置 | 目标位置 | 功能 |
|------|--------|---------|------|
| HybridSearchEngine | `src/core/hybrid-search.ts` | `src/layers/ling-qu/hybrid-search-engine.ts` | 混合搜索 |
| EdgeRuntime | `src/edge/` | `src/layers/ling-qu/edge-runtime/` | 边缘执行 |
| NaturalLanguageParser | `src/nl-programming/` | `src/layers/ling-qu/nl-parser/` | 自然语言解析 |

### L4 灵盾层（防护与验证）

| 模块 | 原位置 | 目标位置 | 功能 |
|------|--------|---------|------|
| SandboxManager | `src/harness/sandbox/` | `src/layers/ling-dun/sandbox-manager/` | 沙盒管理 |
| RiskAssessor | `src/harness/sandbox/risk-assessor.ts` | `src/layers/ling-dun/risk-assessor.ts` | 风险评估 |

### L5 灵韵层（反馈与调节）

| 模块 | 原位置 | 目标位置 | 功能 |
|------|--------|---------|------|
| MetricsCollector | `src/harness/metrics/` | `src/layers/ling-yun/metrics-collector/` | 度量收集 |
| EvolutionEngine | `src/harness/metrics/evolution-engine.ts` | `src/layers/ling-yun/evolution-engine.ts` | 演进优化 |
| FederatedEngine | `src/federated/` | `src/layers/ling-yun/federated-engine/` | 联邦学习 |
| SmartMemoryUpgrader | `src/core/smart-memory-upgrader.ts` | `src/layers/ling-yun/smart-memory-upgrader.ts` | 记忆升级 |

### 跨层基础设施

| 模块 | 原位置 | 目标位置 | 功能 |
|------|--------|---------|------|
| Dashboard | `src/dashboard/` | `src/infrastructure/dashboard/` | 可视化监控 |
| ConfigManager | `src/config/` | `src/infrastructure/config/` | 配置管理 |
| ErrorHandler | `src/error-handling/` | `src/infrastructure/error-handling/` | 错误处理 |
| PerformanceMonitor | `src/infrastructure/` | `src/infrastructure/performance-monitor/` | 性能监控 |

---

## 📁 目标目录结构

```
src/
├── layers/                          # 六层架构
│   ├── ling-shi/                    # L6 灵识层
│   │   ├── index.ts
│   │   ├── environment-awareness.ts
│   │   ├── three-step-wakeup.ts
│   │   └── health-monitor.ts        # ← 迁移
│   │
│   ├── ling-si/                     # L0 灵思层
│   │   ├── index.ts
│   │   ├── enhanced-thinking-engine.ts
│   │   ├── multi-hypothesis-manager.ts
│   │   ├── domain-integrator.ts
│   │   ├── hnsw-index.ts            # ← 迁移
│   │   └── vector-quantizer.ts      # ← 迁移
│   │
│   ├── ling-shu/                    # L1 灵枢层
│   │   ├── index.ts
│   │   ├── decision-center.ts
│   │   ├── intent-analyzer.ts
│   │   ├── multi-agent-coordinator.ts  # ← 迁移
│   │   └── persona-manager.ts       # ← 迁移
│   │
│   ├── ling-mai/                    # L2 灵脉层
│   │   ├── index.ts
│   │   ├── flow-engine.ts
│   │   ├── workflow-orchestrator.ts
│   │   ├── state-manager/           # ← 迁移
│   │   ├── trace-collector/         # ← 迁移
│   │   └── ppaf-engine/             # ← 迁移
│   │
│   ├── ling-qu/                     # L3 灵躯层
│   │   ├── index.ts
│   │   ├── tool-orchestrator.ts
│   │   ├── tool-registry.ts
│   │   ├── hybrid-search-engine.ts  # ← 迁移
│   │   ├── edge-runtime/            # ← 迁移
│   │   └── nl-parser/               # ← 迁移
│   │
│   ├── ling-dun/                    # L4 灵盾层
│   │   ├── index.ts
│   │   ├── tool-execution-guard.ts
│   │   ├── loop-detector.ts
│   │   ├── output-truncator.ts
│   │   ├── sandbox-manager/         # ← 迁移
│   │   └── risk-assessor.ts         # ← 迁移
│   │
│   ├── ling-yun/                    # L5 灵韵层
│   │   ├── index.ts
│   │   ├── feedback-regulator.ts
│   │   ├── ratchet-manager.ts
│   │   ├── independent-evaluator.ts
│   │   ├── metrics-collector/       # ← 迁移
│   │   ├── evolution-engine.ts      # ← 迁移
│   │   ├── federated-engine/        # ← 迁移
│   │   └── smart-memory-upgrader.ts # ← 迁移
│   │
│   ├── index.ts                     # 层级统一导出
│   └── unified-interface.ts         # 统一接口
│
├── infrastructure/                  # 跨层基础设施
│   ├── dashboard/                   # ← 迁移
│   ├── config/                      # ← 迁移
│   ├── error-handling/              # ← 迁移
│   └── performance-monitor/         # ← 迁移
│
├── yuanling-system.ts               # 主系统入口
└── index.ts                         # 统一导出
```

---

## 🔄 迁移步骤

### 阶段 1：创建目标目录结构

```bash
# 创建基础设施目录
mkdir -p src/infrastructure/{dashboard,config,error-handling,performance-monitor}
```

### 阶段 2：迁移基础设施模块

```bash
# Dashboard
mv src/dashboard/* src/infrastructure/dashboard/

# Config
mv src/config/* src/infrastructure/config/

# Error Handling
mv src/error-handling/* src/infrastructure/error-handling/
```

### 阶段 3：迁移层级模块

```bash
# L6 灵识层
mv src/core/health-monitor.ts src/layers/ling-shi/

# L0 灵思层
mv src/core/hnsw.ts src/layers/ling-si/hnsw-index.ts
mv src/core/vector-quantizer.ts src/layers/ling-si/

# L1 灵枢层
mv src/multi-agent/coordinator.ts src/layers/ling-shu/multi-agent-coordinator.ts
mv src/core/persona-manager.ts src/layers/ling-shu/

# L2 灵脉层
mv src/harness/state-manager src/layers/ling-mai/
mv src/harness/trace-system src/layers/ling-mai/trace-collector
mv src/harness/ppaf src/layers/ling-mai/ppaf-engine

# L3 灵躯层
mv src/core/hybrid-search.ts src/layers/ling-qu/hybrid-search-engine.ts
mv src/edge src/layers/ling-qu/edge-runtime
mv src/nl-programming src/layers/ling-qu/nl-parser

# L4 灵盾层
mv src/harness/sandbox src/layers/ling-dun/sandbox-manager

# L5 灵韵层
mv src/harness/metrics src/layers/ling-yun/metrics-collector
mv src/federated src/layers/ling-yun/federated-engine
mv src/core/smart-memory-upgrader.ts src/layers/ling-yun/
```

### 阶段 4：更新导入路径

更新所有文件中的导入路径。

### 阶段 5：更新导出

更新 `src/layers/index.ts` 和 `src/index.ts`。

### 阶段 6：测试验证

运行所有测试确保迁移成功。

---

## ⚠️ 注意事项

1. **保留原目录**：迁移后保留原目录的软链接，确保向后兼容
2. **更新导入**：所有导入路径需要更新
3. **测试验证**：每迁移一个模块后运行测试
4. **文档更新**：更新相关文档

---

## 📊 预期效果

| 指标 | 迁移前 | 迁移后 |
|------|--------|--------|
| 独立模块目录 | 7 个 | 0 个 |
| 层级模块数 | 6 个 | 20+ 个 |
| 架构清晰度 | ⚠️ 混乱 | ✅ 清晰 |
| 模块归属 | ⚠️ 不明确 | ✅ 明确 |

---

*计划版本：v1.0*
*创建时间：2026-04-16*
