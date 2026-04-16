#!/usr/bin/env node
/**
 * 依赖更新检查脚本
 * 
 * 检查过时的依赖包和已知安全漏洞
 */

const { execSync } = require('fs');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

console.log('========================================');
console.log('依赖更新检查');
console.log('========================================\n');

// 1. 检查过时的依赖
console.log('📦 检查过时的依赖...\n');
try {
  const outdated = execSync('npm outdated --json', {
    cwd: rootDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  
  if (outdated.trim()) {
    const outdatedPackages = JSON.parse(outdated);
    const packages = Object.keys(outdatedPackages);
    
    console.log(`发现 ${packages.length} 个过时的依赖:\n`);
    
    packages.forEach(pkg => {
      const info = outdatedPackages[pkg];
      console.log(`  ${pkg}`);
      console.log(`    当前: ${info.current}`);
      console.log(`    最新: ${info.latest}`);
      console.log(`    类型: ${info.type}`);
      console.log('');
    });
  } else {
    console.log('✅ 所有依赖都是最新的\n');
  }
} catch (error) {
  // npm outdated 返回非零退出码表示有过时的包
  if (error.stdout) {
    try {
      const outdatedPackages = JSON.parse(error.stdout);
      const packages = Object.keys(outdatedPackages);
      
      console.log(`发现 ${packages.length} 个过时的依赖:\n`);
      
      packages.forEach(pkg => {
        const info = outdatedPackages[pkg];
        console.log(`  ${pkg}`);
        console.log(`    当前: ${info.current}`);
        console.log(`    最新: ${info.latest}`);
        console.log(`    类型: ${info.type}`);
        console.log('');
      });
    } catch (parseError) {
      console.log('✅ 所有依赖都是最新的\n');
    }
  } else {
    console.log('✅ 所有依赖都是最新的\n');
  }
}

// 2. 检查安全漏洞
console.log('🔒 检查安全漏洞...\n');
try {
  const audit = execSync('npm audit --json', {
    cwd: rootDir,
    encoding: 'utf-8',
  });
  
  const auditResult = JSON.parse(audit);
  
  if (auditResult.vulnerabilities && Object.keys(auditResult.vulnerabilities).length > 0) {
    const vulns = auditResult.vulnerabilities;
    const severities = { critical: 0, high: 0, moderate: 0, low: 0 };
    
    Object.values(vulns).forEach((vuln: any) => {
      severities[vuln.severity]++;
    });
    
    console.log('发现安全漏洞:\n');
    console.log(`  严重: ${severities.critical}`);
    console.log(`  高危: ${severities.high}`);
    console.log(`  中危: ${severities.moderate}`);
    console.log(`  低危: ${severities.low}`);
    console.log('\n运行 `npm audit` 查看详细信息');
  } else {
    console.log('✅ 未发现已知安全漏洞\n');
  }
} catch (error) {
  // npm audit 返回非零退出码表示有漏洞
  if (error.stdout) {
    try {
      const auditResult = JSON.parse(error.stdout);
      
      if (auditResult.vulnerabilities && Object.keys(auditResult.vulnerabilities).length > 0) {
        const vulns = auditResult.vulnerabilities;
        const severities = { critical: 0, high: 0, moderate: 0, low: 0 };
        
        Object.values(vulns).forEach((vuln: any) => {
          severities[vuln.severity]++;
        });
        
        console.log('发现安全漏洞:\n');
        console.log(`  严重: ${severities.critical}`);
        console.log(`  高危: ${severities.high}`);
        console.log(`  中危: ${severities.moderate}`);
        console.log(`  低危: ${severities.low}`);
        console.log('\n运行 `npm audit` 查看详细信息');
      } else {
        console.log('✅ 未发现已知安全漏洞\n');
      }
    } catch (parseError) {
      console.log('✅ 未发现已知安全漏洞\n');
    }
  } else {
    console.log('✅ 未发现已知安全漏洞\n');
  }
}

// 3. 检查 package.json 中的依赖数量
console.log('📊 依赖统计...\n');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const deps = Object.keys(packageJson.dependencies || {}).length;
const devDeps = Object.keys(packageJson.devDependencies || {}).length;

console.log(`  生产依赖: ${deps} 个`);
console.log(`  开发依赖: ${devDeps} 个`);
console.log(`  总计: ${deps + devDeps} 个\n`);

console.log('========================================');
console.log('检查完成');
console.log('========================================');
