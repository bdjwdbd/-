/**
 * 边缘计算支持模块
 * 
 * 功能：
 * 1. 本地模型推理
 * 2. 边缘设备管理
 * 3. 云边协同
 * 4. 离线能力
 */

// ============================================================
// 类型定义
// ============================================================

interface EdgeDevice {
  id: string;
  name: string;
  type: 'mobile' | 'iot' | 'edge-server' | 'desktop';
  capabilities: {
    cpu: number; // 核心数
    memory: number; // MB
    gpu: boolean;
    npu: boolean;
  };
  status: 'online' | 'offline' | 'busy';
  lastHeartbeat: number;
  models: string[];
}

interface LocalModel {
  id: string;
  name: string;
  version: string;
  size: number; // MB
  type: 'llm' | 'embedding' | 'vision' | 'audio';
  quantization: 'fp32' | 'fp16' | 'int8' | 'int4';
  supportedDevices: string[];
}

interface InferenceRequest {
  modelId: string;
  input: any;
  deviceId?: string;
  priority: 'low' | 'normal' | 'high';
  timeout: number;
}

interface InferenceResult {
  requestId: string;
  deviceId: string;
  modelId: string;
  output: any;
  latency: number;
  timestamp: number;
}

interface EdgeConfig {
  preferLocal: boolean;
  fallbackToCloud: boolean;
  maxLocalModels: number;
  syncInterval: number;
}

// ============================================================
// 边缘设备管理器
// ============================================================

export class EdgeDeviceManager {
  private devices: Map<string, EdgeDevice> = new Map();
  private localModels: Map<string, LocalModel> = new Map();
  private config: EdgeConfig;

  constructor(config?: Partial<EdgeConfig>) {
    this.config = {
      preferLocal: true,
      fallbackToCloud: true,
      maxLocalModels: 5,
      syncInterval: 60000,
      ...config,
    };
  }

  /**
   * 注册设备
   */
  registerDevice(device: Omit<EdgeDevice, 'id' | 'lastHeartbeat'>): EdgeDevice {
    const id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newDevice: EdgeDevice = {
      ...device,
      id,
      lastHeartbeat: Date.now(),
    };

    this.devices.set(id, newDevice);
    return newDevice;
  }

  /**
   * 注销设备
   */
  unregisterDevice(deviceId: string): boolean {
    return this.devices.delete(deviceId);
  }

  /**
   * 更新心跳
   */
  updateHeartbeat(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.lastHeartbeat = Date.now();
      device.status = 'online';
    }
  }

  /**
   * 获取可用设备
   */
  getAvailableDevices(modelId?: string): EdgeDevice[] {
    const now = Date.now();
    const timeout = 120000; // 2 分钟超时

    return Array.from(this.devices.values()).filter(device => {
      // 检查在线状态
      if (now - device.lastHeartbeat > timeout) {
        device.status = 'offline';
        return false;
      }

      // 检查是否忙碌
      if (device.status === 'busy') return false;

      // 检查模型支持
      if (modelId && !device.models.includes(modelId)) return false;

      return true;
    });
  }

  /**
   * 选择最佳设备
   */
  selectBestDevice(modelId: string, requirements?: { minMemory?: number; requireGpu?: boolean }): EdgeDevice | null {
    const available = this.getAvailableDevices(modelId);
    
    if (available.length === 0) return null;

    // 按能力排序
    const scored = available.map(device => {
      let score = 0;
      
      // GPU/NPU 加分
      if (requirements?.requireGpu && device.capabilities.gpu) score += 50;
      if (device.capabilities.npu) score += 30;
      
      // 内存加分
      if (requirements?.minMemory && device.capabilities.memory >= requirements.minMemory) {
        score += 20;
      }
      
      // 设备类型加分
      if (device.type === 'edge-server') score += 40;
      if (device.type === 'desktop') score += 30;
      
      return { device, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.device || null;
  }

  /**
   * 注册本地模型
   */
  registerLocalModel(model: LocalModel): void {
    this.localModels.set(model.id, model);
  }

  /**
   * 获取模型
   */
  getModel(modelId: string): LocalModel | null {
    return this.localModels.get(modelId) || null;
  }

  /**
   * 获取所有模型
   */
  getAllModels(): LocalModel[] {
    return Array.from(this.localModels.values());
  }

  /**
   * 获取设备统计
   */
  getStats(): { totalDevices: number; onlineDevices: number; totalModels: number } {
    const now = Date.now();
    const online = Array.from(this.devices.values()).filter(d => now - d.lastHeartbeat < 120000);

    return {
      totalDevices: this.devices.size,
      onlineDevices: online.length,
      totalModels: this.localModels.size,
    };
  }
}

// ============================================================
// 本地推理引擎
// ============================================================

export class LocalInferenceEngine {
  private deviceManager: EdgeDeviceManager;
  private modelCache: Map<string, any> = new Map();
  private requestQueue: InferenceRequest[] = [];
  private isProcessing: boolean = false;

  constructor(deviceManager: EdgeDeviceManager) {
    this.deviceManager = deviceManager;
  }

  /**
   * 加载模型
   */
  async loadModel(modelId: string, deviceId: string): Promise<boolean> {
    const model = this.deviceManager.getModel(modelId);
    const device = this.deviceManager['devices'].get(deviceId);

    if (!model || !device) return false;

    // 模拟模型加载
    // console.log(`Loading model ${model.name} on device ${device.name}`);
    
    // 缓存模型
    this.modelCache.set(`${deviceId}-${modelId}`, {
      model,
      device,
      loadedAt: Date.now(),
    });

    // 更新设备模型列表
    if (!device.models.includes(modelId)) {
      device.models.push(modelId);
    }

    return true;
  }

  /**
   * 卸载模型
   */
  unloadModel(modelId: string, deviceId: string): void {
    this.modelCache.delete(`${deviceId}-${modelId}`);
    
    const device = this.deviceManager['devices'].get(deviceId);
    if (device) {
      device.models = device.models.filter(id => id !== modelId);
    }
  }

  /**
   * 执行推理
   */
  async infer(request: InferenceRequest): Promise<InferenceResult> {
    const startTime = Date.now();

    // 选择设备
    const device = request.deviceId
      ? this.deviceManager['devices'].get(request.deviceId)
      : this.deviceManager.selectBestDevice(request.modelId);

    if (!device) {
      throw new Error('No available device for inference');
    }

    // 检查模型是否已加载
    const cacheKey = `${device.id}-${request.modelId}`;
    if (!this.modelCache.has(cacheKey)) {
      await this.loadModel(request.modelId, device.id);
    }

    // 模拟推理
    const model = this.deviceManager.getModel(request.modelId);
    let output: any;

    switch (model?.type) {
      case 'llm':
        output = await this.inferLLM(request.input, device);
        break;
      case 'embedding':
        output = await this.inferEmbedding(request.input, device);
        break;
      case 'vision':
        output = await this.inferVision(request.input, device);
        break;
      default:
        output = { result: 'simulated output' };
    }

    return {
      requestId: `req-${Date.now()}`,
      deviceId: device.id,
      modelId: request.modelId,
      output,
      latency: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * LLM 推理
   */
  private async inferLLM(input: any, device: EdgeDevice): Promise<any> {
    // 模拟本地 LLM 推理
    const tokensPerSecond = device.capabilities.npu ? 50 : device.capabilities.gpu ? 30 : 10;
    const inputLength = typeof input === 'string' ? input.length : 100;
    const inferenceTime = (inputLength / tokensPerSecond) * 1000;

    await this.sleep(Math.min(inferenceTime, 5000));

    return {
      text: `[本地推理] 基于输入生成的响应`,
      tokens: inputLength,
      device: device.name,
    };
  }

  /**
   * Embedding 推理
   */
  private async inferEmbedding(input: any, device: EdgeDevice): Promise<any> {
    // 模拟 Embedding 生成
    await this.sleep(50);

    return {
      embedding: Array(128).fill(0).map(() => Math.random()),
      dimensions: 128,
      device: device.name,
    };
  }

  /**
   * Vision 推理
   */
  private async inferVision(input: any, device: EdgeDevice): Promise<any> {
    // 模拟视觉推理
    await this.sleep(100);

    return {
      labels: ['object1', 'object2'],
      confidence: [0.95, 0.87],
      device: device.name,
    };
  }

  /**
   * 辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 云边协同管理器
// ============================================================

export class CloudEdgeCoordinator {
  private deviceManager: EdgeDeviceManager;
  private localEngine: LocalInferenceEngine;
  private cloudEndpoint: string | null = null;

  constructor(deviceManager: EdgeDeviceManager) {
    this.deviceManager = deviceManager;
    this.localEngine = new LocalInferenceEngine(deviceManager);
  }

  /**
   * 设置云端端点
   */
  setCloudEndpoint(endpoint: string): void {
    this.cloudEndpoint = endpoint;
  }

  /**
   * 智能推理（自动选择本地或云端）
   */
  async smartInfer(request: InferenceRequest): Promise<InferenceResult> {
    // 优先尝试本地推理
    const localDevice = this.deviceManager.selectBestDevice(request.modelId);

    if (localDevice) {
      try {
        const result = await this.localEngine.infer({
          ...request,
          deviceId: localDevice.id,
        });
        return result;
      } catch (error) {
        console.error('Local inference failed:', error);
      }
    }

    // 回退到云端
    if (this.cloudEndpoint) {
      return this.cloudInfer(request);
    }

    throw new Error('No available inference endpoint');
  }

  /**
   * 云端推理
   */
  private async cloudInfer(request: InferenceRequest): Promise<InferenceResult> {
    // 模拟云端推理
    const startTime = Date.now();

    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      requestId: `cloud-req-${Date.now()}`,
      deviceId: 'cloud',
      modelId: request.modelId,
      output: { text: '[云端推理] 响应', source: 'cloud' },
      latency: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * 同步模型
   */
  async syncModels(): Promise<{ downloaded: string[]; removed: string[] }> {
    const downloaded: string[] = [];
    const removed: string[] = [];

    // 模拟模型同步
    const availableDevices = this.deviceManager.getAvailableDevices();
    
    for (const device of availableDevices) {
      // 检查设备模型数量
      if (device.models.length < 3) {
        // 下载新模型
        const modelId = `model-${Date.now()}`;
        device.models.push(modelId);
        downloaded.push(modelId);
      }
    }

    return { downloaded, removed };
  }

  /**
   * 获取本地引擎
   */
  getLocalEngine(): LocalInferenceEngine {
    return this.localEngine;
  }

  /**
   * 获取设备管理器
   */
  getDeviceManager(): EdgeDeviceManager {
    return this.deviceManager;
  }
}

// ============================================================
// 单例
// ============================================================

let edgeDeviceManagerInstance: EdgeDeviceManager | null = null;
let cloudEdgeCoordinatorInstance: CloudEdgeCoordinator | null = null;

export function getEdgeDeviceManager(): EdgeDeviceManager {
  if (!edgeDeviceManagerInstance) {
    edgeDeviceManagerInstance = new EdgeDeviceManager();
  }
  return edgeDeviceManagerInstance;
}

export function getCloudEdgeCoordinator(): CloudEdgeCoordinator {
  if (!cloudEdgeCoordinatorInstance) {
    cloudEdgeCoordinatorInstance = new CloudEdgeCoordinator(getEdgeDeviceManager());
  }
  return cloudEdgeCoordinatorInstance;
}
