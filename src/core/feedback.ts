/**
 * 反馈与调节组件
 * 
 * 包含：
 * - FeedbackCenter: 反馈中心
 * - RegulationCenter: 调节中心
 * - StressResponse: 应激响应
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// 类型定义
// ============================================================

type FeedbackType = "positive" | "negative" | "neutral" | "suggestion";
type FeedbackSource = "user" | "system" | "auto";
type RegulationAction = "adjust" | "alert" | "throttle" | "restart";
type StressLevel = "low" | "medium" | "high" | "critical";

interface Feedback {
  id: string;
  type: FeedbackType;
  source: FeedbackSource;
  content: string;
  context?: Record<string, unknown>;
  timestamp: Date;
  processed: boolean;
}

interface RegulationRule {
  id: string;
  name: string;
  condition: (metrics: Record<string, number>) => boolean;
  action: RegulationAction;
  priority: number;
  enabled: boolean;
}

interface RegulationEvent {
  id: string;
  ruleId: string;
  action: RegulationAction;
  metrics: Record<string, number>;
  timestamp: Date;
  result: string;
}

interface StressIndicator {
  name: string;
  value: number;
  threshold: number;
  level: StressLevel;
}

// ============================================================
// FeedbackCenter - 反馈中心
// ============================================================

export class FeedbackCenter {
  private feedbacks: Feedback[] = [];
  private maxFeedbacks: number = 5000;
  
  submit(
    type: FeedbackType,
    source: FeedbackSource,
    content: string,
    context?: Record<string, unknown>
  ): Feedback {
    const feedback: Feedback = {
      id: `feedback-${Date.now()}`,
      type,
      source,
      content,
      context,
      timestamp: new Date(),
      processed: false,
    };
    
    this.feedbacks.push(feedback);
    
    if (this.feedbacks.length > this.maxFeedbacks) {
      this.feedbacks.shift();
    }
    
    return feedback;
  }
  
  process(feedbackId: string): boolean {
    const feedback = this.feedbacks.find(f => f.id === feedbackId);
    if (!feedback) return false;
    
    feedback.processed = true;
    return true;
  }
  
  getUnprocessed(): Feedback[] {
    return this.feedbacks.filter(f => !f.processed);
  }
  
  getByType(type: FeedbackType): Feedback[] {
    return this.feedbacks.filter(f => f.type === type);
  }
  
  getBySource(source: FeedbackSource): Feedback[] {
    return this.feedbacks.filter(f => f.source === source);
  }
  
  getStats(): {
    total: number;
    byType: Record<FeedbackType, number>;
    bySource: Record<FeedbackSource, number>;
    processedRate: number;
  } {
    const total = this.feedbacks.length;
    const processed = this.feedbacks.filter(f => f.processed).length;
    
    const byType: Record<FeedbackType, number> = {
      positive: 0,
      negative: 0,
      neutral: 0,
      suggestion: 0,
    };
    
    const bySource: Record<FeedbackSource, number> = {
      user: 0,
      system: 0,
      auto: 0,
    };
    
    for (const feedback of this.feedbacks) {
      byType[feedback.type]++;
      bySource[feedback.source]++;
    }
    
    return {
      total,
      byType,
      bySource,
      processedRate: total > 0 ? processed / total : 0,
    };
  }
  
  clear(): void {
    this.feedbacks = [];
  }
}

// ============================================================
// RegulationCenter - 调节中心
// ============================================================

export class RegulationCenter {
  private rules: Map<string, RegulationRule> = new Map();
  private events: RegulationEvent[] = [];
  private maxEvents: number = 1000;
  private metrics: Map<string, number> = new Map();
  
  addRule(rule: RegulationRule): void {
    this.rules.set(rule.id, rule);
  }
  
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }
  
  updateMetric(name: string, value: number): void {
    this.metrics.set(name, value);
    this.checkRules();
  }
  
  private checkRules(): void {
    const currentMetrics = Object.fromEntries(this.metrics);
    
    const sortedRules = Array.from(this.rules.values())
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);
    
    for (const rule of sortedRules) {
      if (rule.condition(currentMetrics)) {
        this.executeRule(rule, currentMetrics);
      }
    }
  }
  
  private executeRule(rule: RegulationRule, metrics: Record<string, number>): void {
    const event: RegulationEvent = {
      id: `event-${Date.now()}`,
      ruleId: rule.id,
      action: rule.action,
      metrics: { ...metrics },
      timestamp: new Date(),
      result: "executed",
    };
    
    this.events.push(event);
    
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    
    // 执行动作
    switch (rule.action) {
      case "adjust":
        // console.log(`[Regulation] 调整参数: ${rule.name}`);
        break;
      case "alert":
        // console.log(`[Regulation] 警告: ${rule.name}`);
        break;
      case "throttle":
        // console.log(`[Regulation] 限流: ${rule.name}`);
        break;
      case "restart":
        // console.log(`[Regulation] 重启: ${rule.name}`);
        break;
    }
  }
  
  getMetric(name: string): number | undefined {
    return this.metrics.get(name);
  }
  
  getAllMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
  
  getEvents(limit: number = 50): RegulationEvent[] {
    return this.events.slice(-limit);
  }
  
  getRules(): RegulationRule[] {
    return Array.from(this.rules.values());
  }
  
  clear(): void {
    this.rules.clear();
    this.events = [];
    this.metrics.clear();
  }
}

// ============================================================
// StressResponse - 应激响应
// ============================================================

export class StressResponse {
  private indicators: Map<string, StressIndicator> = new Map();
  private responses: Map<StressLevel, () => void> = new Map();
  private currentLevel: StressLevel = "low";
  
  defineIndicator(name: string, threshold: number): void {
    this.indicators.set(name, {
      name,
      value: 0,
      threshold,
      level: "low",
    });
  }
  
  updateIndicator(name: string, value: number): StressLevel {
    const indicator = this.indicators.get(name);
    if (!indicator) return "low";
    
    indicator.value = value;
    
    // 计算压力等级
    const ratio = value / indicator.threshold;
    
    if (ratio >= 1.5) {
      indicator.level = "critical";
    } else if (ratio >= 1.2) {
      indicator.level = "high";
    } else if (ratio >= 0.8) {
      indicator.level = "medium";
    } else {
      indicator.level = "low";
    }
    
    // 更新整体压力等级
    this.updateOverallLevel();
    
    // 触发响应
    this.triggerResponse(indicator.level);
    
    return indicator.level;
  }
  
  private updateOverallLevel(): void {
    const levels: StressLevel[] = ["low", "medium", "high", "critical"];
    const levelValues: Record<StressLevel, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    
    let maxLevel: StressLevel = "low";
    
    for (const indicator of this.indicators.values()) {
      if (levelValues[indicator.level] > levelValues[maxLevel]) {
        maxLevel = indicator.level;
      }
    }
    
    this.currentLevel = maxLevel;
  }
  
  registerResponse(level: StressLevel, handler: () => void): void {
    this.responses.set(level, handler);
  }
  
  private triggerResponse(level: StressLevel): void {
    const response = this.responses.get(level);
    if (response) {
      response();
    }
  }
  
  getCurrentLevel(): StressLevel {
    return this.currentLevel;
  }
  
  getIndicators(): StressIndicator[] {
    return Array.from(this.indicators.values());
  }
  
  getIndicator(name: string): StressIndicator | undefined {
    return this.indicators.get(name);
  }
  
  clear(): void {
    this.indicators.clear();
    this.responses.clear();
    this.currentLevel = "low";
  }
}

export type {
  FeedbackType,
  FeedbackSource,
  RegulationAction,
  StressLevel,
  Feedback,
  RegulationRule,
  RegulationEvent,
  StressIndicator,
};
