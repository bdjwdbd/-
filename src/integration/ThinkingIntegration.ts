/**
 * 灵思层集成模块
 * 
 * 将 L0 灵思层与其他层级集成：
 * - DecisionCenter（L1 灵枢层）
 * - LearningValidator（L4 灵盾层）
 * - TokenEstimator（L6 灵识层）
 */

import {
  ThinkingProtocolEngine,
  ThinkingResult,
  ThinkingContext,
  ThinkingDepth,
  MultiHypothesisManager,
  AdaptiveDepthController,
} from "../layers/ling-si";

import { DecisionCenter, Decision, DecisionType } from "../core/decision";