# 元灵自省系统使用指南

## 概述

元灵自省系统是一个自动化的能力评估和变更追踪系统，能够：

1. **检测变更**：自动检测代码、配置、依赖、文档的变更
2. **评估能力**：运行 12 个维度的基准测试
3. **生成报告**：对比前后差异，识别短板，给出优化建议
4. **追踪趋势**：记录历史数据，可视化演进

## 快速开始

### 1. 运行自省

```typescript
import { IntrospectionSystem } from './introspection';

const system = new IntrospectionSystem('/path/to/workspace');

// 运行完整自省
const report = await system.introspect('manual');

// 查看摘要
console.log(system.formatSummary(report));
```

### 2. 快速检查

```typescript
// 仅检测变更，不运行完整测试
const check = system.quickCheck();
console.log('有变更:', check.hasChanges);
console.log('变更列表:', check.changes);
```

### 3. 查看趋势

```typescript
// 获取某维度的历史趋势
const trend = system.getTrend('memory_recall', 30);
console.log('趋势:', trend?.trend); // 'improving' | 'declining' | 'stable'
console.log('变化率:', trend?.changeRate);
```

## 触发方式

| 方式 | 说明 | 使用场景 |
|------|------|---------|
| `startup` | 启动时检测 | 每次系统启动时自动运行 |
| `manual` | 手动触发 | 用户主动请求评估 |
| `scheduled` | 定时任务 | 每周自动运行一次 |

## 能力维度

| 维度 | 权重 | 目标 | 度量方式 |
|------|------|------|---------|
| 响应速度 | 10% | 95 | 平均响应时间 |
| 理解准确率 | 15% | 90 | 意图识别准确率 |
| 任务完成率 | 15% | 85 | 任务成功比例 |
| 记忆召回率 | 10% | 80 | 语义搜索命中率 |
| 代码质量 | 10% | 85 | 静态分析评分 |
| 错误恢复率 | 8% | 75 | 自动恢复比例 |
| 安全防护 | 8% | 95 | 安全检查通过率 |
| 资源效率 | 6% | 80 | 内存/CPU 效率 |
| 可扩展性 | 5% | 75 | 模块化程度 |
| 可维护性 | 5% | 80 | 文档完善度 |
| 文档完善度 | 4% | 85 | 文档覆盖率 |
| 测试覆盖率 | 4% | 80 | 测试通过率 |

## 报告结构

每次自省会生成两份报告：

1. **Markdown 报告**：`memory/introspection/reports/report-YYYY-MM-DD-*.md`
2. **JSON 报告**：`memory/introspection/reports/report-YYYY-MM-DD-*.json`

报告包含：

- 变更记录
- 能力提升/退步
- 短板识别
- 优化建议
- 完整评分

## 历史数据

历史快照保存在 `memory/introspection/history/` 目录：

```
history/
├── 2026-04-13.json
├── 2026-04-12.json
└── ...
```

可用于趋势分析和可视化。

## 集成到启动流程

在 `AGENTS.md` 的三步唤醒仪式中添加：

```markdown
### 🌅 三步唤醒仪式（灵识层）

1. **pwd（确认工位）**：读取 SOUL.md、USER.md、TOOLS.md
2. **git log（查看变更）**：读取 memory/YYYY-MM-DD.md
3. **progress.txt（读取进度）**：读取 MEMORY.md
4. **introspect（自省评估）**：运行元灵自省系统 ⬅️ 新增
```

## 命令行使用

```bash
# 运行测试
cd humanoid-agent
npx ts-node src/introspection/__tests__/test-introspection.ts

# 查看最新报告
cat memory/introspection/reports/*.md | head -50
```

## 扩展测试用例

在 `benchmark-runner.ts` 中添加更多测试用例：

```typescript
this.testCases.set('understanding_accuracy', [
  // 添加新的测试用例
  { id: 'ua-11', input: '...', expectedIntent: '...', category: '...', difficulty: 'medium' },
]);
```

## 自定义维度

在 `types.ts` 中修改 `DIMENSION_CONFIGS`：

```typescript
export const DIMENSION_CONFIGS: Record<CapabilityDimension, DimensionConfig> = {
  // 修改权重、目标值等
  memory_recall: {
    name: '记忆召回率',
    weight: 0.15,  // 提高权重
    target: 90,    // 提高目标
    // ...
  },
};
```

---

*最后更新：2026-04-13*
