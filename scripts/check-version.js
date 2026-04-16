#!/usr/bin/env node
/**
 * 版本一致性检查脚本
 * 
 * 检查以下位置的版本号是否一致：
 * - package.json
 * - src/yuanling-system.ts (VERSION 常量)
 * - src/index.ts (注释)
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 读取 package.json 版本
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const packageVersion = packageJson.version;

// 读取 yuanling-system.ts 版本
const yuanlingSystem = fs.readFileSync(path.join(rootDir, 'src', 'yuanling-system.ts'), 'utf-8');
const versionMatch = yuanlingSystem.match(/export const VERSION = '([^']+)'/);
const codeVersion = versionMatch ? versionMatch[1] : null;

// 读取 index.ts 注释版本
const indexTs = fs.readFileSync(path.join(rootDir, 'src', 'index.ts'), 'utf-8');
const commentMatch = indexTs.match(/元灵系统 v([\d.]+)/);
const commentVersion = commentMatch ? commentMatch[1] : null;

console.log('========================================');
console.log('版本一致性检查');
console.log('========================================\n');

console.log(`package.json 版本: ${packageVersion}`);
console.log(`代码 VERSION 常量: ${codeVersion}`);
console.log(`index.ts 注释版本: ${commentVersion}`);

const versions = [packageVersion, codeVersion, commentVersion].filter(Boolean);
const uniqueVersions = [...new Set(versions)];

if (uniqueVersions.length === 1) {
  console.log('\n✅ 所有版本号一致: ' + uniqueVersions[0]);
  process.exit(0);
} else {
  console.log('\n❌ 版本号不一致!');
  console.log('   发现的版本: ' + uniqueVersions.join(', '));
  console.log('\n请运行以下命令更新版本:');
  console.log('  npm version patch  # 或 minor, major');
  process.exit(1);
}
