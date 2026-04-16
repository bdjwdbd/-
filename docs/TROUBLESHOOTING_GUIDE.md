# 元灵系统故障排查指南

## 📋 常见问题

### 1. 系统启动失败

**症状**：
```
[YuanLing] 元灵系统启动失败
Error: 工作目录不存在
```

**原因**：工作目录配置错误

**解决方案**：
```typescript
// 检查工作目录
const system = new YuanLingSystem({
  workspaceRoot: '/correct/path/to/workspace',
});

// 或创建目录
import { mkdirSync } from 'fs';
mkdirSync('/path/to/workspace', { recursive: true });
```

---

### 2. 模块初始化失败

**症状**：
```
[YuanLing] Harness 系统初始化失败
Error: 状态管理器未初始化
```

**原因**：依赖模块未初始化

**解决方案**：
```typescript
// 确保按顺序初始化
await system.startup();
await system.initializeHarness();
await system.initializeDashboard();
```

---

### 3. 工具执行被阻止

**症状**：
```
🚨 [L4] L4_SECURITY_VIOLATION: 工具执行被阻止
```

**原因**：L4 灵盾层检测到安全风险

**解决方案**：
```typescript
// 检查守卫统计
const stats = system.getGuardStats();
console.log('会话数:', stats.sessionCount);
console.log('总调用:', stats.totalCalls);

// 重置会话
system.toolExecutionGuard?.resetSession('session_id');
```

---

### 4. 循环检测触发

**症状**：
```
🔴 [L4] L4_LOOP_DETECTED: 检测到无限循环
```

**原因**：同一工具被重复调用

**解决方案**：
```typescript
// 检查循环检测器
const detector = system.toolExecutionGuard?.loopDetector;
const stats = detector?.getStats();
console.log('历史记录:', stats.historySize);
console.log('连续调用:', stats.consecutiveCount);

// 重置连续计数
detector?.resetConsecutiveCount();
```

---

### 5. 自然语言解析失败

**症状**：
```
❌ 无法解析为规则 (意图: unknown, 置信度: 0.00)
```

**原因**：输入格式不匹配模板

**解决方案**：
```typescript
// 使用标准格式
const validInputs = [
  '当任务失败时发送通知',
  '如果状态变更就记录日志',
  '定义一个轮询调度策略',
];

// 检查解析结果
const intent = system.parser?.parse(input);
console.log('意图:', intent.type);
console.log('置信度:', intent.confidence);
```

---

### 6. 性能下降

**症状**：
```
⚠️ 健康度警告: 当前 70.0%, 阈值 80.0%
```

**原因**：缓存命中率低或错误率高

**解决方案**：
```typescript
// 检查性能指标
const metrics = system.getModuleMetrics();
for (const [name, m] of Object.entries(metrics)) {
  if (m.errorRate > 0.01) {
    console.log(`⚠️ ${name} 错误率: ${(m.errorRate * 100).toFixed(1)}%`);
  }
}

// 检查错误统计
const errorStats = system.getErrorStats();
console.log('总错误:', errorStats.total);
console.log('按层级:', errorStats.byLayer);
```

---

### 7. 内存占用过高

**症状**：
```
内存使用: 500MB+
```

**原因**：状态、追踪、缓存未清理

**解决方案**：
```typescript
// 清理状态
await system.harness?.stateManager?.cleanup();

// 清理追踪
system.harness?.traceCollector?.clear();

// 清理缓存
system.performanceMonitor?.clearCache?.();

// 清理错误历史
system.clearErrorHistory();
```

---

### 8. 网络请求失败

**症状**：
```
Error: 网络请求超时
```

**原因**：网络配置或超时设置

**解决方案**：
```typescript
// 配置超时
const system = new YuanLingSystem({
  timeout: 30000, // 30秒
});

// 检查网络状态
const status = await system.harness?.healthCheck?.();
console.log('网络状态:', status?.network);
```

---

## 🔍 诊断工具

### 1. 系统状态检查

```typescript
// 获取系统状态
const status = system.getStatus();
console.log('健康状态:', status.health);
console.log('工具数量:', status.toolCount);
console.log('L0 启用:', status.l0Enabled);
```

### 2. 错误历史检查

```typescript
// 获取错误历史
const errors = system.getErrorHistory(20);
for (const error of errors) {
  console.log(`[${error.layer}] ${error.code}: ${error.message}`);
}
```

### 3. 性能报告

```typescript
// 获取性能报告
const report = system.getPerformanceReport();
console.log(report);
```

### 4. 模块状态检查

```typescript
// 检查各模块状态
console.log('Harness:', system.harness ? '已初始化' : '未初始化');
console.log('Dashboard:', system.dashboard ? '已初始化' : '未初始化');
console.log('Coordinator:', system.coordinator ? '已初始化' : '未初始化');
console.log('Edge:', system.edgeRuntime ? '已初始化' : '未初始化');
console.log('Federated:', system.federatedEngine ? '已初始化' : '未初始化');
```

---

## 📊 日志分析

### 日志级别

| 级别 | 说明 |
|------|------|
| DEBUG | 详细调试信息 |
| INFO | 一般信息 |
| WARN | 警告信息 |
| ERROR | 错误信息 |

### 日志配置

```typescript
const system = new YuanLingSystem({
  logLevel: 'debug', // 启用详细日志
});
```

### 常见日志模式

```
[YuanLing] 元灵系统启动中...     ← 系统启动
[YuanLing] Harness 系统已初始化  ← 模块初始化
[L0] 思考完成: 深度=extensive    ← L0 思考
[L4] 输出已处理: truncation      ← L4 验证
⚠️ [PerformanceAlert] 健康度警告  ← 性能告警
🚨 [L4] L4_SECURITY_VIOLATION    ← 安全违规
```

---

## 🛠️ 调试技巧

### 1. 启用详细日志

```typescript
const system = new YuanLingSystem({
  logLevel: 'debug',
});
```

### 2. 单步调试

```typescript
// 仅运行 L0 思考
const thinking = await system.thinkOnly('测试消息');
console.log('思考结果:', thinking);

// 仅运行自省
const introspection = await system.introspect();
console.log('自省结果:', introspection);
```

### 3. 模拟测试

```typescript
// 使用测试执行器
const testExecutor = async (prompt, context) => {
  console.log('提示词:', prompt);
  return { content: '测试回复' };
};

const { result, context } = await system.processWithExternalExecutor(
  '测试消息',
  [],
  testExecutor
);
```

---

## 📞 获取帮助

### 检查清单

- [ ] 查看错误历史
- [ ] 检查性能报告
- [ ] 检查模块状态
- [ ] 查看日志输出
- [ ] 检查配置参数

### 文档资源

- API 文档：`docs/API.md`
- 使用指南：`docs/GUIDE.md`
- 架构图：`docs/ARCHITECTURE.md`
- 性能调优：`docs/PERFORMANCE_TUNING_GUIDE.md`

---

*文档版本：v1.0*
*最后更新：2026-04-16*
