/**
 * 完整性验证器测试
 */

import { IntegrityValidator, quickValidate, validateFile } from '../infrastructure/integrity-validator';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('IntegrityValidator', () => {
  let validator: IntegrityValidator;
  const testDir = path.join(__dirname, 'test-integrity');
  const testFile = path.join(testDir, 'test.node');

  beforeAll(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 创建测试文件
    fs.writeFileSync(testFile, Buffer.from('test native module content'));
  });

  afterAll(() => {
    // 清理测试文件
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    validator = new IntegrityValidator({ strictMode: false });
  });

  describe('calculateHash', () => {
    it('应该能计算文件的 SHA256 哈希', () => {
      const hash = validator.calculateHash(testFile);
      
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('对相同文件应该返回相同的哈希', () => {
      const hash1 = validator.calculateHash(testFile);
      const hash2 = validator.calculateHash(testFile);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('validateFile', () => {
    it('非严格模式下未知文件应该通过', () => {
      const result = validator.validateFile(testFile);
      
      expect(result.valid).toBe(true);
      expect(result.actualHash).toMatch(/^sha256:/);
    });

    it('文件不存在时应该失败', () => {
      const result = validator.validateFile('/nonexistent/file.node');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File not found');
    });

    it('应该阻止路径遍历', () => {
      const result = validator.validateFile('../../../etc/passwd');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path contains blocked pattern');
    });
  });

  describe('updateHash', () => {
    it('应该能更新哈希值', () => {
      const hash = 'sha256:abc123';
      validator.updateHash('linux', 'x64', hash);
      
      const exported = validator.exportHashes();
      expect(exported['linux-x64/vector_ops.node']).toBe(hash);
    });
  });

  describe('validateAllBinaries', () => {
    it('应该验证所有原生模块', () => {
      const report = validator.validateAllBinaries();
      
      // 可能找到已存在的 .node 文件
      expect(report.passed).toBe(true);
      expect(report.totalChecked).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('quickValidate', () => {
  it('应该返回布尔值', () => {
    const result = quickValidate();
    expect(typeof result).toBe('boolean');
  });
});

describe('validateFile', () => {
  it('应该返回验证结果', () => {
    const result = validateFile('/nonexistent/file.node');
    
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('file');
    expect(result).toHaveProperty('expectedHash');
    expect(result).toHaveProperty('actualHash');
  });
});
