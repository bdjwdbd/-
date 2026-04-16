# 元灵系统性能调优指南

## 📊 性能基准

### 系统级指标

| 指标 | 目标值 | 当前值 | 状态 |
|------|--------|--------|------|
| 健康度 | ≥80% | 70% | ⚠️ 需优化 |
| 平均延迟 | ≤100ms | ~10ms | ✅ 优秀 |
| 缓存命中率 | ≥50% | 0% | ⚠️ 需优化 |
| 成功率 | ≥99% | 100% | ✅ 优秀 |

### 层级延迟

| 层级 | 目标 | 当前 | 状态 |
|------|------|------|------|
| L0-L1 并行 | ≤20ms | ~10ms | ✅ |
| L2-L3 执行 | ≤200ms | ~50ms | ✅ |
| L4 验证 | ≤10ms | ~1ms | ✅ |
| L5 反馈 | ≤20ms | ~5ms | ✅ |

### 模块延迟

| 模块 | 目标 | 当前 | 状态 |
|------|------|------|------|
| Harness | ≤50ms | ~1ms | ✅ |
| Multi-Agent | ≤30ms | ~0ms | ✅ |
| Edge | ≤100ms | ~0ms | ✅ |
| Federated | ≤200ms | ~1ms | ✅ |

---

## 🚀 性能优化建议

### 1. 缓存优化

**问题**：缓存命中率为 0%

**建议**：
```typescript
// 启用记忆缓存
const system = new YuanLingSystem({
  enableCache: true,
  cacheConfig: {
    maxSize: 1000,
    ttlMs: 60000,
  },
});

// 使用缓存
const cached = system.cache.get('key');
if (!cached) {
  const result = await expensiveOperation();
  system.cache.set('key', result);
}
```

**预期效果**：缓存命中率提升至 50%+

### 2. 并行执行优化

**当前**：L0/L1 已并行执行

**建议**：扩展到更多层级
```typescript
// L2/L3 并行执行
const [flowResult, toolResult] = await Promise.all([
  this.flowEngine.execute(context),
  this.toolOrchestrator.execute(context),
]);
```

**预期效果**：延迟降低 30%

### 3. 懒加载优化

**当前**：所有模块在构造函数中初始化

**建议**：按需初始化
```typescript
// 懒加载
get harness() {
  if (!this._harness) {
    this._harness = new HarnessSystem();
  }
  return this._harness;
}
```

**预期效果**：启动时间降低 50%

### 4. 批处理优化

**当前**：每次操作单独执行

**建议**：批量处理
```typescript
// 批量状态操作
await system.harness.setStates([
  { key: 'key1', value: 'value1' },
  { key: 'key2', value: 'value2' },
]);
```

**预期效果**：吞吐量提升 2x

---

## 📈 性能监控

### 实时监控

```typescript
// 获取性能报告
const report = system.getPerformanceReport();
console.log(report);

// 获取模块指标
const metrics = system.getModuleMetrics();
for (const [name, m] of Object.entries(metrics)) {
  console.log(`${name}: ${m.operations} ops, ${m.avgLatency}ms avg`);
}
```

### 告警配置

```typescript
// 配置告警阈值
system.performanceMonitor.setAlertThresholds({
  health: { warning: 0.8, critical: 0.7 },
  avgLatency: { warning: 2000, critical: 5000 },
  successRate: { warning: 0.95, critical: 0.8 },
});
```

---

## 🔧 性能调优参数

### YuanLingSystem 配置

```typescript
const system = new YuanLingSystem({
  // 启用 L0 思考
  enableL0: true,
  
  // 启用自省
  enableIntrospection: true,
  
  // 日志级别
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
  
  // 工作目录
  workspaceRoot: '/path/to/workspace',
  
  // 记忆目录
  memoryDir: './memory',
});
```

### Harness 配置

```typescript
await system.initializeHarness({
  enableStateManager: true,
  enableTracing: true,
  enableAudit: true,
});
```

### Multi-Agent 配置

```typescript
system.initializeCoordinator({
  maxAgents: 100,
  maxTasks: 1000,
  schedulingStrategy: 'round_robin',
});
```

---

## 🐛 性能问题排查

### 问题 1：延迟过高

**症状**：平均延迟 > 100ms

**排查步骤**：
1. 检查层级延迟：`system.getPerformanceReport()`
2. 检查模块延迟：`system.getModuleMetrics()`
3. 检查错误率：`system.getErrorStats()`

**解决方案**：
- 启用缓存
- 并行执行
- 减少日志级别

### 问题 2：内存占用高

**症状**：内存 > 500MB

**排查步骤**：
1. 检查状态数量：`system.harness.getStateStats()`
2. 检查追踪数量：`system.harness.getTraceStats()`
3. 检查缓存大小：`system.cache.getStats()`

**解决方案**：
- 清理过期状态
- 限制追踪历史
- 清理缓存

### 问题 3：错误率高

**症状**：错误率 > 1%

**排查步骤**：
1. 检查错误历史：`system.getErrorHistory()`
2. 检查错误统计：`system.getErrorStats()`
3. 检查告警历史：`system.performanceMonitor.getAlertHistory()`

**解决方案**：
- 修复根本原因
- 添加重试机制
- 调整错误处理策略

---

## 📊 性能测试

### 基准测试

```bash
# 运行性能基准测试
npx ts-node src/tests/performance-benchmark.ts
```

### 压力测试

```typescript
// 压力测试
const iterations = 10000;
const start = Date.now();

for (let i = 0; i < iterations; i++) {
  await system.processWithExternalExecutor('test', [], executor);
}

const elapsed = Date.now() - start;
const ops = iterations / (elapsed / 1000);
console.log(`吞吐量: ${ops.toFixed(0)} ops/s`);
```

---

## 🎯 性能目标

| 指标 | 当前 | 目标 | 优化后 |
|------|------|------|--------|
| 健康度 | 70% | 80% | 85% |
| 平均延迟 | 10ms | 50ms | 8ms |
| 缓存命中率 | 0% | 50% | 60% |
| 吞吐量 | 100 ops/s | 500 ops/s | 800 ops/s |

---

*文档版本：v1.0*
*最后更新：2026-04-16*
