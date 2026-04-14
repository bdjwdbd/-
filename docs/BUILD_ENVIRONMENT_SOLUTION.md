# 编译环境解决方案

## 当前环境状态

| 项目 | 状态 |
|------|------|
| 操作系统 | Huawei Cloud EulerOS 2.0 |
| GCC | ✅ 10.3.1 (仅 C) |
| G++ | ❌ 未安装 |
| make | ❌ 未安装 |
| sudo 权限 | ❌ 无 |

## 问题分析

当前环境有 GCC 但只能编译 C 语言，无法编译 C++ 代码。需要安装 `gcc-c++` 包。

---

## 方案一：请求管理员安装（推荐）

联系系统管理员执行：

```bash
sudo yum install gcc-c++ make
```

这是最简单、最可靠的方案。

---

## 方案二：使用 GitHub Actions 自动构建

### 步骤 1：创建 GitHub 仓库

```bash
# 初始化 Git 仓库
cd /home/sandbox/.openclaw/workspace/humanoid-agent
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/humanoid-agent.git
git push -u origin main
```

### 步骤 2：创建 GitHub Actions 工作流

创建文件 `.github/workflows/build-native.yml`：

```yaml
name: Build Native Modules

on:
  push:
    branches: [main]
  pull_request:
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
      
      - name: Install build tools
        run: |
          sudo apt-get update
          sudo apt-get install -y build-essential
      
      - name: Build native modules
        run: |
          cd native
          npm install
          npx node-gyp rebuild
      
      - name: Upload Linux artifacts
        uses: actions/upload-artifact@v3
        with:
          name: native-linux-x64
          path: native/build/Release/*.node

  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build native modules
        run: |
          cd native
          npm install
          npx node-gyp rebuild
      
      - name: Upload macOS artifacts
        uses: actions/upload-artifact@v3
        with:
          name: native-darwin-x64
          path: native/build/Release/*.node

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build native modules
        run: |
          cd native
          npm install
          npx node-gyp rebuild
      
      - name: Upload Windows artifacts
        uses: actions/upload-artifact@v3
        with:
          name: native-win32-x64
          path: native/build/Release/*.node
```

### 步骤 3：下载构建产物

```bash
# 推送代码后，等待 GitHub Actions 完成
# 然后下载构建产物

# 使用 GitHub CLI
gh run download --repo YOUR_USERNAME/humanoid-agent --name native-linux-x64

# 或手动下载
# https://github.com/YOUR_USERNAME/humanoid-agent/actions
```

### 步骤 4：部署到当前环境

```bash
# 解压并复制到正确位置
unzip native-linux-x64.zip -d native/build/Release/
```

---

## 方案三：使用 Docker（如果可用）

如果 Docker 可用：

```bash
# 拉取带编译环境的镜像
docker pull gcc:latest

# 编译
docker run -it --rm \
  -v /home/sandbox/.openclaw/workspace/humanoid-agent:/workspace \
  -w /workspace/native \
  gcc:latest \
  bash -c "
    apt-get update && apt-get install -y nodejs npm &&
    npm install -g node-gyp &&
    npm install &&
    node-gyp rebuild
  "
```

---

## 方案四：使用在线编译服务

### 使用 CircleCI

创建 `.circleci/config.yml`：

```yaml
version: 2.1

jobs:
  build:
    docker:
      - image: node:18
    steps:
      - checkout
      - run:
          name: Install build tools
          command: |
            apt-get update
            apt-get install -y build-essential
      - run:
          name: Build native modules
          command: |
            cd native
            npm install
            npx node-gyp rebuild
      - store_artifacts:
          path: native/build/Release
          destination: native-modules

workflows:
  version: 2
  build:
    jobs:
      - build
```

---

## 方案五：使用预编译二进制

### 从其他机器编译后复制

如果你有另一台 Linux 机器：

```bash
# 在有编译环境的机器上
cd humanoid-agent/native
npm install
npx node-gyp rebuild

# 打包
tar czf native-modules.tar.gz build/Release/*.node

# 传输到当前机器
scp native-modules.tar.gz sandbox@current-machine:/home/sandbox/.openclaw/workspace/humanoid-agent/native/

# 在当前机器解压
cd /home/sandbox/.openclaw/workspace/humanoid-agent/native
tar xzf native-modules.tar.gz
```

---

## 推荐方案

根据当前环境，推荐顺序：

| 优先级 | 方案 | 可行性 | 说明 |
|--------|------|--------|------|
| 1 | 请求管理员安装 | ⭐⭐⭐⭐⭐ | 最简单，一条命令 |
| 2 | GitHub Actions | ⭐⭐⭐⭐ | 自动化，需要 GitHub |
| 3 | Docker | ⭐⭐⭐ | 需要 Docker |
| 4 | 预编译二进制 | ⭐⭐ | 需要另一台机器 |

---

## 快速开始（GitHub Actions）

```bash
# 1. 创建 GitHub 仓库
cd /home/sandbox/.openclaw/workspace/humanoid-agent
git init
git add .
git commit -m "Add native module build"

# 2. 推送到 GitHub
git remote add origin https://github.com/YOUR_USERNAME/humanoid-agent.git
git push -u origin main

# 3. 等待 Actions 完成（约 5 分钟）

# 4. 下载构建产物
gh run download --name native-linux-x64

# 5. 验证
ls -la native/build/Release/*.node
```

---

## 重要提醒

**TypeScript 实现已完整可用！编译原生模块只是为了获得更高性能。**

| 方案 | 性能 | 可用性 |
|------|------|--------|
| TypeScript | 30-70% | ✅ 立即可用 |
| C++ 原生模块 | 100% | ⚠️ 需要编译 |

---

*创建时间：2026-04-15*
