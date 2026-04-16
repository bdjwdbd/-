# 模块开发规范

## 核心原则

**先分析归属，再开发实现**

---

## 一、新模块开发流程

### Step 1: 归属分析（必须）

在开发任何新模块前，必须回答以下问题：

| 问题 | 答案模板 |
|------|---------|
| 模块名称 | `XXXModule` |
| 核心功能 | 一句话描述 |
| 属于哪一层？ | L0-L6 或 跨层 |
| 为什么属于这一层？ | 理由 |
| 与其他层级的关系？ | 依赖/被依赖 |
| 是否需要新建目录？ | 是/否 |

### Step 2: 创建归属分析文档

在 `docs/module-analysis/` 下创建 `YYYY-MM-DD-模块名.md`：

```markdown
# 模块归属分析：XXXModule

## 基本信息
- **分析日期**: 2026-04-16
- **分析者**: XXX
- **模块名称**: XXXModule

## 归属分析

### 功能描述
[一句话描述核心功能]

### 层级归属
- **归属层级**: L2 灵脉层
- **归属理由**: 该模块负责状态流转，属于执行引擎范畴

### 依赖关系
- **依赖**: L0 灵思层（思考结果）
- **被依赖**: L4 灵盾层（安全验证）

### 目录结构
```
src/layers/ling-mai/
├── XXXModule.ts
└── __tests__/
    └── XXXModule.test.ts
```

### 导出计划
- 在 `src/layers/ling-mai/index.ts` 中导出
- 在 `src/index.ts` 中重新导出

### 集成计划
- 在 `YuanLingSystem` 中添加实例
- 添加访问器方法

## 审批
- [ ] 架构师审批
- [ ] 技术负责人审批
```

### Step 3: 开发实现

归属分析通过后，按以下步骤开发：

1. **在对应层级目录下创建模块**
2. **在层级 index.ts 中导出**
3. **在 src/index.ts 中重新导出**
4. **在 YuanLingSystem 中集成**
5. **更新架构文档**

---

## 二、层级归属指南

| 层级 | 名称 | 职责 | 典型模块 |
|------|------|------|---------|
| L0 | 灵思层 | 思考、假设生成 | ThinkingProtocolEngine, MultiHypothesisManager |
| L1 | 灵枢层 | 决策、协调 | DecisionCenter, IntentEngine |
| L2 | 灵脉层 | 执行、流转 | StateManager, TraceCollector, FlowEngine |
| L3 | 灵躯层 | 工具执行 | ToolExecutor, ToolRegistry |
| L4 | 灵盾层 | 安全验证 | SandboxManager, RiskAssessor |
| L5 | 灵韵层 | 反馈、学习 | MetricsCollector, EvolutionEngine |
| L6 | 灵识层 | 感知、唤醒 | HealthMonitor, EnvironmentAwareness |

### 跨层模块

如果模块功能跨越多个层级，需要：

1. **明确声明为"跨层模块"**
2. **定义与各层的接口**
3. **在 `src/cross-layer/` 目录下创建**
4. **在架构文档中特别说明**

---

## 三、检查清单

### 开发前检查

- [ ] 已完成归属分析文档
- [ ] 已获得架构师审批
- [ ] 已确定目录结构
- [ ] 已规划导出和集成方案

### 开发中检查

- [ ] 模块在正确的层级目录下
- [ ] 遵循层级命名规范
- [ ] 依赖关系正确（不跨层依赖）

### 开发后检查

- [ ] 已在层级 index.ts 中导出
- [ ] 已在 src/index.ts 中重新导出
- [ ] 已在 YuanLingSystem 中集成
- [ ] 已更新架构文档
- [ ] 已添加测试

---

## 四、自动化检查

### Linter 规则

在 `.eslintrc.js` 中添加：

```javascript
module.exports = {
  rules: {
    // 新文件必须在 index.ts 中导出
    'import/no-unresolved': 'error',
    // 禁止跨层直接依赖
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../layers/*'],
            message: '跨层依赖必须通过层级接口，不能直接导入'
          }
        ]
      }
    ]
  }
};
```

### CI 检查

在 `.github/workflows/ci.yml` 中添加：

```yaml
- name: Check module exports
  run: |
    # 检查所有 .ts 文件是否在 index.ts 中导出
    node scripts/check-exports.js
```

---

## 五、例外情况

### 允许绕过的情况

| 情况 | 条件 | 后续要求 |
|------|------|---------|
| 紧急修复 | 生产问题 | 1 周内补齐归属分析 |
| 实验性功能 | 标记为 `@experimental` | 成熟后纳入架构 |
| 技术债务 | 标记为 `@deprecated` | 计划重构时间 |

### 沙盒区

对于不确定归属的创新模块，可以放在 `src/sandbox/` 目录：

- 最多保留 2 周
- 必须有明确的"归属分析计划"
- 到期后必须决定归属或删除

---

## 六、文档更新

每次新增模块，必须更新以下文档：

| 文档 | 更新内容 |
|------|---------|
| `IDENTITY.md` | 版本号、模块列表 |
| `MEMORY.md` | 新模块的学习记录 |
| `docs/ARCHITECTURE.md` | 架构图、层级说明 |
| `docs/API.md` | 新模块的 API 文档 |

---

*版本: v1.0.0*
*创建日期: 2026-04-16*
*适用范围: 元灵系统所有新模块开发*
