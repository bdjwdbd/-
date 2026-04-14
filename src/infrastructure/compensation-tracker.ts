/**
 * 自动补偿面追踪
 * 
 * 功能：
 * 1. 定期基准测试
 * 2. 假设验证
 * 3. 自动生成迁移建议
 */

import { StructuredLogger, PerformanceMonitor } from './index';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface ComponentHealth {
  id: string;
  name: string;
  hypothesis: string;
  status: 'active' | 'deprecated' | 'removable';
  lastChecked: number;
  validationResults: ValidationResult[];
  recommendation: string;
}

export interface ValidationResult {
  timestamp: number;
  passed: boolean;
  score: number;
  reason: string;
}

export interface CompensationReport {
  generatedAt: number;
  components: ComponentHealth[];
  removableComponents: string[];
  deprecatedComponents: string[];
  suggestions: string[];
}

// ============ 补偿面追踪器 ============

export class CompensationTracker {
  private logger: StructuredLogger;
  private performanceMonitor: PerformanceMonitor;
  private components: Map<string, ComponentHealth> = new Map();
  private reportDir: string;
  
  // 验证阈值
  private static REMOVAL_THRESHOLD = 0.95;  // 95% 通过率可移除
  private static DEPRECATION_THRESHOLD = 0.80; // 80% 通过率可废弃
  
  constructor(
    logger: StructuredLogger,
    performanceMonitor: PerformanceMonitor,
    reportDir: string = './reports/compensation'
  ) {
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.reportDir = reportDir;
    this.ensureDir(reportDir);
    
    // 初始化组件
    this.initializeComponents();
  }
  
  /**
   * 初始化组件追踪
   */
  private initializeComponents(): void {
    const defaultComponents = [
      { id: 'one-way-valve', name: '单向阀门', hypothesis: '模型会提前交卷' },
      { id: 'learning-validator', name: '学习验证', hypothesis: '模型会盲目自信' },
      { id: 'memory-center', name: '记忆中心', hypothesis: '模型会失忆' },
      { id: 'environment-awareness', name: '环境感知', hypothesis: '模型有环境盲区' },
      { id: 'context-reset', name: '上下文重置', hypothesis: '上下文会溢出' },
      { id: 'cache-system', name: '缓存系统', hypothesis: '重复请求浪费资源' },
      { id: 'token-estimator', name: 'Token估算器', hypothesis: '无法精确控制上下文' },
      { id: 'structured-logger', name: '结构化日志', hypothesis: '无法追踪问题' },
      { id: 'performance-monitor', name: '性能监控', hypothesis: '无法发现瓶颈' },
      { id: 'sprint-contract', name: 'Sprint Contract', hypothesis: '模型不会定义完成' },
      { id: 'stream-support', name: '流式支持', hypothesis: '用户等待时间长' },
      { id: 'multi-model-routing', name: '多模型路由', hypothesis: '单一模型无法平衡' },
    ];
    
    for (const comp of defaultComponents) {
      this.components.set(comp.id, {
        id: comp.id,
        name: comp.name,
        hypothesis: comp.hypothesis,
        status: 'active',
        lastChecked: Date.now(),
        validationResults: [],
        recommendation: '继续观察',
      });
    }
  }
  
  /**
   * 运行验证检查
   */
  async runValidation(): Promise<CompensationReport> {
    this.logger.info('CompensationTracker', '开始补偿面验证...');
    
    const startTime = Date.now();
    
    // 获取系统指标
    const systemMetrics = this.performanceMonitor.getSystemMetrics();
    
    // 验证每个组件
    for (const [id, component] of this.components) {
      const result = await this.validateComponent(component, systemMetrics);
      component.validationResults.push(result);
      component.lastChecked = Date.now();
      
      // 更新状态
      this.updateComponentStatus(component);
    }
    
    // 生成报告
    const report = this.generateReport();
    
    // 保存报告
    this.saveReport(report);
    
    this.logger.info('CompensationTracker', 
      `验证完成: ${report.removableComponents.length} 可移除, ${report.deprecatedComponents.length} 可废弃`
    );
    
    return report;
  }
  
  /**
   * 验证单个组件
   */
  private async validateComponent(
    component: ComponentHealth,
    systemMetrics: any
  ): Promise<ValidationResult> {
    // 根据组件类型执行不同的验证逻辑
    let passed = false;
    let score = 0;
    let reason = '';
    
    switch (component.id) {
      case 'one-way-valve':
        // 验证：任务完成率是否 > 95%
        passed = systemMetrics.successRate > 0.95;
        score = systemMetrics.successRate;
        reason = `任务成功率: ${(systemMetrics.successRate * 100).toFixed(1)}%`;
        break;
        
      case 'learning-validator':
        // 验证：错误恢复率
        passed = systemMetrics.successRate > 0.90;
        score = systemMetrics.successRate;
        reason = `验证通过率: ${(systemMetrics.successRate * 100).toFixed(1)}%`;
        break;
        
      case 'memory-center':
        // 验证：上下文使用率
        passed = systemMetrics.avgLatency < 2000;
        score = 1 - (systemMetrics.avgLatency / 5000);
        reason = `平均延迟: ${systemMetrics.avgLatency}ms`;
        break;
        
      case 'cache-system':
        // 验证：缓存命中率
        passed = systemMetrics.cacheHitRate > 0.3;
        score = systemMetrics.cacheHitRate;
        reason = `缓存命中率: ${(systemMetrics.cacheHitRate * 100).toFixed(1)}%`;
        break;
        
      default:
        // 默认验证：系统健康度
        passed = systemMetrics.health > 0.8;
        score = systemMetrics.health;
        reason = `系统健康度: ${(systemMetrics.health * 100).toFixed(1)}%`;
    }
    
    return {
      timestamp: Date.now(),
      passed,
      score,
      reason,
    };
  }
  
  /**
   * 更新组件状态
   */
  private updateComponentStatus(component: ComponentHealth): void {
    // 计算最近验证的通过率
    const recentResults = component.validationResults.slice(-5);
    const passRate = recentResults.filter(r => r.passed).length / recentResults.length;
    const avgScore = recentResults.reduce((sum, r) => sum + r.score, 0) / recentResults.length;
    
    if (passRate >= CompensationTracker.REMOVAL_THRESHOLD) {
      component.status = 'removable';
      component.recommendation = `假设已不成立，建议移除 (通过率: ${(passRate * 100).toFixed(0)}%)`;
    } else if (passRate >= CompensationTracker.DEPRECATION_THRESHOLD) {
      component.status = 'deprecated';
      component.recommendation = `假设部分成立，可考虑废弃 (通过率: ${(passRate * 100).toFixed(0)}%)`;
    } else {
      component.status = 'active';
      component.recommendation = `假设仍成立，继续保留 (通过率: ${(passRate * 100).toFixed(0)}%)`;
    }
  }
  
  /**
   * 生成报告
   */
  private generateReport(): CompensationReport {
    const components = Array.from(this.components.values());
    
    const removableComponents = components
      .filter(c => c.status === 'removable')
      .map(c => c.id);
    
    const deprecatedComponents = components
      .filter(c => c.status === 'deprecated')
      .map(c => c.id);
    
    const suggestions: string[] = [];
    
    // 生成建议
    if (removableComponents.length > 0) {
      suggestions.push(`以下组件可移除: ${removableComponents.join(', ')}`);
    }
    
    if (deprecatedComponents.length > 0) {
      suggestions.push(`以下组件可废弃: ${deprecatedComponents.join(', ')}`);
    }
    
    // 添加优化建议
    const activeComponents = components.filter(c => c.status === 'active');
    if (activeComponents.length > 0) {
      suggestions.push(`继续监控 ${activeComponents.length} 个活跃组件`);
    }
    
    return {
      generatedAt: Date.now(),
      components,
      removableComponents,
      deprecatedComponents,
      suggestions,
    };
  }
  
  /**
   * 保存报告
   */
  private saveReport(report: CompensationReport): void {
    const filename = `compensation-report-${Date.now()}.json`;
    const filePath = path.join(this.reportDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    
    this.logger.info('CompensationTracker', `报告已保存: ${filePath}`);
  }
  
  /**
   * 获取组件状态
   */
  getComponentStatus(id: string): ComponentHealth | undefined {
    return this.components.get(id);
  }
  
  /**
   * 获取所有组件状态
   */
  getAllComponents(): ComponentHealth[] {
    return Array.from(this.components.values());
  }
  
  /**
   * 手动标记组件状态
   */
  markComponent(id: string, status: 'active' | 'deprecated' | 'removable', reason: string): void {
    const component = this.components.get(id);
    if (component) {
      component.status = status;
      component.recommendation = reason;
      this.logger.info('CompensationTracker', `手动标记组件: ${id} -> ${status}`);
    }
  }
  
  /**
   * 添加自定义组件
   */
  addComponent(id: string, name: string, hypothesis: string): void {
    this.components.set(id, {
      id,
      name,
      hypothesis,
      status: 'active',
      lastChecked: Date.now(),
      validationResults: [],
      recommendation: '新添加，待验证',
    });
    
    this.logger.info('CompensationTracker', `添加组件: ${name}`);
  }
  
  // ============ 辅助方法 ============
  
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
