/**
 * 向量嵌入服务测试
 */

import { EmbeddingService, VectorStore } from "./src/yuanling-optimized";
import { StructuredLogger } from "./src/yuanling-optimized";

async function testEmbedding() {
  console.log("=== 向量嵌入服务测试 ===\n");

  // 创建日志器
  const logger = new StructuredLogger({ minLevel: "debug", outputToConsole: true });

  // 配置嵌入服务（使用环境变量）
  const apiKey = process.env.GITEE_API_KEY;
  if (!apiKey) {
    console.log("⚠️  未设置 GITEE_API_KEY 环境变量，使用模拟测试\n");
    await testWithoutAPI(logger);
    return;
  }

  const embeddingService = new EmbeddingService(
    {
      endpoint: "https://ai.gitee.com/v1",
      apiKey,
      model: "Qwen3-Embedding-8B",
      dimensions: 4096,
    },
    logger
  );

  // 测试 1：单文本嵌入
  console.log("测试 1：单文本嵌入");
  try {
    const result = await embeddingService.embed("今天是个晴天，我想去公园散步。");
    console.log(`✅ 嵌入成功：维度=${result.dimensions}, 向量前5位=[${result.vector.slice(0, 5).map(v => v.toFixed(4)).join(", ")}...]\n`);
  } catch (error) {
    console.log(`❌ 嵌入失败：${(error as Error).message}\n`);
  }

  // 测试 2：批量嵌入
  console.log("测试 2：批量嵌入");
  const texts = [
    "机器学习是人工智能的一个分支",
    "深度学习使用神经网络进行学习",
    "今天天气很好，适合出门",
  ];
  try {
    const results = await embeddingService.embedBatch(texts);
    console.log(`✅ 批量嵌入成功：${results.length} 个文本\n`);
  } catch (error) {
    console.log(`❌ 批量嵌入失败：${(error as Error).message}\n`);
  }

  // 测试 3：相似度计算
  console.log("测试 3：相似度计算");
  try {
    const emb1 = await embeddingService.embed("我喜欢吃苹果");
    const emb2 = await embeddingService.embed("我喜欢吃水果");
    const emb3 = await embeddingService.embed("今天下雨了");

    const sim12 = embeddingService.cosineSimilarity(emb1.vector, emb2.vector);
    const sim13 = embeddingService.cosineSimilarity(emb1.vector, emb3.vector);

    console.log(`✅ 相似度计算成功：`);
    console.log(`   "我喜欢吃苹果" vs "我喜欢吃水果": ${sim12.toFixed(4)}`);
    console.log(`   "我喜欢吃苹果" vs "今天下雨了": ${sim13.toFixed(4)}`);
    console.log(`   (预期：第一对相似度更高)\n`);
  } catch (error) {
    console.log(`❌ 相似度计算失败：${(error as Error).message}\n`);
  }

  // 测试 4：向量存储
  console.log("测试 4：向量存储");
  const vectorStore = new VectorStore(
    { persistDir: "./test-vectors", maxEntries: 100, defaultTopK: 3 },
    logger,
    embeddingService
  );

  try {
    await vectorStore.add("Python 是一种编程语言", { category: "tech" });
    await vectorStore.add("JavaScript 用于网页开发", { category: "tech" });
    await vectorStore.add("苹果是一种水果", { category: "food" });
    await vectorStore.add("香蕉富含钾元素", { category: "food" });
    console.log(`✅ 向量存储成功：4 个条目\n`);
  } catch (error) {
    console.log(`❌ 向量存储失败：${(error as Error).message}\n`);
  }

  // 测试 5：语义搜索
  console.log("测试 5：语义搜索");
  try {
    const results = await vectorStore.search("编程语言", 3);
    console.log(`✅ 语义搜索成功：`);
    for (const r of results) {
      console.log(`   [${r.score.toFixed(4)}] ${r.entry.text}`);
    }
    console.log(`   (预期：技术类条目排名靠前)\n`);
  } catch (error) {
    console.log(`❌ 语义搜索失败：${(error as Error).message}\n`);
  }

  // 测试 6：缓存效果
  console.log("测试 6：缓存效果");
  const stats = embeddingService.getStats();
  console.log(`✅ 缓存统计：`);
  console.log(`   缓存大小: ${stats.cacheSize} / ${stats.maxCacheSize}\n`);

  console.log("=== 测试完成 ===");
}

async function testWithoutAPI(logger: StructuredLogger) {
  // 模拟测试（不调用 API）
  console.log("使用模拟向量进行测试...\n");

  // 创建模拟向量
  const mockVector1 = Array.from({ length: 4096 }, () => Math.random() * 2 - 1);
  const mockVector2 = Array.from({ length: 4096 }, () => Math.random() * 2 - 1);

  // 创建临时嵌入服务（仅用于相似度计算）
  const tempService = {
    cosineSimilarity: (a: number[], b: number[]) => {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    },
  };

  const similarity = tempService.cosineSimilarity(mockVector1, mockVector2);
  console.log(`✅ 模拟相似度计算: ${similarity.toFixed(4)}`);
  console.log(`   (随机向量相似度应接近 0)\n`);

  // 测试向量存储（无嵌入服务）
  console.log("测试向量存储（无嵌入服务）");
  const vectorStore = new VectorStore(
    { persistDir: "./test-vectors-mock", maxEntries: 100 },
    logger
  );

  const stats = vectorStore.getStats();
  console.log(`✅ 向量存储初始化成功`);
  console.log(`   最大条目数: ${stats.maxEntries}\n`);

  console.log("=== 模拟测试完成 ===");
  console.log("\n提示：设置 GITEE_API_KEY 环境变量以进行完整测试");
}

// 运行测试
testEmbedding().catch(console.error);
