# 贡献指南

感谢您对元灵系统的关注！我们欢迎所有形式的贡献。

## 🤝 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议：

1. 在 [Issues](https://github.com/bdjwbdb/humanoid-agent/issues) 中搜索是否已有相关问题
2. 如果没有，创建新的 Issue，包含：
   - 清晰的标题
   - 详细的描述
   - 复现步骤（如果是 bug）
   - 预期行为和实际行为

### 提交代码

1. **Fork 仓库**
   ```bash
   git clone https://github.com/YOUR_USERNAME/humanoid-agent.git
   cd humanoid-agent
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **进行开发**
   - 遵循现有的代码风格
   - 添加必要的测试
   - 更新相关文档

5. **运行测试**
   ```bash
   # 类型检查
   pnpm typecheck
   
   # 运行测试
   pnpm test:all
   
   # 代码检查
   pnpm lint
   ```

6. **提交代码**
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 描述您的更改
   - 关联相关的 Issue
   - 等待代码审查

## 📝 代码规范

### TypeScript

- 使用 TypeScript 编写所有代码
- 启用严格模式 (`strict: true`)
- 为所有公共 API 添加类型注释
- 避免使用 `any`，使用 `unknown` 或具体类型

### 命名约定

- **文件名**: kebab-case (例如: `yuanling-system.ts`)
- **类名**: PascalCase (例如: `YuanLingSystem`)
- **函数/方法**: camelCase (例如: `processMessage`)
- **常量**: UPPER_SNAKE_CASE (例如: `DEFAULT_CONFIG`)
- **接口**: PascalCase，不加 `I` 前缀 (例如: `Message`)

### 注释

- 为所有公共 API 添加 JSDoc 注释
- 使用中文注释
- 复杂逻辑添加行内注释

```typescript
/**
 * 处理用户消息
 * 
 * @param message - 用户消息内容
 * @param context - 处理上下文
 * @returns 处理结果
 */
async processMessage(message: string, context: Context): Promise<Result> {
  // 实现代码
}
```

### 测试

- 为新功能添加单元测试
- 测试文件放在 `__tests__` 目录
- 测试文件命名: `*.test.ts`
- 使用描述性的测试名称

```typescript
describe('YuanLingSystem', () => {
  it('应该正确处理基本消息', async () => {
    // 测试代码
  });
});
```

## 🏗️ 项目结构

```
humanoid-agent/
├── src/
│   ├── yuanling-system.ts    # 主系统
│   ├── layers/               # 六层架构
│   │   ├── ling-si/         # L0 灵思层
│   │   ├── ling-shu/        # L1 灵枢层
│   │   ├── ling-mai/        # L2 灵脉层
│   │   ├── ling-qu/         # L3 灵躯层
│   │   ├── ling-dun/        # L4 灵盾层
│   │   └── ling-yun/        # L5 灵韵层
│   ├── harness/             # Harness Engineering
│   ├── intelligence/        # 智能系统
│   └── ...
├── docs/                    # 文档
├── examples/                # 示例代码
└── scripts/                 # 工具脚本
```

## 📚 文档

- 更新相关文档
- API 变更需要更新 `docs/API.md`
- 新功能需要更新 `docs/CHANGELOG.md`
- 架构变更需要更新 `docs/ARCHITECTURE.md`

## 🔍 代码审查

所有 PR 都需要经过代码审查：

1. 确保所有 CI 检查通过
2. 至少需要一位维护者批准
3. 解决所有审查意见

## 📜 许可证

提交代码即表示您同意您的贡献将根据 MIT 许可证授权。

---

再次感谢您的贡献！🎉
