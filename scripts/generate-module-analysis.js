#!/usr/bin/env node
/**
 * 模块归属分析模板生成器
 * 
 * 为新模块生成归属分析文档
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DOCS_DIR = path.join(__dirname, '..', 'docs', 'module-analysis');

// 确保目录存在
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

// 创建命令行交互
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 提问函数
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// 生成文档
async function generateAnalysis() {
  console.log('\n📝 模块归属分析模板生成器\n');
  console.log('请回答以下问题：\n');
  
  const moduleName = await question('模块名称（如 StateManager）: ');
  const description = await question('核心功能（一句话描述）: ');
  const layer = await question('归属层级（L0-L6 或 跨层）: ');
  const reason = await question('归属理由: ');
  const dependencies = await question('依赖哪些层级（如 L0, L1）: ');
  const dependedBy = await question('被哪些层级依赖（如 L4, L5）: ');
  
  const layerNames = {
    'L0': 'ling-si',
    'L1': 'ling-shu',
    'L2': 'ling-mai',
    'L3': 'ling-qu',
    'L4': 'ling-dun',
    'L5': 'ling-yun',
    'L6': 'ling-shi',
  };
  
  const layerName = layerNames[layer] || 'cross-layer';
  const date = new Date().toISOString().split('T')[0];
  const fileName = `${date}-${moduleName.toLowerCase()}.md`;
  const filePath = path.join(DOCS_DIR, fileName);
  
  const content = `# 模块归属分析：${moduleName}

## 基本信息
- **分析日期**: ${date}
- **分析者**: [填写]
- **模块名称**: ${moduleName}

## 归属分析

### 功能描述
${description}

### 层级归属
- **归属层级**: ${layer} ${layerNames[layer] ? `(${layerNames[layer]})` : '(跨层)'}
- **归属理由**: ${reason}

### 依赖关系
- **依赖**: ${dependencies || '无'}
- **被依赖**: ${dependedBy || '无'}

### 目录结构
\`\`\`
src/layers/${layerName}/
├── ${moduleName}.ts
└── __tests__/
    └── ${moduleName}.test.ts
\`\`\`

### 导出计划
- 在 \`src/layers/${layerName}/index.ts\` 中导出
- 在 \`src/index.ts\` 中重新导出

### 集成计划
- 在 \`YuanLingSystem\` 中添加实例
- 添加访问器方法

## 审批
- [ ] 架构师审批
- [ ] 技术负责人审批

## 备注
[其他需要说明的内容]
`;
  
  fs.writeFileSync(filePath, content);
  
  console.log(`\n✅ 归属分析文档已生成: docs/module-analysis/${fileName}\n`);
  console.log('下一步：');
  console.log('1. 填写文档中的 [填写] 部分');
  console.log('2. 提交给架构师审批');
  console.log('3. 审批通过后开始开发\n');
  
  rl.close();
}

generateAnalysis();
