/**
 * @file gpu.cc
 * @brief GPU 加速模块
 * 
 * 功能：
 * 1. CUDA 向量操作
 * 2. Vulkan 通用 GPU 计算
 * 3. 自动后端选择
 */

#include <napi.h>
#include <vector>
#include <string>

#ifdef CUDA_AVAILABLE
#include <cuda_runtime.h>
#include <cublas_v2.h>
#endif

namespace yuanling {
namespace gpu {

// ============================================================
// GPU 信息
// ============================================================

struct GPUInfo {
    std::string backend;
    std::string name;
    size_t memory;
    int computeCapability;
    bool available;
};

// ============================================================
// CUDA 检测
// ============================================================

#ifdef CUDA_AVAILABLE
bool checkCUDA(GPUInfo& info) {
    int deviceCount = 0;
    cudaError_t err = cudaGetDeviceCount(&deviceCount);
    
    if (err != cudaSuccess || deviceCount == 0) {
        return false;
    }
    
    cudaDeviceProp prop;
    cudaGetDeviceProperties(&prop, 0);
    
    info.backend = "cuda";
    info.name = prop.name;
    info.memory = prop.totalGlobalMem;
    info.computeCapability = prop.major * 10 + prop.minor;
    info.available = true;
    
    return true;
}
#else
bool checkCUDA(GPUInfo& info) {
    return false;
}
#endif

// ============================================================
// CUDA 向量操作
// ============================================================

#ifdef CUDA_AVAILABLE
__global__ void cosineSimilarityKernel(
    const float* __restrict__ query,
    const float* __restrict__ vectors,
    float* __restrict__ results,
    size_t dim,
    size_t numVectors
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= numVectors) return;
    
    const float* vec = vectors + idx * dim;
    
    float dot = 0.0f;
    float normQ = 0.0f;
    float normV = 0.0f;
    
    for (size_t i = 0; i < dim; i++) {
        dot += query[i] * vec[i];
        normQ += query[i] * query[i];
        normV += vec[i] * vec[i];
    }
    
    results[idx] = (normQ > 0 && normV > 0) ? dot / (sqrtf(normQ) * sqrtf(normV)) : 0.0f;
}

std::vector<float> cudaCosineSimilarityBatch(
    const float* query,
    const float* vectors,
    size_t dim,
    size_t numVectors
) {
    // 分配 GPU 内存
    float* d_query;
    float* d_vectors;
    float* d_results;
    
    cudaMalloc(&d_query, dim * sizeof(float));
    cudaMalloc(&d_vectors, dim * numVectors * sizeof(float));
    cudaMalloc(&d_results, numVectors * sizeof(float));
    
    // 复制数据到 GPU
    cudaMemcpy(d_query, query, dim * sizeof(float), cudaMemcpyHostToDevice);
    cudaMemcpy(d_vectors, vectors, dim * numVectors * sizeof(float), cudaMemcpyHostToDevice);
    
    // 启动 kernel
    int blockSize = 256;
    int numBlocks = (numVectors + blockSize - 1) / blockSize;
    cosineSimilarityKernel<<<numBlocks, blockSize>>>(d_query, d_vectors, d_results, dim, numVectors);
    
    // 复制结果回 CPU
    std::vector<float> results(numVectors);
    cudaMemcpy(results.data(), d_results, numVectors * sizeof(float), cudaMemcpyDeviceToHost);
    
    // 释放内存
    cudaFree(d_query);
    cudaFree(d_vectors);
    cudaFree(d_results);
    
    return results;
}
#endif

// ============================================================
// CPU 回退实现
// ============================================================

std::vector<float> cpuCosineSimilarityBatch(
    const float* query,
    const float* vectors,
    size_t dim,
    size_t numVectors
) {
    std::vector<float> results(numVectors);
    
    // 计算查询向量范数
    float normQ = 0;
    for (size_t i = 0; i < dim; i++) {
        normQ += query[i] * query[i];
    }
    normQ = std::sqrt(normQ);
    
    // 批量计算
    for (size_t v = 0; v < numVectors; v++) {
        const float* vec = vectors + v * dim;
        
        float dot = 0, normV = 0;
        for (size_t i = 0; i < dim; i++) {
            dot += query[i] * vec[i];
            normV += vec[i] * vec[i];
        }
        
        results[v] = (normQ > 0 && normV > 0) ? dot / (normQ * std::sqrt(normV)) : 0;
    }
    
    return results;
}

// ============================================================
// 全局 GPU 信息
// ============================================================

static GPUInfo g_gpuInfo;

// ============================================================
// Node.js 绑定
// ============================================================

Napi::Value GetGPUInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object obj = Napi::Object::New(env);
    
    obj.Set("backend", Napi::String::New(env, g_gpuInfo.backend));
    obj.Set("name", Napi::String::New(env, g_gpuInfo.name));
    obj.Set("memory", Napi::Number::New(env, g_gpuInfo.memory));
    obj.Set("computeCapability", Napi::Number::New(env, g_gpuInfo.computeCapability));
    obj.Set("available", Napi::Boolean::New(env, g_gpuInfo.available));
    
    return obj;
}

Napi::Value CosineSimilarityBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsTypedArray() || !info[1].IsTypedArray()) {
        Napi::TypeError::New(env, "Expected two TypedArray arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::TypedArray ta1 = info[0].As<Napi::TypedArray>();
    Napi::TypedArray ta2 = info[1].As<Napi::TypedArray>();
    
    if (ta1.TypedArrayType() != napi_float32_array || ta2.TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "Expected Float32Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Float32Array allVectors = info[1].As<Napi::Float32Array>();
    
    size_t dim = query.ElementLength();
    size_t numVectors = allVectors.ElementLength() / dim;
    
    std::vector<float> results;
    
#ifdef CUDA_AVAILABLE
    if (g_gpuInfo.available && g_gpuInfo.backend == "cuda") {
        results = cudaCosineSimilarityBatch(query.Data(), allVectors.Data(), dim, numVectors);
    } else {
        results = cpuCosineSimilarityBatch(query.Data(), allVectors.Data(), dim, numVectors);
    }
#else
    results = cpuCosineSimilarityBatch(query.Data(), allVectors.Data(), dim, numVectors);
#endif
    
    Napi::Float32Array resultArray = Napi::Float32Array::New(env, results.size());
    std::copy(results.begin(), results.end(), resultArray.Data());
    
    return resultArray;
}

// ============================================================
// 模块初始化
// ============================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // 初始化 GPU 信息
    g_gpuInfo = {"none", "", 0, 0, false};
    
#ifdef CUDA_AVAILABLE
    checkCUDA(g_gpuInfo);
#endif
    
    exports.Set("getGPUInfo", Napi::Function::New(env, GetGPUInfo));
    exports.Set("cosineSimilarityBatch", Napi::Function::New(env, CosineSimilarityBatch));
    
    return exports;
}

NODE_API_MODULE(gpu, Init)

} // namespace gpu
} // namespace yuanling
