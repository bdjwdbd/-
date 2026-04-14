/**
 * 流式思考输出模块
 * 
 * 功能：
 * 1. 实时展示思考过程
 * 2. 分段输出
 * 3. 进度追踪
 * 4. 中断支持
 */

// ============================================================
// 类型定义
// ============================================================

interface ThinkingStep {
  id: string;
  type: 'analysis' | 'reasoning' | 'conclusion' | 'action';
  content: string;
  timestamp: number;
  progress: number; // 0-100
}

interface StreamingConfig {
  chunkDelay: number; // 每个字符的延迟（ms）
  stepDelay: number; // 步骤之间的延迟（ms）
  enableProgress: boolean;
  maxSteps: number;
}

type StreamCallback = (chunk: string, step: ThinkingStep) => void;
type CompleteCallback = (steps: ThinkingStep[]) => void;

// ============================================================
// 流式思考输出器
// ============================================================

export class StreamingThinker {
  private config: StreamingConfig;
  private steps: ThinkingStep[] = [];
  private currentStep: ThinkingStep | null = null;
  private isStreaming: boolean = false;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;

  constructor(config?: Partial<StreamingConfig>) {
    this.config = {
      chunkDelay: 20,
      stepDelay: 200,
      enableProgress: true,
      maxSteps: 10,
      ...config,
    };
  }

  /**
   * 开始流式思考
   */
  async startThinking(
    process: string[],
    onChunk?: StreamCallback,
    onComplete?: CompleteCallback
  ): Promise<ThinkingStep[]> {
    this.steps = [];
    this.isStreaming = true;
    this.abortController = new AbortController();

    const totalSteps = Math.min(process.length, this.config.maxSteps);

    for (let i = 0; i < totalSteps; i++) {
      if (!this.isStreaming || this.abortController.signal.aborted) {
        break;
      }

      // 等待暂停解除
      while (this.isPaused) {
        await this.sleep(100);
      }

      // 创建步骤
      const step: ThinkingStep = {
        id: `step-${i}`,
        type: this.getStepType(i, totalSteps),
        content: process[i],
        timestamp: Date.now(),
        progress: ((i + 1) / totalSteps) * 100,
      };

      this.currentStep = step;
      this.steps.push(step);

      // 流式输出内容
      await this.streamContent(step, onChunk);

      // 步骤间延迟
      if (i < totalSteps - 1) {
        await this.sleep(this.config.stepDelay);
      }
    }

    this.isStreaming = false;
    this.currentStep = null;

    if (onComplete) {
      onComplete(this.steps);
    }

    return this.steps;
  }

  /**
   * 流式输出内容
   */
  private async streamContent(step: ThinkingStep, onChunk?: StreamCallback): Promise<void> {
    const content = step.content;
    let currentContent = '';

    for (let i = 0; i < content.length; i++) {
      if (!this.isStreaming || this.abortController?.signal.aborted) {
        break;
      }

      // 等待暂停解除
      while (this.isPaused) {
        await this.sleep(50);
      }

      currentContent += content[i];

      if (onChunk) {
        onChunk(content[i], { ...step, content: currentContent });
      }

      await this.sleep(this.config.chunkDelay);
    }
  }

  /**
   * 获取步骤类型
   */
  private getStepType(index: number, total: number): ThinkingStep['type'] {
    if (index === 0) return 'analysis';
    if (index === total - 1) return 'conclusion';
    if (index === total - 2) return 'action';
    return 'reasoning';
  }

  /**
   * 暂停
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * 恢复
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * 停止
   */
  stop(): void {
    this.isStreaming = false;
    this.isPaused = false;
    this.abortController?.abort();
  }

  /**
   * 获取当前进度
   */
  getProgress(): { currentStep: number; totalSteps: number; progress: number } {
    return {
      currentStep: this.steps.length,
      totalSteps: this.config.maxSteps,
      progress: this.currentStep?.progress || 0,
    };
  }

  /**
   * 获取所有步骤
   */
  getSteps(): ThinkingStep[] {
    return [...this.steps];
  }

  /**
   * 是否正在流式输出
   */
  isActive(): boolean {
    return this.isStreaming;
  }

  /**
   * 辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 思考过程生成器
// ============================================================

export class ThinkingProcessGenerator {
  /**
   * 生成分析过程
   */
  generateAnalysisProcess(query: string): string[] {
    return [
      `🔍 分析问题: ${query}`,
      `📋 识别关键要素...`,
      `🧠 构建推理框架...`,
      `⚡ 执行分析...`,
      `📊 整合结果...`,
      `✅ 得出结论`,
    ];
  }

  /**
   * 生成代码审查过程
   */
  generateCodeReviewProcess(code: string): string[] {
    return [
      `📖 读取代码...`,
      `🔍 检查语法结构...`,
      `⚡ 分析逻辑流程...`,
      `🔒 检查安全问题...`,
      `📈 评估性能...`,
      `💡 提出改进建议...`,
      `✅ 审查完成`,
    ];
  }

  /**
   * 生成问题解决过程
   */
  generateProblemSolvingProcess(problem: string): string[] {
    return [
      `🎯 理解问题: ${problem.substring(0, 50)}...`,
      `🔍 收集相关信息...`,
      `🧠 分析可能的原因...`,
      `💡 生成解决方案...`,
      `⚖️ 评估方案优劣...`,
      `✅ 选择最佳方案`,
    ];
  }

  /**
   * 生成学习过程
   */
  generateLearningProcess(topic: string): string[] {
    return [
      `📚 开始学习: ${topic}`,
      `🔍 搜索相关资料...`,
      `📖 阅读并理解...`,
      `🧠 整理知识点...`,
      `💡 形成知识框架...`,
      `✅ 学习完成`,
    ];
  }
}

// ============================================================
// 流式输出管理器
// ============================================================

export class StreamingOutputManager {
  private thinker: StreamingThinker;
  private generator: ThinkingProcessGenerator;
  private outputBuffer: string[] = [];

  constructor(config?: Partial<StreamingConfig>) {
    this.thinker = new StreamingThinker(config);
    this.generator = new ThinkingProcessGenerator();
  }

  /**
   * 流式分析
   */
  async streamAnalysis(
    query: string,
    onChunk?: StreamCallback
  ): Promise<ThinkingStep[]> {
    const process = this.generator.generateAnalysisProcess(query);
    return this.thinker.startThinking(process, onChunk);
  }

  /**
   * 流式代码审查
   */
  async streamCodeReview(
    code: string,
    onChunk?: StreamCallback
  ): Promise<ThinkingStep[]> {
    const process = this.generator.generateCodeReviewProcess(code);
    return this.thinker.startThinking(process, onChunk);
  }

  /**
   * 流式问题解决
   */
  async streamProblemSolving(
    problem: string,
    onChunk?: StreamCallback
  ): Promise<ThinkingStep[]> {
    const process = this.generator.generateProblemSolvingProcess(problem);
    return this.thinker.startThinking(process, onChunk);
  }

  /**
   * 流式学习
   */
  async streamLearning(
    topic: string,
    onChunk?: StreamCallback
  ): Promise<ThinkingStep[]> {
    const process = this.generator.generateLearningProcess(topic);
    return this.thinker.startThinking(process, onChunk);
  }

  /**
   * 暂停
   */
  pause(): void {
    this.thinker.pause();
  }

  /**
   * 恢复
   */
  resume(): void {
    this.thinker.resume();
  }

  /**
   * 停止
   */
  stop(): void {
    this.thinker.stop();
  }

  /**
   * 获取进度
   */
  getProgress(): { currentStep: number; totalSteps: number; progress: number } {
    return this.thinker.getProgress();
  }

  /**
   * 是否活跃
   */
  isActive(): boolean {
    return this.thinker.isActive();
  }
}

// ============================================================
// 单例
// ============================================================

let streamingManagerInstance: StreamingOutputManager | null = null;

export function getStreamingOutputManager(config?: Partial<StreamingConfig>): StreamingOutputManager {
  if (!streamingManagerInstance) {
    streamingManagerInstance = new StreamingOutputManager(config);
  }
  return streamingManagerInstance;
}
