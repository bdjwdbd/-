# 获取编译环境方案

## 当前环境状态

| 项目 | 值 |
|------|-----|
| 操作系统 | Huawei Cloud EulerOS 2.0 |
| 包管理器 | yum / dnf |
| 当前用户 | sandbox |
| sudo 权限 | ❌ 无 |
| 网络工具 | ❌ ping 不可用 |

---

## 方案一：请求管理员安装（推荐）

联系系统管理员执行以下命令：

```bash
# 安装开发工具包
sudo yum groupinstall "Development Tools"

# 或使用 dnf
sudo dnf groupinstall "Development Tools"

# 验证安装
which make gcc g++
```

**优点**：最简单、最完整
**缺点**：需要管理员权限

---

## 方案二：使用 Docker 容器

如果 Docker 可用：

```bash
# 拉取带编译环境的镜像
docker pull gcc:latest

# 或使用 Node.js 镜像
docker pull node:18

# 挂载项目并编译
docker run -it --rm \
  -v /home/sandbox/.openclaw/workspace/humanoid-agent:/workspace \
  -w /workspace/native \
  node:18 \
  bash -c "apt-get update && apt-get install -y build-essential && npm install && node-gyp rebuild"
```

**优点**：无需系统权限
**缺点**：需要 Docker

---

## 方案三：用户空间安装 make

下载并编译 make 到用户目录：

```bash
# 创建本地目录
mkdir -p ~/.local/bin ~/.local/src

# 下载 make 源码
cd ~/.local/src
curl -L https://ftp.gnu.org/gnu/make/make-4.4.tar.gz -o make.tar.gz
tar xzf make.tar.gz
cd make-4.4

# 配置并编译（使用系统已有的 cc）
./configure --prefix=$HOME/.local
cc -o make *.c -DHAVE_CONFIG_H
cp make ~/.local/bin/

# 添加到 PATH
export PATH=$HOME/.local/bin:$PATH
echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc

# 验证
make --version
```

**优点**：无需 root
**缺点**：需要网络下载

---

## 方案四：使用预编译二进制

下载预编译的 make 和 gcc：

```bash
# 创建目录
mkdir -p ~/.local/bin

# 下载预编译的 make（从 EPEL 或其他源）
# 注意：需要找到适合 Huawei Cloud EulerOS 的二进制

# 或从其他机器复制
scp user@other-machine:/usr/bin/make ~/.local/bin/
scp user@other-machine:/usr/bin/gcc ~/.local/bin/
scp user@other-machine:/usr/bin/g++ ~/.local/bin/

# 添加执行权限
chmod +x ~/.local/bin/*

# 添加到 PATH
export PATH=$HOME/.local/bin:$PATH
```

**优点**：快速
**缺点**：需要另一台机器

---

## 方案五：使用 GitHub Actions 自动构建

创建 `.github/workflows/build-native.yml`：

```yaml
name: Build Native Modules

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install build tools
        run: sudo apt-get install -y build-essential
      
      - name: Build native modules
        run: |
          cd native
          npm install
          node-gyp rebuild
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: native-modules-linux-x64
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
          node-gyp rebuild
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: native-modules-darwin-x64
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
          node-gyp rebuild
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: native-modules-win32-x64
          path: native/build/Release/*.node
```

然后下载构建产物：

```bash
# 从 GitHub Actions 下载
gh run download --repo your-repo --name native-modules-linux-x64
```

**优点**：自动化、跨平台
**缺点**：需要 GitHub 仓库

---

## 方案六：使用 CI/CD 服务

使用免费的 CI/CD 服务自动构建：

### GitLab CI

```yaml
# .gitlab-ci.yml
build:
  image: node:18
  stage: build
  script:
    - apt-get update && apt-get install -y build-essential
    - cd native && npm install && node-gyp rebuild
  artifacts:
    paths:
      - native/build/Release/*.node
```

### CircleCI

```yaml
# .circleci/config.yml
version: 2.1
jobs:
  build:
    docker:
      - image: node:18
    steps:
      - checkout
      - run: apt-get update && apt-get install -y build-essential
      - run: cd native && npm install && node-gyp rebuild
      - store_artifacts:
          path: native/build/Release
```

---

## 推荐方案

根据当前环境，推荐顺序：

| 优先级 | 方案 | 可行性 | 说明 |
|--------|------|--------|------|
| 1 | 请求管理员安装 | ⭐⭐⭐⭐⭐ | 最简单，联系管理员执行 `yum groupinstall "Development Tools"` |
| 2 | GitHub Actions | ⭐⭐⭐⭐ | 自动化，推送到 GitHub 后自动构建 |
| 3 | 用户空间安装 | ⭐⭐⭐ | 需要网络下载源码 |
| 4 | 预编译二进制 | ⭐⭐ | 需要另一台机器 |

---

## 快速验证

安装后验证：

```bash
# 检查 make
make --version

# 检查 gcc
gcc --version

# 检查 g++
g++ --version

# 编译测试
cd /home/sandbox/.openclaw/workspace/humanoid-agent/native
npm install
node-gyp rebuild
```

---

*创建时间：2026-04-15*
