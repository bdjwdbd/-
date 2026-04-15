/**
 * @file int8.cc
 * @brief INT8 量化计算模块 - 高效整数向量运算
 */

#include <napi.h>
#include <cmath>
#include <vector>
#include <queue>
#include <algorithm>
#include <immintrin.h>

namespace yuanling {
namespace int8 {

// ============================================================
// INT8 点积 (AVX2)
// ============================================================

int32_t dotProductINT8(const int8_t* a, const int8_t* b, size_t len) {
    __m256i sum = _mm256_setzero_si256();
    
    size_t i = 0;
    for (; i + 32 <= len; i += 32) {
        __m256i va = _mm256_loadu_si256((const __m256i*)(a + i));
        __m256i vb = _mm256_loadu_si256((const __m256i*)(b + i));
        
        // INT8 → INT16 点积
        __m256i prod = _mm256_maddubs_epi16(va, vb);
        
        // INT16 → INT32 累加
        __m256i ones = _mm256_set1_epi16(1);
        __m256i sum32 = _mm256_madd_epi16(prod, ones);
        
        sum = _mm256_add_epi32(sum, sum32);
    }
    
    // 水平求和
    int32_t result = 0;
    for (int j = 0; j < 8; j++) {
        result += ((int32_t*)&sum)[j];
    }
    
    // 处理剩余元素
    for (; i < len; i++) {
        result += a[i] * b[i];
    }
    
    return result;
}

// ============================================================
// INT8 余弦相似度
// ============================================================

float cosineSimilarityINT8(
    const int8_t* a,
    const int8_t* b,
    size_t len,
    float scaleA,
    float scaleB
) {
    int32_t dot = dotProductINT8(a, b, len);
    
    // 计算范数
    int32_t normA = 0, normB = 0;
    for (size_t i = 0; i < len; i++) {
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    // 反量化计算
    float dotF = dot * scaleA * scaleB;
    float normAF = std::sqrt((float)normA) * scaleA;
    float normBF = std::sqrt((float)normB) * scaleB;
    
    return dotF / (normAF * normBF + 1e-10f);
}

// ============================================================
// INT8 批量相似度
// ============================================================

void cosineSimilarityBatchINT8(
    const int8_t* query,
    const int8_t* vectors,
    float* results,
    size_t numVectors,
    size_t dim,
    float scaleQuery,
    const float* scalesVectors
) {
    for (size_t i = 0; i < numVectors; i++) {
        const int8_t* vec = vectors + i * dim;
        float scaleVec = scalesVectors ? scalesVectors[i] : scaleQuery;
        
        results[i] = cosineSimilarityINT8(query, vec, dim, scaleQuery, scaleVec);
    }
}

// ============================================================
// INT8 Top-K 搜索
// ============================================================

struct INT8Result {
    float score;
    size_t index;
    
    bool operator<(const INT8Result& other) const {
        return score > other.score;
    }
};

void topKSearchINT8(
    const int8_t* query,
    const int8_t* vectors,
    size_t numVectors,
    size_t dim,
    size_t k,
    float scaleQuery,
    const float* scalesVectors,
    float* outScores,
    size_t* outIndices
) {
    std::priority_queue<INT8Result> heap;
    
    for (size_t i = 0; i < numVectors; i++) {
        const int8_t* vec = vectors + i * dim;
        float scaleVec = scalesVectors ? scalesVectors[i] : scaleQuery;
        
        float score = cosineSimilarityINT8(query, vec, dim, scaleQuery, scaleVec);
        
        if (heap.size() < k) {
            heap.push({score, i});
        } else if (score > heap.top().score) {
            heap.pop();
            heap.push({score, i});
        }
    }
    
    // 输出结果
    std::vector<INT8Result> results;
    while (!heap.empty()) {
        results.push_back(heap.top());
        heap.pop();
    }
    
    std::reverse(results.begin(), results.end());
    
    for (size_t i = 0; i < k && i < results.size(); i++) {
        outScores[i] = results[i].score;
        outIndices[i] = results[i].index;
    }
}

// ============================================================
// Float32 → INT8 量化
// ============================================================

void quantizeFloat32ToInt8(
    const float* input,
    int8_t* output,
    size_t len,
    float* outScale
) {
    // 找最大绝对值
    float maxAbs = 0;
    for (size_t i = 0; i < len; i++) {
        maxAbs = std::max(maxAbs, std::abs(input[i]));
    }
    
    float scale = 127.0f / (maxAbs + 1e-10f);
    
    // 量化
    for (size_t i = 0; i < len; i++) {
        output[i] = (int8_t)std::round(input[i] * scale);
    }
    
    if (outScale) {
        *outScale = 1.0f / scale;
    }
}

// ============================================================
// Node.js 绑定
// ============================================================

Napi::Value CosineSimilarityINT8(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 4) {
        Napi::TypeError::New(env, "Expected 4 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Int8Array a = info[0].As<Napi::Int8Array>();
    Napi::Int8Array b = info[1].As<Napi::Int8Array>();
    float scaleA = info[2].As<Napi::Number>().FloatValue();
    float scaleB = info[3].As<Napi::Number>().FloatValue();
    
    float result = cosineSimilarityINT8(
        a.Data(),
        b.Data(),
        a.ElementLength(),
        scaleA,
        scaleB
    );
    
    return Napi::Number::New(env, result);
}

Napi::Value CosineSimilarityBatchINT8(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 5) {
        Napi::TypeError::New(env, "Expected 5 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Int8Array query = info[0].As<Napi::Int8Array>();
    Napi::Int8Array vectors = info[1].As<Napi::Int8Array>();
    size_t dim = info[2].As<Napi::Number>().Uint32Value();
    float scaleQuery = info[3].As<Napi::Number>().FloatValue();
    Napi::Float32Array scales = info[4].As<Napi::Float32Array>();
    
    size_t numVectors = vectors.ElementLength() / dim;
    
    Napi::Float32Array results = Napi::Float32Array::New(env, numVectors);
    
    cosineSimilarityBatchINT8(
        query.Data(),
        vectors.Data(),
        results.Data(),
        numVectors,
        dim,
        scaleQuery,
        scales.Data()
    );
    
    return results;
}

Napi::Value TopKSearchINT8(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 6) {
        Napi::TypeError::New(env, "Expected 6 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Int8Array query = info[0].As<Napi::Int8Array>();
    Napi::Int8Array vectors = info[1].As<Napi::Int8Array>();
    size_t dim = info[2].As<Napi::Number>().Uint32Value();
    size_t k = info[3].As<Napi::Number>().Uint32Value();
    float scaleQuery = info[4].As<Napi::Number>().FloatValue();
    Napi::Float32Array scales = info[5].As<Napi::Float32Array>();
    
    size_t numVectors = vectors.ElementLength() / dim;
    
    Napi::Float32Array scores = Napi::Float32Array::New(env, k);
    Napi::Uint32Array indices = Napi::Uint32Array::New(env, k);
    
    // 创建临时 size_t 数组
    std::vector<size_t> indicesTemp(k);
    
    topKSearchINT8(
        query.Data(),
        vectors.Data(),
        numVectors,
        dim,
        k,
        scaleQuery,
        scales.Data(),
        scores.Data(),
        indicesTemp.data()
    );
    
    // 复制到 Uint32Array
    for (size_t i = 0; i < k; i++) {
        indices[i] = static_cast<uint32_t>(indicesTemp[i]);
    }
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("scores", scores);
    result.Set("indices", indices);
    
    return result;
}

Napi::Value QuantizeFloat32ToInt8(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected 1 argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array input = info[0].As<Napi::Float32Array>();
    
    Napi::Int8Array output = Napi::Int8Array::New(env, input.ElementLength());
    float scale;
    
    quantizeFloat32ToInt8(
        input.Data(),
        output.Data(),
        input.ElementLength(),
        &scale
    );
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("data", output);
    result.Set("scale", Napi::Number::New(env, scale));
    
    return result;
}

// ============================================================
// 模块初始化
// ============================================================

Napi::Object InitInt8(Napi::Env env, Napi::Object exports) {
    exports.Set("cosineSimilarityINT8", Napi::Function::New(env, CosineSimilarityINT8));
    exports.Set("cosineSimilarityBatchINT8", Napi::Function::New(env, CosineSimilarityBatchINT8));
    exports.Set("topKSearchINT8", Napi::Function::New(env, TopKSearchINT8));
    exports.Set("quantizeFloat32ToInt8", Napi::Function::New(env, QuantizeFloat32ToInt8));
    return exports;
}

}  // namespace int8
}  // namespace yuanling

NODE_API_MODULE(int8, yuanling::int8::InitInt8)
