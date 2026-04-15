/**
 * @file webgpu-accelerator.ts
 * @brief WebGPU 加速模块
 * 
 * 功能：
 * 1. 使用 WebGPU API 进行 GPU 计算
 * 2. 比 WebGL (gpu.js) 更高效
 * 3. 支持计算着色器
 */

// ============================================================
// 类型定义
// ============================================================

export interface WebGPUConfig {
    device?: GPUDevice;
    powerPreference?: 'low-power' | 'high-performance';
}

export interface WebGPUSearchResult {
    index: number;
    score: number;
}

// ============================================================
// WebGPU 加速器
// ============================================================

export class WebGPUAccelerator {
    private device: GPUDevice | null = null;
    private adapter: GPUAdapter | null = null;
    private initialized = false;

    /**
     * 初始化 WebGPU
     */
    async initialize(config: WebGPUConfig = {}): Promise<boolean> {
        if (config.device) {
            this.device = config.device;
            this.initialized = true;
            return true;
        }

        // 检查 WebGPU 支持
        if (!navigator.gpu) {
            console.warn('WebGPU not supported');
            return false;
        }

        try {
            // 获取适配器
            this.adapter = await navigator.gpu.requestAdapter({
                powerPreference: config.powerPreference || 'high-performance'
            });

            if (!this.adapter) {
                console.warn('No GPU adapter found');
                return false;
            }

            // 获取设备
            this.device = await this.adapter.requestDevice();
            this.initialized = true;

            console.log('WebGPU initialized successfully');
            return true;
        } catch (error) {
            console.error('WebGPU initialization failed:', error);
            return false;
        }
    }

    /**
     * 创建余弦相似度计算着色器
     */
    private createCosineSimilarityShader(dim: number): GPUShaderModule {
        if (!this.device) throw new Error('WebGPU not initialized');

        const shaderCode = `
            struct Vector {
                data: array<f32, ${dim}>
            };

            struct Result {
                score: f32
            };

            @group(0) @binding(0) var<storage, read> query: Vector;
            @group(0) @binding(1) var<storage, read> vectors: array<Vector>;
            @group(0) @binding(2) var<storage, read_write> results: array<Result>;

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let idx = global_id.x;
                if (idx >= arrayLength(&vectors)) {
                    return;
                }

                var dot: f32 = 0.0;
                var norm_query: f32 = 0.0;
                var norm_vec: f32 = 0.0;

                for (var i: u32 = 0u; i < ${dim}u; i = i + 1u) {
                    let q = query.data[i];
                    let v = vectors[idx].data[i];
                    dot = dot + q * v;
                    norm_query = norm_query + q * q;
                    norm_vec = norm_vec + v * v;
                }

                results[idx].score = dot / (sqrt(norm_query) * sqrt(norm_vec) + 0.0000001);
            }
        `;

        return this.device.createShaderModule({ code: shaderCode });
    }

    /**
     * 批量余弦相似度计算
     */
    async cosineSimilarityBatch(
        query: Float32Array,
        vectors: Float32Array[],
        dim: number
    ): Promise<Float32Array> {
        if (!this.initialized || !this.device) {
            throw new Error('WebGPU not initialized');
        }

        const numVectors = vectors.length;

        // 创建缓冲区
        const queryBuffer = this.device.createBuffer({
            size: dim * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(queryBuffer, 0, query);

        // 合并所有向量
        const allVectors = new Float32Array(numVectors * dim);
        for (let i = 0; i < numVectors; i++) {
            allVectors.set(vectors[i], i * dim);
        }

        const vectorsBuffer = this.device.createBuffer({
            size: allVectors.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(vectorsBuffer, 0, allVectors);

        // 结果缓冲区
        const resultsBuffer = this.device.createBuffer({
            size: numVectors * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        // 创建着色器
        const shaderModule = this.createCosineSimilarityShader(dim);

        // 创建绑定组布局
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });

        // 创建绑定组
        const bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: queryBuffer } },
                { binding: 1, resource: { buffer: vectorsBuffer } },
                { binding: 2, resource: { buffer: resultsBuffer } },
            ],
        });

        // 创建计算管线
        const computePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            compute: { module: shaderModule, entryPoint: 'main' },
        });

        // 执行计算
        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(Math.ceil(numVectors / 64));
        computePass.end();

        // 读取结果
        const readBuffer = this.device.createBuffer({
            size: numVectors * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
        commandEncoder.copyBufferToBuffer(resultsBuffer, 0, readBuffer, 0, numVectors * 4);

        this.device.queue.submit([commandEncoder.finish()]);

        // 等待结果
        await readBuffer.mapAsync(GPUMapMode.READ);
        const results = new Float32Array(readBuffer.getMappedRange().slice(0));
        readBuffer.unmap();

        // 清理
        queryBuffer.destroy();
        vectorsBuffer.destroy();
        resultsBuffer.destroy();
        readBuffer.destroy();

        return results;
    }

    /**
     * 搜索
     */
    async search(
        query: Float32Array,
        vectors: Float32Array[],
        dim: number,
        k: number
    ): Promise<WebGPUSearchResult[]> {
        const scores = await this.cosineSimilarityBatch(query, vectors, dim);

        const results: WebGPUSearchResult[] = scores.map((score, index) => ({
            index,
            score,
        }));

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, k);
    }

    /**
     * 获取 GPU 信息
     */
    getInfo(): {
        initialized: boolean;
        adapter: GPUAdapter | null;
        device: GPUDevice | null;
    } {
        return {
            initialized: this.initialized,
            adapter: this.adapter,
            device: this.device,
        };
    }

    /**
     * 销毁
     */
    destroy(): void {
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }
        this.adapter = null;
        this.initialized = false;
    }
}

// ============================================================
// Node.js 环境兼容层
// ============================================================

/**
 * 检查 WebGPU 是否可用
 */
export async function isWebGPUAvailable(): Promise<boolean> {
    // 浏览器环境
    if (typeof navigator !== 'undefined' && navigator.gpu) {
        return true;
    }

    // Node.js 环境（需要 @webgpu/webgpu 包）
    try {
        const { default: webgpu } = await import('@webgpu/webgpu');
        return true;
    } catch {
        return false;
    }
}

/**
 * 创建 WebGPU 加速器
 */
export async function createWebGPUAccelerator(config?: WebGPUConfig): Promise<WebGPUAccelerator | null> {
    const accelerator = new WebGPUAccelerator();
    const success = await accelerator.initialize(config);
    
    if (success) {
        return accelerator;
    }
    
    return null;
}

// ============================================================
// 导出
// ============================================================

export default WebGPUAccelerator;
