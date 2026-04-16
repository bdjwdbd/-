#!/usr/bin/env node
/**
 * 自动修复模块导出
 * 
 * 将未导出的模块添加到对应的 index.ts
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
];

// 修复目录
function fixDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  let fixed = 0;
  
  // 读取目录下所有文件
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  
  // 获取所有 .ts 文件
  const tsFiles = files
    .filter(f => f.isFile() && f.name.endsWith('.ts'))
    .filter(f => !IGNORE_PATTERNS.some(p => p.test(f.name)))
    .map(f => f.name.replace('.ts', ''));
  
  if (tsFiles.length === 0) {
    return 0;
  }
  
  // 读取或创建 index.ts
  const indexPath = path.join(dirPath, 'index.ts');
  let indexContent = '';
  
  if (fs.existsSync(indexPath)) {
    indexContent = fs.readFileSync(indexPath, 'utf-8');
  }
  
  // 检查并添加导出
  const newExports = [];
  for (const file of tsFiles) {
    const exportPattern = new RegExp(`export.*from\\s+['"]\\.\\/?${file}['"]`);
    const exportAllPattern = new RegExp(`export\\s+\\*\\s+from\\s+['"]\\.\\/?${file}['"]`);
    
    if (!exportPattern.test(indexContent) && !exportAllPattern.test(indexContent)) {
      newExports.push(`export * from './${file}';`);
      fixed++;
    }
  }
  
  if (newExports.length > 0) {
    // 添加新导出
    const newContent = indexContent + '\n' + newExports.join('\n') + '\n';
    fs.writeFileSync(indexPath, newContent);
  }
  
  return fixed;
}

// 主函数
function main() {
  console.log('🔧 自动修复模块导出...\n');
  
  let totalFixed = 0;
  
  for (const dir of LAYER_DIRS) {
    const dirPath = path.join(SRC_DIR, dir);
    const fixed = fixDirectory(dirPath);
    
    if (fixed > 0) {
      console.log(`📁 ${dir}: 修复 ${fixed} 个导出`);
      totalFixed += fixed;
    }
  }
  
  console.log(`\n✅ 共修复 ${totalFixed} 个导出\n`);
}

main();
