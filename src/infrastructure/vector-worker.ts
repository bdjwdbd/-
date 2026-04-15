/**
 * 向量计算 Worker
 * 
 * 在独立线程中执行向量计算任务
 */

import { parentPort, workerData } from 'worker_threads';

// ============================================================
// 向量计算函数
// ============================================================

function cosineSimilarity(query: number[], vec: number[]): number {
  let dot = 0;
  let normQ = 0;
  let normV = 0;
  
  for (let i = 0; i < query.length; i++) {
    dot += query[i] * vec[i];
    normQ += query[i] * query[i];
    normV += vec[i] * vec[i];
  }
  
  return dot / (Math.sqrt(normQ) * Math.sqrt(normV));
}

function euclideanDistance(query: number[], vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < query.length; i++) {
    const diff = query[i] - vec[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function dotProduct(query: number[], vec: number[]): number {
  let dot = 0;
  for (let i = 0; i < query.length; i++) {
    dot += query[i] * vec[i];
  }
  return dot;
}

// ============================================================
// Worker 消息处理
// ============================================================

parentPort?.on('message', (msg: any) => {
  if (msg.type === 'execute') {
    const { taskId, taskType, data } = msg;
    
    try {
      let result: any;
      
      if (taskType === 'search') {
        const { query, vectors, operation, startIdx } = data;
        const scores: number[] = [];
        const indices: number[] = [];
        
        for (let i = 0; i < vectors.length; i++) {
          let score: number;
          
          switch (operation) {
            case 'cosine':
              score = cosineSimilarity(query, vectors[i]);
              break;
            case 'euclidean':
              score = euclideanDistance(query, vectors[i]);
              break;
            case 'dot':
              score = dotProduct(query, vectors[i]);
              break;
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
          
          scores.push(score);
          indices.push(startIdx + i);
        }
        
        result = { scores, indices };
      } else {
        throw new Error(`Unknown task type: ${taskType}`);
      }
      
      parentPort?.postMessage({
        type: 'result',
        taskId,
        result,
      });
    } catch (err: any) {
      parentPort?.postMessage({
        type: 'error',
        taskId,
        error: err.message,
      });
    }
  }
});

// 通知主线程 Worker 已就绪
parentPort?.postMessage({ type: 'ready' });
