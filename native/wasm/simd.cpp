/**
 * @file simd.cpp
 * @brief WASM SIMD 模块
 * 
 * 使用 Emscripten 编译：
 * emcc -O3 -msimd128 -msse4.2 -o simd.wasm simd.cpp
 */

#include <wasm_simd128.h>
#include <cmath>
#include <vector>

extern "C" {

// ============================================================
// WASM SIMD 余弦相似度
// ============================================================

float cosine_similarity_wasm(const float* a, const float* b, int len) {
    v128_t sum = wasm_f32x4_splat(0.0f);
    v128_t norm_a = wasm_f32x4_splat(0.0f);
    v128_t norm_b = wasm_f32x4_splat(0.0f);
    
    int i = 0;
    
    // 主循环：每次处理 4 个 float
    for (; i + 4 <= len; i += 4) {
        v128_t va = wasm_v128_load(a + i);
        v128_t vb = wasm_v128_load(b + i);
        
        sum = wasm_f32x4_add(sum, wasm_f32x4_mul(va, vb));
        norm_a = wasm_f32x4_add(norm_a, wasm_f32x4_mul(va, va));
        norm_b = wasm_f32x4_add(norm_b, wasm_f32x4_mul(vb, vb));
    }
    
    // 水平求和
    float dot = wasm_f32x4_extract_lane<0>(sum) + 
                wasm_f32x4_extract_lane<1>(sum) +
                wasm_f32x4_extract_lane<2>(sum) + 
                wasm_f32x4_extract_lane<3>(sum);
    
    float na = wasm_f32x4_extract_lane<0>(norm_a) + 
               wasm_f32x4_extract_lane<1>(norm_a) +
               wasm_f32x4_extract_lane<2>(norm_a) + 
               wasm_f32x4_extract_lane<3>(norm_a);
    
    float nb = wasm_f32x4_extract_lane<0>(norm_b) + 
               wasm_f32x4_extract_lane<1>(norm_b) +
               wasm_f32x4_extract_lane<2>(norm_b) + 
               wasm_f32x4_extract_lane<3>(norm_b);
    
    // 处理剩余元素
    for (; i < len; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    
    if (na == 0 || nb == 0) return 0.0f;
    return dot / (std::sqrt(na) * std::sqrt(nb));
}

// ============================================================
// WASM SIMD 批量余弦相似度
// ============================================================

void cosine_similarity_batch_wasm(
    const float* query,
    const float* vectors,
    float* results,
    int dim,
    int numVectors
) {
    // 预计算查询向量范数
    v128_t norm_q_vec = wasm_f32x4_splat(0.0f);
    for (int i = 0; i + 4 <= dim; i += 4) {
        v128_t v = wasm_v128_load(query + i);
        norm_q_vec = wasm_f32x4_add(norm_q_vec, wasm_f32x4_mul(v, v));
    }
    
    float norm_q = wasm_f32x4_extract_lane<0>(norm_q_vec) + 
                   wasm_f32x4_extract_lane<1>(norm_q_vec) +
                   wasm_f32x4_extract_lane<2>(norm_q_vec) + 
                   wasm_f32x4_extract_lane<3>(norm_q_vec);
    
    for (int i = (dim / 4) * 4; i < dim; i++) {
        norm_q += query[i] * query[i];
    }
    norm_q = std::sqrt(norm_q);
    
    // 批量计算
    for (int v = 0; v < numVectors; v++) {
        const float* vec = vectors + v * dim;
        
        v128_t sum = wasm_f32x4_splat(0.0f);
        v128_t norm_v = wasm_f32x4_splat(0.0f);
        
        for (int i = 0; i + 4 <= dim; i += 4) {
            v128_t a = wasm_v128_load(query + i);
            v128_t b = wasm_v128_load(vec + i);
            
            sum = wasm_f32x4_add(sum, wasm_f32x4_mul(a, b));
            norm_v = wasm_f32x4_add(norm_v, wasm_f32x4_mul(b, b));
        }
        
        float dot = wasm_f32x4_extract_lane<0>(sum) + 
                    wasm_f32x4_extract_lane<1>(sum) +
                    wasm_f32x4_extract_lane<2>(sum) + 
                    wasm_f32x4_extract_lane<3>(sum);
        
        float nv = wasm_f32x4_extract_lane<0>(norm_v) + 
                   wasm_f32x4_extract_lane<1>(norm_v) +
                   wasm_f32x4_extract_lane<2>(norm_v) + 
                   wasm_f32x4_extract_lane<3>(norm_v);
        
        for (int i = (dim / 4) * 4; i < dim; i++) {
            dot += query[i] * vec[i];
            nv += vec[i] * vec[i];
        }
        
        results[v] = (norm_q > 0 && nv > 0) ? dot / (norm_q * std::sqrt(nv)) : 0;
    }
}

// ============================================================
// WASM SIMD 向量归一化
// ============================================================

void normalize_wasm(float* vec, int len) {
    v128_t sum = wasm_f32x4_splat(0.0f);
    
    for (int i = 0; i + 4 <= len; i += 4) {
        v128_t v = wasm_v128_load(vec + i);
        sum = wasm_f32x4_add(sum, wasm_f32x4_mul(v, v));
    }
    
    float norm = wasm_f32x4_extract_lane<0>(sum) + 
                 wasm_f32x4_extract_lane<1>(sum) +
                 wasm_f32x4_extract_lane<2>(sum) + 
                 wasm_f32x4_extract_lane<3>(sum);
    
    for (int i = (len / 4) * 4; i < len; i++) {
        norm += vec[i] * vec[i];
    }
    
    norm = std::sqrt(norm);
    
    if (norm > 0) {
        v128_t inv_norm = wasm_f32x4_splat(1.0f / norm);
        for (int i = 0; i + 4 <= len; i += 4) {
            v128_t v = wasm_v128_load(vec + i);
            v = wasm_f32x4_mul(v, inv_norm);
            wasm_v128_store(vec + i, v);
        }
        for (int i = (len / 4) * 4; i < len; i++) {
            vec[i] /= norm;
        }
    }
}

// ============================================================
// WASM SIMD 点积
// ============================================================

float dot_product_wasm(const float* a, const float* b, int len) {
    v128_t sum = wasm_f32x4_splat(0.0f);
    
    int i = 0;
    for (; i + 4 <= len; i += 4) {
        v128_t va = wasm_v128_load(a + i);
        v128_t vb = wasm_v128_load(b + i);
        sum = wasm_f32x4_add(sum, wasm_f32x4_mul(va, vb));
    }
    
    float result = wasm_f32x4_extract_lane<0>(sum) + 
                   wasm_f32x4_extract_lane<1>(sum) +
                   wasm_f32x4_extract_lane<2>(sum) + 
                   wasm_f32x4_extract_lane<3>(sum);
    
    for (; i < len; i++) {
        result += a[i] * b[i];
    }
    
    return result;
}

} // extern "C"
