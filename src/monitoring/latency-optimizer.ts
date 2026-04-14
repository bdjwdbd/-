/**
 * 延迟优化器
 * 
 * 优化策略：
 * 1. 并行预处理：L0 思考与决策并行
 * 2. 流式响应：边思考边返回
 * 3. 预热机制：预加载常用资源
 * 4. 快速路径：简单请求跳过复杂流程
 */

import * as crypto from "crypto";

// ============================================================
// 类型定义
// ============================================================

interface LatencyMetrics {
  stage: string;
  startTime: number;
  endTime: number;
  duration: number;
}

interface OptimizationConfig {
  enableParallelPreprocessing: boolean;
  enableFastPath: boolean;
  enableWarmup: boolean;
  fastPathThreshold: number; // 快速路径复杂度阈值
}

// ============================================================
// 延迟优化器
// ============================================================

export class LatencyOptimizer {
  private config: OptimizationConfig;
  private metrics: LatencyMetrics[] = [];
  private warmupComplete: boolean = false;
  private simplePatterns: Set<string> = new Set([
    '你好', 'hello', 'hi', '嗨', '您好',
    '谢谢', 'thanks', '感谢',
    '再见', 'bye', 'goodbye',
  ]);

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      enableParallelPreprocessing: true,
      enableFastPath: true,
      enableWarmup: true,
      fastPathThreshold: 0.3,
      ...config,
    };
    
    // 扩展简单模式
    this.simplePatterns = new Set([
      // 问候
      '你好', 'hello', 'hi', '嗨', '您好', 'hey',
      // 感谢
      '谢谢', 'thanks', 'thank you', '感谢', '多谢', 'thx',
      // 告别
      '再见', 'bye', 'goodbye', '拜拜', '88',
      // 确认
      '好的', 'ok', 'okay', '是的', '对', '没错', '可以', '行', '嗯', '哦',
      // 否定
      '不用', '不需要', '算了', '取消', '不用了', 'no', '不用谢',
      // 状态
      '在吗', '在不在', '你好吗', '怎么样', 'how are you',
    ]);
  }

  /**
   * 开始计时
   */
  startTimer(stage: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const endTime = Date.now();
      this.metrics.push({
        stage,
        startTime,
        endTime,
        duration: endTime - startTime,
      });
    };
  }

  /**
   * 检查是否可以走快速路径
   */
  canUseFastPath(message: string): boolean {
    if (!this.config.enableFastPath) return false;
    
    // 简单问候语
    const normalized = message.toLowerCase().trim();
    if (this.simplePatterns.has(normalized)) {
      return true;
    }
    
    // 短消息（< 10 字符）
    if (message.length < 10 && !message.includes('?') && !message.includes('？')) {
      return true;
    }
    
    // 确认类消息
    const confirmPatterns = ['好的', 'ok', 'okay', '是的', '对', '没错', '可以', '行', '嗯', '哦'];
    if (confirmPatterns.includes(normalized)) {
      return true;
    }
    
    // 否定类消息
    const denyPatterns = ['不用', '不需要', '算了', '取消', '不用了', 'no', '不用谢'];
    if (denyPatterns.includes(normalized)) {
      return true;
    }
    
    // 状态询问
    const statusPatterns = ['在吗', '在不在', '你好吗', '怎么样', 'how are you'];
    if (statusPatterns.includes(normalized)) {
      return true;
    }
    
    return false;
  }

  /**
   * 快速路径处理
   */
  fastPathProcess(message: string): { response: string; latency: number } | null {
    if (!this.canUseFastPath(message)) return null;
    
    const start = Date.now();
    
    // 简单映射
    const normalized = message.toLowerCase().trim();
    
    const responses: Record<string, string> = {
      // 问候类
      '你好': '你好！有什么可以帮助你的吗？',
      'hello': 'Hello! How can I help you?',
      'hi': 'Hi! How can I help you?',
      '嗨': '嗨！有什么可以帮助你的吗？',
      '您好': '您好！有什么可以帮助您的吗？',
      // 感谢类
      '谢谢': '不客气！',
      'thanks': 'You\'re welcome!',
      'thank you': 'You\'re welcome!',
      '感谢': '不客气！',
      '多谢': '不客气！',
      // 告别类
      '再见': '再见！有需要随时找我。',
      'bye': 'Bye! Feel free to reach out anytime.',
      'goodbye': 'Goodbye! Feel free to reach out anytime.',
      '拜拜': '拜拜！有需要随时找我。',
      // 确认类
      '好的': '好的，明白了。',
      'ok': 'OK!',
      'okay': 'Okay!',
      '是的': '好的，我了解了。',
      '对': '好的，明白了。',
      '没错': '是的，我理解了。',
      '可以': '好的，没问题。',
      '行': '好的，没问题。',
      '嗯': '嗯嗯，我在听。',
      '哦': '好的，我明白了。',
      // 否定类
      '不用': '好的，有需要随时告诉我。',
      '不需要': '好的，明白了。',
      '算了': '好的，没问题。',
      '取消': '好的，已取消。',
      '不用了': '好的，有需要随时告诉我。',
      'no': 'Okay, no problem.',
      '不用谢': '不客气！',
      // 状态询问
      '在吗': '在的！有什么可以帮助你的吗？',
      '在不在': '在的！有什么事吗？',
      '你好吗': '我很好，谢谢关心！你呢？',
      '怎么样': '一切都好！有什么可以帮你的吗？',
      'how are you': 'I\'m doing well, thank you! How about you?',
    };
    
    const response = responses[normalized];
    if (response) {
      return {
        response,
        latency: Date.now() - start,
      };
    }
    
    // 通用短消息回复
    if (message.length < 10) {
      return {
        response: `收到：${message}`,
        latency: Date.now() - start,
      };
    }
    
    return null;
  }

  /**
   * 并行预处理
   */
  async parallelPreprocess<T>(
    tasks: Array<{ name: string; fn: () => Promise<T> }>
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    if (!this.config.enableParallelPreprocessing) {
      // 串行执行
      for (const task of tasks) {
        const stopTimer = this.startTimer(task.name);
        results.set(task.name, await task.fn());
        stopTimer();
      }
      return results;
    }
    
    // 并行执行
    const stopTimer = this.startTimer('parallel-preprocess');
    const promises = tasks.map(async (task) => {
      const result = await task.fn();
      return { name: task.name, result };
    });
    
    const settled = await Promise.all(promises);
    stopTimer();
    
    for (const { name, result } of settled) {
      results.set(name, result);
    }
    
    return results;
  }

  /**
   * 预热
   */
  async warmup(): Promise<void> {
    if (!this.config.enableWarmup || this.warmupComplete) {
      return;
    }
    
    const stopTimer = this.startTimer('warmup');
    
    // 预热常用操作
    const warmupTasks = [
      // 模拟 L0 初始化
      () => new Promise<void>(resolve => {
        crypto.createHash('sha256').update('warmup').digest('hex');
        resolve();
      }),
      // 模拟缓存初始化
      () => new Promise<void>(resolve => {
        for (let i = 0; i < 100; i++) {
          crypto.createHash('sha256').update(`warmup-${i}`).digest('hex');
        }
        resolve();
      }),
    ];
    
    await Promise.all(warmupTasks.map(fn => fn()));
    
    this.warmupComplete = true;
    stopTimer();
  }

  /**
   * 流式响应生成器
   */
  async *streamResponse(
    content: string,
    chunkSize: number = 10
  ): AsyncGenerator<string> {
    const words = content.split('');
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join('');
      yield chunk;
      
      // 模拟打字延迟
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * 获取延迟统计
   */
  getLatencyStats(): {
    stages: LatencyMetrics[];
    totalLatency: number;
    avgLatency: number;
    breakdown: Record<string, { total: number; count: number; avg: number }>;
  } {
    const breakdown: Record<string, { total: number; count: number; avg: number }> = {};
    
    for (const metric of this.metrics) {
      if (!breakdown[metric.stage]) {
        breakdown[metric.stage] = { total: 0, count: 0, avg: 0 };
      }
      breakdown[metric.stage].total += metric.duration;
      breakdown[metric.stage].count++;
    }
    
    for (const stage in breakdown) {
      breakdown[stage].avg = breakdown[stage].total / breakdown[stage].count;
    }
    
    const totalLatency = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    
    return {
      stages: this.metrics,
      totalLatency,
      avgLatency: this.metrics.length > 0 ? totalLatency / this.metrics.length : 0,
      breakdown,
    };
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.metrics = [];
  }

  /**
   * 是否已预热
   */
  isWarmedUp(): boolean {
    return this.warmupComplete;
  }
}

// ============================================================
// 全局实例
// ============================================================

let globalOptimizer: LatencyOptimizer | null = null;

export function getLatencyOptimizer(): LatencyOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new LatencyOptimizer();
  }
  return globalOptimizer;
}
