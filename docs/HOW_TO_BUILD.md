# 如何使用 GitHub Actions 构建原生模块

## 完整操作步骤

### 步骤 1：创建 GitHub 仓库

1. 访问 https://github.com/new
2. 填写仓库信息：
   - Repository name: `humanoid-agent`
   - Description: `元灵系统 - 多Agent协作框架`
   - 选择 Public 或 Private
3. 点击 "Create repository"

### 步骤 2：推送代码到 GitHub

```bash
# 进入项目目录
cd /home/sandbox/.openclaw/workspace/humanoid-agent

# 添加远程仓库（替换 YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/humanoid-agent.git

# 推送代码
git push -u origin main
```

### 步骤 3：等待 GitHub Actions 构建

1. 访问 https://github.com/YOUR_USERNAME/humanoid-agent/actions
2. 等待构建完成（约 5 分钟）
3. 构建成功后会显示绿色勾号 ✅

### 步骤 4：下载构建产物

**方法 A：使用 GitHub CLI**

```bash
# 安装 GitHub CLI（如果未安装）
# Ubuntu/Debian: sudo apt install gh
# macOS: brew install gh

# 登录 GitHub
gh auth login

# 下载 Linux 构建产物
gh run download --repo YOUR_USERNAME/humanoid-agent --name native-linux-x64

# 解压到正确位置
unzip native-linux-x64.zip -d native/build/Release/
```

**方法 B：手动下载**

1. 访问 https://github.com/YOUR_USERNAME/humanoid-agent/actions
2. 点击最新的成功构建
3. 滚动到底部 "Artifacts" 部分
4. 下载 `native-linux-x64`
5. 解压到 `native/build/Release/`

### 步骤 5：验证构建

```bash
# 检查构建产物
ls -la native/build/Release/*.node

# 测试原生模块
node -e "
const simd = require('./native/build/Release/simd.node');
console.log('SIMD 能力:', simd.getCapabilities());
console.log('✅ 原生模块工作正常！');
"
```

---

## 如果没有 GitHub 账号

### 替代方案 1：请求管理员安装编译工具

联系系统管理员执行：

```bash
sudo yum install gcc-c++ make
```

### 替代方案 2：使用 GitLab CI

如果你有 GitLab 账号：

1. 创建 `.gitlab-ci.yml`：

```yaml
build:
  image: node:18
  stage: build
  script:
    - apt-get update && apt-get install -y build-essential
    - cd native && npm install && npx node-gyp rebuild
  artifacts:
    paths:
      - native/build/Release/*.node
```

2. 推送到 GitLab
3. 下载构建产物

### 替代方案 3：使用本地 Docker

如果 Docker 可用：

```bash
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace/native \
  node:18 \
  bash -c "apt-get update && apt-get install -y build-essential && npm install && npx node-gyp rebuild"
```

---

## 当前状态

| 步骤 | 状态 |
|------|------|
| Git 初始化 | ✅ 完成 |
| 代码提交 | ✅ 完成 |
| GitHub Actions 配置 | ✅ 完成 |
| 推送到 GitHub | ⏳ 待执行 |
| 下载构建产物 | ⏳ 待执行 |

---

## 下一步

**你需要做的：**

1. 创建 GitHub 仓库
2. 运行以下命令：

```bash
cd /home/sandbox/.openclaw/workspace/humanoid-agent
git remote add origin https://github.com/YOUR_USERNAME/humanoid-agent.git
git push -u origin main
```

3. 等待 5 分钟后下载构建产物

---

*创建时间：2026-04-15*
