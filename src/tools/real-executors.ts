/**
 * 真实工具执行器
 * 
 * 实现文件读写、命令执行等真实操作
 */

import { exec as execCommand } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(execCommand);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const accessAsync = promisify(fs.access);
const mkdirAsync = promisify(fs.mkdir);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);

// ============================================================================
// 类型定义
// ============================================================================

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
}

export type ToolExecutorFn = (args: Record<string, any>) => Promise<ToolResult>;

// ============================================================================
// 文件操作工具
// ============================================================================

/**
 * 读取文件
 */
export const readTool: ToolExecutorFn = async (args) => {
  try {
    const { path: filePath, offset = 0, limit } = args;
    
    // 检查文件是否存在
    await accessAsync(filePath, fs.constants.R_OK);
    
    // 读取文件
    const content = await readFileAsync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // 应用 offset 和 limit
    const startLine = Math.max(0, offset);
    const endLine = limit ? startLine + limit : lines.length;
    const selectedLines = lines.slice(startLine, endLine);
    
    return {
      success: true,
      output: selectedLines.join('\n'),
      data: {
        totalLines: lines.length,
        returnedLines: selectedLines.length,
        path: filePath
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * 写入文件
 */
export const writeTool: ToolExecutorFn = async (args) => {
  try {
    const { path: filePath, content } = args;
    
    // 确保目录存在
    const dir = path.dirname(filePath);
    await mkdirAsync(dir, { recursive: true });
    
    // 写入文件
    await writeFileAsync(filePath, content, 'utf-8');
    
    return {
      success: true,
      output: `文件已写入: ${filePath}`,
      data: {
        path: filePath,
        size: content.length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * 编辑文件
 */
export const editTool: ToolExecutorFn = async (args) => {
  try {
    const { path: filePath, oldText, newText } = args;
    
    // 读取文件
    const content = await readFileAsync(filePath, 'utf-8');
    
    // 检查 oldText 是否存在
    if (!content.includes(oldText)) {
      return {
        success: false,
        error: `未找到要替换的文本: "${oldText.substring(0, 50)}..."`
      };
    }
    
    // 替换文本
    const newContent = content.replace(oldText, newText);
    
    // 写入文件
    await writeFileAsync(filePath, newContent, 'utf-8');
    
    return {
      success: true,
      output: `文件已编辑: ${filePath}`,
      data: {
        path: filePath,
        replaced: true
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * 列出目录
 */
export const listTool: ToolExecutorFn = async (args) => {
  try {
    const { path: dirPath } = args;
    
    // 读取目录
    const entries = await readdirAsync(dirPath, { withFileTypes: true });
    
    // 格式化输出
    const items = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      isDirectory: entry.isDirectory()
    }));
    
    const output = items
      .map(item => `${item.isDirectory ? '📁' : '📄'} ${item.name}`)
      .join('\n');
    
    return {
      success: true,
      output: output || '(空目录)',
      data: {
        path: dirPath,
        items
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * 删除文件
 */
export const deleteTool: ToolExecutorFn = async (args) => {
  try {
    const { path: filePath } = args;
    
    // 检查文件是否存在
    await accessAsync(filePath, fs.constants.W_OK);
    
    // 删除文件
    await unlinkAsync(filePath);
    
    return {
      success: true,
      output: `文件已删除: ${filePath}`,
      data: {
        path: filePath
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// ============================================================================
// 命令执行工具
// ============================================================================

/**
 * 执行 Bash 命令
 */
export const bashTool: ToolExecutorFn = async (args) => {
  try {
    const { command, cwd, timeout = 30000 } = args;
    
    // 执行命令
    const { stdout, stderr } = await execAsync(command, {
      cwd: cwd || process.cwd(),
      timeout,
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });
    
    const output = stdout || stderr || '(无输出)';
    
    return {
      success: true,
      output: output.substring(0, 10000), // 限制输出长度
      data: {
        command,
        stdout: stdout.substring(0, 5000),
        stderr: stderr.substring(0, 5000)
      }
    };
  } catch (error: any) {
    // 命令执行失败也返回输出
    const output = error.stdout || error.stderr || error.message;
    
    return {
      success: false,
      output: output.substring(0, 10000),
      error: error.message
    };
  }
};

/**
 * 执行 Python 代码
 */
export const pythonTool: ToolExecutorFn = async (args) => {
  try {
    const { code, timeout = 30000 } = args;
    
    // 使用 python3 执行代码
    const command = `python3 -c "${code.replace(/"/g, '\\"')}"`;
    const { stdout, stderr } = await execAsync(command, { timeout });
    
    return {
      success: true,
      output: stdout || stderr || '(无输出)',
      data: {
        language: 'python',
        code: code.substring(0, 500)
      }
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
      error: error.message
    };
  }
};

/**
 * 执行 Node.js 代码
 */
export const nodeTool: ToolExecutorFn = async (args) => {
  try {
    const { code, timeout = 30000 } = args;
    
    // 使用 node 执行代码
    const command = `node -e "${code.replace(/"/g, '\\"')}"`;
    const { stdout, stderr } = await execAsync(command, { timeout });
    
    return {
      success: true,
      output: stdout || stderr || '(无输出)',
      data: {
        language: 'node',
        code: code.substring(0, 500)
      }
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
      error: error.message
    };
  }
};

// ============================================================================
// 网络工具
// ============================================================================

/**
 * HTTP GET 请求
 */
export const httpGetTool: ToolExecutorFn = async (args) => {
  try {
    const { url, headers = {} } = args;
    
    // 使用 curl 发送请求
    const headerArgs = Object.entries(headers)
      .map(([k, v]) => `-H "${k}: ${v}"`)
      .join(' ');
    
    const command = `curl -s ${headerArgs} "${url}"`;
    const { stdout } = await execAsync(command, { timeout: 30000 });
    
    return {
      success: true,
      output: stdout.substring(0, 10000),
      data: {
        url,
        method: 'GET'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// ============================================================================
// Git 工具
// ============================================================================

/**
 * Git Status
 */
export const gitStatusTool: ToolExecutorFn = async (args) => {
  try {
    const { cwd = process.cwd() } = args;
    
    const { stdout } = await execAsync('git status', { cwd });
    
    return {
      success: true,
      output: stdout,
      data: {
        cwd
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Git Log
 */
export const gitLogTool: ToolExecutorFn = async (args) => {
  try {
    const { cwd = process.cwd(), limit = 10 } = args;
    
    const { stdout } = await execAsync(
      `git log --oneline -${limit}`,
      { cwd }
    );
    
    return {
      success: true,
      output: stdout,
      data: {
        cwd,
        limit
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// ============================================================================
// 工具注册表
// ============================================================================

export const realToolExecutors: Record<string, ToolExecutorFn> = {
  // 文件操作
  read: readTool,
  write: writeTool,
  edit: editTool,
  list: listTool,
  delete: deleteTool,
  
  // 命令执行
  bash: bashTool,
  python: pythonTool,
  node: nodeTool,
  
  // 网络请求
  http_get: httpGetTool,
  
  // Git 操作
  git_status: gitStatusTool,
  git_log: gitLogTool
};

/**
 * 获取工具执行器
 */
export function getToolExecutor(name: string): ToolExecutorFn | undefined {
  return realToolExecutors[name];
}

/**
 * 执行工具
 */
export async function executeTool(
  name: string, 
  args: Record<string, any>
): Promise<ToolResult> {
  const executor = getToolExecutor(name);
  
  if (!executor) {
    return {
      success: false,
      error: `未知工具: ${name}`
    };
  }
  
  return executor(args);
}

export default realToolExecutors;
