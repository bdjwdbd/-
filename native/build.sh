#!/bin/bash
# 元灵系统原生模块构建脚本

set -e

echo "========================================"
echo "  元灵系统原生模块构建"
echo "========================================"

# 检查依赖
check_dependencies() {
    echo ""
    echo "【检查依赖】"
    
    # 检查 Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo "✅ Node.js: $NODE_VERSION"
    else
        echo "❌ Node.js 未安装"
        exit 1
    fi
    
    # 检查 npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        echo "✅ npm: $NPM_VERSION"
    else
        echo "❌ npm 未安装"
        exit 1
    fi
    
    # 检查 node-gyp
    if command -v node-gyp &> /dev/null; then
        GYP_VERSION=$(node-gyp --version)
        echo "✅ node-gyp: $GYP_VERSION"
    else
        echo "ℹ️ node-gyp 未安装，将通过 npm 安装"
    fi
    
    # 检查 Python（node-gyp 需要）
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        echo "✅ Python: $PYTHON_VERSION"
    else
        echo "⚠️ Python3 未安装，node-gyp 可能无法工作"
    fi
    
    # 检查 C++ 编译器
    if command -v g++ &> /dev/null; then
        GPP_VERSION=$(g++ --version | head -1)
        echo "✅ g++: $GPP_VERSION"
    else
        echo "❌ g++ 未安装"
        exit 1
    fi
    
    # 检查 CUDA（可选）
    if command -v nvcc &> /dev/null; then
        CUDA_VERSION=$(nvcc --version | grep "release" | awk '{print $5}')
        echo "✅ CUDA: $CUDA_VERSION"
    else
        echo "ℹ️ CUDA 未安装（GPU 加速不可用）"
    fi
    
    # 检查 Emscripten（可选）
    if command -v emcc &> /dev/null; then
        EMCC_VERSION=$(emcc --version | head -1)
        echo "✅ Emscripten: $EMCC_VERSION"
    else
        echo "ℹ️ Emscripten 未安装（WASM 模块不可用）"
    fi
}

# 安装依赖
install_dependencies() {
    echo ""
    echo "【安装依赖】"
    
    cd native
    npm install
    cd ..
    
    echo "✅ 依赖安装完成"
}

# 构建原生模块
build_native() {
    echo ""
    echo "【构建原生模块】"
    
    cd native
    
    # 构建 SIMD 模块
    echo "构建 SIMD 模块..."
    node-gyp rebuild --target_name=simd
    
    # 构建 VNNI 模块
    echo "构建 VNNI 模块..."
    node-gyp rebuild --target_name=vnni
    
    # 构建向量操作模块
    echo "构建向量操作模块..."
    node-gyp rebuild --target_name=vector_ops
    
    # 构建内存模块
    echo "构建内存模块..."
    node-gyp rebuild --target_name=memory
    
    # 构建 GPU 模块（如果 CUDA 可用）
    if command -v nvcc &> /dev/null; then
        echo "构建 GPU 模块..."
        node-gyp rebuild --target_name=gpu
    fi
    
    cd ..
    
    echo "✅ 原生模块构建完成"
}

# 构建 WASM 模块
build_wasm() {
    echo ""
    echo "【构建 WASM 模块】"
    
    if command -v emcc &> /dev/null; then
        cd native
        make
        cd ..
        echo "✅ WASM 模块构建完成"
    else
        echo "ℹ️ 跳过 WASM 构建（Emscripten 未安装）"
    fi
}

# 运行测试
run_tests() {
    echo ""
    echo "【运行测试】"
    
    cd native
    npm test
    cd ..
    
    echo "✅ 测试完成"
}

# 显示结果
show_results() {
    echo ""
    echo "========================================"
    echo "  构建结果"
    echo "========================================"
    
    echo ""
    echo "【原生模块】"
    ls -la native/build/Release/*.node 2>/dev/null || echo "无原生模块"
    
    echo ""
    echo "【WASM 模块】"
    ls -la native/build/wasm/*.wasm 2>/dev/null || echo "无 WASM 模块"
    
    echo ""
    echo "✅ 构建完成！"
}

# 主流程
main() {
    check_dependencies
    install_dependencies
    build_native
    build_wasm
    run_tests
    show_results
}

# 执行
main "$@"
