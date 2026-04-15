/**
 * @file hnsw.cc
 * @brief HNSW (Hierarchical Navigable Small World) 索引原生实现
 * 
 * 功能：
 * 1. 高效近似最近邻搜索
 * 2. 多层图结构
 * 3. 动态插入
 * 4. SIMD 优化距离计算
 */

#include <napi.h>
#include <cmath>
#include <vector>
#include <queue>
#include <unordered_map>
#include <random>
#include <algorithm>
#include <immintrin.h>
#include <limits>

namespace yuanling {
namespace hnsw {

// ============================================================
// 类型定义
// ============================================================

using NodeId = size_t;
using LayerId = int;
using Distance = float;

struct Node {
    NodeId id;
    std::vector<float> vector;
    std::vector<std::vector<NodeId>> neighbors;  // 每层的邻居
    int maxLayer;
};

struct SearchResult {
    NodeId id;
    Distance distance;
    bool operator<(const SearchResult& other) const {
        return distance < other.distance;  // 小顶堆
    }
};

// ============================================================
// 配置
// ============================================================

struct HNSWConfig {
    size_t maxElements = 1000000;
    size_t M = 16;                    // 每层最大连接数
    size_t efConstruction = 200;      // 构建时的搜索宽度
    size_t efSearch = 50;             // 搜索时的搜索宽度
    double mL = 1.0 / log(2.0);       // 层级乘数
    size_t dimensions = 128;
    bool normalize = true;
};

// ============================================================
// 距离计算
// ============================================================

inline float cosineDistance(const float* a, const float* b, size_t dim) {
    __m256 sum_vec = _mm256_setzero_ps();
    __m256 norm_a_vec = _mm256_setzero_ps();
    __m256 norm_b_vec = _mm256_setzero_ps();
    
    size_t i = 0;
    for (; i + 8 <= dim; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        sum_vec = _mm256_fmadd_ps(va, vb, sum_vec);
        norm_a_vec = _mm256_fmadd_ps(va, va, norm_a_vec);
        norm_b_vec = _mm256_fmadd_ps(vb, vb, norm_b_vec);
    }
    
    float sum = 0, norm_a = 0, norm_b = 0;
    for (int j = 0; j < 8; j++) {
        sum += ((float*)&sum_vec)[j];
        norm_a += ((float*)&norm_a_vec)[j];
        norm_b += ((float*)&norm_b_vec)[j];
    }
    
    for (; i < dim; i++) {
        sum += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    
    float similarity = sum / (std::sqrt(norm_a) * std::sqrt(norm_b) + 1e-10f);
    return 1.0f - similarity;  // 距离 = 1 - 相似度
}

// ============================================================
// HNSW 索引
// ============================================================

class HNSWIndex {
public:
    HNSWIndex(const HNSWConfig& config) : config_(config) {
        nodes_.reserve(config.maxElements);
        std::random_device rd;
        rng_.seed(rd());
    }
    
    // 插入节点
    void insert(NodeId id, const float* vector) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        // 复制向量
        std::vector<float> vec(vector, vector + config_.dimensions);
        
        // 计算层级
        int layer = randomLayer();
        
        // 创建节点
        Node node;
        node.id = id;
        node.vector = std::move(vec);
        node.maxLayer = layer;
        node.neighbors.resize(layer + 1);
        
        // 第一个节点
        if (nodes_.empty()) {
            nodes_.push_back(std::move(node));
            entryPoint_ = 0;
            maxLayer_ = layer;
            return;
        }
        
        // 从入口点开始搜索
        NodeId currNode = entryPoint_;
        Distance currDist = cosineDistance(node.vector.data(), 
                                           nodes_[currNode].vector.data(), 
                                           config_.dimensions);
        
        // 从最高层向下搜索
        for (int lc = maxLayer_; lc > layer; lc--) {
            bool changed = true;
            while (changed) {
                changed = false;
                for (NodeId neighbor : nodes_[currNode].neighbors[lc]) {
                    Distance dist = cosineDistance(node.vector.data(),
                                                   nodes_[neighbor].vector.data(),
                                                   config_.dimensions);
                    if (dist < currDist) {
                        currNode = neighbor;
                        currDist = dist;
                        changed = true;
                    }
                }
            }
        }
        
        // 在每层插入
        for (int lc = std::min(layer, maxLayer_); lc >= 0; lc--) {
            auto candidates = searchLayer(node.vector.data(), currNode, lc, config_.efConstruction);
            
            // 选择最近的 M 个邻居
            std::vector<NodeId> neighbors;
            for (const auto& c : candidates) {
                if (neighbors.size() >= config_.M) break;
                neighbors.push_back(c.id);
            }
            
            node.neighbors[lc] = neighbors;
            
            // 双向连接
            for (NodeId neighbor : neighbors) {
                addConnection(neighbor, id, lc);
            }
            
            if (!candidates.empty()) {
                currNode = candidates[0].id;
            }
        }
        
        // 更新入口点
        if (layer > maxLayer_) {
            entryPoint_ = nodes_.size();
            maxLayer_ = layer;
        }
        
        nodes_.push_back(std::move(node));
    }
    
    // 搜索
    std::vector<SearchResult> search(const float* query, size_t k) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        if (nodes_.empty()) {
            return {};
        }
        
        NodeId currNode = entryPoint_;
        Distance currDist = cosineDistance(query, 
                                           nodes_[currNode].vector.data(), 
                                           config_.dimensions);
        
        // 从最高层向下搜索
        for (int lc = maxLayer_; lc > 0; lc--) {
            bool changed = true;
            while (changed) {
                changed = false;
                for (NodeId neighbor : nodes_[currNode].neighbors[lc]) {
                    Distance dist = cosineDistance(query,
                                                   nodes_[neighbor].vector.data(),
                                                   config_.dimensions);
                    if (dist < currDist) {
                        currNode = neighbor;
                        currDist = dist;
                        changed = true;
                    }
                }
            }
        }
        
        // 在底层搜索
        auto candidates = searchLayer(query, currNode, 0, config_.efSearch);
        
        // 返回 Top-K
        std::vector<SearchResult> results;
        for (size_t i = 0; i < k && i < candidates.size(); i++) {
            results.push_back(candidates[i]);
        }
        
        return results;
    }
    
    // 获取统计信息
    size_t size() const { return nodes_.size(); }
    size_t dimensions() const { return config_.dimensions; }
    int maxLayer() const { return maxLayer_; }
    
private:
    // 随机层级
    int randomLayer() {
        std::uniform_real_distribution<double> dist(0.0, 1.0);
        double r = -log(dist(rng_)) * config_.mL;
        return static_cast<int>(r);
    }
    
    // 在单层搜索
    std::vector<SearchResult> searchLayer(const float* query, NodeId entry, int layer, size_t ef) {
        std::priority_queue<SearchResult> candidates;  // 小顶堆
        std::unordered_map<NodeId, bool> visited;
        
        Distance dist = cosineDistance(query, nodes_[entry].vector.data(), config_.dimensions);
        candidates.push({entry, dist});
        visited[entry] = true;
        
        std::priority_queue<SearchResult> results;  // 大顶堆（距离最小的在顶）
        
        while (!candidates.empty()) {
            SearchResult curr = candidates.top();
            candidates.pop();
            
            if (results.size() >= ef && curr.distance > results.top().distance) {
                break;
            }
            
            for (NodeId neighbor : nodes_[curr.id].neighbors[layer]) {
                if (visited[neighbor]) continue;
                visited[neighbor] = true;
                
                Distance d = cosineDistance(query, nodes_[neighbor].vector.data(), config_.dimensions);
                
                if (results.size() < ef || d < results.top().distance) {
                    candidates.push({neighbor, d});
                    results.push({neighbor, d});
                    
                    if (results.size() > ef) {
                        results.pop();
                    }
                }
            }
        }
        
        // 转换为有序结果
        std::vector<SearchResult> sorted;
        while (!results.empty()) {
            sorted.push_back(results.top());
            results.pop();
        }
        std::reverse(sorted.begin(), sorted.end());
        
        return sorted;
    }
    
    // 添加连接
    void addConnection(NodeId from, NodeId to, int layer) {
        auto& neighbors = nodes_[from].neighbors[layer];
        
        if (neighbors.size() < config_.M) {
            neighbors.push_back(to);
        } else {
            // 替换最远的邻居
            Distance maxDist = 0;
            size_t maxIdx = 0;
            
            for (size_t i = 0; i < neighbors.size(); i++) {
                Distance d = cosineDistance(nodes_[from].vector.data(),
                                           nodes_[neighbors[i]].vector.data(),
                                           config_.dimensions);
                if (d > maxDist) {
                    maxDist = d;
                    maxIdx = i;
                }
            }
            
            Distance newDist = cosineDistance(nodes_[from].vector.data(),
                                             nodes_[to].vector.data(),
                                             config_.dimensions);
            
            if (newDist < maxDist) {
                neighbors[maxIdx] = to;
            }
        }
    }
    
    HNSWConfig config_;
    std::vector<Node> nodes_;
    NodeId entryPoint_ = 0;
    int maxLayer_ = 0;
    std::mt19937 rng_;
    std::mutex mutex_;
};

// ============================================================
// Node.js 绑定
// ============================================================

class HNSWIndexWrapper : public Napi::ObjectWrap<HNSWIndexWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::HandleScope scope(env);
        
        Napi::Function func = DefineClass(env, "HNSWIndex", {
            InstanceMethod("insert", &HNSWIndexWrapper::Insert),
            InstanceMethod("search", &HNSWIndexWrapper::Search),
            InstanceMethod("size", &HNSWIndexWrapper::Size),
        });
        
        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);
        
        exports.Set("HNSWIndex", func);
        return exports;
    }
    
    HNSWIndexWrapper(const Napi::CallbackInfo& info) : Napi::ObjectWrap<HNSWIndexWrapper>(info) {
        Napi::Env env = info.Env();
        
        HNSWConfig config;
        if (info.Length() > 0 && info[0].IsObject()) {
            Napi::Object obj = info[0].As<Napi::Object>();
            if (obj.Has("M")) config.M = obj.Get("M").As<Napi::Number>().Uint32Value();
            if (obj.Has("efConstruction")) config.efConstruction = obj.Get("efConstruction").As<Napi::Number>().Uint32Value();
            if (obj.Has("efSearch")) config.efSearch = obj.Get("efSearch").As<Napi::Number>().Uint32Value();
            if (obj.Has("dimensions")) config.dimensions = obj.Get("dimensions").As<Napi::Number>().Uint32Value();
        }
        
        index_ = new HNSWIndex(config);
    }
    
    ~HNSWIndexWrapper() {
        delete index_;
    }
    
private:
    Napi::Value Insert(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected id and vector").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        NodeId id = info[0].As<Napi::Number>().Uint32Value();
        Napi::Float32Array vec = info[1].As<Napi::Float32Array>();
        
        index_->insert(id, vec.Data());
        
        return env.Undefined();
    }
    
    Napi::Value Search(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected query and k").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        Napi::Float32Array query = info[0].As<Napi::Float32Array>();
        size_t k = info[1].As<Napi::Number>().Uint32Value();
        
        auto results = index_->search(query.Data(), k);
        
        Napi::Array arr = Napi::Array::New(env, results.size());
        for (size_t i = 0; i < results.size(); i++) {
            Napi::Object obj = Napi::Object::New(env);
            obj.Set("id", Napi::Number::New(env, results[i].id));
            obj.Set("distance", Napi::Number::New(env, results[i].distance));
            arr.Set(i, obj);
        }
        
        return arr;
    }
    
    Napi::Value Size(const Napi::CallbackInfo& info) {
        return Napi::Number::New(info.Env(), index_->size());
    }
    
    HNSWIndex* index_;
};

// ============================================================
// 模块初始化
// ============================================================

Napi::Object InitHNSWModule(Napi::Env env, Napi::Object exports) {
    return HNSWIndexWrapper::Init(env, exports);
}

}  // namespace hnsw
}  // namespace yuanling

NODE_API_MODULE(hnsw, yuanling::hnsw::InitHNSWModule)
