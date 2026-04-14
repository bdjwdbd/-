# WASM 模块构建配置

# 编译器设置
EMCC = emcc
CXXFLAGS = -O3 -msimd128 -msse4.2 -std=c++17

# 目标文件
WASM_DIR = wasm
BUILD_DIR = build/wasm

# 源文件
WASM_SOURCES = $(wildcard $(WASM_DIR)/*.cpp)

# 默认目标
all: $(BUILD_DIR)/simd.wasm

# 编译 WASM 模块
$(BUILD_DIR)/simd.wasm: $(WASM_DIR)/simd.cpp
	@mkdir -p $(BUILD_DIR)
	$(EMCC) $(CXXFLAGS) \
		-o $@ \
		$< \
		-s EXPORTED_FUNCTIONS='["_cosine_similarity_wasm", "_cosine_similarity_batch_wasm", "_normalize_wasm", "_dot_product_wasm"]' \
		-s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
		-s ALLOW_MEMORY_GROWTH=1 \
		-s MODULARIZE=1 \
		-s EXPORT_NAME="createSimdModule"

# 清理
clean:
	rm -rf $(BUILD_DIR)

# 测试
test: $(BUILD_DIR)/simd.wasm
	node test/wasm-test.js

.PHONY: all clean test
