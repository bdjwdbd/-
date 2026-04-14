/**
 * 灵盾层 - 输出截断器
 * 
 * 功能：当工具输出过长时自动截断，防止上下文爆炸
 * 
 * 核心原理：
 * 1. 检测输出长度
 * 2. 超过阈值时智能截断
 * 3. 保留关键信息，丢弃冗余内容
 * 
 * @author 元灵系统
 * @version 1.0.0
 */

export interface TruncationConfig {
  /** 最大输出字符数 */
  maxOutputChars: number;
  /** 最大输出行数 */
  maxOutputLines: number;
  /** 截断策略 */
  strategy: 'head' | 'tail' | 'middle' | 'smart';
  /** 是否显示截断提示 */
  showTruncationHint: boolean;
  /** 智能截断时的保留行数（头部） */
  smartHeadLines: number;
  /** 智能截断时的保留行数（尾部） */
  smartTailLines: number;
  /** 文件列表模式的最大文件数 */
  maxFileListItems: number;
}

const DEFAULT_CONFIG: TruncationConfig = {
  maxOutputChars: 50000,
  maxOutputLines: 500,
  strategy: 'smart',
  showTruncationHint: true,
  smartHeadLines: 20,
  smartTailLines: 20,
  maxFileListItems: 100,
};

export interface TruncationResult {
  content: string;
  wasTruncated: boolean;
  originalLength: number;
  truncatedLength: number;
  truncationType: 'chars' | 'lines' | 'filelist' | 'none';
  hint?: string;
}

/**
 * 输出截断器
 */
export class OutputTruncator {
  private config: TruncationConfig;

  constructor(config: Partial<TruncationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 检测是否为文件列表输出
   */
  private isFileListOutput(content: string): boolean {
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 10) return false;

    // 检测是否大部分行都是文件名格式
    const filePattern = /^[\w\-\.]+\.(js|ts|json|md|txt|py|go|rs|java|cpp|c|h|sh|yml|yaml|toml|xml|html|css)$/i;
    const matchCount = lines.filter((l) => filePattern.test(l.trim())).length;
    
    return matchCount / lines.length > 0.8;
  }

  /**
   * 截断文件列表
   */
  private truncateFileList(content: string): TruncationResult {
    const lines = content.split('\n');
    const originalLength = content.length;

    if (lines.length <= this.config.maxFileListItems) {
      return {
        content,
        wasTruncated: false,
        originalLength,
        truncatedLength: originalLength,
        truncationType: 'none',
      };
    }

    const kept = lines.slice(0, this.config.maxFileListItems);
    const truncated = kept.join('\n');
    const hint = `\n\n... [已截断：共 ${lines.length} 个文件，仅显示前 ${this.config.maxFileListItems} 个]`;

    return {
      content: truncated + (this.config.showTruncationHint ? hint : ''),
      wasTruncated: true,
      originalLength,
      truncatedLength: truncated.length,
      truncationType: 'filelist',
      hint,
    };
  }

  /**
   * 按字符数截断
   */
  private truncateByChars(content: string): TruncationResult {
    const originalLength = content.length;

    if (originalLength <= this.config.maxOutputChars) {
      return {
        content,
        wasTruncated: false,
        originalLength,
        truncatedLength: originalLength,
        truncationType: 'none',
      };
    }

    let truncated: string;
    let hint: string;

    switch (this.config.strategy) {
      case 'head':
        truncated = content.slice(0, this.config.maxOutputChars);
        hint = `\n\n... [已截断：原文 ${originalLength} 字符，仅显示前 ${this.config.maxOutputChars} 字符]`;
        break;

      case 'tail':
        truncated = content.slice(-this.config.maxOutputChars);
        hint = `\n\n... [已截断：原文 ${originalLength} 字符，仅显示后 ${this.config.maxOutputChars} 字符]`;
        break;

      case 'middle':
        const half = Math.floor(this.config.maxOutputChars / 2);
        truncated = content.slice(0, half) + '\n\n... [中间内容已省略] ...\n\n' + content.slice(-half);
        hint = '';
        break;

      case 'smart':
      default:
        const lines = content.split('\n');
        if (lines.length <= this.config.smartHeadLines + this.config.smartTailLines) {
          truncated = content.slice(0, this.config.maxOutputChars);
          hint = `\n\n... [已截断：原文 ${originalLength} 字符]`;
        } else {
          const head = lines.slice(0, this.config.smartHeadLines).join('\n');
          const tail = lines.slice(-this.config.smartTailLines).join('\n');
          const omitted = lines.length - this.config.smartHeadLines - this.config.smartTailLines;
          truncated = head + `\n\n... [已省略 ${omitted} 行] ...\n\n` + tail;
          hint = '';
        }
        break;
    }

    return {
      content: truncated + (this.config.showTruncationHint && hint ? hint : ''),
      wasTruncated: true,
      originalLength,
      truncatedLength: truncated.length,
      truncationType: 'chars',
      hint,
    };
  }

  /**
   * 按行数截断
   */
  private truncateByLines(content: string): TruncationResult {
    const lines = content.split('\n');
    const originalLength = content.length;

    if (lines.length <= this.config.maxOutputLines) {
      return {
        content,
        wasTruncated: false,
        originalLength,
        truncatedLength: originalLength,
        truncationType: 'none',
      };
    }

    let truncated: string;
    let hint: string;

    switch (this.config.strategy) {
      case 'head':
        truncated = lines.slice(0, this.config.maxOutputLines).join('\n');
        hint = `\n\n... [已截断：共 ${lines.length} 行，仅显示前 ${this.config.maxOutputLines} 行]`;
        break;

      case 'tail':
        truncated = lines.slice(-this.config.maxOutputLines).join('\n');
        hint = `\n\n... [已截断：共 ${lines.length} 行，仅显示后 ${this.config.maxOutputLines} 行]`;
        break;

      case 'smart':
      default:
        const head = lines.slice(0, this.config.smartHeadLines).join('\n');
        const tail = lines.slice(-this.config.smartTailLines).join('\n');
        const omitted = lines.length - this.config.smartHeadLines - this.config.smartTailLines;
        truncated = head + `\n\n... [已省略 ${omitted} 行] ...\n\n` + tail;
        hint = '';
        break;
    }

    return {
      content: truncated + (this.config.showTruncationHint && hint ? hint : ''),
      wasTruncated: true,
      originalLength,
      truncatedLength: truncated.length,
      truncationType: 'lines',
      hint,
    };
  }

  /**
   * 处理输出内容
   */
  process(content: string): TruncationResult {
    // 1. 检测文件列表模式
    if (this.isFileListOutput(content)) {
      return this.truncateFileList(content);
    }

    // 2. 检测行数
    const lines = content.split('\n');
    if (lines.length > this.config.maxOutputLines) {
      return this.truncateByLines(content);
    }

    // 3. 检测字符数
    if (content.length > this.config.maxOutputChars) {
      return this.truncateByChars(content);
    }

    // 4. 无需截断
    return {
      content,
      wasTruncated: false,
      originalLength: content.length,
      truncatedLength: content.length,
      truncationType: 'none',
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TruncationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): TruncationConfig {
    return { ...this.config };
  }
}

// 单例实例
let globalTruncator: OutputTruncator | null = null;

/**
 * 获取全局截断器
 */
export function getOutputTruncator(config?: Partial<TruncationConfig>): OutputTruncator {
  if (!globalTruncator) {
    globalTruncator = new OutputTruncator(config);
  }
  return globalTruncator;
}

/**
 * 重置全局截断器
 */
export function resetOutputTruncator(): void {
  globalTruncator = null;
}
