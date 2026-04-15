/**
 * @file vnni.cc
 * @brief VNNI (Vector Neural Network Instructions) 加速模块
 * 
 * 功能：
 * 1. INT8 点积计算
 * 2. INT8 矩阵乘法
 * 3. 两阶段搜索
 */

#include <napi.h>
#include <vector>
#include <immintrin.h>
#include <algorithm>
#include <cmath>

namespace yuanling {
namespace vnni {

// ============================================================
// INT8 点积 (VNNI 加速)
// ============================================================

int32_t dotProductInt8VNNI(const int8_t* a, const int8_t* b, size_t len) {
    __m512i sum = _mm512_setzero_si512();
    
    size_t i = 0;
    
    // VNNI: vpdpbusd 指令
    // 每次处理 64 个 INT8
    for (; i + 64 <= len; i += 64) {
        __m512i va = _mm512_loadu_si512(reinterpret_cast<const __m512i*>(a + i));
        __m512i vb = _mm512_loadu_si512(reinterpret_cast<const __m512i*>(b + i));
        
        // VNNI 指令：INT8 点积累加到 INT32
        sum = _mm512_dpbusd_epi32(sum, va, vb);
    }
    
    // 水平求和
    int32_t result = _mm512_reduce_add_epi32(sum);
    
    // 处理剩余元素
    for (; i < len; i++) {
        result += static_cast<int32_t>(a[i]) * static_cast<int32_t>(b[i]);
    }
    
    return result;
}

// ============================================================
// INT8 点积 (标量回退)
// ============================================================

int32_t dotProductInt8Scalar(const int8_t* a, const int8_t* b, size_t len) {
    int32_t result = 0;
    for (size_t i = 0; i < len; i++) {
        result += static_cast<int32_t>(a[i]) * static_cast<int32_t>(b[i]);
    }
    return result;
}

// ============================================================
// INT8 量化器
// ============================================================

class INT8Quantizer {
public:
    float scale;
    
    void calibrate(const float* data, size_t len) {
        float maxAbs = 0;
        for (size_t i = 0; i < len; i++) {
            maxAbs = std::max(maxAbs, std::abs(data[i]));
        }
        scale = maxAbs / 127.0f;
    }
    
    void encode(const float* input, int8_t* output, size_t len) {
        for (size_t i = 0; i < len; i++) {
            float val = input[i] / scale;
            output[i] = static_cast<int8_t>(std::max(-128.0f, std::min(127.0f, std::round(val))));
        }
    }
    
    void decode(const int8_t* input, float* output, size_t len) {
        for (size_t i = 0; i < len; i++) {
            output[i] = static_cast<float>(input[i]) * scale;
        }
    }
};

// ============================================================
// 两阶段搜索器
// ============================================================

class TwoStageSearcher {
private:
    std::vector<std::vector<int8_t>> quantizedVectors;
    std::vector<std::vector<float>> originalVectors;
    INT8Quantizer quantizer;
    size_t dim;
    bool useVNNI;
    
public:
    TwoStageSearcher(size_t dimension, bool vnni = true) 
        : dim(dimension), useVNNI(vnni) {}
    
    void addVectors(const std::vector<std::vector<float>>& vectors) {
        // 校准量化器
        std::vector<float> allData;
        for (const auto& vec : vectors) {
            allData.insert(allData.end(), vec.begin(), vec.end());
        }
        quantizer.calibrate(allData.data(), allData.size());
        
        // 量化所有向量
        for (const auto& vec : vectors) {
            std::vector<int8_t> quantized(dim);
            quantizer.encode(vec.data(), quantized.data(), dim);
            quantizedVectors.push_back(quantized);
            originalVectors.push_back(vec);
        }
    }
    
    std::vector<std::pair<size_t, float>> search(
        const float* query, 
        size_t topK, 
        size_t rerankK = 100
    ) {
        // 阶段1：INT8 粗筛
        std::vector<int8_t> queryInt8(dim);
        quantizer.encode(query, queryInt8.data(), dim);
        
        std::vector<std::pair<int32_t, size_t>> coarseScores;
        for (size_t i = 0; i < quantizedVectors.size(); i++) {
            int32_t score;
            if (useVNNI) {
                score = dotProductInt8VNNI(queryInt8.data(), quantizedVectors[i].data(), dim);
            } else {
                score = dotProductInt8Scalar(queryInt8.data(), quantizedVectors[i].data(), dim);
            }
            coarseScores.push_back({score, i});
        }
        
        // 排序获取 top-rerankK
        std::partial_sort(
            coarseScores.begin(),
            coarseScores.begin() + std::min(rerankK, coarseScores.size()),
            coarseScores.end(),
            std::greater<>()
        );
        
        // 阶段2：FP32 精确重排
        std::vector<std::pair<size_t, float>> results;
        float queryNorm = 0;
        for (size_t i = 0; i < dim; i++) {
            queryNorm += query[i] * query[i];
        }
        queryNorm = std::sqrt(queryNorm);
        
        for (size_t i = 0; i < std::min(rerankK, coarseScores.size()); i++) {
            size_t idx = coarseScores[i].second;
            const auto& vec = originalVectors[idx];
            
            float dot = 0, norm = 0;
            for (size_t j = 0; j < dim; j++) {
                dot += query[j] * vec[j];
                norm += vec[j] * vec[j];
            }
            
            float score = (queryNorm > 0 && norm > 0) ? dot / (queryNorm * std::sqrt(norm)) : 0;
            results.push_back({idx, score});
        }
        
        // 排序获取 topK
        std::partial_sort(
            results.begin(),
            results.begin() + std::min(topK, results.size()),
            results.end(),
            [](const auto& a, const auto& b) { return a.second > b.second; }
        );
        
        results.resize(std::min(topK, results.size()));
        return results;
    }
};

// ============================================================
// Node.js 绑定
// ============================================================

Napi::Value DotProductInt8(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsTypedArray() || !info[1].IsTypedArray()) {
        Napi::TypeError::New(env, "Expected two TypedArray arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::TypedArray ta1 = info[0].As<Napi::TypedArray>();
    Napi::TypedArray ta2 = info[1].As<Napi::TypedArray>();
    
    if (ta1.TypedArrayType() != napi_int8_array || ta2.TypedArrayType() != napi_int8_array) {
        Napi::TypeError::New(env, "Expected Int8Array arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Int8Array arr1 = info[0].As<Napi::Int8Array>();
    Napi::Int8Array arr2 = info[1].As<Napi::Int8Array>();
    
    if (arr1.ElementLength() != arr2.ElementLength()) {
        Napi::Error::New(env, "Arrays must have the same length").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int32_t result = dotProductInt8VNNI(arr1.Data(), arr2.Data(), arr1.ElementLength());
    
    return Napi::Number::New(env, result);
}

Napi::Value TwoStageSearch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected query, vectors, topK arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Float32Array query = info[0].As<Napi::Float32Array>();
    Napi::Array vectors = info[1].As<Napi::Array>();
    size_t topK = info[2].As<Napi::Number>().Uint32Value();
    size_t rerankK = info.Length() > 3 ? info[3].As<Napi::Number>().Uint32Value() : 100;
    
    size_t dim = query.ElementLength();
    size_t numVectors = vectors.Length();
    
    // 创建搜索器
    TwoStageSearcher searcher(dim, true);
    
    // 添加向量
    std::vector<std::vector<float>> vecs;
    for (size_t i = 0; i < numVectors; i++) {
        Napi::Float32Array vec = vectors.Get(i).As<Napi::Float32Array>();
        vecs.push_back(std::vector<float>(vec.Data(), vec.Data() + dim));
    }
    searcher.addVectors(vecs);
    
    // 搜索
    auto results = searcher.search(query.Data(), topK, rerankK);
    
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

// ============================================================
// 模块初始化
// ============================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("dotProductInt8", Napi::Function::New(env, DotProductInt8));
    exports.Set("twoStageSearch", Napi::Function::New(env, TwoStageSearch));
    
    return exports;
}

NODE_API_MODULE(vnni, Init)

} // namespace vnni
} // namespace yuanling
