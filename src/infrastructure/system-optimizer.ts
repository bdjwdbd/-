/**
 * @file system-optimizer.ts
 * @brief 系统级性能优化
 * 
 * 功能：
 * 1. NUMA 亲和性优化
 * 2. 大页内存管理
 * 3. 缓存感知调度 (CAS)
 * 4. IRQ 中断隔离
 * 
 * 参考：llm-memory-integration v5.2.25
 */

import * as os from 'os';
import * as fs from 'fs';
import * as child_process from 'child_process';

// ============================================================
// 类型定义
// ============================================================

export interface NUMANode {
    id: number;
    cpus: number[];
    memory: number;
}

export interface NUMAConfig {
    available: boolean;
    nodes: NUMANode[];
    optimalNode: number;
}

export interface HugePageConfig {
    available: boolean;
    pageSize: number;
    totalPages: number;
    freePages: number;
    recommended: number;
}

export interface CASConfig {
    available: boolean;
    enabled: boolean;
    kernelVersion: string;
}

export interface IRQConfig {
    available: boolean;
    isolated: boolean;
    computeCpus: number[];
    irqCpus: number[];
}

export interface SystemOptimizationReport {
    numa: NUMAConfig;
    hugePage: HugePageConfig;
    cas: CASConfig;
    irq: IRQConfig;
    recommendations: string[];
}

// ============================================================
// NUMA 优化器
// ============================================================

export class NUMAOptimizer {
    private config: NUMAConfig | null = null;

    /**
     * 检查 NUMA 状态
     */
    checkStatus(): NUMAConfig {
        if (this.config) return this.config;

        const config: NUMAConfig = {
            available: false,
            nodes: [],
            optimalNode: 0,
        };

        try {
            // 检查是否支持 NUMA
            const cpus = os.cpus();
            const cpuCount = cpus.length;

            // 读取 NUMA 拓扑
            if (fs.existsSync('/sys/devices/system/node')) {
                const nodeDirs = fs.readdirSync('/sys/devices/system/node')
                    .filter(d => d.startsWith('node'));

                if (nodeDirs.length > 1) {
                    config.available = true;

                    for (const nodeDir of nodeDirs) {
                        const nodeId = parseInt(nodeDir.replace('node', ''));
                        const cpuListPath = `/sys/devices/system/node/${nodeDir}/cpulist`;
                        const memInfoPath = `/sys/devices/system/node/${nodeDir}/meminfo`;

                        let cpusForNode: number[] = [];
                        if (fs.existsSync(cpuListPath)) {
                            const cpuList = fs.readFileSync(cpuListPath, 'utf-8').trim();
                            cpusForNode = this.parseCpuList(cpuList);
                        }

                        let memory = 0;
                        if (fs.existsSync(memInfoPath)) {
                            const memInfo = fs.readFileSync(memInfoPath, 'utf-8');
                            const memTotal = memInfo.match(/MemTotal:\s+(\d+)\s+kB/);
                            if (memTotal) {
                                memory = parseInt(memTotal[1]) * 1024;
                            }
                        }

                        config.nodes.push({
                            id: nodeId,
                            cpus: cpusForNode,
                            memory,
                        });
                    }

                    // 选择最优节点（CPU 数量最多的）
                    config.optimalNode = config.nodes.reduce((best, node) =>
                        node.cpus.length > (config.nodes[best]?.cpus.length || 0) ? node.id : best
                        , 0);
                }
            }
        } catch (error) {
            // NUMA 不可用
        }

        this.config = config;
        return config;
    }

    /**
     * 解析 CPU 列表
     */
    private parseCpuList(list: string): number[] {
        const cpus: number[] = [];
        for (const part of list.split(',')) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    cpus.push(i);
                }
            } else {
                cpus.push(parseInt(part));
            }
        }
        return cpus;
    }

    /**
     * 获取 numactl 命令
     */
    getNumactlCommand(node?: number): string {
        const config = this.checkStatus();
        if (!config.available) return '';

        const targetNode = node ?? config.optimalNode;
        return `numactl --cpunodebind=${targetNode} --membind=${targetNode}`;
    }

    /**
     * 打印建议
     */
    printRecommendations(): void {
        const config = this.checkStatus();
        // console.log('\n=== NUMA 优化建议 ===\n');
        
        if (!config.available) {
            // console.log('NUMA 不可用（单节点系统或未启用）');
            return;
        }

        // console.log(`检测到 ${config.nodes.length} 个 NUMA 节点`);
        // console.log(`推荐使用节点: ${config.optimalNode}`);
        // console.log(`\n启动命令:`);
        // console.log(`  ${this.getNumactlCommand()} node your_script.js`);
    }
}

// ============================================================
// 大页内存管理器
// ============================================================

export class HugePageManager {
    private config: HugePageConfig | null = null;

    /**
     * 检查大页内存状态
     */
    checkStatus(): HugePageConfig {
        if (this.config) return this.config;

        const config: HugePageConfig = {
            available: false,
            pageSize: 0,
            totalPages: 0,
            freePages: 0,
            recommended: 0,
        };

        try {
            // 检查 2MB 大页
            if (fs.existsSync('/proc/meminfo')) {
                const memInfo = fs.readFileSync('/proc/meminfo', 'utf-8');

                const hugePagesTotal = memInfo.match(/HugePages_Total:\s+(\d+)/);
                const hugePagesFree = memInfo.match(/HugePages_Free:\s+(\d+)/);
                const hugePageSize = memInfo.match(/Hugepagesize:\s+(\d+)\s+kB/);

                if (hugePagesTotal && hugePageSize) {
                    config.available = parseInt(hugePagesTotal[1]) > 0;
                    config.pageSize = parseInt(hugePageSize[1]) * 1024; // 转换为字节
                    config.totalPages = parseInt(hugePagesTotal[1]);
                    config.freePages = hugePagesFree ? parseInt(hugePagesFree[1]) : 0;

                    // 推荐大页数量（基于系统内存）
                    const totalMemory = os.totalmem();
                    config.recommended = Math.floor(totalMemory / (config.pageSize * 10)); // 10% 内存
                }
            }
        } catch (error) {
            // 大页内存不可用
        }

        this.config = config;
        return config;
    }

    /**
     * 获取配置命令
     */
    getConfigCommand(pages: number): string {
        return `sudo sysctl -w vm.nr_hugepages=${pages}`;
    }

    /**
     * 打印建议
     */
    printRecommendations(): void {
        const config = this.checkStatus();
        // console.log('\n=== 大页内存优化建议 ===\n');

        if (!config.available) {
            // console.log('大页内存未配置');
            // console.log(`\n启用命令:`);
            // console.log(`  ${this.getConfigCommand(config.recommended || 1024)}`);
            return;
        }

        // console.log(`大页大小: ${config.pageSize / 1024 / 1024} MB`);
        // console.log(`总页数: ${config.totalPages}`);
        // console.log(`空闲页数: ${config.freePages}`);
        // console.log(`推荐页数: ${config.recommended}`);

        if (config.freePages < config.recommended) {
            // console.log(`\n⚠️ 空闲大页不足，建议增加:`);
            // console.log(`  ${this.getConfigCommand(config.recommended)}`);
        }
    }
}

// ============================================================
// 缓存感知调度器
// ============================================================

export class CacheAwareScheduler {
    private config: CASConfig | null = null;

    /**
     * 检查 CAS 状态
     */
    checkStatus(): CASConfig {
        if (this.config) return this.config;

        const config: CASConfig = {
            available: false,
            enabled: false,
            kernelVersion: os.release(),
        };

        try {
            // 检查内核版本（Linux 5.19+ 支持 CAS）
            const kernelParts = config.kernelVersion.split('.').map(Number);
            const major = kernelParts[0] || 0;
            const minor = kernelParts[1] || 0;

            config.available = major > 5 || (major === 5 && minor >= 19);

            // 检查 CAS 是否启用
            if (fs.existsSync('/proc/sys/kernel/sched_cache_aware')) {
                const enabled = fs.readFileSync('/proc/sys/kernel/sched_cache_aware', 'utf-8').trim();
                config.enabled = enabled === '1';
            }
        } catch (error) {
            // CAS 不可用
        }

        this.config = config;
        return config;
    }

    /**
     * 获取启用命令
     */
    getEnableCommand(): string {
        return 'sudo sysctl -w kernel.sched_cache_aware=1';
    }

    /**
     * 打印建议
     */
    printRecommendations(): void {
        const config = this.checkStatus();
        // console.log('\n=== 缓存感知调度 (CAS) 建议 ===\n');

        // console.log(`内核版本: ${config.kernelVersion}`);
        // console.log(`CAS 支持: ${config.available ? '✅' : '❌'}`);
        // console.log(`CAS 启用: ${config.enabled ? '✅' : '❌'}`);

        if (config.available && !config.enabled) {
            // console.log(`\n启用命令:`);
            // console.log(`  ${this.getEnableCommand()}`);
        }
    }
}

// ============================================================
// IRQ 隔离器
// ============================================================

export class IRQIsolator {
    private config: IRQConfig | null = null;

    /**
     * 检查 IRQ 隔离状态
     */
    checkStatus(): IRQConfig {
        if (this.config) return this.config;

        const config: IRQConfig = {
            available: false,
            isolated: false,
            computeCpus: [],
            irqCpus: [],
        };

        try {
            const cpus = os.cpus();
            const cpuCount = cpus.length;

            // 检查 isolcpus 内核参数
            if (fs.existsSync('/proc/cmdline')) {
                const cmdline = fs.readFileSync('/proc/cmdline', 'utf-8');
                const isolcpus = cmdline.match(/isolcpus=([0-9,\-]+)/);

                if (isolcpus) {
                    config.available = true;
                    config.isolated = true;
                    config.computeCpus = this.parseCpuList(isolcpus[1]);
                    config.irqCpus = Array.from({ length: cpuCount }, (_, i) => i)
                        .filter(i => !config.computeCpus.includes(i));
                }
            }

            // 如果没有隔离，提供默认建议
            if (!config.isolated && cpuCount >= 4) {
                config.available = true;
                // 建议：前 2 个 CPU 用于 IRQ，其余用于计算
                config.irqCpus = [0, 1];
                config.computeCpus = Array.from({ length: cpuCount - 2 }, (_, i) => i + 2);
            }
        } catch (error) {
            // IRQ 隔离不可用
        }

        this.config = config;
        return config;
    }

    /**
     * 解析 CPU 列表
     */
    private parseCpuList(list: string): number[] {
        const cpus: number[] = [];
        for (const part of list.split(',')) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    cpus.push(i);
                }
            } else {
                cpus.push(parseInt(part));
            }
        }
        return cpus;
    }

    /**
     * 获取 taskset 命令
     */
    getTasksetCommand(): string {
        const config = this.checkStatus();
        if (!config.available || config.computeCpus.length === 0) return '';

        const cpuList = config.computeCpus.join(',');
        return `taskset -c ${cpuList}`;
    }

    /**
     * 获取内核参数
     */
    getKernelParameters(): string {
        const config = this.checkStatus();
        if (!config.available || config.computeCpus.length === 0) return '';

        const computeCpus = config.computeCpus.join(',');
        return `isolcpus=${computeCpus} nohz_full=${computeCpus} rcu_nocbs=${computeCpus}`;
    }

    /**
     * 打印建议
     */
    printRecommendations(): void {
        const config = this.checkStatus();
        // console.log('\n=== IRQ 中断隔离建议 ===\n');

        if (!config.available) {
            // console.log('IRQ 隔离不可用（CPU 数量不足）');
            return;
        }

        // console.log(`计算 CPU: ${config.computeCpus.join(', ')}`);
        // console.log(`IRQ CPU: ${config.irqCpus.join(', ')}`);
        // console.log(`当前隔离: ${config.isolated ? '✅' : '❌'}`);

        if (!config.isolated) {
            // console.log(`\n内核参数（添加到 /etc/default/grub）:`);
            // console.log(`  GRUB_CMDLINE_LINUX="... ${this.getKernelParameters()}"`);
            // console.log(`\n启动命令:`);
            // console.log(`  ${this.getTasksetCommand()} node your_script.js`);
        }
    }
}

// ============================================================
// 系统优化器（统一入口）
// ============================================================

export class SystemOptimizer {
    private numaOptimizer: NUMAOptimizer;
    private hugePageManager: HugePageManager;
    private casScheduler: CacheAwareScheduler;
    private irqIsolator: IRQIsolator;

    constructor() {
        this.numaOptimizer = new NUMAOptimizer();
        this.hugePageManager = new HugePageManager();
        this.casScheduler = new CacheAwareScheduler();
        this.irqIsolator = new IRQIsolator();
    }

    /**
     * 获取完整报告
     */
    getReport(): SystemOptimizationReport {
        const numa = this.numaOptimizer.checkStatus();
        const hugePage = this.hugePageManager.checkStatus();
        const cas = this.casScheduler.checkStatus();
        const irq = this.irqIsolator.checkStatus();

        const recommendations: string[] = [];

        if (numa.available) {
            recommendations.push(`NUMA: 使用节点 ${numa.optimalNode}`);
        }

        if (!hugePage.available || hugePage.freePages < hugePage.recommended) {
            recommendations.push(`大页内存: 配置 ${hugePage.recommended} 个大页`);
        }

        if (cas.available && !cas.enabled) {
            recommendations.push('CAS: 启用缓存感知调度');
        }

        if (irq.available && !irq.isolated) {
            recommendations.push('IRQ: 配置中断隔离');
        }

        return { numa, hugePage, cas, irq, recommendations };
    }

    /**
     * 获取优化启动命令
     */
    getOptimizedCommand(command: string): string {
        const parts: string[] = [];

        // NUMA 绑定
        const numaCmd = this.numaOptimizer.getNumactlCommand();
        if (numaCmd) parts.push(numaCmd);

        // CPU 绑定
        const tasksetCmd = this.irqIsolator.getTasksetCommand();
        if (tasksetCmd) parts.push(tasksetCmd);

        parts.push(command);
        return parts.join(' ');
    }

    /**
     * 打印完整报告
     */
    printReport(): void {
        // console.log('========================================');
        // console.log('  系统级性能优化报告');
        // console.log('========================================');

        this.numaOptimizer.printRecommendations();
        this.hugePageManager.printRecommendations();
        this.casScheduler.printRecommendations();
        this.irqIsolator.printRecommendations();

        const report = this.getReport();

        // console.log('\n========================================');
        // console.log('  优化建议汇总');
        // console.log('========================================\n');

        if (report.recommendations.length === 0) {
            // console.log('✅ 系统已优化');
        } else {
            report.recommendations.forEach((rec, i) => {
                // console.log(`${i + 1}. ${rec}`);
            });
        }

        // console.log(`\n优化启动命令:`);
        // console.log(`  ${this.getOptimizedCommand('node your_script.js')}`);
    }
}

// ============================================================
// 单例
// ============================================================

let defaultOptimizer: SystemOptimizer | null = null;

export function getSystemOptimizer(): SystemOptimizer {
    if (!defaultOptimizer) {
        defaultOptimizer = new SystemOptimizer();
    }
    return defaultOptimizer;
}

// ============================================================
// 导出
// ============================================================

export default {
    NUMAOptimizer,
    HugePageManager,
    CacheAwareScheduler,
    IRQIsolator,
    SystemOptimizer,
    getSystemOptimizer,
};
