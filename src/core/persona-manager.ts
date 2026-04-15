/**
 * 用户画像管理器 - TypeScript 原生实现
 * 
 * 功能：
 * 1. 从记忆中提取用户偏好
 * 2. 自动更新用户画像
 * 3. LLM 辅助画像生成
 * 4. 画像版本管理
 */

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as https from "https";
import * as http from "http";

// ============================================================
// 类型定义
// ============================================================

export interface PersonaConfig {
  autoUpdate: boolean;
  updateInterval: number;
  minMemoriesForUpdate: number;
  maxPersonaLength: number;
  requireConfirmation: boolean;
  backupBeforeUpdate: boolean;
  llmAssisted: boolean;
  llm?: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

export interface PersonaUpdateResult {
  success: boolean;
  changes?: string[];
  newPersona?: string;
  error?: string;
}

export interface UserPersona {
  version: number;
  updatedAt: string;
  content: string;
  preferences: Record<string, unknown>;
  keywords: string[];
}

// ============================================================
// PersonaManager 类
// ============================================================

export class PersonaManager {
  private config: PersonaConfig;
  private personaPath: string;
  private backupDir: string;
  private persona: UserPersona | null = null;
  
  constructor(config: Partial<PersonaConfig> = {}) {
    const home = os.homedir();
    const workspace = path.join(home, ".openclaw/workspace");
    
    this.personaPath = path.join(workspace, "USER.md");
    this.backupDir = path.join(home, ".openclaw/memory-tdai/persona-backups");
    
    this.config = {
      autoUpdate: config.autoUpdate || false,
      updateInterval: config.updateInterval || 86400,
      minMemoriesForUpdate: config.minMemoriesForUpdate || 5,
      maxPersonaLength: config.maxPersonaLength || 2000,
      requireConfirmation: config.requireConfirmation !== false,
      backupBeforeUpdate: config.backupBeforeUpdate !== false,
      llmAssisted: config.llmAssisted || false,
      ...config,
    };
    
    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }
  
  // ============================================================
  // 加载画像
  // ============================================================
  
  loadPersona(): UserPersona | null {
    if (this.persona) return this.persona;
    
    if (!fs.existsSync(this.personaPath)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(this.personaPath, "utf-8");
      
      // 解析 USER.md 格式
      this.persona = {
        version: 1,
        updatedAt: new Date().toISOString(),
        content,
        preferences: this.extractPreferences(content),
        keywords: this.extractKeywords(content),
      };
      
      return this.persona;
    } catch (error) {
      console.error("[PersonaManager] 加载画像失败:", error);
      return null;
    }
  }
  
  private extractPreferences(content: string): Record<string, unknown> {
    const preferences: Record<string, unknown> = {};
    
    // 简单解析：提取键值对
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^[-*]\s*\*\*([^*]+)\*\*:\s*(.+)$/);
      if (match) {
        preferences[match[1].trim()] = match[2].trim();
      }
    }
    
    return preferences;
  }
  
  private extractKeywords(content: string): string[] {
    const keywords: string[] = [];
    
    // 提取关键词（简单实现）
    const keywordPatterns = [
      /偏好[：:]\s*([^\n]+)/g,
      /喜欢[：:]\s*([^\n]+)/g,
      /习惯[：:]\s*([^\n]+)/g,
    ];
    
    for (const pattern of keywordPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        keywords.push(...match[1].split(/[,，、]/).map((s) => s.trim()));
      }
    }
    
    return [...new Set(keywords)];
  }
  
  // ============================================================
  // 更新画像
  // ============================================================
  
  async updatePersona(memories: string[]): Promise<PersonaUpdateResult> {
    // 检查最小记忆数量
    if (memories.length < this.config.minMemoriesForUpdate) {
      return {
        success: false,
        error: `记忆数量不足（需要 ${this.config.minMemoriesForUpdate} 条，当前 ${memories.length} 条）`,
      };
    }
    
    // 备份
    if (this.config.backupBeforeUpdate) {
      this.backupPersona();
    }
    
    // 生成新画像
    let newContent: string;
    
    if (this.config.llmAssisted && this.config.llm) {
      newContent = await this.generatePersonaWithLLM(memories);
    } else {
      newContent = this.generatePersonaFromMemories(memories);
    }
    
    // 截断
    if (newContent.length > this.config.maxPersonaLength) {
      newContent = newContent.slice(0, this.config.maxPersonaLength) + "...";
    }
    
    // 写入
    try {
      fs.writeFileSync(this.personaPath, newContent, "utf-8");
      
      this.persona = {
        version: (this.persona?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        content: newContent,
        preferences: this.extractPreferences(newContent),
        keywords: this.extractKeywords(newContent),
      };
      
      return {
        success: true,
        changes: ["用户画像已更新"],
        newPersona: newContent,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  private backupPersona(): void {
    if (!fs.existsSync(this.personaPath)) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(this.backupDir, `USER-${timestamp}.md`);
    
    try {
      fs.copyFileSync(this.personaPath, backupPath);
      console.log("[PersonaManager] 备份已创建:", backupPath);
    } catch (error) {
      console.error("[PersonaManager] 备份失败:", error);
    }
  }
  
  private generatePersonaFromMemories(memories: string[]): string {
    // 简单实现：提取关键词和模式
    const keywordCounts: Map<string, number> = new Map();
    
    for (const memory of memories) {
      // 提取关键词（简单分词）
      const words = memory.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
      for (const word of words) {
        if (word.length >= 2) {
          keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
        }
      }
    }
    
    // 排序并取前 20 个
    const topKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
    
    // 生成画像
    const existingPersona = this.loadPersona();
    const existingContent = existingPersona?.content || "";
    
    return `# USER.md - About Your Human

## 1. 核心身份与基础环境
- **姓名 / 称呼：**
- **联系方式：**
- **所在地与时区：**
- **语言偏好：** 中文
- **爱好 / 喜好：** ${topKeywords.slice(0, 5).join("、")}

## 2. 技术栈与专业背景
- **技术与工具偏好：**
- **角色与行业领域：**

## 3. 生活方式与物理限制
- **健康与饮食：**
- **生活环境：**

## 4. 交互偏好与排版习惯
- **输出格式偏好：** 要点列表排版
- **沟通基调：** 直接给出答案

## 关键词
${topKeywords.join("、")}

## 更新时间
${new Date().toISOString()}

---
*此画像基于 ${memories.length} 条记忆自动生成*
`;
  }
  
  private async generatePersonaWithLLM(memories: string[]): Promise<string> {
    if (!this.config.llm) {
      return this.generatePersonaFromMemories(memories);
    }
    
    const prompt = `基于以下记忆内容，生成用户画像（USER.md 格式）：

${memories.slice(0, 20).join("\n")}

请提取用户的：
1. 偏好和习惯
2. 技术背景
3. 生活方式
4. 交互偏好

以 Markdown 格式输出。`;

    try {
      const response = await this.callLLM(prompt);
      return response || this.generatePersonaFromMemories(memories);
    } catch (error) {
      console.error("[PersonaManager] LLM 调用失败:", error);
      return this.generatePersonaFromMemories(memories);
    }
  }
  
  private async callLLM(prompt: string): Promise<string | null> {
    if (!this.config.llm) return null;
    
    const url = new URL("/v1/chat/completions", this.config.llm.baseUrl);
    
    const body = JSON.stringify({
      model: this.config.llm.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.5,
    });
    
    return new Promise((resolve, reject) => {
      const client = url.protocol === "https:" ? https : http;
      
      const req = client.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.config.llm!.apiKey}`,
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 30000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const result = JSON.parse(data);
              if (result.choices && result.choices[0]) {
                resolve(result.choices[0].message.content);
              } else {
                reject(new Error("Invalid response format"));
              }
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
      
      req.write(body);
      req.end();
    });
  }
  
  // ============================================================
  // 工具方法
  // ============================================================
  
  getPersona(): UserPersona | null {
    return this.persona || this.loadPersona();
  }
  
  getKeywords(): string[] {
    const persona = this.getPersona();
    return persona?.keywords || [];
  }
  
  getPreferences(): Record<string, unknown> {
    const persona = this.getPersona();
    return persona?.preferences || {};
  }
}

// ============================================================
// 导出
// ============================================================

export default PersonaManager;
