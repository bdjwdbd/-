/**
 * @file performance-test.ts
 * @brief 性能优化效果测试
 */

import * as path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

// 动态导入
const native = require(path.join(__dirname, '../../native/build/Release/yuanling_native.node'));
const { GPUAccelerator, createGPUAccelerator } = require('./gpu-accelerator');
const { INT8Quantizer } = require('./quantization');
const { HNSWIndex } = require('../core/hnsw-index');

// ============================================================
// 测试配置
// ============================================================

interface TestConfig {
    numVectors: number;
    dimensions: number;
    topK: number;
    iterations: number;
}

const config: TestConfig = {
    numVectors: 100000,
    dimensions: 128,
    topK: 10,
    iterations: 100
};

// ============================================================
// 生成测试数据
// ============================================================

function generateVectors(num: number, dim: number): Float32Array[] {
    const vectors: Float32Array[] = [];
    for (let i = 0; i < num; i++) {
        const v = new Float32Array(dim);
        for (let j = 0; j < dim; j++) {
            v[j] = Math.random() * 2 - 1;
        }
        vectors.push(v);
    }
    return vectors;
}

function generateQuery(dim: number): Float32Array {
    const q = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
        q[i] = Math.random() * 2 - 1;
    }
    return q;
}

// ============================================================
// 测试函数
// ============================================================

async function runTests() {
    // console.log('========================================');
    // console.log('  元灵系统性能优化测试');
    // console.log('========================================');
    // console.log('');
    // console.log('配置:');
    // console.log(`  向量数量: ${config.numVectors.toLocaleString()}`);
    // console.log(`  向量维度: ${config.dimensions}`);
    // console.log(`  TopK: ${config.topK}`);
    // console.log('');

    // 生成数据
    // console.log('生成测试数据...');
    const vectors = generateVectors(config.numVectors, config.dimensions);
    const query = generateQuery(config.dimensions);
    // console.log('');

    // ============================================================
    // 测试 1: 原生模块单次调用
    // ============================================================
    // console.log('【测试 1】原生模块 - 单次调用');
    const start1 = Date.now();
    for (let i = 0; i < config.iterations; i++) {
        for (let j = 0; j < 1000; j++) {
            native.cosineSimilarity(query, vectors[j]);
        }
    }
    const elapsed1 = Date.now() - start1;
    const qps1 = (config.iterations * 1000) / (elapsed1 / 1000);
    // console.log(`  耗时: ${elapsed1}ms`);
    // console.log(`  QPS: ${qps1.toLocaleString()}`);
    // console.log('');

    // ============================================================
    // 测试 2: 批量接口
    // ============================================================
    // console.log('【测试 2】原生模块 - 批量接口');
    const batchVectors = vectors.slice(0, 10000);
    const start2 = Date.now();
    for (let i = 0; i < config.iterations; i++) {
        native.cosineSimilarityBatch(query, batchVectors);
    }
    const elapsed2 = Date.now() - start2;
    const qps2 = (config.iterations * 10000) / (elapsed2 / 1000);
    // console.log(`  耗时: ${elapsed2}ms`);
    // console.log(`  QPS: ${qps2.toLocaleString()}`);
    // console.log(`  提升: ${(qps2 / qps1).toFixed(2)}x`);
    // console.log('');

    // ============================================================
    // 测试 3: 连续内存批量接口
    // ============================================================
    // console.log('【测试 3】原生模块 - 连续内存批量接口');
    const contiguousVectors = new Float32Array(10000 * config.dimensions);
    for (let i = 0; i < 10000; i++) {
        contiguousVectors.set(vectors[i], i * config.dimensions);
    }
    const start3 = Date.now();
    for (let i = 0; i < config.iterations; i++) {
        native.cosineSimilarityBatchContiguous(query, contiguousVectors, config.dimensions);
    }
    const elapsed3 = Date.now() - start3;
    const qps3 = (config.iterations * 10000) / (elapsed3 / 1000);
    // console.log(`  耗时: ${elapsed3}ms`);
    // console.log(`  QPS: ${qps3.toLocaleString()}`);
    // console.log(`  提升: ${(qps3 / qps1).toFixed(2)}x`);
    // console.log('');

    // ============================================================
    // 测试 4: INT8 量化
    // ============================================================
    // console.log('【测试 4】INT8 量化');
    const quantizer = new INT8Quantizer(config.dimensions);
    quantizer.train(vectors.slice(0, 1000));
    
    const quantizedVectors = vectors.slice(0, 10000).map(v => quantizer.compress(Array.from(v)));
    const quantizedQuery = quantizer.compress(Array.from(query));
    
    const start4 = Date.now();
    for (let i = 0; i < config.iterations; i++) {
        for (let j = 0; j < 1000; j++) {
            // INT8 计算（简化版）
            let dot = 0, normA = 0, normB = 0;
            for (let k = 0; k < config.dimensions; k++) {
                dot += quantizedQuery[k] * quantizedVectors[j][k];
                normA += quantizedQuery[k] * quantizedQuery[k];
                normB += quantizedVectors[j][k] * quantizedVectors[j][k];
            }
        }
    }
    const elapsed4 = Date.now() - start4;
    const qps4 = (config.iterations * 1000) / (elapsed4 / 1000);
    // console.log(`  耗时: ${elapsed4}ms`);
    // console.log(`  QPS: ${qps4.toLocaleString()}`);
    // console.log(`  存储节省: 4x (Float32 -> INT8)`);
    // console.log('');

    // ============================================================
    // 测试 5: HNSW 索引
    // ============================================================
    // console.log('【测试 5】HNSW 索引');
    const hnsw = new HNSWIndex({
        dimensions: config.dimensions,
        maxConnections: 16,
        efConstruction: 200,
        efSearch: 50
    });
    
    // 构建索引
    // console.log('  构建索引...');
    const buildStart = Date.now();
    for (let i = 0; i < Math.min(10000, config.numVectors); i++) {
        hnsw.add(`vec_${i}`, Array.from(vectors[i]));
    }
    const buildTime = Date.now() - buildStart;
    // console.log(`  构建耗时: ${buildTime}ms`);
    
    // 搜索
    const start5 = Date.now();
    for (let i = 0; i < config.iterations; i++) {
        hnsw.search(Array.from(query), config.topK);
    }
    const elapsed5 = Date.now() - start5;
    const qps5 = config.iterations / (elapsed5 / 1000);
    // console.log(`  搜索耗时: ${elapsed5}ms`);
    // console.log(`  QPS: ${qps5.toLocaleString()}`);
    // console.log(`  复杂度: O(log N) vs O(N)`);
    // console.log('');

    // ============================================================
    // 测试 6: GPU 加速
    // ============================================================
    // console.log('【测试 6】GPU 加速 (gpu.js)');
    try {
        const gpu = createGPUAccelerator({ mode: 'gpu' });
        
        const gpuVectors = vectors.slice(0, 10000).map(v => Array.from(v));
        const gpuQuery = Array.from(query);
        
        const start6 = Date.now();
        for (let i = 0; i < 10; i++) {
            gpu.cosineSimilarityBatch(gpuQuery, gpuVectors);
        }
        const elapsed6 = Date.now() - start6;
        const qps6 = (10 * 10000) / (elapsed6 / 1000);
        // console.log(`  耗时: ${elapsed6}ms`);
        // console.log(`  QPS: ${qps6.toLocaleString()}`);
        // console.log(`  提升: ${(qps6 / qps1).toFixed(2)}x`);
        
        gpu.destroy();
    } catch (e) {
        // console.log('  GPU 不可用，跳过');
    }
    // console.log('');

    // ============================================================
    // 总结
    // ============================================================
    // console.log('========================================');
    // console.log('  性能优化总结');
    // console.log('========================================');
    // console.log('');
    // console.log('| 优化项 | QPS | 提升 |');
    // console.log('|--------|-----|------|');
    // console.log(`| 原生模块（基准） | ${qps1.toLocaleString()} | 1x |`);
    // console.log(`| 批量接口 | ${qps2.toLocaleString()} | ${(qps2 / qps1).toFixed(2)}x |`);
    // console.log(`| 连续内存批量 | ${qps3.toLocaleString()} | ${(qps3 / qps1).toFixed(2)}x |`);
    // console.log(`| INT8 量化 | ${qps4.toLocaleString()} | ${(qps4 / qps1).toFixed(2)}x |`);
    // console.log(`| HNSW 索引 | ${qps5.toLocaleString()} | O(log N) |`);
    // console.log('');
}

// 运行测试
runTests().catch(console.error);
