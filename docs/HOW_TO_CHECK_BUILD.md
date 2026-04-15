# 如何判断 GitHub Actions 构建完成

## 问题

当前 Token 缺少 `workflow` 权限，无法自动触发构建。

---

## 解决方案

### 方案一：创建有 workflow 权限的 Token

1. 访问 https://github.com/settings/tokens/new
2. 勾选权限：
   - ✅ **repo**
   - ✅ **workflow**（关键！）
3. 创建并复制 Token
4. 告诉我新 Token，我会重新推送

### 方案二：手动在 GitHub 上操作

1. 访问 https://github.com/bdjwdbd/-
2. 点击 **"Add file"** → **"Create new file"**
3. 文件路径输入：`.github/workflows/build-native.yml`
4. 复制以下内容：

```yaml
name: Build Native Modules

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: sudo apt-get update && sudo apt-get install -y build-essential
      - run: cd native && npm install && npx node-gyp rebuild
      - uses: actions/upload-artifact@v3
        with:
          name: native-linux-x64
          path: native/build/Release/*.node
```

5. 点击 **"Commit new file"**
6. 构建会自动开始

---

## 如何判断构建完成

### 步骤 1：访问 Actions 页面

访问：https://github.com/bdjwdbd/-/actions

### 步骤 2：查看构建状态

| 图标 | 状态 | 说明 |
|------|------|------|
| 🟡 黄色圆圈 | 运行中 | 正在构建 |
| ✅ 绿色勾号 | 成功 | 构建完成 |
| ❌ 红色叉号 | 失败 | 构建失败 |

### 步骤 3：下载构建产物

1. 点击成功的构建记录
2. 滚动到底部 **"Artifacts"** 区域
3. 点击 `native-linux-x64` 下载

---

## 构建时间

| 平台 | 预计时间 |
|------|---------|
| Linux | ~3 分钟 |
| macOS | ~5 分钟 |
| Windows | ~5 分钟 |

---

## 当前状态

| 项目 | 状态 |
|------|------|
| 代码推送 | ✅ 完成 |
| Workflow 文件 | ❌ 需要 workflow 权限 |
| 构建状态 | ⏳ 等待 workflow 文件 |

---

## 快速链接

- Actions 页面：https://github.com/bdjwdbd/-/actions
- 创建 Token：https://github.com/settings/tokens/new

---

*创建时间：2026-04-15*
