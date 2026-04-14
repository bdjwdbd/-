# 废弃层管理清单

本文档记录已废弃的模块和文件，仅作兼容保留，不参与主运行。

---

## 已删除文件

| 文件 | 删除日期 | 原因 | 替代方案 |
|------|----------|------|----------|
| src/yuanling-optimized.ts | 2026-04-14 | 136KB 大文件，功能冗余 | 组件迁移到 infrastructure/index.ts |
| src/yuanling-core.ts | 2026-04-14 | 旧版兼容层 | 功能合并到 yuanling-system.ts |
| src/humanoid-agent.ts | 2026-04-14 | 旧版兼容层 | 功能合并到 yuanling-system.ts |
| src/yuanling-main.ts | 2026-04-14 | 旧版主入口 | 功能合并到 yuanling-system.ts |
| src/yuanling-v4.ts | 2026-04-14 | 旧版 v4 入口 | 功能合并到 yuanling-system.ts |
| src/l0-before-reply.ts | 2026-04-14 | 旧版 L0 实现 | 功能合并到 l0-integration.ts |

---

## 已废弃目录

| 目录 | 废弃日期 | 原因 | 替代方案 |
|------|----------|------|----------|
| (无) | - | - | - |

---

## 已废弃接口

| 接口 | 废弃日期 | 原因 | 替代方案 |
|------|----------|------|----------|
| OpenClawBridge.makeDecision() | 2026-04-14 | 违反架构原则 | 委托给 YuanLingSystem.makeDecision() |
| OpenClawBridge.validateOutput() | 2026-04-14 | 违反架构原则 | 委托给 YuanLingSystem.validateOutput() |
| OpenClawBridge.generateFeedback() | 2026-04-14 | 违反架构原则 | 委托给 YuanLingSystem.generateFeedback() |

---

## 已废弃配置

| 配置项 | 废弃日期 | 原因 | 替代方案 |
|--------|----------|------|----------|
| ContextReset.threshold = 0.8 | 2026-04-15 | 实验验证 60% 才下降 | 调整为 0.55 |

---

## 迁移记录

### 2026-04-14 架构整改

**变更内容**：
- 统一入口为 YuanLingSystem
- OpenClawBridge 降级为薄适配器
- 删除所有旧版兼容代码

**影响范围**：
- 所有 import 路径更新
- 配置文件更新

**兼容性**：
- 旧版 API 不再支持
- 需要更新调用代码

---

*最后更新：2026-04-15*
