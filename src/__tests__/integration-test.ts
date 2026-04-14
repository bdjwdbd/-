/**
 * 元灵系统 v4.0 集成测试
 */

import {
  HybridSearchEngine,
  HNSWIndex,
  VectorQuantizer,
  HealthMonitor,
  SmartMemoryUpgrader,
  PersonaManager,
  TokenEstimator,
  CacheSystem,
} from "../index";

// ============================================================
// 测试函数
// ============================================================

async function runTests() {
  console.log("=== 元灵系统 v4.0 集成测试 ===\n");
  
  // 1. 健康监控测试
  console.log("1. 健康监控测试...");
  const monitor = new HealthMonitor();
  const health = await monitor.checkHealth();
  console.log("   状态:", health.status);
  console.log("   消息:", health.message);
  
  const coverage = await monitor.getCoverageStats();
  console.log("   向量覆盖率:", (coverage.totalCoverage * 100).toFixed(1) + "%");
  
  // 2. HNSW 索引测试
  console.log("\n2. HNSW 索引测试...");
  const hnsw = new HNSWIndex({
    dimensions: 128,
    maxConnections: 16,
    efConstruction: 100,
    efSearch: 50,
  });
  
  // 添加测试向量
  for (let i = 0; i < 100; i++) {
    const vec = Array.from({ length: 128 }, () => Math.random());
    hnsw.add(`test-${i}`, vec);
  }
  
  console.log("   节点数:", hnsw.size());
  const stats = hnsw.getStats();
  console.log("   平均连接数:", stats.avgConnections.toFixed(2));
  
  // 3. 向量量化测试
  console.log("\n3. 向量量化测试...");
  const quantizer = new VectorQuantizer({
    type: "int8",
    dimensions: 128,
  });
  
  const testVectors = Array.from({ length: 10 }, () => 
    new Float32Array(Array.from({ length: 128 }, () => Math.random()))
  );
  
  quantizer.fit(testVectors);
  const encoded = quantizer.encode(testVectors);
  console.log("   压缩比:", quantizer.getCompressionRatio() + "x");
  console.log("   原始大小:", testVectors[0].length * 4, "bytes");
  console.log("   量化后:", encoded[0].data.length, "bytes");
  
  // 4. Token 估算测试
  console.log("\n4. Token 估算测试...");
  const estimator = new TokenEstimator();
  const text = "这是一段测试文本，用于测试 Token 估算器的性能。";
  const tokens = estimator.estimate(text);
  console.log("   文本:", text);
  console.log("   Token 数:", tokens);
  
  // 5. 缓存系统测试
  console.log("\n5. 缓存系统测试...");
  const cache = new CacheSystem();
  const key = cache.generateKey("test-key");
  cache.set(key, { data: "test-value" });
  const cached = cache.get(key);
  console.log("   缓存命中:", cached !== null);
  console.log("   缓存统计:", cache.getStats());
  
  // 6. 性能基准测试
  console.log("\n6. 性能基准测试...");
  
  // HNSW 搜索性能
  const queryVec = Array.from({ length: 128 }, () => Math.random());
  const startSearch = Date.now();
  for (let i = 0; i < 100; i++) {
    hnsw.search(queryVec, 10);
  }
  const searchTime = Date.now() - startSearch;
  console.log("   HNSW 搜索 100 次:", searchTime, "ms");
  console.log("   平均每次:", (searchTime / 100).toFixed(2), "ms");
  
  console.log("\n=== 所有测试完成 ===");
  
  // 清理
  monitor.close();
}

// 运行测试
runTests().catch(console.error);
