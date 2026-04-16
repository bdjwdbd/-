/**
 * 控制器模式测试
 */

import {
  BaseController,
  ControllerManager,
  HealthCheckController,
  Reconcilable,
  ReconcileResult,
} from '../layers/ling-yun/controller-pattern';

describe('BaseController', () => {
  // 简化的测试控制器
  class SimpleController extends BaseController<Reconcilable> {
    private reconcileCount = 0;

    protected async reconcile(resource: Reconcilable): Promise<ReconcileResult> {
      this.reconcileCount++;
      return { requeue: false };
    }

    getReconcileCount(): number {
      return this.reconcileCount;
    }
  }

  let controller: SimpleController;

  beforeEach(() => {
    controller = new SimpleController({ name: 'test-controller' });
  });

  describe('生命周期', () => {
    it('应该启动和停止', async () => {
      expect(controller.isRunning()).toBe(false);

      await controller.start();
      expect(controller.isRunning()).toBe(true);

      await controller.stop();
      expect(controller.isRunning()).toBe(false);
    });
  });

  describe('工作队列', () => {
    it('应该入队资源', () => {
      const resource: Reconcilable = {
        id: 'test-1',
        spec: {},
        status: { healthy: true, ready: true, message: '', lastUpdateTime: Date.now(), conditions: [] },
        resourceVersion: 1,
      };

      controller.enqueue(resource);

      expect(controller.getQueueLength()).toBe(1);
    });

    it('应该处理资源', async () => {
      const resource: Reconcilable = {
        id: 'test-1',
        spec: {},
        status: { healthy: true, ready: true, message: '', lastUpdateTime: Date.now(), conditions: [] },
        resourceVersion: 1,
      };

      controller.enqueue(resource);
      await controller.start();

      // 等待处理
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(controller.getReconcileCount()).toBeGreaterThan(0);

      await controller.stop();
    });
  });
});

describe('HealthCheckController', () => {
  let controller: HealthCheckController;
  let healthStatus = true;

  beforeEach(() => {
    healthStatus = true;
    controller = new HealthCheckController(
      async () => healthStatus,
      async () => { healthStatus = true; },
      { reconcileInterval: 100 }
    );
  });

  it('应该检测健康状态', async () => {
    const resource: Reconcilable = {
      id: 'health-check',
      spec: { healthy: true },
      status: { healthy: true, ready: true, message: '', lastUpdateTime: Date.now(), conditions: [] },
      resourceVersion: 1,
    };

    controller.enqueue(resource);
    await controller.start();

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(controller.isRunning()).toBe(true);

    await controller.stop();
  });
});

describe('ControllerManager', () => {
  let manager: ControllerManager;

  beforeEach(() => {
    manager = new ControllerManager();
  });

  describe('注册和管理', () => {
    it('应该注册控制器', async () => {
      const controller = new HealthCheckController(
        async () => true,
        async () => {},
        { name: 'test-1' }
      );
      manager.register(controller);

      expect(manager.get('test-1')).toBeDefined();
      expect(manager.getNames()).toContain('test-1');
    });

    it('应该启动所有控制器', async () => {
      const controller1 = new HealthCheckController(
        async () => true,
        async () => {},
        { name: 'test-1' }
      );
      const controller2 = new HealthCheckController(
        async () => true,
        async () => {},
        { name: 'test-2' }
      );

      manager.register(controller1);
      manager.register(controller2);

      await manager.startAll();

      expect(controller1.isRunning()).toBe(true);
      expect(controller2.isRunning()).toBe(true);

      await manager.stopAll();

      expect(controller1.isRunning()).toBe(false);
      expect(controller2.isRunning()).toBe(false);
    });
  });
});
