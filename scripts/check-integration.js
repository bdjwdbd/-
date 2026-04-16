#!/usr/bin/env node
/**
 * 模块集成检查脚本
 * 
 * 检查新模块是否已集成到 YuanLingSystem 主流程
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// 需要检查的新模块
const NEW_MODULES = [
  {
    name: 'RalphLoop',
    importPattern: /RalphLoop/,
    usagePattern: /this\._ralphLoop|initializeRalphLoop/,
    location: 'yuanling-system.ts',
  },
  {
    name: 'REPLContainer',
    importPattern: /REPLContainer/,
    usagePattern: /this\._replContainer|initializeREPLContainer/,
    location: 'yuanling-system.ts',
  },
  {
    name: 'TokenPipeline',
    importPattern: /TokenPipeline/,
    usagePattern: /this\._tokenPipeline|initializeTokenPipeline/,
    location: 'yuanling-system.ts',
  },
  {
    name: 'EntropyGovernor',
    importPattern: /EntropyGovernor/,
    usagePattern: /this\._entropyGovernor|initializeEntropyGovernor/,
    location: 'yuanling-system.ts',
  },
  {
    name: 'IntelligenceSystem',
    importPattern: /IntelligenceSystem/,
    usagePattern: /this\._intelligenceSystem|processIntelligently/,
    location: 'yuanling-system.ts',
  },
];

// 检查模块集成
function checkIntegration() {
  console.log('🔍 检查模块集成状态...\n');
  
  const mainFile = path.join(SRC_DIR, 'yuanling-system.ts');
  
  if (!fs.existsSync(mainFile)) {
    console.log('❌ 找不到 yuanling-system.ts');
    process.exit(1);
  }
  
  const content = fs.readFileSync(mainFile, 'utf-8');
  
  let allIntegrated = true;
  const results = [];
  
  for (const module of NEW_MODULES) {
    const hasImport = module.importPattern.test(content);
    const hasUsage = module.usagePattern.test(content);
    const integrated = hasImport && hasUsage;
    
    results.push({
      module: module.name,
      imported: hasImport,
      used: hasUsage,
      integrated,
    });
    
    if (!integrated) {
      allIntegrated = false;
    }
  }
  
  // 输出结果
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('模块集成状态');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  for (const result of results) {
    const status = result.integrated ? '✅ 已集成' : '❌ 未集成';
    const importStatus = result.imported ? '✅' : '❌';
    const usageStatus = result.used ? '✅' : '❌';
    
    console.log(`${result.module}:`);
    console.log(`  导入: ${importStatus}`);
    console.log(`  使用: ${usageStatus}`);
    console.log(`  状态: ${status}`);
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (allIntegrated) {
    console.log('✅ 所有新模块已集成到主流程');
    process.exit(0);
  } else {
    console.log('❌ 部分模块未集成到主流程');
    console.log('');
    console.log('请执行以下操作：');
    console.log('1. 在 yuanling-system.ts 中导入模块');
    console.log('2. 添加私有成员变量');
    console.log('3. 添加访问器方法');
    console.log('4. 添加初始化方法');
    console.log('5. 在 startup() 中调用初始化方法');
    process.exit(1);
  }
}

checkIntegration();
