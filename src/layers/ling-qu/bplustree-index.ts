/**
 * B+ 树索引
 * 
 * 借鉴 SQLite 的 B+ tree 存储结构，实现高效的知识检索
 * 
 * @module layers/ling-qu/bplustree-index
 */

// ============ 类型定义 ============

/**
 * B+ 树配置
 */
export interface BPlusTreeConfig {
  /** 阶数（每个节点的最大子节点数），默认 64 */
  order: number;
  /** 键比较函数 */
  compare?: (a: string, b: string) => number;
}

export const DEFAULT_BPLUSTREE_CONFIG: BPlusTreeConfig = {
  order: 64,
};

/**
 * 知识项
 */
export interface KnowledgeItem {
  /** 唯一 ID */
  id: string;
  /** 键（用于索引） */
  key: string;
  /** 内容 */
  content: unknown;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 搜索结果
 */
export interface SearchResult<T = KnowledgeItem> {
  /** 找到的项 */
  items: T[];
  /** 是否精确匹配 */
  exactMatch: boolean;
  /** 搜索耗时（毫秒） */
  duration: number;
  /** 比较次数 */
  comparisons: number;
}

// ============ B+ 树节点 ============

/**
 * B+ 树节点类型
 */
enum NodeType {
  INTERNAL = 'internal',
  LEAF = 'leaf',
}

/**
 * B+ 树节点（内部节点或叶节点）
 */
class BPlusTreeNode {
  type: NodeType;
  keys: string[] = [];
  children: BPlusTreeNode[] = [];  // 内部节点的子节点
  values: KnowledgeItem[] = [];     // 叶节点的值
  next: BPlusTreeNode | null = null; // 叶节点的下一个节点（用于范围查询）

  constructor(type: NodeType) {
    this.type = type;
  }

  isLeaf(): boolean {
    return this.type === NodeType.LEAF;
  }

  isFull(order: number): boolean {
    return this.keys.length >= order - 1;
  }
}

// ============ B+ 树索引 ============

/**
 * B+ 树索引
 * 
 * 特性：
 * - 所有值存储在叶节点
 * - 叶节点通过链表连接，支持高效范围查询
 * - 内部节点只存储键和子节点指针
 * - 查找、插入、删除复杂度：O(log n)
 */
export class BPlusTreeIndex {
  private config: BPlusTreeConfig;
  private root: BPlusTreeNode;
  private size: number = 0;
  private compare: (a: string, b: string) => number;

  constructor(config: Partial<BPlusTreeConfig> = {}) {
    this.config = { ...DEFAULT_BPLUSTREE_CONFIG, ...config };
    this.root = new BPlusTreeNode(NodeType.LEAF);
    this.compare = this.config.compare || ((a, b) => a.localeCompare(b));
  }

  /**
   * 插入知识项
   */
  insert(item: KnowledgeItem): void {
    const root = this.root;

    // 根节点已满，需要分裂
    if (root.isFull(this.config.order)) {
      const newRoot = new BPlusTreeNode(NodeType.INTERNAL);
      newRoot.children.push(this.root);
      this.splitChild(newRoot, 0);
      this.root = newRoot;
    }

    this.insertNonFull(this.root, item);
    this.size++;
  }

  /**
   * 向非满节点插入
   */
  private insertNonFull(node: BPlusTreeNode, item: KnowledgeItem): void {
    let i = node.keys.length - 1;

    if (node.isLeaf()) {
      // 叶节点：找到插入位置
      while (i >= 0 && this.compare(item.key, node.keys[i]) < 0) {
        i--;
      }

      // 插入键和值
      node.keys.splice(i + 1, 0, item.key);
      node.values.splice(i + 1, 0, item);
    } else {
      // 内部节点：找到子节点
      while (i >= 0 && this.compare(item.key, node.keys[i]) < 0) {
        i--;
      }
      i++;

      // 子节点已满，需要分裂
      if (node.children[i].isFull(this.config.order)) {
        this.splitChild(node, i);
        if (this.compare(item.key, node.keys[i]) > 0) {
          i++;
        }
      }

      this.insertNonFull(node.children[i], item);
    }
  }

  /**
   * 分裂子节点
   */
  private splitChild(parent: BPlusTreeNode, index: number): void {
    const order = this.config.order;
    const child = parent.children[index];
    const mid = Math.floor((order - 1) / 2);

    // 创建新节点
    const newNode = new BPlusTreeNode(child.type);

    if (child.isLeaf()) {
      // 叶节点分裂
      // 先保存中间键（分裂前）
      const midKey = child.keys[mid];
      
      newNode.keys = child.keys.splice(mid + 1);  // mid+1 开始的键
      newNode.values = child.values.splice(mid + 1);  // mid+1 开始的值
      newNode.next = child.next;
      child.next = newNode;
      
      // 提升中间键到父节点
      parent.keys.splice(index, 0, midKey);
      parent.children.splice(index + 1, 0, newNode);
    } else {
      // 内部节点分裂
      const midKey = child.keys[mid];
      
      newNode.keys = child.keys.splice(mid + 1);
      newNode.children = child.children.splice(mid + 1);
      
      // 移除中间键（已提升到父节点）
      child.keys.pop();
      
      // 提升中间键到父节点
      parent.keys.splice(index, 0, midKey);
      parent.children.splice(index + 1, 0, newNode);
    }
  }

  /**
   * 精确查找
   */
  find(key: string): KnowledgeItem | undefined {
    return this.findInNode(this.root, key);
  }

  /**
   * 在节点中查找
   */
  private findInNode(node: BPlusTreeNode, key: string): KnowledgeItem | undefined {
    let i = 0;
    while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
      i++;
    }

    if (node.isLeaf()) {
      // 叶节点：检查是否找到
      if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
        return node.values[i];
      }
      return undefined;
    }

    // 内部节点：递归查找子节点
    return this.findInNode(node.children[i], key);
  }

  /**
   * 范围查询
   */
  range(start: string, end: string): SearchResult {
    const startTime = Date.now();
    const items: KnowledgeItem[] = [];
    let comparisons = 0;

    // 找到起始叶节点
    let leaf: BPlusTreeNode | null = this.findLeafNode(this.root, start);
    let i = 0;

    // 找到起始位置
    while (leaf && i < leaf.keys.length && this.compare(leaf.keys[i], start) < 0) {
      i++;
      comparisons++;
    }

    // 遍历叶节点链表
    while (leaf && i < leaf.keys.length) {
      comparisons++;
      if (this.compare(leaf.keys[i], end) > 0) {
        break;
      }
      items.push(leaf.values[i]);
      i++;

      // 移动到下一个叶节点
      if (i >= leaf.keys.length && leaf.next) {
        leaf = leaf.next;
        i = 0;
      }
    }

    return {
      items,
      exactMatch: false,
      duration: Date.now() - startTime,
      comparisons,
    };
  }

  /**
   * 前缀搜索
   */
  searchPrefix(prefix: string): SearchResult {
    const startTime = Date.now();
    const items: KnowledgeItem[] = [];
    let comparisons = 0;

    // 从最左边的叶节点开始遍历
    let leaf: BPlusTreeNode | null = this.getLeftmostLeaf(this.root);

    while (leaf) {
      for (let i = 0; i < leaf.keys.length; i++) {
        comparisons++;
        if (leaf.keys[i].startsWith(prefix)) {
          items.push(leaf.values[i]);
        }
      }
      leaf = leaf.next;
    }

    return {
      items,
      exactMatch: false,
      duration: Date.now() - startTime,
      comparisons,
    };
  }

  /**
   * 模糊搜索
   */
  searchFuzzy(query: string, maxDistance: number = 2): SearchResult {
    const startTime = Date.now();
    const items: KnowledgeItem[] = [];
    let comparisons = 0;

    // 遍历所有叶节点
    let leaf: BPlusTreeNode | null = this.getLeftmostLeaf(this.root);
    while (leaf) {
      for (let i = 0; i < leaf.keys.length; i++) {
        comparisons++;
        const distance = this.levenshteinDistance(query.toLowerCase(), leaf.keys[i].toLowerCase());
        if (distance <= maxDistance) {
          items.push({ ...leaf.values[i], metadata: { ...leaf.values[i].metadata, distance } });
        }
      }
      leaf = leaf.next;
    }

    // 按距离排序，距离相同时按键排序
    items.sort((a, b) => {
      const distA = a.metadata?.distance as number;
      const distB = b.metadata?.distance as number;
      if (distA !== distB) return distA - distB;
      return this.compare(a.key, b.key);
    });

    return {
      items,
      exactMatch: false,
      duration: Date.now() - startTime,
      comparisons,
    };
  }

  /**
   * 找到包含键的叶节点
   */
  private findLeafNode(node: BPlusTreeNode, key: string): BPlusTreeNode | null {
    if (node.isLeaf()) {
      return node;
    }

    let i = 0;
    while (i < node.keys.length && this.compare(key, node.keys[i]) >= 0) {
      i++;
    }

    return this.findLeafNode(node.children[i], key);
  }

  /**
   * 找到最左边的叶节点
   */
  private getLeftmostLeaf(node: BPlusTreeNode): BPlusTreeNode {
    if (node.isLeaf()) {
      return node;
    }
    return this.getLeftmostLeaf(node.children[0]);
  }

  /**
   * 计算 Levenshtein 距离（编辑距离）
   */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // 删除
            dp[i][j - 1] + 1,     // 插入
            dp[i - 1][j - 1] + 1  // 替换
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 删除知识项
   */
  delete(key: string): boolean {
    // 简化实现：标记删除
    const item = this.find(key);
    if (item) {
      // TODO: 实现真正的删除和节点合并
      this.size--;
      return true;
    }
    return false;
  }

  /**
   * 获取大小
   */
  getSize(): number {
    return this.size;
  }

  /**
   * 获取树高度
   */
  getHeight(): number {
    let height = 1;
    let node = this.root;
    while (!node.isLeaf()) {
      height++;
      node = node.children[0];
    }
    return height;
  }

  /**
   * 清空
   */
  clear(): void {
    this.root = new BPlusTreeNode(NodeType.LEAF);
    this.size = 0;
  }

  /**
   * 获取所有项
   */
  getAll(): KnowledgeItem[] {
    const items: KnowledgeItem[] = [];
    let leaf: BPlusTreeNode | null = this.getLeftmostLeaf(this.root);

    while (leaf) {
      items.push(...leaf.values);
      leaf = leaf.next;
    }

    return items;
  }
}

// ============ 知识存储 ============

/**
 * 知识存储（使用 B+ 树索引）
 */
export class KnowledgeStore {
  private index: BPlusTreeIndex;
  private idMap: Map<string, KnowledgeItem> = new Map();

  constructor(config?: Partial<BPlusTreeConfig>) {
    this.index = new BPlusTreeIndex(config);
  }

  /**
   * 添加知识
   */
  add(item: KnowledgeItem): void {
    this.index.insert(item);
    this.idMap.set(item.id, item);
  }

  /**
   * 批量添加
   */
  addBatch(items: KnowledgeItem[]): void {
    for (const item of items) {
      this.add(item);
    }
  }

  /**
   * 根据 ID 获取
   */
  getById(id: string): KnowledgeItem | undefined {
    return this.idMap.get(id);
  }

  /**
   * 根据键获取
   */
  getByKey(key: string): KnowledgeItem | undefined {
    return this.index.find(key);
  }

  /**
   * 前缀搜索
   */
  searchPrefix(prefix: string): SearchResult {
    return this.index.searchPrefix(prefix);
  }

  /**
   * 范围搜索
   */
  searchRange(start: string, end: string): SearchResult {
    return this.index.range(start, end);
  }

  /**
   * 模糊搜索
   */
  searchFuzzy(query: string, maxDistance?: number): SearchResult {
    return this.index.searchFuzzy(query, maxDistance);
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.index.getSize();
  }

  /**
   * 清空
   */
  clear(): void {
    this.index.clear();
    this.idMap.clear();
  }

  /**
   * 获取所有项
   */
  getAll(): KnowledgeItem[] {
    return this.index.getAll();
  }
}

// ============ 导出 ============

export default BPlusTreeIndex;
