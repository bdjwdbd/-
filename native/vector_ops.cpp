/**
 * 向量运算原生模块 (C++ N-API)
 * 
 * 使用 SIMD 指令加速向量计算
 * 编译后作为 Node.js 原生模块使用
 */

#include <napi.h>
#include <cmath>
#include <vector>
#include <immintrin.h>  // AVX/SSE 指令

// ============================================================
// SIMD 检测
// ============================================================

inline bool hasAVX() {
#if defined(__AVX__)
    return true;
#else
    return false;
#endif
}

inline bool hasSSE2() {
#if defined(__SSE2__)
    return true;
#else
    return false;
#endif
}

// ============================================================
// 标量实现（降级模式）
// ============================================================

double dotProductScalar(const double* a, const double* b, size_t len) {
    double sum = 0.0;
    for (size_t i = 0; i < len; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

double euclideanDistanceScalar(const double* a, const double* b, size_t len) {
    double sum = 0.0;
    for (size_t i = 0; i < len; i++) {
        double diff = a[i] - b[i];
        sum += diff * diff;
    }
    return std::sqrt(sum);
}

// ============================================================
// SSE2 实现（128位 SIMD）
// ============================================================

#if defined(__SSE2__)
double dotProductSSE2(const double* a, const double* b, size_t len) {
    __m128d sum = _mm_setzero_pd();
    size_t i = 0;
    
    // 每次处理 2 个 double
    for (; i + 1 < len; i += 2) {
        __m128d va = _mm_loadu_pd(a + i);
        __m128d vb = _mm_loadu_pd(b + i);
        sum = _mm_add_pd(sum, _mm_mul_pd(va, vb));
    }
    
    // 水平求和
    double result[2];
    _mm_storeu_pd(result, sum);
    double total = result[0] + result[1];
    
    // 处理剩余元素
    for (; i < len; i++) {
        total += a[i] * b[i];
    }
    
    return total;
}

double euclideanDistanceSSE2(const double* a, const double* b, size_t len) {
    __m128d sum = _mm_setzero_pd();
    size_t i = 0;
    
    for (; i + 1 < len; i += 2) {
        __m128d va = _mm_loadu_pd(a + i);
        __m128d vb = _mm_loadu_pd(b + i);
        __m128d diff = _mm_sub_pd(va, vb);
        sum = _mm_add_pd(sum, _mm_mul_pd(diff, diff));
    }
    
    double result[2];
    _mm_storeu_pd(result, sum);
    double total = result[0] + result[1];
    
    for (; i < len; i++) {
        double diff = a[i] - b[i];
        total += diff * diff;
    }
    
    return std::sqrt(total);
}
#endif

// ============================================================
// AVX 实现（256位 SIMD）
// ============================================================

#if defined(__AVX__)
double dotProductAVX(const double* a, const double* b, size_t len) {
    __m256d sum = _mm256_setzero_pd();
    size_t i = 0;
    
    // 每次处理 4 个 double
    for (; i + 3 < len; i += 4) {
        __m256d va = _mm256_loadu_pd(a + i);
        __m256d vb = _mm256_loadu_pd(b + i);
        sum = _mm256_add_pd(sum, _mm256_mul_pd(va, vb));
    }
    
    // 水平求和
    double result[4];
    _mm256_storeu_pd(result, sum);
    double total = result[0] + result[1] + result[2] + result[3];
    
    // 处理剩余元素
    for (; i < len; i++) {
        total += a[i] * b[i];
    }
    
    return total;
}

double euclideanDistanceAVX(const double* a, const double* b, size_t len) {
    __m256d sum = _mm256_setzero_pd();
    size_t i = 0;
    
    for (; i + 3 < len; i += 4) {
        __m256d va = _mm256_loadu_pd(a + i);
        __m256d vb = _mm256_loadu_pd(b + i);
        __m256d diff = _mm256_sub_pd(va, vb);
        sum = _mm256_add_pd(sum, _mm256_mul_pd(diff, diff));
    }
    
    double result[4];
    _mm256_storeu_pd(result, sum);
    double total = result[0] + result[1] + result[2] + result[3];
    
    for (; i < len; i++) {
        double diff = a[i] - b[i];
        total += diff * diff;
    }
    
    return std::sqrt(total);
}
#endif

// ============================================================
// 自适应选择最优实现
// ============================================================

double dotProduct(const double* a, const double* b, size_t len) {
#if defined(__AVX__)
    if (hasAVX() && len >= 4) {
        return dotProductAVX(a, b, len);
    }
#endif
#if defined(__SSE2__)
    if (hasSSE2() && len >= 2) {
        return dotProductSSE2(a, b, len);
    }
#endif
    return dotProductScalar(a, b, len);
}

double euclideanDistance(const double* a, const double* b, size_t len) {
#if defined(__AVX__)
    if (hasAVX() && len >= 4) {
        return euclideanDistanceAVX(a, b, len);
    }
#endif
#if defined(__SSE2__)
    if (hasSSE2() && len >= 2) {
        return euclideanDistanceSSE2(a, b, len);
    }
#endif
    return euclideanDistanceScalar(a, b, len);
}

// ============================================================
// N-API 绑定
// ============================================================

Napi::Value DotProduct(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsFloat64Array() || !info[1].IsFloat64Array()) {
        Napi::TypeError::New(env, "Expected two Float64Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float64Array a = info[0].As<Napi::Float64Array>();
    Napi::Float64Array b = info[1].As<Napi::Float64Array>();
    
    if (a.ByteLength() != b.ByteLength()) {
        Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    size_t len = a.ByteLength() / sizeof(double);
    double result = dotProduct(a.Data(), b.Data(), len);
    
    return Napi::Number::New(env, result);
}

Napi::Value EuclideanDistance(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsFloat64Array() || !info[1].IsFloat64Array()) {
        Napi::TypeError::New(env, "Expected two Float64Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float64Array a = info[0].As<Napi::Float64Array>();
    Napi::Float64Array b = info[1].As<Napi::Float64Array>();
    
    if (a.ByteLength() != b.ByteLength()) {
        Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    size_t len = a.ByteLength() / sizeof(double);
    double result = euclideanDistance(a.Data(), b.Data(), len);
    
    return Napi::Number::New(env, result);
}

Napi::Value CosineSimilarity(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsFloat64Array() || !info[1].IsFloat64Array()) {
        Napi::TypeError::New(env, "Expected two Float64Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float64Array a = info[0].As<Napi::Float64Array>();
    Napi::Float64Array b = info[1].As<Napi::Float64Array>();
    
    if (a.ByteLength() != b.ByteLength()) {
        Napi::TypeError::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    size_t len = a.ByteLength() / sizeof(double);
    double dot = dotProduct(a.Data(), b.Data(), len);
    double normA = std::sqrt(dotProduct(a.Data(), a.Data(), len));
    double normB = std::sqrt(dotProduct(b.Data(), b.Data(), len));
    
    double result = dot / (normA * normB);
    return Napi::Number::New(env, result);
}

Napi::Value BatchCosineSimilarity(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsFloat64Array() || !info[1].IsArray()) {
        Napi::TypeError::New(env, "Expected Float64Array query and Array of vectors").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float64Array query = info[0].As<Napi::Float64Array>();
    Napi::Array vectors = info[1].As<Napi::Array>();
    
    size_t queryLen = query.ByteLength() / sizeof(double);
    size_t numVectors = vectors.Length();
    
    Napi::Float64Array results = Napi::Float64Array::New(env, numVectors);
    
    double normQ = std::sqrt(dotProduct(query.Data(), query.Data(), queryLen));
    
    for (size_t i = 0; i < numVectors; i++) {
        Napi::Value vecVal = vectors[i];
        if (!vecVal.IsFloat64Array()) {
            Napi::TypeError::New(env, "All vectors must be Float64Array").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        Napi::Float64Array vec = vecVal.As<Napi::Float64Array>();
        size_t vecLen = vec.ByteLength() / sizeof(double);
        
        if (vecLen != queryLen) {
            Napi::TypeError::New(env, "All vectors must have the same length as query").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        double dot = dotProduct(query.Data(), vec.Data(), queryLen);
        double normV = std::sqrt(dotProduct(vec.Data(), vec.Data(), queryLen));
        results[i] = dot / (normQ * normV);
    }
    
    return results;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("dotProduct", Napi::Function::New(env, DotProduct));
    exports.Set("euclideanDistance", Napi::Function::New(env, EuclideanDistance));
    exports.Set("cosineSimilarity", Napi::Function::New(env, CosineSimilarity));
    exports.Set("batchCosineSimilarity", Napi::Function::New(env, BatchCosineSimilarity));
    
    // 导出 SIMD 支持信息
    exports.Set("hasAVX", Napi::Boolean::New(env, hasAVX()));
    exports.Set("hasSSE2", Napi::Boolean::New(env, hasSSE2()));
    
    return exports;
}

NODE_API_MODULE(vector_ops, Init)
