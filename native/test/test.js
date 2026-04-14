/**
 * 原生模块测试
 */

const assert = require('assert');

// 测试 SIMD 模块
function testSIMD() {
  console.log('\n=== 测试 SIMD 模块 ===');
  
  try {
    const simd = require('../build/Release/simd.node');
    
    // 测试能力检测
    const caps = simd.getCapabilities();
    console.log('SIMD 能力:', caps);
    
    // 测试余弦相似度
    const a = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const b = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    
    const similarity = simd.cosineSimilarity(a, b);
    console.log('余弦相似度:', similarity);
    assert(Math.abs(similarity - 1.0) < 0.0001, '相同向量相似度应为 1');
    
    // 测试正交向量
    const c = new Float32Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const d = new Float32Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const orthoSim = simd.cosineSimilarity(c, d);
    console.log('正交向量相似度:', orthoSim);
    assert(Math.abs(orthoSim) < 0.0001, '正交向量相似度应为 0');
    
    console.log('✅ SIMD 模块测试通过');
  } catch (error) {
    console.log('❌ SIMD 模块测试失败:', error.message);
  }
}

// 测试 VNNI 模块
function testVNNI() {
  console.log('\n=== 测试 VNNI 模块 ===');
  
  try {
    const vnni = require('../build/Release/vnni.node');
    
    // 测试 INT8 点积
    const a = new Int8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const b = new Int8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    
    const dot = vnni.dotProductInt8(a, b);
    console.log('INT8 点积:', dot);
    assert(dot === 136, '点积结果应为 136');
    
    console.log('✅ VNNI 模块测试通过');
  } catch (error) {
    console.log('❌ VNNI 模块测试失败:', error.message);
  }
}

// 测试向量操作模块
function testVectorOps() {
  console.log('\n=== 测试向量操作模块 ===');
  
  try {
    const vectorOps = require('../build/Release/vector_ops.node');
    
    // 测试归一化
    const vec = new Float32Array([3, 4]);
    const normalized = vectorOps.normalize(vec);
    console.log('归一化结果:', Array.from(normalized));
    const norm = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
    assert(Math.abs(norm - 1.0) < 0.0001, '归一化后范数应为 1');
    
    // 测试 Top-K 搜索
    const query = new Float32Array([1, 0, 0]);
    const vectors = [
      new Float32Array([1, 0, 0]),  // 相似度 1
      new Float32Array([0, 1, 0]),  // 相似度 0
      new Float32Array([0.8, 0.6, 0]),  // 相似度 0.8
    ];
    
    const results = vectorOps.topKSearch(query, vectors, 2);
    console.log('Top-K 结果:', results);
    assert(results.length === 2, '应返回 2 个结果');
    assert(results[0].index === 0, '最相似应为索引 0');
    
    console.log('✅ 向量操作模块测试通过');
  } catch (error) {
    console.log('❌ 向量操作模块测试失败:', error.message);
  }
}

// 测试内存模块
function testMemory() {
  console.log('\n=== 测试内存模块 ===');
  
  try {
    const memory = require('../build/Release/memory.node');
    
    // 测试内存信息
    const info = memory.getMemoryInfo();
    console.log('内存信息:', info);
    
    // 测试对齐分配
    const buf = memory.alignedAlloc(1024, 64);
    console.log('对齐分配成功, 大小:', buf.length);
    assert(buf.length === 1024, '分配大小应为 1024');
    
    // 测试内存池
    const poolBuf = memory.poolAlloc(512);
    console.log('内存池分配成功, 大小:', poolBuf.length);
    
    const stats = memory.getPoolStats();
    console.log('内存池统计:', stats);
    
    console.log('✅ 内存模块测试通过');
  } catch (error) {
    console.log('❌ 内存模块测试失败:', error.message);
  }
}

// 运行所有测试
function runTests() {
  console.log('========================================');
  console.log('  元灵系统原生模块测试');
  console.log('========================================');
  
  testSIMD();
  testVNNI();
  testVectorOps();
  testMemory();
  
  console.log('\n========================================');
  console.log('  测试完成');
  console.log('========================================');
}

// 导出
module.exports = { runTests };

// 如果直接运行
if (require.main === module) {
  runTests();
}
