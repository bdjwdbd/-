/**
 * Token 估算校准器
 * 
 * 功能：
 * 1. 模型特定校准
 * 2. 动态误差修正
 * 3. 实际值反馈学习
 */

// ============================================================
// 类型定义
// ============================================================

interface CalibrationData {
  model: string;
  estimated: number;
  actual: number;
  timestamp: number;
  contentType: 'text' | 'code' | 'json' | 'mixed';
}

interface ModelCalibration {
  model: string;
  englishFactor: number;
  chineseFactor: number;
  codeFactor: number;
  jsonFactor: number;
  sampleCount: number;
  lastUpdated: number;
}

// ============================================================
// Token 校准器
// ============================================================

export class TokenCalibrator {
  private calibrationData: CalibrationData[] = [];
  private modelCalibrations: Map<string, ModelCalibration> = new Map();
  private maxSamples: number = 1000;

  constructor() {
    // 初始化默认校准数据
    this.initDefaultCalibrations();
  }

  /**
   * 初始化默认校准数据
   */
  private initDefaultCalibrations(): void {
    const defaults: ModelCalibration[] = [
      // OpenAI 系列
      {
        model: 'gpt-4-turbo',
        englishFactor: 1.0,
        chineseFactor: 1.0,
        codeFactor: 1.0,
        jsonFactor: 1.0,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      {
        model: 'gpt-4',
        englishFactor: 1.05,
        chineseFactor: 1.1,
        codeFactor: 1.0,
        jsonFactor: 1.0,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      {
        model: 'gpt-3.5-turbo',
        englishFactor: 1.0,
        chineseFactor: 1.05,
        codeFactor: 1.0,
        jsonFactor: 1.0,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      // Anthropic 系列
      {
        model: 'claude-3',
        englishFactor: 0.95,
        chineseFactor: 0.9,
        codeFactor: 0.95,
        jsonFactor: 0.95,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      {
        model: 'claude-3-opus',
        englishFactor: 0.95,
        chineseFactor: 0.88,
        codeFactor: 0.92,
        jsonFactor: 0.93,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      {
        model: 'claude-3-sonnet',
        englishFactor: 0.96,
        chineseFactor: 0.9,
        codeFactor: 0.94,
        jsonFactor: 0.95,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      // 阿里系列
      {
        model: 'qwen',
        englishFactor: 1.0,
        chineseFactor: 0.85,
        codeFactor: 1.0,
        jsonFactor: 1.0,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      {
        model: 'qwen-turbo',
        englishFactor: 1.0,
        chineseFactor: 0.82,
        codeFactor: 0.98,
        jsonFactor: 0.95,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      {
        model: 'qwen-plus',
        englishFactor: 1.0,
        chineseFactor: 0.85,
        codeFactor: 1.0,
        jsonFactor: 0.98,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      // 智谱系列
      {
        model: 'glm',
        englishFactor: 1.0,
        chineseFactor: 0.8,
        codeFactor: 1.0,
        jsonFactor: 1.0,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      {
        model: 'glm-4',
        englishFactor: 1.0,
        chineseFactor: 0.78,
        codeFactor: 0.95,
        jsonFactor: 0.95,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      // DeepSeek
      {
        model: 'deepseek',
        englishFactor: 1.0,
        chineseFactor: 0.85,
        codeFactor: 0.9,
        jsonFactor: 0.95,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
      // Moonshot
      {
        model: 'moonshot',
        englishFactor: 1.0,
        chineseFactor: 0.88,
        codeFactor: 0.95,
        jsonFactor: 0.95,
        sampleCount: 0,
        lastUpdated: Date.now(),
      },
    ];

    for (const cal of defaults) {
      this.modelCalibrations.set(cal.model, cal);
    }
  }

  /**
   * 记录校准数据
   */
  recordCalibration(
    model: string,
    estimated: number,
    actual: number,
    contentType: 'text' | 'code' | 'json' | 'mixed' = 'mixed'
  ): void {
    this.calibrationData.push({
      model,
      estimated,
      actual,
      timestamp: Date.now(),
      contentType,
    });

    // 限制样本数量
    if (this.calibrationData.length > this.maxSamples) {
      this.calibrationData.shift();
    }

    // 更新模型校准
    this.updateModelCalibration(model);
  }

  /**
   * 更新模型校准因子
   */
  private updateModelCalibration(model: string): void {
    const modelData = this.calibrationData.filter(d => d.model === model);
    if (modelData.length < 10) return; // 样本不足

    const cal = this.modelCalibrations.get(model);
    if (!cal) {
      this.modelCalibrations.set(model, {
        model,
        englishFactor: 1.0,
        chineseFactor: 1.0,
        codeFactor: 1.0,
        jsonFactor: 1.0,
        sampleCount: 0,
        lastUpdated: Date.now(),
      });
      return;
    }

    // 计算平均误差
    const avgRatio = modelData.reduce((sum, d) => sum + d.actual / d.estimated, 0) / modelData.length;
    
    // 根据内容类型调整
    const textData = modelData.filter(d => d.contentType === 'text');
    const codeData = modelData.filter(d => d.contentType === 'code');
    const jsonData = modelData.filter(d => d.contentType === 'json');

    if (textData.length >= 5) {
      cal.englishFactor = textData.reduce((sum, d) => sum + d.actual / d.estimated, 0) / textData.length;
      cal.chineseFactor = cal.englishFactor;
    }

    if (codeData.length >= 5) {
      cal.codeFactor = codeData.reduce((sum, d) => sum + d.actual / d.estimated, 0) / codeData.length;
    }

    if (jsonData.length >= 5) {
      cal.jsonFactor = jsonData.reduce((sum, d) => sum + d.actual / d.estimated, 0) / jsonData.length;
    }

    cal.sampleCount = modelData.length;
    cal.lastUpdated = Date.now();
  }

  /**
   * 获取校准后的估算
   */
  calibrate(
    model: string,
    estimated: number,
    contentType: 'text' | 'code' | 'json' | 'mixed' = 'mixed'
  ): number {
    const cal = this.modelCalibrations.get(model);
    if (!cal) return estimated;

    let factor = 1.0;
    switch (contentType) {
      case 'text':
        factor = (cal.englishFactor + cal.chineseFactor) / 2;
        break;
      case 'code':
        factor = cal.codeFactor;
        break;
      case 'json':
        factor = cal.jsonFactor;
        break;
      case 'mixed':
        factor = (cal.englishFactor + cal.chineseFactor + cal.codeFactor + cal.jsonFactor) / 4;
        break;
    }

    return Math.round(estimated * factor);
  }

  /**
   * 检测内容类型
   */
  detectContentType(content: string): 'text' | 'code' | 'json' | 'mixed' {
    const trimmed = content.trim();
    
    // JSON 检测（优先级最高）
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(content);
        return 'json';
      } catch {}
    }

    // 代码检测（优先级次高）
    const codePatterns = [
      /^function\s*\(/,
      /^const\s+\w+\s*=/,
      /^let\s+\w+\s*=/,
      /^var\s+\w+\s*=/,
      /^import\s+/,
      /^export\s+/,
      /^class\s+\w+/,
      /^def\s+\w+\(/,
      /^async\s+function/,
      /^await\s+/,
      /^return\s+/,
      /=>\s*{/,
      /\(\s*\)\s*=>/,
      /```[\s\S]*?```/,
      /<\w+[^>]*>.*<\/\w+>/,
      /^\s*if\s*\(/,
      /^\s*for\s*\(/,
      /^\s*while\s*\(/,
    ];
    
    for (const pattern of codePatterns) {
      if (pattern.test(trimmed)) {
        return 'code';
      }
    }

    // 代码关键词检测
    const codeKeywords = ['function', 'const', 'let', 'var', 'import', 'export', 'class', 'def', 'async', 'await', 'return'];
    const lowerContent = trimmed.toLowerCase();
    for (const kw of codeKeywords) {
      // 检查是否是代码上下文（后面跟着括号、等号等）
      const regex = new RegExp(`\\b${kw}\\b[\\s\\(=]`);
      if (regex.test(lowerContent)) {
        return 'code';
      }
    }

    // 纯文本检测
    const chineseRatio = (content.match(/[\u4e00-\u9fa5]/g) || []).length / content.length;
    const englishRatio = (content.match(/[a-zA-Z]/g) || []).length / content.length;
    
    if (chineseRatio > 0.2 || englishRatio > 0.2) {
      return 'text';
    }

    return 'mixed';
  }

  /**
   * 智能校准（自动检测内容类型）
   */
  smartCalibrate(model: string, estimated: number, content: string): number {
    const contentType = this.detectContentType(content);
    return this.calibrate(model, estimated, contentType);
  }

  /**
   * 获取模型校准信息
   */
  getModelCalibration(model: string): ModelCalibration | null {
    return this.modelCalibrations.get(model) || null;
  }

  /**
   * 获取校准统计
   */
  getStats(): {
    totalSamples: number;
    models: Array<{ model: string; samples: number; avgError: number }>;
  } {
    const models = Array.from(this.modelCalibrations.values()).map(cal => {
      const modelData = this.calibrationData.filter(d => d.model === cal.model);
      const avgError = modelData.length > 0
        ? modelData.reduce((sum, d) => sum + Math.abs(d.actual - d.estimated) / d.estimated, 0) / modelData.length
        : 0;
      
      return {
        model: cal.model,
        samples: modelData.length,
        avgError,
      };
    });

    return {
      totalSamples: this.calibrationData.length,
      models,
    };
  }

  /**
   * 估算 Token 数量（基础估算）
   */
  estimateTokens(content: string, model: string = 'gpt-4'): number {
    // 基础估算：英文约 4 字符 = 1 token，中文约 1.5 字符 = 1 token
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = content.length - chineseChars;
    
    const baseEstimate = Math.ceil(chineseChars / 1.5 + otherChars / 4);
    
    // 应用模型校准
    return this.smartCalibrate(model, baseEstimate, content);
  }

  /**
   * 重置校准数据
   */
  reset(): void {
    this.calibrationData = [];
    this.initDefaultCalibrations();
  }
}

// ============================================================
// 全局实例
// ============================================================

let globalCalibrator: TokenCalibrator | null = null;

export function getTokenCalibrator(): TokenCalibrator {
  if (!globalCalibrator) {
    globalCalibrator = new TokenCalibrator();
  }
  return globalCalibrator;
}
