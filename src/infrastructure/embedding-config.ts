/**
 * @file embedding-config.ts
 * @brief 向量模型配置
 * 
 * 当前配置: Qwen3-Embedding-8B (Gitee AI)
 */

// ============================================================
// 类型定义
// ============================================================

// OpenAI 类型定义（可选依赖）
type OpenAIType = {
    embeddings: {
        create: (params: any) => Promise<{ data: Array<{ embedding: number[] }> }>;
    };
};

export interface EmbeddingConfig {
    provider: string;
    model: string;
    baseUrl: string;
    apiKey: string;
    dimensions: number;
    maxTokens: number;
    supportsTruncation: boolean;
    supportedDimensions: number[];
}

// ============================================================
// Qwen3-Embedding-8B 配置 (Gitee AI)
// ============================================================

export const QWEN3_EMBEDDING_CONFIG: EmbeddingConfig = {
    provider: 'Gitee AI',
    model: 'Qwen3-Embedding-8B',
    baseUrl: 'https://ai.gitee.com/v1',
    apiKey: 'AQRCD9CQUJWWP2LICSJQV8CNRUXBEVVAKD7ZZJM8',
    dimensions: 4096,
    maxTokens: 32768,
    supportsTruncation: true,
    supportedDimensions: [768, 1024, 2048, 3072, 4096],
};

// ============================================================
// Embedding 客户端
// ============================================================

export class EmbeddingClient {
    private config: EmbeddingConfig;
    private client: OpenAIType | null = null;

    constructor(config: EmbeddingConfig = QWEN3_EMBEDDING_CONFIG) {
        this.config = config;
        this.initClient();
    }

    private async initClient(): Promise<void> {
        try {
            const OpenAI = (await import('openai')).default;
            this.client = new OpenAI({
                baseURL: this.config.baseUrl,
                apiKey: this.config.apiKey,
                defaultHeaders: { "X-Failover-Enabled": "true" },
            }) as OpenAIType;
        } catch (error) {
            console.warn('OpenAI SDK not installed, using fetch fallback');
        }
    }

    /**
     * 生成向量嵌入
     */
    async embed(text: string, dimensions?: number): Promise<Float32Array> {
        const dim = dimensions || this.config.dimensions;

        if (this.client) {
            const response = await this.client.embeddings.create({
                input: text,
                model: this.config.model,
                dimensions: dim,
            });

            const embedding = response.data[0].embedding;
            return new Float32Array(embedding);
        }

        // Fallback: 使用 fetch
        const response = await fetch(`${this.config.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
                'X-Failover-Enabled': 'true',
            },
            body: JSON.stringify({
                input: text,
                model: this.config.model,
                dimensions: dim,
            }),
        });

        const data = await response.json();
        return new Float32Array(data.data[0].embedding);
    }

    /**
     * 批量生成向量嵌入
     */
    async embedBatch(texts: string[], dimensions?: number): Promise<Float32Array[]> {
        const dim = dimensions || this.config.dimensions;

        if (this.client) {
            const response = await this.client.embeddings.create({
                input: texts,
                model: this.config.model,
                dimensions: dim,
            });

            return response.data.map((item: any) => new Float32Array(item.embedding));
        }

        // Fallback: 逐个处理
        const results: Float32Array[] = [];
        for (const text of texts) {
            const embedding = await this.embed(text, dim);
            results.push(embedding);
        }
        return results;
    }

    /**
     * 获取配置
     */
    getConfig(): EmbeddingConfig {
        return this.config;
    }

    /**
     * 设置维度
     */
    setDimensions(dimensions: number): void {
        if (!this.config.supportedDimensions.includes(dimensions)) {
            throw new Error(`Unsupported dimension: ${dimensions}. Supported: ${this.config.supportedDimensions.join(', ')}`);
        }
        this.config.dimensions = dimensions;
    }
}

// ============================================================
// 默认客户端
// ============================================================

let defaultClient: EmbeddingClient | null = null;

export function getEmbeddingClient(): EmbeddingClient {
    if (!defaultClient) {
        defaultClient = new EmbeddingClient(QWEN3_EMBEDDING_CONFIG);
    }
    return defaultClient;
}

export function createEmbeddingClient(config?: EmbeddingConfig): EmbeddingClient {
    return new EmbeddingClient(config || QWEN3_EMBEDDING_CONFIG);
}

// ============================================================
// 导出
// ============================================================

export default EmbeddingClient;
