/**
 * 去 AI 味过滤器
 * 
 * 基于 qiqing-liuyu skill 的 de-ai-patterns.md
 * 让输出更自然、更像人
 */

/**
 * 高优先级规则（零容忍）
 * 每篇文章限制次数
 */
const HIGH_PRIORITY_RULES = [
  {
    pattern: /——/g,
    name: "破折号",
    maxCount: 2,
    replacement: "，",
    reason: "AI 爱用破折号，人类很少用",
  },
  {
    pattern: /此外[，,。]/g,
    name: "此外",
    maxCount: 1,
    replacement: "而且，",
    reason: "典型的 AI 连接词",
  },
  {
    pattern: /然而[，,。]/g,
    name: "然而",
    maxCount: 1,
    replacement: "不过，",
    reason: "翻译腔",
  },
  {
    pattern: /值得注意的是[，,。]/g,
    name: "值得注意的是",
    maxCount: 1,
    replacement: "",
    reason: "几乎每次都是废话",
  },
  {
    pattern: /更重要的是[，,。]/g,
    name: "更重要的是",
    maxCount: 1,
    replacement: "关键是，",
    reason: "AI 爱用",
  },
  {
    pattern: /总而言之[，,。]/g,
    name: "总而言之",
    maxCount: 0,
    replacement: "",
    reason: "直接说结论",
  },
  {
    pattern: /综上所述[，,。]/g,
    name: "综上所述",
    maxCount: 0,
    replacement: "",
    reason: "直接说结论",
  },
  {
    pattern: /不可否认[，,。]/g,
    name: "不可否认",
    maxCount: 0,
    replacement: "",
    reason: "几乎每次都是废话",
  },
  {
    pattern: /毋庸置疑[，,。]/g,
    name: "毋庸置疑",
    maxCount: 0,
    replacement: "",
    reason: "几乎每次都是废话",
  },
  {
    pattern: /事实上[，,。]/g,
    name: "事实上",
    maxCount: 1,
    replacement: "其实，",
    reason: "翻译腔",
  },
  {
    pattern: /众所周知[，,。]/g,
    name: "众所周知",
    maxCount: 0,
    replacement: "",
    reason: "删掉或给具体来源",
  },
  {
    pattern: /显而易见[，,。]/g,
    name: "显而易见",
    maxCount: 0,
    replacement: "",
    reason: "如果真的显而易见，删掉",
  },
];

/**
 * 中优先级规则（控制使用）
 */
const MEDIUM_PRIORITY_RULES = [
  {
    pattern: /客观来说[，,。]/g,
    name: "客观来说",
    maxCount: 0,
    replacement: "",
    reason: "99% 的时候是废话",
  },
  {
    pattern: /客观地讲[，,。]/g,
    name: "客观地讲",
    maxCount: 0,
    replacement: "",
    reason: "同上",
  },
  {
    pattern: /从客观角度来看[，,。]/g,
    name: "从客观角度来看",
    maxCount: 0,
    replacement: "",
    reason: "同上",
  },
  {
    pattern: /理性来看[，,。]/g,
    name: "理性来看",
    maxCount: 0,
    replacement: "",
    reason: "同上",
  },
  {
    pattern: /让我们[，,。]/g,
    name: "让我们",
    maxCount: 0,
    replacement: "可以",
    reason: "AI 爱发号施令",
  },
  {
    pattern: /在这个.*的时代[，,。]/g,
    name: "在这个...的时代",
    maxCount: 0,
    replacement: "",
    reason: "空洞修辞",
  },
  {
    pattern: /随着.*的发展[，,。]/g,
    name: "随着...的发展",
    maxCount: 0,
    replacement: "",
    reason: "万能开头",
  },
  {
    pattern: /深刻地/g,
    name: "深刻地",
    maxCount: 0,
    replacement: "",
    reason: "夸大，用具体描述替代",
  },
  {
    pattern: /意义深远/g,
    name: "意义深远",
    maxCount: 0,
    replacement: "",
    reason: "同上",
  },
  {
    pattern: /不可或缺/g,
    name: "不可或缺",
    maxCount: 0,
    replacement: "很重要",
    reason: "同上",
  },
  {
    pattern: /至关重要/g,
    name: "至关重要",
    maxCount: 0,
    replacement: "关键",
    reason: "同上",
  },
];

/**
 * 骑墙话术（禁止）
 */
const FENCE_SITTING_PATTERNS = [
  {
    pattern: /各有优劣/g,
    name: "各有优劣",
    suggestion: "我更倾向 X，因为...",
  },
  {
    pattern: /从某种角度来说/g,
    name: "从某种角度来说",
    suggestion: "直接说你的看法",
  },
  {
    pattern: /这个问题很复杂/g,
    name: "这个问题很复杂",
    suggestion: "拆成具体的几点说",
  },
  {
    pattern: /取决于具体情况/g,
    name: "取决于具体情况",
    suggestion: "给出你最可能的判断 + 适用条件",
  },
  {
    pattern: /不能一概而论/g,
    name: "不能一概而论",
    suggestion: "说你的倾向，再补充例外",
  },
];

/**
 * 过滤结果
 */
export interface FilterResult {
  original: string;
  filtered: string;
  changes: Array<{
    rule: string;
    count: number;
    action: string;
  }>;
  warnings: string[];
  score: number; // 0-100，越高越像人
}

/**
 * 去 AI 味过滤器
 */
export class DeAIFilter {
  /**
   * 过滤文本
   */
  filter(text: string): FilterResult {
    let filtered = text;
    const changes: FilterResult["changes"] = [];
    const warnings: string[] = [];

    // 高优先级规则
    for (const rule of HIGH_PRIORITY_RULES) {
      const matches = text.match(rule.pattern);
      const count = matches ? matches.length : 0;

      if (count > rule.maxCount) {
        // 替换超出限制的部分
        let replaceCount = 0;
        filtered = filtered.replace(rule.pattern, (match) => {
          replaceCount++;
          if (replaceCount <= rule.maxCount) {
            return match; // 保留允许的数量
          }
          return rule.replacement;
        });

        changes.push({
          rule: rule.name,
          count: count - rule.maxCount,
          action: `替换 ${count - rule.maxCount} 处`,
        });
      }
    }

    // 中优先级规则
    for (const rule of MEDIUM_PRIORITY_RULES) {
      const matches = text.match(rule.pattern);
      const count = matches ? matches.length : 0;

      if (count > rule.maxCount) {
        filtered = filtered.replace(rule.pattern, rule.replacement);
        changes.push({
          rule: rule.name,
          count,
          action: `删除 ${count} 处`,
        });
      }
    }

    // 检测骑墙话术
    for (const pattern of FENCE_SITTING_PATTERNS) {
      if (pattern.pattern.test(text)) {
        warnings.push(`发现骑墙话术"${pattern.name}"，建议改为：${pattern.suggestion}`);
      }
    }

    // 计算分数
    const score = this.calculateScore(text, changes, warnings);

    return {
      original: text,
      filtered,
      changes,
      warnings,
      score,
    };
  }

  /**
   * 计算人味分数
   */
  private calculateScore(
    original: string,
    changes: FilterResult["changes"],
    warnings: string[]
  ): number {
    let score = 100;

    // 每次修改扣分
    for (const change of changes) {
      score -= change.count * 3;
    }

    // 每个警告扣分
    score -= warnings.length * 5;

    // 检查是否有第一人称
    if (!/我[觉得认为建议]/.test(original)) {
      score -= 10;
    }

    // 检查句子长度变化
    const sentences = original.split(/[。！？\n]/).filter((s) => s.trim());
    const lengths = sentences.map((s) => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - avgLength) ** 2, 0) / lengths.length;

    // 句子长度变化小（节奏单调）扣分
    if (variance < 100) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 快速检测
   */
  quickCheck(text: string): { hasAIsmell: boolean; issues: string[] } {
    const issues: string[] = [];

    // 破折号检测
    const dashCount = (text.match(/——/g) || []).length;
    if (dashCount > 2) {
      issues.push(`破折号 ${dashCount} 处（限 2 处）`);
    }

    // AI 连接词检测
    const aiWords = ["此外", "然而", "值得注意的是", "总而言之", "综上所述"];
    for (const word of aiWords) {
      if (text.includes(word)) {
        issues.push(`发现 "${word}"`);
      }
    }

    // 骑墙话术检测
    const fenceWords = ["各有优劣", "从某种角度来说", "取决于具体情况"];
    for (const word of fenceWords) {
      if (text.includes(word)) {
        issues.push(`骑墙话术 "${word}"`);
      }
    }

    return {
      hasAIsmell: issues.length > 0,
      issues,
    };
  }
}

// 导出单例
export const deAIFilter = new DeAIFilter();
