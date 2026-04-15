/**
 * Skills 自动发现引擎
 *
 * 自动扫描已安装的 skills，建立能力索引
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Skill 信息
 */
export interface SkillInfo {
  name: string;
  path: string;
  description: string;
  triggers: string[];
  lastUpdated: number;
}

/**
 * Skills 自动发现引擎
 */
export class SkillsDiscoveryEngine {
  private skillsDir: string;
  private skillsIndex: Map<string, SkillInfo> = new Map();
  private lastScanTime: number = 0;
  private scanInterval: number = 60 * 60 * 1000; // 1小时

  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir || path.join(process.env.HOME || "", ".openclaw/workspace/skills");
  }

  /**
   * 扫描 skills 目录
   */
  scan(): SkillInfo[] {
    const now = Date.now();

    // 如果距离上次扫描不到1小时，返回缓存
    if (now - this.lastScanTime < this.scanInterval && this.skillsIndex.size > 0) {
      return Array.from(this.skillsIndex.values());
    }

    this.skillsIndex.clear();

    try {
      const dirs = fs.readdirSync(this.skillsDir);

      for (const dir of dirs) {
        const skillPath = path.join(this.skillsDir, dir);
        const skillMdPath = path.join(skillPath, "SKILL.md");

        if (fs.statSync(skillPath).isDirectory() && fs.existsSync(skillMdPath)) {
          const info = this.parseSkillMd(skillMdPath, dir);
          if (info) {
            this.skillsIndex.set(dir, info);
          }
        }
      }

      this.lastScanTime = now;
    } catch (error) {
      console.error("[SkillsDiscovery] 扫描失败:", error);
    }

    return Array.from(this.skillsIndex.values());
  }

  /**
   * 解析 SKILL.md 文件
   */
  private parseSkillMd(filePath: string, dirName: string): SkillInfo | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stat = fs.statSync(filePath);

      // 提取描述
      let description = "";
      const descMatch = content.match(/^description:\s*[\s\S]*?(?:\n---|\n\n)/m);
      if (descMatch) {
        description = descMatch[0]
          .replace(/^description:\s*/, "")
          .replace(/\n---/, "")
          .trim()
          .substring(0, 200);
      }

      // 提取触发词
      const triggers: string[] = [];
      const triggerPatterns = [
        /触发[词条件]*[：:]\s*([^\n]+)/g,
        /触发关键词[：:]\s*([^\n]+)/g,
        /关键词[：:]\s*([^\n]+)/g,
        /Use when[：:]\s*([^\n]+)/gi,
      ];

      for (const pattern of triggerPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const words = match[1].split(/[,，、]/).map((w) => w.trim());
          triggers.push(...words.filter((w) => w.length > 0 && w.length < 20));
        }
      }

      return {
        name: dirName,
        path: filePath,
        description: description || `Skill: ${dirName}`,
        triggers: [...new Set(triggers)].slice(0, 10),
        lastUpdated: stat.mtimeMs,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 搜索匹配的 skills
   */
  search(query: string): SkillInfo[] {
    // 确保已扫描
    if (this.skillsIndex.size === 0) {
      this.scan();
    }

    const lower = query.toLowerCase();
    const results: Array<{ skill: SkillInfo; score: number }> = [];

    for (const skill of this.skillsIndex.values()) {
      let score = 0;

      // 名称匹配
      if (skill.name.toLowerCase().includes(lower)) {
        score += 10;
      }

      // 描述匹配
      if (skill.description.toLowerCase().includes(lower)) {
        score += 5;
      }

      // 触发词匹配
      for (const trigger of skill.triggers) {
        if (lower.includes(trigger.toLowerCase()) || trigger.toLowerCase().includes(lower)) {
          score += 3;
        }
      }

      if (score > 0) {
        results.push({ skill, score });
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, 10).map((r) => r.skill);
  }

  /**
   * 获取 skill 详情
   */
  getSkill(name: string): SkillInfo | undefined {
    if (this.skillsIndex.size === 0) {
      this.scan();
    }
    return this.skillsIndex.get(name);
  }

  /**
   * 列出所有 skills
   */
  listAll(): SkillInfo[] {
    if (this.skillsIndex.size === 0) {
      this.scan();
    }
    return Array.from(this.skillsIndex.values());
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalSkills: number;
    lastScanTime: string;
    topTriggerWords: string[];
  } {
    if (this.skillsIndex.size === 0) {
      this.scan();
    }

    // 统计触发词频率
    const triggerCounts: Record<string, number> = {};
    for (const skill of this.skillsIndex.values()) {
      for (const trigger of skill.triggers) {
        triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
      }
    }

    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return {
      totalSkills: this.skillsIndex.size,
      lastScanTime: new Date(this.lastScanTime).toLocaleString("zh-CN"),
      topTriggerWords: topTriggers,
    };
  }

  /**
   * 强制重新扫描
   */
  forceRescan(): SkillInfo[] {
    this.lastScanTime = 0;
    return this.scan();
  }
}

// 导出单例
export const skillsDiscoveryEngine = new SkillsDiscoveryEngine();
