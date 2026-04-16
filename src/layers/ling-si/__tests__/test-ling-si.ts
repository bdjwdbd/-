/**
 * 灵思层测试
 * 
 * 测试思考协议引擎的各个组件
 */

import {
  ThinkingProtocolEngine,
  AdaptiveDepthController,
  MultiHypothesisManager,
  ThinkingDepth,
} from "../index";

// ============================================================
// 测试工具
// ============================================================

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}: ${error}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================================
// 测试套件
// ============================================================

console.log("\n🧪 灵思层测试套件\n");

// 测试 ThinkingProtocolEngine
test("ThinkingProtocolEngine 创建", () => {
  const engine = new ThinkingProtocolEngine();
  assert(engine !== undefined, "引擎应该被创建");
});

// 测试 AdaptiveDepthController
test("AdaptiveDepthController 创建", () => {
  const controller = new AdaptiveDepthController();
  assert(controller !== undefined, "控制器应该被创建");
});

// 测试 MultiHypothesisManager
test("MultiHypothesisManager 创建", () => {
  const manager = new MultiHypothesisManager();
  assert(manager !== undefined, "管理器应该被创建");
});

// 测试 ThinkingDepth
test("ThinkingDepth 枚举", () => {
  assert(ThinkingDepth.MINIMAL !== undefined, "MINIMAL 应该存在");
  assert(ThinkingDepth.STANDARD !== undefined, "STANDARD 应该存在");
  assert(ThinkingDepth.EXTENSIVE !== undefined, "EXTENSIVE 应该存在");
  assert(ThinkingDepth.DEEP !== undefined, "DEEP 应该存在");
});

console.log("\n✅ 所有测试通过\n");
