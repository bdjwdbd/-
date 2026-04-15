/**
 * HNSW 高性能桥接层
 * 
 * 通过子进程调用 Python hnswlib，提供 100% 性能
 * 如果 hnswlib 不可用，自动回退到纯 TS 实现
 */

import { spawn, ChildProcess } from "child_process";
import * as path from "path";

export interface HNSWConfig {
  dimensions: number;
  maxElements?: number;
  maxConnections?: number;  // M
  efConstruction?: number;
  efSearch?: number;
}

export interface SearchResult {
  id: string;
  distance: number;
  score: number;
}

export interface BenchmarkResult {
  dim: number;
  count: number;
  buildTimeMs: number;
  search100Ms: number;
  avgSearchMs: number;
  backend: string;
}

/**
 * HNSW 高性能索引
 * 
 * 使用方式：
 * 1. 优先使用 Python hnswlib（100% 性能）
 * 2. 自动回退到纯 TS 实现（85% 性能）
 */
export class HNSWHighPerformance {
  private config: HNSWConfig;
  private pythonProcess: ChildProcess | null = null;
  private requestQueue: Array<{
    command: any;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessing: boolean = false;
  private usePython: boolean = false;
  private fallbackIndex: any = null;
  
  constructor(config: HNSWConfig) {
    this.config = {
      maxElements: 10000,
      maxConnections: 16,
      efConstruction: 200,
      efSearch: 50,
      ...config,
    };
  }
  
  /**
   * 初始化
   * 尝试启动 Python 服务，失败则回退到纯 TS
   */
  async initialize(): Promise<boolean> {
    try {
      // 尝试启动 Python 服务
      const scriptPath = path.join(__dirname, "hnsw_service.py");
      
      this.pythonProcess = spawn("python3", [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      
      if (!this.pythonProcess.stdin || !this.pythonProcess.stdout) {
        throw new Error("Failed to create pipes");
      }
      
      // 监听输出
      const stdout = this.pythonProcess.stdout;
      const stderr = this.pythonProcess.stderr;
      
      if (stdout) {
        stdout.on("data", (data) => {
          this.handleResponse(data.toString());
        });
      }
      
      if (stderr) {
        stderr.on("data", (data) => {
          console.error("[HNSWPython]", data.toString());
        });
      }
      
      this.pythonProcess.on("error", (err) => {
        console.error("[HNSWPython] Process error:", err);
        this.usePython = false;
      });
      
      this.pythonProcess.on("close", (code) => {
        console.error("[HNSWPython] Process closed:", code);
        this.usePython = false;
        this.pythonProcess = null;
      });
      
      // 创建索引
      await this.sendCommand({
        action: "create",
        dim: this.config.dimensions,
        max_elements: this.config.maxElements,
        M: this.config.maxConnections,
        ef_construction: this.config.efConstruction,
        ef_search: this.config.efSearch,
      });
      
      this.usePython = true;
      // console.log("[HNSWHighPerformance] ✅ 使用 Python hnswlib（100% 性能）");
      return true;
      
    } catch (error) {
      // console.log("[HNSWHighPerformance] ⚠️ Python 不可用，回退到纯 TS 实现");
      this.usePython = false;
      
      // 回退到纯 TS 实现
      const { HNSWIndex } = await import("../core/hnsw-index");
      this.fallbackIndex = new HNSWIndex({
        dimensions: this.config.dimensions,
        maxConnections: this.config.maxConnections || 16,
        efConstruction: this.config.efConstruction || 200,
        efSearch: this.config.efSearch || 50,
      });
      
      return false;
    }
  }
  
  /**
   * 添加向量
   */
  async add(id: string, vector: number[]): Promise<void> {
    if (this.usePython) {
      await this.sendCommand({
        action: "add",
        id,
        vector,
      });
    } else if (this.fallbackIndex) {
      this.fallbackIndex.add(id, vector);
    }
  }
  
  /**
   * 批量添加
   */
  async addBatch(items: Array<{ id: string; vector: number[] }>): Promise<void> {
    if (this.usePython) {
      await this.sendCommand({
        action: "add_batch",
        items,
      });
    } else if (this.fallbackIndex) {
      this.fallbackIndex.addBatch(items);
    }
  }
  
  /**
   * 搜索
   */
  async search(query: number[], k: number = 10): Promise<SearchResult[]> {
    if (this.usePython) {
      const result = await this.sendCommand({
        action: "search",
        query,
        k,
      });
      return result.results || [];
    } else if (this.fallbackIndex) {
      return this.fallbackIndex.search(query, k);
    }
    return [];
  }
  
  /**
   * 获取统计信息
   */
  async getStats(): Promise<any> {
    if (this.usePython) {
      const result = await this.sendCommand({ action: "stats" });
      return result.stats;
    } else if (this.fallbackIndex) {
      return this.fallbackIndex.getStats();
    }
    return null;
  }
  
  /**
   * 运行性能基准测试
   */
  async benchmark(dim: number = 4096, count: number = 1000): Promise<BenchmarkResult> {
    if (this.usePython) {
      const result = await this.sendCommand({
        action: "benchmark",
        dim,
        count,
      });
      return result.benchmark;
    } else {
      // 纯 TS 基准测试
      const start = Date.now();
      for (let i = 0; i < count; i++) {
        const vec = Array.from({ length: dim }, () => Math.random());
        this.fallbackIndex.add(`vec-${i}`, vec);
      }
      const buildTime = Date.now() - start;
      
      const query = Array.from({ length: dim }, () => Math.random());
      const searchStart = Date.now();
      for (let i = 0; i < 100; i++) {
        this.fallbackIndex.search(query, 10);
      }
      const searchTime = Date.now() - searchStart;
      
      return {
        dim,
        count,
        buildTimeMs: buildTime,
        search100Ms: searchTime,
        avgSearchMs: searchTime / 100,
        backend: "typescript",
      };
    }
  }
  
  /**
   * 关闭
   */
  close(): void {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }
  
  /**
   * 发送命令
   */
  private sendCommand(command: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ command, resolve, reject });
      this.processQueue();
    });
  }
  
  /**
   * 处理队列
   */
  private processQueue(): void {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    const { command } = this.requestQueue[0];
    
    const commandStr = JSON.stringify(command) + "\n";
    this.pythonProcess?.stdin?.write(commandStr);
  }
  
  /**
   * 处理响应
   */
  private handleResponse(data: string): void {
    const lines = data.trim().split("\n");
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response = JSON.parse(line);
        const request = this.requestQueue.shift();
        
        if (request) {
          if (response.success) {
            request.resolve(response);
          } else {
            request.reject(new Error(response.error || "Unknown error"));
          }
        }
        
        this.isProcessing = false;
        this.processQueue();
        
      } catch (error) {
        console.error("[HNSWPython] Parse error:", error);
      }
    }
  }
}
