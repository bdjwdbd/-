/**
 * @file simd.cc
 * @brief SIMD 加速模块 - AVX2 实现
 */

#include <napi.h>
#include <cmath>
#include <vector>
#include <immintrin.h>

namespace yuanling {
namespace simd {

// ============================================================
// AVX2 余弦相似度
// ============================================================

float cosineSimilarityAVX2(const float* a, const float* b, size_t len) {
    __m256 sum_vec = _mm256_setzero_ps();
    __m256 norm_a_vec = _mm256_setzero_ps();
    __m256 norm_b_vec = _mm256_setzero_ps();
    
    size_t i = 0;
    for (; i + 8 <= len; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        sum_vec = _mm256_fmadd_ps(va, vb, sum_vec);
        norm_a_vec = _mm256_fmadd_ps(va, va, norm_a_vec);
        norm_b_vec = _mm256_fmadd_ps(vb, vb, norm_b_vec);
    }
    
    // 水平求和
    float sum = 0, norm_a = 0, norm_b = 0;
    for (int j = 0; j < 8; j++) {
        sum += ((float*)&sum_vec)[j];
        norm_a += ((float*)&norm_a_vec)[j];
        norm_b += ((float*)&norm_b_vec)[j];
    }
    
    // 处理剩余元素
    for (; i < len; i++) {
        sum += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    
    return sum / (std::sqrt(norm_a) * std::sqrt(norm_b) + 1e-10f);
}

// 标量版本（回退）
float cosineSimilarityScalar(const float* a, const float* b, size_t len) {
    float sum = 0, norm_a = 0, norm_b = 0;
    for (size_t i = 0; i < len; i++) {
        sum += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    return sum / (std::sqrt(norm_a) * std::sqrt(norm_b) + 1e-10f);
}

// 统一接口
float cosineSimilarity(const float* a, const float* b, size_t len) {
    return cosineSimilarityAVX2(a, b, len);
}

// ============================================================
// Node.js 绑定
// ============================================================

Napi::Value CosineSimilarity(const Napi::CallbackInfo& info) {
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
    
    Napi::Float32Array arr1 = info[0].As<Napi::Float32Array>();
    Napi::Float32Array arr2 = info[1].As<Napi::Float32Array>();
    
    if (arr1.ElementLength() != arr2.ElementLength()) {
        Napi::Error::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    float result = cosineSimilarity(arr1.Data(), arr2.Data(), arr1.ElementLength());
    return Napi::Number::New(env, result);
}

Napi::Value GetCapabilities(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object caps = Napi::Object::New(env);
    
    caps.Set("avx2", Napi::Boolean::New(env, true));
    caps.Set("avx512f", Napi::Boolean::New(env, false));
    caps.Set("fma", Napi::Boolean::New(env, true));
    
    return caps;
}

// ============================================================
// 批量余弦相似度（优化：减少 JS/C++ 边界开销）
// ============================================================

Napi::Value CosineSimilarityBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsTypedArray() || !info[1].IsArray()) {
        Napi::TypeError::New(env, "Expected Float32Array and Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::TypedArray ta = info[0].As<Napi::TypedArray>();
    if (ta.TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "Expected Float32Array as first argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Array vectors = info[1].As<Napi::Array>();
    
    size_t numVectors = vectors.Length();
    size_t queryLen = query.ElementLength();
    const float* queryData = query.Data();
    
    Napi::Float32Array results = Napi::Float32Array::New(env, numVectors);
    
    for (size_t i = 0; i < numVectors; i++) {
        Napi::Value vecVal = vectors.Get(i);
        if (!vecVal.IsTypedArray()) {
            Napi::TypeError::New(env, "Vector must be TypedArray").ThrowAsJavaScriptException();
            return env.Null();
        }
        Napi::TypedArray vecTa = vecVal.As<Napi::TypedArray>();
        if (vecTa.TypedArrayType() != napi_float32_array) {
            Napi::TypeError::New(env, "Vector must be Float32Array").ThrowAsJavaScriptException();
            return env.Null();
        }
        Napi::Float32Array vec = vecVal.As<Napi::Float32Array>();
        results[i] = cosineSimilarity(queryData, vec.Data(), queryLen);
    }
    
    return results;
}

// ============================================================
// 批量余弦相似度（连续内存版本，最高性能）
// ============================================================

Napi::Value CosineSimilarityBatchContiguous(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3 || !info[0].IsTypedArray() || !info[1].IsTypedArray() || !info[2].IsNumber()) {
        Napi::TypeError::New(env, "Expected Float32Array, Float32Array, and dimension").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::TypedArray ta0 = info[0].As<Napi::TypedArray>();
    Napi::TypedArray ta1 = info[1].As<Napi::TypedArray>();
    
    if (ta0.TypedArrayType() != napi_float32_array || ta1.TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "Expected Float32Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Float32Array allVectors = info[1].As<Napi::Float32Array>();
    size_t dim = info[2].As<Napi::Number>().Uint32Value();
    
    size_t queryLen = query.ElementLength();
    size_t numVectors = allVectors.ElementLength() / dim;
    
    if (queryLen != dim) {
        Napi::Error::New(env, "Query dimension mismatch").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    const float* queryData = query.Data();
    const float* vectorsData = allVectors.Data();
    
    Napi::Float32Array results = Napi::Float32Array::New(env, numVectors);
    
    // 连续内存访问，CPU 缓存友好
    for (size_t i = 0; i < numVectors; i++) {
        results[i] = cosineSimilarity(queryData, vectorsData + i * dim, dim);
    }
    
    return results;
}

// ============================================================
// 欧氏距离
// ============================================================

float euclideanDistanceAVX2(const float* a, const float* b, size_t len) {
    __m256 sum_vec = _mm256_setzero_ps();
    
    size_t i = 0;
    for (; i + 8 <= len; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        __m256 diff = _mm256_sub_ps(va, vb);
        sum_vec = _mm256_fmadd_ps(diff, diff, sum_vec);
    }
    
    float sum = 0;
    for (int j = 0; j < 8; j++) {
        sum += ((float*)&sum_vec)[j];
    }
    
    for (; i < len; i++) {
        float diff = a[i] - b[i];
        sum += diff * diff;
    }
    
    return std::sqrt(sum);
}

Napi::Value EuclideanDistance(const Napi::CallbackInfo& info) {
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
    
    Napi::Float32Array arr1 = info[0].As<Napi::Float32Array>();
    Napi::Float32Array arr2 = info[1].As<Napi::Float32Array>();
    
    float result = euclideanDistanceAVX2(arr1.Data(), arr2.Data(), arr1.ElementLength());
    return Napi::Number::New(env, result);
}

// ============================================================
// Top-K 搜索（使用堆选择，避免全排序）
// ============================================================

#include <queue>
#include <functional>

Napi::Value TopKSearch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3 || !info[0].IsTypedArray() || !info[1].IsTypedArray() || !info[2].IsNumber()) {
        Napi::TypeError::New(env, "Expected Float32Array, Float32Array, and k").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::TypedArray ta0 = info[0].As<Napi::TypedArray>();
    Napi::TypedArray ta1 = info[1].As<Napi::TypedArray>();
    
    if (ta0.TypedArrayType() != napi_float32_array || ta1.TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "Expected Float32Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Float32Array allVectors = info[1].As<Napi::Float32Array>();
    size_t k = info[2].As<Napi::Number>().Uint32Value();
    
    size_t dim = query.ElementLength();
    size_t numVectors = allVectors.ElementLength() / dim;
    
    if (k > numVectors) k = numVectors;
    
    const float* queryData = query.Data();
    const float* vectorsData = allVectors.Data();
    
    // 使用最小堆，保持 Top-K
    using Result = std::pair<float, size_t>;
    std::priority_queue<Result, std::vector<Result>, std::greater<>> heap;
    
    for (size_t i = 0; i < numVectors; i++) {
        float score = cosineSimilarity(queryData, vectorsData + i * dim, dim);
        
        if (heap.size() < k) {
            heap.push({score, i});
        } else if (score > heap.top().first) {
            heap.pop();
            heap.push({score, i});
        }
    }
    
    // 转换结果（从大到小排序）
    std::vector<Result> sorted;
    while (!heap.empty()) {
        sorted.push_back(heap.top());
        heap.pop();
    }
    std::reverse(sorted.begin(), sorted.end());
    
    // 返回结果数组
    Napi::Array results = Napi::Array::New(env, sorted.size());
    for (size_t i = 0; i < sorted.size(); i++) {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("index", Napi::Number::New(env, sorted[i].second));
        obj.Set("score", Napi::Number::New(env, sorted[i].first));
        results.Set(i, obj);
    }
    
    return results;
}

// ============================================================
// Top-K 搜索（带维度参数）
// ============================================================

Napi::Value TopKSearchWithDim(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 4 || !info[0].IsTypedArray() || !info[1].IsTypedArray() || !info[2].IsNumber() || !info[3].IsNumber()) {
        Napi::TypeError::New(env, "Expected Float32Array, Float32Array, dimension, and k").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::TypedArray ta0 = info[0].As<Napi::TypedArray>();
    Napi::TypedArray ta1 = info[1].As<Napi::TypedArray>();
    
    if (ta0.TypedArrayType() != napi_float32_array || ta1.TypedArrayType() != napi_float32_array) {
        Napi::TypeError::New(env, "Expected Float32Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Float32Array allVectors = info[1].As<Napi::Float32Array>();
    size_t dim = info[2].As<Napi::Number>().Uint32Value();
    size_t k = info[3].As<Napi::Number>().Uint32Value();
    
    size_t numVectors = allVectors.ElementLength() / dim;
    if (k > numVectors) k = numVectors;
    
    const float* queryData = query.Data();
    const float* vectorsData = allVectors.Data();
    
    // 使用最小堆
    using Result = std::pair<float, size_t>;
    std::priority_queue<Result, std::vector<Result>, std::greater<>> heap;
    
    for (size_t i = 0; i < numVectors; i++) {
        float score = cosineSimilarity(queryData, vectorsData + i * dim, dim);
        
        if (heap.size() < k) {
            heap.push({score, i});
        } else if (score > heap.top().first) {
            heap.pop();
            heap.push({score, i});
        }
    }
    
    // 转换结果
    std::vector<Result> sorted;
    while (!heap.empty()) {
        sorted.push_back(heap.top());
        heap.pop();
    }
    std::reverse(sorted.begin(), sorted.end());
    
    Napi::Array results = Napi::Array::New(env, sorted.size());
    for (size_t i = 0; i < sorted.size(); i++) {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("index", Napi::Number::New(env, sorted[i].second));
        obj.Set("score", Napi::Number::New(env, sorted[i].first));
        results.Set(i, obj);
    }
    
    return results;
}

// ============================================================
// 模块初始化
// ============================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("cosineSimilarity", Napi::Function::New(env, CosineSimilarity));
    exports.Set("cosineSimilarityBatch", Napi::Function::New(env, CosineSimilarityBatch));
    exports.Set("cosineSimilarityBatchContiguous", Napi::Function::New(env, CosineSimilarityBatchContiguous));
    exports.Set("euclideanDistance", Napi::Function::New(env, EuclideanDistance));
    exports.Set("topKSearch", Napi::Function::New(env, TopKSearch));
    exports.Set("topKSearchWithDim", Napi::Function::New(env, TopKSearchWithDim));
    exports.Set("getCapabilities", Napi::Function::New(env, GetCapabilities));
    return exports;
}

NODE_API_MODULE(yuanling_native, Init)

} // namespace simd
} // namespace yuanling
