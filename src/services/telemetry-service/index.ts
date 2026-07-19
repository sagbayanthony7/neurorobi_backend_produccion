import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { registerService } from '../../shared/service-utils';
import { PatientClient } from '../../shared/clients/PatientClient';
import { SessionClient } from '../../shared/clients/SessionClient';
import * as dotenv from 'dotenv';

dotenv.config();

const patientClient = new PatientClient();
const sessionClient = new SessionClient();

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// ────────────────────────────────────
// Dashboard Stats  GET /api/stats
// Using Feign Clients to communicate with Patient and Session Services
// ────────────────────────────────────

type DeviceType = 'pulsera' | 'oso';
const DEVICE_TYPES: DeviceType[] = ['pulsera', 'oso'];
const lastTelemetryTime: Record<DeviceType, number> = { pulsera: 0, oso: 0 };
const deviceConnections: Record<DeviceType, boolean> = { pulsera: false, oso: false };
const devicePatientMap: Record<DeviceType, string | null> = { pulsera: null, oso: null };

interface PatientStreamPayload {
  patientId: string;
  deviceType: DeviceType;
}

const getPatientRoom = (patientId: string) => `patient:${patientId}`;

app.get('/api/stats', async (_req: Request, res: Response) => {
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
  } catch (error) {
    console.error('[GET /api/stats]', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// HTTP POST endpoint for ESP32 telemetry
app.post('/api/telemetry', (req: Request, res: Response) => {
  const rawType = String(req.body.deviceType || 'pulsera').toLowerCase();
  const deviceType: DeviceType = rawType === 'oso' ? 'oso' : 'pulsera';
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
  } else {
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

  socket.on('start-stream', (payload: PatientStreamPayload) => {
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

  const cleanupPatientStream = async (socket: Socket) => {
    const patientRoom = socket.data.patientRoom as string | undefined;
    const deviceType = socket.data.deviceType as DeviceType | undefined;

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
  registerService('telemetry-service', Number(PORT));
});
