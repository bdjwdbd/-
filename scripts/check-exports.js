#!/usr/bin/env node
/**
 * 模块导出检查脚本
 * 
 * 检查所有 TypeScript 文件是否在对应的 index.ts 中导出
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// 需要检查的目录
const LAYER_DIRS = [
  'layers/ling-si',
  'layers/ling-shu',
  'layers/ling-mai',
  'layers/ling-qu',
  'layers/ling-dun',
  'layers/ling-yun',
  'layers/ling-shi',
  'infrastructure',
  'integration',
  'harness',
  'multi-agent',
  'dashboard',
];

// 忽略的文件
const IGNORE_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /__tests__/,
  /__demos__/,
  /index\.ts$/,
  /\.d\.ts$/,
  /types\.ts$/,
  /-types\.ts$/,
  /cli\.ts$/,
  /test\.ts$/,
  /performance-test\.ts$/,
];

// 检查目录
function checkDirectory(dirPath, indexFile) {
  const issues = [];
  
  if (!fs.existsSync(dirPath)) {
    return issues;
  }
  
  // 读取目录下所有文件
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  
  // 获取所有 .ts 文件
  const tsFiles = files
    .filter(f => f.isFile() && f.name.endsWith('.ts'))
    .filter(f => !IGNORE_PATTERNS.some(p => p.test(f.name)))
    .map(f => f.name.replace('.ts', ''));
  
  if (tsFiles.length === 0) {
    return issues;
  }
  
  // 读取 index.ts
  const indexPath = path.join(dirPath, indexFile);
  if (!fs.existsSync(indexPath)) {
    issues.push({
      type: 'missing-index',
      dir: dirPath,
      message: `缺少 ${indexFile}`,
    });
    return issues;
  }
  
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  
  // 检查每个文件是否被导出
  for (const file of tsFiles) {
    // 检查是否有 export { ... } from './file' 或 export * from './file'
    const exportPattern = new RegExp(`export.*from\\s+['"]\\.\\/?${file}['"]`);
    const exportAllPattern = new RegExp(`export\\s+\\*\\s+from\\s+['"]\\.\\/?${file}['"]`);
    
    if (!exportPattern.test(indexContent) && !exportAllPattern.test(indexContent)) {
      issues.push({
        type: 'missing-export',
        dir: dirPath,
        file: file,
        message: `${file}.ts 未在 ${indexFile} 中导出`,
      });
    }
  }
  
  return issues;
}

// 主函数
function main() {
  console.log('🔍 检查模块导出...\n');
  
  let totalIssues = 0;
  
  for (const dir of LAYER_DIRS) {
    const dirPath = path.join(SRC_DIR, dir);
    const issues = checkDirectory(dirPath, 'index.ts');
    
    if (issues.length > 0) {
      console.log(`📁 ${dir}`);
      for (const issue of issues) {
        console.log(`  ❌ ${issue.message}`);
        totalIssues++;
      }
      console.log('');
    }
  }
  
  if (totalIssues === 0) {
    console.log('✅ 所有模块都已正确导出\n');
    process.exit(0);
  } else {
    console.log(`❌ 发现 ${totalIssues} 个问题\n`);
    process.exit(1);
  }
}

main();
