#!/usr/bin/env node
/**
 * 自动集成脚本
 * 
 * 当创建新模块后，运行此脚本自动完成集成：
 * 1. 自动导入模块
 * 2. 自动添加实例
 * 3. 自动添加访问器
 * 4. 自动添加初始化方法
 * 5. 自动添加到 startup()
 * 6. 自动更新 check-integration.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  mainFile: path.join(__dirname, '..', 'src', 'yuanling-system.ts'),
  checkScript: path.join(__dirname, 'check-integration.js'),
};

// 解析命令行参数
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('用法: node scripts/auto-integrate.js <模块名> <导入路径> <类型>');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/auto-integrate.js MyModule ./my-module MyModuleClass');
  console.log('');
  console.log('参数说明:');
  console.log('  模块名: 模块的显示名称（如 MyModule）');
  console.log('  导入路径: 相对于 src 的导入路径（如 ./my-module）');
  console.log('  类型: 导入的类型/类名（如 MyModuleClass）');
  process.exit(1);
}

const [moduleName, importPath, typeName] = args;

console.log('🔧 自动集成模块...');
console.log(`  模块名: ${moduleName}`);
console.log(`  导入路径: ${importPath}`);
console.log(`  类型: ${typeName}`);
console.log('');

// 读取主文件
let mainContent = fs.readFileSync(CONFIG.mainFile, 'utf-8');

// 1. 添加导入
console.log('1. 添加导入...');
const importStatement = `import { ${typeName} } from '${importPath}';\n`;

// 查找最后一个 import 语句的位置
const lastImportIndex = mainContent.lastIndexOf("from '");
const nextLineIndex = mainContent.indexOf('\n', lastImportIndex) + 1;

if (!mainContent.includes(importStatement)) {
  mainContent = mainContent.slice(0, nextLineIndex) + importStatement + mainContent.slice(nextLineIndex);
  console.log('   ✅ 导入已添加');
} else {
  console.log('   ⚠️ 导入已存在，跳过');
}

// 2. 添加实例
console.log('2. 添加实例...');
const instanceName = `_${typeName.charAt(0).toLowerCase() + typeName.slice(1)}`;
const instanceStatement = `  private ${instanceName}?: ${typeName};\n`;

// 查找最后一个 private 实例的位置
const lastPrivateIndex = mainContent.lastIndexOf('private _');
const nextPrivateLineIndex = mainContent.indexOf('\n', lastPrivateIndex) + 1;

if (!mainContent.includes(instanceStatement)) {
  mainContent = mainContent.slice(0, nextPrivateLineIndex) + instanceStatement + mainContent.slice(nextPrivateLineIndex);
  console.log('   ✅ 实例已添加');
} else {
  console.log('   ⚠️ 实例已存在，跳过');
}

// 3. 添加访问器
console.log('3. 添加访问器...');
const accessorName = typeName.charAt(0).toLowerCase() + typeName.slice(1);
const accessorStatement = `
  /** 获取 ${moduleName} */
  get ${accessorName}(): ${typeName} | undefined {
    return this.${instanceName};
  }
`;

// 查找最后一个 get 访问器的位置
const lastGetIndex = mainContent.lastIndexOf('get ');
const nextAccessorLineIndex = mainContent.indexOf('\n\n', lastGetIndex) + 2;

if (!mainContent.includes(`get ${accessorName}`)) {
  mainContent = mainContent.slice(0, nextAccessorLineIndex) + accessorStatement + mainContent.slice(nextAccessorLineIndex);
  console.log('   ✅ 访问器已添加');
} else {
  console.log('   ⚠️ 访问器已存在，跳过');
}

// 4. 添加初始化方法
console.log('4. 添加初始化方法...');
const initMethodName = `initialize${typeName}`;
const initStatement = `
  /**
   * 初始化 ${moduleName}
   */
  ${initMethodName}(): ${typeName} {
    if (this.${instanceName}) {
      return this.${instanceName};
    }
    
    this.${instanceName} = new ${typeName}();
    console.log('[YuanLing] ${moduleName} 已初始化');
    return this.${instanceName};
  }
`;

// 查找最后一个初始化方法的位置
const lastInitIndex = mainContent.lastIndexOf('initialize');
const nextInitLineIndex = mainContent.indexOf('\n\n', lastInitIndex) + 2;

if (!mainContent.includes(initMethodName)) {
  mainContent = mainContent.slice(0, nextInitLineIndex) + initStatement + mainContent.slice(nextInitLineIndex);
  console.log('   ✅ 初始化方法已添加');
} else {
  console.log('   ⚠️ 初始化方法已存在，跳过');
}

// 5. 添加到 startup()
console.log('5. 添加到 startup()...');
const startupCall = `    this.${initMethodName}();\n`;

// 查找 "自动初始化新模块" 注释
const autoInitIndex = mainContent.indexOf('// 自动初始化新模块');
if (autoInitIndex !== -1) {
  const nextStartupLineIndex = mainContent.indexOf('\n', autoInitIndex) + 1;
  
  if (!mainContent.includes(startupCall)) {
    mainContent = mainContent.slice(0, nextStartupLineIndex) + startupCall + mainContent.slice(nextStartupLineIndex);
    console.log('   ✅ 已添加到 startup()');
  } else {
    console.log('   ⚠️ 已在 startup() 中，跳过');
  }
} else {
  console.log('   ⚠️ 找不到 startup() 中的自动初始化位置');
}

// 写入文件
fs.writeFileSync(CONFIG.mainFile, mainContent);
console.log('');
console.log('✅ 自动集成完成！');
console.log('');
console.log('下一步:');
console.log('1. 运行 npm run check:integration 验证集成');
console.log('2. 运行 npm run typecheck 验证编译');
console.log('3. 实现模块的具体功能');
