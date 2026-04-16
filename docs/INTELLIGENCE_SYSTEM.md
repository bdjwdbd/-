# 全智能系统

## 🎯 功能说明

系统现在支持**全智能处理**，用户只需要说一句话，系统自动完成：

1. **意图识别** - 理解用户真正想做什么
2. **工具选择** - 自动选择合适的工具
3. **Skill 发现** - 自动发现和调用 Skill
4. **模块启动** - 自动启动需要的模块
5. **任务编排** - 自动编排执行步骤

---

## 📊 使用方式

### 方式一：全智能处理（推荐）

```typescript
const system = new YuanLingSystem();
await system.startup();

// 用户只需要说一句话
const result = await system.processIntelligently("帮我搜索一下最新的 AI 新闻");

// 系统自动完成：
// 1. 意图识别: search
// 2. 工具选择: xiaoyi-web-search
// 3. Skill 发现: xiaoyi-web-search, deep-search-and-insight-synthesize
// 4. 模块启动: (自动启动需要的模块)
// 5. 任务编排: 生成执行计划
```

### 方式二：单独使用智能组件

```typescript
// 意图识别
const intent = await system.intelligence.getIntentEngine().analyze(message);

// 工具匹配
const tools = system.intelligence.getToolMatcher().match(intent.primary);

// Skill 发现
const skills = system.intelligence.getSkillDiscovery().discover(intent.primary);

// 任务编排
const plan = system.intelligence.getTaskOrchestrator().createPlan(intent, tools, skills);
```

---

## 🎯 支持的意图类型

| 意图类型 | 说明 | 示例指令 |
|---------|------|---------|
| **search** | 搜索信息 | "帮我搜索一下最新的 AI 新闻" |
| **create** | 创建内容 | "创建一篇关于元灵系统的文章" |
| **analyze** | 分析数据 | "分析这个 Excel 文件的数据" |
| **monitor** | 监控状态 | "监控一下系统状态" |
| **communicate** | 发送消息 | "发送消息给张三" |
| **schedule** | 日程安排 | "创建一个明天下午3点的会议" |
| **remind** | 提醒事项 | "提醒我每天早上8点起床" |
| **execute** | 执行命令 | "执行 npm install 命令" |
| **deploy** | 部署应用 | "部署应用到 Vercel" |
| **optimize** | 优化系统 | "优化一下系统性能" |
| **introspect** | 自省检查 | "检查系统健康状态" |

---

## 📈 测试结果

```
📝 测试: "帮我搜索一下最新的 AI 新闻"
  意图: search
  置信度: 77%
  建议工具: xiaoyi-web-search, search_photo_gallery, search_contact
  建议 Skills: xiaoyi-web-search, find-skills, deep-search-and-insight-synthesize
  执行步骤: 2 步

📝 测试: "创建一篇关于元灵系统的文章"
  意图: create
  置信度: 63%
  建议工具: create_note, write
  建议 Skills: article-writer, pptx, copywriter
  执行步骤: 2 步

📝 测试: "监控一下系统状态"
  意图: query
  置信度: 65%
  建议工具: xiaoyi-web-search, search_calendar_event, search_photo_gallery
  建议 Skills: xiaoyi-web-search, Excel Analysis, multi-search-engine
  建议模块: dashboard, health-monitor, harness
  执行步骤: 1 步
```

---

## 🔧 核心组件

### 1. 意图识别引擎 (IntentEngine)

- 语义理解（不是简单的关键词匹配）
- 多意图识别（一句话可能包含多个意图）
- 意图优先级排序

### 2. 工具匹配器 (ToolMatcher)

- 工具能力描述
- 工具匹配算法
- 工具优先级排序

### 3. Skill 发现器 (SkillDiscovery)

- Skill 能力描述
- Skill 匹配算法
- Skill 优先级排序

### 4. 任务编排器 (TaskOrchestrator)

- 任务分解
- 依赖分析
- 执行计划生成
- 并行/串行执行

---

## 📁 文件结构

```
src/intelligence/
├── intent-engine.ts      # 意图识别引擎
├── tool-matcher.ts       # 工具匹配器
├── skill-discovery.ts    # Skill 发现器
├── task-orchestrator.ts  # 任务编排器
├── index.ts              # 统一入口
└── __tests__/
    └── intelligence.test.ts  # 测试文件
```

---

## 📊 对比

| 场景 | 之前 | 现在 |
|------|------|------|
| 你说"帮我搜索一下" | 需要手动选择工具 | ✅ 自动选择 xiaoyi-web-search |
| 你说"创建一篇文章" | 需要手动调用 Skill | ✅ 自动发现 article-writer |
| 你说"监控一下系统" | 需要手动启动 Dashboard | ✅ 自动启动 Dashboard |
| 你说"优化一下性能" | 需要手动选择模块 | ✅ 自动启动 entropy-governor |

---

*版本: v4.9.0*
*更新时间: 2026-04-16*
