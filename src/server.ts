/**
 * @file server.ts
 * @brief HTTP 服务器 - 提供 REST API
 */

import * as http from 'http';
import { createYuanLing, YuanLingAPI } from './infrastructure/api';

// ============================================================
// 配置
// ============================================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ============================================================
// API 服务器
// ============================================================

class YuanLingServer {
    private api: YuanLingAPI;
    private server: http.Server;

    constructor() {
        this.api = createYuanLing({
            dimensions: 1024,
            useParallel: true,
            threadCount: 4,
        });

        this.server = http.createServer(this.handleRequest.bind(this));
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = req.url || '/';
        const method = req.method || 'GET';

        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        try {
            // 路由
            if (url === '/health' && method === 'GET') {
                this.handleHealth(res);
            } else if (url === '/info' && method === 'GET') {
                this.handleInfo(res);
            } else if (url === '/embed' && method === 'POST') {
                await this.handleEmbed(req, res);
            } else if (url === '/search' && method === 'POST') {
                await this.handleSearch(req, res);
            } else if (url === '/add' && method === 'POST') {
                await this.handleAdd(req, res);
            } else {
                this.sendError(res, 404, 'Not Found');
            }
        } catch (error: any) {
            this.sendError(res, 500, error.message);
        }
    }

    // ============================================================
    // 处理器
    // ============================================================

    private handleHealth(res: http.ServerResponse) {
        this.sendJson(res, { status: 'ok', timestamp: Date.now() });
    }

    private handleInfo(res: http.ServerResponse) {
        const info = this.api.getInfo();
        const stats = this.api.getStats();
        this.sendJson(res, { ...info, ...stats });
    }

    private async handleEmbed(req: http.IncomingMessage, res: http.ServerResponse) {
        const body = await this.readBody(req);
        const { text, dimensions } = JSON.parse(body);

        const result = await this.api.embed(text, dimensions);
        this.sendJson(res, {
            dimensions: result.dimensions,
            vector: Array.from(result.vector),
            truncated: result.truncated,
        });
    }

    private async handleSearch(req: http.IncomingMessage, res: http.ServerResponse) {
        const body = await this.readBody(req);
        const { text, k = 10 } = JSON.parse(body);

        const results = await this.api.searchText(text, k);
        this.sendJson(res, { results });
    }

    private async handleAdd(req: http.IncomingMessage, res: http.ServerResponse) {
        const body = await this.readBody(req);
        const { id, vector } = JSON.parse(body);

        this.api.add(id, new Float32Array(vector));
        this.sendJson(res, { success: true, id });
    }

    // ============================================================
    // 工具方法
    // ============================================================

    private readBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    private sendJson(res: http.ServerResponse, data: any) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    }

    private sendError(res: http.ServerResponse, code: number, message: string) {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
    }

    // ============================================================
    // 启动
    // ============================================================

    start() {
        this.server.listen(Number(PORT), HOST, () => {
            // console.log(`========================================`);
            // console.log(`  元灵系统 v4.3.0 API 服务器`);
            // console.log(`========================================`);
            // console.log(`  地址: http://${HOST}:${PORT}`);
            // console.log(`  端点:`);
            // console.log(`    GET  /health - 健康检查`);
            // console.log(`    GET  /info    - 系统信息`);
            // console.log(`    POST /embed   - 生成向量`);
            // console.log(`    POST /search  - 搜索`);
            // console.log(`    POST /add     - 添加向量`);
            // console.log(`========================================`);
        });
    }
}

// ============================================================
// 启动服务器
// ============================================================

const server = new YuanLingServer();
server.start();
