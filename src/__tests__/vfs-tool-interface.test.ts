/**
 * VFS 工具接口测试
 */

import {
  ToolRegistry,
  ToolExecutor,
  ToolCategory,
  createTool,
} from '../layers/ling-qu/vfs-tool-interface';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('注册和注销', () => {
    it('应该注册工具', () => {
      const tool = createTool<string, string>()
        .name('test-tool')
        .category(ToolCategory.INFORMATION)
        .description('测试工具')
        .validate((params): params is string => typeof params === 'string')
        .execute(async (params) => ({
          success: true,
          data: `processed: ${params}`,
          duration: 0,
        }))
        .build();

      registry.register(tool);

      expect(registry.has('test-tool')).toBe(true);
      expect(registry.get('test-tool')).toBeDefined();
    });

    it('应该注销工具', () => {
      const tool = createTool<string, string>()
        .name('test-tool')
        .category(ToolCategory.INFORMATION)
        .description('测试工具')
        .validate((params): params is string => typeof params === 'string')
        .execute(async (params) => ({
          success: true,
          data: params,
          duration: 0,
        }))
        .build();

      registry.register(tool);
      const result = registry.unregister('test-tool');

      expect(result).toBe(true);
      expect(registry.has('test-tool')).toBe(false);
    });
  });

  describe('查询', () => {
    beforeEach(() => {
      const tool1 = createTool<string, string>()
        .name('info-tool')
        .category(ToolCategory.INFORMATION)
        .description('信息工具')
        .validate((params): params is string => typeof params === 'string')
        .execute(async (params) => ({ success: true, data: params, duration: 0 }))
        .build();

      const tool2 = createTool<string, string>()
        .name('action-tool')
        .category(ToolCategory.ACTION)
        .description('操作工具')
        .validate((params): params is string => typeof params === 'string')
        .execute(async (params) => ({ success: true, data: params, duration: 0 }))
        .build();

      registry.register(tool1);
      registry.register(tool2);
    });

    it('应该按类别获取工具', () => {
      const infoTools = registry.getByCategory(ToolCategory.INFORMATION);

      expect(infoTools.length).toBe(1);
      expect(infoTools[0].metadata.name).toBe('info-tool');
    });

    it('应该搜索工具', () => {
      const results = registry.search('信息');

      expect(results.length).toBe(1);
      expect(results[0].metadata.name).toBe('info-tool');
    });

    it('应该获取所有工具名称', () => {
      const names = registry.getNames();

      expect(names).toContain('info-tool');
      expect(names).toContain('action-tool');
    });
  });
});

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry);
  });

  describe('执行', () => {
    it('应该执行工具', async () => {
      const tool = createTool<string, string>()
        .name('echo')
        .category(ToolCategory.INFORMATION)
        .description('回显工具')
        .validate((params): params is string => typeof params === 'string')
        .execute(async (params) => ({
          success: true,
          data: `echo: ${params}`,
          duration: 0,
        }))
        .build();

      registry.register(tool);

      const result = await executor.execute<string>('echo', 'hello');

      expect(result.success).toBe(true);
      expect(result.data).toBe('echo: hello');
    });

    it('工具不存在时应返回错误', async () => {
      const result = await executor.execute('non-existent', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('参数验证失败时应返回错误', async () => {
      const tool = createTool<string, string>()
        .name('string-only')
        .category(ToolCategory.INFORMATION)
        .description('只接受字符串')
        .validate((params): params is string => typeof params === 'string')
        .execute(async (params) => ({
          success: true,
          data: params,
          duration: 0,
        }))
        .build();

      registry.register(tool);

      const result = await executor.execute('string-only', 123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });
  });
});

describe('ToolBuilder', () => {
  it('应该构建完整的工具定义', () => {
    const tool = createTool<string, string>()
      .name('test')
      .category(ToolCategory.INFORMATION)
      .description('测试工具')
      .version('1.0.0')
      .param({
        name: 'input',
        type: 'string',
        required: true,
        description: '输入参数',
      })
      .validate((params): params is string => typeof params === 'string')
      .execute(async (params) => ({
        success: true,
        data: params,
        duration: 0,
      }))
      .build();

    expect(tool.metadata.name).toBe('test');
    expect(tool.metadata.category).toBe(ToolCategory.INFORMATION);
    expect(tool.metadata.version).toBe('1.0.0');
    expect(tool.parameters.length).toBe(1);
    expect(tool.operations.validate).toBeDefined();
    expect(tool.operations.execute).toBeDefined();
  });

  it('缺少必需字段时应抛出错误', () => {
    expect(() => {
      createTool().build();
    }).toThrow('Tool name is required');
  });
});
