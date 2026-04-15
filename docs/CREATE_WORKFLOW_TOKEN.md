# 创建正确的 Token

## 问题

当前 Token 只有 `repo` 权限，缺少 `workflow` 权限，无法推送 workflow 文件。

---

## 解决步骤

### 步骤 1：创建新 Token

访问：https://github.com/settings/tokens/new

### 步骤 2：勾选权限

**必须同时勾选：**
- ✅ **repo**（完整仓库权限）
- ✅ **workflow**（工作流权限）

### 步骤 3：创建并复制

点击 "Generate token"，然后复制 Token。

---

## 权限对比

| Token | repo | workflow | 能否推送 workflow |
|-------|------|----------|------------------|
| 第一个 | ❌ | ❌ | ❌ |
| 第二个 | ✅ | ❌ | ❌ |
| **需要** | ✅ | ✅ | ✅ |

---

## 快速链接

- 创建 Token：https://github.com/settings/tokens/new
- 查看现有 Token：https://github.com/settings/tokens

---

**请创建一个同时勾选 `repo` 和 `workflow` 的 Token。**
