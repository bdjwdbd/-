/**
 * 日志系统模块
 * 
 * 使用 pino 实现高性能日志记录
 */

import pino from 'pino';

// ============================================================
// 类型定义
// ============================================================

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerConfig {
  level: LogLevel;
  name: string;
  pretty?: boolean;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  name: 'yuanling',
  pretty: true,
};

// ============================================================
// 日志管理器
// ============================================================

export class LoggerManager {
  private loggers: Map<string, pino.Logger> = new Map();
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取或创建日志器
   */
  getLogger(name?: string): pino.Logger {
    const loggerName = name || this.config.name;
    
    if (!this.loggers.has(loggerName)) {
      const logger = pino({
        name: loggerName,
        level: this.config.level,
        transport: this.config.pretty ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        } : undefined,
      });
      
      this.loggers.set(loggerName, logger);
    }
    
    return this.loggers.get(loggerName)!;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    for (const logger of this.loggers.values()) {
      logger.level = level;
    }
  }

  /**
   * 创建子日志器
   */
  child(parentName: string, childName: string): pino.Logger {
    const parent = this.getLogger(parentName);
    return parent.child({ module: childName });
  }
}

// ============================================================
// 全局日志器
// ============================================================

let globalLogger: LoggerManager | null = null;

export function getLogger(name?: string): pino.Logger {
  if (!globalLogger) {
    globalLogger = new LoggerManager();
  }
  return globalLogger.getLogger(name);
}

export function initLogger(config: Partial<LoggerConfig>): void {
  globalLogger = new LoggerManager(config);
}

// ============================================================
// 性能计时器
// ============================================================

export class PerformanceTimer {
  private logger: pino.Logger;
  private startTime: number;
  private name: string;

  constructor(logger: pino.Logger, name: string) {
    this.logger = logger;
    this.name = name;
    this.startTime = Date.now();
  }

  /**
   * 结束计时
   */
  end(message?: string): number {
    const elapsed = Date.now() - this.startTime;
    this.logger.debug({
      timer: this.name,
      elapsed: `${elapsed}ms`,
      message,
    });
    return elapsed;
  }
}

/**
 * 创建性能计时器
 */
export function startTimer(name: string, logger?: pino.Logger): PerformanceTimer {
  return new PerformanceTimer(logger || getLogger(), name);
}
