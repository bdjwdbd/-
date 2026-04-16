# 智能模块启动功能

## 🎯 功能说明

系统现在支持**意图识别自动启动**，根据你的指令自动判断需要启动哪些模块。

---

## 📊 启动方式对比

| 方式 | 说明 | 示例 |
|------|------|------|
| **手动启动** | 显式调用初始化方法 | `await system.initializeDashboard(3000)` |
| **自动启动** | 使用时自动初始化 | `await system.getDashboardAsync()` |
| **智能启动** | 根据意图自动判断 | `await system.autoStartModules("帮我监控一下")` |

---

## 🎯 智能启动关键词

### Dashboard

| 关键词 | 示例指令 |
|--------|---------|
| 监控 | "帮我监控一下系统状态" |
| dashboard | "打开 dashboard" |
| 可视化 | "可视化展示性能数据" |
| 仪表盘 | "显示仪表盘" |
| 查看状态 | "查看系统状态" |

### Multi-Agent

| 关键词 | 示例指令 |
|--------|---------|
| 多agent | "启动多agent协作" |
| 协作 | "让多个agent协作完成这个任务" |
| 分配任务 | "分配任务给不同的agent" |
| coordinator | "使用coordinator协调" |
| 协调 | "协调多个模块工作" |

### Edge Computing

| 关键词 | 示例指令 |
|--------|---------|
| 边缘 | "在边缘节点执行" |
| edge | "启动edge计算" |
| 本地计算 | "本地计算不要上传云端" |
| 离线 | "离线模式下运行" |

### Federated Learning

| 关键词 | 示例指令 |
|--------|---------|
| 联邦 | "启动联邦学习" |
| federated | "使用federated训练" |
| 分布式学习 | "分布式学习模式" |
| 隐私计算 | "隐私计算保护数据" |

---

## 💻 使用示例

### 方式一：智能启动（推荐）

```typescript
const system = new YuanLingSystem();
await system.startup();

// 根据意图自动启动模块
const started = await system.autoStartModules("帮我监控一下系统状态");

console.log(started);
// 输出: { dashboard: true, coordinator: false, edgeRuntime: false, federatedEngine: false }
```

### 方式二：自动启动

```typescript
// 直接使用，自动初始化
const dashboard = await system.getDashboardAsync();
const coordinator = await system.getCoordinatorAsync();
const edgeRuntime = await system.getEdgeRuntimeAsync();
const federatedEngine = await system.getFederatedEngineAsync();
```

### 方式三：手动启动

```typescript
// 显式调用初始化方法
await system.initializeDashboard(3000);
system.initializeCoordinator();
await system.initializeEdgeRuntime();
await system.initializeFederatedEngine();
```

---

## 📈 效果

| 场景 | 之前 | 现在 |
|------|------|------|
| 你说"帮我监控一下" | ❌ 需要手动启动 Dashboard | ✅ 自动启动 Dashboard |
| 你说"多agent协作" | ❌ 需要手动启动 Coordinator | ✅ 自动启动 Coordinator |
| 你说"边缘计算" | ❌ 需要手动启动 EdgeRuntime | ✅ 自动启动 EdgeRuntime |
| 你说"联邦学习" | ❌ 需要手动启动 FederatedEngine | ✅ 自动启动 FederatedEngine |

---

*版本: v4.8.0*
*更新时间: 2026-04-16*
