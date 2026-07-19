import { Router, Request, Response } from 'express';
import { prisma } from '../shared/db';
import { PatientClient } from '../shared/clients/PatientClient';
import { AuthClient } from '../shared/clients/AuthClient';

const router = Router();
const patientClient = new PatientClient();
const authClient = new AuthClient();

// Helper function to map flat Prisma metrics into a nested metrics object expected by the frontend
const normalizeDeviceType = (type: any): 'pulsera' | 'oso' => {
  return String(type || 'pulsera').toLowerCase() === 'oso' ? 'oso' : 'pulsera';
};

const normalizeDeviceTypeForPrisma = (type: any): 'OSO' | 'PULSERA' => {
  return String(type || 'pulsera').toLowerCase() === 'oso' ? 'OSO' : 'PULSERA';
};

function mapSessionResponse(session: any) {
  if (!session) return null;
  const rawDate = session.date;
  const isoDate = rawDate instanceof Date
    ? rawDate.toISOString()
    : typeof rawDate === 'number'
    ? new Date(rawDate).toISOString()
    : String(rawDate || new Date().toISOString());
  return {
    id: session.id,
    patientId: session.patientId,
    patientName: session.patientName,
    date: isoDate,
    durationSeconds: session.durationSeconds,
    specialistRole: session.specialistRole,
    specialistId: session.specialistId,
    notes: session.notes,
    deviceType: normalizeDeviceType(session.deviceType),
    sensorHistory: (session.sensorHistory || []).map((reading: any) => ({
      ...reading,
      deviceType: normalizeDeviceType(reading.deviceType)
    })),
    spikesLog: (session.spikesLog || []).map((spike: any) => ({
      ...spike,
      deviceType: normalizeDeviceType(spike.deviceType)
    })),
    metrics: {
      avgHeartRate: session.avgHeartRate,
      maxHeartRate: session.maxHeartRate,
      minHeartRate: session.minHeartRate,
      avgHugForce: session.avgHugForce,
      maxHugForce: session.maxHugForce,
      comfortIndex: session.comfortIndex,
      bilateralSync: session.bilateralSync,
      motorFatigueScore: session.motorFatigueScore,
      stereotypicalCount: session.stereotypicalCount,
      calmStatePercentage: session.calmStatePercentage,
      spikesCount: session.spikesCount
    }
  };
}

// ──────────────────────────────────────────
// GET /api/sessions  → All sessions (opt. filter by patientId)
// ──────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const patientId = req.query['patientId'] ? String(req.query['patientId']) : undefined;

    const sessions = await prisma.clinicalSession.findMany({
      where: patientId ? { patientId } : undefined,
      include: {
        sensorHistory: true,
        spikesLog: true
      },
      orderBy: { date: 'desc' }
    });

    res.json(sessions.map(mapSessionResponse));
  } catch (error) {
    console.error('[GET /sessions]', error);
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
});

// ──────────────────────────────────────────
// GET /api/sessions/:id  → Single session with full data
// ──────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);

    const session = await prisma.clinicalSession.findUnique({
      where: { id },
      include: {
        sensorHistory: true,
        spikesLog: true
      }
    });

    if (!session) {
      res.status(404).json({ error: 'Sesión no encontrada' });
      return;
    }

    // Using Feign Client to get patient data from Patient Service
    const patient = await patientClient.findById(session.patientId);
    const sessionWithPatient = {
      ...session,
      patient: patient ? { id: patient.id, name: patient.name, age: patient.age, diagnosis: patient.diagnosis } : null
    };

    res.json(mapSessionResponse(sessionWithPatient));
  } catch (error) {
    console.error('[GET /sessions/:id]', error);
    res.status(500).json({ error: 'Error al obtener sesión' });
  }
});

// ──────────────────────────────────────────
// POST /api/sessions  → Save completed session
// ──────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      patientName,
      durationSeconds,
      specialistRole,
      specialistId: bodySpecialistId,
      notes,
      deviceType,
      metrics,
      sensorHistory,
      spikesLog
    } = req.body as {
      patientId?: string;
      patientName?: string;
      durationSeconds?: number | string;
      specialistRole?: string;
      specialistId?: string;
      notes?: string;
      deviceType?: string;
      metrics?: Record<string, number>;
      sensorHistory?: Array<Record<string, unknown>>;
      spikesLog?: Array<Record<string, unknown>>;
    };

    if (!patientId || typeof patientId !== 'string') {
      res.status(400).json({ error: 'patientId es requerido' });
      return;
    }
    if (!metrics || typeof metrics !== 'object') {
      res.status(400).json({ error: 'metrics es requerido' });
      return;
    }

    let specialistId = bodySpecialistId;
    if (!specialistId) {
      // Using Feign Client to communicate with Auth Service
      const defaultSpecialist = await authClient.findSpecialistByEmail('accionsocial@gmail.com');
      if (defaultSpecialist) {
        specialistId = defaultSpecialist.id;
      }
    }

    if (!specialistId) {
      res.status(400).json({ error: 'specialistId es requerido' });
      return;
    }

    // Using Feign Client to communicate with Patient Service
    const patient = await patientClient.findById(patientId);
    if (!patient) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }

    const safeSensorHistory = Array.isArray(sensorHistory) ? sensorHistory : [];
    const safeSpikesLog = Array.isArray(spikesLog) ? spikesLog : [];

    const newSession = await prisma.clinicalSession.create({
      data: {
        patientId,
        specialistId,
        patientName: patientName ?? patient.name,
        durationSeconds: Number(durationSeconds) || 0,
        specialistRole: specialistRole ?? 'PSICOLOGIA_CLINICA',
        notes: notes ?? '',
        deviceType: normalizeDeviceTypeForPrisma(deviceType),
        avgHugForce:         Number(metrics['avgHugForce'])         || 0,
        maxHugForce:         Number(metrics['maxHugForce'])         || 0,
        comfortIndex:        Number(metrics['comfortIndex'])        || 0,
        bilateralSync:       Number(metrics['bilateralSync'])       || 0,
        motorFatigueScore:   Number(metrics['motorFatigueScore'])   || 0,
        stereotypicalCount:  Number(metrics['stereotypicalCount'])  || 0,
        calmStatePercentage: Number(metrics['calmStatePercentage']) || 0,
        spikesCount:         Number(metrics['spikesCount'])         || 0,

        sensorHistory: {
          create: safeSensorHistory.map((s) => ({
            timestamp: String(s['timestamp'] ?? ''),
            hugForce:  Number(s['hugForce'])  || 0,
            rotationX: Number(s['rotationX']) || 0,
            rotationY: Number(s['rotationY']) || 0,
            rotationZ: Number(s['rotationZ']) || 0,
            heartRate: Number(s['heartRate']) || 0
          }))
        },

        spikesLog: {
          create: safeSpikesLog.map((sp) => ({
            ...(sp['id'] && typeof sp['id'] === 'string' ? { id: sp['id'] } : {}),
            timestamp: String(sp['timestamp'] ?? ''),
            type:      String(sp['type']      ?? ''),
            value:     Number(sp['value'])    || 0,
            alertText: String(sp['alertText'] ?? ''),
            severity:  String(sp['severity']  ?? 'info')
          }))
        }
      },
      include: {
        sensorHistory: true,
        spikesLog: true
      }
    });

    res.status(201).json(mapSessionResponse(newSession));
  } catch (error) {
    console.error('[POST /sessions]', error);
    res.status(500).json({ error: 'Error al guardar sesión' });
  }
});

// ──────────────────────────────────────────
// PATCH /api/sessions/:id/notes  → Update notes only
// ──────────────────────────────────────────
router.patch('/:id/notes', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const { notes } = req.body as { notes?: string };

    if (typeof notes !== 'string') {
      res.status(400).json({ error: 'notes debe ser una cadena de texto' });
      return;
    }

    const existing = await prisma.clinicalSession.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Sesión no encontrada' });
      return;
    }

    const updated = await prisma.clinicalSession.update({
      where: { id },
      data: { notes }
    });

    res.json(updated);
  } catch (error) {
    console.error('[PATCH /sessions/:id/notes]', error);
    res.status(500).json({ error: 'Error al actualizar notas de sesión' });
  }
});

// ──────────────────────────────────────────
// DELETE /api/sessions/:id  → Remove session and all related data
// ──────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);

    const existing = await prisma.clinicalSession.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Sesión no encontrada' });
      return;
    }

    await prisma.spikesLogItem.deleteMany({ where: { sessionId: id } });
    await prisma.sensorReading.deleteMany({ where: { sessionId: id } });
    await prisma.clinicalSession.delete({ where: { id } });

    res.json({ message: 'Sesión eliminada correctamente', id });
  } catch (error) {
    console.error('[DELETE /sessions/:id]', error);
    res.status(500).json({ error: 'Error al eliminar sesión' });
  }
});

export default router;
