#!/usr/bin/env node
/**
 * 元灵系统 - 对话前处理
 * 
 * 每次对话时调用：
 * 1. L0 思考（每次都运行）
 * 2. 自省检查（仅当有变动时输出表格）
 * 
 * 用法：
 *   npx ts-node check-before-reply.ts "用户消息"
 */

// 简化版本 - 直接使用 L0 灵思层
import { ThinkingProtocolEngine } from './layers/ling-si';

async function main() {
  const message = process.argv[2] || '';
  
  const engine = new ThinkingProtocolEngine();
  const result = await engine.execute({
    id: `msg_${Date.now()}`,
    content: message,
    type: 'text',
    timestamp: Date.now(),
    sessionId: 'default',
  });
  
  // 输出 L0 结果
  console.log(`[L0] 深度=${result.depth}, 置信度=${(result.confidence || 0).toFixed(2)}`);
  
  // 返回 HEARTBEAT_OK
  console.log('HEARTBEAT_OK');
}

main().catch(console.error);
