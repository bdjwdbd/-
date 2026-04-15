import type { EntropyItem } from "../types";
import * as fs from "fs";
import * as path from "path";

/**
 * 熵治理系统
 * 对应：Harness 的熵概念
 */
export class EntropyGovernance {
  private entropyItems: EntropyItem[] = [];
  private storageDir: string;

  constructor(storageDir: string = "./entropy") {
    this.storageDir = storageDir;
    this.ensureDir(storageDir);
  }

  /**
   * 检测熵
   */
  async detect(): Promise<EntropyItem[]> {
    const items: EntropyItem[] = [];

    // 1. 检测代码熵：重复代码、复杂度
    const codeEntropy = await this.detectCodeEntropy();
    items.push(...codeEntropy);

    // 2. 检测知识熵：过期信息
    const knowledgeEntropy = await this.detectKnowledgeEntropy();
    items.push(...knowledgeEntropy);

    // 3. 检测流程熵：冗余步骤
    const processEntropy = await this.detectProcessEntropy();
    items.push(...processEntropy);

    this.entropyItems = items;
    return items;
  }

  /**
   * 清理熵
   */
  async cleanup(severity: "low" | "medium" | "high" = "high"): Promise<string[]> {
    const cleaned: string[] = [];

    for (const item of this.entropyItems) {
      if (this.shouldClean(item, severity)) {
        await this.cleanItem(item);
        cleaned.push(item.location);
      }
    }

    return cleaned;
  }

  /**
   * 预防熵
   */
  async prevent(): Promise<string[]> {
    const prevented: string[] = [];

    // 1. 代码熵预防：强制规范
    // 2. 知识熵预防：设置过期时间
    // 3. 流程熵预防：定期简化

    return prevented;
  }

  /**
   * 获取熵项
   */
  getItems(): EntropyItem[] {
    return this.entropyItems;
  }

  /**
   * 获取统计
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const item of this.entropyItems) {
      byType[item.type] = (byType[item.type] || 0) + 1;
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    }

    return {
      total: this.entropyItems.length,
      byType,
      bySeverity,
    };
  }

  /**
   * 检测代码熵
   */
  private async detectCodeEntropy(): Promise<EntropyItem[]> {
    const items: EntropyItem[] = [];
    
    try {
      // 检测大文件（超过 500 行）
      const srcDir = path.join(process.cwd(), "src");
      if (fs.existsSync(srcDir)) {
        const files = this.getAllFiles(srcDir, ".ts");
        
        for (const file of files) {
          const content = fs.readFileSync(file, "utf-8");
          const lines = content.split("\n").length;
          
          if (lines > 500) {
            items.push({
              type: "code",
              location: file,
              severity: lines > 1000 ? "high" : "medium",
              description: `文件过大: ${lines} 行`,
              detectedAt: new Date(),
            });
          }
          
          // 检测重复代码（简单实现）
          const duplicatePatterns = [
            /console\.log\(/g,
            /TODO/g,
            /FIXME/g,
          ];
          
          for (const pattern of duplicatePatterns) {
            const matches = content.match(pattern);
            if (matches && matches.length > 5) {
              items.push({
                type: "code",
                location: file,
                severity: "low",
                description: `重复模式: ${pattern} 出现 ${matches.length} 次`,
                detectedAt: new Date(),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("[EntropyGovernance] 代码熵检测失败:", error);
    }
    
    return items;
  }
  
  private getAllFiles(dir: string, ext: string): string[] {
    const files: string[] = [];
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.getAllFiles(fullPath, ext));
      } else if (entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * 检测知识熵
   */
  private async detectKnowledgeEntropy(): Promise<EntropyItem[]> {
    const items: EntropyItem[] = [];
    const memoryDir = path.join(process.cwd(), "memory");

    if (fs.existsSync(memoryDir)) {
      const files = fs.readdirSync(memoryDir);
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(memoryDir, file);
        const stat = fs.statSync(filePath);
        
        if (now - stat.mtimeMs > sevenDays) {
          items.push({
            type: "knowledge",
            location: filePath,
            severity: "low",
            description: `文件超过 7 天未更新`,
            detectedAt: new Date(),
          });
        }
      }
    }

    return items;
  }

  /**
   * 检测流程熵
   */
  private async detectProcessEntropy(): Promise<EntropyItem[]> {
    const items: EntropyItem[] = [];
    
    try {
      // 检测 package.json 中的未使用依赖
      const packagePath = path.join(process.cwd(), "package.json");
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // 检查 node_modules 是否存在
        const nodeModulesPath = path.join(process.cwd(), "node_modules");
        if (!fs.existsSync(nodeModulesPath)) {
          items.push({
            type: "process",
            location: packagePath,
            severity: "medium",
            description: "node_modules 不存在，需要运行 npm install",
            detectedAt: new Date(),
          });
        }
        
        // 检查依赖数量
        const depCount = Object.keys(deps).length;
        if (depCount > 50) {
          items.push({
            type: "process",
            location: packagePath,
            severity: "low",
            description: `依赖数量较多: ${depCount} 个`,
            detectedAt: new Date(),
          });
        }
      }
      
      // 检测配置文件
      const configFiles = ["tsconfig.json", ".eslintrc.json", ".prettierrc"];
      for (const configFile of configFiles) {
        const configPath = path.join(process.cwd(), configFile);
        if (!fs.existsSync(configPath)) {
          items.push({
            type: "process",
            location: configFile,
            severity: "low",
            description: `配置文件缺失: ${configFile}`,
            detectedAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error("[EntropyGovernance] 流程熵检测失败:", error);
    }
    
    return items;
  }

  /**
   * 判断是否需要清理
   */
  private shouldClean(item: EntropyItem, minSeverity: string): boolean {
    const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3 };
    return severityOrder[item.severity] >= severityOrder[minSeverity];
  }

  /**
   * 清理熵项
   */
  private async cleanItem(item: EntropyItem): Promise<void> {
    if (item.type === "knowledge" && fs.existsSync(item.location)) {
      // 备份后删除
      const backupDir = path.join(this.storageDir, "backup");
      this.ensureDir(backupDir);
      const backupPath = path.join(backupDir, path.basename(item.location));
      fs.copyFileSync(item.location, backupPath);
      fs.unlinkSync(item.location);
      // console.log(`[EntropyGovernance] 已清理: ${item.location}`);
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
