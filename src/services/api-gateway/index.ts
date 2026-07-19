import express, { Request, Response } from 'express';
import cors from 'cors';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import axios from 'axios';
import { createServer } from 'http';

const app = express();
app.use(cors());

// Don't use express.json() here globally because it interferes with proxying POST requests.
// We just forward raw requests.

const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:4000';
let routingTable: Record<string, string> = {};

// Fetch routing table from Registry
async function updateRoutingTable() {
  try {
    const { data } = await axios.get(`${REGISTRY_URL}/services`);
    const newRouting: Record<string, string> = {};
    for (const service of data) {
      newRouting[service.name] = `http://${service.host}:${service.port}`;
    }
    routingTable = newRouting;
  } catch (error) {
    console.log('[Gateway] Could not reach Service Registry. Retrying...');
  }
}

// Update routing table frequently so service routes recover quickly
setInterval(updateRoutingTable, 2000);
updateRoutingTable();

// Dynamic proxy middleware generator with error handling and timeout
const dynamicProxy = (serviceName: string): RequestHandler => {
  return createProxyMiddleware({
    router: () => {
      if (!routingTable[serviceName]) {
        return '';
      }
      return routingTable[serviceName];
    },
    changeOrigin: true,
    proxyReqOptDecorator: (proxyReqOpts: any) => {
      proxyReqOpts.timeout = 8000;
      return proxyReqOpts;
    },
    onError: (err: any, req: any, res: any) => {
      console.error(`[Gateway] Proxy error for ${serviceName}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: `Servicio ${serviceName} no disponible`, service: serviceName });
      }
    }
  } as any);
};

// Proxy instances (created once)
const authProxy = dynamicProxy('auth-service');
const patientProxy = dynamicProxy('patient-service');
const sessionProxy = dynamicProxy('session-service');
const telemetryProxy = dynamicProxy('telemetry-service');

// Map routes to microservices
app.use('/api/auth', (req, res, next) => { req.url = req.originalUrl; authProxy(req, res, next); });
app.use('/api/patients', (req, res, next) => { req.url = req.originalUrl; patientProxy(req, res, next); });
app.use('/api/sessions', (req, res, next) => { req.url = req.originalUrl; sessionProxy(req, res, next); });
app.use('/api/telemetry', (req, res, next) => { req.url = req.originalUrl; telemetryProxy(req, res, next); });
app.use('/api/stats', (req, res, next) => { req.url = req.originalUrl; telemetryProxy(req, res, next); });

// Health check for Gateway
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'API Gateway', activeServices: routingTable });
});

// Create HTTP server (for WebSocket proxying)
const httpServer = createServer(app);

// Proxy WebSockets to Telemetry Service
const wsProxy = createProxyMiddleware({
  router: () => {
    if (!routingTable['telemetry-service']) {
      return '';
    }
    return routingTable['telemetry-service'];
  },
  ws: true,
  changeOrigin: true,
  onError: (err: any, _req: any, _res: any) => {
    console.error(`[Gateway] WS proxy error:`, err.message);
  }
} as any);
httpServer.on('upgrade', wsProxy.upgrade!);

const PORT = process.env.GATEWAY_PORT || 3001; // Keeping 3001 so frontend doesn't change
httpServer.listen(PORT, () => {
  console.log(`\n======================================`);
  console.log(`🌍 API Gateway running on port ${PORT}`);
  console.log(`======================================\n`);
});
