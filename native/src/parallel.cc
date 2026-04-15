/**
 * @file parallel.cc
 * @brief 多线程并行计算模块 - OpenMP 实现
 * 
 * 功能：
 * 1. 并行余弦相似度批量计算
 * 2. 并行 Top-K 搜索
 * 3. 线程数控制
 * 4. AVX-512 支持
 */

#include <napi.h>
#include <cmath>
#include <vector>
#include <queue>
#include <functional>
#include <algorithm>
#include <immintrin.h>
#include <omp.h>
#include <cpuid.h>

namespace yuanling {
namespace parallel {

// ============================================================
// CPU 特性检测
// ============================================================

struct CPUFeatures {
    bool hasAVX2 = false;
    bool hasAVX512F = false;
    bool hasFMA = false;
};

CPUFeatures detectCPUFeatures() {
    CPUFeatures features;
    unsigned int eax, ebx, ecx, edx;
    
    if (__get_cpuid(1, &eax, &ebx, &ecx, &edx)) {
        features.hasFMA = (ecx & (1 << 12)) != 0;
    }
    
    if (__get_cpuid_count(7, 0, &eax, &ebx, &ecx, &edx)) {
        features.hasAVX2 = (ebx & (1 << 5)) != 0;
        features.hasAVX512F = (ebx & (1 << 16)) != 0;
    }
    
    return features;
}

static CPUFeatures g_cpuFeatures = detectCPUFeatures();

// ============================================================
// AVX-512 余弦相似度
// ============================================================

#ifdef __AVX512F__
inline float cosineSimilarityAVX512(const float* query, const float* vec, size_t dim) {
    __m512 sum_vec = _mm512_setzero_ps();
    __m512 norm_q_vec = _mm512_setzero_ps();
    __m512 norm_v_vec = _mm512_setzero_ps();
    
    size_t j = 0;
    for (; j + 16 <= dim; j += 16) {
        __m512 vq = _mm512_loadu_ps(query + j);
        __m512 vv = _mm512_loadu_ps(vec + j);
        sum_vec = _mm512_fmadd_ps(vq, vv, sum_vec);
        norm_q_vec = _mm512_fmadd_ps(vq, vq, norm_q_vec);
        norm_v_vec = _mm512_fmadd_ps(vv, vv, norm_v_vec);
    }
    
    float sum = _mm512_reduce_add_ps(sum_vec);
    float norm_q = _mm512_reduce_add_ps(norm_q_vec);
    float norm_v = _mm512_reduce_add_ps(norm_v_vec);
    
    for (; j < dim; j++) {
        sum += query[j] * vec[j];
        norm_q += query[j] * query[j];
        norm_v += vec[j] * vec[j];
    }
    
    return sum / (std::sqrt(norm_q) * std::sqrt(norm_v) + 1e-10f);
}
#endif

// ============================================================
// AVX2 余弦相似度
// ============================================================

inline float cosineSimilarityAVX2(const float* query, const float* vec, size_t dim) {
    __m256 sum_vec = _mm256_setzero_ps();
    __m256 norm_q_vec = _mm256_setzero_ps();
    __m256 norm_v_vec = _mm256_setzero_ps();
    
    size_t j = 0;
    for (; j + 8 <= dim; j += 8) {
        __m256 vq = _mm256_loadu_ps(query + j);
        __m256 vv = _mm256_loadu_ps(vec + j);
        sum_vec = _mm256_fmadd_ps(vq, vv, sum_vec);
        norm_q_vec = _mm256_fmadd_ps(vq, vq, norm_q_vec);
        norm_v_vec = _mm256_fmadd_ps(vv, vv, norm_v_vec);
    }
    
    float sum = 0, norm_q = 0, norm_v = 0;
    for (int k = 0; k < 8; k++) {
        sum += ((float*)&sum_vec)[k];
        norm_q += ((float*)&norm_q_vec)[k];
        norm_v += ((float*)&norm_v_vec)[k];
    }
    
    for (; j < dim; j++) {
        sum += query[j] * vec[j];
        norm_q += query[j] * query[j];
        norm_v += vec[j] * vec[j];
    }
    
    return sum / (std::sqrt(norm_q) * std::sqrt(norm_v) + 1e-10f);
}

// 统一接口
inline float cosineSimilarity(const float* query, const float* vec, size_t dim) {
#ifdef __AVX512F__
    if (g_cpuFeatures.hasAVX512F) {
        return cosineSimilarityAVX512(query, vec, dim);
    }
#endif
    return cosineSimilarityAVX2(query, vec, dim);
}

// ============================================================
// 并行余弦相似度批量计算
// ============================================================

void cosineSimilarityBatchParallel(
    const float* query,
    const float* vectors,
    float* results,
    size_t numVectors,
    size_t dim
) {
    #pragma omp parallel for schedule(static)
    for (size_t i = 0; i < numVectors; i++) {
        results[i] = cosineSimilarity(query, vectors + i * dim, dim);
    }
}

// ============================================================
// 并行 Top-K 搜索
// ============================================================

struct ResultItem {
    float score;
    size_t index;
    
    bool operator<(const ResultItem& other) const {
        return score > other.score;  // 小顶堆
    }
};

void topKSearchParallel(
    const float* query,
    const float* vectors,
    size_t numVectors,
    size_t dim,
    size_t k,
    float* outScores,
    size_t* outIndices
) {
    // 线程局部结果
    const int numThreads = omp_get_max_threads();
    std::vector<std::vector<ResultItem>> localResults(numThreads);
    
    for (auto& results : localResults) {
        results.reserve(k);
    }
    
    // 并行计算
    #pragma omp parallel
    {
        const int threadId = omp_get_thread_num();
        auto& myResults = localResults[threadId];
        
        #pragma omp for schedule(static)
        for (size_t i = 0; i < numVectors; i++) {
            float score = cosineSimilarity(query, vectors + i * dim, dim);
            
            // 维护 Top-K
            if (myResults.size() < k) {
                myResults.push_back({score, i});
                std::push_heap(myResults.begin(), myResults.end());
            } else if (score > myResults[0].score) {
                std::pop_heap(myResults.begin(), myResults.end());
                myResults.back() = {score, i};
                std::push_heap(myResults.begin(), myResults.end());
            }
        }
    }
            
            float sum = 0, norm_q = 0, norm_v = 0;
    // 合并所有线程的结果
    std::vector<ResultItem> finalResults;
    finalResults.reserve(k * numThreads);
    
    for (const auto& local : localResults) {
        for (const auto& item : local) {
            if (finalResults.size() < k) {
                finalResults.push_back(item);
                std::push_heap(finalResults.begin(), finalResults.end());
            } else if (item.score > finalResults[0].score) {
                std::pop_heap(finalResults.begin(), finalResults.end());
                finalResults.back() = item;
                std::push_heap(finalResults.begin(), finalResults.end());
            }
        }
    }
    
    // 排序输出
    std::sort(finalResults.begin(), finalResults.end(), 
              [](const ResultItem& a, const ResultItem& b) { return a.score > b.score; });
    
    for (size_t i = 0; i < k && i < finalResults.size(); i++) {
        outScores[i] = finalResults[i].score;
        outIndices[i] = finalResults[i].index;
    }
}

// ============================================================
// Node.js 绑定
// ============================================================

Napi::Value CosineSimilarityBatchParallel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Float32Array vectors = info[1].As<Napi::Float32Array>();
    size_t dim = info[2].As<Napi::Number>().Uint32Value();
    
    size_t numVectors = vectors.ElementLength() / dim;
    
    Napi::Float32Array results = Napi::Float32Array::New(env, numVectors);
    
    cosineSimilarityBatchParallel(
        query.Data(),
        vectors.Data(),
        results.Data(),
        numVectors,
        dim
    );
    
    return results;
}

Napi::Value TopKSearchParallel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 4) {
        Napi::TypeError::New(env, "Expected 4 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Float32Array vectors = info[1].As<Napi::Float32Array>();
    size_t dim = info[2].As<Napi::Number>().Uint32Value();
    size_t k = info[3].As<Napi::Number>().Uint32Value();
    
    size_t numVectors = vectors.ElementLength() / dim;
    
    Napi::Float32Array scores = Napi::Float32Array::New(env, k);
    Napi::Uint32Array indices = Napi::Uint32Array::New(env, k);
    
    // 创建临时 size_t 数组
    std::vector<size_t> indicesTemp(k);
    
    topKSearchParallel(
        query.Data(),
        vectors.Data(),
        numVectors,
        dim,
        k,
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

Napi::Value GetThreadCount(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), omp_get_max_threads());
}

Napi::Value SetThreadCount(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected 1 argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int numThreads = info[0].As<Napi::Number>().Int32Value();
    omp_set_num_threads(numThreads);
    
    return env.Undefined();
}

}  // namespace parallel
}  // namespace yuanling

// ============================================================
// 模块初始化（必须在命名空间外）
// ============================================================

Napi::Object InitParallelModule(Napi::Env env, Napi::Object exports) {
    exports.Set("cosineSimilarityBatchParallel", Napi::Function::New(env, yuanling::parallel::CosineSimilarityBatchParallel));
    exports.Set("topKSearchParallel", Napi::Function::New(env, yuanling::parallel::TopKSearchParallel));
    exports.Set("getThreadCount", Napi::Function::New(env, yuanling::parallel::GetThreadCount));
    exports.Set("setThreadCount", Napi::Function::New(env, yuanling::parallel::SetThreadCount));
    return exports;
}

NODE_API_MODULE(parallel, InitParallelModule)
