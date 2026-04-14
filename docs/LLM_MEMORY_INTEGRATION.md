# LLM Memory Integration 融合文档

## 融合策略

采用**适配器模式**，确保不影响元灵系统核心功能：

```
┌─────────────────────────────────────────────────────────┐
│                    元灵系统                              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              MemoryCenterV2                      │   │
│  │   (原有功能完全保留)                              │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                          │ 可选增强                     │
│                          ↓                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │         LLMMemoryIntegrationAdapter              │   │
│  │   (适配器，不修改核心代码)                        │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
└──────────────────────────│──────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│           llm-memory-integration Skill                   │
│                                                         │
│  src/scripts/                                           │
│  ├── hybrid_memory_search.py    # 混合搜索              │
│  ├── update_persona.py          # 用户画像更新          │
│  ├── check_coverage.py          # 向量覆盖检查          │
│  ├── llm_client.py              # LLM 客户端            │
│  └── ...                                                │
└─────────────────────────────────────────────────────────┘
```

## 功能映射

| llm-memory-integration | 元灵系统适配 | 说明 |
|------------------------|-------------|------|
| `hybrid_memory_search.py` | `LLMMemoryIntegrationAdapter.hybridSearch()` | 混合搜索 |
| `update_persona.py` | `LLMMemoryIntegrationAdapter.updatePersona()` | 用户画像更新 |
| `check_coverage.py` | `LLMMemoryIntegrationAdapter.checkVectorCoverage()` | 向量覆盖检查 |
| `llm_client.py` | 内部使用 | LLM 调用 |

## 使用方式

### 1. 独立使用（推荐）

```typescript
import { LLMMemoryIntegrationAdapter } from './llm-memory-adapter';

const adapter = new LLMMemoryIntegrationAdapter({
  embeddingApiKey: 'your-api-key',
  llmApiKey: 'your-api-key',
});

await adapter.initialize();

// 混合搜索
const results = await adapter.hybridSearch({
  query: '元灵系统',
  limit: 10,
  useVector: true,
  useKeyword: true,
});

// 用户画像更新
const updateResult = await adapter.updatePersona();

// 向量覆盖检查
const coverage = await adapter.checkVectorCoverage();
```

### 2. 与元灵系统集成（可选）

```typescript
import { MemoryCenterV2 } from './core/memory-center-v2';
import { LLMMemoryIntegrationAdapter } from './llm-memory-adapter';

// 原有元灵系统记忆中心
const memoryCenter = new MemoryCenterV2({ backendType: 'tencentdb' });

// 可选：LLM Memory Integration 增强搜索
const llmMemory = new LLMMemoryIntegrationAdapter();
const enhancedSearch = llmMemory.createMemoryCenterCompatible();

// 使用增强搜索
const results = await enhancedSearch.hybridRecall('查询内容');
```

## 安全说明

1. **独立运行**：llm-memory-integration 作为独立 Skill 运行
2. **适配器隔离**：通过适配器模式，不修改元灵系统核心代码
3. **可选使用**：所有功能都是可选的，不影响原有功能
4. **配置独立**：配置文件独立存储，不覆盖元灵系统配置

## 安装依赖

```bash
pip install pysqlite3-binary aiosqlite
```

## 版本信息

- **llm-memory-integration**: v3.5.1
- **适配器版本**: v1.0.0
- **融合日期**: 2026-04-13
