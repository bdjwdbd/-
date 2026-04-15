/**
 * 向量计算 Worker
 * 
 * 在 Worker 线程中执行向量运算
 */

import { parentPort } from 'worker_threads';

// ============================================================
// 类型定义
// ============================================================

interface VectorTask {
  type: 'cosineSimilarity' | 'euclideanDistance' | 'dotProduct' | 'batchSearch';
  data: {
    a?: number[];
    b?: number[];
    query?: number[];
    vectors?: number[][];
    k?: number;
  };
}

interface VectorResult {
  type: string;
  result: number | number[] | Array<{ index: number; score: number }>;
}

// ============================================================
// 向量运算函数
// ============================================================

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}

function batchSearch(
  query: number[],
  vectors: number[][],
  k: number
): Array<{ index: number; score: number }> {
  const results: Array<{ index: number; score: number }> = [];

  for (let i = 0; i < vectors.length; i++) {
    const score = cosineSimilarity(query, vectors[i]);
    results.push({ index: i, score });
  }

  // 排序并返回 Top-K
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}

// ============================================================
// 消息处理
// ============================================================

if (parentPort) {
  parentPort.on('message', (task: VectorTask) => {
    let result: VectorResult;

    switch (task.type) {
      case 'cosineSimilarity':
        result = {
          type: task.type,
          result: cosineSimilarity(task.data.a!, task.data.b!),
        };
        break;

      case 'euclideanDistance':
        result = {
          type: task.type,
          result: euclideanDistance(task.data.a!, task.data.b!),
        };
        break;

      case 'dotProduct':
        result = {
          type: task.type,
          result: dotProduct(task.data.a!, task.data.b!),
        };
        break;

      case 'batchSearch':
        result = {
          type: task.type,
          result: batchSearch(task.data.query!, task.data.vectors!, task.data.k!),
        };
        break;

      default:
        throw new Error(`未知任务类型: ${(task as any).type}`);
    }

    parentPort!.postMessage(result);
  });
}

// 导出（用于测试）
export { cosineSimilarity, euclideanDistance, dotProduct, batchSearch };
