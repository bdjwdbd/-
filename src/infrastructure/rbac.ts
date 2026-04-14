/**
 * RBAC 权限控制模块
 * 
 * 基于角色的访问控制
 * 融合自 yaoyao-memory-v2
 */

import { StructuredLogger } from './index';

// ============ 类型定义 ============

export type Permission = 
  | 'memory.read'
  | 'memory.write'
  | 'memory.delete'
  | 'memory.export'
  | 'memory.import'
  | 'config.read'
  | 'config.write'
  | 'admin';

export type Role = 'guest' | 'user' | 'admin' | 'system';

export interface User {
  id: string;
  name: string;
  role: Role;
  permissions: Permission[];
  metadata?: Record<string, any>;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: 'read' | 'write' | 'delete' | 'export' | 'import';
  context?: Record<string, any>;
}

export interface AccessResult {
  allowed: boolean;
  reason: string;
  user?: User;
}

// ============ 角色权限映射 ============

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  guest: ['memory.read'],
  user: ['memory.read', 'memory.write', 'memory.export'],
  admin: ['memory.read', 'memory.write', 'memory.delete', 'memory.export', 'memory.import', 'config.read', 'config.write', 'admin'],
  system: ['memory.read', 'memory.write', 'memory.delete', 'memory.export', 'memory.import', 'config.read', 'config.write', 'admin']
};

// ============ RBAC 管理器类 ============

export class RBACManager {
  private logger: StructuredLogger;
  private users: Map<string, User> = new Map();
  private rolePermissions: Record<Role, Permission[]>;

  constructor(logger: StructuredLogger, customPermissions?: Partial<Record<Role, Permission[]>>) {
    this.logger = logger;
    this.rolePermissions = { ...ROLE_PERMISSIONS, ...customPermissions };
  }

  // ============ 用户管理 ============

  addUser(id: string, name: string, role: Role, metadata?: Record<string, any>): User {
    const user: User = {
      id,
      name,
      role,
      permissions: [...this.rolePermissions[role]],
      metadata
    };
    
    this.users.set(id, user);
    this.logger.info('RBACManager', `添加用户: ${name} (${role})`);
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  removeUser(id: string): boolean {
    const result = this.users.delete(id);
    if (result) {
      this.logger.info('RBACManager', `移除用户: ${id}`);
    }
    return result;
  }

  updateUserRole(id: string, role: Role): boolean {
    const user = this.users.get(id);
    if (!user) return false;

    user.role = role;
    user.permissions = [...this.rolePermissions[role]];
    this.logger.info('RBACManager', `更新用户角色: ${id} -> ${role}`);
    return true;
  }

  // ============ 权限检查 ============

  checkAccess(request: AccessRequest): AccessResult {
    const user = this.users.get(request.userId);
    
    if (!user) {
      return {
        allowed: false,
        reason: '用户不存在'
      };
    }

    const requiredPermission = this.getRequiredPermission(request.resource, request.action);
    
    if (!requiredPermission) {
      return {
        allowed: false,
        reason: '未知资源或操作'
      };
    }

    if (user.permissions.includes('admin') || user.permissions.includes(requiredPermission)) {
      return {
        allowed: true,
        reason: '权限验证通过',
        user
      };
    }

    return {
      allowed: false,
      reason: `缺少权限: ${requiredPermission}`,
      user
    };
  }

  hasPermission(userId: string, permission: Permission): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    
    return user.permissions.includes('admin') || user.permissions.includes(permission);
  }

  private getRequiredPermission(resource: string, action: string): Permission | null {
    const resourceMap: Record<string, Record<string, Permission>> = {
      memory: {
        read: 'memory.read',
        write: 'memory.write',
        delete: 'memory.delete',
        export: 'memory.export',
        import: 'memory.import'
      },
      config: {
        read: 'config.read',
        write: 'config.write'
      }
    };

    return resourceMap[resource]?.[action] || null;
  }

  // ============ 角色管理 ============

  getRolePermissions(role: Role): Permission[] {
    return [...this.rolePermissions[role]];
  }

  addPermissionToRole(role: Role, permission: Permission): void {
    if (!this.rolePermissions[role].includes(permission)) {
      this.rolePermissions[role].push(permission);
      this.logger.info('RBACManager', `添加角色权限: ${role} -> ${permission}`);
    }
  }

  removePermissionFromRole(role: Role, permission: Permission): void {
    const index = this.rolePermissions[role].indexOf(permission);
    if (index !== -1) {
      this.rolePermissions[role].splice(index, 1);
      this.logger.info('RBACManager', `移除角色权限: ${role} -> ${permission}`);
    }
  }

  // ============ 统计 ============

  getStats(): {
    totalUsers: number;
    byRole: Record<Role, number>;
  } {
    const byRole: Record<Role, number> = {
      guest: 0,
      user: 0,
      admin: 0,
      system: 0
    };

    for (const user of this.users.values()) {
      byRole[user.role]++;
    }

    return {
      totalUsers: this.users.size,
      byRole
    };
  }

  // ============ 导入导出 ============

  exportUsers(): User[] {
    return Array.from(this.users.values());
  }

  importUsers(users: User[]): number {
    let count = 0;
    for (const user of users) {
      this.users.set(user.id, user);
      count++;
    }
    this.logger.info('RBACManager', `导入用户: ${count} 个`);
    return count;
  }
}
