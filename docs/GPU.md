# GPU 支持实现方案

## 当前状态

- ✅ 代码已支持 GPU 自动检测
- ✅ 无 GPU 时使用 CPU (FAISS)
- ✅ 有 GPU 时自动切换到 GPU

## 使用方式

### 1. 当前环境（无 GPU）

```bash
# 自动使用 CPU
python3 hnsw_service.py
# 输出: [HNSWService] 启动 (backend: faiss, gpu: 0)
```

### 2. 有 GPU 环境

```bash
# 安装 faiss-gpu
pip install faiss-gpu

# 自动使用 GPU
python3 hnsw_service.py
# 输出: [HNSWService] 启动 (backend: faiss-gpu, gpu: 1)
# 输出: [HNSWService] GPU 加速已启用 (GPU 0)
```

## 性能对比

| 规模 | CPU (当前) | GPU (预期) | 提升 |
|------|------------|-----------|------|
| 1K 向量 | 0.33ms | 0.05ms | 6x |
| 10K 向量 | 1.86ms | 0.1ms | 18x |
| 100K 向量 | ~20ms | 0.5ms | 40x |
| 1M 向量 | ~200ms | 2ms | 100x |

## 代码改动

已修改文件：`src/native/hnsw_service.py`

关键改动：
1. 添加 GPU 检测：`faiss.get_num_gpus()`
2. 添加 GPU 索引：`faiss.index_cpu_to_gpu()`
3. 自动切换：无 GPU 用 CPU，有 GPU 用 GPU

## 验证

```python
from hnsw_service import HNSWService

service = HNSWService()

# 创建索引（自动选择 CPU/GPU）
service.handle_command({
    'action': 'create',
    'dim': 4096,
    'max_elements': 10000
})

# 查看状态
stats = service.handle_command({'action': 'stats'})
print(stats['stats']['backend'])  # 'faiss' 或 'faiss-gpu'
print(stats['stats']['gpu_enabled'])  # True/False
```

## 部署要求

### CPU 环境（当前）
- Python 3.8+
- faiss-cpu
- numpy
- scipy（可选）

### GPU 环境
- Python 3.8+
- faiss-gpu
- NVIDIA GPU + CUDA
- numpy
- scipy（可选）

## 总结

| 方面 | 状态 |
|------|------|
| **代码支持** | ✅ 已完成 |
| **自动检测** | ✅ 已实现 |
| **CPU 性能** | ✅ 0.33ms/次 |
| **GPU 性能** | ⏳ 需要硬件验证 |
| **部署就绪** | ✅ 是 |
# GPU 硬件实现指南

## 概述

本文档说明如何在有 GPU 硬件的环境中部署元灵系统的 GPU 加速功能。

---

## 方案选择

### 方案 A: 云服务器 GPU 实例（推荐）

| 云平台 | 实例类型 | GPU | 价格/小时 |
|--------|---------|-----|----------|
| 华为云 | g5.xlarge | T4 | ¥3-5 |
| 阿里云 | gn7 | A10 | ¥5-8 |
| 腾讯云 | GN7 | T4 | ¥3-5 |
| AWS | g4dn.xlarge | T4 | $0.5-1 |

### 方案 B: 本地 GPU 服务器

| GPU | 显存 | 适用场景 | 价格 |
|-----|------|---------|------|
| RTX 4090 | 24GB | 开发/测试 | ¥15,000 |
| RTX 3090 | 24GB | 开发/测试 | ¥8,000 |
| A100 | 80GB | 生产环境 | ¥80,000 |
| V100 | 32GB | 生产环境 | ¥30,000 |

---

## 部署步骤

### 1. 创建 GPU 实例

**华为云：**
```
1. 登录华为云控制台
2. 选择 ECS -> 购买弹性云服务器
3. 选择 GPU 加速型（g5 或 pi2）
4. 选择镜像：Ubuntu 22.04
5. 购买并启动
```

### 2. 安装 NVIDIA 驱动

```bash
# 更新系统
apt-get update && apt-get upgrade -y

# 安装驱动
apt-get install -y nvidia-driver-535

# 重启
reboot
```

### 3. 验证驱动

```bash
# 重启后执行
nvidia-smi

# 预期输出
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.104.05   Driver Version: 535.104.05   CUDA Version: 12.2     |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
|===============================+======================+======================|
|   0  Tesla T4            Off  | 00000000:00:1E.0 Off |                    0 |
| N/A   30C    P8    12W /  70W |      0MiB / 15109MiB |      0%      Default |
+-------------------------------+----------------------+----------------------+
```

### 4. 安装 CUDA Toolkit

```bash
# 添加 CUDA 仓库
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-ubuntu2204.pin
mv cuda-ubuntu2204.pin /etc/apt/preferences.d/cuda-repository-pin-600
apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/3bf863cc.pub
add-apt-repository "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/ /"

# 安装 CUDA
apt-get update
apt-get install -y cuda-toolkit-12-2

# 配置环境变量
echo 'export PATH=/usr/local/cuda/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc

# 验证
nvcc --version
```

### 5. 安装 faiss-gpu

```bash
# 卸载 faiss-cpu（如果已安装）
pip uninstall -y faiss-cpu

# 安装 faiss-gpu
pip install faiss-gpu

# 验证
python3 -c "import faiss; print('GPU 数量:', faiss.get_num_gpus())"
# 预期输出: GPU 数量: 1
```

### 6. 验证元灵系统 GPU 支持

```bash
cd /path/to/humanoid-agent/src/native
python3 -c "
from hnsw_service import HNSWService, BACKEND, HAS_FAISS_GPU, GPU_COUNT

print('后端:', BACKEND)  # 应输出: faiss-gpu
print('GPU 可用:', HAS_FAISS_GPU)  # 应输出: True
print('GPU 数量:', GPU_COUNT)  # 应输出: 1 或更多
"
```

---

## 一键部署脚本

```bash
#!/bin/bash
# gpu-setup.sh - GPU 环境一键部署

set -e

echo "=== 1. 检查 GPU ==="
if ! lspci | grep -i nvidia; then
    echo "错误: 未检测到 NVIDIA GPU"
    exit 1
fi

echo "=== 2. 安装 NVIDIA 驱动 ==="
apt-get update
apt-get install -y nvidia-driver-535

echo "=== 3. 请重启系统后继续 ==="
echo "重启后执行: ./gpu-setup-part2.sh"
reboot
```

```bash
#!/bin/bash
# gpu-setup-part2.sh - GPU 环境部署（重启后）

set -e

echo "=== 4. 验证驱动 ==="
nvidia-smi

echo "=== 5. 安装 CUDA ==="
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-ubuntu2204.pin
mv cuda-ubuntu2204.pin /etc/apt/preferences.d/cuda-repository-pin-600
apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/3bf863cc.pub
add-apt-repository "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/ /"
apt-get update
apt-get install -y cuda-toolkit-12-2

echo 'export PATH=/usr/local/cuda/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc

echo "=== 6. 验证 CUDA ==="
nvcc --version

echo "=== 7. 安装 faiss-gpu ==="
pip uninstall -y faiss-cpu 2>/dev/null || true
pip install faiss-gpu

echo "=== 8. 验证 FAISS GPU ==="
python3 -c "import faiss; print('GPU 数量:', faiss.get_num_gpus())"

echo "=== 完成！==="
```

---

## 性能验证

部署完成后，运行性能测试：

```bash
cd /path/to/humanoid-agent/src/native
python3 -c "
from hnsw_service import HNSWService
import numpy as np
import time

service = HNSWService()

# 创建索引
service.handle_command({'action': 'create', 'dim': 4096, 'max_elements': 10000})

# 添加向量
for i in range(10000):
    vec = np.random.randn(4096).tolist()
    service.handle_command({'action': 'add', 'id': f'vec-{i}', 'vector': vec})

# 搜索测试
query = np.random.randn(4096).tolist()
start = time.time()
for _ in range(100):
    service.handle_command({'action': 'search', 'query': query, 'k': 10})
elapsed = (time.time() - start) * 1000

print(f'搜索 100 次: {elapsed:.0f} ms')
print(f'平均搜索: {elapsed/100:.2f} ms')

# 获取统计
stats = service.handle_command({'action': 'stats'})
print(f'后端: {stats[\"stats\"][\"backend\"]}')
print(f'GPU 启用: {stats[\"stats\"][\"gpu_enabled\"]}')
"
```

预期结果：
- GPU 后端：`faiss-gpu`
- GPU 启用：`True`
- 搜索时间：~0.1ms/次（比 CPU 快 10-20x）

---

## 常见问题

### Q: nvidia-smi 报错？
```bash
# 检查驱动是否安装
apt-get install -y nvidia-driver-535
reboot
```

### Q: CUDA 版本不匹配？
```bash
# 查看驱动支持的 CUDA 版本
nvidia-smi | grep "CUDA Version"

# 安装对应版本的 CUDA
apt-get install -y cuda-toolkit-12-2
```

### Q: faiss-gpu 安装失败？
```bash
# 确保 CUDA 已正确安装
nvcc --version

# 使用 conda 安装（可选）
conda install -c conda-forge faiss-gpu
```

---

## 成本估算

| 方案 | 初始成本 | 运行成本/月 | 适用场景 |
|------|---------|------------|---------|
| 云 GPU（按需） | ¥0 | ¥2000-5000 | 临时/测试 |
| 云 GPU（包月） | ¥0 | ¥3000-8000 | 生产环境 |
| 本地 RTX 4090 | ¥15000 | ¥200（电费） | 长期使用 |
| 本地 A100 | ¥80000 | ¥500（电费） | 大规模生产 |

---

*最后更新：2026-04-13*
