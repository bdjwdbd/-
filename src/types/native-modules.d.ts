/**
 * @file native-modules.d.ts
 * @brief 原生模块类型声明
 */

declare module '../../native/build/Release/yuanling_native.node' {
    export function cosineSimilarity(a: Float32Array, b: Float32Array): number;
    export function cosineSimilarityBatch(query: Float32Array, vectors: Float32Array[], dim?: number): Float32Array;
    export function cosineSimilarityBatchContiguous(query: Float32Array, vectors: Float32Array, dim: number): Float32Array;
    export function topKSearch(query: Float32Array, vectors: Float32Array[], k: number): Array<{ index: number; score: number }>;
    export function topKSearchWithDim(query: Float32Array, vectors: Float32Array[], k: number, dim: number): Array<{ index: number; score: number }>;
    export function getSIMDCapabilities(): { avx2: boolean; avx512f: boolean; fma: boolean };
    export function getThreadCount(): number;
}

declare module '../../native/build/Release/parallel.node' {
    export function parallelSearch(query: Float32Array, vectors: Float32Array[], k: number, threads: number): Array<{ index: number; score: number }>;
    export function parallelBatch(queries: Float32Array[], vectors: Float32Array[], k: number, threads: number): Array<Array<{ index: number; score: number }>>;
    export function setThreadCount(count: number): void;
    export function getThreadCount(): number;
}

declare module '../../native/build/Release/int8.node' {
    export function quantize(vector: Float32Array): { data: Int8Array; scale: number };
    export function dequantize(data: Int8Array, scale: number): Float32Array;
    export function dotProductInt8(a: Int8Array, b: Int8Array): number;
    export function cosineSimilarityInt8(a: Int8Array, b: Int8Array, scaleA: number, scaleB: number): number;
}

declare module '../../native/build/Release/memory.node' {
    export function allocateHugePages(size: number): Buffer;
    export function freeHugePages(buffer: Buffer): void;
    export function getMemoryInfo(): { total: number; free: number; hugePagesAvailable: boolean };
    export function alignMemory(size: number, alignment: number): number;
}
