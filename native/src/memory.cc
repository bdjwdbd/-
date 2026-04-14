/**
 * @file memory.cc
 * @brief 内存优化模块
 * 
 * 功能：
 * 1. 大页内存分配
 * 2. 内存对齐
 * 3. 内存池
 */

#include <napi.h>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <map>

#ifdef __linux__
#include <sys/mman.h>
#include <unistd.h>
#endif

namespace yuanling {
namespace memory {

// ============================================================
// 内存信息
// ============================================================

struct MemoryInfo {
    size_t pageSize;
    size_t hugePageSize;
    bool hugePagesAvailable;
    size_t totalMemory;
    size_t freeMemory;
};

MemoryInfo getMemoryInfo() {
    MemoryInfo info;
    info.pageSize = 4096;  // 默认 4KB
    info.hugePageSize = 2 * 1024 * 1024;  // 默认 2MB
    info.hugePagesAvailable = false;
    info.totalMemory = 0;
    info.freeMemory = 0;
    
#ifdef __linux__
    info.pageSize = sysconf(_SC_PAGESIZE);
    
    // 检查大页内存
    FILE* meminfo = fopen("/proc/meminfo", "r");
    if (meminfo) {
        char line[256];
        while (fgets(line, sizeof(line), meminfo)) {
            if (strstr(line, "Hugepagesize:")) {
                sscanf(line, "Hugepagesize: %zu kB", &info.hugePageSize);
                info.hugePageSize *= 1024;  // 转换为字节
                info.hugePagesAvailable = true;
            }
            if (strstr(line, "MemTotal:")) {
                sscanf(line, "MemTotal: %zu kB", &info.totalMemory);
                info.totalMemory *= 1024;
            }
            if (strstr(line, "MemFree:")) {
                sscanf(line, "MemFree: %zu kB", &info.freeMemory);
                info.freeMemory *= 1024;
            }
        }
        fclose(meminfo);
    }
#endif
    
    return info;
}

static MemoryInfo g_memInfo;

// ============================================================
// 对齐内存分配
// ============================================================

void* alignedAlloc(size_t size, size_t alignment) {
    void* ptr = nullptr;
#ifdef _WIN32
    ptr = _aligned_malloc(size, alignment);
#else
    posix_memalign(&ptr, alignment, size);
#endif
    return ptr;
}

void alignedFree(void* ptr) {
#ifdef _WIN32
    _aligned_free(ptr);
#else
    free(ptr);
#endif
}

// ============================================================
// 大页内存分配
// ============================================================

void* hugePageAlloc(size_t size) {
#ifdef __linux__
    // 对齐到大页大小
    size_t alignedSize = ((size + g_memInfo.hugePageSize - 1) / g_memInfo.hugePageSize) * g_memInfo.hugePageSize;
    
    void* ptr = mmap(
        nullptr,
        alignedSize,
        PROT_READ | PROT_WRITE,
        MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB,
        -1,
        0
    );
    
    if (ptr != MAP_FAILED) {
        return ptr;
    }
#endif
    
    // 回退到普通内存
    return alignedAlloc(size, 64);
}

void hugePageFree(void* ptr, size_t size) {
#ifdef __linux__
    size_t alignedSize = ((size + g_memInfo.hugePageSize - 1) / g_memInfo.hugePageSize) * g_memInfo.hugePageSize;
    munmap(ptr, alignedSize);
#else
    alignedFree(ptr);
#endif
}

// ============================================================
// 内存池
// ============================================================

class MemoryPool {
private:
    std::map<size_t, std::vector<void*>> pools;
    size_t totalAllocated;
    size_t maxPoolSize;
    
public:
    MemoryPool(size_t maxSize = 100 * 1024 * 1024) 
        : totalAllocated(0), maxPoolSize(maxSize) {}
    
    ~MemoryPool() {
        clear();
    }
    
    void* alloc(size_t size) {
        // 对齐大小
        size_t alignedSize = ((size + 63) / 64) * 64;
        
        // 检查池中是否有可用内存
        auto& pool = pools[alignedSize];
        if (!pool.empty()) {
            void* ptr = pool.back();
            pool.pop_back();
            return ptr;
        }
        
        // 检查是否超过最大限制
        if (totalAllocated + alignedSize > maxPoolSize) {
            return nullptr;
        }
        
        // 分配新内存
        totalAllocated += alignedSize;
        return alignedAlloc(alignedSize, 64);
    }
    
    void free(void* ptr, size_t size) {
        size_t alignedSize = ((size + 63) / 64) * 64;
        
        auto& pool = pools[alignedSize];
        
        // 限制池大小
        if (pool.size() < 100) {
            memset(ptr, 0, alignedSize);  // 清零
            pool.push_back(ptr);
        } else {
            alignedFree(ptr);
            totalAllocated -= alignedSize;
        }
    }
    
    void clear() {
        for (auto& [size, pool] : pools) {
            for (void* ptr : pool) {
                alignedFree(ptr);
            }
            pool.clear();
        }
        pools.clear();
        totalAllocated = 0;
    }
    
    size_t getTotalAllocated() const { return totalAllocated; }
    size_t getMaxPoolSize() const { return maxPoolSize; }
};

static MemoryPool g_pool;

// ============================================================
// Node.js 绑定
// ============================================================

Napi::Value GetMemoryInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object obj = Napi::Object::New(env);
    
    obj.Set("pageSize", Napi::Number::New(env, g_memInfo.pageSize));
    obj.Set("hugePageSize", Napi::Number::New(env, g_memInfo.hugePageSize));
    obj.Set("hugePagesAvailable", Napi::Boolean::New(env, g_memInfo.hugePagesAvailable));
    obj.Set("totalMemory", Napi::Number::New(env, g_memInfo.totalMemory));
    obj.Set("freeMemory", Napi::Number::New(env, g_memInfo.freeMemory));
    
    return obj;
}

Napi::Value AlignedAlloc(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected size argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    size_t size = info[0].As<Napi::Number>().Uint32Value();
    size_t alignment = info.Length() > 1 ? info[1].As<Napi::Number>().Uint32Value() : 64;
    
    void* ptr = alignedAlloc(size, alignment);
    
    if (!ptr) {
        Napi::Error::New(env, "Failed to allocate memory").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // 返回 Buffer
    return Napi::Buffer<void>::New(env, ptr, size, [](Napi::Env env, void* data) {
        alignedFree(data);
    });
}

Napi::Value HugePageAlloc(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected size argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    size_t size = info[0].As<Napi::Number>().Uint32Value();
    
    void* ptr = hugePageAlloc(size);
    
    if (!ptr) {
        Napi::Error::New(env, "Failed to allocate huge page memory").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    return Napi::Buffer<void>::New(env, ptr, size, [](Napi::Env env, void* data) {
        hugePageFree(data, 0);  // size 在回调中不可用，需要改进
    });
}

Napi::Value PoolAlloc(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected size argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    size_t size = info[0].As<Napi::Number>().Uint32Value();
    
    void* ptr = g_pool.alloc(size);
    
    if (!ptr) {
        Napi::Error::New(env, "Memory pool exhausted").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    return Napi::Buffer<void>::New(env, ptr, size, [size](Napi::Env env, void* data) {
        g_pool.free(data, size);
    });
}

Napi::Value GetPoolStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object obj = Napi::Object::New(env);
    
    obj.Set("totalAllocated", Napi::Number::New(env, g_pool.getTotalAllocated()));
    obj.Set("maxPoolSize", Napi::Number::New(env, g_pool.getMaxPoolSize()));
    
    return obj;
}

// ============================================================
// 模块初始化
// ============================================================

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // 获取内存信息
    g_memInfo = getMemoryInfo();
    
    exports.Set("getMemoryInfo", Napi::Function::New(env, GetMemoryInfo));
    exports.Set("alignedAlloc", Napi::Function::New(env, AlignedAlloc));
    exports.Set("hugePageAlloc", Napi::Function::New(env, HugePageAlloc));
    exports.Set("poolAlloc", Napi::Function::New(env, PoolAlloc));
    exports.Set("getPoolStats", Napi::Function::New(env, GetPoolStats));
    
    return exports;
}

NODE_API_MODULE(memory, Init)

} // namespace memory
} // namespace yuanling
