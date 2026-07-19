"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const services = new Map();
// Clean up dead services every 10 seconds
setInterval(() => {
    const now = Date.now();
    for (const [name, info] of services.entries()) {
        if (now - info.lastHeartbeat > 15000) {
            console.log(`[Registry] Service ${name} is dead. Removing...`);
            services.delete(name);
        }
    }
}, 10000);
app.post('/register', (req, res) => {
    const { name, host, port } = req.body;
    if (!name || !host || !port) {
        return res.status(400).json({ error: 'Missing service info' });
    }
    services.set(name, {
        name,
        host,
        port,
        lastHeartbeat: Date.now()
    });
    console.log(`[Registry] Registered/Heartbeat: ${name} at ${host}:${port}`);
    res.json({ message: 'Registered successfully' });
});
app.get('/services', (req, res) => {
    res.json(Array.from(services.values()));
});
app.get('/services/:name', (req, res) => {
    const name = String(req.params.name);
    const service = services.get(name);
    if (service) {
        res.json(service);
    }
    else {
        res.status(404).json({ error: 'Service not found' });
    }
});
const PORT = process.env.REGISTRY_PORT || 4000;
app.listen(PORT, () => {
    console.log(`\n======================================`);
    console.log(`🚀 Service Registry running on port ${PORT}`);
    console.log(`======================================\n`);
});
//# sourceMappingURL=index.js.map