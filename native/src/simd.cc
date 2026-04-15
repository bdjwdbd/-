/**
 * @file simd.cc
 * @brief SIMD 加速模块 - AVX-512 实现
 * 
 * 功能：
 * 1. AVX-512 余弦相似度计算
 * 2. AVX-512 欧氏距离计算
 * 3. 批量向量操作
 */

#include <napi.h>
#include <cmath>
#include <vector>
#include <immintrin.h>  // AVX-512

namespace yuanling {
namespace simd {

// ============================================================
// SIMD 检测
// ============================================================

struct SIMDCapabilities {
    bool avx512f = false;
    bool avx512vl = false;
    bool avx512bw = false;
    bool avx512dq = false;
    bool avx512vnni = false;
    bool avx2 = false;
    bool sse42 = false;
};

SIMDCapabilities detectSIMD() {
    SIMDCapabilities caps;
    
    // 在运行时检测 CPU 支持
    // 注意：编译时已启用 AVX-512，但运行时需要检测
    unsigned int eax, ebx, ecx, edx;
    
    // CPUID leaf 7, subleaf 0
    __asm__ __volatile__ (
        "cpuid"
        : "=a"(eax), "=b"(ebx), "=c"(ecx), "=d"(edx)
        : "a"(7), "c"(0)
    );
    
    caps.avx512f = (ebx >> 16) & 1;
    caps.avx512vl = (ebx >> 31) & 1;
    caps.avx512bw = (ebx >> 30) & 1;
    caps.avx512dq = (ebx >> 17) & 1;
    caps.avx512vnni = (ecx >> 11) & 1;
    caps.avx2 = (ebx >> 5) & 1;
    
    // CPUID leaf 1
    __asm__ __volatile__ (
        "cpuid"
        : "=a"(eax), "=b"(ebx), "=c"(ecx), "=d"(edx)
        : "a"(1)
    );
    
    caps.sse42 = (ecx >> 20) & 1;
    
    return caps;
}

// 全局 SIMD 能力
static SIMDCapabilities g_simdCaps;

// ============================================================
// AVX-512 余弦相似度
// ============================================================

float cosineSimilarityAVX512(const float* a, const float* b, size_t len) {
    __m512 sum_vec = _mm512_setzero_ps();
    __m512 norm_a_vec = _mm512_setzero_ps();
    __m512 norm_b_vec = _mm512_setzero_ps();
    
    size_t i = 0;
    
    // 主循环：每次处理 16 个 float
    for (; i + 16 <= len; i += 16) {
        __m512 va = _mm512_loadu_ps(a + i);
        __m512 vb = _mm512_loadu_ps(b + i);
        
        sum_vec = _mm512_fmadd_ps(va, vb, sum_vec);
        norm_a_vec = _mm512_fmadd_ps(va, va, norm_a_vec);
        norm_b_vec = _mm512_fmadd_ps(vb, vb, norm_b_vec);
    }
    
    // 水平求和
    float dot = _mm512_reduce_add_ps(sum_vec);
    float norm_a = _mm512_reduce_add_ps(norm_a_vec);
    float norm_b = _mm512_reduce_add_ps(norm_b_vec);
    
    // 处理剩余元素
    for (; i < len; i++) {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    
    if (norm_a == 0 || norm_b == 0) return 0.0f;
    return dot / (std::sqrt(norm_a) * std::sqrt(norm_b));
}

// ============================================================
// AVX2 回退实现
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
    __m128 sum_high = _mm256_extractf128_ps(sum_vec, 1);
    __m128 sum_low = _mm256_castps256_ps128(sum_vec);
    __m128 sum128 = _mm_add_ps(sum_low, sum_high);
    sum128 = _mm_hadd_ps(sum128, sum128);
    sum128 = _mm_hadd_ps(sum128, sum128);
    float dot = _mm_cvtss_f32(sum128);
    
    // 类似处理 norm_a 和 norm_b
    __m128 norm_a_high = _mm256_extractf128_ps(norm_a_vec, 1);
    __m128 norm_a_low = _mm256_castps256_ps128(norm_a_vec);
    __m128 norm_a128 = _mm_add_ps(norm_a_low, norm_a_high);
    norm_a128 = _mm_hadd_ps(norm_a128, norm_a128);
    norm_a128 = _mm_hadd_ps(norm_a128, norm_a128);
    float norm_a = _mm_cvtss_f32(norm_a128);
    
    __m128 norm_b_high = _mm256_extractf128_ps(norm_b_vec, 1);
    __m128 norm_b_low = _mm256_castps256_ps128(norm_b_vec);
    __m128 norm_b128 = _mm_add_ps(norm_b_low, norm_b_high);
    norm_b128 = _mm_hadd_ps(norm_b128, norm_b128);
    norm_b128 = _mm_hadd_ps(norm_b128, norm_b128);
    float norm_b = _mm_cvtss_f32(norm_b128);
    
    for (; i < len; i++) {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    
    if (norm_a == 0 || norm_b == 0) return 0.0f;
    return dot / (std::sqrt(norm_a) * std::sqrt(norm_b));
}

// ============================================================
// 标量回退实现
// ============================================================

float cosineSimilarityScalar(const float* a, const float* b, size_t len) {
    float dot = 0, norm_a = 0, norm_b = 0;
    for (size_t i = 0; i < len; i++) {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    if (norm_a == 0 || norm_b == 0) return 0.0f;
    return dot / (std::sqrt(norm_a) * std::sqrt(norm_b));
}

// ============================================================
// 自动选择最优实现
// ============================================================

float cosineSimilarity(const float* a, const float* b, size_t len) {
    if (g_simdCaps.avx512f) {
        return cosineSimilarityAVX512(a, b, len);
    } else if (g_simdCaps.avx2) {
        return cosineSimilarityAVX2(a, b, len);
    }
    return cosineSimilarityScalar(a, b, len);
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
    
    float result = cosineSimilarity(
        arr1.Data(),
        arr2.Data(),
        arr1.ElementLength()
    );
    
    return Napi::Number::New(env, result);
}

// ============================================================
// 批量余弦相似度
// ============================================================

Napi::Value CosineSimilarityBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsTypedArray() || !info[1].IsArray()) {
        Napi::TypeError::New(env, "Expected TypedArray and Array arguments").ThrowAsJavaScriptException();
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
    Napi::Float32Array results = Napi::Float32Array::New(env, numVectors);
    
    for (size_t i = 0; i < numVectors; i++) {
        Napi::Float32Array vec = vectors.Get(i).As<Napi::Float32Array>();
        results[i] = cosineSimilarity(query.Data(), vec.Data(), query.ElementLength());
    }
    
    return results;
}

// ============================================================
// 获取 SIMD 能力
// ============================================================

Napi::Value GetCapabilities(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object caps = Napi::Object::New(env);
    
    caps.Set("avx512f", Napi::Boolean::New(env, g_simdCaps.avx512f));
    caps.Set("avx512vl", Napi::Boolean::New(env, g_simdCaps.avx512vl));
    caps.Set("avx512bw", Napi::Boolean::New(env, g_simdCaps.avx512bw));
    caps.Set("avx512dq", Napi::Boolean::New(env, g_simdCaps.avx512dq));
    caps.Set("avx512vnni", Napi::Boolean::New(env, g_simdCaps.avx512vnni));
    caps.Set("avx2", Napi::Boolean::New(env, g_simdCaps.avx2));
    caps.Set("sse42", Napi::Boolean::New(env, g_simdCaps.sse42));
    
    return caps;
}

// ============================================================
// 模块初始化
// ============================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // 检测 SIMD 能力
    g_simdCaps = detectSIMD();
    
    exports.Set("cosineSimilarity", Napi::Function::New(env, CosineSimilarity));
    exports.Set("cosineSimilarityBatch", Napi::Function::New(env, CosineSimilarityBatch));
    exports.Set("getCapabilities", Napi::Function::New(env, GetCapabilities));
    
    return exports;
}

NODE_API_MODULE(simd, Init)

} // namespace simd
} // namespace yuanling
