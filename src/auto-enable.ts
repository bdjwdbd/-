/**
 * 自动启用模块
 * 
 * 在 Heartbeat 时自动运行自省
 * 使用简化版：每次有变动时用表格形式告诉用户
 */

import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { SimpleIntrospection } from './introspection/simple-tracker';

export interface AutoEnableState {
  lastRun: number;
  lastScore: number;
  hasChanges: boolean;
  runCount: number;
}

export interface AutoEnableConfig {
  workspaceRoot: string;
  minIntervalMs: number;
}

const DEFAULT_CONFIG: AutoEnableConfig = {
  workspaceRoot: process.env.WORKSPACE_ROOT || '/home/sandbox/.openclaw/workspace',
  minIntervalMs: 30 * 60 * 1000, // 30 分钟
};

/**
 * 自动启用主函数
 */
export async function autoEnable(
  config: Partial<AutoEnableConfig> = {}
): Promise<{
  shouldReport: boolean;
  report?: string;
  state: AutoEnableState;
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const stateFile = join(cfg.workspaceRoot, 'memory/introspection/auto-enable-state.json');
  
  // 确保目录存在
  const stateDir = join(cfg.workspaceRoot, 'memory/introspection');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  
  // 读取状态
  const state = readState(stateFile);
  const now = Date.now();
  
  // 创建简化版自省系统
  const system = new SimpleIntrospection(cfg.workspaceRoot);
  
  // 检查是否有变更
  const hasChanges = system.hasChanges();
  
  // 判断是否需要运行
  const timeSinceLastRun = now - (state.lastRun || 0);
  const shouldRun = hasChanges || !state.lastRun || timeSinceLastRun > cfg.minIntervalMs;
  
  if (!shouldRun) {
    return { shouldReport: false, state };
  }
  
  console.log('[AutoEnable] 检测到变更，运行自省...');
  
  // 运行自省
  const report = await system.introspect();
  
  // 更新状态
  const newState: AutoEnableState = {
    lastRun: now,
    lastScore: report?.overallAfter || state.lastScore,
    hasChanges: hasChanges,
    runCount: (state.runCount || 0) + 1,
  };
  
  writeState(stateFile, newState);
  
  if (report) {
    return {
      shouldReport: true,
      report: system.formatTable(report),
      state: newState,
    };
  }
  
  return { shouldReport: false, state: newState };
}

/**
 * 快速检查
 */
export async function quickCheck(
  workspaceRoot: string = DEFAULT_CONFIG.workspaceRoot
): Promise<{ hasChanges: boolean }> {
  const system = new SimpleIntrospection(workspaceRoot);
  return { hasChanges: system.hasChanges() };
}

/**
 * 获取状态
 */
export function getState(
  workspaceRoot: string = DEFAULT_CONFIG.workspaceRoot
): AutoEnableState {
  const stateFile = join(workspaceRoot, 'memory/introspection/auto-enable-state.json');
  return readState(stateFile);
}

/**
 * 重置状态
 */
export function resetState(
  workspaceRoot: string = DEFAULT_CONFIG.workspaceRoot
): void {
  const stateFile = join(workspaceRoot, 'memory/introspection/auto-enable-state.json');
  writeState(stateFile, { lastRun: 0, lastScore: 0, hasChanges: false, runCount: 0 });
}

// ============ 内部函数 ============

function readState(file: string): AutoEnableState {
  try {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, 'utf-8'));
    }
  } catch {}
  return { lastRun: 0, lastScore: 0, hasChanges: false, runCount: 0 };
}

function writeState(file: string, state: AutoEnableState): void {
  try {
    writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
  } catch {}
}
