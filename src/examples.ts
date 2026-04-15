/**
 * @file examples.ts
 * @brief 元灵系统实际应用示例
 * 
 * 展示如何在实际项目中使用元灵系统
 */

import { createYuanLing, YuanLingAPI } from './infrastructure/api';

// ============================================================
// 示例 1: 文档相似度搜索
// ============================================================

interface Document {
    id: string;
    title: string;
    content: string;
    vector?: Float32Array;
}

export class DocumentSearchEngine {
    private api: YuanLingAPI;
    private documents: Map<string, Document> = new Map();

    constructor() {
        this.api = createYuanLing({
            dimensions: 1024,
            useParallel: true,
            threadCount: 4,
        });
    }

    /**
     * 添加文档
     */
    async addDocument(doc: Document): Promise<void> {
        // 生成向量
        const { vector } = await this.api.embed(doc.content);
        doc.vector = vector;

        // 存储
        this.documents.set(doc.id, doc);
        this.api.add(doc.id, vector);
    }

    /**
     * 批量添加
     */
    async addDocuments(docs: Document[]): Promise<void> {
        for (const doc of docs) {
            await this.addDocument(doc);
        }
    }

    /**
     * 搜索相似文档
     */
    async search(query: string, topK: number = 5): Promise<Array<{ doc: Document; score: number }>> {
        const { vector } = await this.api.embed(query);
        const results = this.api.search(vector, topK);

        return results.map(r => ({
            doc: this.documents.get(r.id)!,
            score: r.score,
        }));
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            documentCount: this.documents.size,
            ...this.api.getStats(),
        };
    }
}

// ============================================================
// 示例 2: 问答系统
// ============================================================

interface QA {
    question: string;
    answer: string;
    vector?: Float32Array;
}

export class QASystem {
    private api: YuanLingAPI;
    private qaList: QA[] = [];

    constructor() {
        this.api = createYuanLing({
            dimensions: 1024,
        });
    }

    /**
     * 添加问答对
     */
    async addQA(question: string, answer: string): Promise<void> {
        const { vector } = await this.api.embed(question);
        this.qaList.push({ question, answer, vector });
        this.api.add(`qa_${this.qaList.length - 1}`, vector);
    }

    /**
     * 提问
     */
    async ask(question: string): Promise<string | null> {
        const { vector } = await this.api.embed(question);
        const results = this.api.search(vector, 1);

        if (results.length > 0 && results[0].score > 0.8) {
            const idx = parseInt(results[0].id.replace('qa_', ''));
            return this.qaList[idx]?.answer || null;
        }

        return null;
    }
}

// ============================================================
// 示例 3: 推荐系统
// ============================================================

interface Item {
    id: string;
    name: string;
    description: string;
    tags: string[];
    vector?: Float32Array;
}

export class RecommendationEngine {
    private api: YuanLingAPI;
    private items: Map<string, Item> = new Map();

    constructor() {
        this.api = createYuanLing({
            dimensions: 1024,
            useParallel: true,
        });
    }

    /**
     * 添加物品
     */
    async addItem(item: Item): Promise<void> {
        // 组合描述和标签
        const text = `${item.name} ${item.description} ${item.tags.join(' ')}`;
        const { vector } = await this.api.embed(text);
        item.vector = vector;

        this.items.set(item.id, item);
        this.api.add(item.id, vector);
    }

    /**
     * 获取推荐
     */
    async getRecommendations(query: string, topK: number = 10): Promise<Array<{ item: Item; score: number }>> {
        const { vector } = await this.api.embed(query);
        const results = this.api.search(vector, topK);

        return results.map(r => ({
            item: this.items.get(r.id)!,
            score: r.score,
        }));
    }

    /**
     * 相似物品推荐
     */
    async getSimilarItems(itemId: string, topK: number = 5): Promise<Array<{ item: Item; score: number }>> {
        const item = this.items.get(itemId);
        if (!item || !item.vector) return [];

        const results = this.api.search(item.vector, topK + 1);
        
        return results
            .filter(r => r.id !== itemId)
            .slice(0, topK)
            .map(r => ({
                item: this.items.get(r.id)!,
                score: r.score,
            }));
    }
}

// ============================================================
// 示例 4: 语义缓存
// ============================================================

interface CacheEntry<T> {
    query: string;
    result: T;
    vector: Float32Array;
    timestamp: number;
}

export class SemanticCache<T> {
    private api: YuanLingAPI;
    private cache: CacheEntry<T>[] = [];
    private threshold: number;

    constructor(threshold: number = 0.95) {
        this.api = createYuanLing({ dimensions: 1024 });
        this.threshold = threshold;
    }

    /**
     * 获取缓存
     */
    async get(query: string): Promise<T | null> {
        const { vector } = await this.api.embed(query);

        for (const entry of this.cache) {
            const similarity = this.api.cosineSimilarity(vector, entry.vector);
            if (similarity >= this.threshold) {
                return entry.result;
            }
        }

        return null;
    }

    /**
     * 设置缓存
     */
    async set(query: string, result: T): Promise<void> {
        const { vector } = await this.api.embed(query);
        this.cache.push({
            query,
            result,
            vector,
            timestamp: Date.now(),
        });
    }

    /**
     * 清理过期缓存
     */
    cleanup(maxAge: number = 3600000): void {
        const now = Date.now();
        this.cache = this.cache.filter(e => now - e.timestamp < maxAge);
    }
}

// ============================================================
// 使用示例
// ============================================================

async function demo() {
    // console.log('========================================');
    // console.log('  元灵系统应用示例');
    // console.log('========================================\n');

    // 示例 1: 文档搜索
    // console.log('【示例 1: 文档搜索】');
    const docEngine = new DocumentSearchEngine();
    
    await docEngine.addDocument({
        id: 'doc1',
        title: '机器学习入门',
        content: '机器学习是人工智能的一个分支，它使计算机能够从数据中学习。',
    });
    
    await docEngine.addDocument({
        id: 'doc2',
        title: '深度学习基础',
        content: '深度学习使用神经网络来学习数据的表示。',
    });

    const results = await docEngine.search('什么是人工智能');
    // console.log('搜索结果:', results.map(r => r.doc.title));
    // console.log();

    // 示例 2: 问答系统
    // console.log('【示例 2: 问答系统】');
    const qa = new QASystem();
    
    await qa.addQA('什么是元灵系统', '元灵系统是一个高性能向量搜索引擎');
    await qa.addQA('如何使用', '通过 createYuanLing() 创建实例');

    const answer = await qa.ask('元灵系统是什么');
    // console.log('回答:', answer);
    // console.log();

    // console.log('========================================');
    // console.log('  示例完成');
    // console.log('========================================');
}

// 导出
export { demo };

// 如果直接运行
if (require.main === module) {
    demo().catch(console.error);
}
