/**
 * 插件系统
 * 
 * 功能：
 * 1. 插件注册与管理
 * 2. 生命周期钩子
 * 3. 依赖管理
 * 4. 热加载/卸载
 */

// ============================================================
// 类型定义
// ============================================================

export interface Plugin {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  
  // 生命周期钩子
  onLoad?: (context: PluginContext) => Promise<void>;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;
  onUnload?: () => Promise<void>;
  
  // 扩展点
  extensions?: Record<string, unknown>;
}

export interface PluginContext {
  logger: {
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
  };
  config: Record<string, unknown>;
  events: EventEmitter;
}

export interface ExtensionPoint {
  name: string;
  description: string;
  handlers: Array<{
    plugin: string;
    priority: number;
    handler: (...args: any[]) => unknown;
  }>;
}

export interface EventEmitter {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

// ============================================================
// 插件管理器
// ============================================================

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private enabledPlugins: Set<string> = new Set();
  private extensionPoints: Map<string, ExtensionPoint> = new Map();
  private eventHandlers: Map<string, Map<string, (...args: any[]) => void>> = new Map();
  private context: PluginContext;

  constructor() {
    this.context = this.createContext();
    this.registerBuiltinExtensionPoints();
  }

  /**
   * 创建插件上下文
   */
  private createContext(): PluginContext {
    return {
      logger: {
        info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
        warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
        error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
      },
      config: {},
      events: {
        on: (event, handler) => {
          if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Map());
          }
          this.eventHandlers.get(event)!.set(handler.name || 'anonymous', handler);
        },
        off: (event, handler) => {
          this.eventHandlers.get(event)?.delete(handler.name || 'anonymous');
        },
        emit: (event, ...args) => {
          this.eventHandlers.get(event)?.forEach(handler => handler(...args));
        },
      },
    };
  }

  /**
   * 注册内置扩展点
   */
  private registerBuiltinExtensionPoints(): void {
    this.registerExtensionPoint('thinking.before', '思考前处理');
    this.registerExtensionPoint('thinking.after', '思考后处理');
    this.registerExtensionPoint('decision.before', '决策前处理');
    this.registerExtensionPoint('decision.after', '决策后处理');
    this.registerExtensionPoint('execution.before', '执行前处理');
    this.registerExtensionPoint('execution.after', '执行后处理');
    this.registerExtensionPoint('validation.before', '验证前处理');
    this.registerExtensionPoint('validation.after', '验证后处理');
  }

  /**
   * 注册扩展点
   */
  registerExtensionPoint(name: string, description: string): void {
    this.extensionPoints.set(name, {
      name,
      description,
      handlers: [],
    });
  }

  /**
   * 注册插件
   */
  async register(plugin: Plugin): Promise<boolean> {
    if (this.plugins.has(plugin.name)) {
      console.warn(`插件 ${plugin.name} 已存在`);
      return false;
    }

    // 检查依赖
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          console.error(`插件 ${plugin.name} 缺少依赖: ${dep}`);
          return false;
        }
      }
    }

    this.plugins.set(plugin.name, plugin);

    // 注册扩展
    if (plugin.extensions) {
      for (const [point, handler] of Object.entries(plugin.extensions)) {
        this.registerExtension(point, plugin.name, handler as (...args: any[]) => unknown, 0);
      }
    }

    // 调用加载钩子
    if (plugin.onLoad) {
      await plugin.onLoad(this.context);
    }

    return true;
  }

  /**
   * 注册扩展
   */
  private registerExtension(
    pointName: string,
    pluginName: string,
    handler: (...args: any[]) => unknown,
    priority: number
  ): void {
    const point = this.extensionPoints.get(pointName);
    if (!point) {
      console.warn(`扩展点 ${pointName} 不存在`);
      return;
    }

    point.handlers.push({
      plugin: pluginName,
      priority,
      handler,
    });

    // 按优先级排序
    point.handlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 启用插件
   */
  async enable(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.error(`插件 ${pluginName} 不存在`);
      return false;
    }

    if (this.enabledPlugins.has(pluginName)) {
      return true; // 已启用
    }

    // 检查依赖是否已启用
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.enabledPlugins.has(dep)) {
          console.error(`插件 ${pluginName} 的依赖 ${dep} 未启用`);
          return false;
        }
      }
    }

    if (plugin.onEnable) {
      await plugin.onEnable();
    }

    this.enabledPlugins.add(pluginName);
    return true;
  }

  /**
   * 禁用插件
   */
  async disable(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return false;
    }

    // 检查是否有其他插件依赖它
    for (const [name, p] of this.plugins) {
      if (p.dependencies?.includes(pluginName) && this.enabledPlugins.has(name)) {
        console.error(`插件 ${name} 依赖 ${pluginName}，无法禁用`);
        return false;
      }
    }

    if (plugin.onDisable) {
      await plugin.onDisable();
    }

    this.enabledPlugins.delete(pluginName);
    return true;
  }

  /**
   * 卸载插件
   */
  async unload(pluginName: string): Promise<boolean> {
    if (this.enabledPlugins.has(pluginName)) {
      await this.disable(pluginName);
    }

    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return false;
    }

    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    // 移除扩展
    for (const point of this.extensionPoints.values()) {
      point.handlers = point.handlers.filter(h => h.plugin !== pluginName);
    }

    this.plugins.delete(pluginName);
    return true;
  }

  /**
   * 调用扩展点
   */
  async invoke<T = unknown>(pointName: string, ...args: any[]): Promise<T[]> {
    const point = this.extensionPoints.get(pointName);
    if (!point) {
      return [];
    }

    const results: T[] = [];
    for (const { handler } of point.handlers) {
      try {
        const result = await handler(...args);
        results.push(result as T);
      } catch (e) {
        console.error(`扩展点 ${pointName} 处理失败:`, e);
      }
    }

    return results;
  }

  /**
   * 获取插件列表
   */
  getPlugins(): Array<{
    name: string;
    version: string;
    enabled: boolean;
  }> {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      enabled: this.enabledPlugins.has(p.name),
    }));
  }

  /**
   * 获取扩展点列表
   */
  getExtensionPoints(): Array<{
    name: string;
    description: string;
    handlerCount: number;
  }> {
    return Array.from(this.extensionPoints.values()).map(p => ({
      name: p.name,
      description: p.description,
      handlerCount: p.handlers.length,
    }));
  }
}

// ============================================================
// 全局实例
// ============================================================

let globalPluginManager: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!globalPluginManager) {
    globalPluginManager = new PluginManager();
  }
  return globalPluginManager;
}
