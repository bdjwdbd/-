# AgentCoordinator 报告
生成时间: 2026-04-12T20:41:05.940Z

## 统计概览

- 总 Agent 数: 3
- 活跃 Agent: 2
- 总任务数: 3
- 已完成: 0
- 待处理: 1
- 锁定资源: 0/3
- 消息处理: 3
- 死锁检测: 0
- 死锁解决: 0

## Agent 状态

| ID | 名称 | 状态 | 当前任务 | 锁定资源 |
|----|------|------|----------|----------|
| agent-1 | 数据分析 Agent | running | task-1776026465938-y3fegru7i | 0 |
| agent-2 | 执行 Agent | running | task-1776026465939-92amy5any | 0 |
| agent-3 | 监控 Agent | idle | - | 0 |

## 任务状态

| ID | 描述 | 状态 | 优先级 | 分配给 |
|----|------|------|--------|--------|
| task-1776026465938-y3fegru7i | 读取数据文件 | assigned | high | agent-1 |
| task-1776026465939-26zkih2eq | 分析数据 | pending | normal | - |
| task-1776026465939-92amy5any | 执行操作 | assigned | low | agent-2 |