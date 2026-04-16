/**
 * 模块自动发现与集成系统
 * 
 * 核心能力：
 * - 自动扫描 src 目录下的新模块
 * - 自动集成到 YuanLingSystem
 * - 自动更新检查脚本
 * - 无需手动运行命令
 */

import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

interface ModuleInfo {
  name: string;
  path: string;
  typeName: string;
  hasIndexExport: boolean;
}

// ============ 配置 ============

const CONFIG = {
  srcDir: path.join(__dirname, '..', 'src'),
  mainFile: path.join(__dirname, '..', 'src', 'yuanling-system.ts'),
  checkScript: path.join(__dirname, 'check-integration.js'),
  excludeDirs: ['__tests__', '__demos__', 'node_modules', 'dist'],
  excludeFiles: ['index.ts', 'types.ts'],
};

// ============ 模块发现器 ============

class ModuleDiscovery {
  /**
   * 扫描所有模块目录
   */
  scanModules(): ModuleInfo[] {
    const modules: ModuleInfo[] = [];
    
    // 扫描 src 目录
    this.scanDir(CONFIG.srcDir, modules);
    
    return modules;
  }
  
  /**
   * 递归扫描目录
   */
  private scanDir(dir: string, modules: ModuleInfo[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过排除的目录
        if (CONFIG.excludeDirs.includes(entry.name)) {
          continue;
        }
        
        // 检查是否有 index.ts
        const indexPath = path.join(fullPath, 'index.ts');
        if (fs.existsSync(indexPath)) {
          // 这是一个模块目录
          const moduleInfo = this.parseModule(fullPath, indexPath);
          if (moduleInfo) {
            modules.push(moduleInfo);
          }
        }
        
        // 递归扫描子目录
        this.scanDir(fullPath, modules);
      }
    }
  }
  
  /**
   * 解析模块信息
   */
  private parseModule(moduleDir: string, indexPath: string): ModuleInfo | null {
    const content = fs.readFileSync(indexPath, 'utf-8');
    
    // 查找导出的类型
    const exportMatches = content.match(/export\s+(?:class|interface|function|const)\s+(\w+)/g);
    if (!exportMatches || exportMatches.length === 0) {
      return null;
    }
    
    // 提取主类型名（通常是目录名的驼峰形式）
    const dirName = path.basename(moduleDir);
    const typeName = this.toPascalCase(dirName);
    
    // 检查是否导出了主类型
    const hasMainExport = exportMatches.some(m => m.includes(typeName));
    
    return {
      name: dirName,
      path: path.relative(CONFIG.srcDir, moduleDir).replace(/\\/g, '/'),
      typeName: hasMainExport ? typeName : exportMatches[0].split(/\s+/)[2],
      hasIndexExport: true,
    };
  }
  
  /**
   * 转换为 PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}

// ============ 集成检查器 ============

class IntegrationChecker {
  private mainContent: string;
  
  constructor() {
    this.mainContent = fs.readFileSync(CONFIG.mainFile, 'utf-8');
  }
  
  /**
   * 检查模块是否已集成
   */
  isIntegrated(module: ModuleInfo): boolean {
    const patterns = [
      new RegExp(`import.*${module.typeName}.*from.*'\\./${module.path}'`),
      new RegExp(`private\\s+_\\w+\\?:\\s*${module.typeName}`),
      new RegExp(`initialize${module.typeName}\\s*\\(`),
    ];
    
    return patterns.every(p => p.test(this.mainContent));
  }
  
  /**
   * 获取未集成的模块
   */
  getUnintegratedModules(modules: ModuleInfo[]): ModuleInfo[] {
    return modules.filter(m => !this.isIntegrated(m));
  }
}

// ============ 自动集成器 ============

class AutoIntegrator {
  private mainContent: string;
  
  constructor() {
    this.mainContent = fs.readFileSync(CONFIG.mainFile, 'utf-8');
  }
  
  /**
   * 自动集成模块
   */
  integrate(module: ModuleInfo): boolean {
    console.log(`[AutoIntegrator] 集成模块: ${module.name}`);
    
    // 1. 添加导入
    this.addImport(module);
    
    // 2. 添加实例
    this.addInstance(module);
    
    // 3. 添加访问器
    this.addAccessor(module);
    
    // 4. 添加初始化方法
    this.addInitializer(module);
    
    // 5. 添加到 startup()
    this.addToStartup(module);
    
    // 写入文件
    fs.writeFileSync(CONFIG.mainFile, this.mainContent);
    
    console.log(`[AutoIntegrator] ✅ ${module.name} 已集成`);
    return true;
  }
  
  /**
   * 添加导入
   */
  private addImport(module: ModuleInfo): void {
    const importPath = `./${module.path}`;
    const importStatement = `import { ${module.typeName} } from '${importPath}';\n`;
    
    if (this.mainContent.includes(importStatement)) {
      return;
    }
    
    // 查找最后一个 import
    const lastImportIndex = this.mainContent.lastIndexOf("from '");
    const nextLineIndex = this.mainContent.indexOf('\n', lastImportIndex) + 1;
    
    this.mainContent = 
      this.mainContent.slice(0, nextLineIndex) + 
      importStatement + 
      this.mainContent.slice(nextLineIndex);
  }
  
  /**
   * 添加实例
   */
  private addInstance(module: ModuleInfo): void {
    const instanceName = `_${module.typeName.charAt(0).toLowerCase() + module.typeName.slice(1)}`;
    const instanceStatement = `  private ${instanceName}?: ${module.typeName};\n`;
    
    if (this.mainContent.includes(instanceStatement)) {
      return;
    }
    
    // 查找最后一个 private 实例
    const lastPrivateIndex = this.mainContent.lastIndexOf('private _');
    const nextLineIndex = this.mainContent.indexOf('\n', lastPrivateIndex) + 1;
    
    this.mainContent = 
      this.mainContent.slice(0, nextLineIndex) + 
      instanceStatement + 
      this.mainContent.slice(nextLineIndex);
  }
  
  /**
   * 添加访问器
   */
  private addAccessor(module: ModuleInfo): void {
    const accessorName = module.typeName.charAt(0).toLowerCase() + module.typeName.slice(1);
    const instanceName = `_${accessorName}`;
    
    const accessorStatement = `
  /** 获取 ${module.name} */
  get ${accessorName}(): ${module.typeName} | undefined {
    return this.${instanceName};
  }
`;
    
    if (this.mainContent.includes(`get ${accessorName}`)) {
      return;
    }
    
    // 查找最后一个 get 访问器
    const lastGetIndex = this.mainContent.lastIndexOf('get ');
    const nextLineIndex = this.mainContent.indexOf('\n\n', lastGetIndex) + 2;
    
    this.mainContent = 
      this.mainContent.slice(0, nextLineIndex) + 
      accessorStatement + 
      this.mainContent.slice(nextLineIndex);
  }
  
  /**
   * 添加初始化方法
   */
  private addInitializer(module: ModuleInfo): void {
    const initMethodName = `initialize${module.typeName}`;
    const instanceName = `_${module.typeName.charAt(0).toLowerCase() + module.typeName.slice(1)}`;
    
    const initStatement = `
  /**
   * 初始化 ${module.name}
   */
  ${initMethodName}(): ${module.typeName} {
    if (this.${instanceName}) {
      return this.${instanceName};
    }
    
    this.${instanceName} = new ${module.typeName}();
    console.log('[YuanLing] ${module.name} 已初始化');
    return this.${instanceName};
  }
`;
    
    if (this.mainContent.includes(initMethodName)) {
      return;
    }
    
    // 查找最后一个初始化方法
    const lastInitIndex = this.mainContent.lastIndexOf('initialize');
    const nextLineIndex = this.mainContent.indexOf('\n\n', lastInitIndex) + 2;
    
    this.mainContent = 
      this.mainContent.slice(0, nextLineIndex) + 
      initStatement + 
      this.mainContent.slice(nextLineIndex);
  }
  
  /**
   * 添加到 startup()
   */
  private addToStartup(module: ModuleInfo): void {
    const initMethodName = `initialize${module.typeName}`;
    const startupCall = `    this.${initMethodName}();\n`;
    
    if (this.mainContent.includes(startupCall)) {
      return;
    }
    
    // 查找 "自动初始化新模块" 注释
    const autoInitIndex = this.mainContent.indexOf('// 自动初始化新模块');
    if (autoInitIndex === -1) {
      return;
    }
    
    const nextLineIndex = this.mainContent.indexOf('\n', autoInitIndex) + 1;
    
    this.mainContent = 
      this.mainContent.slice(0, nextLineIndex) + 
      startupCall + 
      this.mainContent.slice(nextLineIndex);
  }
}

// ============ 主函数 ============

function main(): void {
  console.log('🔍 扫描模块...\n');
  
  // 1. 发现所有模块
  const discovery = new ModuleDiscovery();
  const allModules = discovery.scanModules();
  
  console.log(`发现 ${allModules.length} 个模块:\n`);
  allModules.forEach(m => console.log(`  - ${m.name} (${m.typeName})`));
  console.log('');
  
  // 2. 检查哪些模块未集成
  const checker = new IntegrationChecker();
  const unintegrated = checker.getUnintegratedModules(allModules);
  
  if (unintegrated.length === 0) {
    console.log('✅ 所有模块已集成\n');
    return;
  }
  
  console.log(`发现 ${unintegrated.length} 个未集成的模块:\n`);
  unintegrated.forEach(m => console.log(`  - ${m.name} (${m.typeName})`));
  console.log('');
  
  // 3. 自动集成
  console.log('🔧 开始自动集成...\n');
  
  const integrator = new AutoIntegrator();
  for (const module of unintegrated) {
    integrator.integrate(module);
  }
  
  console.log('\n✅ 自动集成完成！');
  console.log('\n下一步:');
  console.log('  1. 运行 npm run check:integration 验证集成');
  console.log('  2. 运行 npm run typecheck 验证编译');
}

main();
