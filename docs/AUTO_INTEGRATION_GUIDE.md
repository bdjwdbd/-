# 新模块自动集成指南

## 🎯 问题

创建新模块后，需要手动完成以下步骤：

1. 在 `yuanling-system.ts` 中导入模块
2. 添加私有实例
3. 添加访问器方法
4. 添加初始化方法
5. 在 `startup()` 中调用初始化方法
6. 更新 `check-integration.js`

**这些步骤繁琐且容易遗漏。**

---

## ✅ 解决方案

### 方式一：自动集成脚本（推荐）

```bash
# 创建新模块后，运行自动集成脚本
npm run integrate <模块名> <导入路径> <类型名>

# 示例
npm run integrate MyModule ./my-module MyModuleClass
```

**自动完成**：
- ✅ 自动导入模块
- ✅ 自动添加实例
- ✅ 自动添加访问器
- ✅ 自动添加初始化方法
- ✅ 自动添加到 startup()

---

### 方式二：手动集成

如果需要更精细的控制，可以手动集成：

#### 1. 导入模块

```typescript
// 在 yuanling-system.ts 顶部添加
import { MyModuleClass } from './my-module';
```

#### 2. 添加实例

```typescript
// 在类定义中添加
private _myModuleClass?: MyModuleClass;
```

#### 3. 添加访问器

```typescript
/** 获取 MyModule */
get myModuleClass(): MyModuleClass | undefined {
  return this._myModuleClass;
}
```

#### 4. 添加初始化方法

```typescript
/**
 * 初始化 MyModule
 */
initializeMyModuleClass(): MyModuleClass {
  if (this._myModuleClass) {
    return this._myModuleClass;
  }
  
  this._myModuleClass = new MyModuleClass();
  console.log('[YuanLing] MyModule 已初始化');
  return this._myModuleClass;
}
```

#### 5. 添加到 startup()

```typescript
async startup() {
  // ...
  
  // 自动初始化新模块
  this.initializeMyModuleClass();
  
  // ...
}
```

#### 6. 更新检查脚本

在 `scripts/check-integration.js` 中添加：

```javascript
{
  name: 'MyModuleClass',
  importPattern: /MyModuleClass/,
  usagePattern: /this\._myModuleClass|initializeMyModuleClass/,
  location: 'yuanling-system.ts',
},
```

---

## 📊 验证集成

```bash
# 检查模块是否已集成
npm run check:integration

# 完整检查（导出 + 集成 + 编译）
npm run check:all
```

---

## 🔄 CI 自动检查

每次 push 或 PR 时，CI 会自动检查：

- 模块导出
- 模块集成
- TypeScript 编译

**如果有模块未集成，CI 会失败。**

---

## 📋 总结

| 方式 | 优点 | 缺点 |
|------|------|------|
| **自动集成** | 快速、不易出错 | 灵活性较低 |
| **手动集成** | 灵活、可控 | 繁琐、易遗漏 |

**推荐使用自动集成脚本，然后根据需要手动调整。**

---

*版本: v4.9.0*
*更新时间: 2026-04-16*
