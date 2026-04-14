/**
 * 可视化面板
 * 
 * 生成趋势图表、雷达图、历史记录可视化
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  CapabilityDimension,
  DimensionScore,
  SystemSnapshot,
  TrendData,
  DIMENSION_CONFIGS,
} from './types';

export interface VisualizationConfig {
  outputPath: string;
  theme: 'light' | 'dark';
}

export class VisualizationPanel {
  private config: VisualizationConfig;

  constructor(config: Partial<VisualizationConfig> = {}) {
    this.config = {
      outputPath: config.outputPath || 'memory/introspection/visualization',
      theme: config.theme || 'light',
    };
    
    mkdirSync(this.config.outputPath, { recursive: true });
  }

  /**
   * 生成完整的可视化报告
   */
  generateFullReport(
    currentSnapshot: SystemSnapshot,
    historyDir: string
  ): string {
    const html = this.generateHTMLReport(currentSnapshot, historyDir);
    const filename = `visualization-${new Date().toISOString().split('T')[0]}.html`;
    const filepath = join(this.config.outputPath, filename);
    
    writeFileSync(filepath, html, 'utf-8');
    
    return filepath;
  }

  /**
   * 生成 HTML 报告
   */
  private generateHTMLReport(
    currentSnapshot: SystemSnapshot,
    historyDir: string
  ): string {
    const scores = currentSnapshot.scores;
    const trends = this.loadAllTrends(historyDir);
    
    const isDark = this.config.theme === 'dark';
    const bgColor = isDark ? '#1a1a2e' : '#ffffff';
    const textColor = isDark ? '#eaeaea' : '#333333';
    const cardBg = isDark ? '#16213e' : '#f8f9fa';
    const borderColor = isDark ? '#0f3460' : '#e0e0e0';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>元灵自省系统 - 可视化报告</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      color: ${textColor};
      padding: 20px;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 30px; font-size: 28px; }
    h2 { margin: 20px 0 15px; font-size: 20px; border-bottom: 2px solid ${borderColor}; padding-bottom: 10px; }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .card {
      background: ${cardBg};
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      border: 1px solid ${borderColor};
    }
    .card.score { grid-column: span 2; }
    .card-value { font-size: 36px; font-weight: bold; color: #4CAF50; }
    .card-label { font-size: 14px; opacity: 0.8; margin-top: 5px; }
    
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .chart-container {
      background: ${cardBg};
      border-radius: 10px;
      padding: 20px;
      border: 1px solid ${borderColor};
    }
    .chart-title { font-size: 16px; margin-bottom: 15px; font-weight: 600; }
    canvas { max-height: 300px; }
    
    .dimensions-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    .dimensions-table th, .dimensions-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid ${borderColor};
    }
    .dimensions-table th { background: ${cardBg}; font-weight: 600; }
    .progress-bar {
      width: 100%;
      height: 8px;
      background: ${isDark ? '#2d3748' : '#e0e0e0'};
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }
    .progress-excellent { background: linear-gradient(90deg, #4CAF50, #8BC34A); }
    .progress-good { background: linear-gradient(90deg, #8BC34A, #CDDC39); }
    .progress-warning { background: linear-gradient(90deg, #FF9800, #FFC107); }
    .progress-danger { background: linear-gradient(90deg, #f44336, #FF5722); }
    
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-excellent { background: #4CAF50; color: white; }
    .badge-good { background: #8BC34A; color: white; }
    .badge-warning { background: #FF9800; color: white; }
    .badge-danger { background: #f44336; color: white; }
    
    .trend-up { color: #4CAF50; }
    .trend-down { color: #f44336; }
    .trend-stable { color: #9E9E9E; }
    
    .footer {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      border-top: 1px solid ${borderColor};
      opacity: 0.7;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧠 元灵自省系统 - 可视化报告</h1>
    
    <!-- 摘要卡片 -->
    <div class="summary-cards">
      <div class="card score">
        <div class="card-value">${currentSnapshot.overallScore.toFixed(1)}</div>
        <div class="card-label">综合评分</div>
      </div>
      <div class="card">
        <div class="card-value">${scores.filter(s => s.score >= 80).length}</div>
        <div class="card-label">优秀维度</div>
      </div>
      <div class="card">
        <div class="card-value">${scores.filter(s => s.score < 60).length}</div>
        <div class="card-label">待优化维度</div>
      </div>
      <div class="card">
        <div class="card-value">${new Date(currentSnapshot.timestamp).toLocaleDateString('zh-CN')}</div>
        <div class="card-label">评估日期</div>
      </div>
    </div>
    
    <!-- 雷达图 -->
    <h2>📊 能力雷达图</h2>
    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">12 维度能力分布</div>
        <canvas id="radarChart"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title">维度评分对比</div>
        <canvas id="barChart"></canvas>
      </div>
    </div>
    
    <!-- 趋势图 -->
    <h2>📈 历史趋势</h2>
    <div class="charts-grid">
      <div class="chart-container" style="grid-column: 1 / -1;">
        <div class="chart-title">综合评分趋势</div>
        <canvas id="trendChart"></canvas>
      </div>
    </div>
    
    <!-- 维度详情表 -->
    <h2>📋 维度详情</h2>
    <table class="dimensions-table">
      <thead>
        <tr>
          <th>维度</th>
          <th>评分</th>
          <th>进度</th>
          <th>状态</th>
          <th>趋势</th>
          <th>详情</th>
        </tr>
      </thead>
      <tbody>
        ${this.generateTableRows(scores, trends)}
      </tbody>
    </table>
    
    <div class="footer">
      元灵自省系统 v1.0 | 生成时间: ${new Date().toLocaleString('zh-CN')}
    </div>
  </div>
  
  <script>
    ${this.generateChartScripts(scores, trends)}
  </script>
</body>
</html>`;
  }

  /**
   * 生成表格行
   */
  private generateTableRows(
    scores: DimensionScore[],
    trends: Map<CapabilityDimension, TrendData>
  ): string {
    const dimensionNames: Record<CapabilityDimension, string> = {
      response_speed: '响应速度',
      understanding_accuracy: '理解准确率',
      task_completion: '任务完成率',
      memory_recall: '记忆召回率',
      code_quality: '代码质量',
      error_recovery: '错误恢复率',
      security: '安全防护',
      resource_efficiency: '资源效率',
      extensibility: '可扩展性',
      maintainability: '可维护性',
      documentation: '文档完善度',
      test_coverage: '测试覆盖率',
    };

    return scores.map(score => {
      const name = dimensionNames[score.dimension];
      const progressClass = this.getProgressClass(score.score);
      const badgeClass = this.getBadgeClass(score.score);
      const statusText = this.getStatusText(score.score);
      
      const trend = trends.get(score.dimension);
      const trendIcon = trend?.trend === 'improving' ? '↑' : 
                        trend?.trend === 'declining' ? '↓' : '→';
      const trendClass = trend?.trend === 'improving' ? 'trend-up' : 
                         trend?.trend === 'declining' ? 'trend-down' : 'trend-stable';

      return `
        <tr>
          <td><strong>${name}</strong></td>
          <td>${score.score.toFixed(1)}%</td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill ${progressClass}" style="width: ${score.score}%"></div>
            </div>
          </td>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
          <td><span class="${trendClass}">${trendIcon} ${trend?.changeRate?.toFixed(1) || 0}%</span></td>
          <td style="font-size: 12px; opacity: 0.8;">${score.details}</td>
        </tr>`;
    }).join('');
  }

  /**
   * 生成图表脚本
   */
  private generateChartScripts(
    scores: DimensionScore[],
    trends: Map<CapabilityDimension, TrendData>
  ): string {
    const labels = scores.map(s => {
      const names: Record<CapabilityDimension, string> = {
        response_speed: '响应速度',
        understanding_accuracy: '理解准确率',
        task_completion: '任务完成率',
        memory_recall: '记忆召回率',
        code_quality: '代码质量',
        error_recovery: '错误恢复率',
        security: '安全防护',
        resource_efficiency: '资源效率',
        extensibility: '可扩展性',
        maintainability: '可维护性',
        documentation: '文档完善度',
        test_coverage: '测试覆盖率',
      };
      return names[s.dimension];
    });

    const data = scores.map(s => s.score);
    const colors = scores.map(s => {
      if (s.score >= 80) return 'rgba(76, 175, 80, 0.7)';
      if (s.score >= 60) return 'rgba(139, 195, 74, 0.7)';
      if (s.score >= 40) return 'rgba(255, 152, 0, 0.7)';
      return 'rgba(244, 67, 54, 0.7)';
    });

    // 趋势数据
    const trendLabels: string[] = [];
    const trendData: number[] = [];
    
    const firstTrend = Array.from(trends.values())[0];
    if (firstTrend) {
      firstTrend.data.forEach(d => {
        trendLabels.push(new Date(d.timestamp).toLocaleDateString('zh-CN'));
      });
      trendLabels.reverse();
    }

    return `
    // 雷达图
    new Chart(document.getElementById('radarChart'), {
      type: 'radar',
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: [{
          label: '当前评分',
          data: ${JSON.stringify(data)},
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          pointBackgroundColor: ${JSON.stringify(colors)}
        }]
      },
      options: {
        responsive: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 20 }
          }
        }
      }
    });

    // 柱状图
    new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: [{
          label: '评分',
          data: ${JSON.stringify(data)},
          backgroundColor: ${JSON.stringify(colors)},
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });

    // 趋势图
    new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(trendLabels)},
        datasets: [{
          label: '综合评分',
          data: ${JSON.stringify(trendData)},
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
    `;
  }

  /**
   * 加载所有趋势数据
   */
  private loadAllTrends(historyDir: string): Map<CapabilityDimension, TrendData> {
    const trends = new Map<CapabilityDimension, TrendData>();
    
    try {
      const files = readdirSync(historyDir)
        .filter(f => f.endsWith('.json'))
        .sort();

      if (files.length === 0) return trends;

      const dimensions: CapabilityDimension[] = [
        'response_speed', 'understanding_accuracy', 'task_completion',
        'memory_recall', 'code_quality', 'error_recovery',
        'security', 'resource_efficiency', 'extensibility',
        'maintainability', 'documentation', 'test_coverage'
      ];

      for (const dimension of dimensions) {
        const data: { timestamp: string; score: number }[] = [];

        for (const file of files) {
          const content = readFileSync(join(historyDir, file), 'utf-8');
          const snapshot = JSON.parse(content) as SystemSnapshot;
          const score = snapshot.scores.find(s => s.dimension === dimension);
          if (score) {
            data.push({ timestamp: snapshot.timestamp, score: score.score });
          }
        }

        if (data.length >= 2) {
          const firstScore = data[0].score;
          const lastScore = data[data.length - 1].score;
          const changeRate = ((lastScore - firstScore) / firstScore) * 100;

          let trend: 'improving' | 'declining' | 'stable';
          if (changeRate > 5) trend = 'improving';
          else if (changeRate < -5) trend = 'declining';
          else trend = 'stable';

          trends.set(dimension, { dimension, data, trend, changeRate });
        }
      }
    } catch {}

    return trends;
  }

  /**
   * 获取进度条样式类
   */
  private getProgressClass(score: number): string {
    if (score >= 80) return 'progress-excellent';
    if (score >= 60) return 'progress-good';
    if (score >= 40) return 'progress-warning';
    return 'progress-danger';
  }

  /**
   * 获取徽章样式类
   */
  private getBadgeClass(score: number): string {
    if (score >= 80) return 'badge-excellent';
    if (score >= 60) return 'badge-good';
    if (score >= 40) return 'badge-warning';
    return 'badge-danger';
  }

  /**
   * 获取状态文本
   */
  private getStatusText(score: number): string {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    if (score >= 40) return '待改进';
    return '需优化';
  }

  /**
   * 生成 ASCII 趋势图（用于控制台）
   */
  generateASCIITrend(data: { timestamp: string; score: number }[]): string {
    if (data.length === 0) return '无数据';

    const width = 50;
    const height = 10;
    const maxScore = 100;
    const minScore = 0;

    const lines: string[] = [];
    
    // 绘制 Y 轴
    for (let y = height; y >= 0; y--) {
      const scoreLabel = Math.round((y / height) * (maxScore - minScore) + minScore);
      let line = scoreLabel.toString().padStart(3) + ' |';
      
      for (let x = 0; x < width; x++) {
        const dataIndex = Math.floor((x / width) * data.length);
        const point = data[Math.min(dataIndex, data.length - 1)];
        const pointY = Math.round(((point.score - minScore) / (maxScore - minScore)) * height);
        
        if (Math.abs(pointY - y) <= 1) {
          line += '●';
        } else if (y === 0) {
          line += '─';
        } else {
          line += ' ';
        }
      }
      
      lines.push(line);
    }

    // X 轴标签
    lines.push('    +' + '─'.repeat(width));
    
    return lines.join('\n');
  }

  /**
   * 生成 ASCII 雷达图（用于控制台）
   */
  generateASCIIRadar(scores: DimensionScore[]): string {
    const lines: string[] = [];
    const maxRadius = 20;

    // 简化：只显示数值条形图
    lines.push('能力分布:');
    
    for (const score of scores) {
      const barLength = Math.round((score.score / 100) * maxRadius);
      const bar = '█'.repeat(barLength) + '░'.repeat(maxRadius - barLength);
      const names: Record<CapabilityDimension, string> = {
        response_speed: '响应速度',
        understanding_accuracy: '理解准确率',
        task_completion: '任务完成率',
        memory_recall: '记忆召回率',
        code_quality: '代码质量',
        error_recovery: '错误恢复率',
        security: '安全防护',
        resource_efficiency: '资源效率',
        extensibility: '可扩展性',
        maintainability: '可维护性',
        documentation: '文档完善度',
        test_coverage: '测试覆盖率',
      };
      lines.push(`${names[score.dimension].padEnd(8)} │${bar}│ ${score.score.toFixed(0)}%`);
    }

    return lines.join('\n');
  }
}
