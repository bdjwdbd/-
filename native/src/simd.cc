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
// 模块初始化
// ============================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("cosineSimilarity", Napi::Function::New(env, CosineSimilarity));
    exports.Set("getCapabilities", Napi::Function::New(env, GetCapabilities));
    return exports;
}

NODE_API_MODULE(yuanling_native, Init)

} // namespace simd
} // namespace yuanling
