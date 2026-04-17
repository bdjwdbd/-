/**
 * OpenClaw 执行器适配器
 * 
 * 将 OpenClaw 的工具能力适配给元灵系统桥接层
 */

import { exec as execCommand } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(execCommand);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

import { OpenClawExecutor } from '../bridge/openclaw-bridge';

/**
 * 创建 OpenClaw 执行器
 */
export function createOpenClawExecutor(): OpenClawExecutor {
  return {
    /**
     * 调用模型
     * 注意：这里返回一个结构化的响应，实际调用由 OpenClaw 框架处理
     */
    async callModel(messages: any[]): Promise<any> {
      // 这个方法在桥接模式下会被 OpenClaw 框架的实际调用替换
      // 这里返回一个模拟响应
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage?.content || '';

      return {
        content: `元灵系统已处理: ${content.substring(0, 100)}`,
        toolCalls: []
      };
    },

    /**
     * 执行工具
     */
    async execTool(name: string, args: any): Promise<any> {
      // 导入真实工具执行器
      const { executeTool } = await import('../tools/real-executors');
      return executeTool(name, args);
    },

    /**
     * 读取文件
     */
    async readFile(path: string): Promise<string> {
      try {
        return await readFileAsync(path, 'utf-8');
      } catch (error) {
        throw new Error(`读取文件失败: ${error}`);
      }
    },

    /**
     * 写入文件
     */
    async writeFile(path: string, content: string): Promise<void> {
      try {
        await writeFileAsync(path, content, 'utf-8');
      } catch (error) {
        throw new Error(`写入文件失败: ${error}`);
      }
    },

    /**
     * 执行命令
     */
    async execCommand(command: string): Promise<{ stdout: string; stderr: string }> {
      try {
        return await execAsync(command, {
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 10
        });
      } catch (error: any) {
        return {
          stdout: error.stdout || '',
          stderr: error.stderr || error.message
        };
      }
    }
  };
}

export default createOpenClawExecutor;
