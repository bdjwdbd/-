# 原生模块构建指南

## 环境要求

- make 工具
- g++ 或 clang++ 编译器
- Python 3.x
- Node.js 18+

## 方案一：系统包管理器安装（推荐）

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y build-essential
```

### CentOS/RHEL/Huawei Cloud EulerOS

```bash
sudo yum groupinstall "Development Tools"
# 或
sudo dnf groupinstall "Development Tools"
```

### macOS

```bash
xcode-select --install
```

## 方案二：用户空间安装（无 root 权限）

如果当前环境没有 root 权限，可以：

### 1. 下载预编译的 make

```bash
# 下载 make 二进制
curl -L https://ftp.gnu.org/gnu/make/make-4.4.tar.gz -o make.tar.gz
tar xzf make.tar.gz
cd make-4.4
./configure --prefix=$HOME/.local
make
make install
export PATH=$HOME/.local/bin:$PATH
```

### 2. 使用 Docker 容器

```bash
# 创建构建容器
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  node:18 bash

# 在容器内构建
cd native
npm install
node-gyp rebuild
```

### 3. 使用 GitHub Actions 自动构建

创建 `.github/workflows/build-native.yml`:

```yaml
name: Build Native Modules

on: [push, pull_request]

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
          name: native-modules
          path: native/build/Release/*.node
```

## 方案三：使用预编译二进制

### 1. 从 Release 下载

如果项目有预编译的二进制文件：

```bash
# 下载对应平台的二进制
curl -L https://github.com/your-repo/releases/download/v1.0.0/native-modules-linux-x64.tar.gz -o native.tar.gz
tar xzf native.tar.gz -C native/build/Release/
```

### 2. 使用 node-pre-gyp

在 `package.json` 中配置：

```json
{
  "binary": {
    "module_name": "simd",
    "module_path": "./build/Release",
    "host": "https://your-bucket.s3.amazonaws.com"
  }
}
```

## 当前环境解决方案

当前环境是 **Huawei Cloud EulerOS**，用户 **sandbox** 无 sudo 权限。

### 推荐方案：使用 Docker

```bash
# 1. 拉取 Node.js 镜像
docker pull node:18

# 2. 挂载项目目录并构建
docker run -it --rm \
  -v /home/sandbox/.openclaw/workspace/humanoid-agent:/workspace \
  -w /workspace/native \
  node:18 \
  bash -c "apt-get update && apt-get install -y build-essential && npm install && node-gyp rebuild"

# 3. 构建产物会自动同步到 native/build/Release/
```

### 备选方案：请求管理员安装

联系系统管理员执行：

```bash
sudo yum groupinstall "Development Tools"
```

## 验证构建

```bash
# 检查构建产物
ls -la native/build/Release/*.node

# 运行测试
cd native
npm test
```

## 注意事项

1. **TypeScript 实现已完整可用**，原生模块只是性能优化
2. **自动降级机制**会在原生模块不可用时自动使用 TypeScript 实现
3. 原生模块预期性能提升：
   - SIMD: 4-8x
   - VNNI: 4-8x
   - GPU: 10-100x

---

*创建时间：2026-04-15*
