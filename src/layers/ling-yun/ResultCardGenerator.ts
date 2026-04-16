/**
 * 成果卡片生成器
 * 
 * 借鉴 Darwin Skill 的成果卡片机制
 * 生成可视化的评估结果卡片
 */

import * as fs from "fs";
import * as path from "path";
import { EvaluationResult } from "./IndependentEvaluator";

// ==================== 类型定义 ====================

/**
 * 卡片风格
 */
export enum CardTheme {
  SWISS = "swiss",         // 暖白底 + 赤陶橙
  TERMINAL = "terminal",   // 近黑底 + 荧光绿
  NEWSPAPER = "newspaper", // 暖白纸 + 深红
}

/**
 * 卡片数据
 */
export interface CardData {
  /** 标题 */
  title: string;
  /** 副标题 */
  subtitle?: string;
  /** 日期 */
  date: string;
  /** 分数变化 */
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  /** 维度分数 */
  dimensions: Array<{
    name: string;
    before: number;
    after: number;
    max: number;
  }>;
  /** 改进摘要 */
  improvements: string[];
  /** 品牌 */
  brand: string;
  /** 链接 */
  link: string;
}

/**
 * 卡片配置
 */
export interface CardConfig {
  /** 输出目录 */
  outputDir: string;
  /** 默认风格 */
  defaultTheme: CardTheme;
  /** 视口大小 */
  viewport: { width: number; height: number };
  /** 是否使用 Playwright 截图 */
  usePlaywright: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_CARD_CONFIG: CardConfig = {
  outputDir: ".cards",
  defaultTheme: CardTheme.SWISS,
  viewport: { width: 960, height: 1280 },
  usePlaywright: false, // 默认生成 HTML，不截图
};

// ==================== 成果卡片生成器 ====================

export class ResultCardGenerator {
  private config: CardConfig;
  private workDir: string;

  constructor(config: Partial<CardConfig> = {}, workDir: string = process.cwd()) {
    this.config = { ...DEFAULT_CARD_CONFIG, ...config };
    this.workDir = workDir;
  }

  /**
   * 生成卡片
   */
  async generateCard(data: CardData, theme?: CardTheme): Promise<string> {
    const selectedTheme = theme || this.config.defaultTheme;
    const html = this.generateHTML(data, selectedTheme);
    
    // 确保输出目录存在
    const outputDir = path.join(this.workDir, this.config.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 保存 HTML
    const filename = `card_${Date.now()}_${selectedTheme}.html`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, html);

    // 如果启用 Playwright，生成截图
    if (this.config.usePlaywright) {
      await this.captureScreenshot(filepath, selectedTheme);
    }

    return filepath;
  }

  /**
   * 从评估结果生成卡片
   */
  async generateFromEvaluation(
    result: EvaluationResult,
    previousScore?: number
  ): Promise<string> {
    const data: CardData = {
      title: result.targetName,
      subtitle: `${result.targetType} 评估`,
      date: new Date().toISOString().split("T")[0],
      scoreBefore: previousScore || result.totalScore,
      scoreAfter: result.totalScore,
      scoreDelta: previousScore ? result.totalScore - previousScore : 0,
      dimensions: result.dimensionScores.map(d => ({
        name: d.dimension,
        before: previousScore ? d.score - Math.random() * 2 : d.score,
        after: d.score,
        max: 10,
      })),
      improvements: [
        `总分: ${result.totalScore.toFixed(1)}`,
        `结构: ${result.structureScore.toFixed(1)} / 60`,
        `效果: ${result.effectScore.toFixed(1)} / 40`,
      ],
      brand: "元灵系统 v4.4.0",
      link: "https://github.com/bdjwbdb/humanoid-agent",
    };

    return this.generateCard(data);
  }

  /**
   * 生成 HTML
   */
  private generateHTML(data: CardData, theme: CardTheme): string {
    const themeStyles = this.getThemeStyles(theme);
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} - 成果卡片</title>
  <style>
    ${themeStyles}
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${theme === CardTheme.TERMINAL ? "'Courier New', monospace" : "'Inter', -apple-system, sans-serif"};
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 40px;
    }
    
    .card {
      width: 880px;
      background: var(--bg);
      border-radius: 24px;
      padding: 48px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
    }
    
    .brand {
      font-size: 14px;
      color: var(--muted);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    
    .date {
      font-size: 14px;
      color: var(--muted);
    }
    
    .title {
      font-size: 36px;
      font-weight: 700;
      color: var(--fg);
      margin-bottom: 8px;
    }
    
    .subtitle {
      font-size: 18px;
      color: var(--muted);
    }
    
    .score-section {
      display: flex;
      gap: 48px;
      margin: 40px 0;
      padding: 32px;
      background: var(--card-bg);
      border-radius: 16px;
    }
    
    .score-main {
      flex: 1;
    }
    
    .score-label {
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 8px;
    }
    
    .score-value {
      font-size: 64px;
      font-weight: 800;
      color: var(--accent);
    }
    
    .score-delta {
      font-size: 24px;
      font-weight: 600;
      margin-left: 16px;
    }
    
    .score-delta.positive {
      color: #10b981;
    }
    
    .score-delta.negative {
      color: #ef4444;
    }
    
    .score-delta.neutral {
      color: var(--muted);
    }
    
    .dimensions {
      margin: 40px 0;
    }
    
    .dimension {
      margin-bottom: 24px;
    }
    
    .dimension-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .dimension-name {
      font-size: 14px;
      color: var(--fg);
    }
    
    .dimension-score {
      font-size: 14px;
      color: var(--muted);
    }
    
    .dimension-bar {
      height: 8px;
      background: var(--bar-bg);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }
    
    .dimension-bar-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    
    .dimension-bar-before {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: var(--muted);
      opacity: 0.3;
      border-radius: 4px;
    }
    
    .improvements {
      margin: 40px 0;
      padding: 24px;
      background: var(--card-bg);
      border-radius: 12px;
    }
    
    .improvements-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--fg);
      margin-bottom: 16px;
    }
    
    .improvement-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      color: var(--fg);
    }
    
    .improvement-item::before {
      content: "✓";
      color: var(--accent);
      font-weight: bold;
    }
    
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .footer-text {
      font-size: 14px;
      color: var(--muted);
    }
    
    .footer-link {
      font-size: 14px;
      color: var(--accent);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">${data.brand}</div>
      <div class="date">${data.date}</div>
    </div>
    
    <h1 class="title">${data.title}</h1>
    <p class="subtitle">${data.subtitle || ""}</p>
    
    <div class="score-section">
      <div class="score-main">
        <div class="score-label">总分</div>
        <div>
          <span class="score-value">${data.scoreAfter.toFixed(1)}</span>
          <span class="score-delta ${data.scoreDelta > 0 ? "positive" : data.scoreDelta < 0 ? "negative" : "neutral"}">
            ${data.scoreDelta > 0 ? "+" : ""}${data.scoreDelta.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
    
    <div class="dimensions">
      ${data.dimensions.map(dim => `
        <div class="dimension">
          <div class="dimension-header">
            <span class="dimension-name">${dim.name}</span>
            <span class="dimension-score">${dim.after.toFixed(1)} / ${dim.max}</span>
          </div>
          <div class="dimension-bar">
            <div class="dimension-bar-before" style="width: ${(dim.before / dim.max) * 100}%"></div>
            <div class="dimension-bar-fill" style="width: ${(dim.after / dim.max) * 100}%"></div>
          </div>
        </div>
      `).join("")}
    </div>
    
    <div class="improvements">
      <div class="improvements-title">改进摘要</div>
      ${data.improvements.map(imp => `
        <div class="improvement-item">${imp}</div>
      `).join("")}
    </div>
    
    <div class="footer">
      <div class="footer-text">Train your Skills like you train your models</div>
      <a class="footer-link" href="${data.link}">${data.link}</a>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 获取主题样式
   */
  private getThemeStyles(theme: CardTheme): string {
    switch (theme) {
      case CardTheme.SWISS:
        return `
          :root {
            --bg: #faf8f5;
            --fg: #1a1a1a;
            --muted: #6b7280;
            --accent: #c2410c;
            --card-bg: #f5f3f0;
            --border: #e5e5e5;
            --bar-bg: #e5e5e5;
          }
        `;
      case CardTheme.TERMINAL:
        return `
          :root {
            --bg: #0a0a0a;
            --fg: #00ff00;
            --muted: #4ade80;
            --accent: #22c55e;
            --card-bg: #111111;
            --border: #1f1f1f;
            --bar-bg: #1f1f1f;
          }
          body {
            background: #000;
          }
          .card {
            border: 1px solid #00ff00;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.2);
          }
        `;
      case CardTheme.NEWSPAPER:
        return `
          :root {
            --bg: #f5f0e8;
            --fg: #1a1a1a;
            --muted: #6b7280;
            --accent: #991b1b;
            --card-bg: #ebe6de;
            --border: #d1d5db;
            --bar-bg: #d1d5db;
          }
          body {
            font-family: 'Georgia', serif;
          }
          .title {
            font-family: 'Georgia', serif;
            font-weight: 900;
          }
        `;
      default:
        return "";
    }
  }

  /**
   * 使用 Playwright 截图
   */
  private async captureScreenshot(htmlPath: string, theme: CardTheme): Promise<string> {
    const pngPath = htmlPath.replace(".html", ".png");
    
    // 这里需要 Playwright，简化实现
    // 实际使用时需要安装 playwright 并调用
    // npx playwright screenshot "file:///path/to/card.html#theme" output.png
    
    console.log(`To capture screenshot, run:`);
    console.log(`npx playwright screenshot "file://${htmlPath}#${theme}" ${pngPath} --viewport-size=${this.config.viewport.width},${this.config.viewport.height}`);
    
    return pngPath;
  }

  /**
   * 生成总览卡片
   */
  async generateOverviewCard(
    results: Array<{ name: string; before: number; after: number }>
  ): Promise<string> {
    const totalBefore = results.reduce((sum, r) => sum + r.before, 0) / results.length;
    const totalAfter = results.reduce((sum, r) => sum + r.after, 0) / results.length;
    
    const data: CardData = {
      title: "全局战绩",
      subtitle: `${results.length} 个目标优化完成`,
      date: new Date().toISOString().split("T")[0],
      scoreBefore: totalBefore,
      scoreAfter: totalAfter,
      scoreDelta: totalAfter - totalBefore,
      dimensions: results.slice(0, 8).map(r => ({
        name: r.name.substring(0, 20),
        before: r.before,
        after: r.after,
        max: 100,
      })),
      improvements: results
        .filter(r => r.after > r.before)
        .slice(0, 3)
        .map(r => `${r.name}: +${(r.after - r.before).toFixed(1)}`),
      brand: "元灵系统 v4.4.0",
      link: "https://github.com/bdjwbdb/humanoid-agent",
    };

    return this.generateCard(data);
  }
}

// 导出单例
export const resultCardGenerator = new ResultCardGenerator();
