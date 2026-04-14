/**
 * 多假设管理器
 * 
 * 在思考过程中保持多个工作假设
 * 基于 Thinking Claude 的 multiple_hypotheses_generation
 */

import {
  Hypothesis,
  HypothesisStatus,
  HypothesisUpdate,
  ThinkingStepName,
} from "./types";
import { randomUUID } from "crypto";

/**
 * 多假设管理器
 */
export class MultiHypothesisManager {
  private hypotheses: Map<string, Hypothesis> = new Map();
  private maxHypotheses: number = 5;
  private history: HypothesisUpdate[] = [];

  /**
   * 设置最大假设数量
   */
  setMaxHypotheses(max: number): void {
    this.maxHypotheses = max;
  }

  /**
   * 添加假设
   */
  addHypothesis(
    content: string,
    sourceStep: ThinkingStepName,
    initialConfidence: number = 0.5
  ): Hypothesis {
    // 检查是否超过最大数量
    if (this.getActiveHypotheses().length >= this.maxHypotheses) {
      // 移除置信度最低的假设
      const lowest = this.getLowestConfidenceHypothesis();
      if (lowest) {
        this.rejectHypothesis(lowest.id, "Exceeded maximum hypotheses limit");
      }
    }

    const hypothesis: Hypothesis = {
      id: this.generateId(),
      content,
      confidence: initialConfidence,
      evidence: [],
      counterEvidence: [],
      status: HypothesisStatus.ACTIVE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceStep,
    };

    this.hypotheses.set(hypothesis.id, hypothesis);
    return hypothesis;
  }

  /**
   * 更新假设
   */
  updateHypothesis(update: HypothesisUpdate): Hypothesis | null {
    const hypothesis = this.hypotheses.get(update.id);
    if (!hypothesis) return null;

    // 应用更新
    if (update.confidenceDelta !== undefined) {
      hypothesis.confidence = Math.max(0, Math.min(1, 
        hypothesis.confidence + update.confidenceDelta
      ));
    }

    if (update.newEvidence) {
      hypothesis.evidence.push(...update.newEvidence);
    }

    if (update.newCounterEvidence) {
      hypothesis.counterEvidence.push(...update.newCounterEvidence);
    }

    if (update.newStatus) {
      hypothesis.status = update.newStatus;
    }

    hypothesis.updatedAt = Date.now();

    // 记录历史
    this.history.push({
      ...update,
      reason: update.reason,
    });

    // 自动状态转换
    this.autoTransitionStatus(hypothesis);

    return hypothesis;
  }

  /**
   * 自动状态转换
   */
  private autoTransitionStatus(hypothesis: Hypothesis): void {
    // 高置信度 + 足够证据 → 确认
    if (hypothesis.confidence >= 0.85 && hypothesis.evidence.length >= 2) {
      hypothesis.status = HypothesisStatus.CONFIRMED;
    }

    // 低置信度 + 反对证据 → 拒绝
    if (hypothesis.confidence <= 0.2 && hypothesis.counterEvidence.length >= 1) {
      hypothesis.status = HypothesisStatus.REJECTED;
    }
  }

  /**
   * 确认假设
   */
  confirmHypothesis(id: string, evidence: string): Hypothesis | null {
    return this.updateHypothesis({
      id,
      newStatus: HypothesisStatus.CONFIRMED,
      newEvidence: [evidence],
      confidenceDelta: 0.2,
      reason: `Confirmed with evidence: ${evidence}`,
    });
  }

  /**
   * 拒绝假设
   */
  rejectHypothesis(id: string, reason: string): Hypothesis | null {
    return this.updateHypothesis({
      id,
      newStatus: HypothesisStatus.REJECTED,
      confidenceDelta: -0.3,
      reason,
    });
  }

  /**
   * 获取假设
   */
  getHypothesis(id: string): Hypothesis | undefined {
    return this.hypotheses.get(id);
  }

  /**
   * 获取所有假设
   */
  getAllHypotheses(): Hypothesis[] {
    return Array.from(this.hypotheses.values());
  }

  /**
   * 获取活跃假设
   */
  getActiveHypotheses(): Hypothesis[] {
    return this.getAllHypotheses().filter(
      (h) => h.status === HypothesisStatus.ACTIVE || h.status === HypothesisStatus.PENDING
    );
  }

  /**
   * 获取已确认假设
   */
  getConfirmedHypotheses(): Hypothesis[] {
    return this.getAllHypotheses().filter(
      (h) => h.status === HypothesisStatus.CONFIRMED
    );
  }

  /**
   * 获取已拒绝假设
   */
  getRejectedHypotheses(): Hypothesis[] {
    return this.getAllHypotheses().filter(
      (h) => h.status === HypothesisStatus.REJECTED
    );
  }

  /**
   * 获取置信度最低的假设
   */
  getLowestConfidenceHypothesis(): Hypothesis | null {
    const active = this.getActiveHypotheses();
    if (active.length === 0) return null;

    return active.reduce((lowest, current) =>
      current.confidence < lowest.confidence ? current : lowest
    );
  }

  /**
   * 获取置信度最高的假设
   */
  getHighestConfidenceHypothesis(): Hypothesis | null {
    const active = this.getActiveHypotheses();
    if (active.length === 0) return null;

    return active.reduce((highest, current) =>
      current.confidence > highest.confidence ? current : highest
    );
  }

  /**
   * 按置信度排序
   */
  sortByConfidence(descending: boolean = true): Hypothesis[] {
    const all = this.getAllHypotheses();
    return all.sort((a, b) =>
      descending ? b.confidence - a.confidence : a.confidence - b.confidence
    );
  }

  /**
   * 添加证据
   */
  addEvidence(id: string, evidence: string, isSupporting: boolean): Hypothesis | null {
    return this.updateHypothesis({
      id,
      newEvidence: isSupporting ? [evidence] : undefined,
      newCounterEvidence: isSupporting ? undefined : [evidence],
      confidenceDelta: isSupporting ? 0.1 : -0.1,
      reason: `Added ${isSupporting ? "supporting" : "counter"} evidence: ${evidence}`,
    });
  }

  /**
   * 比较假设
   */
  compareHypotheses(id1: string, id2: string): {
    winner: string | null;
    comparison: string;
  } {
    const h1 = this.hypotheses.get(id1);
    const h2 = this.hypotheses.get(id2);

    if (!h1 || !h2) {
      return { winner: null, comparison: "One or both hypotheses not found" };
    }

    const score1 = h1.confidence + h1.evidence.length * 0.1 - h1.counterEvidence.length * 0.1;
    const score2 = h2.confidence + h2.evidence.length * 0.1 - h2.counterEvidence.length * 0.1;

    let comparison = `Hypothesis 1 (${h1.content.substring(0, 30)}...): score ${score1.toFixed(2)}\n`;
    comparison += `Hypothesis 2 (${h2.content.substring(0, 30)}...): score ${score2.toFixed(2)}\n`;

    if (score1 > score2) {
      comparison += "Hypothesis 1 is stronger";
      return { winner: id1, comparison };
    } else if (score2 > score1) {
      comparison += "Hypothesis 2 is stronger";
      return { winner: id2, comparison };
    } else {
      comparison += "Both hypotheses are equally strong";
      return { winner: null, comparison };
    }
  }

  /**
   * 生成假设摘要
   */
  generateSummary(): string {
    const all = this.getAllHypotheses();
    const active = this.getActiveHypotheses();
    const confirmed = this.getConfirmedHypotheses();
    const rejected = this.getRejectedHypotheses();

    let summary = `Total hypotheses: ${all.length}\n`;
    summary += `Active: ${active.length}, Confirmed: ${confirmed.length}, Rejected: ${rejected.length}\n\n`;

    if (active.length > 0) {
      summary += "Active hypotheses:\n";
      for (const h of active) {
        summary += `  - [${(h.confidence * 100).toFixed(0)}%] ${h.content}\n`;
      }
    }

    if (confirmed.length > 0) {
      summary += "\nConfirmed hypotheses:\n";
      for (const h of confirmed) {
        summary += `  - ✓ ${h.content}\n`;
      }
    }

    return summary;
  }

  /**
   * 清除所有假设
   */
  clear(): void {
    this.hypotheses.clear();
    this.history = [];
  }

  /**
   * 获取历史记录
   */
  getHistory(): HypothesisUpdate[] {
    return [...this.history];
  }

  /**
   * 导出状态
   */
  export(): Hypothesis[] {
    return this.getAllHypotheses();
  }

  /**
   * 导入状态
   */
  import(hypotheses: Hypothesis[]): void {
    this.clear();
    for (const h of hypotheses) {
      this.hypotheses.set(h.id, h);
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `hyp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// 导出单例
export const multiHypothesisManager = new MultiHypothesisManager();
