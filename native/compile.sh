#!/bin/bash
# 元灵系统原生模块编译脚本
# 无需 make，直接使用 gcc 编译

set -e

echo "========================================"
echo "  元灵系统原生模块编译"
echo "========================================"

# 设置变量
PROJECT_DIR="/home/sandbox/.openclaw/workspace/humanoid-agent"
NATIVE_DIR="$PROJECT_DIR/native"
BUILD_DIR="$NATIVE_DIR/build/Release"
INCLUDE_DIR="$PROJECT_DIR/node_modules/.pnpm/node-addon-api@7.1.1/node_modules/node-addon-api"

# 创建构建目录
mkdir -p "$BUILD_DIR"

echo ""
echo "【1. 检查环境】"
echo "GCC: $(gcc --version | head -1)"
echo "Node.js: $(node --version)"
echo ""

echo "【2. 编译 SIMD 模块】"
# 编译 simd.cc
g++ -shared -fPIC \
    -std=c++17 \
    -mavx512f -mavx512vl -mavx512dq -mavx512bw -mavx512vnni \
    -I"$INCLUDE_DIR" \
    -DNAPI_DISABLE_CPP_EXCEPTIONS \
    "$NATIVE_DIR/src/simd.cc" \
    -o "$BUILD_DIR/simd.node" \
    2>&1 || echo "⚠️ SIMD 编译失败（可能不支持 AVX-512）"

# 如果 AVX-512 失败，尝试 AVX2
if [ ! -f "$BUILD_DIR/simd.node" ]; then
    echo "尝试 AVX2 编译..."
    g++ -shared -fPIC \
        -std=c++17 \
        -mavx2 -mfma \
        -I"$INCLUDE_DIR" \
        -DNAPI_DISABLE_CPP_EXCEPTIONS \
        "$NATIVE_DIR/src/simd.cc" \
        -o "$BUILD_DIR/simd.node" \
        2>&1 || echo "⚠️ AVX2 编译也失败"
fi

echo ""
echo "【3. 编译 Memory 模块】"
g++ -shared -fPIC \
    -std=c++17 \
    -I"$INCLUDE_DIR" \
    -DNAPI_DISABLE_CPP_EXCEPTIONS \
    "$NATIVE_DIR/src/memory.cc" \
    -o "$BUILD_DIR/memory.node" \
    2>&1 || echo "⚠️ Memory 编译失败"

echo ""
echo "【4. 编译 VectorOps 模块】"
g++ -shared -fPIC \
    -std=c++17 \
    -mavx2 -mfma \
    -I"$INCLUDE_DIR" \
    -DNAPI_DISABLE_CPP_EXCEPTIONS \
    "$NATIVE_DIR/src/vector_ops.cc" \
    -o "$BUILD_DIR/vector_ops.node" \
    2>&1 || echo "⚠️ VectorOps 编译失败"

echo ""
echo "【5. 编译 VNNI 模块】"
g++ -shared -fPIC \
    -std=c++17 \
    -mavx512f -mavx512vnni \
    -I"$INCLUDE_DIR" \
    -DNAPI_DISABLE_CPP_EXCEPTIONS \
    "$NATIVE_DIR/src/vnni.cc" \
    -o "$BUILD_DIR/vnni.node" \
    2>&1 || echo "⚠️ VNNI 编译失败（可能不支持 VNNI）"

echo ""
echo "【6. 检查编译结果】"
ls -la "$BUILD_DIR"/*.node 2>/dev/null || echo "无编译产物"

echo ""
echo "========================================"
echo "  编译完成"
echo "========================================"
