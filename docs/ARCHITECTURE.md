# 六层主架构 - 唯一真源

## V4.2.0 - 2026-04-15

本文档是元灵系统架构的唯一权威定义，所有运行逻辑以此为准。

---

## 架构定义

| 层级 | 名称 | 职责 | 入口模块 |
|------|------|------|----------|
| L0 | 灵思层 | 思考协议、深度分析、假设管理 | layers/ling-si/ThinkingProtocolEngine.ts |
| L1 | 灵枢层 | 决策中心、意图理解、任务路由 | layers/ling-shu/index.ts |
| L2 | 灵脉层 | 执行引擎、工作流调度 | layers/ling-mai/index.ts |
| L3 | 灵躯层 | 工具执行、技能调用 | layers/ling-qu/index.ts |
| L4 | 灵盾层 | 安全验证、权限审计 | layers/ling-dun/index.ts |
| L5 | 灵韵层 | 反馈调节、学习进化 | layers/ling-yun/index.ts |
| L6 | 灵识层 | 环境感知、三步唤醒 | layers/ling-shi/index.ts |

---

## 唯一真源清单

### 主架构定义
- **本文档**: docs/ARCHITECTURE.md

### 运行入口
- **统一入口**: src/yuanling-system.ts (YuanLingSystem)
- **桥接层**: src/openclaw-bridge.ts (OpenClawBridge)

### 注册体系
- **技能注册**: infrastructure/skill_registry.json
- **组件注册**: infrastructure/COMPONENT_REGISTRY.json

### 主运行时读取源
- AGENTS.md - 工作空间规则
- SOUL.md - 身份定义
- USER.md - 用户信息
- TOOLS.md - 工具规则
- HEARTBEAT.md - 心跳配置
- IDENTITY.md - 身份标识
- MEMORY.md - 长期记忆

---

## 数据流

```
用户消息 → L6 灵识层(环境感知) → L0 灵思层(思考) → L1 灵枢层(决策) 
         → L2/L3 灵脉层/灵躯层(执行) → L4 灵盾层(验证) 
         → L5 灵韵层(反馈) → 返回结果
```

---

## 层级编号规则

统一使用 L0-L6 编号：
- L0 = 灵思层（思考协议）
- L1 = 灵枢层（决策中心）
- L2 = 灵脉层（执行引擎）
- L3 = 灵躯层（工具执行）
- L4 = 灵盾层（安全验证）
- L5 = 灵韵层（反馈调节）
- L6 = 灵识层（环境感知）

禁止使用其他层级编号体系。

---

## 兼容/废弃层（不参与主运行）

以下内容已废弃，仅作兼容保留：

- ~~src/yuanling-optimized.ts~~ → 已删除，组件迁移到 infrastructure
- ~~src/yuanling-core.ts~~ → 已删除，功能合并到 yuanling-system.ts
- ~~src/humanoid-agent.ts~~ → 已删除，功能合并到 yuanling-system.ts
- ~~src/yuanling-main.ts~~ → 已删除，功能合并到 yuanling-system.ts
- ~~src/yuanling-v4.ts~~ → 已删除
- ~~src/l0-before-reply.ts~~ → 已删除，功能合并到 l0-integration.ts

---

## 补偿面追踪

详见 COMPENSATION_TRACKER.md，记录每个组件的假设和移除条件。

---

**版本**: V4.2.0
**更新**: 2026-04-15
**状态**: 唯一真源
