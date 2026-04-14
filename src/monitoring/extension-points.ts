/**
 * 自定义扩展点模块
 * 
 * 功能：
 * 1. 扩展点注册与管理
 * 2. 用户自定义处理器
 * 3. 钩子系统
 * 4. 插件式架构
 */

// ============================================================
// 类型定义
// ============================================================

type ExtensionPointName = 
  | 'request.before'
  | 'request.after'
  | 'response.before'
  | 'response.after'
  | 'thinking.before'
  | 'thinking.after'
  | 'tool.before'
  | 'tool.after'
  | 'error'
  | 'custom';

interface ExtensionHandler<T = any, R = any> {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  handler: (context: T) => R | Promise<R>;
  metadata?: Record<string, any>;
}

interface ExtensionPoint<T = any, R = any> {
  name: ExtensionPointName | string;
  handlers: ExtensionHandler<T, R>[];
  description?: string;
}

interface ExtensionConfig {
  maxHandlers: number;
  timeout: number;
  enableParallel: boolean;
}

// ============================================================
// 扩展点管理器
// ============================================================

export class ExtensionPointManager {
  private extensionPoints: Map<string, ExtensionPoint> = new Map();
  private config: ExtensionConfig;

  constructor(config?: Partial<ExtensionConfig>) {
    this.config = {
      maxHandlers: 100,
      timeout: 30000,
      enableParallel: false,
      ...config,
    };

    // 初始化内置扩展点
    this.initBuiltinExtensionPoints();
  }

  /**
   * 初始化内置扩展点
   */
  private initBuiltinExtensionPoints(): void {
    const builtinPoints: Array<{ name: ExtensionPointName; description: string }> = [
      { name: 'request.before', description: '请求处理前' },
      { name: 'request.after', description: '请求处理后' },
      { name: 'response.before', description: '响应生成前' },
      { name: 'response.after', description: '响应生成后' },
      { name: 'thinking.before', description: '思考过程前' },
      { name: 'thinking.after', description: '思考过程后' },
      { name: 'tool.before', description: '工具调用前' },
      { name: 'tool.after', description: '工具调用后' },
      { name: 'error', description: '错误处理' },
    ];

    for (const point of builtinPoints) {
      this.extensionPoints.set(point.name, {
        name: point.name,
        handlers: [],
        description: point.description,
      });
    }
  }

  /**
   * 注册扩展点
   */
  registerExtensionPoint(name: string, description?: string): void {
    if (!this.extensionPoints.has(name)) {
      this.extensionPoints.set(name, {
        name,
        handlers: [],
        description,
      });
    }
  }

  /**
   * 注册处理器
   */
  registerHandler<T = any, R = any>(
    pointName: string,
    handler: Omit<ExtensionHandler<T, R>, 'id'>
  ): string {
    const point = this.extensionPoints.get(pointName);
    if (!point) {
      throw new Error(`Extension point not found: ${pointName}`);
    }

    if (point.handlers.length >= this.config.maxHandlers) {
      throw new Error(`Max handlers reached for extension point: ${pointName}`);
    }

    const id = `handler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    point.handlers.push({
      ...handler,
      id,
    });

    // 按优先级排序
    point.handlers.sort((a, b) => b.priority - a.priority);

    return id;
  }

  /**
   * 移除处理器
   */
  removeHandler(pointName: string, handlerId: string): boolean {
    const point = this.extensionPoints.get(pointName);
    if (!point) return false;

    const index = point.handlers.findIndex(h => h.id === handlerId);
    if (index === -1) return false;

    point.handlers.splice(index, 1);
    return true;
  }

  /**
   * 启用/禁用处理器
   */
  setHandlerEnabled(pointName: string, handlerId: string, enabled: boolean): boolean {
    const point = this.extensionPoints.get(pointName);
    if (!point) return false;

    const handler = point.handlers.find(h => h.id === handlerId);
    if (!handler) return false;

    handler.enabled = enabled;
    return true;
  }

  /**
   * 触发扩展点
   */
  async trigger<T = any, R = any>(
    pointName: string,
    context: T
  ): Promise<R[]> {
    const point = this.extensionPoints.get(pointName);
    if (!point) {
      return [];
    }

    const enabledHandlers = point.handlers.filter(h => h.enabled);
    const results: R[] = [];

    if (this.config.enableParallel) {
      // 并行执行
      const promises = enabledHandlers.map(h => 
        this.executeHandler(h, context)
      );
      const settled = await Promise.allSettled(promises);
      
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          results.push(result.value as R);
        }
      }
    } else {
      // 串行执行
      for (const handler of enabledHandlers) {
        try {
          const result = await this.executeHandler(handler, context);
          results.push(result as R);
        } catch (error) {
          console.error(`Handler ${handler.id} failed:`, error);
        }
      }
    }

    return results;
  }

  /**
   * 执行处理器
   */
  private async executeHandler<T, R>(
    handler: ExtensionHandler<T, R>,
    context: T
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Handler ${handler.id} timeout`));
      }, this.config.timeout);

      Promise.resolve(handler.handler(context))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * 获取扩展点列表
   */
  getExtensionPoints(): Array<{ name: string; handlerCount: number; description?: string }> {
    return Array.from(this.extensionPoints.entries()).map(([name, point]) => ({
      name,
      handlerCount: point.handlers.length,
      description: point.description,
    }));
  }

  /**
   * 获取扩展点详情
   */
  getExtensionPoint(name: string): ExtensionPoint | null {
    return this.extensionPoints.get(name) || null;
  }

  /**
   * 获取处理器
   */
  getHandler(pointName: string, handlerId: string): ExtensionHandler | null {
    const point = this.extensionPoints.get(pointName);
    if (!point) return null;
    return point.handlers.find(h => h.id === handlerId) || null;
  }

  /**
   * 清空扩展点
   */
  clearExtensionPoint(name: string): void {
    const point = this.extensionPoints.get(name);
    if (point) {
      point.handlers = [];
    }
  }

  /**
   * 清空所有
   */
  clearAll(): void {
    for (const point of this.extensionPoints.values()) {
      point.handlers = [];
    }
  }
}

// ============================================================
// 钩子系统
// ============================================================

export class HookSystem {
  private manager: ExtensionPointManager;

  constructor(manager?: ExtensionPointManager) {
    this.manager = manager || new ExtensionPointManager();
  }

  /**
   * 添加钩子
   */
  addHook(
    pointName: string,
    handler: (context: any) => any | Promise<any>,
    options?: { priority?: number; name?: string }
  ): string {
    return this.manager.registerHandler(pointName, {
      name: options?.name || 'unnamed',
      priority: options?.priority || 0,
      enabled: true,
      handler,
    });
  }

  /**
   * 移除钩子
   */
  removeHook(pointName: string, hookId: string): boolean {
    return this.manager.removeHandler(pointName, hookId);
  }

  /**
   * 执行钩子
   */
  async executeHooks<T = any, R = any>(pointName: string, context: T): Promise<R[]> {
    return this.manager.trigger<T, R>(pointName, context);
  }

  /**
   * 便捷方法：请求前钩子
   */
  beforeRequest(handler: (context: any) => any): string {
    return this.addHook('request.before', handler);
  }

  /**
   * 便捷方法：请求后钩子
   */
  afterRequest(handler: (context: any) => any): string {
    return this.addHook('request.after', handler);
  }

  /**
   * 便捷方法：错误钩子
   */
  onError(handler: (context: any) => any): string {
    return this.addHook('error', handler);
  }
}

// ============================================================
// 插件基类
// ============================================================

export abstract class Plugin {
  abstract name: string;
  abstract version: string;
  abstract description: string;

  protected manager: ExtensionPointManager;

  constructor(manager: ExtensionPointManager) {
    this.manager = manager;
  }

  abstract install(): void;
  abstract uninstall(): void;

  registerHandler(pointName: string, handler: Omit<ExtensionHandler, 'id'>): string {
    return this.manager.registerHandler(pointName, handler);
  }

  removeHandler(pointName: string, handlerId: string): boolean {
    return this.manager.removeHandler(pointName, handlerId);
  }
}

// ============================================================
// 插件管理器
// ============================================================

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private extensionManager: ExtensionPointManager;

  constructor(extensionManager?: ExtensionPointManager) {
    this.extensionManager = extensionManager || new ExtensionPointManager();
  }

  /**
   * 安装插件
   */
  install(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already installed: ${plugin.name}`);
    }

    plugin.install();
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * 卸载插件
   */
  uninstall(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    plugin.uninstall();
    this.plugins.delete(pluginName);
  }

  /**
   * 获取插件
   */
  getPlugin(name: string): Plugin | null {
    return this.plugins.get(name) || null;
  }

  /**
   * 获取所有插件
   */
  getPlugins(): Array<{ name: string; version: string; description: string }> {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
    }));
  }

  /**
   * 获取扩展管理器
   */
  getExtensionManager(): ExtensionPointManager {
    return this.extensionManager;
  }
}

// ============================================================
// 单例
// ============================================================

let extensionManagerInstance: ExtensionPointManager | null = null;
let hookSystemInstance: HookSystem | null = null;
let pluginManagerInstance: PluginManager | null = null;

export function getExtensionPointManager(): ExtensionPointManager {
  if (!extensionManagerInstance) {
    extensionManagerInstance = new ExtensionPointManager();
  }
  return extensionManagerInstance;
}

export function getHookSystem(): HookSystem {
  if (!hookSystemInstance) {
    hookSystemInstance = new HookSystem(getExtensionPointManager());
  }
  return hookSystemInstance;
}

export function getPluginManager(): PluginManager {
  if (!pluginManagerInstance) {
    pluginManagerInstance = new PluginManager(getExtensionPointManager());
  }
  return pluginManagerInstance;
}
