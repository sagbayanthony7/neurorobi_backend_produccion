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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const service_utils_1 = require("../../shared/service-utils");
const PatientClient_1 = require("../../shared/clients/PatientClient");
const SessionClient_1 = require("../../shared/clients/SessionClient");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const patientClient = new PatientClient_1.PatientClient();
const sessionClient = new SessionClient_1.SessionClient();
dotenv.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const DEVICE_TYPES = ['pulsera', 'oso'];
const lastTelemetryTime = { pulsera: 0, oso: 0 };
const deviceConnections = { pulsera: false, oso: false };
const devicePatientMap = { pulsera: null, oso: null };
const getPatientRoom = (patientId) => `patient:${patientId}`;
app.get('/api/stats', async (_req, res) => {
    try {
        // Using Feign Clients to get data from other services
        const [totalPatients, activePatients, sessionStats] = await Promise.all([
            patientClient.count(),
            patientClient.countByStatus('En Sesión'),
            sessionClient.getStats()
        ]);
        res.json({
            totalPatients,
            totalSessions: sessionStats.totalSessions,
            activePatients,
            recentSessions: sessionStats.recentSessions
        });
    }
    catch (error) {
        console.error('[GET /api/stats]', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});
// HTTP POST endpoint for ESP32 telemetry
app.post('/api/telemetry', (req, res) => {
    const rawType = String(req.body.deviceType || 'pulsera').toLowerCase();
    const deviceType = rawType === 'oso' ? 'oso' : 'pulsera';
    const { hugForce, rotationX, rotationY, rotationZ, heartRate, switch1, switch2, shakeIntensity } = req.body;
    // Mark device as connected and update timestamp
    lastTelemetryTime[deviceType] = Date.now();
    if (!deviceConnections[deviceType]) {
        deviceConnections[deviceType] = true;
        console.log(`[Telemetry] ${deviceType.toUpperCase()} connected and sending data via HTTP POST`);
    }
    const nowStr = new Date().toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const hForce = Number(hugForce) || 0;
    const rotX = Number(rotationX) || 0;
    const rotY = Number(rotationY) || 0;
    const rotZ = Number(rotationZ) || 0;
    const hRate = typeof heartRate === 'undefined' ? -1 : Number(heartRate) || 0;
    const sw1 = Boolean(switch1);
    const sw2 = Boolean(switch2);
    const shake = Number(shakeIntensity) || 0;
    const dataPayload = {
        timestamp: nowStr,
        deviceType,
        hugForce: hForce,
        rotationX: rotX,
        rotationY: rotY,
        rotationZ: rotZ,
        heartRate: hRate,
        switch1: sw1,
        switch2: sw2,
        shakeIntensity: shake
    };
    const targetPatientId = devicePatientMap[deviceType];
    if (targetPatientId) {
        const targetRoom = getPatientRoom(targetPatientId);
        io.to(targetRoom).emit('sensor-data', dataPayload);
        io.to(targetRoom).emit('device-status', { deviceType, connected: true });
    }
    else {
        console.warn(`[Telemetry] No active patient stream for ${deviceType.toUpperCase()} — data will not be broadcast.`);
    }
    // Check thresholds for spikes
    const rotMag = Math.round(Math.sqrt(rotX * rotX + rotY * rotY + rotZ * rotZ));
    if (hRate > 120) {
        io.emit('spike-triggered', {
            id: `spk-real-hr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            deviceType,
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
            deviceType,
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
            deviceType,
            timestamp: nowStr,
            type: 'Cinemática',
            value: rotMag,
            alertText: `Crisis de Agitación Motora: Rotación acelerada de ${rotMag}°/s.`,
            severity: 'warning'
        });
    }
    res.status(200).json({ status: 'ok', deviceConnected: true });
});
const HEARTBEAT_TIMEOUT_MS = 5000;
const HEARTBEAT_CHECK_INTERVAL_MS = 1000;
// Periodic heartbeat checker: runs every second
setInterval(() => {
    const now = Date.now();
    DEVICE_TYPES.forEach(deviceType => {
        if (deviceConnections[deviceType] && now - lastTelemetryTime[deviceType] > HEARTBEAT_TIMEOUT_MS) {
            deviceConnections[deviceType] = false;
            console.log(`[Heartbeat] ${deviceType.toUpperCase()} connection lost (no data for ${HEARTBEAT_TIMEOUT_MS / 1000}s)`);
            io.emit('device-status', { deviceType, connected: false });
        }
    });
}, HEARTBEAT_CHECK_INTERVAL_MS);
io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on('start-stream', (payload) => {
        const { patientId, deviceType } = payload;
        const patientRoom = getPatientRoom(patientId);
        console.log(`[Socket] Starting telemetry stream for patient: ${patientId}, device: ${deviceType}`);
        if (socket.data.patientRoom && socket.data.patientRoom !== patientRoom) {
            socket.leave(socket.data.patientRoom);
        }
        socket.join(patientRoom);
        socket.data.patientId = patientId;
        socket.data.patientRoom = patientRoom;
        socket.data.deviceType = deviceType;
        devicePatientMap[deviceType] = patientId;
        DEVICE_TYPES.forEach(statusDeviceType => {
            socket.emit('device-status', { deviceType: statusDeviceType, connected: deviceConnections[statusDeviceType] });
        });
    });
    const cleanupPatientStream = async (socket) => {
        const patientRoom = socket.data.patientRoom;
        const deviceType = socket.data.deviceType;
        if (patientRoom && deviceType) {
            socket.leave(patientRoom);
            const remaining = await io.in(patientRoom).allSockets();
            if (remaining.size === 0) {
                devicePatientMap[deviceType] = null;
            }
        }
    };
    socket.on('stop-stream', async () => {
        console.log(`[Socket] Stream stopped by client: ${socket.id}`);
        await cleanupPatientStream(socket);
    });
    socket.on('disconnect', async () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
        await cleanupPatientStream(socket);
    });
    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});
const PORT = process.env.TELEMETRY_PORT || 3005;
httpServer.listen(PORT, () => {
    console.log(`[Telemetry Service] Running on port ${PORT}`);
    (0, service_utils_1.registerService)('telemetry-service', Number(PORT));
});
//# sourceMappingURL=index.js.map