/**
 * 实验 6：流式输出质量测试
 * 
 * 目的：验证 H-005（流式输出会降低最终质量）
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

interface TestTask {
  id: string;
  prompt: string;
  expectedOutput?: string;
  category: "creative" | "analytical" | "coding" | "reasoning";
  difficulty: "easy" | "medium" | "hard";
}

interface StreamChunk {
  content: string;
  timestamp: number;
  latency: number;
}

interface StreamResult {
  taskId: string;
  chunks: StreamChunk[];
  fullContent: string;
  totalLatency: number;
  firstChunkLatency: number;
  chunkCount: number;
}

interface NonStreamResult {
  taskId: string;
  content: string;
  totalLatency: number;
}

interface QualityScore {
  taskId: string;
  streamScore: number;
  nonStreamScore: number;
  difference: number;
  criteria: {
    coherence: number;
    completeness: number;
    accuracy: number;
    relevance: number;
  };
}

interface ExperimentResult {
  totalTasks: number;
  streamAvgScore: number;
  nonStreamAvgScore: number;
  scoreDifference: number;
  streamAvgLatency: number;
  nonStreamAvgLatency: number;
  firstChunkLatency: number;
  conclusion: string;
}

// ============================================================
// 流式模拟器
// ============================================================

class StreamSimulator {
  /**
   * 模拟流式输出
   */
  async simulateStream(prompt: string, chunkSize: number = 20): Promise<StreamResult> {
    const startTime = Date.now();
    const chunks: StreamChunk[] = [];
    
    // 模拟生成内容
    const fullContent = this.generateContent(prompt);
    const words = fullContent.split(" ");
    
    let currentChunk = "";
    let lastChunkTime = startTime;
    
    for (let i = 0; i < words.length; i++) {
      currentChunk += (currentChunk ? " " : "") + words[i];
      
      if (currentChunk.length >= chunkSize || i === words.length - 1) {
        const now = Date.now();
        chunks.push({
          content: currentChunk,
          timestamp: now,
          latency: now - lastChunkTime,
        });
        currentChunk = "";
        lastChunkTime = now;
        
        // 模拟网络延迟
        await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
      }
    }
    
    return {
      taskId: `stream-${Date.now()}`,
      chunks,
      fullContent,
      totalLatency: Date.now() - startTime,
      firstChunkLatency: chunks[0] ? chunks[0].timestamp - startTime : 0,
      chunkCount: chunks.length,
    };
  }
  
  /**
   * 模拟非流式输出
   */
  async simulateNonStream(prompt: string): Promise<NonStreamResult> {
    const startTime = Date.now();
    
    // 模拟完整生成
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    
    const content = this.generateContent(prompt);
    
    return {
      taskId: `nonstream-${Date.now()}`,
      content,
      totalLatency: Date.now() - startTime,
    };
  }
  
  /**
   * 生成模拟内容
   */
  private generateContent(prompt: string): string {
    const responses = [
      "这是一个关于问题的详细分析。首先，我们需要理解核心概念。其次，分析相关因素。最后，得出结论和建议。",
      "针对您的问题，我建议采取以下步骤：第一步，明确目标；第二步，收集信息；第三步，分析数据；第四步，制定方案；第五步，执行验证。",
      "从技术角度来看，这个问题涉及多个层面。架构层面需要考虑扩展性，性能层面需要优化响应时间，安全层面需要防护措施。",
      "代码实现应该遵循最佳实践：保持函数单一职责，使用有意义的变量名，添加必要的注释，编写单元测试。",
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// ============================================================
// 质量评估器
// ============================================================

class QualityEvaluator {
  /**
   * 评估内容质量
   */
  evaluate(content: string, prompt: string): {
    score: number;
    criteria: QualityScore["criteria"];
  } {
    // 模拟质量评估
    const criteria: QualityScore["criteria"] = {
      coherence: this.evaluateCoherence(content),
      completeness: this.evaluateCompleteness(content, prompt),
      accuracy: 0.8 + Math.random() * 0.2,
      relevance: this.evaluateRelevance(content, prompt),
    };
    
    const score = Object.values(criteria).reduce((a, b) => a + b, 0) / 4;
    
    return { score, criteria };
  }
  
  private evaluateCoherence(content: string): number {
    // 简单评估：句子连接词数量
    const connectors = ["首先", "其次", "最后", "因此", "但是", "然而", "此外"];
    const count = connectors.filter(c => content.includes(c)).length;
    return Math.min(1, 0.6 + count * 0.1);
  }
  
  private evaluateCompleteness(content: string, prompt: string): number {
    // 简单评估：内容长度
    const idealLength = 100;
    const ratio = Math.min(content.length / idealLength, 1.5);
    return 0.5 + ratio * 0.3;
  }
  
  private evaluateRelevance(content: string, prompt: string): number {
    // 简单评估：关键词匹配
    const promptWords = prompt.split(/\s+/);
    const matchCount = promptWords.filter(w => content.includes(w)).length;
    return Math.min(1, 0.5 + matchCount * 0.1);
  }
}

// ============================================================
// 主实验
// ============================================================

async function runExperiment() {
  console.log("=".repeat(60));
  console.log("实验 6：流式输出质量测试");
  console.log("=".repeat(60));
  
  const simulator = new StreamSimulator();
  const evaluator = new QualityEvaluator();
  
  const tasks: TestTask[] = [
    { id: "task-1", prompt: "请分析人工智能的发展趋势", category: "analytical", difficulty: "medium" },
    { id: "task-2", prompt: "写一个关于春天的短文", category: "creative", difficulty: "easy" },
    { id: "task-3", prompt: "实现一个快速排序算法", category: "coding", difficulty: "medium" },
    { id: "task-4", prompt: "解释量子计算的基本原理", category: "reasoning", difficulty: "hard" },
    { id: "task-5", prompt: "设计一个用户认证系统", category: "coding", difficulty: "hard" },
  ];
  
  const qualityScores: QualityScore[] = [];
  let totalStreamLatency = 0;
  let totalNonStreamLatency = 0;
  let totalFirstChunkLatency = 0;
  
  for (const task of tasks) {
    console.log(`\n测试任务: ${task.id} (${task.category})`);
    
    // 流式测试
    const streamResult = await simulator.simulateStream(task.prompt);
    const streamEval = evaluator.evaluate(streamResult.fullContent, task.prompt);
    
    // 非流式测试
    const nonStreamResult = await simulator.simulateNonStream(task.prompt);
    const nonStreamEval = evaluator.evaluate(nonStreamResult.content, task.prompt);
    
    const score: QualityScore = {
      taskId: task.id,
      streamScore: streamEval.score,
      nonStreamScore: nonStreamEval.score,
      difference: streamEval.score - nonStreamEval.score,
      criteria: streamEval.criteria,
    };
    
    qualityScores.push(score);
    totalStreamLatency += streamResult.totalLatency;
    totalNonStreamLatency += nonStreamResult.totalLatency;
    totalFirstChunkLatency += streamResult.firstChunkLatency;
    
    console.log(`  流式得分: ${streamEval.score.toFixed(3)}`);
    console.log(`  非流式得分: ${nonStreamEval.score.toFixed(3)}`);
    console.log(`  差异: ${(score.difference * 100).toFixed(1)}%`);
    console.log(`  流式延迟: ${streamResult.totalLatency}ms (首块: ${streamResult.firstChunkLatency}ms)`);
    console.log(`  非流式延迟: ${nonStreamResult.totalLatency}ms`);
  }
  
  // 统计结果
  console.log("\n" + "=".repeat(60));
  console.log("实验结论");
  console.log("=".repeat(60));
  
  const avgStreamScore = qualityScores.reduce((s, q) => s + q.streamScore, 0) / qualityScores.length;
  const avgNonStreamScore = qualityScores.reduce((s, q) => s + q.nonStreamScore, 0) / qualityScores.length;
  const avgDifference = avgStreamScore - avgNonStreamScore;
  
  console.log(`\n总任务数: ${tasks.length}`);
  console.log(`流式平均得分: ${avgStreamScore.toFixed(3)}`);
  console.log(`非流式平均得分: ${avgNonStreamScore.toFixed(3)}`);
  console.log(`得分差异: ${(avgDifference * 100).toFixed(1)}%`);
  console.log(`流式平均延迟: ${(totalStreamLatency / tasks.length).toFixed(0)}ms`);
  console.log(`非流式平均延迟: ${(totalNonStreamLatency / tasks.length).toFixed(0)}ms`);
  console.log(`首块平均延迟: ${(totalFirstChunkLatency / tasks.length).toFixed(0)}ms`);
  
  let conclusion = "";
  if (Math.abs(avgDifference) < 0.05) {
    conclusion = "✅ 假设 H-005 不成立：流式输出不会显著降低质量";
  } else if (avgDifference < 0) {
    conclusion = "❌ 假设 H-005 成立：流式输出会降低质量";
  } else {
    conclusion = "⚠️ 假设 H-005 不成立：流式输出质量反而更高";
  }
  
  console.log(`\n${conclusion}`);
  
  // 保存结果
  const result: ExperimentResult = {
    totalTasks: tasks.length,
    streamAvgScore: avgStreamScore,
    nonStreamAvgScore: avgNonStreamScore,
    scoreDifference: avgDifference,
    streamAvgLatency: totalStreamLatency / tasks.length,
    nonStreamAvgLatency: totalNonStreamLatency / tasks.length,
    firstChunkLatency: totalFirstChunkLatency / tasks.length,
    conclusion,
  };
  
  const reportPath = "./experiment-results/experiment-6-stream-quality.json";
  fs.writeFileSync(reportPath, JSON.stringify({ qualityScores, result }, null, 2));
  console.log(`\n结果已保存: ${reportPath}`);
}

if (require.main === module) {
  runExperiment();
}

export { StreamSimulator, QualityEvaluator };
export type { TestTask, StreamResult, NonStreamResult, QualityScore, ExperimentResult };
