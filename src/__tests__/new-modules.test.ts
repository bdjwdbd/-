/**
 * 新增模块测试
 */

import { contradictionAnalyzer } from "../layers/ling-shu/ContradictionAnalyzer";
import { protractedStrategy } from "../layers/ling-shu/ProtractedStrategy";
import { workflowOrchestrator } from "../layers/ling-mai/WorkflowOrchestrator";
import { practiceCognition } from "../layers/ling-yun/PracticeCognition";
import { emotionEngine } from "../layers/ling-si/EmotionEngine";
import { opinionFramework } from "../output/OpinionFramework";
import { deAIFilter } from "../output/DeAIFilter";

describe("ContradictionAnalyzer", () => {
  it("应该能识别矛盾", () => {
    const result = contradictionAnalyzer.analyze(
      "项目时间紧迫，但需求复杂，资源有限"
    );

    expect(result.contradictions.length).toBeGreaterThan(0);
    expect(result.principalContradiction).not.toBeNull();
  });

  it("应该能识别主要矛盾", () => {
    const result = contradictionAnalyzer.analyze(
      "时间紧迫，任务复杂，预算有限"
    );

    expect(result.principalContradiction?.isPrincipal).toBe(true);
  });

  it("应该能区分矛盾性质", () => {
    const result = contradictionAnalyzer.analyze(
      "用户A和用户B的需求冲突"
    );

    const antagonistic = result.contradictions.find(
      (c) => c.nature === "antagonistic"
    );
    expect(antagonistic).toBeDefined();
  });
});

describe("ProtractedStrategy", () => {
  it("应该能评估阶段", () => {
    const result = protractedStrategy.assessPhase({
      goal: "完成项目",
      currentProgress: "刚开始",
      resources: ["开发人员"],
      obstacles: ["时间紧", "需求不明确", "技术难点"],
    });

    expect(result.currentPhase).toBe("defense");
    expect(result.coreTask).toContain("站稳脚跟");
  });

  it("应该能识别相持期", () => {
    const result = protractedStrategy.assessPhase({
      goal: "完成项目",
      currentProgress: "正在迭代优化中，已经实现了核心功能的开发工作，目前在进行性能调优和测试工作，进展顺利，预计下周可以交付", // 超过50字符
      resources: ["开发人员", "测试人员", "设计稿"],
      obstacles: ["性能问题"],
    });

    // 资源充足但没有突破性进展，应该是相持期
    expect(result.currentPhase).toBe("stalemate");
  });
});

describe("WorkflowOrchestrator", () => {
  it("应该能选择工作流", () => {
    const workflow = workflowOrchestrator.selectWorkflow(
      "这是一个新项目，不知道从哪里下手"
    );

    expect(workflow).not.toBeNull();
    expect(workflow?.id).toBe("new_project");
  });

  it("应该能开始工作流", () => {
    const result = workflowOrchestrator.startWorkflow("new_project");

    expect(result.status).toBe("running");
    expect(result.currentStep).toBe(0);
  });

  it("应该能列出所有工作流", () => {
    const workflows = workflowOrchestrator.listWorkflows();

    expect(workflows.length).toBe(3);
  });
});

describe("PracticeCognition", () => {
  it("应该能开始认识循环", () => {
    const result = practiceCognition.startCycle("解决性能问题");

    expect(result.phase).toBe("sensory");
    expect(result.isComplete).toBe(false);
  });

  it("应该能推进到理性认识阶段", () => {
    practiceCognition.startCycle("测试问题");
    const result = practiceCognition.rationalPhase("这是我的假说");

    expect(result.phase).toBe("rational");
    expect(result.hypothesis).toBe("这是我的假说");
  });
});

describe("EmotionEngine", () => {
  it("应该能识别喜悦情绪", () => {
    const result = emotionEngine.analyzeEmotion("太好了！终于搞定了！");

    expect(result.primaryEmotion).toBe("joy");
  });

  it("应该能识别愤怒情绪", () => {
    const result = emotionEngine.analyzeEmotion("气死我了，这什么垃圾东西");

    expect(result.primaryEmotion).toBe("anger");
  });

  it("应该能识别焦虑情绪", () => {
    const result = emotionEngine.analyzeEmotion("担心明天交不了差");

    expect(result.primaryEmotion).toBe("fear");
  });

  it("应该能评估情绪强度", () => {
    const result = emotionEngine.analyzeEmotion("太棒了！！！");

    expect(result.intensity).toBe("strong");
  });
});

describe("OpinionFramework", () => {
  it("应该能识别可表态领域", () => {
    const domain = opinionFramework.analyzeDomain("技术选型");

    expect(domain).toBe("expressive");
  });

  it("应该能识别中立领域", () => {
    const domain = opinionFramework.analyzeDomain("健康医疗");

    expect(domain).toBe("neutral");
  });

  it("应该能检测骑墙话术", () => {
    const result = opinionFramework.detectFenceSitting(
      "这个问题各有优劣，取决于具体情况"
    );

    expect(result.detected).toBe(true);
    expect(result.patterns.length).toBeGreaterThan(0);
  });

  it("应该能生成观点表达", () => {
    const result = opinionFramework.generateOpinion(
      "React vs Vue",
      "positive",
      "React 生态更成熟"
    );

    expect(result.canExpress).toBe(true);
    expect(result.opinion).toContain("React");
  });
});

describe("DeAIFilter", () => {
  it("应该能过滤 AI 味连接词", () => {
    // 使用多个AI味词汇，确保超过限制
    const text = "此外，问题一。此外，问题二。此外，问题三。然而，但是。值得注意的是，重要。";
    const result = deAIFilter.filter(text);

    // 检查是否有修改（"此外"出现3次，超过限制1次）
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("应该能检测破折号", () => {
    const result = deAIFilter.filter(
      "这是一个问题——需要解决——很重要——第四个——第五个"
    );

    // 破折号超过2个会被替换
    expect(result.changes.some((c) => c.rule === "破折号")).toBe(true);
  });

  it("应该能计算人味分数", () => {
    const result = deAIFilter.filter(
      "我觉得这个方案不错，因为简单实用。"
    );

    expect(result.score).toBeGreaterThan(50);
  });

  it("应该能快速检测", () => {
    const result = deAIFilter.quickCheck(
      "此外，总而言之，综上所述，这个问题很重要。"
    );

    expect(result.hasAIsmell).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
