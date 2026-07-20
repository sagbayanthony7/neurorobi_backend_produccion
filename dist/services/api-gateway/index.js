"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const axios_1 = __importDefault(require("axios"));
const http_1 = require("http");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Don't use express.json() here globally because it interferes with proxying POST requests.
// We just forward raw requests.
const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:4000';
let routingTable = {};
// Fetch routing table from Registry
async function updateRoutingTable() {
    try {
        const { data } = await axios_1.default.get(`${REGISTRY_URL}/services`);
        const newRouting = {};
        for (const service of data) {
            newRouting[service.name] = `http://${service.host}:${service.port}`;
        }
        routingTable = newRouting;
    }
    catch (error) {
        console.log('[Gateway] Could not reach Service Registry. Retrying...');
    }
}
// Update routing table frequently so service routes recover quickly
setInterval(updateRoutingTable, 2000);
updateRoutingTable();
// Dynamic proxy middleware generator with error handling and timeout
const dynamicProxy = (serviceName) => {
    return (0, http_proxy_middleware_1.createProxyMiddleware)({
        router: () => {
            if (!routingTable[serviceName]) {
                return '';
            }
            return routingTable[serviceName];
        },
        changeOrigin: true,
        proxyReqOptDecorator: (proxyReqOpts) => {
            proxyReqOpts.timeout = 8000;
            return proxyReqOpts;
        },
        onError: (err, req, res) => {
            console.error(`[Gateway] Proxy error for ${serviceName}:`, err.message);
            if (!res.headersSent) {
                res.status(502).json({ error: `Servicio ${serviceName} no disponible`, service: serviceName });
            }
        }
    });
};
// Socket.IO needs long-polling HTTP route WITHOUT the 8s timeout
const socketIoProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    router: () => {
        if (!routingTable['telemetry-service'])
            return '';
        return routingTable['telemetry-service'];
    },
    changeOrigin: true,
    pathFilter: '/socket.io',
    onError: (err, req, res) => {
        console.error('[Gateway] Socket.IO HTTP proxy error:', err.message);
        if (!res.headersSent) {
            res.status(502).json({ error: 'Socket.IO service unavailable' });
        }
    }
});
// Proxy instances (created once)
const authProxy = dynamicProxy('auth-service');
const patientProxy = dynamicProxy('patient-service');
const sessionProxy = dynamicProxy('session-service');
const telemetryProxy = dynamicProxy('telemetry-service');
// Socket.IO HTTP route (must be before other routes)
app.use('/socket.io', socketIoProxy);
// Map routes to microservices
app.use('/api/auth', (req, res, next) => { req.url = req.originalUrl; authProxy(req, res, next); });
app.use('/api/patients', (req, res, next) => { req.url = req.originalUrl; patientProxy(req, res, next); });
app.use('/api/sessions', (req, res, next) => { req.url = req.originalUrl; sessionProxy(req, res, next); });
app.use('/api/telemetry', (req, res, next) => { req.url = req.originalUrl; telemetryProxy(req, res, next); });
app.use('/api/stats', (req, res, next) => { req.url = req.originalUrl; telemetryProxy(req, res, next); });
// Health check for Gateway
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'API Gateway', version: 'v2-base64-json', activeServices: routingTable });
});
// Create HTTP server (for WebSocket proxying)
const httpServer = (0, http_1.createServer)(app);
// Proxy WebSockets to Telemetry Service
const wsProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    router: () => {
        if (!routingTable['telemetry-service']) {
            return '';
        }
        return routingTable['telemetry-service'];
    },
    ws: true,
    changeOrigin: true,
    onError: (err, _req, _res) => {
        console.error(`[Gateway] WS proxy error:`, err.message);
    }
});
httpServer.on('upgrade', wsProxy.upgrade);
const PORT = process.env.GATEWAY_PORT || 3001; // Keeping 3001 so frontend doesn't change
httpServer.listen(PORT, () => {
    console.log(`\n======================================`);
    console.log(`🌍 API Gateway running on port ${PORT}`);
    console.log(`======================================\n`);
});
//# sourceMappingURL=index.js.map