/**
 * @file integration-demo.ts
 * @brief 实际项目集成演示
 * 
 * 演示元灵系统在实际场景中的应用：
 * 1. 文档搜索引擎
 * 2. 智能问答系统
 * 3. 推荐系统
 * 4. 语义缓存
 */

import { createYuanLing } from './infrastructure/api';
import { getMonitor } from './infrastructure/monitor';
import { getFeedbackSystem } from './infrastructure/feedback-learning';

// ============================================================
// 场景 1: 文档搜索引擎
// ============================================================

interface Document {
    id: string;
    title: string;
    content: string;
    tags: string[];
    createdAt: Date;
}

class DocumentSearchEngine {
    private api = createYuanLing({ dimensions: 512 });
    private documents: Map<string, Document> = new Map();

    /**
     * 添加文档
     */
    async addDocument(doc: Document): Promise<void> {
        // 生成文档嵌入（标题 + 内容）
        const text = `${doc.title} ${doc.content}`;
        const { vector } = await this.api.embed(text, 512);
        
        this.api.add(doc.id, vector);
        this.documents.set(doc.id, doc);
    }

    /**
     * 搜索文档
     */
    async search(query: string, topK: number = 10): Promise<Array<{ doc: Document; score: number }>> {
        const { vector } = await this.api.embed(query, 512);
        const results = this.api.search(vector, topK);

        return results.map(r => ({
            doc: this.documents.get(r.id)!,
            score: r.score,
        })).filter(r => r.doc);
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            totalDocuments: this.documents.size,
            ...this.api.getStats(),
        };
    }
}

// ============================================================
// 场景 2: 智能问答系统
// ============================================================

interface QA {
    question: string;
    answer: string;
    category: string;
}

class QASystem {
    private api = createYuanLing({ dimensions: 512 });
    private qaPairs: Map<string, QA> = new Map();

    /**
     * 添加问答对
     */
    async addQA(qa: QA): Promise<void> {
        const id = `qa_${this.qaPairs.size}`;
        const { vector } = await this.api.embed(qa.question, 512);
        
        this.api.add(id, vector);
        this.qaPairs.set(id, qa);
    }

    /**
     * 查找相似问题
     */
    async findSimilar(question: string, topK: number = 5): Promise<Array<{ qa: QA; score: number }>> {
        const { vector } = await this.api.embed(question, 512);
        const results = this.api.search(vector, topK);

        return results.map(r => ({
            qa: this.qaPairs.get(r.id)!,
            score: r.score,
        })).filter(r => r.qa);
    }

    /**
     * 获取答案
     */
    async getAnswer(question: string, threshold: number = 0.8): Promise<string | null> {
        const results = await this.findSimilar(question, 1);
        
        if (results.length > 0 && results[0].score >= threshold) {
            return results[0].qa.answer;
        }
        
        return null;
    }
}

// ============================================================
// 场景 3: 推荐系统
// ============================================================

interface Item {
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
}

class RecommendationEngine {
    private api = createYuanLing({ dimensions: 512 });
    private items: Map<string, Item> = new Map();
    private userPreferences: Map<string, Float32Array> = new Map();
    private feedback = getFeedbackSystem();

    /**
     * 添加物品
     */
    async addItem(item: Item): Promise<void> {
        const text = `${item.name} ${item.description} ${item.category}`;
        const { vector } = await this.api.embed(text, 512);
        
        this.api.add(item.id, vector);
        this.items.set(item.id, item);
    }

    /**
     * 记录用户行为
     */
    async recordUserAction(userId: string, itemId: string, action: 'view' | 'click' | 'purchase'): Promise<void> {
        const item = this.items.get(itemId);
        if (!item) return;

        const text = `${item.name} ${item.description}`;
        const { vector } = await this.api.embed(text, 512);

        // 更新用户偏好向量
        const currentPref = this.userPreferences.get(userId);
        if (currentPref) {
            // 加权平均
            const weight = action === 'purchase' ? 3 : action === 'click' ? 2 : 1;
            for (let i = 0; i < vector.length; i++) {
                currentPref[i] = (currentPref[i] + vector[i] * weight) / (1 + weight);
            }
        } else {
            this.userPreferences.set(userId, vector);
        }

        // 记录反馈
        this.feedback.recordClick(`user_${userId}`, itemId);
    }

    /**
     * 获取推荐
     */
    async getRecommendations(userId: string, topK: number = 10): Promise<Array<{ item: Item; score: number }>> {
        const userPref = this.userPreferences.get(userId);
        if (!userPref) {
            // 新用户：返回热门物品
            return Array.from(this.items.values())
                .slice(0, topK)
                .map(item => ({ item, score: 0.5 }));
        }

        const results = this.api.search(userPref, topK);
        return results.map(r => ({
            item: this.items.get(r.id)!,
            score: r.score,
        })).filter(r => r.item);
    }
}

// ============================================================
// 场景 4: 语义缓存
// ============================================================

interface CacheEntry<T> {
    query: string;
    result: T;
    timestamp: number;
    hitCount: number;
}

class SemanticCache<T> {
    private api = createYuanLing({ dimensions: 256 });
    private entries: Map<string, CacheEntry<T>> = new Map();
    private ttl: number;
    private threshold: number;

    constructor(ttl: number = 3600000, threshold: number = 0.95) {
        this.ttl = ttl;
        this.threshold = threshold;
    }

    /**
     * 获取缓存
     */
    async get(query: string): Promise<T | null> {
        const { vector } = await this.api.embed(query, 256);
        const results = this.api.search(vector, 1);

        if (results.length > 0 && results[0].score >= this.threshold) {
            const entry = this.entries.get(results[0].id);
            
            if (entry && Date.now() - entry.timestamp < this.ttl) {
                entry.hitCount++;
                return entry.result;
            }
        }

        return null;
    }

    /**
     * 设置缓存
     */
    async set(query: string, result: T): Promise<void> {
        const id = `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { vector } = await this.api.embed(query, 256);

        this.api.add(id, vector);
        this.entries.set(id, {
            query,
            result,
            timestamp: Date.now(),
            hitCount: 0,
        });
    }

    /**
     * 清理过期缓存
     */
    cleanup(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [id, entry] of this.entries) {
            if (now - entry.timestamp > this.ttl) {
                this.entries.delete(id);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * 获取统计
     */
    getStats() {
        let totalHits = 0;
        for (const entry of this.entries.values()) {
            totalHits += entry.hitCount;
        }

        return {
            totalEntries: this.entries.size,
            totalHits,
            avgHits: this.entries.size > 0 ? totalHits / this.entries.size : 0,
        };
    }
}

// ============================================================
// 演示运行
// ============================================================

async function runDemo() {
    // console.log('========================================');
    // console.log('  元灵系统实际项目集成演示');
    // console.log('========================================\n');

    // 场景 1: 文档搜索
    // console.log('【场景 1: 文档搜索引擎】\n');
    const docEngine = new DocumentSearchEngine();

    await docEngine.addDocument({
        id: 'doc1',
        title: '机器学习入门',
        content: '机器学习是人工智能的一个分支，它使计算机能够从数据中学习。',
        tags: ['AI', 'ML'],
        createdAt: new Date(),
    });

    await docEngine.addDocument({
        id: 'doc2',
        title: '深度学习基础',
        content: '深度学习使用神经网络进行特征学习和模式识别。',
        tags: ['AI', 'DL'],
        createdAt: new Date(),
    });

    const docResults = await docEngine.search('人工智能学习');
    // console.log('搜索 "人工智能学习":');
    docResults.forEach(r => {
        // console.log(`  - ${r.doc.title} (相似度: ${r.score.toFixed(3)})`);
    });
    // console.log('');

    // 场景 2: 智能问答
    // console.log('【场景 2: 智能问答系统】\n');
    const qaSystem = new QASystem();

    await qaSystem.addQA({
        question: '什么是机器学习？',
        answer: '机器学习是让计算机从数据中自动学习规律的技术。',
        category: 'AI基础',
    });

    await qaSystem.addQA({
        question: '深度学习有什么优势？',
        answer: '深度学习可以自动提取特征，处理复杂模式。',
        category: 'AI进阶',
    });

    const answer = await qaSystem.getAnswer('机器学习是什么？');
    // console.log('问题: 机器学习是什么？');
    // console.log(`答案: ${answer || '未找到答案'}\n`);

    // 场景 3: 推荐系统
    // console.log('【场景 3: 推荐系统】\n');
    const recommender = new RecommendationEngine();

    await recommender.addItem({
        id: 'item1',
        name: 'Python编程入门',
        description: '适合初学者的Python编程教程',
        category: '编程',
        price: 99,
    });

    await recommender.addItem({
        id: 'item2',
        name: '机器学习实战',
        description: '使用Python实现机器学习算法',
        category: 'AI',
        price: 199,
    });

    await recommender.recordUserAction('user1', 'item1', 'view');
    await recommender.recordUserAction('user1', 'item2', 'click');

    const recommendations = await recommender.getRecommendations('user1', 3);
    // console.log('用户 user1 的推荐:');
    recommendations.forEach(r => {
        // console.log(`  - ${r.item.name} (相似度: ${r.score.toFixed(3)})`);
    });
    // console.log('');

    // 场景 4: 语义缓存
    // console.log('【场景 4: 语义缓存】\n');
    const cache = new SemanticCache<string>(60000, 0.9);

    await cache.set('今天天气怎么样？', '今天天气晴朗，温度适宜。');
    
    const cachedResult = await cache.get('今天天气如何？');
    // console.log('查询: 今天天气如何？');
    // console.log(`缓存命中: ${cachedResult ? '是' : '否'}`);
    if (cachedResult) {
        // console.log(`结果: ${cachedResult}`);
    }
    // console.log('');

    // console.log('缓存统计:', cache.getStats());
    // console.log('');

    // console.log('========================================');
    // console.log('  演示完成');
    // console.log('========================================');
}

// 导出
export {
    DocumentSearchEngine,
    QASystem,
    RecommendationEngine,
    SemanticCache,
    runDemo,
};

// 运行演示
if (require.main === module) {
    runDemo().catch(console.error);
}
