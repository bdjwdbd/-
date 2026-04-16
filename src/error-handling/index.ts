/**
 * 元灵系统统一错误处理
 * 
 * 提供统一的错误类型和错误处理机制
 * 
 * @module error-handling
 */

// ============ 错误类型定义 ============

/**
 * 错误层级
 */
export type ErrorLayer = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'SYSTEM';

/**
 * 错误严重程度
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // L0 灵思层错误
  L0_THINKING_FAILED = 'L0_THINKING_FAILED',
  L0_TIMEOUT = 'L0_TIMEOUT',
  
  // L1 灵枢层错误
  L1_DECISION_FAILED = 'L1_DECISION_FAILED',
  L1_INVALID_INTENT = 'L1_INVALID_INTENT',
  
  // L2 灵脉层错误
  L2_EXECUTION_FAILED = 'L2_EXECUTION_FAILED',
  L2_TIMEOUT = 'L2_TIMEOUT',
  
  // L3 灵躯层错误
  L3_TOOL_NOT_FOUND = 'L3_TOOL_NOT_FOUND',
  L3_TOOL_EXECUTION_FAILED = 'L3_TOOL_EXECUTION_FAILED',
  L3_INVALID_PARAMETERS = 'L3_INVALID_PARAMETERS',
  
  // L4 灵盾层错误
  L4_VALIDATION_FAILED = 'L4_VALIDATION_FAILED',
  L4_SECURITY_VIOLATION = 'L4_SECURITY_VIOLATION',
  L4_LOOP_DETECTED = 'L4_LOOP_DETECTED',
  L4_OUTPUT_TRUNCATED = 'L4_OUTPUT_TRUNCATED',
  
  // L5 灵韵层错误
  L5_FEEDBACK_FAILED = 'L5_FEEDBACK_FAILED',
  L5_LEARNING_FAILED = 'L5_LEARNING_FAILED',
  
  // L6 灵识层错误
  L6_ENVIRONMENT_ERROR = 'L6_ENVIRONMENT_ERROR',
  L6_INITIALIZATION_FAILED = 'L6_INITIALIZATION_FAILED',
  
  // 系统级错误
  SYSTEM_CONFIG_ERROR = 'SYSTEM_CONFIG_ERROR',
  SYSTEM_MEMORY_ERROR = 'SYSTEM_MEMORY_ERROR',
  SYSTEM_NETWORK_ERROR = 'SYSTEM_NETWORK_ERROR',
  SYSTEM_UNKNOWN_ERROR = 'SYSTEM_UNKNOWN_ERROR',
  
  // 模块错误
  MODULE_HARNESS_ERROR = 'MODULE_HARNESS_ERROR',
  MODULE_DASHBOARD_ERROR = 'MODULE_DASHBOARD_ERROR',
  MODULE_MULTI_AGENT_ERROR = 'MODULE_MULTI_AGENT_ERROR',
  MODULE_EDGE_ERROR = 'MODULE_EDGE_ERROR',
  MODULE_FEDERATED_ERROR = 'MODULE_FEDERATED_ERROR',
}

/**
 * 元灵系统错误基类
 */
export class YuanLingError extends Error {
  public readonly code: ErrorCode;
  public readonly layer: ErrorLayer;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(
    code: ErrorCode,
    layer: ErrorLayer,
    message: string,
    options?: {
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'YuanLingError';
    this.code = code;
    this.layer = layer;
    this.severity = options?.severity || this.inferSeverity(code);
    this.timestamp = new Date();
    this.context = options?.context;
    this.cause = options?.cause;

    // 保持正确的原型链
    Object.setPrototypeOf(this, YuanLingError.prototype);
  }

  /**
   * 根据错误代码推断严重程度
   */
  private inferSeverity(code: ErrorCode): ErrorSeverity {
    const criticalCodes = [
      ErrorCode.L4_SECURITY_VIOLATION,
      ErrorCode.SYSTEM_MEMORY_ERROR,
      ErrorCode.L6_INITIALIZATION_FAILED,
    ];
    
    const highCodes = [
      ErrorCode.L4_LOOP_DETECTED,
      ErrorCode.L2_EXECUTION_FAILED,
      ErrorCode.L3_TOOL_EXECUTION_FAILED,
    ];
    
    const mediumCodes = [
      ErrorCode.L0_THINKING_FAILED,
      ErrorCode.L1_DECISION_FAILED,
      ErrorCode.L3_TOOL_NOT_FOUND,
    ];

    if (criticalCodes.includes(code)) return 'critical';
    if (highCodes.includes(code)) return 'high';
    if (mediumCodes.includes(code)) return 'medium';
    return 'low';
  }

  /**
   * 转换为 JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      layer: this.layer,
      severity: this.severity,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      cause: this.cause?.message,
    };
  }

  /**
   * 转换为用户友好的消息
   */
  toUserMessage(): string {
    const layerNames: Record<ErrorLayer, string> = {
      L0: '灵思层',
      L1: '灵枢层',
      L2: '灵脉层',
      L3: '灵躯层',
      L4: '灵盾层',
      L5: '灵韵层',
      L6: '灵识层',
      SYSTEM: '系统',
    };

    const severityIcons: Record<ErrorSeverity, string> = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🔴',
      critical: '🚨',
    };

    return `${severityIcons[this.severity]} [${layerNames[this.layer]}] ${this.message}`;
  }
}

// ============ 便捷错误类 ============

/**
 * L0 灵思层错误
 */
export class L0Error extends YuanLingError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, 'L0', message, options);
    this.name = 'L0Error';
  }
}

/**
 * L1 灵枢层错误
 */
export class L1Error extends YuanLingError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, 'L1', message, options);
    this.name = 'L1Error';
  }
}

/**
 * L2 灵脉层错误
 */
export class L2Error extends YuanLingError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, 'L2', message, options);
    this.name = 'L2Error';
  }
}

/**
 * L3 灵躯层错误
 */
export class L3Error extends YuanLingError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, 'L3', message, options);
    this.name = 'L3Error';
  }
}

/**
 * L4 灵盾层错误
 */
export class L4Error extends YuanLingError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, 'L4', message, options);
    this.name = 'L4Error';
  }
}

/**
 * L5 灵韵层错误
 */
export class L5Error extends YuanLingError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, 'L5', message, options);
    this.name = 'L5Error';
  }
}

/**
 * L6 灵识层错误
 */
export class L6Error extends YuanLingError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, 'L6', message, options);
    this.name = 'L6Error';
  }
}

/**
 * 系统错误
 */
export class SystemError extends YuanLingError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, 'SYSTEM', message, options);
    this.name = 'SystemError';
  }
}

/**
 * 模块错误
 */
export class ModuleError extends YuanLingError {
  constructor(
    code: ErrorCode,
    module: string,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error }
  ) {
    super(code, 'SYSTEM', `[${module}] ${message}`, options);
    this.name = 'ModuleError';
  }
}

// ============ 错误处理器 ============

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  /** 是否记录错误日志 */
  enableLogging: boolean;
  /** 是否上报错误 */
  enableReporting: boolean;
  /** 是否启用错误恢复 */
  enableRecovery: boolean;
  /** 错误回调 */
  onError?: (error: YuanLingError) => void;
}

const DEFAULT_CONFIG: ErrorHandlerConfig = {
  enableLogging: true,
  enableReporting: false,
  enableRecovery: true,
};

/**
 * 错误处理器
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorHistory: YuanLingError[] = [];
  private maxHistorySize: number = 100;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 处理错误
   */
  handle(error: unknown): YuanLingError {
    // 转换为 YuanLingError
    const yuanlingError = this.normalizeError(error);

    // 记录历史
    this.recordError(yuanlingError);

    // 日志
    if (this.config.enableLogging) {
      this.logError(yuanlingError);
    }

    // 回调
    if (this.config.onError) {
      this.config.onError(yuanlingError);
    }

    return yuanlingError;
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: unknown): YuanLingError {
    if (error instanceof YuanLingError) {
      return error;
    }

    if (error instanceof Error) {
      return new SystemError(
        ErrorCode.SYSTEM_UNKNOWN_ERROR,
        error.message,
        { cause: error }
      );
    }

    return new SystemError(
      ErrorCode.SYSTEM_UNKNOWN_ERROR,
      String(error)
    );
  }

  /**
   * 记录错误
   */
  private recordError(error: YuanLingError): void {
    this.errorHistory.push(error);
    
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * 日志错误
   */
  private logError(error: YuanLingError): void {
    const prefix = error.severity === 'critical' ? '🚨' :
                   error.severity === 'high' ? '🔴' :
                   error.severity === 'medium' ? '⚠️' : 'ℹ️';
    
    console.error(`${prefix} [${error.layer}] ${error.code}: ${error.message}`);
    
    if (error.cause) {
      console.error(`   原因: ${error.cause.message}`);
    }
    
    if (error.context) {
      console.error(`   上下文:`, error.context);
    }
  }

  /**
   * 获取错误历史
   */
  getErrorHistory(limit: number = 20): YuanLingError[] {
    return this.errorHistory.slice(-limit);
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    total: number;
    byLayer: Record<ErrorLayer, number>;
    bySeverity: Record<ErrorSeverity, number>;
    byCode: Record<string, number>;
  } {
    const byLayer: Record<ErrorLayer, number> = {
      L0: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0, SYSTEM: 0,
    };
    
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0, medium: 0, high: 0, critical: 0,
    };
    
    const byCode: Record<string, number> = {};

    for (const error of this.errorHistory) {
      byLayer[error.layer]++;
      bySeverity[error.severity]++;
      byCode[error.code] = (byCode[error.code] || 0) + 1;
    }

    return {
      total: this.errorHistory.length,
      byLayer,
      bySeverity,
      byCode,
    };
  }

  /**
   * 清除错误历史
   */
  clearHistory(): void {
    this.errorHistory = [];
  }
}

// ============ 全局错误处理器 ============

let globalErrorHandler: ErrorHandler | null = null;

/**
 * 获取全局错误处理器
 */
export function getErrorHandler(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler(config);
  }
  return globalErrorHandler;
}

/**
 * 处理错误（便捷函数）
 */
export function handleError(error: unknown): YuanLingError {
  return getErrorHandler().handle(error);
}

/**
 * 包装异步函数（自动错误处理）
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: {
    layer?: ErrorLayer;
    code?: ErrorCode;
    context?: Record<string, unknown>;
  }
): Promise<T | YuanLingError> {
  return fn().catch((error) => {
    const handled = handleError(error);
    
    if (options?.layer && options?.code) {
      // 重新包装为指定层级错误
      return new YuanLingError(options.code, options.layer, handled.message, {
        context: options.context,
        cause: handled,
      });
    }
    
    return handled;
  });
}
