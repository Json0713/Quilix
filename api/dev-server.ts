/**
 * @file api/dev-server.ts
 * @description
 * Lightweight local dev server that wraps the Vercel serverless function
 * so it can be tested during `ng serve` development.
 *
 * Run with: npx tsx api/dev-server.ts
 * Angular's proxy.conf.json forwards /api/* → http://localhost:3001
 */

import http from 'node:http';
import handler from './chat';

const PORT = 3001;

const server = http.createServer(async (req, res) => {
    // Only handle /api/chat
    if (req.url !== '/api/chat') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    // Parse request body
    let body = '';
    for await (const chunk of req) {
        body += chunk;
    }

    // Build a Vercel-compatible request/response shim
    const vercelReq = Object.assign(req, {
        body: body ? JSON.parse(body) : {},
    }) as any;

    const vercelRes = Object.assign(res, {
        status(code: number) {
            res.statusCode = code;
            return {
                json(data: any) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                },
                end() {
                    res.end();
                },
            };
        },
    }) as any;

    try {
        await handler(vercelReq, vercelRes);
    } catch (err) {
        console.error('[dev-server] Handler error:', err);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }
});

server.listen(PORT, () => {
    console.log(`\n  🤖 Quilix API dev server running at http://localhost:${PORT}/api/chat\n`);
});
