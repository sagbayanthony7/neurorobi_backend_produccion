"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const patients_1 = __importDefault(require("./routes/patients"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const auth_1 = __importStar(require("./routes/auth"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' }
});
// ────────────────────────────────────
// Prisma v7 — PostgreSQL via Driver Adapter (Neon)
// ────────────────────────────────────
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = new client_1.PrismaClient({ adapter });
// ────────────────────────────────────
// Middlewares
// ────────────────────────────────────
const path_1 = __importDefault(require("path"));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '5mb' })); // allow large sensorHistory payloads
// ────────────────────────────────────
// Health Check
// ────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Neurorobi Backend',
        version: '1.0.0'
    });
});
// ────────────────────────────────────
// Dashboard Stats  GET /api/stats
// ────────────────────────────────────
app.get('/api/stats', async (_req, res) => {
    try {
        const [totalPatients, totalSessions, recentSessions] = await Promise.all([
            exports.prisma.patient.count(),
            exports.prisma.clinicalSession.count(),
            exports.prisma.clinicalSession.findMany({
                take: 5,
                orderBy: { date: 'desc' },
                select: {
                    id: true,
                    patientName: true,
                    date: true,
                    durationSeconds: true,
                    specialistRole: true
                }
            })
        ]);
        const activePatients = await exports.prisma.patient.count({
            where: { status: 'En Sesión' }
        });
        res.json({
            totalPatients,
            totalSessions,
            activePatients,
            recentSessions
        });
    }
    catch (error) {
        console.error('[GET /api/stats]', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});
// ────────────────────────────────────
// API Routes
// ────────────────────────────────────
app.use('/api/auth', auth_1.default);
app.use('/api/patients', patients_1.default);
app.use('/api/sessions', sessions_1.default);
// Global state for ESP32 heartbeat and connection
let lastESP32TelemetryTime = 0;
let isESP32Connected = false;
// HTTP POST endpoint for ESP32 telemetry
app.post('/api/telemetry', (req, res) => {
    const { hugForce, rotationX, rotationY, rotationZ, heartRate } = req.body;
    // Mark device as connected and update timestamp
    lastESP32TelemetryTime = Date.now();
    if (!isESP32Connected) {
        isESP32Connected = true;
        console.log('[Telemetry] ESP32 Connected and sending data via HTTP POST');
        io.emit('device-status', { connected: true });
    }
    const nowStr = new Date().toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const hForce = Number(hugForce) || 0;
    const rotX = Number(rotationX) || 0;
    const rotY = Number(rotationY) || 0;
    const rotZ = Number(rotationZ) || 0;
    const hRate = Number(heartRate) || 0;
    const dataPayload = {
        timestamp: nowStr,
        hugForce: hForce,
        rotationX: rotX,
        rotationY: rotY,
        rotationZ: rotZ,
        heartRate: hRate
    };
    // Broadcast real telemetry to frontend clients
    io.emit('sensor-data', dataPayload);
    // Check thresholds for spikes
    const rotMag = Math.round(Math.sqrt(rotX * rotX + rotY * rotY + rotZ * rotZ));
    if (hRate > 120) {
        io.emit('spike-triggered', {
            id: `spk-real-hr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: nowStr,
            type: 'Frecuencia Cardíaca',
            value: hRate,
            alertText: `Taquicardia transitoria detectada: ${hRate} lpm. Paciente bajo desregulación autonómica.`,
            severity: 'critical'
        });
    }
    if (hForce > 80) {
        io.emit('spike-triggered', {
            id: `spk-real-press-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: nowStr,
            type: 'Presión',
            value: hForce,
            alertText: `Abrazo Afectivo de Alta Intensidad: ${hForce}% de presión registrado.`,
            severity: 'warning'
        });
    }
    if (rotMag > 130) {
        io.emit('spike-triggered', {
            id: `spk-real-rot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: nowStr,
            type: 'Cinemática',
            value: rotMag,
            alertText: `Crisis de Agitación Motora: Rotación acelerada de ${rotMag}°/s.`,
            severity: 'warning'
        });
    }
    res.status(200).json({ status: 'ok', deviceConnected: true });
});
// Periodic heartbeat checker: runs every 1 second
setInterval(() => {
    const now = Date.now();
    if (isESP32Connected && now - lastESP32TelemetryTime > 3000) {
        isESP32Connected = false;
        console.log('[Heartbeat] ESP32 connection lost (no data for 3s)');
        io.emit('device-status', { connected: false });
    }
}, 1000);
// ────────────────────────────────────
// 404 Handler
// ────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});
// ────────────────────────────────────
// Global Error Handler
// ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[Unhandled Error]', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// ────────────────────────────────────
// Socket.io — Real-time Telemetry
// ────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on('start-stream', (patientId) => {
        console.log(`[Socket] Starting telemetry stream for patient: ${patientId}`);
        // Emit current device connection status on stream start
        socket.emit('device-status', { connected: isESP32Connected });
    });
    socket.on('stop-stream', () => {
        console.log(`[Socket] Stream stopped by client: ${socket.id}`);
    });
    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});
// ────────────────────────────────────
// Start Server
// ────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, async () => {
    console.log(`\n🚀 Neurorobi Backend → http://localhost:${PORT}`);
    console.log(`📡 Socket.io ready on port ${PORT}`);
    console.log(`🏥 Health check → http://localhost:${PORT}/health\n`);
    // Seed default user if not exists
    await (0, auth_1.seedInitialUser)();
});
//# sourceMappingURL=index.js.map