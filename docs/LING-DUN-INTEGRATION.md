# 灵盾层 (L4) - OpenClaw 集成指南

## 概述

灵盾层是元灵系统的第四层，负责在工具执行层面提供安全防护，防止无限循环和上下文爆炸。

## 核心功能

| 功能 | 说明 | 默认阈值 |
|------|------|---------|
| 循环检测 | 检测相同参数的重复调用 | 3 次自动中断 |
| 输出截断 | 限制输出长度 | 500 行 / 50000 字符 |
| 文件列表截断 | 检测文件列表模式 | 最多 100 项 |
| 强制中断 | 超时/超次自动终止 | 1000 次 / 10 分钟 |

## 集成方式

### 方式一：直接修改 OpenClaw 源码（推荐）

找到 OpenClaw 的工具执行入口，添加守卫：

```typescript
// 在 openclaw/src/runtime/tools/exec.ts 或类似文件中

import { getToolExecutionGuard } from './layers/ling-dun';

const guard = getToolExecutionGuard({
  enableLoopDetection: true,
  enableOutputTruncation: true,
  loopDetector: {
    interruptThreshold: 3,
    maxConsecutiveCalls: 5,
  },
  outputTruncator: {
    maxFileListItems: 100,
    maxOutputLines: 500,
  },
});

// 包装原有的执行函数
export async function executeTool(context: ToolContext): Promise<ToolResult> {
  const result = await guard.wrapExecutor(originalExecute)(context);
  
  if (!result.success && result.loopDetected) {
    // 记录循环事件
    logger.warn('检测到无限循环', {
      tool: context.toolName,
      reason: result.loopDetected.reason,
    });
  }
  
  return result;
}
```

### 方式二：使用 Monkey Patch（临时方案）

```typescript
import { initGuard, guardedExec } from './layers/ling-dun/openclaw-integration';

// 在 OpenClaw 启动后执行
initGuard();

// 替换全局 exec
globalThis._openclawExec = guardedExec;
```

### 方式三：作为 OpenClaw 插件

创建 OpenClaw 插件，在 `beforeToolCall` 钩子中注入：

```typescript
// plugins/loop-guard/index.ts
export default {
  name: 'loop-guard',
  hooks: {
    beforeToolCall: async (context) => {
      const guard = getToolExecutionGuard();
      const check = guard.preCheck(context);
      
      if (!check.allowed) {
        throw new Error(check.reason);
      }
      
      return context;
    },
    afterToolCall: async (context, result) => {
      const guard = getToolExecutionGuard();
      return guard.postProcess(context, result.content);
    },
  },
};
```

## 配置说明

```typescript
const config = {
  // 循环检测
  enableLoopDetection: true,
  loopDetector: {
    maxHistorySize: 100,        // 最多记录 100 次调用
    interruptThreshold: 3,       // 重复 3 次中断
    warningThreshold: 2,         // 重复 2 次警告
    timeWindowMs: 60000,         // 1 分钟时间窗口
    maxConsecutiveCalls: 5,      // 连续调用 5 次中断
  },
  
  // 输出截断
  enableOutputTruncation: true,
  outputTruncator: {
    maxOutputChars: 50000,       // 最大 50000 字符
    maxOutputLines: 500,         // 最大 500 行
    maxFileListItems: 100,       // 文件列表最多 100 项
    strategy: 'smart',           // 智能截断
  },
  
  // 强制中断
  enableForceInterrupt: true,
  maxCallsPerSession: 1000,      // 单会话最多 1000 次调用
  maxSessionDurationMs: 600000,  // 单会话最长 10 分钟
};
```

## 效果演示

### 之前（无限循环）

```
用户: 为什么会这样
系统: 正在使用工具: exec...
系统: 任务正在处理中，请稍候~
用户: 终止任务
系统: 新消息已接收，正在处理...
用户: /new
系统: 抱歉，系统刚才出了严重bug，命令重复执行了上百次。
      抱歉，系统刚才出了严重bug，命令重复执行了上百次。
      抱歉，系统刚才出了严重bug，命令重复执行了上百次。
      ...（重复上百次）
```

### 之后（自动中断）

```
用户: 为什么会这样
系统: 正在使用工具: exec...
[灵盾层] 检测到无限循环：工具 "exec" 被重复调用 3 次（相同参数）。已自动中断。
系统: ❌ 执行被阻止：检测到无限循环，已自动中断以防止系统崩溃。
      建议检查命令是否正确，或尝试使用更精确的参数。
```

## 文件结构

```
humanoid-agent/src/layers/ling-dun/
├── LoopDetector.ts          # 循环检测器
├── OutputTruncator.ts       # 输出截断器
├── ToolExecutionGuard.ts    # 工具执行守卫（主入口）
├── openclaw-integration.ts  # OpenClaw 集成
└── index.ts                 # 导出入口
```

## 测试

```bash
# 运行单元测试
cd humanoid-agent
npm test -- --grep "ling-dun"

# 手动测试
npx ts-node src/layers/ling-dun/test.ts
```

## 注意事项

1. **性能影响**：循环检测会增加约 1-2ms 的延迟，可忽略不计
2. **误报处理**：如果某些场景需要重复调用，可以临时禁用：
   ```typescript
   guard.updateConfig({ enableLoopDetection: false });
   ```
3. **会话重置**：`/new` 命令后应调用 `resetSession()` 清理状态

## 后续优化

- [ ] 支持自定义循环检测策略
- [ ] 添加白名单机制
- [ ] 集成到 OpenClaw 官方版本
- [ ] 添加 Prometheus 指标

---

*最后更新：2026-04-14*
