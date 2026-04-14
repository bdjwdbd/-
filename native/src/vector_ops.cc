/**
 * @file vector_ops.cc
 * @brief 向量操作原生模块
 * 
 * 功能：
 * 1. 批量向量操作
 * 2. Top-K 搜索
 * 3. 向量归一化
 */

#include <napi.h>
#include <vector>
#include <cmath>
#include <algorithm>
#include <immintrin.h>

namespace yuanling {
namespace vector_ops {

// ============================================================
// 批量余弦相似度
// ============================================================

std::vector<float> cosineSimilarityBatchAVX512(
    const float* query,
    const float* const* vectors,
    size_t numVectors,
    size_t dim
) {
    std::vector<float> results(numVectors);
    
    // 预计算查询向量范数
    __m512 norm_q_vec = _mm512_setzero_ps();
    for (size_t i = 0; i + 16 <= dim; i += 16) {
        __m512 v = _mm512_loadu_ps(query + i);
        norm_q_vec = _mm512_fmadd_ps(v, v, norm_q_vec);
    }
    float norm_q = _mm512_reduce_add_ps(norm_q_vec);
    for (size_t i = (dim / 16) * 16; i < dim; i++) {
        norm_q += query[i] * query[i];
    }
    norm_q = std::sqrt(norm_q);
    
    // 批量计算
    #pragma omp parallel for
    for (size_t v = 0; v < numVectors; v++) {
        const float* vec = vectors[v];
        
        __m512 sum_vec = _mm512_setzero_ps();
        __m512 norm_v_vec = _mm512_setzero_ps();
        
        for (size_t i = 0; i + 16 <= dim; i += 16) {
            __m512 a = _mm512_loadu_ps(query + i);
            __m512 b = _mm512_loadu_ps(vec + i);
            
            sum_vec = _mm512_fmadd_ps(a, b, sum_vec);
            norm_v_vec = _mm512_fmadd_ps(b, b, norm_v_vec);
        }
        
        float dot = _mm512_reduce_add_ps(sum_vec);
        float norm_v = _mm512_reduce_add_ps(norm_v_vec);
        
        for (size_t i = (dim / 16) * 16; i < dim; i++) {
            dot += query[i] * vec[i];
            norm_v += vec[i] * vec[i];
        }
        
        results[v] = (norm_q > 0 && norm_v > 0) ? dot / (norm_q * std::sqrt(norm_v)) : 0;
    }
    
    return results;
}

// ============================================================
// Top-K 搜索
// ============================================================

std::vector<std::pair<size_t, float>> topKSearch(
    const float* query,
    const float* const* vectors,
    size_t numVectors,
    size_t dim,
    size_t k
) {
    // 计算所有相似度
    auto scores = cosineSimilarityBatchAVX512(query, vectors, numVectors, dim);
    
    // 创建索引数组
    std::vector<std::pair<size_t, float>> indexed;
    indexed.reserve(numVectors);
    for (size_t i = 0; i < numVectors; i++) {
        indexed.push_back({i, scores[i]});
    }
    
    // 部分排序获取 top-k
    std::partial_sort(
        indexed.begin(),
        indexed.begin() + std::min(k, indexed.size()),
        indexed.end(),
        [](const auto& a, const auto& b) { return a.second > b.second; }
    );
    
    indexed.resize(std::min(k, indexed.size()));
    return indexed;
}

// ============================================================
// 向量归一化
// ============================================================

void normalizeAVX512(float* vec, size_t len) {
    __m512 sum_vec = _mm512_setzero_ps();
    
    for (size_t i = 0; i + 16 <= len; i += 16) {
        __m512 v = _mm512_loadu_ps(vec + i);
        sum_vec = _mm512_fmadd_ps(v, v, sum_vec);
    }
    
    float norm = std::sqrt(_mm512_reduce_add_ps(sum_vec));
    
    for (size_t i = (len / 16) * 16; i < len; i++) {
        norm += vec[i] * vec[i];
    }
    norm = std::sqrt(norm);
    
    if (norm > 0) {
        __m512 norm_vec = _mm512_set1_ps(1.0f / norm);
        for (size_t i = 0; i + 16 <= len; i += 16) {
            __m512 v = _mm512_loadu_ps(vec + i);
            v = _mm512_mul_ps(v, norm_vec);
            _mm512_storeu_ps(vec + i, v);
        }
        for (size_t i = (len / 16) * 16; i < len; i++) {
            vec[i] /= norm;
        }
    }
}

// ============================================================
// Node.js 绑定
// ============================================================

Napi::Value TopKSearch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected query, vectors, k arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Array vectors = info[1].As<Napi::Array>();
    size_t k = info[2].As<Napi::Number>().Uint32Value();
    
    size_t dim = query.ElementLength();
    size_t numVectors = vectors.Length();
    
    // 准备向量指针数组
    std::vector<const float*> vecPtrs(numVectors);
    for (size_t i = 0; i < numVectors; i++) {
        Napi::Float32Array vec = vectors.Get(i).As<Napi::Float32Array>();
        vecPtrs[i] = vec.Data();
    }
    
    // 搜索
    auto results = topKSearch(query.Data(), vecPtrs.data(), numVectors, dim, k);
    
    // 返回结果
    Napi::Array resultArray = Napi::Array::New(env, results.size());
    for (size_t i = 0; i < results.size(); i++) {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("index", Napi::Number::New(env, results[i].first));
        obj.Set("score", Napi::Number::New(env, results[i].second));
        resultArray[i] = obj;
    }
    
    return resultArray;
}

Napi::Value Normalize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsFloat32Array()) {
        Napi::TypeError::New(env, "Expected Float32Array argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array arr = info[0].As<Napi::Float32Array>();
    
    // 复制数组（不修改原数组）
    Napi::Float32Array result = Napi::Float32Array::New(env, arr.ElementLength());
    std::copy(arr.Data(), arr.Data() + arr.ElementLength(), result.Data());
    
    normalizeAVX512(result.Data(), arr.ElementLength());
    
    return result;
}

// ============================================================
// 模块初始化
// ============================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("topKSearch", Napi::Function::New(env, TopKSearch));
    exports.Set("normalize", Napi::Function::New(env, Normalize));
    
    return exports;
}

NODE_API_MODULE(vector_ops, Init)

} // namespace vector_ops
} // namespace yuanling
